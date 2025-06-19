// scripts/commands/date.js

(() => {
    "use strict";
    const dateCommandDefinition = {
        commandName: "date",
        argValidation: {
            exact: 0,
        },
        coreLogic: async () => {
            return {
                success: true,
                output: new Date().toString(),
            };
        },
    };
    const dateDescription = "Displays the current date and time.";
    const dateHelpText = "Usage: date";

    CommandRegistry.register("date", dateCommandDefinition, dateDescription, dateHelpText);
})();