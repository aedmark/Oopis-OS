/**
 * @file Defines the 'unset' command, which unsets one or more environment variables.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} unsetCommandDefinition
     * @description The command definition for the 'unset' command.
     * This object specifies the command's name, argument validation,
     * and the core logic for removing environment variables.
     */
    const unsetCommandDefinition = {
        commandName: "unset",
        argValidation: { min: 1, error: "Usage: unset <variable_name>..." }, // Requires at least one variable name.
        /**
         * The core logic for the 'unset' command.
         * It iterates through each provided argument, treating each as an environment variable name,
         * and removes it from the current session's environment variables using `EnvironmentManager.unset()`.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command (names of variables to unset).
         * @returns {Promise<object>} A promise that resolves to a command result object,
         * always indicating success, as `unset` does not report errors for non-existent variables.
         */
        coreLogic: async (context) => {
            // Iterate over each argument and attempt to unset the corresponding environment variable.
            context.args.forEach(varName => EnvironmentManager.unset(varName));
            // The command is always considered successful, even if a variable did not exist.
            return { success: true };
        }
    };

    /**
     * @const {string} unsetDescription
     * @description A brief, one-line description of the 'unset' command for the 'help' command.
     */
    const unsetDescription = "Unsets one or more environment variables.";

    /**
     * @const {string} unsetHelpText
     * @description The detailed help text for the 'unset' command, used by 'man'.
     */
    const unsetHelpText = `Usage: unset <variable_name>...

Unset environment variable values.

DESCRIPTION
       The unset command removes the specified environment variables from
       the current session. After a variable is unset, it will no longer
       be available for expansion by the shell (e.g., using $VAR).

EXAMPLES
       set GREETING="Hello"
       echo $GREETING
              Hello

       unset GREETING
       echo $GREETING
              (prints a blank line)`;

    // Register the command with the CommandRegistry.
    CommandRegistry.register("unset", unsetCommandDefinition, unsetDescription, unsetHelpText);
})();