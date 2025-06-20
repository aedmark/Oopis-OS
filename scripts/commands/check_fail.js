// scripts/commands/check_fail.js

/**
 * @file Defines the 'check_fail' command, a diagnostic tool used to verify that
 * other commands correctly produce an error when expected.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} check_failCommandDefinition
     * @description The command definition for the 'check_fail' command.
     * This command is designed for testing purposes within scripts, asserting
     * that a given command string will fail its execution.
     */
    const check_failCommandDefinition = {
        commandName: "check_fail",
        argValidation: {
            exact: 1,
            error: "expects exactly one argument (a command string)",
        },
        /**
         * The core logic for the 'check_fail' command.
         * It executes a provided command string in a non-interactive mode.
         * If the executed command fails (as expected), `check_fail` reports success.
         * If the executed command unexpectedly succeeds, `check_fail` reports failure.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command. Expected to contain a single command string to test.
         * @returns {Promise<object>} A promise that resolves to a command result object, indicating
         * whether the tested command failed as expected.
         */
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