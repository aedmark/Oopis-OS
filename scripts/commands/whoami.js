/**
 * @file Defines the 'whoami' command, which prints the current effective user name.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} whoamiCommandDefinition
     * @description The command definition for the 'whoami' command.
     * This object specifies the command's name, argument validation (no arguments expected),
     * and the core logic for retrieving and displaying the current user.
     */
    const whoamiCommandDefinition = {
        commandName: "whoami",
        argValidation: {
            exact: 0, // This command takes no arguments.
        },
        /**
         * The core logic for the 'whoami' command.
         * It retrieves the name of the currently active user from `UserManager.getCurrentUser()`
         * and returns it as the command's output.
         * @async
         * @returns {Promise<object>} A promise that resolves to a command result object
         * with the current user's name as its output.
         */
        coreLogic: async () => {
            return {
                success: true,
                output: UserManager.getCurrentUser().name,
            };
        },
    };

    /**
     * @const {string} whoamiDescription
     * @description A brief, one-line description of the 'whoami' command for the 'help' command.
     */
    const whoamiDescription = "Prints the current effective user name.";

    /**
     * @const {string} whoamiHelpText
     * @description The detailed help text for the 'whoami' command, used by 'man'.
     */
    const whoamiHelpText = `Usage: whoami

Print the current user name.

DESCRIPTION
       The whoami command prints the user name associated with the
       current effective user ID.`;

    // Register the command with the system
    CommandRegistry.register("whoami", whoamiCommandDefinition, whoamiDescription, whoamiHelpText);
})();