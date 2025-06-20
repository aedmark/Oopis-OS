/**
 * @file Defines the 'pwd' (print working directory) command.
 * This command displays the absolute path of the current working directory.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} pwdCommandDefinition
     * @description The command definition for the 'pwd' command.
     * This object specifies the command's name, argument validation (no arguments expected),
     * and the core logic for retrieving and displaying the current path.
     */
    const pwdCommandDefinition = {
        commandName: "pwd",
        argValidation: {
            exact: 0, // This command takes no arguments.
        },
        /**
         * The core logic for the 'pwd' command.
         * It retrieves the current working directory path from `FileSystemManager.getCurrentPath()`
         * and returns it as the command's output.
         * @async
         * @returns {Promise<object>} A promise that resolves to a command result object
         * with the current working directory path as its output.
         */
        coreLogic: async () => {
            return {
                success: true,
                output: FileSystemManager.getCurrentPath(),
            };
        },
    };

    const pwdDescription = "Prints the current working directory.";

    const pwdHelpText = `Usage: pwd

Print the full path of the current working directory.

DESCRIPTION
       The pwd (print working directory) command writes the full, absolute
       pathname of the current working directory to the standard output.`;

    CommandRegistry.register("pwd", pwdCommandDefinition, pwdDescription, pwdHelpText);
})();