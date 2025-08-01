// scripts/commands/reset.js

window.ResetCommand = class ResetCommand extends Command {
    constructor() {
        super({
            commandName: "reset",
            description:
                "Resets the entire OopisOS system to factory defaults and clears caches.",
            helpText: `Usage: reset
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
      CONFIRMATION BEFORE PROCEEDING.`,
            argValidation: {
                exact: 0,
            },
        });
    }

    async coreLogic(context) {
        const { options, dependencies } = context;
        const { ModalManager, SessionManager, OutputManager, Config, ErrorHandler } = dependencies;

        if (!options.isInteractive) {
            return ErrorHandler.createError(
                "reset: Can only be run in interactive mode."
            );
        }

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
            if ("caches" in window) {
                try {
                    const keys = await caches.keys();
                    await Promise.all(keys.map((key) => caches.delete(key)));
                    await OutputManager.appendToOutput(
                        "Cache storage cleared successfully."
                    );
                    cacheCleared = true;
                } catch (error) {
                    await OutputManager.appendToOutput(
                        `Warning: Could not clear cache storage: ${error.message}`,
                        { typeClass: Config.CSS_CLASSES.WARNING_MSG }
                    );
                }
            }

            await SessionManager.performFullReset();

            const outputMessage = cacheCleared
                ? "OopisOS reset to initial state. Cache storage cleared. Please refresh the page."
                : "OopisOS reset to initial state. Please refresh the page if UI issues persist.";

            return ErrorHandler.createSuccess(outputMessage);
        } else {
            return ErrorHandler.createSuccess(
                `Reset cancelled. ${Config.MESSAGES.NO_ACTION_TAKEN}`
            );
        }
    }
}

window.CommandRegistry.register(new ResetCommand());
