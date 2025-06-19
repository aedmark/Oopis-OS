// scripts/commands/su.js

(() => {
    "use strict";
    const suCommandDefinition = {
        commandName: "su",
        completionType: "users",
        argValidation: {
            max: 1,
        },
        coreLogic: async (context) => {
            const { args, currentUser, options } = context;
            const targetUser = args.length > 0 ? args[0] : "root";
            if (currentUser === targetUser) {
                return {
                    success: true,
                    output: `Already user '${currentUser}'.`,
                    messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                };
            }
            return _handleUserSwitch("su", targetUser, null, options);
        },
    };
    const suDescription = "Switches to a different user.";
    const suHelpText = "Usage: su [username]\n\nSwitches to the specified [username].";
    CommandRegistry.register("su", suCommandDefinition, suDescription, suHelpText);
})();