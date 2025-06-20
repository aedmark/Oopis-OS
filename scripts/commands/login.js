/**
 * @file Defines the 'login' command, which allows users to log into a new session as a specified user.
 * This command replaces the current session stack, unlike 'su' which stacks sessions.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} loginCommandDefinition
     * @description The command definition for the 'login' command.
     * This object specifies the command's name, completion type (for tab completion of usernames),
     * argument validation (username and optional password), and the core logic for user authentication and session switching.
     */
    const loginCommandDefinition = {
        commandName: "login",
        completionType: "users", // Suggests usernames for tab completion.
        argValidation: {
            min: 1, // Requires at least a username.
            max: 2, // Allows username and an optional password.
            error: "Usage: login <username> [password]",
        },
        /**
         * The core logic for the 'login' command.
         * It extracts the username and optional password from the arguments.
         * It then delegates the authentication and session switching process to `UserManager.login()`.
         * Upon successful login, it clears the terminal output and displays a welcome message.
         * It returns a command result object indicating success, output messages, or errors.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command, expecting a username and optionally a password.
         * @param {object} context.options - Execution options, including scriptingContext for automated password prompts.
         * @returns {Promise<object>} A promise that resolves to a command result object.
         */
        coreLogic: async (context) => {
            const { args, options } = context;
            const username = args[0]; // The first argument is the username.
            // Check if a password was provided as the second argument.
            const providedPassword = args.length === 2 ? args[1] : null;

            // Delegate the login logic (including authentication and session management) to UserManager.
            const result = await UserManager.login(username, providedPassword, options);

            // If login was successful and it resulted in a new login (not just 'no action'):
            if (result.success && result.isLogin) {
                OutputManager.clearOutput(); // Clear the terminal screen.
                // Display a welcome message to the newly logged-in user.
                await OutputManager.appendToOutput(`${Config.MESSAGES.WELCOME_PREFIX} ${username}${Config.MESSAGES.WELCOME_SUFFIX}`);
            }

            // Return the command result, formatting output and error messages based on success.
            return {
                success: result.success,
                // If it's a 'noAction' result (e.g., already logged in), display the message. Otherwise, no direct output.
                output: result.noAction ? result.message : null,
                // Error message if the operation was not successful.
                error: result.success ? null : result.error,
                // Determine message type for styling: console log for no action, success for login, error for failure.
                messageType: result.noAction ? Config.CSS_CLASSES.CONSOLE_LOG_MSG : (result.success ? Config.CSS_CLASSES.SUCCESS_MSG : Config.CSS_CLASSES.ERROR_MSG)
            };
        },
    };

    const loginDescription = "Logs in as a user, starting a new session.";

    const loginHelpText = `Usage: login <username> [password]

Log in as a user and start a new session.

DESCRIPTION
       The login command starts a new session for the specified <username>.
       If the user account has a password, and one is not provided in the
       command, the system will prompt for it.

       Unlike the 'su' command which stacks user sessions, 'login'
       clears any existing session stack and starts a fresh one. This
       means any active 'su' sessions will be terminated.

EXAMPLES
       login root
              Prompts for the root user's password and logs in.
       login Guest
              Logs in as the Guest user (no password required).`;

    CommandRegistry.register("login", loginCommandDefinition, loginDescription, loginHelpText);
})();