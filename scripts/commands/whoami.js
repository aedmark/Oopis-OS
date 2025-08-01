// scripts/commands/whoami.js

window.WhoamiCommand = class WhoamiCommand extends Command {
  constructor() {
    super({
      commandName: "whoami",
      description: "Prints the current effective user name.",
      helpText: `Usage: whoami
      Print the current user name.
      DESCRIPTION
      The whoami command prints the user name associated with the
      current effective user ID.`,
      argValidation: {
        exact: 0,
      },
    });
  }

  async coreLogic(context) {
    const { dependencies } = context;
    const { ErrorHandler, UserManager } = dependencies;
    return ErrorHandler.createSuccess(UserManager.getCurrentUser().name);
  }
}

window.CommandRegistry.register(new WhoamiCommand());
