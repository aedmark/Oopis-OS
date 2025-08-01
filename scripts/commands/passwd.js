// scripts/commands/passwd.js

window.PasswdCommand = class PasswdCommand extends Command {
    constructor() {
        super({
            commandName: "passwd",
            description: "Change a user's password.",
            helpText: `Usage: passwd [username]
      Change a user's password.
      DESCRIPTION
      The passwd command updates the password for a user account.
      If run without arguments, it changes the password for the current user.
      You will be prompted for your current password, and then for the new password twice.
      The root user can change the password for any user by specifying their
      username, and will not be prompted for the old password.
      EXAMPLES
      passwd
      Initiates the process to change your own password.
      sudo passwd Guest
      As root, initiates the process to change the password for 'Guest'.`,
            completionType: "users",
            validations: {
                args: {
                    max: 1
                }
            },
        });
    }

    async coreLogic(context) {
        const { args, currentUser, options, dependencies } = context;
        const { UserManager, ErrorHandler, ModalManager, Config } = dependencies;

        if (!options.isInteractive) {
            return ErrorHandler.createError(
                "passwd: can only be run in interactive mode."
            );
        }

        const targetUsername = args[0] || currentUser;

        if (currentUser !== "root" && currentUser !== targetUsername) {
            return ErrorHandler.createError(
                "passwd: you may only change your own password."
            );
        }

        if (!(await UserManager.userExists(targetUsername))) {
            return ErrorHandler.createError(
                `passwd: user '${targetUsername}' does not exist.`
            );
        }

        return new Promise((resolve) => {
            const getNewPassword = (oldPassword) => {
                ModalManager.request({
                    context: "terminal",
                    type: "input",
                    messageLines: [`Enter new password for ${targetUsername}:`],
                    obscured: true,
                    onConfirm: (newPassword) => {
                        if (!newPassword) {
                            resolve(
                                ErrorHandler.createError(
                                    Config.MESSAGES.EMPTY_PASSWORD_NOT_ALLOWED
                                )
                            );
                            return;
                        }
                        ModalManager.request({
                            context: "terminal",
                            type: "input",
                            messageLines: [`Confirm new password:`],
                            obscured: true,
                            onConfirm: async (confirmPassword) => {
                                if (newPassword !== confirmPassword) {
                                    resolve(
                                        ErrorHandler.createError(
                                            Config.MESSAGES.PASSWORD_MISMATCH
                                        )
                                    );
                                    return;
                                }
                                const result = await UserManager.changePassword(
                                    currentUser,
                                    targetUsername,
                                    oldPassword,
                                    newPassword
                                );
                                resolve(result);
                            },
                            onCancel: () =>
                                resolve(
                                    ErrorHandler.createSuccess(
                                        Config.MESSAGES.OPERATION_CANCELLED
                                    )
                                ),
                        });
                    },
                    onCancel: () =>
                        resolve(
                            ErrorHandler.createSuccess(
                                Config.MESSAGES.OPERATION_CANCELLED
                            )
                        ),
                });
            };

            if (currentUser === "root" && currentUser !== targetUsername) {
                getNewPassword(null);
            } else {
                ModalManager.request({
                    context: "terminal",
                    type: "input",
                    messageLines: [`Enter current password for ${currentUser}:`],
                    obscured: true,
                    onConfirm: (oldPassword) => getNewPassword(oldPassword),
                    onCancel: () =>
                        resolve(
                            ErrorHandler.createSuccess(
                                Config.MESSAGES.OPERATION_CANCELLED
                            )
                        ),
                });
            }
        }).then((result) => {
            if (result.success) {
                return ErrorHandler.createSuccess(result.data);
            }
            return result;
        });
    }
}

window.CommandRegistry.register(new PasswdCommand());
