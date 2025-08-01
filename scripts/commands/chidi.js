// scripts/commands/chidi.js

async function _getFilesForAnalysis(startPath, startNode, currentUser, FileSystemManager, Utils) {
  const files = [];
  const visited = new Set();
  const SUPPORTED_EXTENSIONS = new Set(["md", "txt", "js", "sh"]);

  async function recurse(currentPath, node) {
    if (visited.has(currentPath)) return;
    visited.add(currentPath);

    if (!FileSystemManager.hasPermission(node, currentUser, "read")) return;

    if (node.type === "file") {
      if (SUPPORTED_EXTENSIONS.has(Utils.getFileExtension(currentPath))) {
        files.push({
          name: currentPath.split("/").pop(),
          path: currentPath,
          content: node.content || "",
        });
      }
    } else if (node.type === "directory") {
      if (!FileSystemManager.hasPermission(node, currentUser, "execute"))
        return;
      for (const childName of Object.keys(node.children || {}).sort()) {
        await recurse(
            FileSystemManager.getAbsolutePath(childName, currentPath),
            node.children[childName]
        );
      }
    }
  }

  await recurse(startPath, startNode);
  return files;
}

window.ChidiCommand = class ChidiCommand extends Command {
  constructor() {
    super({
      commandName: "chidi",
      dependencies: ["apps/chidi/chidi_ui.js", "apps/chidi/chidi_manager.js"],
      applicationModules: ["ChidiManager", "ChidiUI", "App"],
      description: "Opens the Chidi AI-powered document and code analyst.",
      helpText: `Usage: chidi [-n] [-p provider] [-m model] [path]
    <command> | chidi
    Opens the Chidi AI-powered document and code analyst.
    DESCRIPTION
    Chidi is a powerful graphical tool that leverages a Large Language
    Model (LLM) to help you understand and interact with your files.
    It can summarize documents, suggest insightful questions, and answer
    your questions based on the content of the files you provide.
    You can launch Chidi on a specific file or directory, or pipe a list
    of file paths to it (e.g., from 'find').
    MODES OF OPERATION
    1.  Directory/File Mode:
    Run 'chidi [path]' to analyze a specific file or all supported
    files within a directory and its subdirectories. If no path is
    given, it uses the current directory.
    2.  Piped Mode:
    Pipe the output of another command to Chidi to create a custom
    set of files for analysis. This is useful for analyzing files
    that are scattered across different locations.
    PROVIDERS & MODELS
    -p, --provider <name>
    Specify the AI provider to use (e.g., 'gemini', 'ollama').
    If not specified, it defaults to 'gemini'. Using a local
    provider like 'ollama' does not require an API key.
    -m, --model <name>
    Specify a particular model for the chosen provider (e.g.,
    'llama3' for ollama). If not specified, the provider's
    default model is used.
    OPTIONS
    -n, --new
    Starts a new, fresh conversation, clearing any previous
    conversational memory from the current session.
    SUPPORTED FILE TYPES
    Chidi can analyze text-based files with the following extensions:
    .md, .txt, .js, .sh
    EXAMPLES
    chidi ./docs
    Opens Chidi and loads all supported files from the 'docs'
    directory for analysis.
    chidi -p ollama ./src
    Opens Chidi using the local 'ollama' provider to analyze
    the 'src' directory, avoiding the need for a Gemini API key.
    find . -name "*.js" | chidi
    Finds all JavaScript files in the current directory and its
    subdirectories, then opens Chidi with that specific list
    of files for analysis.`,
      completionType: "paths",
      flagDefinitions: [
        { name: "new", short: "-n", long: "--new" },
        { name: "provider", short: "-p", long: "--provider", takesValue: true },
        { name: "model", short: "-m", long: "--model", takesValue: true },
      ],
      argValidation: {
        max: 1,
        error: "Usage: chidi [-n] [path] or <command> | chidi [-n]",
      },
    });
  }

  async coreLogic(context) {

    const { args, flags, currentUser, options, dependencies } = context;
    const {
      FileSystemManager,
      Utils,
      ErrorHandler,
      AppLayerManager,
      StorageManager,
      Config,
      OutputManager,
      ChidiManager,
      ChidiUI,
      App
    } = dependencies;

    try {
      if (!options.isInteractive) {
        return ErrorHandler.createError(
            "chidi: Can only be run in interactive mode."
        );
      }

      if (
          typeof ChidiManager === "undefined" ||
          typeof ChidiUI === "undefined" ||
          typeof App === "undefined"
      ) {
        return ErrorHandler.createError(
            "chidi: The Chidi application modules are not properly loaded."
        );
      }

      const provider = flags.provider || "gemini";
      if (
          provider === "gemini" &&
          !StorageManager.loadItem(Config.STORAGE_KEYS.GEMINI_API_KEY)
      ) {
        return ErrorHandler.createError(
            "chidi: Gemini API key not set. Please run 'gemini' once to set it."
        );
      }

      let files = [];
      let hadErrors = false;
      const SUPPORTED_EXTENSIONS = new Set(["md", "txt", "js", "sh"]);

      if (options.stdinContent) {
        if (args.length > 0)
          return ErrorHandler.createError(
              "chidi: does not accept file arguments when receiving piped input."
          );
        const pathsFromPipe = options.stdinContent.trim().split("\n");
        for (const path of pathsFromPipe) {
          if (!path.trim()) continue;
          const pathValidationResult = FileSystemManager.validatePath(path, {
            expectedType: "file",
            permissions: ["read"],
          });
          if (!pathValidationResult.success) {
            await OutputManager.appendToOutput(
                `chidi: Skipping invalid or unreadable path from pipe: ${path}`,
                { typeClass: Config.CSS_CLASSES.WARNING_MSG }
            );
            hadErrors = true;
            continue;
          }
          const pathValidation = pathValidationResult.data;
          if (
              SUPPORTED_EXTENSIONS.has(
                  Utils.getFileExtension(pathValidation.resolvedPath)
              )
          ) {
            files.push({
              name: pathValidation.resolvedPath.split("/").pop(),
              path: pathValidation.resolvedPath,
              content: pathValidation.node.content || "",
            });
          }
        }
      } else {
        const startPathArg = args.length > 0 ? args[0] : ".";
        const pathValidationResult = FileSystemManager.validatePath(
            startPathArg,
            { permissions: ["read"] }
        );
        if (!pathValidationResult.success) {
          return ErrorHandler.createError(
              `chidi: ${pathValidationResult.error}`
          );
        }
        const pathValidation = pathValidationResult.data;
        files = await _getFilesForAnalysis(
            pathValidation.resolvedPath,
            pathValidation.node,
            currentUser,
            FileSystemManager,
            Utils
        );
      }

      if (files.length === 0) {
        return ErrorHandler.createSuccess(
            `No supported files (.md, .txt, .js, .sh) found to open.`
        );
      }

      AppLayerManager.show(new ChidiManager(), {
        initialFiles: files,
        launchOptions: {
          isNewSession: flags.new,
          provider: provider,
          model: flags.model,
        },
        dependencies: dependencies
      });

      if (hadErrors) {
        return ErrorHandler.createError(
            "One or more paths from pipe were invalid."
        );
      }
      return ErrorHandler.createSuccess("");
    } catch (e) {
      return ErrorHandler.createError(
          `chidi: An unexpected error occurred: ${e.message}`
      );
    }

  }
}

window.CommandRegistry.register(new ChidiCommand());
