// scripts/commands/restore.js

window.RestoreCommand = class RestoreCommand extends Command {
    constructor() {
        super({
            commandName: "restore",
            description: "Restores the OopisOS system state from a backup file.",
            helpText: `Usage: restore <backup_file.json>
      Restore the OopisOS system from a backup file.
      DESCRIPTION
      The restore command takes a JSON backup file created by the 'backup'
      command and restores the entire system state, including all user
      accounts, filesystems, and session data.
      The backup file's integrity is verified using its SHA-256 checksum
      before any data is restored.
      WARNING
      This operation is destructive and will overwrite your entire current
      system with the data from the backup file. This action cannot be undone.
      The command will prompt for confirmation before proceeding.`,
            completionType: "paths",
            validations: {
                args: {
                    exact: 1
                },
                paths: [{
                    argIndex: 0,
                    options: {
                        expectedType: 'file',
                        permissions: ['read']
                    }
                }]
            },
        });
    }

    async coreLogic(context) {
        const { options, validatedPaths, dependencies } = context;
        const {
            ModalManager,
            StorageManager,
            Utils,
            Config,
            OutputManager,
            FileSystemManager,
            SessionManager,
            ErrorHandler,
        } = dependencies;

        if (!options.isInteractive) {
            return ErrorHandler.createError(
                "restore: Can only be run in an interactive mode."
            );
        }

        const { node: backupFileNode } = validatedPaths[0];

        let backupData;
        try {
            backupData = JSON.parse(backupFileNode.content || "{}");
        } catch (e) {
            return ErrorHandler.createError(
                "restore: Invalid backup file. Content is not valid JSON."
            );
        }

        if (
            !backupData.dataType ||
            !backupData.dataType.startsWith("OopisOS_System_State_Backup")
        ) {
            return ErrorHandler.createError(
                "restore: Not a valid OopisOS backup file."
            );
        }

        const { checksum, ...dataToVerify } = backupData;
        const stringifiedData = JSON.stringify(dataToVerify);
        const calculatedChecksum = await Utils.calculateSHA256(stringifiedData);

        if (calculatedChecksum !== checksum) {
            return ErrorHandler.createError(
                "restore: Backup file is corrupt or has been tampered with. Checksum mismatch."
            );
        }

        const confirmed = await new Promise((resolve) =>
            ModalManager.request({
                context: "terminal",
                messageLines: [
                    "WARNING: This will completely overwrite the current system state with the backup data.",
                    "All current users, files, and settings will be lost.",
                    "This action cannot be undone. Are you sure you want to restore?",
                ],
                onConfirm: () => resolve(true),
                onCancel: () => resolve(false),
                options,
            })
        );

        if (!confirmed) {
            return ErrorHandler.createSuccess("Restore cancelled. No action taken.");
        }

        await OutputManager.appendToOutput("Restoring system... Please wait.");

        const allKeys = StorageManager.getAllLocalStorageKeys();
        const OS_KEY_PREFIX = "oopisOs";
        allKeys.forEach((key) => {
            if (key.startsWith(OS_KEY_PREFIX)) {
                StorageManager.removeItem(key);
            }
        });
        await FileSystemManager.clearAllFS();

        StorageManager.saveItem(
            Config.STORAGE_KEYS.USER_CREDENTIALS,
            backupData.userCredentials,
            "User Credentials"
        );
        StorageManager.saveItem(
            Config.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED,
            backupData.editorWordWrapEnabled,
            "Editor Word Wrap"
        );

        for (const key in backupData.automaticSessionStates) {
            StorageManager.saveItem(key, backupData.automaticSessionStates[key]);
        }
        for (const key in backupData.manualSaveStates) {
            StorageManager.saveItem(key, backupData.manualSaveStates[key]);
        }

        FileSystemManager.setFsData(backupData.fsDataSnapshot);
        await FileSystemManager.save();

        return ErrorHandler.createSuccess(
            "System restored successfully. Please reboot the system (`reboot`) for all changes to take effect."
        );
    }
}

window.CommandRegistry.register(new RestoreCommand());
