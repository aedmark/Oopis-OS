(() => {
    "use strict";

    const setCommandDefinition = {
        commandName: "set",

        coreLogic: async (context) => {
            const {args} = context;

            if (args.length === 0) {
                const allVars = EnvironmentManager.getAll();
                const output = Object.keys(allVars).sort().map(key => `${key}="${allVars[key]}"`).join('\n');
                return { success: true, output: output };
            }

            const combinedArg = args.join(' ');
            const eqIndex = combinedArg.indexOf('=');

            if (eqIndex !== -1) {
                const varName = combinedArg.substring(0, eqIndex).trim();
                let value = combinedArg.substring(eqIndex + 1).trim();

                if (!varName) {
                    return { success: false, error: "set: invalid format. Missing variable name." };
                }

                if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
                    value = value.substring(1, value.length - 1);
                }

                const result = EnvironmentManager.set(varName, value);
                if (!result.success) {
                    return { success: false, error: `set: ${result.error}` };
                }
            } else {
                const varName = args[0];
                const value = args.slice(1).join(' ');

                const result = EnvironmentManager.set(varName, value);
                if (!result.success) {
                    return { success: false, error: `set: ${result.error}` };
                }
            }

            return { success: true };
        }
    };

    const setDescription = "Set or display environment variables.";

    const setHelpText = `Usage: set [variable[=value]] ...

Set or display environment variables.

DESCRIPTION
       The set command is used to define session-specific environment
       variables. These variables are expanded by the shell when prefixed
       with a '$' (e.g., $VAR).

       Running \`set\` with no arguments will display a list of all
       currently defined environment variables and their values.

       To set a variable, provide a name and a value. If the value is
       omitted, the variable is set to an empty string. Variable names
       cannot contain spaces.

       Default variables include $USER, $HOME, $HOST, and $PATH.

EXAMPLES
       set
              Displays all current environment variables.

       set GREETING="Hello World"
              Sets the variable GREETING to "Hello World".

       echo $GREETING
              Displays "Hello World" by expanding the variable.`;

    CommandRegistry.register("set", setCommandDefinition, setDescription, setHelpText);
})();