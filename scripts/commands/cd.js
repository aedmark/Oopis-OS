// scripts/commands/cd.js

window.CdCommand = class CdCommand extends Command {
    constructor() {
        super({
            commandName: "cd",
            description: "Changes the current working directory.",
            helpText: `Usage: cd <directory>
      Change the current working directory.
      DESCRIPTION
      The cd command changes the current working directory of the shell
      to the specified <directory>.
      The command recognizes special directory names:
      .      Refers to the current directory.
      ..     Refers to the parent directory of the current directory.
      Absolute paths (starting with /) and relative paths are supported.
      EXAMPLES
      cd /home/Guest
      Changes the current directory to /home/Guest.
      cd ../..
      Moves up two directory levels from the current location.
      PERMISSIONS
      To change into a directory, the user must have 'execute' (x)
      permissions on that directory.`,
            completionType: "paths",
            validations: {
                args: { exact: 1, error: "incorrect number of arguments" },
                paths: [
                    {
                        argIndex: 0,
                        options: { expectedType: 'directory', permissions: ['execute'] }
                    }
                ]
            },
        });
    }

    async coreLogic(context) {
        const { options, validatedPaths, dependencies } = context;
        const { FileSystemManager, TerminalUI, ErrorHandler } = dependencies;
        const { resolvedPath } = validatedPaths[0];

        if (FileSystemManager.getCurrentPath() === resolvedPath) {
            return ErrorHandler.createSuccess("");
        }

        FileSystemManager.setCurrentPath(resolvedPath);

        if (options.isInteractive) {
            TerminalUI.updatePrompt();
        }

        return ErrorHandler.createSuccess("");
    }
}

window.CommandRegistry.register(new CdCommand());
