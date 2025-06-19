// scripts/commands/login.js

(() => {
    "use strict";
    const loginCommandDefinition = {
        commandName: "login",
        completionType: "users",
        argValidation: {
            min: 1,
            max: 2,
            error: "Usage: login <username> [password]",
        },
        coreLogic: async (context) => {
            const { args, options } = context;
            const username = args[0];
            const providedPassword = args.length === 2 ? args[1] : null;

            const result = await UserManager.login(username, providedPassword, options);
            if (result.success && result.isLogin) {
                OutputManager.clearOutput();
                await OutputManager.appendToOutput(`${Config.MESSAGES.WELCOME_PREFIX} ${username}${Config.MESSAGES.WELCOME_SUFFIX}`);
            }

            return {
                success: result.success,
                output: result.noAction ? result.message : null,
                error: result.success ? null : result.error,
                messageType: result.noAction ? Config.CSS_CLASSES.CONSOLE_LOG_MSG : (result.success ? Config.CSS_CLASSES.SUCCESS_MSG : Config.CSS_CLASSES.ERROR_MSG)
            };
        },
    };
    const loginDescription = "Logs in as a user, starting a new session stack.";
    const loginHelpText = "Usage: login <username> [password]\n\nLogs in as the specified user. This will clear any existing user session stack (e.g., from 'su') and start a fresh session.";
    CommandRegistry.register("login", loginCommandDefinition, loginDescription, loginHelpText);
})();