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
            const userCheck = StorageManager.loadItem(
                Config.STORAGE_KEYS.USER_CREDENTIALS,
                "User list", {}
            );
            if (userCheck[username]) {
                return {
                    success: false,
                    error: `User '${username}' already exists.`,
                };
            }
            try {
                let firstPassword;
                ModalInputManager.requestInput(
                    Config.MESSAGES.PASSWORD_PROMPT,
                    (pwd) => { firstPassword = pwd; },
                    () => { throw new Error(Config.MESSAGES.OPERATION_CANCELLED); },
                    true, // isObscured
                    options // Pass context for scripting
                );

                if (firstPassword.trim() === "") {
                    await OutputManager.appendToOutput(
                        "Registering user with no password.", {
                            typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                        }
                    );
                } else {
                    let confirmedPassword;
                    ModalInputManager.requestInput(
                        Config.MESSAGES.PASSWORD_CONFIRM_PROMPT,
                        (pwd) => { confirmedPassword = pwd; },
                        () => { throw new Error(Config.MESSAGES.OPERATION_CANCELLED); },
                        true, // isObscured
                        options // Pass context for scripting
                    );
                    if (firstPassword !== confirmedPassword) {
                        return {
                            success: false,
                            error: Config.MESSAGES.PASSWORD_MISMATCH,
                        };
                    }
                }
                const registerResult = await UserManager.register(
                    username,
                    firstPassword || null
                );
                if (registerResult.success) {
                    await OutputManager.appendToOutput(registerResult.message, {
                        typeClass: Config.CSS_CLASSES.SUCCESS_MSG,
                    });
                    return {
                        success: true,
                        output: "",
                    };
                } else {
                    return {
                        success: false,
                        error: registerResult.error,
                    };
                }
            } catch (e) {
                if (e.message === Config.MESSAGES.OPERATION_CANCELLED) {
                    return {
                        success: true,
                        output: Config.MESSAGES.OPERATION_CANCELLED,
                        messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                    };
                }
                return {
                    success: false,
                    error: `useradd: ${e.message}`,
                };
            }
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