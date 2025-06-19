// scripts/command_utils.js

const CommandUtils = (() => {
  "use strict";

  async function _handleUserSwitch(commandName, targetUser, providedPassword, options = {}) {
    // This promise-based approach ensures the command executor correctly awaits
    // the result of the entire, possibly interactive, login process.
    return new Promise(async (resolve) => {
      const initialLoginAttempt = await UserManager.login(
          targetUser,
          providedPassword
      );

      if (initialLoginAttempt.requiresPasswordPrompt) {
        // If a password is required but wasn't provided, open the modal.
        ModalInputManager.requestInput(
            Config.MESSAGES.PASSWORD_PROMPT,
            async (password) => {
              // User entered a password in the modal. Retry the login.
              const finalLoginResult = await UserManager.login(
                  targetUser,
                  password
              );
              if (finalLoginResult.success && !finalLoginResult.noAction) {
                OutputManager.clearOutput();
                const welcomeMsg =
                    commandName === "login"
                        ? `${Config.MESSAGES.WELCOME_PREFIX} ${targetUser}${Config.MESSAGES.WELCOME_SUFFIX}`
                        : `Switched to user: ${targetUser}`;
                await OutputManager.appendToOutput(welcomeMsg);
              }
              resolve({
                success: finalLoginResult.success,
                output: finalLoginResult.message,
                error: finalLoginResult.success
                    ? undefined
                    : finalLoginResult.error || "Login failed.",
                messageType: finalLoginResult.success
                    ? Config.CSS_CLASSES.SUCCESS_MSG
                    : Config.CSS_CLASSES.ERROR_MSG,
              });
            },
            () => {
              // User cancelled the password prompt.
              resolve({
                success: true,
                output: Config.MESSAGES.OPERATION_CANCELLED,
                messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
              });
            },
            true, // isObscured
            options // Pass context for scripting
        );
      } else {
        // No password prompt was needed. This was either a success or a direct failure.
        if (initialLoginAttempt.success && !initialLoginAttempt.noAction) {
          OutputManager.clearOutput();
          const welcomeMsg =
              commandName === "login"
                  ? `${Config.MESSAGES.WELCOME_PREFIX} ${targetUser}${Config.MESSAGES.WELCOME_SUFFIX}`
                  : `Switched to user: ${targetUser}`;
          await OutputManager.appendToOutput(welcomeMsg);
        }
        resolve({
          success: initialLoginAttempt.success,
          output: initialLoginAttempt.message,
          error: initialLoginAttempt.success
              ? undefined
              : initialLoginAttempt.error || "Login failed.",
          messageType: initialLoginAttempt.success
              ? Config.CSS_CLASSES.SUCCESS_MSG
              : Config.CSS_CLASSES.ERROR_MSG,
        });
      }
    });
  }

  return {
    _handleUserSwitch,
  };
})();