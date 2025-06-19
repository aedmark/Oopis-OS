// scripts/commands/savestate.js

(() => {
    "use strict";
    const savestateCommandDefinition = {
        commandName: "savestate",
        argValidation: {
            exact: 0,
        },
        coreLogic: async () => {
            const result = await SessionManager.saveManualState();
            if (result.success) {
                return {
                    success: true,
                    output: result.message,
                    messageType: Config.CSS_CLASSES.SUCCESS_MSG,
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    messageType: Config.CSS_CLASSES.ERROR_MSG,
                };
            }
        },
    };
    const savestateDescription = "Saves the current session state.";
    const savestateHelpText = "Usage: savestate";
    CommandRegistry.register("savestate", savestateCommandDefinition, savestateDescription, savestateHelpText);
})();