// scripts/commands/su.js

(() => {
    "use strict";
    const suCommandDefinition = {
        commandName: "su",
        completionType: "users",
        argValidation: {
            max: 2, // Allow `su` and `su <user>` and `su <user> <pass>`
        },
        coreLogic: async (context) => {
            const { args, options } = context;
            const targetUser = args.length > 0 ? args[0] : "root";
            const providedPassword = args.length > 1 ? args[1] : null;

            const result = await UserManager.su(targetUser, providedPassword, options);

            if (result.success && !result.noAction) {
                OutputManager.clearOutput();
                await OutputManager.appendToOutput(`${Config.MESSAGES.WELCOME_PREFIX} ${targetUser}${Config.MESSAGES.WELCOME_SUFFIX}`);
            }

            return {
                success: result.success,
                output: result.noAction ? result.message : null,
                error: result.success ? null : result.error,
                messageType: result.noAction ? Config.CSS_CLASSES.CONSOLE_LOG_MSG : (result.success ? Config.CSS_CLASSES.SUCCESS_MSG : Config.CSS_CLASSES.ERROR_MSG)
            };
        },
    };
    const suDescription = "Switches to a different user, stacking the session.";
    const suHelpText = "Usage: su [username] [password]\n\nSwitches to the specified user (defaults to root). The new session is stacked on top of the old one. Use 'logout' to return.";
    CommandRegistry.register("su", suCommandDefinition, suDescription, suHelpText);
})();