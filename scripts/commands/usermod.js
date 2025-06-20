/**
 * @file Defines the 'usermod' command, which modifies a user account, primarily for group membership.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} usermodCommandDefinition
     * @description The command definition for the 'usermod' command.
     * This object specifies the command's name, argument validation,
     * and the core logic for modifying user group memberships.
     */
    const usermodCommandDefinition = {
        commandName: "usermod",
        argValidation: {
            exact: 3, // Requires exactly three arguments: flag, groupname, username.
            error: "Usage: usermod -aG <groupname> <username>",
        },
        /**
         * The core logic for the 'usermod' command.
         * It validates that the command is executed by the 'root' user and that
         * the correct flag ('-aG') is used. It also checks for the existence of
         * the specified group and user. If all checks pass, it adds the user
         * to the supplementary group using `GroupManager.addUserToGroup`.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command: `[flag, groupName, username]`.
         * @param {string} context.currentUser - The name of the current user executing the command.
         * @returns {Promise<object>} A promise that resolves to a command result object,
         * indicating success, a message if the user is already in the group, or an error.
         */
        coreLogic: async (context) => {
            const { args, currentUser } = context;
            const flag = args[0];
            const groupName = args[1];
            const username = args[2];

            // Permission check: Only 'root' can modify user groups.
            if (currentUser !== "root") {
                return {
                    success: false,
                    error: "usermod: only root can modify user groups.",
                };
            }

            // Validate the flag: currently, only '-aG' is supported.
            if (flag !== "-aG") {
                return {
                    success: false,
                    error: "usermod: invalid flag. Only '-aG' is supported.",
                };
            }

            // Check if the specified group exists.
            if (!GroupManager.groupExists(groupName)) {
                return {
                    success: false,
                    error: `usermod: group '${groupName}' does not exist.`,
                };
            }

            // Load all user credentials to check if the user exists.
            const users = StorageManager.loadItem(
                Config.STORAGE_KEYS.USER_CREDENTIALS,
                "User list",
                {}
            );
            // Check if the user exists (excluding the default guest user if it's not explicitly in `users`).
            if (!users[username] && username !== Config.USER.DEFAULT_NAME) {
                return {
                    success: false,
                    error: `usermod: user '${username}' does not exist.`,
                };
            }

            // Attempt to add the user to the specified group.
            if (GroupManager.addUserToGroup(username, groupName)) {
                return {
                    success: true,
                    output: `Added user '${username}' to group '${groupName}'.`,
                };
            } else {
                // If addUserToGroup returns false, it means the user is already a member.
                return {
                    success: true,
                    output: `User '${username}' is already in group '${groupName}'.`,
                    messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG, // Informational message.
                };
            }
        },
    };

    /**
     * @const {string} usermodDescription
     * @description A brief, one-line description of the 'usermod' command for the 'help' command.
     */
    const usermodDescription = "Modifies a user account, primarily for group membership.";

    /**
     * @const {string} usermodHelpText
     * @description The detailed help text for the 'usermod' command, used by 'man'.
     */
    const usermodHelpText = `Usage: usermod -aG <groupname> <username>

Modify a user account.

DESCRIPTION
       The usermod command modifies the user account specified by
       <username>. Its primary function in OopisOS is to add a user to a
       supplementary group.

OPTIONS
       -aG <groupname>
              Add the user to the supplementary <groupname>. The -a flag
              (append) is important to ensure the user is not removed
              from other groups. The -G flag specifies that we are
              modifying a group membership. In OopisOS, these flags
              must be used together.

PERMISSIONS
       Only the superuser (root) can modify user accounts.

EXAMPLES
       usermod -aG developers newdev
              Adds the user 'newdev' to the 'developers' group.`;

    // Register the command with the system
    CommandRegistry.register("usermod", usermodCommandDefinition, usermodDescription, usermodHelpText);
})();