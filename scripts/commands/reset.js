/**
 * @file Defines the 'reset' command, a powerful and destructive command that resets the entire OopisOS system
 * to its factory default state, deleting all user data, configurations, and cached files.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    const resetCommandDefinition = {
        commandName: "reset",
        argValidation: {
            exact: 0, // This command takes no arguments.
        },
        coreLogic: async (context) => {
            const { options } = context;
            // This command is too destructive for non-interactive scripts.
            if (!options.isInteractive) {
                return {
                    success: false,
                    error: "reset: Can only be run in interactive mode.",
                };
            }

            // Request confirmation from the user due to the destructive nature of the command.
            const confirmed = await new Promise((resolve) =>
                ModalManager.request({
                    context: "terminal",
                    messageLines: [
                        "WARNING: This will erase ALL OopisOS data, including users, files, saved states, and cached application data. This action cannot be undone. Are you sure?",
                    ],
                    onConfirm: () => resolve(true),
                    onCancel: () => resolve(false),
                    options,
                })
            );

            if (confirmed) {
                let cacheCleared = false;
                // Attempt to clear the browser's cache storage for the site.
                if ('caches' in window) {
                    try {
                        const keys = await caches.keys();
                        await Promise.all(keys.map(key => caches.delete(key)));
                        // Use OutputManager instead of term.writeln
                        await OutputManager.appendToOutput("Cache storage cleared successfully.");
                        cacheCleared = true;
                    } catch (error) {
                        // Use OutputManager instead of term.writeln
                        await OutputManager.appendToOutput(`Warning: Could not clear cache storage: ${error.message}`, { typeClass: Config.CSS_CLASSES.WARNING_MSG });
                    }
                }

                // Perform the main OS reset (clearing IndexedDB, etc.).
                await SessionManager.performFullReset();

                const outputMessage = cacheCleared
                    ? "OopisOS reset to initial state. Cache storage cleared. Please refresh the page."
                    : "OopisOS reset to initial state. Please refresh the page if UI issues persist.";

                return {
                    success: true,
                    output: outputMessage,
                    messageType: Config.CSS_CLASSES.SUCCESS_MSG,
                };
            } else {
                // User cancelled the operation.
                return {
                    success: true,
                    output: `Reset cancelled. ${Config.MESSAGES.NO_ACTION_TAKEN}`,
                    messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                };
            }
        },
    };

    const resetDescription = "Resets the entire OopisOS system to factory defaults and clears caches.";

    const resetHelpText = `Usage: reset

Resets the entire OopisOS system to its factory default state.

DESCRIPTION
       The reset command is the most powerful and destructive command in
       the system. It erases ALL data associated with OopisOS from your
       browser's storage, including:
       - All user accounts and credentials
       - The entire file system
       - All saved states and aliases
       - All cached application data (from the service worker)

       After running, the system will be as it was when you first
       visited. This is different from 'clearfs', which only clears the
       current user's file system.

WARNING
       THIS OPERATION IS IRREVERSIBLE AND WILL PERMANENTLY DELETE ALL
       DATA FROM YOUR BROWSER. THE COMMAND WILL PROMPT FOR
       CONFIRMATION BEFORE PROCEEDING.`;

    CommandRegistry.register("reset", resetCommandDefinition, resetDescription, resetHelpText);
})();
