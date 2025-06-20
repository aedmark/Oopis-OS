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

    const check_failDescription = "Checks that a command fails as expected (for testing).";

    const check_failHelpText = `Usage: check_fail "<command_string>"

Checks that a command fails as expected, for testing purposes.

DESCRIPTION
       The check_fail command executes the <command_string> provided to it.
       It is a specialized tool used almost exclusively within testing scripts
       like 'diag.sh'.

       Its purpose is to verify that OopisOS commands correctly generate
       errors under invalid conditions.

       - If the enclosed command SUCCEEDS, check_fail will report a FAILURE.
       - If the enclosed command FAILS, check_fail will report a SUCCESS.

       The <command_string> must be enclosed in quotes if it contains spaces.

EXAMPLES
       check_fail "mkdir /nonexistent_parent/new_dir"
              This will succeed, because the 'mkdir' command is expected
              to fail when its parent directory does not exist.

       check_fail "echo 'this will succeed'"
              This will fail, because the 'echo' command is expected
              to succeed.`;

    CommandRegistry.register("check_fail", check_failCommandDefinition, check_failDescription, check_failHelpText);
})();