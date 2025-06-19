// scripts/commands/unalias.js

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
    const unaliasDescription = "Removes one or more aliases.";
    const unaliasHelpText = "Usage: unalias <alias_name>...";
    CommandRegistry.register("unalias", unaliasCommandDefinition, unaliasDescription, unaliasHelpText);
})();