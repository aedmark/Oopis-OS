// scripts/commands/date.js

window.DateCommand = class DateCommand extends Command {
  constructor() {
    super({
      commandName: "date",
      description: "Display the current system date and time.",
      helpText: `Usage: date
      Display the current system date and time.
      DESCRIPTION
      The date command prints the current date and time as determined
      by the user's browser, including timezone information.`,
      validations: {
        args: {
          exact: 0
        }
      },
    });
  }

  async coreLogic(context) {
    const { ErrorHandler } = context.dependencies;
    return ErrorHandler.createSuccess(new Date().toString());
  }
}

window.CommandRegistry.register(new DateCommand());
