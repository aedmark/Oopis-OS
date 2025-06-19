// scripts/commands/chmod.js

(() => {
    "use strict";
    const chmodCommandDefinition = {
        commandName: "chmod",
        argValidation: {
            exact: 2,
            error: "Usage: chmod <mode> <path>",
        },
        pathValidation: [
            {
                argIndex: 1,
            },
        ],
        coreLogic: async (context) => {
            const { args, currentUser, validatedPaths } = context;
            const modeArg = args[0];
            const pathArg = args[1];
            const pathInfo = validatedPaths[1];
            const node = pathInfo.node;
            const nowISO = new Date().toISOString();

            if (!/^[0-7]{3,4}$/.test(modeArg)) {
                return {
                    success: false,
                    error: `chmod: invalid mode: ‘${modeArg}’ (must be 3 or 4 octal digits)`,
                };
            }
            const newMode = parseInt(modeArg, 8);

            if (currentUser !== "root") {
                if (node.owner !== currentUser) {
                    return {
                        success: false,
                        error: `chmod: changing permissions of '${pathArg}': Operation not permitted`,
                    };
                }
                if (!FileSystemManager.hasPermission(node, currentUser, "write")) {
                    return {
                        success: false,
                        error: `chmod: cannot change permissions of '${pathArg}': Permission denied`,
                    };
                }
            }

            node.mode = newMode;
            node.mtime = nowISO;
            FileSystemManager._updateNodeAndParentMtime(
                pathInfo.resolvedPath,
                nowISO
            );

            if (!(await FileSystemManager.save())) {
                return {
                    success: false,
                    error: "chmod: Failed to save file system changes.",
                };
            }
            return {
                success: true,
                output: `Permissions of '${pathArg}' changed to ${modeArg}`,
                messageType: Config.CSS_CLASSES.SUCCESS_MSG,
            };
        },
    };
    const chmodDescription = "Changes the permissions of a file or directory.";
    const chmodHelpText = "Usage: chmod <mode> <path>\n\nChanges the permissions of the specified file or directory to <mode>.";
    CommandRegistry.register("chmod", chmodCommandDefinition, chmodDescription, chmodHelpText);
})();