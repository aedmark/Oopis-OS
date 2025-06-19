// scripts/commands/chgrp.js

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
    const chgrpDescription = "Changes the group of a file or directory.";
    const chgrpHelpText = "Usage: chgrp <groupname> <path>\n\nChanges the group of the specified file or directory to <groupname>.";
    CommandRegistry.register("chgrp", chgrpCommandDefinition, chgrpDescription, chgrpHelpText);
})();