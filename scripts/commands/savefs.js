// scripts/commands/savefs.js

(() => {
    "use strict";
    const savefsCommandDefinition = {
        commandName: "savefs",
        argValidation: {
            exact: 0,
        },
        coreLogic: async (context) => {
            const { currentUser } = context;
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