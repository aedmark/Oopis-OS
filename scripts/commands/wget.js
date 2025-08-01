// scripts/commands/wget.js

window.WgetCommand = class WgetCommand extends Command {
  constructor() {
    super({
      commandName: "wget",
      description: "The non-interactive network downloader.",
      helpText: `Usage: wget [-O <file>] <URL>
      The non-interactive network downloader.
      DESCRIPTION
      wget is a utility for downloading files from the Web. It will
      automatically determine the filename from the URL unless a
      different name is specified with the -O option.
      Note: Due to browser security restrictions, wget is subject to
      Cross-Origin Resource Sharing (CORS) policies and may not be able
      to fetch content from all URLs.
      OPTIONS
      -O <file>
      Write documents to <file>.
      EXAMPLES
      wget https://raw.githubusercontent.com/aedmark/Oopis-OS/master/LICENSE.txt
      Downloads the license file and saves it as 'LICENSE.txt'
      in the current directory.`,
      completionType: "paths",
      flagDefinitions: [
        {
          name: "outputFile",
          short: "-O",
          takesValue: true,
        },
      ],
      argValidation: {
        min: 1,
        error: "Usage: wget [-O <file>] <URL>",
      },
    });
  }

  async coreLogic(context) {
    const { args, flags, currentUser, dependencies } = context;
    const { ErrorHandler, FileSystemManager, UserManager, OutputManager, Utils } = dependencies;
    const url = args[0];
    let outputFileName = flags.outputFile;

    try {
      if (!outputFileName) {
        try {
          const urlObj = new URL(url);
          const segments = urlObj.pathname.split("/");
          outputFileName = segments.pop() || "index.html";
        } catch (e) {
          return ErrorHandler.createError(`wget: Invalid URL '${url}'`);
        }
      }

      const pathValidationResult = FileSystemManager.validatePath(
          outputFileName,
          {
            allowMissing: true,
            disallowRoot: true,
          }
      );

      if (!pathValidationResult.success) {
        return ErrorHandler.createError(
            `wget: ${pathValidationResult.error}`
        );
      }
      const pathValidation = pathValidationResult.data;
      if (pathValidation.node && pathValidation.node.type === "directory") {
        return ErrorHandler.createError(
            `wget: '${outputFileName}' is a directory`
        );
      }

      await OutputManager.appendToOutput(
          `--OopisOS WGET--\\nResolving ${url}...`
      );

      const response = await fetch(url);
      await OutputManager.appendToOutput(
          `Connecting to ${new URL(url).hostname}... connected.`
      );
      await OutputManager.appendToOutput(
          `HTTP request sent, awaiting response... ${response.status} ${response.statusText}`
      );

      if (!response.ok) {
        return ErrorHandler.createError(
            `wget: Server responded with status ${response.status} ${response.statusText}`
        );
      }

      const contentLength = response.headers.get("content-length");
      const sizeStr = contentLength
          ? Utils.formatBytes(parseInt(contentLength, 10))
          : "unknown size";
      await OutputManager.appendToOutput(`Length: ${sizeStr}`);

      const content = await response.text();

      const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
      if (!primaryGroup) {
        return ErrorHandler.createError(
            "wget: critical - could not determine primary group for user."
        );
      }

      const saveResult = await FileSystemManager.createOrUpdateFile(
          pathValidation.resolvedPath,
          content,
          {
            currentUser,
            primaryGroup,
          }
      );

      if (!saveResult.success) {
        return ErrorHandler.createError(`wget: ${saveResult.error}`);
      }

      await OutputManager.appendToOutput(`Saving to: ‘${outputFileName}’`);

      return ErrorHandler.createSuccess(
          `‘${outputFileName}’ saved [${content.length} bytes]`,
          { stateModified: true }
      );
    } catch (e) {
      let errorMsg = `wget: An error occurred. This is often due to a network issue or a CORS policy preventing access.`;
      if (e instanceof TypeError && e.message.includes("Failed to fetch")) {
        errorMsg = `wget: Network request failed. The server may be down, or a CORS policy is blocking the request from the browser.`;
      }
      return ErrorHandler.createError(errorMsg);
    }
  }
}

window.CommandRegistry.register(new WgetCommand());
