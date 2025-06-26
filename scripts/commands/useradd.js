/**
 * @file Defines the 'useradd' command, which allows the creation of new user accounts.
 * This command handles password prompting and delegates user registration to `UserManager`.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} useraddCommandDefinition
     * @description The command definition for the 'useradd' command.
     * This object specifies the command's name, argument validation (expecting one username),
     * and the core logic for prompting for a password and registering a new user.
     */
    const useraddCommandDefinition = {
        commandName: "useradd",
        argValidation: {
            exact: 1, // Requires exactly one argument: the new username.
            error: "expects exactly one argument (username)",
        },
        /**
         * The core logic for the 'useradd' command.
         * It prompts the user twice for a password (once for input, once for confirmation).
         * If passwords match or no password is provided, it attempts to register the new user
         * via `UserManager.register()`. It handles various scenarios including existing usernames
         * and password mismatches.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command, expecting a single username.
         * @param {object} context.options - Execution options, including scriptingContext for automated prompts.
         * @returns {Promise<object>} A promise that resolves to a command result object,
         * indicating the success or failure of the user creation process.
         */
        coreLogic: async (context) => {
            const { args, options } = context;
            const username = args[0];

            // --- REFACTORED LOGIC ---
            // This refactor introduces a dedicated path for handling non-interactive, scripted input,
            // preventing the 'run' command from misinterpreting password lines as commands.

            // First, perform a preliminary check for existing users to fail early.
            const userCheck = StorageManager.loadItem(Config.STORAGE_KEYS.USER_CREDENTIALS, "User list", {});
            if (userCheck[username]) {
                return { success: false, error: `User '${username}' already exists.` };
            }

            // Path 1: Scripted Execution
            if (options.scriptingContext?.isScripting) {
                const scriptContext = options.scriptingContext;

                // Helper to get the next valid line from the script, advancing the script's line index.
                const getNextInputLine = () => {
                    while (scriptContext.currentLineIndex < scriptContext.lines.length - 1) {
                        scriptContext.currentLineIndex++;
                        const line = scriptContext.lines[scriptContext.currentLineIndex]?.trim();
                        // A valid input line is one that exists and is not a comment.
                        if (line && !line.startsWith('#')) {
                            return line;
                        }
                    }
                    return null; // Return null if we reach the end of the script.
                };

                // Manually handle the password prompts by consuming the next lines from the script.
                await OutputManager.appendToOutput(Config.MESSAGES.PASSWORD_PROMPT, {typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG});
                const password = getNextInputLine();
                if (password === null) {
                    return { success: false, error: "Script ended while awaiting password." };
                }
                // Echo obscured password to the terminal to simulate interactive entry.
                const promptEcho = `${DOM.promptUserSpan.textContent}@${DOM.promptHostSpan.textContent}:${DOM.promptPathSpan.textContent}${DOM.promptCharSpan.textContent} `;
                await OutputManager.appendToOutput(`${promptEcho}${'*'.repeat(password.length)}`);

                await OutputManager.appendToOutput(Config.MESSAGES.PASSWORD_CONFIRM_PROMPT, {typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG});
                const confirmPassword = getNextInputLine();
                if (confirmPassword === null) {
                    return { success: false, error: "Script ended while awaiting password confirmation." };
                }
                await OutputManager.appendToOutput(`${promptEcho}${'*'.repeat(confirmPassword.length)}`);

                if (password !== confirmPassword) {
                    return { success: false, error: Config.MESSAGES.PASSWORD_MISMATCH };
                }

                // With passwords confirmed, proceed with registration.
                const registerResult = await UserManager.register(username, password);
                if (registerResult.success && registerResult.message) {
                    return { success: true, output: registerResult.message, messageType: Config.CSS_CLASSES.SUCCESS_MSG };
                }
                return registerResult;

            } else {
                // Path 2: Interactive Execution (Original Logic)
                return new Promise(async (resolve) => {
                    // First password prompt (obscured input).
                    ModalInputManager.requestInput(
                        Config.MESSAGES.PASSWORD_PROMPT,
                        async (firstPassword) => {
                            // If the first password input is empty, treat it as an intention to create no password.
                            if (firstPassword.trim() === "") {
                                await OutputManager.appendToOutput("Registering user with no password.", { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG });
                                const registerResult = await UserManager.register(username, null); // Register with null password.
                                resolve(registerResult);
                                return;
                            }

                            // Second password prompt for confirmation.
                            ModalInputManager.requestInput(
                                Config.MESSAGES.PASSWORD_CONFIRM_PROMPT,
                                async (confirmedPassword) => {
                                    // Check if the two passwords match.
                                    if (firstPassword !== confirmedPassword) {
                                        resolve({ success: false, error: Config.MESSAGES.PASSWORD_MISMATCH });
                                        return;
                                    }
                                    // Passwords match, proceed with user registration.
                                    const registerResult = await UserManager.register(username, firstPassword);
                                    resolve(registerResult);
                                },
                                // Callback if the second password prompt is cancelled.
                                () => resolve({ success: true, output: Config.MESSAGES.OPERATION_CANCELLED, messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG }),
                                true, // `isObscured` for password input.
                                options // Pass options for scripting context.
                            );
                        },
                        // Callback if the first password prompt is cancelled.
                        () => resolve({ success: true, output: Config.MESSAGES.OPERATION_CANCELLED, messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG }),
                        true, // `isObscured` for password input.
                        options // Pass options for scripting context.
                    );
                }).then(result => {
                    // This `.then()` block processes the final result from the Promise chain.
                    // If registration was successful and returned a message, format it for success output.
                    if (result.success && result.message) {
                        return { success: true, output: result.message, messageType: Config.CSS_CLASSES.SUCCESS_MSG };
                    }
                    // Otherwise, return the result object as is (it's already structured for success/error).
                    return result;
                });
            }
        },
    };

    /**
     * @const {string} useraddDescription
     * @description A brief, one-line description of the 'useradd' command for the 'help' command.
     */
    const useraddDescription = "Creates a new user account.";

    /**
     * @const {string} useraddHelpText
     * @description The detailed help text for the 'useradd' command, used by 'man'.
     */
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

    // Register the command with the system
    CommandRegistry.register("useradd", useraddCommandDefinition, useraddDescription, useraddHelpText);
})();