// scripts/commands/alias.js

(() => {
    "use strict";
    const aliasCommandDefinition = {
        commandName: "alias",
        coreLogic: async (context) => {
            const { args } = context;
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
            const combinedArg = args.join(" ");
            const eqIndex = combinedArg.indexOf("=");
            if (eqIndex !== -1) {
                const name = combinedArg.substring(0, eqIndex).trim();
                let value = combinedArg.substring(eqIndex + 1).trim();
                if (!name) {
                    return {
                        success: false,
                        error: "alias: invalid format. Missing name.",
                    };
                }
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
    const aliasDescription = "Displays or sets aliases.";
    const aliasHelpText = "Usage: alias [name]=[value]\n\nDisplays or sets aliases. If no arguments are provided, displays all aliases.";
    CommandRegistry.register("alias", aliasCommandDefinition, aliasDescription, aliasHelpText);
})();