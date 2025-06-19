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
            return _handleUserSwitch("login", username, providedPassword, options);
        },
    };
    const loginDescription = "Logs in as a user.";
    const loginHelpText = "Usage: login <username> [password]\n\nLogs in as the specified [username] with the specified [password].";
    CommandRegistry.register("login", loginCommandDefinition, loginDescription, loginHelpText);
})();