/**
 * @file Defines the 'savefs' command, which manually triggers a save of the entire OopisOS file system
 * to the browser's persistent storage (IndexedDB).
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} savefsCommandDefinition
     * @description The command definition for the 'savefs' command.
     * This object specifies the command's name, argument validation (no arguments expected),
     * and the core logic for explicitly saving the file system.
     */
    const savefsCommandDefinition = {
        commandName: "savefs",
        argValidation: {
            exact: 0, // This command takes no arguments.
        },
        /**
         * The core logic for the 'savefs' command.
         * It calls `FileSystemManager.save()` to persist the current in-memory file system state.
         * It returns a success message if the save operation is successful, or an error message otherwise.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string} context.currentUser - The name of the current user.
         * @returns {Promise<object>} A promise that resolves to a command result object
         * indicating the success or failure of the file system save operation.
         */
        coreLogic: async (context) => {
            const { currentUser } = context;
            // Attempt to save the file system changes.
            // FileSystemManager.save() returns true on success, false on failure (e.g., quota exceeded).
            if (await FileSystemManager.save()) {
                return {
                    success: true,
                    output: `File system for '${currentUser}' saved.`,
                    messageType: Config.CSS_CLASSES.SUCCESS_MSG,
                };
            } else {
                return {
                    success: false,
                    error: "savefs: Failed to save file system.",
                };
            }
        },
    };

    const savefsDescription = "Manually saves the current file system state.";

    const savefsHelpText = `Usage: savefs

Manually save the current state of the file system.

DESCRIPTION
       The savefs command forces an immediate save of the entire OopisOS
       file system to the browser's persistent storage (IndexedDB).

       This command is generally not needed for normal operation, as the
       file system saves automatically after most operations that modify
       it (e.g., creating files, changing permissions). It is primarily
       a tool for debugging or for ensuring data persistence if automatic
       saving is ever disabled or suspected to have failed.`;

    CommandRegistry.register("savefs", savefsCommandDefinition, savefsDescription, savefsHelpText);
})();