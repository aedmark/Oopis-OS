(() => {
    "use strict";

    const cdCommandDefinition = {
        commandName: "cd",
        argValidation: {
            exact: 1,
            error: "incorrect number of arguments",
        },
        pathValidation: [
            {
                argIndex: 0,
                options: {
                    expectedType: Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
                },
            },
        ],
        permissionChecks: [
            {
                pathArgIndex: 0,
                permissions: ["execute"],
            },
        ],

        coreLogic: async (context) => {
            const { options } = context;
            const pathInfo = context.validatedPaths[0];

            if (FileSystemManager.getCurrentPath() === pathInfo.resolvedPath) {
                return {
                    success: true,
                    output: `${Config.MESSAGES.ALREADY_IN_DIRECTORY_PREFIX}${pathInfo.resolvedPath}${Config.MESSAGES.ALREADY_IN_DIRECTORY_SUFFIX} ${Config.MESSAGES.NO_ACTION_TAKEN}`,
                    messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                };
            }

            FileSystemManager.setCurrentPath(pathInfo.resolvedPath);

            if (options.isInteractive) {
                TerminalUI.updatePrompt();
            }

            return {
                success: true,
                output: "",
            };
        },
    };

    const cdDescription = "Changes the current working directory.";

    const cdHelpText = `Usage: cd <directory>

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
       permissions on that directory.`;

    CommandRegistry.register("cd", cdCommandDefinition, cdDescription, cdHelpText);
})();
