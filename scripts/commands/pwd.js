// scripts/commands/pwd.js

window.PwdCommand = class PwdCommand extends Command {
  constructor() {
    super({
      commandName: "pwd",
      description: "Prints the current working directory.",
      helpText: `Usage: pwd
      Print the full path of the current working directory.
      DESCRIPTION
      The pwd (print working directory) command writes the full, absolute
      pathname of the current working directory to the standard output.`,
      validations: {
        args: {
          exact: 0
        }
      },
    });
  }

  async coreLogic(context) {
    const { dependencies } = context;
    const { ErrorHandler, FileSystemManager } = dependencies;
    return ErrorHandler.createSuccess(FileSystemManager.getCurrentPath());
  }
}

window.CommandRegistry.register(new PwdCommand());
