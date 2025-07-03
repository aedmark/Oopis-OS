/**
 * @file Defines the 'backup' command, which creates a comprehensive backup of the entire
 * OopisOS system state, including all users, files, and settings, into a downloadable JSON file.
 * This version adds a checksum for data integrity verification.
 * @author Andrew Edmark
 * @author Gemini
 */
(() => {
  "use strict";

  /**
   * @const {object} backupCommandDefinition
   * @description The command definition for the 'backup' command.
   * This object specifies the command's name, argument validation, and the core logic
   * for creating and triggering the download of a full system state backup with an integrity checksum.
   */
  const backupCommandDefinition = {
    commandName: "backup",
    argValidation: {
      exact: 0, // This command takes no arguments.
    },
    /**
     * The core logic for the 'backup' command. It gathers all persisted data from
     * localStorage and IndexedDB, calculates a SHA-256 checksum of this data,
     * bundles it all into a single JSON object, and initiates a browser download for the user.
     * @async
     * @returns {Promise<object>} A promise that resolves to a command result object.
     */
    coreLogic: async () => {
      const currentUser = UserManager.getCurrentUser();
      const allKeys = StorageManager.getAllLocalStorageKeys();
      const automaticSessionStates = {};
      const manualSaveStates = {};

      // Gather all session state keys from localStorage.
      allKeys.forEach((key) => {
        if (key.startsWith(Config.STORAGE_KEYS.USER_TERMINAL_STATE_PREFIX)) {
          automaticSessionStates[key] = StorageManager.loadItem(key);
        } else if (
            key.startsWith(Config.STORAGE_KEYS.MANUAL_TERMINAL_STATE_PREFIX)
        ) {
          manualSaveStates[key] = StorageManager.loadItem(key);
        }
      });

      // Construct the comprehensive backup object, initially without the checksum.
      const backupData = {
        dataType: "OopisOS_System_State_Backup_v3.2", // For validation during restore.
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
        automaticSessionStates: automaticSessionStates,
        manualSaveStates: manualSaveStates,
        // The checksum will be added here after calculation.
      };

      // Calculate checksum on the data *before* the checksum field is added.
      // Stringify without indentation for a consistent hash.
      const stringifiedDataForChecksum = JSON.stringify(backupData);
      const checksum = await Utils.calculateSHA256(stringifiedDataForChecksum);

      if (!checksum) {
        return { success: false, error: "backup: Failed to compute integrity checksum." };
      }

      // Add the checksum to the final backup object.
      backupData.checksum = checksum;

      const fileName = `OopisOS_System_Backup_${currentUser.name}_${new Date()
          .toISOString()
          .replace(/[:.]/g, "-")}.json`;

      try {
        // Create a Blob from the final JSON data (with checksum) and trigger a download.
        // Stringify with indentation for human readability.
        const blob = new Blob([JSON.stringify(backupData, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = Utils.createElement("a", {
          href: url,
          download: fileName,
        });
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return {
          success: true,
          output: `${Config.MESSAGES.BACKUP_CREATING_PREFIX}${fileName}${Config.MESSAGES.BACKUP_CREATING_SUFFIX}`,
          messageType: Config.CSS_CLASSES.SUCCESS_MSG,
        };
      } catch (e) {
        return {
          success: false,
          error: `backup: Failed to create or download backup file: ${e.message}`,
        };
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

EXAMPLES
       backup
              Triggers a download of a JSON file containing a snapshot of the filesystem.`;

  // Register the command with the system.
  CommandRegistry.register("backup", backupCommandDefinition, backupDescription, backupHelpText);
})();