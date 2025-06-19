// scripts/commands/reset.js

(() => {
    "use strict";
    const resetCommandDefinition = {
        commandName: "reset",
        argValidation: {
            exact: 0,
        },
        coreLogic: async (context) => {
            const { options } = context;
            if (!options.isInteractive) {
                return {
                    success: false,
                    error: "reset: Can only be run in interactive mode.",
                };
            }
            const confirmed = await new Promise((resolve) =>
                ModalManager.request({
                    context: "terminal",
                    messageLines: [
                        "WARNING: This will erase ALL OopisOS data, including all users, file systems, and saved states. This action cannot be undone. Are you sure?",
                    ],
                    onConfirm: () => resolve(true),
                    onCancel: () => resolve(false),
                    options,
                })
            );
            if (confirmed) {
                await SessionManager.performFullReset();
                return {
                    success: true,
                    output:
                        "OopisOS reset to initial state. Please refresh the page if UI issues persist.",
                    messageType: Config.CSS_CLASSES.SUCCESS_MSG,
                };
            } else {
                return {
                    success: true,
                    output: `Reset cancelled. ${Config.MESSAGES.NO_ACTION_TAKEN}`,
                    messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                };
            }
        },
    };
    const resetDescription = "Resets OopisOS to its initial state.";
    const resetHelpText = "Usage: reset";
    CommandRegistry.register("reset", resetCommandDefinition, resetDescription, resetHelpText);
})();