// scripts/commands/basic.js

window.BasicCommand = class BasicCommand extends Command {
  constructor() {
    super({
      commandName: "basic",
      dependencies: [
        "apps/basic/basic_interp.js",
        "apps/basic/basic_ui.js",
        "apps/basic/basic_manager.js",
      ],
      applicationModules: ["BasicManager", "BasicUI", "Basic_interp", "App"],
      description:
          "Launches the Oopis Basic Integrated Development Environment, a complete environment for line-numbered programming with advanced functions.",
      helpText: `Usage: basic [filename.bas]
    Launches a full-screen Integrated Development Environment for Oopis Basic.
    DESCRIPTION
    Oopis Basic is a simple, line-numbered programming language integrated
    into the OS. Running 'basic' opens the IDE. If a filename is provided,
    that file will be loaded into the editor buffer.
    IDE COMMANDS
    LIST          - Displays the current program in memory.
    RUN           - Executes the current program.
    SAVE "file"   - Saves the program to a file. If no filename is given,
    saves to the file that was originally loaded.
    LOAD "file"   - Loads a program from a file.
    NEW           - Clears the current program from memory.
    EXIT          - Exits the BASIC environment.
    LANGUAGE FEATURES
    - FOR...TO...STEP...NEXT: Looping construct.
    - DATA, READ, RESTORE: For static data streams.
    - DIM: For creating single-dimension arrays.
    - GOSUB...RETURN: Subroutine calls.
    - IF...THEN...: Conditional logic with operators =, <>, <, >, <=, >=.
    FUNCTIONS
    - RND(x): Generates a random number.
    - SQR(x): Returns the square root of x.
    - SIN(x), COS(x): Trigonometric functions (angle in radians).
    - LEFT$(str, n), RIGHT$(str, n), MID$(str, start, [len]): String manipulation.
    SYSTEM BRIDGE
    - SYS_CMD("cmd"): Executes an OopisOS command and returns the output.
    - SYS_READ("path"): Reads the content of a file.
    - SYS_WRITE("path", "content"): Writes content to a file.
    - SYS_POKE(x, y, char, color): Places a character on the screen at (x,y).`,
      completionType: "paths",
      argValidation: {
        max: 1,
        error: "Usage: basic [filename.bas]",
      },
    });
  }

  async coreLogic(context) {

    const { args, options, currentUser, dependencies } = context;
    const { FileSystemManager, AppLayerManager, ErrorHandler, BasicManager, BasicUI, Basic_interp, App } = dependencies;

    try {
      if (!options.isInteractive) {
        return ErrorHandler.createError(
            "basic: Cannot be run in a non-interactive mode."
        );
      }

      if (
          typeof BasicManager === "undefined" ||
          typeof BasicUI === "undefined" ||
          typeof Basic_interp === "undefined" ||
          typeof App === "undefined"
      ) {
        return ErrorHandler.createError(
            "basic: The BASIC application modules are not loaded."
        );
      }

      let fileContent = null;
      let filePath = null;

      if (args.length > 0) {
        const pathArg = args[0];
        const pathValidationResult = FileSystemManager.validatePath(pathArg, {
          allowMissing: true,
          expectedType: "file",
        });

        if (
            !pathValidationResult.success &&
            pathValidationResult.data?.node
        ) {
          return ErrorHandler.createError(
              `basic: ${pathValidationResult.error}`
          );
        }
        const pathValidation = pathValidationResult.data;

        if (pathValidation.node) {
          if (
              !FileSystemManager.hasPermission(
                  pathValidation.node,
                  currentUser,
                  "read"
              )
          ) {
            return ErrorHandler.createError(
                `basic: cannot read file '${pathArg}': Permission denied`
            );
          }
          filePath = pathValidation.resolvedPath;
          fileContent = pathValidation.node.content;
        } else {
          filePath = pathValidation.resolvedPath;
          fileContent = "";
        }
      }

      AppLayerManager.show(new BasicManager(), {
        content: fileContent,
        path: filePath,
        dependencies: dependencies,
      });

      return ErrorHandler.createSuccess("");
    } catch (e) {
      return ErrorHandler.createError(
          `basic: An unexpected error occurred: ${e.message}`
      );
    }

  }
}

window.CommandRegistry.register(new BasicCommand());
