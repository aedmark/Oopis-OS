(() => {
    "use strict";

    const unaliasCommandDefinition = {
        commandName: "unalias",
        argValidation: {
            min: 1,
            error: "Usage: unalias <alias_name>...",
        },

        coreLogic: async (context) => {
            const { args } = context;
            let allSuccess = true;
            const errorMessages = [];

            for (const aliasName of args) {
                if (!AliasManager.removeAlias(aliasName)) {
                    allSuccess = false;
                    errorMessages.push(`unalias: no such alias: ${aliasName}`);
                }
            }

            if (allSuccess) {
                return {
                    success: true,
                    output: "",
                };
            } else {
                return {
                    success: false,
                    error: errorMessages.join("\n"),
                };
            }
        },
    };

    const unaliasDescription = "Removes one or more defined aliases.";

    const unaliasHelpText = `Usage: unalias <alias_name>...

Remove aliases from the set of defined aliases.

DESCRIPTION
       The unalias command is used to remove one or more specified
       aliases. Once unaliased, the shortcut will no longer be available.

EXAMPLES
       unalias ll
              Removes the 'll' alias.

       unalias mypath mycommand
              Removes both the 'mypath' and 'mycommand' aliases.`;

    CommandRegistry.register("unalias", unaliasCommandDefinition, unaliasDescription, unaliasHelpText);
})();