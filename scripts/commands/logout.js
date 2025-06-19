// scripts/commands/logout.js

(() => {
    "use strict";
    const logoutCommandDefinition = {
        commandName: "logout",
        argValidation: {
            exact: 0,
        },
        coreLogic: async () => {
            const result = await UserManager.logout();
            if (result.success && !result.noAction) {
                OutputManager.clearOutput();
                await OutputManager.appendToOutput(
                    `${Config.MESSAGES.WELCOME_PREFIX} ${
                        UserManager.getCurrentUser().name
                    }${Config.MESSAGES.WELCOME_SUFFIX}`
                );
            }
            return {
                ...result,
                output: result.message,
                messageType: result.success
                    ? Config.CSS_CLASSES.SUCCESS_MSG
                    : Config.CSS_CLASSES.CONSOLE_LOG_MSG,
            };
        },
    };
    const logoutDescription = "Logs out the current user.";
    const logoutHelpText = "Usage: logout";
    CommandRegistry.register("logout", logoutCommandDefinition, logoutDescription, logoutHelpText);
})();