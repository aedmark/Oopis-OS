// scripts/commands/removeuser.js

(() => {
    "use strict";
    const removeuserCommandDefinition = {
        commandName: "removeuser",
        completionType: "users",
        flagDefinitions: [
            {
                name: "force",
                short: "-f",
                long: "--force",
            },
        ],
        argValidation: {
            exact: 1,
            error: "Usage: removeuser [-f] <username>",
        },
        coreLogic: async (context) => {
            const { args, currentUser, flags, options } = context;
            const usernameToRemove = args[0];

            if (usernameToRemove === currentUser) {
                return {
                    success: false,
                    error: "removeuser: You cannot remove yourself.",
                };
            }
            if (usernameToRemove === Config.USER.DEFAULT_NAME) {
                return {
                    success: false,
                    error: `removeuser: Cannot remove the default '${Config.USER.DEFAULT_NAME}' user.`,
                };
            }
            if (usernameToRemove === "root") {
                return {
                    success: false,
                    error: "removeuser: The 'root' user cannot be removed.",
                };
            }

            const users = StorageManager.loadItem(
                Config.STORAGE_KEYS.USER_CREDENTIALS,
                "User list",
                {}
            );
            if (!users.hasOwnProperty(usernameToRemove)) {
                return {
                    success: true,
                    output: `removeuser: User '${usernameToRemove}' does not exist. No action taken.`,
                    messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                };
            }

            let confirmed = false;
            if (flags.force) {
                confirmed = true;
            } else if (options.isInteractive) {
                confirmed = await new Promise((resolve) => {
                    ModalManager.request({
                        context: "terminal",
                        messageLines: [
                            `WARNING: This will permanently remove user '${usernameToRemove}' and all their data (home directory, saved sessions). This cannot be undone. Are you sure?`,
                        ],
                        onConfirm: () => resolve(true),
                        onCancel: () => resolve(false),
                        options,
                    });
                });
            } else {
                return {
                    success: false,
                    error: `removeuser: '${usernameToRemove}' requires confirmation. Use the -f flag in non-interactive scripts.`,
                };
            }

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

            const userHomePath = `/home/${usernameToRemove}`;
            if (FileSystemManager.getNodeByPath(userHomePath)) {
                const rmResult = await FileSystemManager.deleteNodeRecursive(
                    userHomePath,
                    {
                        force: true,
                        currentUser: currentUser,
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
            GroupManager.removeUserFromAllGroups(usernameToRemove);

            if (!SessionManager.clearUserSessionStates(usernameToRemove)) {
                allDeletionsSuccessful = false;
                errorMessages.push(
                    "Failed to clear user session states and credentials."
                );
            }

            if (changesMade) {
                await FileSystemManager.save();
            }

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