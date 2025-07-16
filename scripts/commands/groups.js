// scripts/commands/groups.js
(() => {
    "use strict";

    const groupsCommandDefinition = {
        commandName: "groups",
        completionType: "users", // For tab-completing usernames
        argValidation: {
            max: 1,
        },
        coreLogic: async (context) => {
            const { args, currentUser } = context;
            const targetUser = args.length > 0 ? args[0] : currentUser;

            try {
                // Check if the user exists
                if (!await UserManager.userExists(targetUser)) {
                    return { success: false, error: `groups: user '${targetUser}' does not exist` };
                }

                const userGroups = GroupManager.getGroupsForUser(targetUser);

                if (userGroups.length === 0) {
                    return { success: true, output: `groups: user '${targetUser}' is not a member of any group` };
                }

                return {
                    success: true,
                    output: userGroups.join(' '),
                };
            } catch (e) {
                return { success: false, error: `groups: An unexpected error occurred: ${e.message}` };
            }
        },
    };

    const groupsDescription = "Prints the groups a user is in.";
    const groupsHelpText = `Usage: groups [username]

Print group memberships for a user.

DESCRIPTION
       The groups command prints the names of the primary and supplementary
       groups for each given username, or the current process if none are
       given.

EXAMPLES
       groups
              Displays the groups for the current user.

       groups root
              Displays the groups for the 'root' user.`;

    // Correctly register the 'groups' command
    CommandRegistry.register("groups", groupsCommandDefinition, groupsDescription, groupsHelpText);
})();