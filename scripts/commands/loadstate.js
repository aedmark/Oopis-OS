// scripts/commands/loadstate.js
(() => {
    "use strict";

    const loadstateCommandDefinition = {
        commandName: "loadstate",
        argValidation: {
            exact: 0,
        },

        coreLogic: async () => {
            try {
                const result = await SessionManager.loadManualState();
                return {
                    success: result.success,
                    output: result.message,
                    error: result.success
                        ? undefined
                        : result.message || "Failed to load state.",
                };
            } catch (e) {
                return { success: false, error: `loadstate: An unexpected error occurred: ${e.message}` };
            }
        },
    };

    const loadstateDescription = "Loads the last manually saved session state.";

    const loadstateHelpText = `Usage: loadstate

Load the last manually saved session state for the current user.

DESCRIPTION
       The loadstate command restores the OopisOS environment to the
       last state that was explicitly saved using the 'savestate'
       command.

       This includes the entire file system, the state of the terminal
       screen, and command history at the moment 'savestate' was run.
       It only loads the state for the currently active user.

WARNING
       This operation is destructive and will overwrite your current
       file system and session with the saved data. The command will
       prompt for confirmation before proceeding.`;

    CommandRegistry.register("loadstate", loadstateCommandDefinition, loadstateDescription, loadstateHelpText);
})();