// scripts/commands/savestate.js
(() => {
    "use strict";

    const savestateCommandDefinition = {
        commandName: "savestate",
        argValidation: {
            exact: 0,
        },

        coreLogic: async () => {
            try {
                const result = await SessionManager.saveManualState();

                if (result.success) {
                    return {
                        success: true,
                        output: result.message,
                    };
                } else {
                    return {
                        success: false,
                        error: result.error,
                    };
                }
            } catch (e) {
                return { success: false, error: `savestate: An unexpected error occurred: ${e.message}` };
            }
        },
    };

    const savestateDescription = "Manually saves a snapshot of the current session.";

    const savestateHelpText = `Usage: savestate

Manually save a snapshot of the current session and file system.

DESCRIPTION
       The savestate command creates a snapshot of the current OopisOS
       environment for the active user. This snapshot includes:
       - The entire file system at the moment of saving.
       - The current state of the terminal screen.
       - The complete command history.

       This saved state can be restored later using the 'loadstate'
       command. Each user has their own separate saved state.
       Running 'savestate' will overwrite any previously saved state
       for the current user.`;

    CommandRegistry.register("savestate", savestateCommandDefinition, savestateDescription, savestateHelpText);
})();