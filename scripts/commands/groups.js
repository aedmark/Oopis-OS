/**
 * @file Defines the 'groups' command, which displays the group memberships for a specified user.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} groupsCommandDefinition
     * @description The command definition for the 'groups' command.
     * This object specifies the command's name, argument validation (optional username),
     * and the core logic for retrieving and displaying user group memberships.
     */
    const groupsCommandDefinition = {
        commandName: "groups",
        argValidation: { max: 1 }, // Accepts zero or one argument (username).
        /**
         * The core logic for the 'groups' command.
         * It determines the target user (current user if no argument is provided).
         * It then validates if the target user exists and retrieves all their
         * primary and supplementary group memberships using `GroupManager.getGroupsForUser`.
         * The group names are then formatted and displayed.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command, optionally containing a username.
         * @param {string} context.currentUser - The name of the current user executing the command.
         * @returns {Promise<object>} A promise that resolves to a command result object
         * with the user's group memberships or an error if the user does not exist.
         */
        coreLogic: async (context) => {
            const { args, currentUser } = context;
            // Determine the target user: if an argument is provided, use it; otherwise, use the current user.
            const targetUser = args.length > 0 ? args[0] : currentUser;

            // Load the list of all registered users to validate the target user.
            const users = StorageManager.loadItem(
                Config.STORAGE_KEYS.USER_CREDENTIALS,
                "User list",
                {}
            );

            // Check if the target user exists. The default guest user is handled separately
            // as it might not be explicitly in `USER_CREDENTIALS` on fresh install.
            if (!users[targetUser] && targetUser !== Config.USER.DEFAULT_NAME) {
                return {
                    success: false,
                    error: `groups: user '${targetUser}' does not exist`,
                };
            }

            // Retrieve all groups (primary and supplementary) for the target user.
            const userGroups = GroupManager.getGroupsForUser(targetUser);

            // Format the output: "username : group1 group2 ..."
            if (userGroups.length === 0) {
                // If no groups, display just the username.
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