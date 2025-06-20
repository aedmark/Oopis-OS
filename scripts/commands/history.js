/**
 * @file Defines the 'history' command, which allows users to view or clear their command history.
 * It provides a record of previously executed commands within the current session.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} historyCommandDefinition
     * @description The command definition for the 'history' command.
     * This object specifies the command's name, supported flags (e.g., -c for clear),
     * and the core logic for managing and displaying command history.
     */
    const historyCommandDefinition = {
        commandName: "history",
        flagDefinitions: [
            {
                name: "clear",
                short: "-c",
                long: "--clear",
            },
        ],
        /**
         * The core logic for the 'history' command.
         * If the 'clear' flag is present, it clears the entire command history.
         * Otherwise, it retrieves the full command history and formats it with
         * line numbers for display.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {object} context.flags - An object containing the parsed flags.
         * @returns {Promise<object>} A promise that resolves to a command result object
         * with the formatted history output or a message indicating history cleared/empty.
         */
        coreLogic: async (context) => {
            if (context.flags.clear) {
                // If the '-c' or '--clear' flag is used, clear the history.
                HistoryManager.clearHistory();
                return {
                    success: true,
                    output: "Command history cleared.",
                    messageType: Config.CSS_CLASSES.SUCCESS_MSG,
                };
            }
            // Otherwise, retrieve and display the full history.
            const history = HistoryManager.getFullHistory();
            if (history.length === 0)
                return {
                    success: true,
                    output: Config.MESSAGES.NO_COMMANDS_IN_HISTORY,
                };
            return {
                success: true,
                // Map each command to a formatted string including its index.
                output: history
                    .map((cmd, i) => `  ${String(i + 1).padStart(3)}  ${cmd}`)
                    .join("\n"),
            };
        },
    };

    const historyDescription = "Displays or clears the command history.";

    const historyHelpText = `Usage: history [-c]

Display or clear the command history.

DESCRIPTION
       The history command displays the list of previously executed
       commands from the current session, with each command prefixed
       by its history number.

       The command history can be navigated in the prompt using the
       up and down arrow keys.

OPTIONS
       -c, --clear
              Clear the entire command history for the current session.`;

    CommandRegistry.register("history", historyCommandDefinition, historyDescription, historyHelpText);
})();