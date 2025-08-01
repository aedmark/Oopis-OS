// scripts/commands/set.js

window.SetCommand = class SetCommand extends Command {
    constructor() {
        super({
            commandName: "set",
            description: "Sets or displays shell environment variables.",
            helpText: `Usage: set [variable[=value]]
      Set or display environment variables.
      DESCRIPTION
      With no arguments, 'set' displays a list of all current environment
      variables.
      To set a variable, provide a name and an optional value. If no
      value is provided, the variable is set to an empty string.
      Variable names must start with a letter or underscore and can only
      contain letters, numbers, and underscores.
      Use 'unset <variable>' to remove a variable.
      EXAMPLES
      set
      Displays all current environment variables.
      set MY_VAR="Hello World"
      Sets the variable MY_VAR to "Hello World".
      echo $MY_VAR
      Displays the value of MY_VAR.`,
        });
    }

    async coreLogic(context) {
        const { args, dependencies } = context;
        const { EnvironmentManager, Utils, ErrorHandler } = dependencies;

        if (args.length === 0) {
            const allVars = EnvironmentManager.getAll();
            const output = Object.entries(allVars)
                .map(([key, value]) => `${key}=${value}`)
                .sort()
                .join("\n");
            return ErrorHandler.createSuccess(output);
        }

        const { name, value } = Utils.parseKeyValue(args);
        const result = EnvironmentManager.set(name, value || "");

        if (result.success) {
            return ErrorHandler.createSuccess("");
        } else {
            return ErrorHandler.createError(`set: ${result.error}`);
        }
    }
}

window.CommandRegistry.register(new SetCommand());
