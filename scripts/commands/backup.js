// scripts/commands/backup.js

window.BackupCommand = class BackupCommand extends Command {
  constructor() {
    super({
      commandName: "backup",
      description: "Creates a secure backup of the current OopisOS system state.",
      helpText: `Usage: backup

Creates a secure, verifiable backup of the current OopisOS system state.

DESCRIPTION
       The backup command creates a JSON file containing a snapshot of the current
       OopisOS system state. This backup includes an integrity checksum (SHA-256)
       to ensure the file is not corrupted or tampered with. This backup can be
       used to restore the system to a previous state using the 'restore' command.

       When run in the Electron desktop app, it will open a native file save dialog.
       Otherwise, it will trigger a browser download.`,
      argValidation: {
        exact: 0,
      },
    });
  }

  async coreLogic(context) {
    const { options, dependencies } = context;
    const {
      UserManager,
      StorageManager,
      Config,
      Utils,
      FileSystemManager,
      ErrorHandler,
    } = dependencies;

    try {
      if (!options.isInteractive) {
        return ErrorHandler.createError(
            "backup: Can only be run in interactive mode."
        );
      }

      const currentUser = UserManager.getCurrentUser();
      const allKeys = StorageManager.getAllLocalStorageKeys();
      const automaticSessionStates = {};
      const manualSaveStates = {};

      allKeys.forEach((key) => {
        if (key.startsWith(Config.STORAGE_KEYS.USER_TERMINAL_STATE_PREFIX)) {
          automaticSessionStates[key] = StorageManager.loadItem(key);
        } else if (
            key.startsWith(Config.STORAGE_KEYS.MANUAL_TERMINAL_STATE_PREFIX)
        ) {
          manualSaveStates[key] = StorageManager.loadItem(key);
        }
      });

      const backupData = {
        dataType: "OopisOS_System_State_Backup_v4.5",
        osVersion: Config.OS.VERSION,
        timestamp: new Date().toISOString(),
        fsDataSnapshot: Utils.deepCopyNode(FileSystemManager.getFsData()),
        userCredentials: StorageManager.loadItem(
            Config.STORAGE_KEYS.USER_CREDENTIALS,
            "User Credentials",
            {}
        ),
        editorWordWrapEnabled: StorageManager.loadItem(
            Config.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED,
            "Editor Word Wrap",
            false
        ),
        automaticSessionStates,
        manualSaveStates,
      };

      const stringifiedDataForChecksum = JSON.stringify(backupData);
      const checksum = await Utils.calculateSHA256(
          stringifiedDataForChecksum
      );

      if (!checksum) {
        return ErrorHandler.createError(
            "backup: Failed to compute integrity checksum."
        );
      }
      backupData.checksum = checksum;

      const backupJsonString = JSON.stringify(backupData, null, 2);
      const defaultFileName = `OopisOS_System_Backup_${
          currentUser.name
      }_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

      return ErrorHandler.createSuccess(
          `Backup data prepared for ${defaultFileName}.`,
          {
            effect: "backup",
            effectData: {
              content: backupJsonString,
              fileName: defaultFileName,
            },
          }
      );
    } catch (e) {
      return ErrorHandler.createError(
          `backup: An unexpected error occurred: ${e.message}`
      );
    }
  }
}

window.CommandRegistry.register(new BackupCommand());
