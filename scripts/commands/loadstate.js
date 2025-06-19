// scripts/commands/loadstate.js

(() => {
    "use strict";
    const loadstateCommandDefinition = {
        commandName: "loadstate",
        argValidation: {
            exact: 0,
        },
        coreLogic: async () => {
            const result = await SessionManager.loadManualState();
            return {
                success: result.success,
                output: result.message,
                error: result.success
                    ? undefined
                    : result.message || "Failed to load state.",
                messageType: result.success
                    ? Config.CSS_CLASSES.CONSOLE_LOG_MSG
                    : Config.CSS_CLASSES.ERROR_MSG,
            };
        },
    };
    const loadstateDescription = "Loads the last saved session state.";
    const loadstateHelpText = "Usage: loadstate";
    CommandRegistry.register("loadstate", loadstateCommandDefinition, loadstateDescription, loadstateHelpText);
})();