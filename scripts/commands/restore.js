(() => {
    "use strict";
    /**
     * @file Defines the 'restore' command, which restores the entire OopisOS system state
     * from a previously saved backup JSON file. This is a powerful and destructive operation.
     * @author Andrew Edmark
     * @author Gemini
     */

    /**
     * @const {object} restoreCommandDefinition
     * @description The command definition for the 'restore' command.
     * This object specifies the command's name, argument validation (no arguments expected),
     * and the core logic for handling system state restoration from a file.
     */
    const restoreCommandDefinition = {
        commandName: "restore",
        argValidation: {
            exact: 0, // This command takes no arguments.
        },
        /**
         * The core logic for the 'restore' command.
         * It must be run in interactive mode. It prompts the user to select a JSON backup file.
         * It then validates the file's data type and integrity via a checksum. If the checksum
         * is valid (or if it's a legacy backup), it prompts for final confirmation before
         * wiping and restoring the system.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @returns {Promise<object>} A promise that resolves to a command result object.
         */
        coreLogic: async (context) => {
            const { options } = context;
            // Ensure the command is run in an interactive terminal session.
            if (!options.isInteractive)
                return {
                    success: false,
                    error: "restore: Can only be run in interactive mode.",
                };

            // Create a hidden file input element to trigger the browser's file selection dialog.
            const input = Utils.createElement("input", {
                type: "file",
                accept: ".json", // Only accept JSON files.
            });
            input.style.display = "none"; // Keep the input hidden.
            document.body.appendChild(input); // Temporarily append to the DOM.

            try {
                // Wait for the user to select a file or cancel the dialog.
                const fileResult = await new Promise((resolve) => {
                    let dialogClosed = false;
                    // Timeout to detect if the user closes the file dialog without selecting a file.
                    const onFocus = () => {
                        setTimeout(() => {
                            window.removeEventListener("focus", onFocus);
                            if (!dialogClosed) {
                                dialogClosed = true;
                                resolve({
                                    success: false,
                                    error: Config.MESSAGES.RESTORE_CANCELLED_NO_FILE,
                                });
                            }
                        }, 300);
                    };

                    // Handle file selection change event.
                    input.onchange = (e) => {
                        dialogClosed = true;
                        window.removeEventListener("focus", onFocus); // Remove focus listener once dialog is handled.
                        const f = e.target.files[0]; // Get the selected file.
                        if (f) resolve({ success: true, file: f });
                        else
                            resolve({
                                success: false,
                                error: Config.MESSAGES.RESTORE_CANCELLED_NO_FILE,
                            });
                    };

                    // Add a focus listener to detect dialog cancellation.
                    window.addEventListener("focus", onFocus);
                    input.click(); // Programmatically click the hidden input to open the dialog.
                });

                // If no file was selected or dialog was cancelled, return an error.
                if (!fileResult.success) {
                    return { success: false, error: `restore: ${fileResult.error}` };
                }

                const file = fileResult.file;
                let backupData;
                let fileContent = await file.text();
                try {
                    // Read and parse the content of the selected JSON file.
                    backupData = JSON.parse(fileContent);
                } catch (parseError) {
                    return {
                        success: false,
                        error: `restore: Error parsing backup file '${file.name}': ${parseError.message}`,
                    };
                }

                // --- CHECKSUM VERIFICATION ---
                if (backupData.checksum) {
                    const storedChecksum = backupData.checksum;
                    delete backupData.checksum;

                    const stringifiedDataForChecksum = JSON.stringify(backupData);
                    const calculatedChecksum = await Utils.calculateSHA256(stringifiedDataForChecksum);

                    if (calculatedChecksum !== storedChecksum) {
                        return {
                            success: false,
                            error: `restore: Checksum mismatch. Backup file is corrupted or has been tampered with.`
                        };
                    }
                }

                // Validate the structure and type of the backup data.
                if (
                    !backupData ||
                    !backupData.dataType ||
                    !backupData.dataType.startsWith("OopisOS_System_State_Backup")
                ) {
                    return {
                        success: false,
                        error: `restore: '${file.name}' is not a valid OopisOS System State backup file.`,
                    };
                }

                // Prepare a warning message for the user before proceeding with overwrite.
                const messageLines = [
                    `WARNING: This will completely overwrite the current OopisOS state.`,
                    `All users, files, and sessions will be replaced with data from '${file.name}'.`,
                    "This action cannot be undone. Are you sure you want to restore?",
                ];

                // Request final confirmation from the user.
                const confirmed = await new Promise((conf) =>
                    ModalManager.request({
                        context: "terminal",
                        messageLines,
                        onConfirm: () => conf(true),
                        onCancel: () => conf(false),
                        options, // Pass context for scripting.
                    })
                );

                // If user cancels, return a cancellation message.
                if (!confirmed) {
                    return {
                        success: true,
                        output: Config.MESSAGES.OPERATION_CANCELLED,
                        messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                    };
                }

                // --- Perform the restoration ---
                // Clear all relevant data from localStorage (except Gemini API key).
                const allKeys = StorageManager.getAllLocalStorageKeys();
                allKeys.forEach((key) => {
                    if (key !== Config.STORAGE_KEYS.GEMINI_API_KEY) {
                        StorageManager.removeItem(key);
                    }
                });

                // Save restored data to localStorage.
                if (backupData.userCredentials)
                    StorageManager.saveItem(
                        Config.STORAGE_KEYS.USER_CREDENTIALS,
                        backupData.userCredentials
                    );
                if (backupData.editorWordWrapEnabled !== undefined) // Handle boolean directly.
                    StorageManager.saveItem(
                        Config.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED,
                        backupData.editorWordWrapEnabled
                    );
                if (backupData.automaticSessionStates) {
                    for (const key in backupData.automaticSessionStates)
                        StorageManager.saveItem(
                            key,
                            backupData.automaticSessionStates[key]
                        );
                }
                if (backupData.manualSaveStates) {
                    for (const key in backupData.manualSaveStates)
                        StorageManager.saveItem(
                            key,
                            backupData.manualSaveStates[key]
                        );
                }

                // Restore the file system data in memory.
                FileSystemManager.setFsData(
                    Utils.deepCopyNode(backupData.fsDataSnapshot)
                );

                // Persist the restored file system to IndexedDB.
                if (!(await FileSystemManager.save())) {
                    return {
                        success: false,
                        error:
                            "restore: Critical failure: Could not save the restored file system to the database.",
                    };
                }

                // REFACTOR START: Use configured messages
                const successMessage = `${Config.MESSAGES.RESTORE_SUCCESS_PREFIX}${context.currentUser}${Config.MESSAGES.RESTORE_SUCCESS_MIDDLE}${file.name}${Config.MESSAGES.RESTORE_SUCCESS_SUFFIX}`;
                await OutputManager.appendToOutput(successMessage, {
                    typeClass: Config.CSS_CLASSES.SUCCESS_MSG,
                });
                // REFACTOR END

                setTimeout(() => {
                    window.location.reload(true); // Force a full reload from server, not cache.
                }, 1500);

                return {
                    success: true,
                    output: "", // No further output needed as reload is imminent.
                };
            } catch (e) {
                // Catch any unexpected errors during the process.
                return {
                    success: false,
                    error: `restore: ${e.message}`,
                };
            } finally {
                // Ensure the hidden input element is removed from the DOM.
                if (input.parentNode) document.body.removeChild(input);
            }
        },
    };

    const restoreDescription = "Restores the entire system state from a backup file.";

    const restoreHelpText = `Usage: restore

Restore the entire OopisOS system state from a backup file.

DESCRIPTION
       The restore command initiates a full system restoration from a
       '.json' file previously created with the 'backup' command.

       This command will open your browser's file selection dialog,
       allowing you to choose the backup file from your local machine.

       The system will first verify the backup file's integrity using
       an embedded checksum. If the file is valid, you will be asked
       for final confirmation.

       Upon confirmation, the entire current state of OopisOS will be
       wiped and replaced with the data from the backup file. This
       includes all users, groups, files, directories, aliases, and
       saved session states.

       After a successful restore, the system will automatically reboot.

WARNING
       THIS OPERATION IS IRREVERSIBLE AND WILL PERMANENTLY OVERWRITE
       ALL CURRENT OOPISOS DATA. THE COMMAND WILL PROMPT FOR
       CONFIRMATION BEFORE PROCEEDING.`;

    CommandRegistry.register("restore", restoreCommandDefinition, restoreDescription, restoreHelpText);
})();