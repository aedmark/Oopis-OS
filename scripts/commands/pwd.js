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

    const pwdDescription = "Prints the current working directory.";

    const pwdHelpText = `Usage: pwd

Print the full path of the current working directory.

DESCRIPTION
       The pwd (print working directory) command writes the full, absolute
       pathname of the current working directory to the standard output.`;

    CommandRegistry.register("pwd", pwdCommandDefinition, pwdDescription, pwdHelpText);
})();