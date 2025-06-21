/**
 * @file Defines the 'backup' command, which creates a comprehensive backup of the entire
 * OopisOS system state, including all users, files, and settings, into a downloadable JSON file.
 * @author Andrew Edmark
 * @author Gemini
 */
(() => {
  "use strict";

  /**
   * @const {object} backupCommandDefinition
   * @description The command definition for the 'backup' command.
   * This object specifies the command's name, argument validation, and the core logic
   * for creating and triggering the download of a full system state backup.
   */
  const backupCommandDefinition = {
    commandName: "backup",
    argValidation: {
      exact: 0, // This command takes no arguments.
    },
    /**
     * The core logic for the 'backup' command. It gathers all persisted data from
     * localStorage (user credentials, session states, settings) and IndexedDB (the file system),
     * bundles it into a single JSON object, and initiates a browser download for the user.
     * @async
     * @param {object} context - The context object provided by the command executor. (Not used in this command but part of the standard signature).
     * @returns {Promise<object>} A promise that resolves to a command result object,
     * indicating the success or failure of the backup operation.
     */
    coreLogic: async (context) => {
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

      // Construct the comprehensive backup object.
      const backupData = {
        dataType: "OopisOS_System_State_Backup_v2.3", // For validation during restore.
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
      };

      const fileName = `OopisOS_System_Backup_${currentUser.name}_${new Date()
          .toISOString()
          .replace(/[:.]/g, "-")}.json`;

      try {
        // Create a Blob from the JSON data and trigger a download.
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

  const backupDescription = "Creates a backup of the current OopisOS system state.";
  const backupHelpText = `Usage: backup

Creates a backup of the current OopisOS system state.

DESCRIPTION
       The backup command creates a JSON file containing a snapshot of the current
       OopisOS system state. This backup can be used to restore the system
       to a previous state using the 'restore' command.

EXAMPLES
       backup
              Triggers a download of a JSON file containing a snapshot of the filesystem.`;

  // Register the command with the system.
  CommandRegistry.register("backup", backupCommandDefinition, backupDescription, backupHelpText);
})();