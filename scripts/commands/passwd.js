(() => {
    "use strict";

    const passwdCommandDefinition = {
        commandName: "passwd",
        argValidation: {
            max: 1, // Accepts an optional username
        },
        coreLogic: async (context) => {
            const { args, currentUser, options } = context;

            // Ensure command is run interactively
            if (!options.isInteractive) {
                return { success: false, error: "passwd: can only be run in interactive mode." };
            }

            const targetUsername = args[0] || currentUser;

            // Security: A non-root user cannot change another user's password.
            if (currentUser !== 'root' && currentUser !== targetUsername) {
                return { success: false, error: "passwd: you may only change your own password." };
            }

            // Get the user record to check if it exists
            const users = StorageManager.loadItem(Config.STORAGE_KEYS.USER_CREDENTIALS, "User list", {});
            if (!users[targetUsername]) {
                return { success: false, error: `passwd: user '${targetUsername}' does not exist.` };
            }

            return new Promise(resolve => {
                const getNewPassword = (oldPassword) => {
                    ModalInputManager.requestInput(
                        `Enter new password for ${targetUsername}:`,
                        (newPassword) => {
                            // REFACTOR START
                            if (!newPassword) {
                                resolve({ success: false, error: Config.MESSAGES.EMPTY_PASSWORD_NOT_ALLOWED });
                                return;
                            }
                            // REFACTOR END
                            ModalInputManager.requestInput(
                                `Confirm new password:`,
                                async (confirmPassword) => {
                                    if (newPassword !== confirmPassword) {
                                        resolve({ success: false, error: Config.MESSAGES.PASSWORD_MISMATCH });
                                        return;
                                    }
                                    const result = await UserManager.changePassword(currentUser, targetUsername, oldPassword, newPassword);
                                    resolve(result);
                                },
                                () => resolve({ success: true, output: Config.MESSAGES.OPERATION_CANCELLED }),
                                true, // Obscured input
                                options
                            );
                        },
                        () => resolve({ success: true, output: Config.MESSAGES.OPERATION_CANCELLED }),
                        true, // Obscured input
                        options
                    );
                };

                if (currentUser === 'root' && currentUser !== targetUsername) {
                    getNewPassword(null); // Root does not need to provide an old password
                } else {
                    // User changing their own password, or root changing their own password
                    ModalInputManager.requestInput(
                        `Enter current password for ${currentUser}:`,
                        (oldPassword) => getNewPassword(oldPassword),
                        () => resolve({ success: true, output: Config.MESSAGES.OPERATION_CANCELLED }),
                        true, // Obscured input
                        options
                    );
                }
            });
        }
    };

    const passwdDescription = "Change a user's password.";
    const passwdHelpText = `Usage: passwd [username]

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
              As root, initiates the process to change the password for 'Guest'.`;

    CommandRegistry.register("passwd", passwdCommandDefinition, passwdDescription, passwdHelpText);
})();