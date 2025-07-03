/**
 * @file Defines the 'sudo' command.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    const sudoCommandDefinition = {
        commandName: "sudo",
        argValidation: {
            min: 1,
            error: "usage: sudo <command> [args ...]"
        },
        coreLogic: async (context) => {
            const { args, currentUser, options } = context;
            const commandToRun = args[0];
            const fullCommandStr = args.join(' ');

            if (currentUser === 'root') {
                return await CommandExecutor.processSingleCommand(fullCommandStr, { isInteractive: options.isInteractive });
            }

            if (!SudoManager.canUserRunCommand(currentUser, commandToRun) && !SudoManager.canUserRunCommand(currentUser, 'ALL')) {
                return {
                    success: false,
                    error: `sudo: Sorry, user ${currentUser} is not allowed to execute '${commandToRun}' as root on OopisOs.`
                };
            }

            if (SudoManager.isUserTimestampValid(currentUser)) {
                return await UserManager.sudoExecute(fullCommandStr, options);
            }

            // =================================================================
            // === NEW SCRIPT-AWARE LOGIC BLOCK ================================
            // =================================================================
            if (options.scriptingContext?.isScripting) {
                const scriptContext = options.scriptingContext;

                // Helper to get the next valid line from the script for the password
                const getNextInputLine = () => {
                    // Start looking from the current line index + 1
                    let lineIndex = scriptContext.currentLineIndex + 1;
                    while (lineIndex < scriptContext.lines.length) {
                        const line = scriptContext.lines[lineIndex]?.trim();
                        // A valid input line is one that exists and is not a comment.
                        if (line && !line.startsWith('#')) {
                            // IMPORTANT: Consume the line by updating the script's index
                            scriptContext.currentLineIndex = lineIndex;
                            return line;
                        }
                        lineIndex++;
                    }
                    return null; // Return null if we reach the end of the script
                };

                // Manually handle the password prompt by consuming the next line from the script.
                await OutputManager.appendToOutput(`[sudo] password for ${currentUser}:`, {typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG});
                const password = getNextInputLine();

                if (password === null) {
                    return { success: false, error: "sudo: Script ended while awaiting password." };
                }

                // Echo obscured password to the terminal to simulate interactive entry for the log.
                const promptEcho = `${DOM.promptContainer.textContent} `;
                await OutputManager.appendToOutput(`${promptEcho}${'*'.repeat(password.length)}`);

                const authResult = await UserManager.verifyPassword(currentUser, password);

                if (authResult.success) {
                    SudoManager.updateUserTimestamp(currentUser);
                    // Execute the command, ensuring it's treated as non-interactive within the script context.
                    return await UserManager.sudoExecute(fullCommandStr, { ...options, isInteractive: false });
                } else {
                    // Add a delay to simulate real sudo failure
                    await new Promise(r => setTimeout(r, 1000));
                    return { success: false, error: "sudo: Sorry, try again." };
                }

            } else {
                // --- This is the original logic for interactive use ---
                return new Promise(resolve => {
                    ModalInputManager.requestInput(
                        `[sudo] password for ${currentUser}:`,
                        async (password) => {
                            const authResult = await UserManager.verifyPassword(currentUser, password);

                            if (authResult.success) {
                                SudoManager.updateUserTimestamp(currentUser);
                                resolve(await UserManager.sudoExecute(fullCommandStr, options));
                            } else {
                                setTimeout(() => {
                                    resolve({ success: false, error: "sudo: Sorry, try again." });
                                }, 1000);
                            }
                        },
                        () => resolve({ success: true, output: "" }),
                        true, // isObscured
                        options
                    );
                });
            }
        }
    };

    const sudoDescription = "Executes a command as the superuser (root).";
    const sudoHelpText = `Usage: sudo <command> [arguments]

Execute a command with superuser privileges.

DESCRIPTION
       sudo allows a permitted user to execute a command as the superuser or another
       user, as specified by the security policy in the /etc/sudoers file.

       If the user has a valid timestamp (i.e., they have successfully authenticated
       recently), the command is executed without a password prompt. Otherwise, sudo
       requires the user to authenticate with their own password.

       To edit the sudoers file, use the 'visudo' command.`;

    CommandRegistry.register("sudo", sudoCommandDefinition, sudoDescription, sudoHelpText);

})();