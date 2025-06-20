/**
 * @file Defines the 'listusers' command, which displays a list of all registered user accounts on the system.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} listusersCommandDefinition
     * @description The command definition for the 'listusers' command.
     * This object specifies the command's name, argument validation (no arguments expected),
     * and the core logic for listing users.
     */
    const listusersCommandDefinition = {
        commandName: "listusers",
        argValidation: {
            exact: 0, // This command takes no arguments.
        },
        /**
         * The core logic for the 'listusers' command.
         * It retrieves all user credentials from storage, extracts the usernames,
         * ensures the default 'Guest' user is included (if not already), sorts them,
         * and then formats the list for output to the terminal.
         * @async
         * @returns {Promise<object>} A promise that resolves to a command result object
         * with the formatted list of registered users or a message indicating no users are registered.
         */
        coreLogic: async () => {
            // Load user credentials from local storage.
            const users = StorageManager.loadItem(
                Config.STORAGE_KEYS.USER_CREDENTIALS,
                "User list",
                {}
            );
            let userNames = Object.keys(users); // Get an array of usernames.

            // Ensure the default guest user is always included in the list, even if not explicitly saved.
            if (!userNames.includes(Config.USER.DEFAULT_NAME)) {
                userNames.push(Config.USER.DEFAULT_NAME);
            }

            userNames.sort(); // Sort the usernames alphabetically.

            if (userNames.length === 0)
                return {
                    success: true,
                    output: "No users registered.",
                    messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                };

            return {
                success: true,
                // Format the output: "Registered users:\n  user1\n  user2"
                output:
                    "Registered users:\n" + userNames.map((u) => `  ${u}`).join("\n"),
            };
        },
    };

    const listusersDescription = "Lists all registered users on the system.";

    const listusersHelpText = `Usage: listusers

List all registered users.

DESCRIPTION
       The listusers command displays a list of all user accounts that
       currently exist on the system.

EXAMPLES
       listusers
              Registered users:
                Guest
                root
                userDiag`;

    CommandRegistry.register("listusers", listusersCommandDefinition, listusersDescription, listusersHelpText);
})();