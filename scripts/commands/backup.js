(() => {
  "use strict";

  const backupCommandDefinition = {
    commandName: "backup",
    argValidation: {
      exact: 0,
    },
    coreLogic: async (context) => {
      const { options } = context;
      if (!options.isInteractive) {
        return { success: false, error: "backup: Can only be run in interactive mode." };
      }

      const currentUser = UserManager.getCurrentUser();
      const allKeys = StorageManager.getAllLocalStorageKeys();
      const automaticSessionStates = {};
      const manualSaveStates = {};

      allKeys.forEach((key) => {
        if (key.startsWith(Config.STORAGE_KEYS.USER_TERMINAL_STATE_PREFIX)) {
          automaticSessionStates[key] = StorageManager.loadItem(key);
        } else if (key.startsWith(Config.STORAGE_KEYS.MANUAL_TERMINAL_STATE_PREFIX)) {
          manualSaveStates[key] = StorageManager.loadItem(key);
        }
      });

      const backupData = {
        dataType: "OopisOS_System_State_Backup_v3.2",
        osVersion: Config.OS.VERSION,
        timestamp: new Date().toISOString(),
        fsDataSnapshot: Utils.deepCopyNode(FileSystemManager.getFsData()),
        userCredentials: StorageManager.loadItem(Config.STORAGE_KEYS.USER_CREDENTIALS, "User Credentials", {}),
        editorWordWrapEnabled: StorageManager.loadItem(Config.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED, "Editor Word Wrap", false),
        automaticSessionStates,
        manualSaveStates,
      };

      const stringifiedDataForChecksum = JSON.stringify(backupData);
      const checksum = await Utils.calculateSHA256(stringifiedDataForChecksum);

      if (!checksum) {
        return { success: false, error: "backup: Failed to compute integrity checksum." };
      }
      backupData.checksum = checksum;

      const backupJsonString = JSON.stringify(backupData, null, 2);
      const defaultFileName = `OopisOS_System_Backup_${currentUser.name}_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

      // --- NATIVE ELECTRON SAVE DIALOG ---
      if (window.electronAPI && typeof window.electronAPI.showSaveDialog === 'function') {
        const filePath = await window.electronAPI.showSaveDialog({
          title: 'Save OopisOS Backup',
          defaultPath: defaultFileName,
          filters: [{ name: 'OopisOS Backup', extensions: ['json'] }]
        });

        if (filePath) {

          const escapedContent = backupJsonString.replace(/'/g, "'\\''");
          const writeResult = await CommandExecutor.processSingleCommand(`echo '${escapedContent}' > "${filePath}"`, { isInteractive: false });

          if (writeResult.success) {
            return { success: true, output: `Backup saved successfully to ${filePath}.`, messageType: Config.CSS_CLASSES.SUCCESS_MSG };
          } else {
            return { success: false, error: `backup: Failed to write to file: ${writeResult.error}` };
          }
        } else {
          return { success: true, output: "Backup cancelled.", messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG };
        }
      }
      else {
        try {
          const blob = new Blob([backupJsonString], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = Utils.createElement("a", { href: url, download: defaultFileName });
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          return {
            success: true,
            output: `${Config.MESSAGES.BACKUP_CREATING_PREFIX}${defaultFileName}${Config.MESSAGES.BACKUP_CREATING_SUFFIX}`,
            messageType: Config.CSS_CLASSES.SUCCESS_MSG,
          };
        } catch (e) {
          return { success: false, error: `backup: Failed to create or download backup file: ${e.message}` };
        }
      }
    },
  };

  const backupDescription = "Creates a secure backup of the current OopisOS system state.";
  const backupHelpText = `Usage: backup

Creates a secure, verifiable backup of the current OopisOS system state.

DESCRIPTION
       The backup command creates a JSON file containing a snapshot of the current
       OopisOS system state. This backup includes an integrity checksum (SHA-256)
       to ensure the file is not corrupted or tampered with. This backup can be
       used to restore the system to a previous state using the 'restore' command.

       When run in the Electron desktop app, it will open a native file save dialog.
       Otherwise, it will trigger a browser download.`;

  CommandRegistry.register("backup", backupCommandDefinition, backupDescription, backupHelpText);
})();