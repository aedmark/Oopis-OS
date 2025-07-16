// scripts/commands/whoami.js
(() => {
    "use strict";

    const whoamiCommandDefinition = {
        commandName: "whoami",
        argValidation: {
            exact: 0,
        },

        coreLogic: async () => {
            try {
                return {
                    success: true,
                    output: UserManager.getCurrentUser().name,
                };
            } catch (e) {
                return { success: false, error: `whoami: An unexpected error occurred: ${e.message}` };
            }
        },
    };

    const whoamiDescription = "Prints the current effective user name.";

    const whoamiHelpText = `Usage: whoami

Print the current user name.

DESCRIPTION
       The whoami command prints the user name associated with the
       current effective user ID.`;

    CommandRegistry.register("whoami", whoamiCommandDefinition, whoamiDescription, whoamiHelpText);
})();