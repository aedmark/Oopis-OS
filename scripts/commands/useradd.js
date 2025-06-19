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

    const useraddDescription = "Adds a new user.";
    const useraddHelpText = "Usage: useradd <username>\n\nAdds a new user with the specified username.";

    CommandRegistry.register("", useraddCommandDefinition, useraddDescription, useraddHelpText);
})();