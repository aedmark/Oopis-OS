// scripts/commands/removeuser.js

window.RemoveuserCommand = class RemoveuserCommand extends Command {
    constructor() {
        super({
            commandName: "removeuser",
            description:
                "Removes a user account, optionally keeping their home directory.",
            helpText: `Usage: removeuser [-f] [-r] <username>
      Remove a user account.
      DESCRIPTION
      The removeuser command permanently deletes the user account specified
      by <username>. By default, this action only removes the user's
      credentials and group memberships, preserving their home directory.
      To also remove the user's home directory and all its contents,
      the -r or --remove-home flag must be used.
      The 'root' and 'Guest' users cannot be removed. You also cannot
      remove the user you are currently logged in as.
      OPTIONS
      -f, --force
      Do not prompt for confirmation. Use with caution.
      -r, --remove-home
      Also remove the user's home directory.
      WARNING
      This operation is irreversible. Using the -r flag will permanently
      delete all data within the user's home directory. The command will
      prompt for confirmation before proceeding unless -f is used.`,
            completionType: "users",
            flagDefinitions: [
                {
                    name: "force",
                    short: "-f",
                    long: "--force",
                },
                {
                    name: "removeHome",
                    short: "-r",
                    long: "--remove-home",
                },
            ],
            argValidation: {
                exact: 1,
                error: "Usage: removeuser [-f] [-r] <username>",
            },
        });
    }

    async coreLogic(context) {
        const { args, currentUser, flags, options, dependencies } = context;
        const { UserManager, ModalManager, FileSystemManager, GroupManager, SessionManager, Config, ErrorHandler } = dependencies;
        const usernameToRemove = args[0];

        if (usernameToRemove === currentUser) {
            return ErrorHandler.createError(
                "removeuser: You cannot remove yourself."
            );
        }
        if (
            usernameToRemove === Config.USER.DEFAULT_NAME ||
            usernameToRemove === "root"
        ) {
            return ErrorHandler.createError(
                `removeuser: The '${usernameToRemove}' user cannot be removed.`
            );
        }

        if (!(await UserManager.userExists(usernameToRemove))) {
            return ErrorHandler.createSuccess(
                `removeuser: User '${usernameToRemove}' does not exist. No action taken.`
            );
        }

        let confirmed = false;
        if (flags.force) {
            confirmed = true;
        } else if (options.isInteractive) {
            const messageLines = [
                `This will permanently remove user account '${usernameToRemove}'.`,
            ];
            if (flags.removeHome) {
                messageLines.push(
                    `WARNING: The user's home directory AND ALL ITS CONTENTS will also be deleted.`
                );
            } else {
                messageLines.push(`The user's home directory will be preserved.`);
            }
            messageLines.push("This action cannot be undone. Are you sure?");

            confirmed = await new Promise((resolve) => {
                ModalManager.request({
                    context: "terminal",
                    messageLines: messageLines,
                    onConfirm: () => resolve(true),
                    onCancel: () => resolve(false),
                    options,
                });
            });
        } else {
            return ErrorHandler.createError(
                `removeuser: '${usernameToRemove}' requires confirmation. Use the -f flag in non-interactive scripts.`
            );
        }

        if (!confirmed) {
            return ErrorHandler.createSuccess(
                `Removal of user '${usernameToRemove}' cancelled.`
            );
        }

        let allDeletionsSuccessful = true;
        let errorMessages = [];
        let changesMade = false;

        if (flags.removeHome) {
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
                    errorMessages.push(
                        ...(rmResult.error.messages || [rmResult.error])
                    );
                }
                if (rmResult.data?.anyChangeMade) {
                    changesMade = true;
                }
            }
        }

        GroupManager.removeUserFromAllGroups(usernameToRemove);

        if (!SessionManager.clearUserSessionStates(usernameToRemove)) {
            allDeletionsSuccessful = false;
            errorMessages.push(
                "Failed to clear user session states and credentials."
            );
        }

        if (allDeletionsSuccessful) {
            let successMsg = `User account '${usernameToRemove}' has been removed.`;
            if (flags.removeHome) {
                successMsg += " Home directory was also removed.";
            } else {
                successMsg += " Home directory was preserved.";
            }
            return ErrorHandler.createSuccess(successMsg, {
                stateModified: changesMade,
            });
        } else {
            return ErrorHandler.createError(
                `removeuser: Failed to completely remove user '${usernameToRemove}'. Details: ${errorMessages.join("; ")}`
            );
        }
    }
}

window.CommandRegistry.register(new RemoveuserCommand());
