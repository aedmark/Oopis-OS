// scripts/commands/restore.js

(() => {
    "use strict";
    const restoreCommandDefinition = {
        commandName: "restore",
        argValidation: {
            exact: 0,
        },
        coreLogic: async (context) => {
            const { options } = context;
            if (!options.isInteractive)
                return {
                    success: false,
                    error: "restore: Can only be run in interactive mode.",
                };
            const input = Utils.createElement("input", {
                type: "file",
                accept: ".json",
            });
            input.style.display = "none";
            document.body.appendChild(input);
            try {
                const fileResult = await new Promise((resolve) => {
                    let dialogClosed = false;
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

                    input.onchange = (e) => {
                        dialogClosed = true;
                        window.removeEventListener("focus", onFocus);
                        const f = e.target.files[0];
                        if (f) resolve({ success: true, file: f });
                        else
                            resolve({
                                success: false,
                                error: Config.MESSAGES.RESTORE_CANCELLED_NO_FILE,
                            });
                    };

                    window.addEventListener("focus", onFocus);
                    input.click();
                });

                if (!fileResult.success) {
                    return { success: false, error: `restore: ${fileResult.error}` };
                }
                const file = fileResult.file;
                const backupData = JSON.parse(await file.text());
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
                const messageLines = [
                    `WARNING: This will completely overwrite the current OopisOS state.`,
                    `All users, files, and sessions will be replaced with data from '${file.name}'.`,
                    "This action cannot be undone. Are you sure you want to restore?",
                ];
                const confirmed = await new Promise((conf) =>
                    ModalManager.request({
                        context: "terminal",
                        messageLines,
                        onConfirm: () => conf(true),
                        onCancel: () => conf(false),
                        options,
                    })
                );
                if (!confirmed) {
                    return {
                        success: true,
                        output: Config.MESSAGES.OPERATION_CANCELLED,
                        messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                    };
                }
                const allKeys = StorageManager.getAllLocalStorageKeys();
                allKeys.forEach((key) => {
                    if (key !== Config.STORAGE_KEYS.GEMINI_API_KEY) {
                        StorageManager.removeItem(key);
                    }
                });
                if (backupData.userCredentials)
                    StorageManager.saveItem(
                        Config.STORAGE_KEYS.USER_CREDENTIALS,
                        backupData.userCredentials
                    );
                if (backupData.editorWordWrapEnabled !== undefined)
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
                        StorageManager.saveItem(key, backupData.manualSaveStates[key]);
                }
                FileSystemManager.setFsData(
                    Utils.deepCopyNode(backupData.fsDataSnapshot)
                );

                if (!(await FileSystemManager.save())) {
                    return {
                        success: false,
                        error:
                            "restore: Critical failure: Could not save the restored file system to the database.",
                    };
                }

                await OutputManager.appendToOutput(
                    "System state restored successfully. Rebooting OopisOS to apply changes...",
                    {
                        typeClass: Config.CSS_CLASSES.SUCCESS_MSG,
                    }
                );
                setTimeout(() => {
                    window.location.reload(true);
                }, 1500);
                return {
                    success: true,
                    output: "",
                };
            } catch (e) {
                return {
                    success: false,
                    error: `restore: ${e.message}`,
                };
            } finally {
                if (input.parentNode) document.body.removeChild(input);
            }
        },
    };
    const restoreDescription = "Restores the system state from a backup file.";
    const restoreHelpText = "Usage: restore";
    CommandRegistry.register("restore", restoreCommandDefinition, restoreDescription, restoreHelpText);
})();