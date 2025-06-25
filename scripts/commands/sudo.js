/**
 * @file Manages sudo (superuser do) functionality and defines the 'sudo' command.
 * This system allows authorized users to execute commands with the privileges of another user, typically root.
 * @author Andrew Edmark
 * @author Gemini
 */

/**
 * @module SudoManager
 * @description Handles the core logic for sudo operations, including parsing the sudoers file,
 * managing authorization timestamps, and validating user permissions for sudo access.
 */
const SudoManager = (() => {
    "use strict";

    // In-memory cache for the parsed sudoers configuration.
    let sudoersConfig = null;
    // Stores timestamps of the last successful sudo authentication for each user.
    let userSudoTimestamps = {};

    /**
     * Parses the content of the /etc/sudoers file into a structured object.
     * This function is the single source of truth for sudo rules.
     * @private
     */
    function _parseSudoers() {
        const sudoersNode = FileSystemManager.getNodeByPath(Config.SUDO.SUDOERS_PATH);
        if (!sudoersNode || sudoersNode.type !== 'file') {
            sudoersConfig = { users: {}, groups: {}, timeout: Config.SUDO.DEFAULT_TIMEOUT }; // Default fallback
            return;
        }

        const content = sudoersNode.content || '';
        const lines = content.split('\n');
        const config = { users: {}, groups: {}, timeout: Config.SUDO.DEFAULT_TIMEOUT };

        lines.forEach(line => {
            line = line.trim();
            if (line.startsWith('#') || line === '') return;

            if (line.toLowerCase().startsWith('defaults timestamp_timeout=')) {
                const timeoutValue = parseInt(line.split('=')[1], 10);
                if (!isNaN(timeoutValue) && timeoutValue >= 0) {
                    config.timeout = timeoutValue;
                }
                return;
            }

            const parts = line.split(/\s+/);
            if (parts.length < 2) {
                // Resilience enhancement: Log a warning for malformed lines.
                console.warn(`SudoManager: Malformed line in /etc/sudoers: "${line}". Ignoring.`);
                return;
            }

            const entity = parts[0];
            const permissions = parts.slice(1).join(' ');

            if (entity.startsWith('%')) {
                config.groups[entity.substring(1)] = permissions;
            } else {
                config.users[entity] = permissions;
            }
        });
        sudoersConfig = config;
    }

    /**
     * Retrieves the current sudo configuration, parsing it from the file if necessary.
     * @returns {object} The parsed sudoers configuration object.
     */
    function getSudoersConfig() {
        if (!sudoersConfig) {
            _parseSudoers();
        }
        return sudoersConfig;
    }

    /**
     * Forces a re-parse of the /etc/sudoers file. Called after visudo saves changes.
     */
    function invalidateSudoersCache() {
        sudoersConfig = null;
    }

    /**
     * Checks if a user is still within their authorized sudo timeout window.
     * @param {string} username - The name of the user to check.
     * @returns {boolean} True if the user is within the timeout window, false otherwise.
     */
    function isUserTimestampValid(username) {
        const timestamp = userSudoTimestamps[username];
        if (!timestamp) return false;

        const config = getSudoersConfig();
        const timeoutMinutes = config.timeout || 0;
        if (timeoutMinutes <= 0) return false;

        const now = new Date().getTime();
        const elapsedMinutes = (now - timestamp) / (1000 * 60);

        return elapsedMinutes < timeoutMinutes;
    }

    /**
     * Updates a user's successful sudo authentication timestamp.
     * @param {string} username - The user whose timestamp should be updated.
     */
    function updateUserTimestamp(username) {
        userSudoTimestamps[username] = new Date().getTime();
    }

    /**
     * Clears the sudo timestamp for a specific user, typically on logout.
     * @param {string} username - The user whose timestamp should be cleared.
     */
    function clearUserTimestamp(username) {
        if (userSudoTimestamps[username]) {
            delete userSudoTimestamps[username];
        }
    }

    /**
     * Determines if a user has permission to run a specific command via sudo.
     * @param {string} username - The user attempting to run the command.
     * @param {string} commandToRun - The command the user wants to execute.
     * @returns {boolean} True if the user is authorized, false otherwise.
     */
    function canUserRunCommand(username, commandToRun) {
        if (username === 'root') return true;

        const config = getSudoersConfig();
        let userPermissions = config.users[username];

        if (!userPermissions) {
            const userGroups = GroupManager.getGroupsForUser(username);
            for (const group of userGroups) {
                if (config.groups[group]) {
                    userPermissions = config.groups[group];
                    break;
                }
            }
        }

        if (!userPermissions) return false;
        if (userPermissions.trim() === 'ALL') return true;

        const allowedCommands = userPermissions.split(',').map(cmd => cmd.trim());
        return allowedCommands.includes(commandToRun);
    }

    return {
        getSudoersConfig,
        invalidateSudoersCache,
        isUserTimestampValid,
        updateUserTimestamp,
        clearUserTimestamp, // Expose the new function
        canUserRunCommand
    };
})();


(() => {
    "use strict";

    const sudoCommandDefinition = {
        commandName: "sudo",
        argValidation: {
            min: 1,
            error: "usage: sudo <command> [args ...]"
        },
        coreLogic: async (context) => {
            const { args, currentUser, options } = context;
            const commandToRun = args[0];
            const fullCommandStr = args.join(' ');

            if (currentUser === 'root') {
                return await CommandExecutor.processSingleCommand(fullCommandStr, options.isInteractive);
            }

            if (!SudoManager.canUserRunCommand(currentUser, commandToRun) && !SudoManager.canUserRunCommand(currentUser, 'ALL')) {
                return {
                    success: false,
                    error: `sudo: Sorry, user ${currentUser} is not allowed to execute '${commandToRun}' as root on OopisOs.`
                };
            }

            if (SudoManager.isUserTimestampValid(currentUser)) {
                return await UserManager.sudoExecute(fullCommandStr, options);
            }

            return new Promise(resolve => {
                ModalInputManager.requestInput(
                    `[sudo] password for ${currentUser}:`,
                    async (password) => {
                        const authResult = await UserManager.verifyPassword(currentUser, password);

                        if (authResult.success) {
                            SudoManager.updateUserTimestamp(currentUser);
                            resolve(await UserManager.sudoExecute(fullCommandStr, options));
                        } else {
                            setTimeout(() => {
                                resolve({ success: false, error: "sudo: Sorry, try again." });
                            }, 1000);
                        }
                    },
                    () => resolve({ success: true, output: "" }),
                    true,
                    options
                );
            });
        }
    };

    const sudoDescription = "Executes a command as the superuser (root).";
    const sudoHelpText = `Usage: sudo <command> [arguments]

Execute a command with superuser privileges.

DESCRIPTION
       sudo allows a permitted user to execute a command as the superuser or another
       user, as specified by the security policy in the /etc/sudoers file.

       If the user has a valid timestamp (i.e., they have successfully authenticated
       recently), the command is executed without a password prompt. Otherwise, sudo
       requires the user to authenticate with their own password.

       To edit the sudoers file, use the 'visudo' command.`;

    CommandRegistry.register("sudo", sudoCommandDefinition, sudoDescription, sudoHelpText);

})();