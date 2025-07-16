// scripts/commands/cd.js
(() => {
    "use strict";

    const cdCommandDefinition = {
        commandName: "cd",
        completionType: "paths", // Preserved for tab completion
        argValidation: {
            exact: 1,
            error: "incorrect number of arguments",
        },
        coreLogic: async (context) => {
            const { args, currentUser, options } = context;
            const pathArg = args[0];

            try {
                const pathValidation = FileSystemManager.validatePath(pathArg, {
                    expectedType: 'directory',
                    permissions: ['execute']
                });

                if (pathValidation.error) {
                    return { success: false, error: `cd: ${pathValidation.error.replace(pathArg + ':', '').trim()}` };
                }

                if (FileSystemManager.getCurrentPath() === pathValidation.resolvedPath) {
                    return {
                        success: true,
                        output: "", // No output on success
                    };
                }

                FileSystemManager.setCurrentPath(pathValidation.resolvedPath);

                if (options.isInteractive) {
                    TerminalUI.updatePrompt();
                }

                return {
                    success: true,
                    output: "",
                };
            } catch (e) {
                return { success: false, error: `cd: An unexpected error occurred: ${e.message}` };
            }
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