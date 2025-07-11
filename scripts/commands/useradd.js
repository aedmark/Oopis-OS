(() => {
    "use strict";

    const useraddCommandDefinition = {
        commandName: "useradd",
        argValidation: {
            exact: 1,
            error: "expects exactly one argument (username)",
        },

        coreLogic: async (context) => {
            const {args, options} = context;
            const username = args[0];

            const userCheck = StorageManager.loadItem(Config.STORAGE_KEYS.USER_CREDENTIALS, "User list", {});
            if (userCheck[username]) {
                return { success: false, error: `User '${username}' already exists.` };
            }

            return new Promise(async (resolve) => {
                ModalInputManager.requestInput(
                    Config.MESSAGES.PASSWORD_PROMPT,
                    async (firstPassword) => {
                        if (firstPassword.trim() === "") {
                            resolve({success: false, error: Config.MESSAGES.EMPTY_PASSWORD_NOT_ALLOWED});
                            return;
                        }

                        ModalInputManager.requestInput(
                            Config.MESSAGES.PASSWORD_CONFIRM_PROMPT,
                            async (confirmedPassword) => {
                                if (firstPassword !== confirmedPassword) {
                                    resolve({success: false, error: Config.MESSAGES.PASSWORD_MISMATCH});
                                    return;
                                }
                                const registerResult = await UserManager.register(username, firstPassword);
                                resolve(registerResult);
                            },
                            () => resolve({
                                success: true,
                                output: Config.MESSAGES.OPERATION_CANCELLED,
                                messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG
                            }),
                            true,
                            options
                        );
                    },
                    () => resolve({
                        success: true,
                        output: Config.MESSAGES.OPERATION_CANCELLED,
                        messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG
                    }),
                    true,
                    options
                );
            }).then(result => {
                if (result.success && result.message) {
                    return {success: true, output: result.message, messageType: Config.CSS_CLASSES.SUCCESS_MSG};
                }
                return result;
            });
        },
    };

    const useraddDescription = "Creates a new user account.";
    const useraddHelpText = `Usage: useradd <username>

Create a new user account.

DESCRIPTION
       The useradd command creates a new user account with the specified
       <username>. When run, the command will prompt you to enter and
       confirm a password for the new user in a secure, obscured input.

       When run from a script, it will consume the next two lines of the
       script as the password and confirmation.

EXAMPLES
       useradd newdev
              Starts the process to create a user named 'newdev',
              prompting for a password.`;

    CommandRegistry.register("useradd", useraddCommandDefinition, useraddDescription, useraddHelpText);
})();