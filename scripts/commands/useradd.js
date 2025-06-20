// scripts/commands/useradd.js

(() => {
    "use strict";

    const useraddCommandDefinition = {
        commandName: "useradd",
        argValidation: {
            exact: 1,
            error: "expects exactly one argument (username)",
        },
        coreLogic: async (context) => {
            const { args, options } = context;
            const username = args[0];

            // This logic can be handled by UserManager.register, which already checks for existence and format.
            // Let's rely on that for a single source of truth.

            return new Promise(async (resolve) => {
                const userCheck = StorageManager.loadItem(Config.STORAGE_KEYS.USER_CREDENTIALS, "User list", {});
                if (userCheck[username]) {
                    resolve({ success: false, error: `User '${username}' already exists.` });
                    return;
                }

                // First password prompt
                ModalInputManager.requestInput(
                    Config.MESSAGES.PASSWORD_PROMPT,
                    async (firstPassword) => {
                        if (firstPassword.trim() === "") {
                            // User intends to create an account with no password.
                            await OutputManager.appendToOutput("Registering user with no password.", { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG });
                            const registerResult = await UserManager.register(username, null);
                            resolve(registerResult);
                            return;
                        }

                        // Second password prompt for confirmation
                        ModalInputManager.requestInput(
                            Config.MESSAGES.PASSWORD_CONFIRM_PROMPT,
                            async (confirmedPassword) => {
                                if (firstPassword !== confirmedPassword) {
                                    resolve({ success: false, error: Config.MESSAGES.PASSWORD_MISMATCH });
                                    return;
                                }
                                // Passwords match, proceed with registration
                                const registerResult = await UserManager.register(username, firstPassword);
                                resolve(registerResult);
                            },
                            () => resolve({ success: true, output: Config.MESSAGES.OPERATION_CANCELLED, messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG }),
                            true, // isObscured
                            options
                        );
                    },
                    () => resolve({ success: true, output: Config.MESSAGES.OPERATION_CANCELLED, messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG }),
                    true, // isObscured
                    options
                );
            }).then(result => {
                // This `.then()` block ensures we handle the resolved promise from the prompts
                if (result.success && result.message) {
                    // Successful registration often returns a message instead of output
                    return { success: true, output: result.message, messageType: Config.CSS_CLASSES.SUCCESS_MSG };
                }
                return result; // Return success or error objects as they are
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

       Upon successful creation, the following actions are performed:
       - The user's credentials are created and stored securely.
       - A new home directory is created for the user at /home/<username>.
       - A new primary group with the same name as the user is created.
       - The new user is added to their new primary group.

       Usernames cannot contain spaces and must be unique.

EXAMPLES
       useradd newdev
              Starts the process to create a user named 'newdev',
              prompting for a password.`;

    CommandRegistry.register("useradd", useraddCommandDefinition, useraddDescription, useraddHelpText);
})();