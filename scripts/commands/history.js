// scripts/commands/history.js
(() => {
    "use strict";

    const historyCommandDefinition = {
        commandName: "history",
        flagDefinitions: [
            {
                name: "clear",
                short: "-c",
                long: "--clear",
            },
        ],

        coreLogic: async (context) => {
            try {
                if (context.flags.clear) {
                    HistoryManager.clearHistory();
                    return {
                        success: true,
                        output: "Command history cleared.",
                    };
                }
                const history = HistoryManager.getFullHistory();
                if (history.length === 0)
                    return {
                        success: true,
                        output: Config.MESSAGES.NO_COMMANDS_IN_HISTORY,
                    };
                return {
                    success: true,
                    output: history
                        .map((cmd, i) => `  ${String(i + 1).padStart(3)}  ${cmd}`)
                        .join("\\n"),
                };
            } catch (e) {
                return { success: false, error: `history: An unexpected error occurred: ${e.message}` };
            }
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