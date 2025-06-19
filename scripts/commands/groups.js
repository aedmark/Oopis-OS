// scripts/commands/groups.js

(() => {
    "use strict";
    const groupsCommandDefinition = {
        commandName: "groups",
        argValidation: { max: 1 },
        coreLogic: async (context) => {
            const { args, currentUser } = context;
            const targetUser = args.length > 0 ? args[0] : currentUser;

            const users = StorageManager.loadItem(
                Config.STORAGE_KEYS.USER_CREDENTIALS,
                "User list",
                {}
            );
            if (!users[targetUser] && targetUser !== Config.USER.DEFAULT_NAME) {
                return {
                    success: false,
                    error: `groups: user '${targetUser}' does not exist`,
                };
            }

            const userGroups = GroupManager.getGroupsForUser(targetUser);
            if (userGroups.length === 0) {
                return { success: true, output: `${targetUser} :` };
            }

            return {
                success: true,
                output: `${targetUser} : ${userGroups.join(" ")}`,
            };
        },
    };
    const groupsDescription = "Displays the groups to which a user belongs.";
    const groupsHelpText = "Usage: groups [username]\n\nDisplays the groups to which the specified [username] belongs.";
    CommandRegistry.register("groups", groupsCommandDefinition, groupsDescription, groupsHelpText);

})();