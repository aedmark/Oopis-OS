(() => {
    "use strict";
    /**
     * @file Defines the 'removeuser' command, which permanently deletes a user account and all associated data.
     * This includes their home directory, group memberships, and saved session states.
     * It includes a confirmation prompt to prevent accidental data loss.
     * @author Andrew Edmark
     * @author Gemini
     */

    /**
     * @const {object} removeuserCommandDefinition
     * @description The command definition for the 'removeuser' command.
     * This object specifies the command's name, completion type (for tab completion of usernames),
     * supported flags (e.g., -f for force), argument validation (expecting one username),
     * and the core logic for user account removal.
     */
    const removeuserCommandDefinition = {
        commandName: "removeuser",
        completionType: "users", // Suggests usernames for tab completion.
        flagDefinitions: [
            {
                name: "force",
                short: "-f",
                long: "--force",
            },
        ],
        argValidation: {
            exact: 1, // Expects exactly one argument: the username to remove.
            error: "Usage: removeuser [-f] <username>",
        },
        /**
         * The core logic for the 'removeuser' command.
         * It performs several checks:
         * - Prevents a user from removing themselves.
         * - Prevents removal of reserved users ('Guest', 'root').
         * - Validates if the target user exists.
         * It then requests a confirmation (unless '-f' flag is used).
         * Upon confirmation, it proceeds to delete the user's home directory recursively,
         * remove them from all groups, and clear their session states and credentials.
         * It ensures file system changes are saved.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command, expecting a single username.
         * @param {string} context.currentUser - The name of the current user.
         * @param {object} context.flags - An object containing the parsed flags (e.g., `force`).
         * @param {object} context.options - Execution options, including `isInteractive` and `scriptingContext`.
         * @returns {Promise<object>} A promise that resolves to a command result object.
         */
        coreLogic: async (context) => {
            const { args, currentUser, flags, options } = context;
            const usernameToRemove = args[0];

            // Prevent user from removing themselves.
            if (usernameToRemove === currentUser) {
                return {
                    success: false,
                    error: "removeuser: You cannot remove yourself.",
                };
            }
            // Prevent removal of the default Guest user.
            if (usernameToRemove === Config.USER.DEFAULT_NAME) {
                return {
                    success: false,
                    error: `removeuser: Cannot remove the default '${Config.USER.DEFAULT_NAME}' user.`,
                };
            }
            // Prevent removal of the 'root' user.
            if (usernameToRemove === "root") {
                return {
                    success: false,
                    error: "removeuser: The 'root' user cannot be removed.",
                };
            }

            // Load all user credentials to check if the user to remove exists.
            const users = StorageManager.loadItem(
                Config.STORAGE_KEYS.USER_CREDENTIALS,
                "User list",
                {}
            );
            if (!users.hasOwnProperty(usernameToRemove)) {
                return {
                    success: true, // Not a failure, just an informational message.
                    output: `removeuser: User '${usernameToRemove}' does not exist. No action taken.`,
                    messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                };
            }

            let confirmed = false;
            // Handle confirmation prompt based on 'force' flag and interactive mode.
            if (flags.force) {
                confirmed = true;
            } else if (options.isInteractive) {
                // In interactive mode, prompt for confirmation unless forced.
                confirmed = await new Promise((resolve) => {
                    ModalManager.request({
                        context: "terminal",
                        messageLines: [
                            `WARNING: This will permanently remove user '${usernameToRemove}' and all their data (home directory, saved sessions). This cannot be undone. Are you sure?`,
                        ],
                        onConfirm: () => resolve(true),
                        onCancel: () => resolve(false),
                        options, // Pass options for scripting context.
                    });
                });
            } else {
                // In non-interactive mode (script), without -f, it's an error.
                return {
                    success: false,
                    error: `removeuser: '${usernameToRemove}' requires confirmation. Use the -f flag in non-interactive scripts.`,
                };
            }

            // If user cancels the operation, return.
            if (!confirmed) {
                return {
                    success: true,
                    output: `Removal of user '${usernameToRemove}' cancelled.`,
                    messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                };
            }

            let allDeletionsSuccessful = true;
            let errorMessages = [];
            let changesMade = false;

            // Attempt to delete the user's home directory.
            const userHomePath = `/home/${usernameToRemove}`;
            if (FileSystemManager.getNodeByPath(userHomePath)) {
                const rmResult = await FileSystemManager.deleteNodeRecursive(
                    userHomePath,
                    {
                        force: true, // Force internal deletion as confirmation is already handled.
                        currentUser: currentUser, // User performing the deletion (needed for parent write checks).
                    }
                );
                if (!rmResult.success) {
                    allDeletionsSuccessful = false;
                    errorMessages.push(...rmResult.messages);
                }
                if (rmResult.anyChangeMade) {
                    changesMade = true;
                }
            }
            // Remove the user from all supplementary groups.
            GroupManager.removeUserFromAllGroups(usernameToRemove);

            // Clear the user's session states and credentials from local storage.
            if (!SessionManager.clearUserSessionStates(usernameToRemove)) {
                allDeletionsSuccessful = false;
                errorMessages.push(
                    "Failed to clear user session states and credentials."
                );
            }

            // Save file system changes if any deletions occurred.
            if (changesMade) {
                await FileSystemManager.save();
            }

            // Return final success or failure message.
            if (allDeletionsSuccessful) {
                return {
                    success: true,
                    output: `User '${usernameToRemove}' and all associated data have been removed.`,
                    messageType: Config.CSS_CLASSES.SUCCESS_MSG,
                };
            } else {
                return {
                    success: false,
                    error: `removeuser: Failed to completely remove user '${usernameToRemove}'. Details: ${errorMessages.join(
                        "; "
                    )}`,
                };
            }
        },
    };

    const removeuserDescription = "Removes a user account and all associated data.";

    const removeuserHelpText = `Usage: removeuser [-f] <username>

Remove a user account and all associated data.

DESCRIPTION
       The removeuser command permanently deletes the specified <username>
       from the system. This action includes:
       - Deleting the user's home directory (e.g., /home/<username>).
       - Removing the user from all groups.
       - Deleting all saved session states for the user.
       - Removing the user's credentials.

       The 'root' and 'Guest' users cannot be removed. You also cannot
       remove the user you are currently logged in as.

OPTIONS
       -f, --force
              Do not prompt for confirmation. Use with caution, especially
              in scripts.

WARNING
       This operation is irreversible. All data associated with the user
       will be permanently lost. The command will prompt for confirmation
       before proceeding unless the -f flag is used.`;

    CommandRegistry.register("removeuser", removeuserCommandDefinition, removeuserDescription, removeuserHelpText);
})();