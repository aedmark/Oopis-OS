// scripts/commands/groupadd.js
(() => {
    "use strict";

    const groupaddCommandDefinition = {
        commandName: "groupadd",
        argValidation: { exact: 1, error: "Usage: groupadd <groupname>" },
        coreLogic: async (context) => {
            const { args, currentUser } = context;
            const groupName = args[0];

            try {
                if (currentUser !== "root") {
                    return { success: false, error: "groupadd: only root can add groups." };
                }

                if (GroupManager.groupExists(groupName)) {
                    return {
                        success: false,
                        error: `groupadd: group '${groupName}' already exists.`,
                    };
                }

                GroupManager.createGroup(groupName);

                return { success: true, output: `Group '${groupName}' created.` };
            } catch (e) {
                return { success: false, error: `groupadd: An unexpected error occurred: ${e.message}` };
            }
        },
    };

    const groupaddDescription = "Creates a new user group.";
    const groupaddHelpText = `Usage: groupadd <groupname>

Create a new user group.

DESCRIPTION
       The groupadd command creates a new group with the specified
       <groupname>. Once a group is created, users can be added to it
       with the 'usermod' command, and file group ownership can be
       changed with the 'chgrp' command to manage permissions for
       shared resources.

       Group names cannot contain spaces.

EXAMPLES
       groupadd developers
              Creates a new group named 'developers'.

PERMISSIONS
       Only the superuser (root) can create new groups.`;

    CommandRegistry.register("groupadd", groupaddCommandDefinition, groupaddDescription, groupaddHelpText);
})();