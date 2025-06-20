// scripts/commands/date.js

/**
 * @file Defines the 'date' command, which displays the current system date and time.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} dateCommandDefinition
     * @description The command definition for the 'date' command.
     * This object specifies the command's name, argument validation, and
     * the core logic for retrieving and displaying the current date and time.
     */
    const dateCommandDefinition = {
        commandName: "date",
        argValidation: {
            exact: 0,
        },
        /**
         * The core logic for the 'date' command.
         * It retrieves the current date and time from the user's browser environment
         * and returns it as a string.
         * @async
         * @returns {Promise<object>} A promise that resolves to a command result object
         * containing the current date and time string.
         */
        coreLogic: async () => {
            return {
                success: true,
                output: new Date().toString(),
            };
        },
    };

    const dateDescription = "Display the current system date and time.";

    const dateHelpText = `Usage: date

Display the current system date and time.

DESCRIPTION
       The date command prints the current date and time as determined
       by the user's browser, including timezone information.`;

    CommandRegistry.register("date", dateCommandDefinition, dateDescription, dateHelpText);
})();