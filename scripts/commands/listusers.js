// scripts/commands/listusers.js
(() => {
    "use strict";

    const listusersCommandDefinition = {
        commandName: "listusers",
        argValidation: {
            exact: 0,
        },

        coreLogic: async () => {
            try {
                const users = StorageManager.loadItem(
                    Config.STORAGE_KEYS.USER_CREDENTIALS,
                    "User list",
                    {}
                );
                let userNames = Object.keys(users);

                if (!userNames.includes(Config.USER.DEFAULT_NAME)) {
                    userNames.push(Config.USER.DEFAULT_NAME);
                }

                userNames.sort();

                if (userNames.length === 0)
                    return {
                        success: true,
                        output: "No users registered.",
                    };

                return {
                    success: true,
                    output:
                        "Registered users:\\n" + userNames.map((u) => `  ${u}`).join("\\n"),
                };
            } catch (e) {
                return { success: false, error: `listusers: An unexpected error occurred: ${e.message}` };
            }
        },
    };

    const listusersDescription = "Lists all registered users on the system.";

    const listusersHelpText = `Usage: listusers

List all registered users.

DESCRIPTION
       The listusers command displays a list of all user accounts that
       currently exist on the system.

EXAMPLES
       listusers
              Registered users:
                Guest
                root
                userDiag`;

    CommandRegistry.register("listusers", listusersCommandDefinition, listusersDescription, listusersHelpText);
})();