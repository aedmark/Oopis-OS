// scripts/commands/clear.js

/**
 * @file Defines the 'clear' command, which clears the terminal screen.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} clearCommandDefinition
     * @description The command definition for the 'clear' command.
     * This object specifies the command's name, argument validation, and
     * the core logic for clearing the terminal output.
     */
    const clearCommandDefinition = {
        commandName: "clear",
        argValidation: {
            exact: 0,
        },
        /**
         * The core logic for the 'clear' command.
         * If the command is run in an interactive terminal session, it clears
         * all previous output from the screen. In non-interactive contexts (e.g., scripts),
         * it does nothing as there is no visual terminal to clear.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {object} context.options - Execution options, including `isInteractive`.
         * @returns {Promise<object>} A promise that resolves to a command result object.
         */
        coreLogic: async (context) => {
            if (context.options.isInteractive) {
                OutputManager.clearOutput();
            }
            return {
                success: true,
                output: "",
            };
        },
    };

    const clearDescription = "Clears the terminal screen of all previous output.";

    const clearHelpText = `Usage: clear

Clear the terminal screen.

DESCRIPTION
       The clear command clears your screen, removing all previous output
       and moving the command prompt to the top of the visible area.

       This does not clear your command history, which can still be
       accessed with the up and down arrow keys. To clear history, use
       the 'history -c' command.`;

    CommandRegistry.register("clear", clearCommandDefinition, clearDescription, clearHelpText);
})();