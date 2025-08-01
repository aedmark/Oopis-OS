// scripts/commands/unalias.js

window.UnaliasCommand = class UnaliasCommand extends Command {
    constructor() {
        super({
            commandName: "unalias",
            description: "Removes one or more defined aliases.",
            helpText: `Usage: unalias <alias_name>...
      Remove aliases from the set of defined aliases.
      DESCRIPTION
      The unalias command is used to remove one or more specified
      aliases. Once unaliased, the shortcut will no longer be available.
      EXAMPLES
      unalias ll
      Removes the 'll' alias.
      unalias mypath mycommand
      Removes both the 'mypath' and 'mycommand' aliases.`,
            completionType: "aliases",
            argValidation: {
                min: 1,
                error: "Usage: unalias <alias_name>...",
            },
        });
    }

    async coreLogic(context) {
        const { args, dependencies } = context;
        const { AliasManager, ErrorHandler } = dependencies;

        let allSuccess = true;
        const errorMessages = [];
        let changesMade = false;

        for (const aliasName of args) {
            if (AliasManager.removeAlias(aliasName)) {
                changesMade = true;
            } else {
                allSuccess = false;
                errorMessages.push(`unalias: no such alias: ${aliasName}`);
            }
        }

        if (allSuccess) {
            return ErrorHandler.createSuccess("", { stateModified: changesMade });
        } else {
            return ErrorHandler.createError(errorMessages.join("\n"));
        }
    }
}

window.CommandRegistry.register(new UnaliasCommand());
