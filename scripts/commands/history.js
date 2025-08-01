// scripts/commands/history.js

window.HistoryCommand = class HistoryCommand extends Command {
    constructor() {
        super({
            commandName: "history",
            description: "Displays or clears the command history.",
            helpText: `Usage: history [-c]
      Display or clear the command history.
      DESCRIPTION
      The history command displays the list of previously executed
      commands from the current session, with each command prefixed
      by its history number.
      The command history can be navigated in the prompt using the
      up and down arrow keys.
      OPTIONS
      -c, --clear
      Clear the entire command history for the current session.`,
            flagDefinitions: [
                {
                    name: "clear",
                    short: "-c",
                    long: "--clear",
                },
            ],
        });
    }

    async coreLogic(context) {
        const { flags, dependencies } = context;
        const { ErrorHandler, HistoryManager, Config } = dependencies;
        if (flags.clear) {
            HistoryManager.clearHistory();
            return ErrorHandler.createSuccess("Command history cleared.");
        }
        const history = HistoryManager.getFullHistory();
        if (history.length === 0)
            return ErrorHandler.createSuccess(
                Config.MESSAGES.NO_COMMANDS_IN_HISTORY
            );

        const output = history
            .map((cmd, i) => `  ${String(i + 1).padStart(3)}  ${cmd}`)
            .join("\n");
        return ErrorHandler.createSuccess(output);
    }
}

window.CommandRegistry.register(new HistoryCommand());
