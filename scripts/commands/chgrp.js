(() => {
    "use strict";

    const chgrpCommandDefinition = {
        commandName: "chgrp",
        argValidation: { exact: 2, error: "Usage: chgrp <groupname> <path>" },
        pathValidation: [{ argIndex: 1 }],

        coreLogic: async (context) => {
            const { args, currentUser, validatedPaths } = context;
            const groupName = args[0];
            const pathInfo = validatedPaths[1];
            const node = pathInfo.node;

            if (!FileSystemManager.canUserModifyNode(node, currentUser)) {
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