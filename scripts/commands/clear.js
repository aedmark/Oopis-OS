// scripts/commands/clear.js

(() => {
    "use strict";
    const clearCommandDefinition = {
        commandName: "clear",
        argValidation: {
            exact: 0,
        },
        coreLogic: async (context) => {
            if (context.options.isInteractive) {
                OutputManager.clearOutput();
            }
            return {
                success: true,
                output: "",
            };
        },
    };
    const clearDescription = "Clears the terminal screen.";
    const clearHelpText = "Usage: clear";
    CommandRegistry.register("clear", clearCommandDefinition, clearDescription, clearHelpText);
})();