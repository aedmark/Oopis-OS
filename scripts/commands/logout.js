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
            if (result.success && result.isLogout) {
                OutputManager.clearOutput();
                await OutputManager.appendToOutput(`${Config.MESSAGES.WELCOME_PREFIX} ${result.newUser}${Config.MESSAGES.WELCOME_SUFFIX}`);
            }
            return {
                ...result,
                output: result.message,
                messageType: result.noAction ? Config.CSS_CLASSES.CONSOLE_LOG_MSG : (result.success ? Config.CSS_CLASSES.SUCCESS_MSG : Config.CSS_CLASSES.ERROR_MSG)
            };
        },
    };
    const logoutDescription = "Logs out the current user, returning to the previous session.";
    const logoutHelpText = "Usage: logout\n\nEnds the current user session and returns to the previous user in the session stack (e.g., after using 'su').";
    CommandRegistry.register("logout", logoutCommandDefinition, logoutDescription, logoutHelpText);
})();