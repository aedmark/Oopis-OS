/**
 * @file Defines the 'chown' command, which changes the user ownership of files and directories.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} chownCommandDefinition
     * @description The command definition for the 'chown' command.
     * This object specifies the command's name, argument validation, path validation,
     * and the core logic for changing a node's owner.
     */
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
        permissionChecks: [], // Permissions are checked directly within coreLogic.
        /**
         * The core logic for the 'chown' command.
         * It changes the user ownership of the specified file or directory.
         * This operation is restricted to the 'root' user. It also validates
         * that the new owner is a valid, existing user on the system.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command, expecting a new owner username and a path.
         * @param {string} context.currentUser - The name of the current user executing the command.
         * @param {object[]} context.validatedPaths - An array of validated path information objects.
         * @returns {Promise<object>} A promise that resolves to a command result object.
         */
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

            // Validate if the new owner user exists.
            if (!users[newOwnerArg] && newOwnerArg !== Config.USER.DEFAULT_NAME) {
                return {
                    success: false,
                    error: `chown: user '${newOwnerArg}' does not exist.`,
                };
            }

            // Permission check: Only 'root' can change ownership.
            if (currentUser !== "root") {
                return {
                    success: false,
                    error: `chown: changing ownership of '${pathArg}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX} (only root can change ownership)`,
                };
            }

            // Apply the new owner and update modification times.
            node.owner = newOwnerArg;
            node.mtime = nowISO;
            FileSystemManager._updateNodeAndParentMtime(
                pathInfo.resolvedPath,
                nowISO
            );

            // Attempt to save the file system changes.
            // Note: The `currentUser` argument to `FileSystemManager.save` is not used by the function,
            // but is kept here for consistency with the provided code.
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