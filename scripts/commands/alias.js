/**
 * @file Defines the 'alias' command, allowing users to create, view, and manage command shortcuts.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} aliasCommandDefinition
     * @description The command definition for the 'alias' command.
     * This object specifies how the command should be parsed and executed. It notably
     * lacks an `argValidation` property because its logic handles a variable number of
     * arguments in different formats (no args, name only, name='value').
     */
    const aliasCommandDefinition = {
        commandName: "alias",
        /**
         * The core logic for the 'alias' command.
         * This function has three modes of operation based on the provided arguments:
         * 1. No arguments: Lists all currently defined aliases.
         * 2. `name='value'` format: Creates or updates an alias.
         * 3. One or more names: Displays the definition for each specified alias.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command.
         * @returns {Promise<object>} A promise that resolves to a command result object.
         */
        coreLogic: async (context) => {
            const { args } = context;

            // Mode 1: No arguments, list all aliases.
            if (args.length === 0) {
                const allAliases = AliasManager.getAllAliases();
                if (Object.keys(allAliases).length === 0) {
                    return {
                        success: true,
                        output: "",
                    };
                }
                const outputLines = [];
                for (const name in allAliases) {
                    const value = allAliases[name];
                    outputLines.push(`alias ${name}='${value}'`);
                }
                return {
                    success: true,
                    output: outputLines.sort().join("\n"),
                };
            }

            // Heuristic to check if we are defining an alias.
            const combinedArg = args.join(" ");
            const eqIndex = combinedArg.indexOf("=");

            // Mode 2: `name='value'` format, define a new alias.
            if (eqIndex !== -1) {
                const name = combinedArg.substring(0, eqIndex).trim();
                let value = combinedArg.substring(eqIndex + 1).trim();
                if (!name) {
                    return {
                        success: false,
                        error: "alias: invalid format. Missing name.",
                    };
                }
                // Strip surrounding quotes from the value, if they exist.
                if (
                    (value.startsWith("'") && value.endsWith("'")) ||
                    (value.startsWith('"') && value.endsWith('"'))
                ) {
                    value = value.substring(1, value.length - 1);
                }
                if (AliasManager.setAlias(name, value)) {
                    return {
                        success: true,
                        output: "",
                    };
                }
                return {
                    success: false,
                    error: "alias: failed to set alias.",
                };
            }
            // Mode 3: One or more arguments without '=', display specific aliases.
            else {
                const outputLines = [];
                const errorLines = [];
                let allFound = true;
                for (const name of args) {
                    const value = AliasManager.getAlias(name);
                    if (value) {
                        outputLines.push(`alias ${name}='${value}'`);
                    } else {
                        errorLines.push(`alias: ${name}: not found`);
                        allFound = false;
                    }
                }
                return {
                    success: allFound,
                    output: outputLines.join("\n"),
                    error: allFound ? null : errorLines.join("\n"),
                };
            }
        },
    };

    /**
     * @const {string} aliasDescription
     * @description A brief, one-line description of the 'alias' command for the 'help' command.
     */
    const aliasDescription = "Create, remove, and display command aliases.";

    /**
     * @const {string} aliasHelpText
     * @description The detailed help text for the 'alias' command, used by 'man'.
     */
    const aliasHelpText = `Usage: alias [name='command']...

Define or display command aliases.

DESCRIPTION
       The alias command allows you to create shortcuts for longer or more
       complex commands. Aliases are saved and persist across sessions.

       Running \`alias\` with no arguments lists all currently defined
       aliases in a reusable format.

       To create or redefine an alias, use the \`name='command'\` format.
       The command string should be quoted if it contains spaces or
       special characters.

       To display a specific alias, run \`alias <name>\`.

EXAMPLES
       alias ll='ls -la'
              Creates a shortcut 'll' for a long directory listing.

       alias mypath='echo $PATH'
              Creates an alias to display the current PATH variable.
       
       alias
              Lists all defined aliases.
       
       alias ll
              Displays the definition for the 'll' alias.`;

    // Register the command with the system
    CommandRegistry.register("alias", aliasCommandDefinition, aliasDescription, aliasHelpText);
})();
