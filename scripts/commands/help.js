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
        let output = "OopisOS Help:\n\n";
        if (args.length === 0) {
            output += "Available commands:\n";
            Object.keys(commands)
                .sort()
                .forEach((cmd) => {
                    output += `  ${cmd.padEnd(15)} ${
                        commands[cmd].description || ""
                    }\n`;
                });
            output += "\nType 'help [command]' for more information.";
        } else {
            const cmdName = args[0].toLowerCase();
            if (commands[cmdName]?.helpText) {
                output = commands[cmdName].helpText;
            } else if (commands[cmdName]) {
                output = `No detailed help for '${cmdName}'.\nDesc: ${
                    commands[cmdName].description || "N/A"
                }`;
            } else {
                return {
                    success: false,
                    error: `help: '${args[0]}' not found.`,
                };
            }
        }
        return {
            success: true,
            output: output,
        };
    },
};

    const helpDescription = "Displays help information.";
    const helpHelpText = "Usage: help [command]\n\nDisplays a list of commands or help for a specific [command].";
    CommandRegistry.register("help", helpCommandDefinition, helpDescription, helpHelpText);
})();
