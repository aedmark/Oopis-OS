/**
 * @file Defines the 'loadstate' command, which restores the last manually saved session state for the current user.
 * This includes the file system, terminal output, and command history.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} loadstateCommandDefinition
     * @description The command definition for the 'loadstate' command.
     * This object specifies the command's name, argument validation (no arguments expected),
     * and the core logic for loading a manually saved session.
     */
    const loadstateCommandDefinition = {
        commandName: "loadstate",
        argValidation: {
            exact: 0, // This command takes no arguments.
        },
        /**
         * The core logic for the 'loadstate' command.
         * It delegates the actual loading process to `SessionManager.loadManualState()`.
         * This function is responsible for initiating a confirmation prompt to the user
         * before proceeding with the potentially destructive load operation.
         * The result from `SessionManager.loadManualState()` is then formatted and returned.
         * @async
         * @returns {Promise<object>} A promise that resolves to a command result object
         * indicating whether the state loading was successful, a confirmation was requested,
         * or if an error occurred.
         */
        coreLogic: async () => {
            // Delegate the state loading to the SessionManager.
            // The SessionManager handles the interactive confirmation prompt.
            const result = await SessionManager.loadManualState();
            return {
                success: result.success,
                output: result.message, // Contains message about success, cancellation, or error.
                error: result.success
                    ? undefined // No error if successful.
                    : result.message || "Failed to load state.", // Use message as error if unsuccessful.
                messageType: result.success
                    ? Config.CSS_CLASSES.CONSOLE_LOG_MSG // Informational message for success/cancellation.
                    : Config.CSS_CLASSES.ERROR_MSG, // Error styling for failure.
            };
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