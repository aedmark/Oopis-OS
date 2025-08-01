// scripts/commands/clear.js

window.ClearCommand = class ClearCommand extends Command {
    constructor() {
        super({
            commandName: "clear",
            description: "Clears the terminal screen of all previous output.",
            helpText: `Usage: clear
      Clear the terminal screen.
      DESCRIPTION
      The clear command clears your screen, removing all previous output
      and moving the command prompt to the top of the visible area.
      This does not clear your command history, which can still be
      accessed with the up and down arrow keys. To clear history, use
      the 'history -c' command.`,
            validations: {
                args: {
                    exact: 0
                }
            },
        });
    }

    async coreLogic(context) {
        const { dependencies } = context;
        const { ErrorHandler } = dependencies;
        if (context.options.isInteractive) {
            return ErrorHandler.createSuccess(null, { effect: "clear_screen" });
        }
        return ErrorHandler.createSuccess("");
    }
}

window.CommandRegistry.register(new ClearCommand());
