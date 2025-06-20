// scripts/commands/help.js

(() => {
    "use strict";

    const helpCommandDefinition = {
        commandName: "help",
        argValidation: {
            max: 1,
        },
        coreLogic: async (context) => {
            const { args } = context;
            const commands = CommandExecutor.getCommands();
            let output = "";

            if (args.length === 0) {
                output += "OopisOS Help:\n\nAvailable commands:\n";
                Object.keys(commands)
                    .sort()
                    .forEach((cmd) => {
                        output += `  ${cmd.padEnd(15)} ${
                            commands[cmd].description || ""
                        }\n`;
                    });
                output += "\nType 'help [command]' for syntax, or 'man [command]' for the full manual.";
            } else {
                const cmdName = args[0].toLowerCase();
                const commandData = commands[cmdName];

                if (commandData?.helpText) {
                    const helpLines = commandData.helpText.split('\n');
                    const usageLine = helpLines.find(line => line.trim().toLowerCase().startsWith('usage:'));

                    if (usageLine) {
                        output = usageLine.trim();
                    } else {
                        output = `Synopsis for '${cmdName}':\n  ${commandData.description || 'No usage information available.'}`;
                    }
                    output += `\n\nFor more details, run 'man ${cmdName}'`;

                } else if (commandData) {
                    output = `No usage information for '${cmdName}'.\nDescription: ${commandData.description || "N/A"}\n\nFor more details, run 'man ${cmdName}'`;
                } else {
                    return {
                        success: false,
                        error: `help: command not found: ${args[0]}`,
                    };
                }
            }
            return {
                success: true,
                output: output,
            };
        },
    };

    const helpDescription = "Displays a list of commands or a command's syntax.";
    const helpHelpText = `Usage: help [command]

Displays a list of all available commands.
If a command name is provided, it displays the command's usage syntax.

For a full, detailed manual page for a command, use 'man <command>'.`;

    CommandRegistry.register("help", helpCommandDefinition, helpDescription, helpHelpText);
})();