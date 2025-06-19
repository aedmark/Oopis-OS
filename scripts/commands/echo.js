// scripts/commands/echo.js

(() => {
    "use strict";

    const echoCommandDefinition = {
        commandName: "echo",
        coreLogic: async (context) => {
            return {
                success: true,
                output: context.args.join(" "),
            };
        },
    };

    const echoDescription = "Displays a line of text.";
    const echoHelpText = "Usage: echo [text...]\n\nPrints the specified [text] to the terminal.";

    CommandRegistry.register("echo", echoCommandDefinition, echoDescription, echoHelpText);
})();