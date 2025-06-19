// scripts/commands/listusers.js

(() => {
    "use strict";
    const listusersCommandDefinition = {
        commandName: "listusers",
        argValidation: {
            exact: 0,
        },
        coreLogic: async () => {
            const users = StorageManager.loadItem(
                Config.STORAGE_KEYS.USER_CREDENTIALS,
                "User list",
                {}
            );
            const userNames = Object.keys(users);
            if (!userNames.includes(Config.USER.DEFAULT_NAME)) {
                userNames.push(Config.USER.DEFAULT_NAME);
            }
            userNames.sort();
            if (userNames.length === 0)
                return {
                    success: true,
                    output: "No users registered.",
                    messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                };
            return {
                success: true,
                output:
                    "Registered users:\n" + userNames.map((u) => `  ${u}`).join("\n"),
            };
        },
    };
    const listusersDescription = "Displays a list of registered users.";
    const listusersHelpText = "Usage: listusers";
    CommandRegistry.register("listusers", listusersCommandDefinition, listusersDescription, listusersHelpText);
})();