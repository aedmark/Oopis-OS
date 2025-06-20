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
        // Basic validation to ensure necessary command data is available.
        if (!commandData || !commandData.handler || !commandData.handler.definition) {
            return `No manual entry for ${commandName}`;
        }

        const definition = commandData.handler.definition; // The command's internal definition.
        const description = commandData.description || "No description available."; // Short description for NAME section.
        const helpText = commandData.helpText || ""; // Detailed help text, typically for DESCRIPTION.
        const output = []; // Array to build the man page lines.

        // NAME section: command name - short description.
        output.push("NAME");
        output.push(`       ${commandName} - ${description}`);
        output.push("");

        // SYNOPSIS section: Extracts the usage line from the help text.
        const helpLines = helpText.split('\n');
        const synopsisLine = helpLines.find(line => line.trim().toLowerCase().startsWith('usage:'));
        // If a "Usage:" line is found, use it; otherwise, provide a generic synopsis.
        const synopsis = synopsisLine || `       Usage: ${commandName} [options]`;
        output.push("SYNOPSIS");
        // Remove "Usage: " prefix for cleaner synopsis display.
        output.push(`       ${synopsis.replace("Usage: ", "")}`);
        output.push("");

        // DESCRIPTION section: Uses the rest of the help text.
        // Skips the synopsis line if it was found.
        const descriptionText = helpLines.slice(synopsisLine ? 1 : 0).join('\n').trim();
        if (descriptionText) {
            output.push("DESCRIPTION");
            // Add each line of the description text, indented.
            descriptionText.split('\n').forEach(line => {
                output.push(`       ${line}`);
            });
            output.push("");
        }

        // OPTIONS section: Lists flags defined in the command's definition.
        if (definition.flagDefinitions && definition.flagDefinitions.length > 0) {
            output.push("OPTIONS");
            definition.flagDefinitions.forEach(flag => {
                let flagLine = "       ";
                const short = flag.short;
                const long = flag.long;

                let flagIdentifiers = [];
                if (short) flagIdentifiers.push(short);
                if (long) flagIdentifiers.push(long);

                flagLine += flagIdentifiers.join(', '); // Join short and long forms (e.g., -a, --all).

                if (flag.takesValue) {
                    flagLine += " <value>"; // Indicate if the flag expects a value.
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
            const allCommands = CommandExecutor.getCommands(); // Get all registered command definitions.
            const commandData = allCommands[commandName]; // Retrieve data for the requested command.

            // Check if the command exists in the registry.
            if (!commandData) {
                return {
                    success: false,
                    error: `No manual entry for ${commandName}`,
                };
            }

            // Format the manual page content using the helper function.
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