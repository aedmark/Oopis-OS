/**
 * @file Defines the 'su' command, which allows switching to another user, stacking the session.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} suCommandDefinition
     * @description The command definition for the 'su' command.
     * This object specifies the command's name, completion type (for tab completion of usernames),
     * argument validation (optional username and password), and the core logic for user switching.
     */
    const suCommandDefinition = {
        commandName: "su",
        completionType: "users", // Suggests usernames for tab completion.
        argValidation: {
            max: 2, // Allow `su`, `su <user>`, and `su <user> <pass>`.
        },
        /**
         * The core logic for the 'su' command.
         * It determines the target user (defaulting to 'root' if no argument).
         * It then delegates the authentication and session switching process to `UserManager.su()`.
         * Upon successful user switch, it clears the terminal output and displays a welcome message.
         * It returns a command result object indicating success, output messages, or errors.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command, optionally containing a username and password.
         * @param {object} context.options - Execution options, including scriptingContext for automated password prompts.
         * @returns {Promise<object>} A promise that resolves to a command result object.
         */
        coreLogic: async (context) => {
            const { args, options } = context;
            // Determine the target user: default to 'root' if no argument provided.
            const targetUser = args.length > 0 ? args[0] : "root";
            // Check if a password was provided as the second argument.
            const providedPassword = args.length > 1 ? args[1] : null;

            // Delegate the user switching logic (including authentication and session management) to UserManager.
            const result = await UserManager.su(targetUser, providedPassword, options);

            // If the user switch was successful and it resulted in a new switch (not just 'no action'):
            if (result.success && !result.noAction) {
                OutputManager.clearOutput(); // Clear the terminal screen.
                // Display a welcome message to the newly switched user.
                await OutputManager.appendToOutput(`${Config.MESSAGES.WELCOME_PREFIX} ${targetUser}${Config.MESSAGES.WELCOME_SUFFIX}`);
            }

            // Return the command result, formatting output and error messages based on success.
            return {
                success: result.success,
                // If it's a 'noAction' result (e.g., already logged in as target user), display the message.
                // Otherwise, no direct output.
                output: result.noAction ? result.message : null,
                // Error message if the operation was not successful.
                error: result.success ? null : result.error,
                // Determine message type for styling: console log for no action, success for switch, error for failure.
                messageType: result.noAction ? Config.CSS_CLASSES.CONSOLE_LOG_MSG : (result.success ? Config.CSS_CLASSES.SUCCESS_MSG : Config.CSS_CLASSES.ERROR_MSG)
            };
        },
    };

    /**
     * @const {string} suDescription
     * @description A brief, one-line description of the 'su' command for the 'help' command.
     */
    const suDescription = "Switches to another user, stacking the session.";

    /**
     * @const {string} suHelpText
     * @description The detailed help text for the 'su' command, used by 'man'.
     */
    const suHelpText = `Usage: su [username] [password]

Change the current user ID to another user.

DESCRIPTION
       The su (substitute user) command allows you to run a new shell
       session as another user. If no <username> is provided, it defaults
       to 'root'.

       If the target account has a password, you will be prompted to
       enter it.

       This command "stacks" the new session on top of the old one.
       To return to your original user session, use the 'logout' command.
       This is different from 'login', which replaces the current
       session entirely.

EXAMPLES
       su
              Switches to the 'root' user (will prompt for password).

       su Guest
              Switches to the 'Guest' user.`;

    // Register the command with the system
    CommandRegistry.register("su", suCommandDefinition, suDescription, suHelpText);
})();