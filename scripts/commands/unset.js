// scripts/commands/unset.js

window.UnsetCommand = class UnsetCommand extends Command {
    constructor() {
        super({
            commandName: "unset",
            description: "Unsets one or more shell environment variables.",
            helpText: `Usage: unset <variable_name>...
      Unset environment variables.
      DESCRIPTION
      The unset command removes the specified environment variable(s).
      Once unset, a variable will no longer be available to commands
      or for expansion.
      EXAMPLES
      set MY_VAR="some value"
      unset MY_VAR
      echo $MY_VAR (will print an empty line)`,
            validations: {
                args: {
                    min: 1,
                    error: "Usage: unset <variable_name>..."
                }
            },
        });
    }

    async coreLogic(context) {
        const { args, dependencies } = context;
        const { EnvironmentManager, ErrorHandler } = dependencies;

        for (const varName of args) {
            EnvironmentManager.unset(varName);
        }

        return ErrorHandler.createSuccess("");
    }
}

window.CommandRegistry.register(new UnsetCommand());
