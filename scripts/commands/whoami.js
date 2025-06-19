// scripts/commands/whoami.js

(() => {
    "use strict";
    const whoamiCommandDefinition = {
        commandName: "whoami",
        argValidation: {
            exact: 0,
        },
        coreLogic: async () => {
            return {
                success: true,
                output: UserManager.getCurrentUser().name,
            };
        },
    };
    const whoamiDescription = "Displays the current user.";
    const whoamiHelpText = "Usage: whoami";
    CommandRegistry.register("whoami", whoamiCommandDefinition, whoamiDescription, whoamiHelpText);
})();