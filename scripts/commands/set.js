// scripts/commands/set.js

(() => {
    "use strict";

    const setCommandDefinition = {
        commandName: "set",
        coreLogic: async (context) => {
            const { args } = context;
            if (args.length === 0) {
                const allVars = EnvironmentManager.getAll();
                const output = Object.keys(allVars).sort().map(key => `${key}="${allVars[key]}"`).join('\n');
                return { success: true, output: output };
            }

            const varName = args[0];
            const value = args.slice(1).join(' ');

            const result = EnvironmentManager.set(varName, value);
            if (!result.success) {
                return { success: false, error: `set: ${result.error}` };
            }

            return { success: true };
        }
    };
    const setDescription = "Sets an environment variable.";
    const setHelpText = "Usage: set <varname> [value]\n\nSets the specified [varname] to the specified [value].";

    CommandRegistry.register("set", setCommandDefinition, setDescription, setHelpText);

})();