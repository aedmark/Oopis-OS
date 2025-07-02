/**
 * @file Defines the 'help' command, which provides information about available commands
 * or displays the usage syntax for a specific command.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} helpCommandDefinition
     * @description The command definition for the 'help' command.
     */
    const helpCommandDefinition = {
        commandName: "help",
        completionType: "commands", // Add completion type for arguments
        argValidation: {
            max: 1, // Accepts zero or one argument (a command name).
        },
        /**
         * The core logic for the 'help' command.
         * If no arguments are provided, it lists all available commands from the manifest.
         * If a command name is provided, it dynamically loads that command to show its help text.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @returns {Promise<object>} A promise that resolves to a command result object.
         */
        coreLogic: async (context) => {
            const { args } = context;

            if (args.length === 0) {
                // Get the static manifest of all possible commands.
                const allCommandNames = Config.COMMANDS_MANIFEST.sort();
                // Get the currently loaded commands to fetch their descriptions.
                const loadedCommands = CommandRegistry.getDefinitions();

                let output = "OopisOS Help\n\nAvailable commands:\n";
                allCommandNames.forEach((cmdName) => {
                    const loadedCmd = loadedCommands[cmdName];
                    // Provide the description only if the command has been loaded, otherwise it's unknown.
                    const description = loadedCmd ? loadedCmd.description : "";
                    output += `  ${cmdName.padEnd(15)} ${description}\n`;
                });
                output += "\nType 'help [command]' or 'man [command]' for more details.";
                return { success: true, output };

            } else {
                const cmdName = args[0].toLowerCase();
                // Dynamically load the command before trying to get its details.
                const isLoaded = await CommandExecutor._ensureCommandLoaded(cmdName);

                if (!isLoaded) {
                    return {
                        success: false,
                        error: `help: command not found: ${cmdName}`,
                    };
                }

                const commandData = CommandRegistry.getDefinitions()[cmdName];
                let output = "";

                if (commandData?.helpText) {
                    const helpLines = commandData.helpText.split('\n');
                    const usageLine = helpLines.find(line => line.trim().toLowerCase().startsWith('usage:'));
                    if (usageLine) {
                        output = usageLine.trim();
                    } else {
                        output = `Synopsis for '${cmdName}':\n  ${commandData.description || 'No usage information available.'}`;
                    }
                    output += `\n\nFor more details, run 'man ${cmdName}'`;
                } else {
                    return {
                        success: false,
                        error: `help: command not found: ${args[0]}`,
                    };
                }
                return { success: true, output: output };
            }
        },
    };

    const helpDescription = "Displays a list of commands or a command's syntax.";
    const helpHelpText = `Usage: help [command]

Displays a list of all available commands.
If a command name is provided, it displays the command's usage syntax.

For a full, detailed manual page for a command, use 'man <command>'.`;

    CommandRegistry.register("help", helpCommandDefinition, helpDescription, helpHelpText);
})();