/**
 * @file Defines the 'chgrp' command, which allows changing the group ownership of files and directories.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} chgrpCommandDefinition
     * @description The command definition for the 'chgrp' command.
     * This object specifies the command's name, argument validation, path validation,
     * and the core logic for changing a node's group.
     */
    const chgrpCommandDefinition = {
        commandName: "chgrp",
        argValidation: { exact: 2, error: "Usage: chgrp <groupname> <path>" },
        pathValidation: [{ argIndex: 1 }],
        /**
         * The core logic for the 'chgrp' command.
         * It changes the group ownership of the specified file or directory.
         * Permissions are checked to ensure that only the file's owner or 'root' can perform this action.
         * It also validates that the new group name exists.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command, expecting a group name and a path.
         * @param {string} context.currentUser - The name of the current user.
         * @param {object[]} context.validatedPaths - An array of validated path information objects.
         * @returns {Promise<object>} A promise that resolves to a command result object.
         */
        coreLogic: async (context) => {
            const { args, currentUser, validatedPaths } = context;
            const groupName = args[0];
            const pathInfo = validatedPaths[1];
            const node = pathInfo.node;

            if (currentUser !== "root" && node.owner !== currentUser) {
                return {
                    success: false,
                    error: `chgrp: changing group of '${pathInfo.resolvedPath}': Operation not permitted`,
                };
            }
            if (!GroupManager.groupExists(groupName)) {
                return {
                    success: false,
                    error: `chgrp: invalid group: '${groupName}'`,
                };
            }

            node.group = groupName;
            node.mtime = new Date().toISOString();
            if (!(await FileSystemManager.save())) {
                return {
                    success: false,
                    error: "chgrp: Failed to save file system changes.",
                };
            }

            return { success: true, output: "" };
        },
    };

    const chgrpDescription = "Changes the group ownership of a file or directory.";

    const chgrpHelpText = `Usage: chgrp <group> <path>

Change the group ownership of a file or directory.

DESCRIPTION
       The chgrp command changes the group of the file or directory
       specified by <path> to <group>.

       Group ownership is a fundamental part of the OopisOS security model.
       File permissions can be set to allow or deny access based on whether
       a user is a member of a file's group. Use the 'ls -l' command to
       view file and directory ownership.

EXAMPLES
       chgrp developers /home/Guest/project
              Changes the group of the 'project' directory to 'developers'.

PERMISSIONS
       To change the group of a file, you must be the owner of the file
       or the superuser (root).`;

    CommandRegistry.register("chgrp", chgrpCommandDefinition, chgrpDescription, chgrpHelpText);
})();