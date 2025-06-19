// scripts/commands/check_fail.js

(() => {
    "use strict";
    const check_failCommandDefinition = {
        commandName: "check_fail",
        argValidation: {
            exact: 1,
            error: "expects exactly one argument (a command string)",
        },
        coreLogic: async (context) => {
            const { args } = context;
            const commandToTest = args[0];
            if (typeof commandToTest !== "string" || commandToTest.trim() === "") {
                return {
                    success: false,
                    error: "check_fail: command string argument cannot be empty",
                };
            }
            const testResult = await CommandExecutor.processSingleCommand(
                commandToTest,
                false
            );
            if (testResult.success) {
                const failureMessage = `CHECK_FAIL: FAILURE - Command <${commandToTest}> unexpectedly SUCCEEDED.`;
                return {
                    success: false,
                    error: failureMessage,
                };
            } else {
                const successMessage = `CHECK_FAIL: SUCCESS - Command <${commandToTest}> failed as expected. (Error: ${
                    testResult.error || "N/A"
                })`;
                return {
                    success: true,
                    output: successMessage,
                };
            }
        },
    };
    const check_failDescription = "Checks that a command fails as expected.";
    const check_failHelpText = "Usage: check_fail <command_string>";
    CommandRegistry.register("check_fail", check_failCommandDefinition, check_failDescription, check_failHelpText);

})();