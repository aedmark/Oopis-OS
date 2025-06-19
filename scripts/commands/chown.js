// scripts/commands/chown.js

(() => {
    "use strict";
    const chownCommandDefinition = {
        commandName: "chown",
        completionType: "users",
        argValidation: {
            exact: 2,
            error: "Usage: chown <new_owner> <path>",
        },
        pathValidation: [
            {
                argIndex: 1,
            },
        ],
        permissionChecks: [],
        coreLogic: async (context) => {
            const { args, currentUser, validatedPaths } = context;
            const newOwnerArg = args[0];
            const pathArg = args[1];
            const pathInfo = validatedPaths[1];
            const node = pathInfo.node;
            const nowISO = new Date().toISOString();
            const users = StorageManager.loadItem(
                Config.STORAGE_KEYS.USER_CREDENTIALS,
                "User list",
                {}
            );
            if (!users[newOwnerArg] && newOwnerArg !== Config.USER.DEFAULT_NAME) {
                return {
                    success: false,
                    error: `chown: user '${newOwnerArg}' does not exist.`,
                };
            }
            if (currentUser !== "root") {
                return {
                    success: false,
                    error: `chown: changing ownership of '${pathArg}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX} (only root can change ownership)`,
                };
            }
            node.owner = newOwnerArg;
            node.mtime = nowISO;
            FileSystemManager._updateNodeAndParentMtime(
                pathInfo.resolvedPath,
                nowISO
            );
            if (!(await FileSystemManager.save(currentUser))) {
                return {
                    success: false,
                    error: "chown: Failed to save file system changes.",
                };
            }
            return {
                success: true,
                output: `Owner of '${pathArg}' changed to ${newOwnerArg}`,
                messageType: Config.CSS_CLASSES.SUCCESS_MSG,
            };
        },
    };
    const chownDescription = "Changes the owner of a file or directory.";
    const chownHelpText = "Usage: chown <new_owner> <path>\n\nChanges the owner of the specified file or directory to <new_owner>.";
    CommandRegistry.register("chown", chownCommandDefinition, chownDescription, chownHelpText);
})();