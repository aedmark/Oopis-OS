/**
 * @file Defines the 'man' command, which formats and displays the manual page for a given command.
 * It extracts information from the command's definition to present a structured help entry.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * Formats the structured data of a command into a traditional man page layout.
     * This function constructs sections like NAME, SYNOPSIS, DESCRIPTION, and OPTIONS
     * based on the command's registered definition and help text.
     * @param {string} commandName - The name of the command.
     * @param {object} commandData - The command's definition object from the registry,
     * including its handler, description, and help text.
     * @returns {string} A formatted string representing the manual page, or an error message
     * if essential data is missing.
     */
    function formatManPage(commandName, commandData) {
        // CORRECTED: Access the nested definition from the commandData object
        const definition = commandData.definition;
        if (!commandData || !definition) {
            return `No manual entry for ${commandName}`;
        }

        const description = commandData.description || "No description available.";
        const helpText = commandData.helpText || "";
        const output = [];

        // NAME section
        output.push("NAME");
        output.push(`       ${commandName} - ${description}`);
        output.push("");

        // SYNOPSIS section
        const helpLines = helpText.split('\n');
        const synopsisLine = helpLines.find(line => line.trim().toLowerCase().startsWith('usage:'));
        const synopsis = synopsisLine || `       Usage: ${commandName} [options]`;
        output.push("SYNOPSIS");
        output.push(`       ${synopsis.replace("Usage: ", "")}`);
        output.push("");

        // DESCRIPTION section
        const descriptionText = helpLines.slice(synopsisLine ? 1 : 0).join('\n').trim();
        if (descriptionText) {
            output.push("DESCRIPTION");
            descriptionText.split('\n').forEach(line => {
                output.push(`       ${line}`);
            });
            output.push("");
        }

        // OPTIONS section
        if (definition.flagDefinitions && definition.flagDefinitions.length > 0) {
            output.push("OPTIONS");
            definition.flagDefinitions.forEach(flag => {
                let flagLine = "       ";
                const short = flag.short;
                const long = flag.long;
                let flagIdentifiers = [];
                if (short) flagIdentifiers.push(short);
                if (long) flagIdentifiers.push(long);
                flagLine += flagIdentifiers.join(', ');
                if (flag.takesValue) {
                    flagLine += " <value>";
                }
                output.push(flagLine);
            });
            output.push("");
        }

        return output.join('\n');
    }

    /**
     * @const {object} manCommandDefinition
     * @description The command definition for the 'man' command.
     * This object specifies the command's name, argument validation (expecting one command name),
     * and the core logic for retrieving and formatting manual pages.
     */
    const manCommandDefinition = {
        commandName: "man",
        completionType: "commands",
        argValidation: {
            exact: 1, // Expects exactly one argument: the command name.
            error: "what manual page do you want?",
        },
        /**
         * The core logic for the 'man' command.
         * It retrieves the command data from the `CommandExecutor`'s registry.
         * If the command exists, it calls `formatManPage` to generate the manual content.
         * If the command does not exist, it returns an error.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command, expecting a single command name.
         * @returns {Promise<object>} A promise that resolves to a command result object
         * with the formatted manual page or an error if the command is not found.
         */
        coreLogic: async (context) => {
            const { args } = context;
            const commandName = args[0];

            // NEW: Dynamically load the command before trying to get its details.
            const isLoaded = await CommandExecutor._ensureCommandLoaded(commandName);

            if (!isLoaded) {
                return {
                    success: false,
                    error: `No manual entry for ${commandName}`,
                };
            }

            // Now that it's loaded, get the full registry and find the data.
            const allCommands = CommandRegistry.getDefinitions();
            const commandData = allCommands[commandName];

            // This should now always succeed if isLoaded is true.
            if (!commandData) {
                return {
                    success: false,
                    error: `No manual entry for ${commandName}`,
                };
            }

            const manPage = formatManPage(commandName, commandData);

            return {
                success: true,
                output: manPage,
            };
        },
    };

    const manDescription = "Formats and displays the manual page for a command.";

    const manHelpText = `Usage: man <command>

Displays the manual page for a given command.

DESCRIPTION
       The man command formats and displays the manual page for a specified
       command. Manual pages include a command's synopsis, a detailed
       description of its function, and a list of its available options.

EXAMPLES
       man ls
              Displays the comprehensive manual page for the 'ls' command.`;

    CommandRegistry.register("man", manCommandDefinition, manDescription, manHelpText);
})();