// scripts/commands/logout.js
(() => {
    "use strict";

    const logoutCommandDefinition = {
        commandName: "logout",
        argValidation: {
            exact: 0,
        },

        coreLogic: async () => {
            try {
                const result = await UserManager.logout();

                if (result.success && result.isLogout) {
                    OutputManager.clearOutput();
                    await OutputManager.appendToOutput(`${Config.MESSAGES.WELCOME_PREFIX} ${result.newUser}${Config.MESSAGES.WELCOME_SUFFIX}`);
                }

                return {
                    ...result,
                    output: result.noAction ? result.message : null,
                    error: result.success ? null : result.error,
                };
            } catch (e) {
                return { success: false, error: `logout: An unexpected error occurred: ${e.message}` };
            }
        },
    };

    const logoutDescription = "Logs out of the current user session.";

    const logoutHelpText = `Usage: logout

Log out of the current user session.

DESCRIPTION
       The logout command terminates the current user's session and returns
       to the session of the previous user in the stack.

       This command is the counterpart to 'su'. If you use 'su' to become
       another user, 'logout' will return you to your original user session.

       If there is no previous session in the stack (i.e., you are in the
       initial session started with 'login'), logout will do nothing.

EXAMPLES
       su root
              (Enter password)
              ... perform actions as root ...
       logout
              Returns to the original user's session.`;

    CommandRegistry.register("logout", logoutCommandDefinition, logoutDescription, logoutHelpText);
})();