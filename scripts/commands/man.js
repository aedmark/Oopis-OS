// scripts/commands/man.js

(() => {
    "use strict";

    /**
     * Formats the structured data of a command into a traditional man page layout.
     * @param {string} commandName - The name of the command.
     * @param {object} commandData - The command's definition object from the registry.
     * @returns {string} A formatted string representing the manual page.
     */
    function formatManPage(commandName, commandData) {
        if (!commandData || !commandData.handler || !commandData.handler.definition) {
            return `No manual entry for ${commandName}`;
        }

        const definition = commandData.handler.definition;
        const description = commandData.description || "No description available.";
        const helpText = commandData.helpText || "";
        const output = [];

        // NAME section
        output.push("NAME");
        output.push(`       ${commandName} - ${description}`);
        output.push("");

        // SYNOPSIS section
        // We extract the synopsis from the first line of the help text if it starts with "Usage:".
        const helpLines = helpText.split('\n');
        const synopsisLine = helpLines.find(line => line.trim().toLowerCase().startsWith('usage:'));
        const synopsis = synopsisLine || `       Usage: ${commandName} [options]`;
        output.push("SYNOPSIS");
        output.push(`       ${synopsis.replace("Usage: ", "")}`);
        output.push("");

        // DESCRIPTION section
        // The rest of the help text becomes the description.
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

                // Note: We could enhance flagDefinitions to include a description for each flag in the future.
                output.push(flagLine);
            });
            output.push("");
        }

        return output.join('\n');
    }

    const manCommandDefinition = {
        commandName: "man",
        argValidation: {
            exact: 1,
            error: "what manual page do you want?",
        },
        coreLogic: async (context) => {
            const { args } = context;
            const commandName = args[0];
            const allCommands = CommandExecutor.getCommands();
            const commandData = allCommands[commandName];

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