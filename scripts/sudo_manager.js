const SudoManager = (() => {
    "use strict";

    let sudoersConfig = null;
    let userSudoTimestamps = {};

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

    function _getSudoersConfig() {
        _parseSudoers(); // Always re-parse to get the latest rules.
        return sudoersConfig;
    }

    function invalidateSudoersCache() {
        sudoersConfig = null;
    }

    function isUserTimestampValid(username) {
        const timestamp = userSudoTimestamps[username];
        if (!timestamp) return false;

        const config = _getSudoersConfig();
        const timeoutMinutes = config.timeout || 0;
        if (timeoutMinutes <= 0) return false;

        const now = new Date().getTime();
        const elapsedMinutes = (now - timestamp) / (1000 * 60);

        return elapsedMinutes < timeoutMinutes;
    }

    function updateUserTimestamp(username) {
        userSudoTimestamps[username] = new Date().getTime();
    }

    function clearUserTimestamp(username) {
        if (userSudoTimestamps[username]) {
            delete userSudoTimestamps[username];
        }
    }

    function canUserRunCommand(username, commandToRun) {
        if (username === 'root') return true;

        const config = _getSudoersConfig();
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

        for (const allowed of allowedCommands) {
            if (allowed === commandToRun || allowed.endsWith('/' + commandToRun)) {
                return true;
            }
        }

        // Return false if no permissions match after checking all possibilities.
        return false;
    }

    return {
        invalidateSudoersCache,
        isUserTimestampValid,
        updateUserTimestamp,
        clearUserTimestamp,
        canUserRunCommand
    };
})();