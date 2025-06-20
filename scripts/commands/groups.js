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

    const groupsDescription = "Displays the group memberships for a user.";

    const groupsHelpText = `Usage: groups [username]

Display group memberships for a user.

DESCRIPTION
       The groups command prints the names of the primary and supplementary
       groups for the specified <username>.

       If no <username> is provided, the groups for the current user are
       displayed. Every user is a member of a "primary group" that shares
       their username, which is created automatically with 'useradd'.

EXAMPLES
       groups
              Displays the group memberships for the current user.

       groups root
              Displays the group memberships for the 'root' user.`;

    CommandRegistry.register("groups", groupsCommandDefinition, groupsDescription, groupsHelpText);
})();