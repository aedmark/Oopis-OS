/**
 * @file Defines the 'groupdel' command, which allows the deletion of existing user groups.
 * This command is restricted to the 'root' user and prevents deletion of primary groups.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} groupdelCommandDefinition
     * @description The command definition for the 'groupdel' command.
     * This object specifies the command's name, argument validation (expecting one group name),
     * and the core logic for deleting a group.
     */
    const groupdelCommandDefinition = {
        commandName: "groupdel",
        argValidation: { exact: 1, error: "Usage: groupdel <groupname>" },
        /**
         * The core logic for the 'groupdel' command.
         * It validates that the command is executed by the 'root' user.
         * It then attempts to delete the specified group using `GroupManager.deleteGroup`.
         * This operation will fail if the group does not exist or if it is a primary
         * group for any existing user.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command, expecting a single group name.
         * @param {string} context.currentUser - The name of the current user executing the command.
         * @returns {Promise<object>} A promise that resolves to a command result object.
         */
        coreLogic: async (context) => {
            const { args, currentUser } = context;
            const groupName = args[0];

            // Permission check: Only 'root' can delete groups.
            if (currentUser !== "root") {
                return { success: false, error: "groupdel: only root can delete groups." };
            }

            // Attempt to delete the group using GroupManager.
            const result = GroupManager.deleteGroup(groupName);

            // Handle success or failure from GroupManager.
            if (!result.success) {
                return { success: false, error: `groupdel: ${result.error}` };
            }

            return { success: true, output: `Group '${groupName}' deleted.`, messageType: Config.CSS_CLASSES.SUCCESS_MSG };
        },
    };

    const groupdelDescription = "Deletes an existing user group.";

    const groupdelHelpText = `Usage: groupdel <groupname>

Delete an existing user group.

DESCRIPTION
       The groupdel command deletes the group specified by <groupname>.

       You cannot remove the primary group of an existing user. You must
       either delete the user first ('removeuser') or change their
       primary group before deleting the group.

EXAMPLES
       groupdel developers
              Deletes the group named 'developers'.

PERMISSIONS
       Only the superuser (root) can delete groups.`;

    CommandRegistry.register("groupdel", groupdelCommandDefinition, groupdelDescription, groupdelHelpText);
})();