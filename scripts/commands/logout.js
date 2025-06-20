/**
 * @file Defines the 'logout' command, which allows a user to log out of the current stacked session.
 * It returns the user to the previous session in the stack (if one exists), or does nothing if it's the only session.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} logoutCommandDefinition
     * @description The command definition for the 'logout' command.
     * This object specifies the command's name, argument validation (no arguments expected),
     * and the core logic for managing session logout.
     */
    const logoutCommandDefinition = {
        commandName: "logout",
        argValidation: {
            exact: 0, // This command takes no arguments.
        },
        /**
         * The core logic for the 'logout' command.
         * It delegates the session logout process to `UserManager.logout()`.
         * If the logout is successful and results in a session change, it clears
         * the terminal output and displays a welcome message for the new (previous) user.
         * It returns a command result object based on the outcome of the logout.
         * @async
         * @returns {Promise<object>} A promise that resolves to a command result object.
         */
        coreLogic: async () => {
            // Delegate the logout logic to the UserManager.
            const result = await UserManager.logout();

            // If logout was successful and it resulted in a change of user session:
            if (result.success && result.isLogout) {
                OutputManager.clearOutput(); // Clear the terminal screen.
                // Display a welcome message to the user now logged in.
                await OutputManager.appendToOutput(`${Config.MESSAGES.WELCOME_PREFIX} ${result.newUser}${Config.MESSAGES.WELCOME_SUFFIX}`);
            }

            // Return the command result, merging it with custom output/error and message type.
            return {
                ...result, // Inherit success, noAction, etc. properties from UserManager.logout result.
                output: result.message, // The message property from UserManager.logout contains the relevant output.
                messageType: result.noAction ? Config.CSS_CLASSES.CONSOLE_LOG_MSG : (result.success ? Config.CSS_CLASSES.SUCCESS_MSG : Config.CSS_CLASSES.ERROR_MSG)
            };
        },
    };

    const logoutDescription = "Logs out of the current user session.";

    const logoutHelpText = `Usage: logout

Log out of the current user session.

DESCRIPTION
       The logout command terminates the current user's session and returns
       to the session of the previous user in the stack.

       This command is the counterpart to 'su'. If you use 'su' to become
       another user, 'logout' will return you to your original session.

       If there is no previous session in the stack (i.e., you are in the
       initial session started with 'login'), logout will do nothing.

EXAMPLES
       su root
              (Enter password)
              ... perform actions as root ...
       logout
              Returns to the original user's session.`;

    CommandRegistry.register("logout", logoutCommandDefinition, logoutDescription, logoutHelpText);
})();