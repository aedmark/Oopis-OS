(() => {
    "use strict";
    /**
     * @file Defines the 'savestate' command, which manually saves a snapshot of the current user's session state.
     * This snapshot includes the file system, terminal output, and command history.
     * @author Andrew Edmark
     * @author Gemini
     */

    /**
     * @const {object} savestateCommandDefinition
     * @description The command definition for the 'savestate' command.
     * This object specifies the command's name, argument validation (no arguments expected),
     * and the core logic for manually saving the current session.
     */
    const savestateCommandDefinition = {
        commandName: "savestate",
        argValidation: {
            exact: 0, // This command takes no arguments.
        },
        /**
         * The core logic for the 'savestate' command.
         * It delegates the session saving process to `SessionManager.saveManualState()`.
         * It returns a success message if the save operation is successful, or an error message otherwise.
         * @async
         * @returns {Promise<object>} A promise that resolves to a command result object
         * indicating the success or failure of the session save operation.
         */
        coreLogic: async () => {
            // Delegate the state saving to the SessionManager.
            const result = await SessionManager.saveManualState();

            // Return the result of the save operation, formatting output and error messages.
            if (result.success) {
                return {
                    success: true,
                    output: result.message, // Contains the success message from SessionManager.
                    messageType: Config.CSS_CLASSES.SUCCESS_MSG,
                };
            } else {
                return {
                    success: false,
                    error: result.error, // Contains the error message from SessionManager.
                    messageType: Config.CSS_CLASSES.ERROR_MSG,
                };
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