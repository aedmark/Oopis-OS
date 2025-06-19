// scripts/commands/usermod.js

(() => {
    "use strict";
    const usermodCommandDefinition = {
        commandName: "usermod",
        argValidation: {
            exact: 3,
            error: "Usage: usermod -aG <groupname> <username>",
        },
        coreLogic: async (context) => {
            const { args, currentUser } = context;
            const flag = args[0];
            const groupName = args[1];
            const username = args[2];

            if (currentUser !== "root") {
                return {
                    success: false,
                    error: "usermod: only root can modify user groups.",
                };
            }
            if (flag !== "-aG") {
                return {
                    success: false,
                    error: "usermod: invalid flag. Only '-aG' is supported.",
                };
            }
            if (!GroupManager.groupExists(groupName)) {
                return {
                    success: false,
                    error: `usermod: group '${groupName}' does not exist.`,
                };
            }
            const users = StorageManager.loadItem(
                Config.STORAGE_KEYS.USER_CREDENTIALS,
                "User list",
                {}
            );
            if (!users[username] && username !== Config.USER.DEFAULT_NAME) {
                return {
                    success: false,
                    error: `usermod: user '${username}' does not exist.`,
                };
            }

            if (GroupManager.addUserToGroup(username, groupName)) {
                return {
                    success: true,
                    output: `Added user '${username}' to group '${groupName}'.`,
                };
            } else {
                return {
                    success: true,
                    output: `User '${username}' is already in group '${groupName}'.`,
                    messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                };
            }
        },
    };
    const usermodDescription = "Adds a user to a group.";
    const usermodHelpText = "Usage: usermod -aG <groupname> <username>\n\nAdds the specified user to the specified group.";
    CommandRegistry.register("usermod", usermodCommandDefinition, usermodDescription, usermodHelpText);
})();