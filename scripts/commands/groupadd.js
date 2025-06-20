/**
 * @file Defines the 'groupadd' command, which allows the creation of new user groups.
 * This command is restricted to the 'root' user.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} groupaddCommandDefinition
     * @description The command definition for the 'groupadd' command.
     * This object specifies the command's name, argument validation (expecting one group name),
     * and the core logic for creating a new group.
     */
    const groupaddCommandDefinition = {
        commandName: "groupadd",
        argValidation: { exact: 1, error: "Usage: groupadd <groupname>" },
        /**
         * The core logic for the 'groupadd' command.
         * It validates that the command is executed by the 'root' user and that
         * the specified group name does not already exist. If valid, it creates
         * the new group using the `GroupManager`.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command, expecting a single group name.
         * @param {string} context.currentUser - The name of the current user executing the command.
         * @returns {Promise<object>} A promise that resolves to a command result object.
         */
        coreLogic: async (context) => {
            const { args, currentUser } = context;
            const groupName = args[0];

            // Permission check: Only 'root' can add groups.
            if (currentUser !== "root") {
                return { success: false, error: "groupadd: only root can add groups." };
            }

            // Check if the group already exists.
            if (GroupManager.groupExists(groupName)) {
                return {
                    success: false,
                    error: `groupadd: group '${groupName}' already exists.`,
                };
            }

            // Create the new group.
            GroupManager.createGroup(groupName);

            return { success: true, output: `Group '${groupName}' created.` };
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