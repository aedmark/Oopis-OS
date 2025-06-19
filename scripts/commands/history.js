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
            if (context.flags.clear) {
                HistoryManager.clearHistory();
                return {
                    success: true,
                    output: "Command history cleared.",
                    messageType: Config.CSS_CLASSES.SUCCESS_MSG,
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
                    .join("\n"),
            };
        },
    };
    const historyDescription = "Displays the command history.";
    const historyHelpText = "Usage: history [options]\n\nDisplays the command history.";
    CommandRegistry.register("history", historyCommandDefinition, historyDescription, historyHelpText);

})();