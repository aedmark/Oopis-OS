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
     * This object specifies the command's name, argument validation (optional command name),
     * and the core logic for providing command assistance.
     */
    const helpCommandDefinition = {
        commandName: "help",
        argValidation: {
            max: 1, // Accepts zero or one argument (a command name).
        },
        /**
         * The core logic for the 'help' command.
         * If no arguments are provided, it lists all available commands with their descriptions.
         * If a command name is provided, it attempts to find that command and display its
         * usage synopsis (extracted from its help text). It also directs the user to 'man'
         * for more detailed information.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command, optionally containing a command name.
         * @returns {Promise<object>} A promise that resolves to a command result object
         * with the help output or an error if the command is not found.
         */
        coreLogic: async (context) => {
            const { args } = context;

            if (args.length === 0) {
                // List only currently loaded/registered commands and explain the behavior.
                const commands = CommandRegistry.getDefinitions();
                let output = "OopisOS Help (showing currently loaded commands):\n\nAvailable commands:\n";
                Object.keys(commands)
                    .sort()
                    .forEach((cmd) => {
                        output += `  ${cmd.padEnd(15)} ${commands[cmd].description || ""}\n`;
                    });
                output += "\nType 'help [command]' to see syntax for a specific command (this will load it if not already loaded).";
                output += "\nType 'man [command]' for the full manual.";
                return { success: true, output };

            } else {
                const cmdName = args[0].toLowerCase();
                // NEW: Dynamically load the command before trying to get its details.
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
                    // This case is now a fallback, as !isLoaded should catch it first.
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