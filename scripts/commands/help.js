(() => {
    "use strict";

    const helpCommandDefinition = {
        commandName: "help",
        completionType: "commands",
        argValidation: {
            max: 1,
        },

        coreLogic: async (context) => {
            const { args } = context;

            if (args.length === 0) {
                const allCommandNames = Config.COMMANDS_MANIFEST.sort();
                const loadedCommands = CommandRegistry.getDefinitions();

                let output = "OopisOS Help\n\nAvailable commands:\n";
                allCommandNames.forEach((cmdName) => {
                    const loadedCmd = loadedCommands[cmdName];
                    const description = loadedCmd ? loadedCmd.description : "";
                    output += `  ${cmdName.padEnd(15)} ${description}\n`;
                });
                output += "\nType 'help [command]' or 'man [command]' for more details.";
                return { success: true, output };

            } else {
                const cmdName = args[0].toLowerCase();
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