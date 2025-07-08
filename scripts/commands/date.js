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

    const dateDescription = "Display the current system date and time.";

    const dateHelpText = `Usage: date

Display the current system date and time.

DESCRIPTION
       The date command prints the current date and time as determined
       by the user's browser, including timezone information.`;

    CommandRegistry.register("date", dateCommandDefinition, dateDescription, dateHelpText);
})();