// scripts/commands/unset.js

(() => {
    "use strict";

    const unsetCommandDefinition = {
        commandName: "unset",
        argValidation: { min: 1, error: "Usage: unset <variable_name>..." },
        coreLogic: async (context) => {
            context.args.forEach(varName => EnvironmentManager.unset(varName));
            return { success: true };
        }
    };
    const unsetDescription = "Unsets one or more environment variables.";
    const unsetHelpText = "Usage: unset <variable_name>...\n\nUnsets the specified [variable_name]s.";

    CommandRegistry.register("unset", unsetCommandDefinition, unsetDescription, unsetHelpText);

})();