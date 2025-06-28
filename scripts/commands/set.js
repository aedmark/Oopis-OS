/**
 * @file Defines the 'set' command, which allows users to set or display environment variables.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} setCommandDefinition
     * @description The command definition for the 'set' command.
     * This object specifies the command's name and its core logic for
     * managing and displaying environment variables.
     */
    const setCommandDefinition = {
        commandName: "set",
        /**
         * The core logic for the 'set' command.
         * If no arguments are provided, it lists all currently defined environment variables.
         * If arguments are provided, it attempts to set a new environment variable.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command.
         * If empty, lists all variables. If `[varName, ...valueParts]`, sets a variable.
         * @returns {Promise<object>} A promise that resolves to a command result object,
         * indicating success, output of variables, or an error if setting a variable fails.
         */
        coreLogic: async (context) => {
            const { args } = context;

            if (args.length === 0) {
                const allVars = EnvironmentManager.getAll();
                const output = Object.keys(allVars).sort().map(key => `${key}="${allVars[key]}"`).join('\n');
                return { success: true, output: output };
            }

            const combinedArg = args.join(' ');
            const eqIndex = combinedArg.indexOf('=');

            // Heuristic: If an '=' is present, we assume 'VAR=value' format.
            // This handles `VAR=val`, `VAR="val"`, and `VAR = "val"`.
            if (eqIndex !== -1) {
                const varName = combinedArg.substring(0, eqIndex).trim();
                let value = combinedArg.substring(eqIndex + 1).trim();

                if (!varName) {
                    return { success: false, error: "set: invalid format. Missing variable name." };
                }

                // Strip surrounding quotes from the value, if they exist.
                if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
                    value = value.substring(1, value.length - 1);
                }

                const result = EnvironmentManager.set(varName, value);
                if (!result.success) {
                    return { success: false, error: `set: ${result.error}` };
                }
            } else {
                // If NO '=' is found, we assume 'set VAR value' format for compatibility.
                const varName = args[0];
                // The value is the rest of the arguments, which are already tokenized correctly.
                const value = args.slice(1).join(' ');

                const result = EnvironmentManager.set(varName, value);
                if (!result.success) {
                    return { success: false, error: `set: ${result.error}` };
                }
            }

            return { success: true };
        }
    };

    /**
     * @const {string} setDescription
     * @description A brief, one-line description of the 'set' command for the 'help' command.
     */
    const setDescription = "Set or display environment variables.";

    /**
     * @const {string} setHelpText
     * @description The detailed help text for the 'set' command, used by 'man'.
     */
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