// scripts/commands/pwd.js

(() => {
    "use strict";

    const pwdCommandDefinition = {
        commandName: "pwd",
        argValidation: {
            exact: 0,
        },
        coreLogic: async () => {
            return {
                success: true,
                output: FileSystemManager.getCurrentPath(),
            };
        },
    };

    const pwdDescription = "Displays the current working directory.";
    const pwdHelpText = "Usage: pwd";

    CommandRegistry.register("pwd", pwdCommandDefinition, pwdDescription, pwdHelpText);
})();