(() => {
    "use strict";
    /**
     * @file Defines the 'reset' command, a powerful and destructive command that resets the entire OopisOS system
     * to its factory default state, deleting all user data and configurations.
     * @author Andrew Edmark
     * @author Gemini
     */

    /**
     * @const {object} resetCommandDefinition
     * @description The command definition for the 'reset' command.
     * This object specifies the command's name, argument validation (no arguments expected),
     * and the core logic for performing a full system reset.
     */
    const resetCommandDefinition = {
        commandName: "reset",
        argValidation: {
            exact: 0, // This command takes no arguments.
        },
        /**
         * The core logic for the 'reset' command.
         * It first checks if the command is run in interactive mode, as it requires user confirmation.
         * It presents a strong warning message to the user and awaits confirmation.
         * If confirmed, it delegates the full reset operation to `SessionManager.performFullReset()`,
         * which handles clearing all persistent data.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {object} context.options - Execution options, including `isInteractive` and `scriptingContext`.
         * @returns {Promise<object>} A promise that resolves to a command result object.
         */
        coreLogic: async (context) => {
            const { options } = context;
            // Ensure the command is run in an interactive terminal session.
            if (!options.isInteractive) {
                return {
                    success: false,
                    error: "reset: Can only be run in interactive mode.",
                };
            }

            // Present a strong warning and request confirmation from the user.
            const confirmed = await new Promise((resolve) =>
                ModalManager.request({
                    context: "terminal",
                    messageLines: [
                        "WARNING: This will erase ALL OopisOS data, including all users, file systems, and saved states. This action cannot be undone. Are you sure?",
                    ],
                    onConfirm: () => resolve(true),
                    onCancel: () => resolve(false),
                    options, // Pass options to ModalManager for scripting context awareness.
                })
            );

            // If the user confirms, proceed with the full system reset.
            if (confirmed) {
                await SessionManager.performFullReset(); // Delegates to SessionManager to clear all data.
                return {
                    success: true,
                    output:
                        "OopisOS reset to initial state. Please refresh the page if UI issues persist.",
                    typeClass: Config.CSS_CLASSES.SUCCESS_MSG, // Indicate a successful and critical operation.
                };
            } else {
                // If the user cancels, return a message indicating no action was taken.
                return {
                    success: true,
                    output: `Reset cancelled. ${Config.MESSAGES.NO_ACTION_TAKEN}`,
                    typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG, // Informational message.
                };
            }
        },
    };

    const resetDescription = "Resets the entire OopisOS system to factory defaults.";

    const resetHelpText = `Usage: reset

Resets the entire OopisOS system to its factory default state.

DESCRIPTION
       The reset command is the most powerful and destructive command in
       the system. It erases ALL data associated with OopisOS from your
       browser's storage, including:
       - All user accounts and credentials
       - The entire file system
       - All saved states and aliases

       After running, the system will be as it was when you first
       visited. This is different from 'clearfs', which only clears the
       current user's home directory.

WARNING
       THIS OPERATION IS IRREVERSIBLE AND WILL PERMANENTLY DELETE ALL
       OOPISOS DATA FROM YOUR BROWSER. THE COMMAND WILL PROMPT FOR
       CONFIRMATION BEFORE PROCEEDING.`;

    CommandRegistry.register("reset", resetCommandDefinition, resetDescription, resetHelpText);
})();