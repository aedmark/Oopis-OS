/**
 * @file Defines the 'cd' (change directory) command, a fundamental navigation tool in OopisOS.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} cdCommandDefinition
     * @description The command definition for the 'cd' command.
     * This object specifies how the command should be parsed, validated, and executed.
     * It relies on the command executor to perform argument count, path validation (ensuring
     * the target is a directory), and permission checks (ensuring the user has execute
     * rights) before the core logic is invoked.
     */
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
        /**
         * The core logic for the 'cd' command.
         * This function is executed only after all validations (argument count,
         * path existence, type, and permissions) have passed. It changes the
         * current working directory in the FileSystemManager and updates the UI.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {object} context.options - Execution options, including `isInteractive`.
         * @param {object[]} context.validatedPaths - An array of validated path information objects.
         * @returns {Promise<object>} A promise that resolves to a command result object.
         */
        coreLogic: async (context) => {
            const { options } = context;
            const pathInfo = context.validatedPaths[0];

            // Handle the edge case where the user is already in the target directory.
            if (FileSystemManager.getCurrentPath() === pathInfo.resolvedPath) {
                return {
                    success: true,
                    output: `${Config.MESSAGES.ALREADY_IN_DIRECTORY_PREFIX}${pathInfo.resolvedPath}${Config.MESSAGES.ALREADY_IN_DIRECTORY_SUFFIX} ${Config.MESSAGES.NO_ACTION_TAKEN}`,
                    messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                };
            }

            // Set the new path in the file system manager.
            FileSystemManager.setCurrentPath(pathInfo.resolvedPath);

            // Update the terminal prompt only if in an interactive session.
            if (options.isInteractive) {
                TerminalUI.updatePrompt();
            }

            return {
                success: true,
                output: "",
            };
        },
    };

    /**
     * @const {string} cdDescription
     * @description A brief, one-line description of the 'cd' command for the 'help' command.
     */
    const cdDescription = "Changes the current working directory.";

    /**
     * @const {string} cdHelpText
     * @description The detailed help text for the 'cd' command, used by 'man'.
     */
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

    // Register the command with the system
    CommandRegistry.register("cd", cdCommandDefinition, cdDescription, cdHelpText);
})();
