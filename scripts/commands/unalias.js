/**
 * @file Defines the 'unalias' command, which removes one or more defined command aliases.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} unaliasCommandDefinition
     * @description The command definition for the 'unalias' command.
     * This object specifies the command's name, argument validation (at least one alias name),
     * and the core logic for removing aliases.
     */
    const unaliasCommandDefinition = {
        commandName: "unalias",
        argValidation: {
            min: 1, // Requires at least one argument: the alias name(s) to remove.
            error: "Usage: unalias <alias_name>...",
        },
        /**
         * The core logic for the 'unalias' command.
         * It iterates through each provided argument (alias name) and attempts to remove it
         * using `AliasManager.removeAlias`. It tracks success for each removal and collects
         * error messages for aliases that do not exist.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command (alias names).
         * @returns {Promise<object>} A promise that resolves to a command result object,
         * indicating overall success or failure, and any relevant error messages.
         */
        coreLogic: async (context) => {
            const { args } = context;
            let allSuccess = true;
            const errorMessages = [];

            // Iterate through each alias name provided as an argument.
            for (const aliasName of args) {
                // Attempt to remove the alias using the AliasManager.
                if (!AliasManager.removeAlias(aliasName)) {
                    allSuccess = false; // Mark overall operation as failed if any alias removal fails.
                    errorMessages.push(`unalias: no such alias: ${aliasName}`); // Collect error message.
                }
            }

            // Return the final result.
            if (allSuccess) {
                return {
                    success: true,
                    output: "", // No output if all aliases were successfully removed.
                };
            } else {
                return {
                    success: false,
                    error: errorMessages.join("\n"), // Join all collected error messages.
                };
            }
        },
    };

    /**
     * @const {string} unaliasDescription
     * @description A brief, one-line description of the 'unalias' command for the 'help' command.
     */
    const unaliasDescription = "Removes one or more defined aliases.";

    /**
     * @const {string} unaliasHelpText
     * @description The detailed help text for the 'unalias' command, used by 'man'.
     */
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

    // Register the command with the system
    CommandRegistry.register("unalias", unaliasCommandDefinition, unaliasDescription, unaliasHelpText);
})();