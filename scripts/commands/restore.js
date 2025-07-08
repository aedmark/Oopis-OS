(() => {
    "use strict";

    const restoreCommandDefinition = {
        commandName: "restore",
        argValidation: {
            exact: 0,
        },
        coreLogic: async (context) => {
            const { options } = context;
            if (!options.isInteractive) {
                return { success: false, error: "restore: Can only be run in interactive mode." };
            }

            let fileContent;
            let fileName;

            if (window.electronAPI && typeof window.electronAPI.showOpenDialog === 'function') {
                const filePath = await window.electronAPI.showOpenDialog({
                    title: 'Select OopisOS Backup File',
                    properties: ['openFile'],
                    filters: [{ name: 'OopisOS Backups', extensions: ['json'] }]
                });

                if (filePath) {
                    const readResult = await CommandExecutor.processSingleCommand(`cat "${filePath}"`, { isInteractive: false });
                    if (!readResult.success) {
                        return { success: false, error: `restore: Could not read file '${filePath}': ${readResult.error}` };
                    }
                    fileContent = readResult.output;
                    fileName = filePath.split(/[\\\/]/).pop();
                } else {
                    return { success: false, error: `restore: ${Config.MESSAGES.RESTORE_CANCELLED_NO_FILE}` };
                }
            }
            else {
                const input = Utils.createElement("input", { type: "file", accept: ".json" });
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
                                    resolve({ success: false, error: Config.MESSAGES.RESTORE_CANCELLED_NO_FILE });
                                }
                            }, 300);
                        };
                        input.onchange = (e) => {
                            dialogClosed = true;
                            window.removeEventListener("focus", onFocus);
                            const f = e.target.files[0];
                            if (f) resolve({ success: true, file: f });
                            else resolve({ success: false, error: Config.MESSAGES.RESTORE_CANCELLED_NO_FILE });
                        };
                        window.addEventListener("focus", onFocus);
                        input.click();
                    });

                    if (!fileResult.success) {
                        return { success: false, error: `restore: ${fileResult.error}` };
                    }
                    fileContent = await fileResult.file.text();
                    fileName = fileResult.file.name;
                } catch (e) {
                    return { success: false, error: `restore: ${e.message}` };
                } finally {
                    if (input.parentNode) document.body.removeChild(input);
                }
            }

            let backupData;
            try {
                backupData = JSON.parse(fileContent);
            } catch (parseError) {
                return { success: false, error: `restore: Error parsing backup file '${fileName}': ${parseError.message}` };
            }

            if (backupData.checksum) {
                const storedChecksum = backupData.checksum;
                delete backupData.checksum;
                const stringifiedDataForChecksum = JSON.stringify(backupData);
                const calculatedChecksum = await Utils.calculateSHA256(stringifiedDataForChecksum);
                if (calculatedChecksum !== storedChecksum) {
                    return { success: false, error: `restore: Checksum mismatch. Backup file is corrupted or has been tampered with.` };
                }
            }

            if (!backupData || !backupData.dataType || !backupData.dataType.startsWith("OopisOS_System_State_Backup")) {
                return { success: false, error: `restore: '${fileName}' is not a valid OopisOS System State backup file.` };
            }

            const messageLines = [
                `WARNING: This will completely overwrite the current OopisOS state.`,
                `All users, files, and sessions will be replaced with data from '${fileName}'.`,
                "This action cannot be undone. Are you sure you want to restore?",
            ];

            const confirmed = await new Promise((conf) =>
                ModalManager.request({
                    context: "terminal", messageLines, onConfirm: () => conf(true), onCancel: () => conf(false), options
                })
            );

            if (!confirmed) {
                return { success: true, output: Config.MESSAGES.OPERATION_CANCELLED, messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG };
            }

            const allKeys = StorageManager.getAllLocalStorageKeys();
            allKeys.forEach((key) => {
                if (key !== Config.STORAGE_KEYS.GEMINI_API_KEY) {
                    StorageManager.removeItem(key);
                }
            });

            if (backupData.userCredentials) StorageManager.saveItem(Config.STORAGE_KEYS.USER_CREDENTIALS, backupData.userCredentials);
            if (backupData.editorWordWrapEnabled !== undefined) StorageManager.saveItem(Config.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED, backupData.editorWordWrapEnabled);
            if (backupData.automaticSessionStates) {
                for (const key in backupData.automaticSessionStates) StorageManager.saveItem(key, backupData.automaticSessionStates[key]);
            }
            if (backupData.manualSaveStates) {
                for (const key in backupData.manualSaveStates) StorageManager.saveItem(key, backupData.manualSaveStates[key]);
            }

            FileSystemManager.setFsData(Utils.deepCopyNode(backupData.fsDataSnapshot));
            if (!(await FileSystemManager.save())) {
                return { success: false, error: "restore: Critical failure: Could not save the restored file system to the database." };
            }

            const successMessage = `${Config.MESSAGES.RESTORE_SUCCESS_PREFIX}${context.currentUser}${Config.MESSAGES.RESTORE_SUCCESS_MIDDLE}${fileName}${Config.MESSAGES.RESTORE_SUCCESS_SUFFIX}`;
            await OutputManager.appendToOutput(successMessage, { typeClass: Config.CSS_CLASSES.SUCCESS_MSG });

            setTimeout(() => { window.location.reload(true); }, 1500);

            return { success: true, output: "" };
        },
    };

    const restoreDescription = "Restores the entire system state from a backup file.";
    const restoreHelpText = `Usage: restore

Restore the entire OopisOS system state from a backup file.

DESCRIPTION
       The restore command initiates a full system restoration from a
       '.json' file previously created with the 'backup' command.

       When run in the Electron desktop app, this command will open a native
       file selection dialog. Otherwise, it will use the browser's uploader.

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