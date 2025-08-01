// scripts/commands/check_fail.js

window.CheckFailCommand = class CheckFailCommand extends Command {
  constructor() {
    super({
      commandName: "check_fail",
      description: "Checks command failure or empty output (for testing).",
      helpText: `Usage: check_fail [-z] "<command_string>"
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
      This will succeed, because echoing an unset variable produces no output.`,
      flagDefinitions: [{ name: "z", short: "-z" }],
    });
  }

  async coreLogic(context) {
    const { args, options, flags, dependencies } = context;
    const { CommandExecutor, ErrorHandler } = dependencies;
    const commandToTest = args.join(" ");
    const checkEmptyOutput = flags.z;

    try {
      if (typeof commandToTest !== "string" || commandToTest.trim() === "") {
        return ErrorHandler.createError(
            "check_fail: command string argument cannot be empty"
        );
      }

      const testResult = await CommandExecutor.processSingleCommand(
          commandToTest,
          { ...options, isInteractive: false }
      );

      if (checkEmptyOutput) {
        const outputIsEmpty =
            !testResult.output || testResult.output.trim() === "";
        if (outputIsEmpty) {
          return ErrorHandler.createSuccess(
              `CHECK_FAIL: SUCCESS - Command <${commandToTest}> produced empty output as expected.`
          );
        } else {
          return ErrorHandler.createError(
              `CHECK_FAIL: FAILURE - Command <${commandToTest}> did NOT produce empty output.`
          );
        }
      } else {
        if (testResult.success) {
          const failureMessage = `CHECK_FAIL: FAILURE - Command <${commandToTest}> unexpectedly SUCCEEDED.`;
          return ErrorHandler.createError(failureMessage);
        } else {
          const successMessage = `CHECK_FAIL: SUCCESS - Command <${commandToTest}> failed as expected. (Error: ${testResult.error || "N/A"})`;
          return ErrorHandler.createSuccess(successMessage);
        }
      }
    } catch (e) {
      return ErrorHandler.createError(
          `check_fail: An unexpected error occurred: ${e.message}`
      );
    }
  }
}

window.CommandRegistry.register(new CheckFailCommand());
