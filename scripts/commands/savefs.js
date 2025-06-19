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
    const savefsDescription = "Saves the current file system.";
    const savefsHelpText = "Usage: savefs";
    CommandRegistry.register("savefs", savefsCommandDefinition, savefsDescription, savefsHelpText);
})();