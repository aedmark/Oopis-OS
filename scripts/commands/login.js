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

    const loginDescription = "Logs in as a user, starting a new session.";

    const loginHelpText = `Usage: login <username> [password]

Log in as a user and start a new session.

DESCRIPTION
       The login command starts a new session for the specified <username>.
       If the user account has a password, and one is not provided in the
       command, the system will prompt for it.

       Unlike the 'su' command which stacks user sessions, 'login'
       clears any existing session stack and starts a fresh one. This
       means any active 'su' sessions will be terminated.

EXAMPLES
       login root
              Prompts for the root user's password and logs in.
       login Guest
              Logs in as the Guest user (no password required).`;

    CommandRegistry.register("login", loginCommandDefinition, loginDescription, loginHelpText);
})();