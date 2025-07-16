// scripts/commands/check_fail.js
(() => {
    "use strict";

    const check_failCommandDefinition = {
        commandName: "check_fail",
        coreLogic: async (context) => {
            const { args, options } = context;
            let commandToTest;
            let checkEmptyOutput = false;

            try {
                if (args[0] === '-z') {
                    checkEmptyOutput = true;
                    commandToTest = args.slice(1).join(' ');
                } else {
                    commandToTest = args.join(' ');
                }

                if (typeof commandToTest !== "string" || commandToTest.trim() === "") {
                    return {
                        success: false,
                        error: "check_fail: command string argument cannot be empty",
                    };
                }

                const testResult = await CommandExecutor.processSingleCommand(
                    commandToTest,
                    { ...options, isInteractive: false }
                );

                if (checkEmptyOutput) {
                    const outputIsEmpty = !testResult.output || testResult.output.trim() === '';
                    if (outputIsEmpty) {
                        return { success: true, output: `CHECK_FAIL: SUCCESS - Command <${commandToTest}> produced empty output as expected.` };
                    } else {
                        return { success: false, error: `CHECK_FAIL: FAILURE - Command <${commandToTest}> did NOT produce empty output.` };
                    }
                } else {
                    if (testResult.success) {
                        const failureMessage = `CHECK_FAIL: FAILURE - Command <${commandToTest}> unexpectedly SUCCEEDED.`;
                        return {
                            success: false,
                            error: failureMessage,
                        };
                    } else {
                        const successMessage = `CHECK_FAIL: SUCCESS - Command <${commandToTest}> failed as expected. (Error: ${testResult.error || "N/A"
                        })`;
                        return {
                            success: true,
                            output: successMessage,
                        };
                    }
                }
            } catch (e) {
                return { success: false, error: `check_fail: An unexpected error occurred: ${e.message}` };
            }
        },
    };

    const check_failDescription = "Checks command failure or empty output (for testing).";
    const check_failHelpText = `Usage: check_fail [-z] "<command_string>"

Checks test conditions for a command, for testing purposes.

DESCRIPTION
       The check_fail command executes the <command_string> and evaluates its result.
       It is a specialized tool used almost exclusively within testing scripts like 'diag.sh'.

MODES
       Default Mode:
       - If the enclosed command SUCCEEDS, check_fail will report a FAILURE.
       - If the enclosed command FAILS, check_fail will report a SUCCESS.

       -z Flag Mode:
       - If the enclosed command produces EMPTY output, check_fail will report SUCCESS.
       - If the enclosed command produces ANY output, check_fail will report FAILURE.

       The <command_string> must be enclosed in quotes if it contains spaces.

EXAMPLES
       check_fail "mkdir /nonexistent_parent/new_dir"
              This will succeed, because 'mkdir' is expected to fail.

       check_fail -z "echo $UNSET_VARIABLE"
              This will succeed, because echoing an unset variable produces no output.`;

    CommandRegistry.register("check_fail", check_failCommandDefinition, check_failDescription, check_failHelpText);
})();