// scripts/commands/groupdel.js
(() => {
    "use strict";

    const groupdelCommandDefinition = {
        commandName: "groupdel",
        argValidation: { exact: 1, error: "Usage: groupdel <groupname>" },
        coreLogic: async (context) => {
            const { args, currentUser } = context;
            const groupName = args[0];

            try {
                if (currentUser !== "root") {
                    return { success: false, error: "groupdel: only root can delete groups." };
                }

                const result = GroupManager.deleteGroup(groupName);

                if (!result.success) {
                    return { success: false, error: `groupdel: ${result.error}` };
                }

                return { success: true, output: `Group '${groupName}' deleted.` };
            } catch (e) {
                return { success: false, error: `groupdel: An unexpected error occurred: ${e.message}` };
            }
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

    // The variable name here is now correct.
    CommandRegistry.register("groupdel", groupdelCommandDefinition, groupdelDescription, groupdelHelpText);
})();