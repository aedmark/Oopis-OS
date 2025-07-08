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

    const chownDescription = "Changes the user ownership of a file or directory.";

    const chownHelpText = `Usage: chown <owner> <path>

Change the user ownership of a file or directory.

DESCRIPTION
       The chown command changes the user ownership of the file or
       directory specified by <path> to <owner>. The <owner> must be a
       valid, existing user on the system.

       Use the 'ls -l' command to view the current owner of a file.

EXAMPLES
       chown Guest /home/root/somefile
              Changes the owner of 'somefile' from 'root' to 'Guest'.

PERMISSIONS
       Only the superuser (root) can change the ownership of a file.`;

    CommandRegistry.register("chown", chownCommandDefinition, chownDescription, chownHelpText);
})();