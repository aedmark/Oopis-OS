// scripts/user_manager.js

/**
 * @file Manages all user and group-related logic for OopisOS.
 * @module UserManager
 * @module GroupManager
 */

const UserManager = (() => {
    "use strict";
    let currentUser = {
        name: Config.USER.DEFAULT_NAME,
    };

    /**
     * Hashes a password using the Web Crypto API (SHA-256).
     * @private
     * @param {string} password The plain-text password to hash.
     * @returns {Promise<string|null>} A promise that resolves to the hex-encoded hash string, or null on failure.
     */
    async function _secureHashPassword(password) {
        if (!password || typeof password !== "string" || password.trim() === "") {
            return null;
        }
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(password);
            const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
        } catch (error) {
            console.error("Password hashing failed:", error);
            return null;
        }
    }

    /**
     * Gets the currently active user object.
     * @returns {{name: string}} The current user object.
     */
    function getCurrentUser() {
        return currentUser;
    }

    /**
     * Retrieves the primary group for a given user.
     * @param {string} username - The name of the user to check.
     * @returns {string|null} The name of the user's primary group, or null if not found.
     */
    function getPrimaryGroupForUser(username) {
        const users = StorageManager.loadItem(
            Config.STORAGE_KEYS.USER_CREDENTIALS,
            "User list",
            {}
        );
        return users[username]?.primaryGroup || null;
    }

    /**
     * Registers a new user, creates their home directory and primary group.
     * @param {string} username - The desired username.
     * @param {string|null} password - The desired password (can be null for no password).
     * @returns {Promise<object>} A command result object indicating success or failure.
     */
    async function register(username, password) {
        const formatValidation = Utils.validateUsernameFormat(username);
        if (!formatValidation.isValid)
            return {
                success: false,
                error: formatValidation.error,
            };

        const users = StorageManager.loadItem(
            Config.STORAGE_KEYS.USER_CREDENTIALS,
            "User list",
            {}
        );

        if (users[username])
            return {
                success: false,
                error: `User '${username}' already exists.`,
            };

        const passwordHash = password ? await _secureHashPassword(password) : null;
        if (password && !passwordHash) {
            return {
                success: false,
                error: "Failed to securely process password.",
            };
        }

        GroupManager.createGroup(username);
        GroupManager.addUserToGroup(username, username);

        users[username] = {
            passwordHash: passwordHash,
            primaryGroup: username,
        };

        await FileSystemManager.createUserHomeDirectory(username);

        if (
            StorageManager.saveItem(
                Config.STORAGE_KEYS.USER_CREDENTIALS,
                users,
                "User list"
            ) &&
            (await FileSystemManager.save())
        ) {
            return {
                success: true,
                message: `User '${username}' registered. Home directory created at /home/${username}.`,
            };
        } else {
            return {
                success: false,
                error: "Failed to save new user and filesystem.",
            };
        }
    }

    /**
     * Authenticates a user against stored credentials. Does not handle UI/modals.
     * @private
     * @param {string} username - The username to authenticate.
     * @param {string|null} providedPassword - The password to check.
     * @returns {Promise<object>} An object indicating the result. Includes `requiresPasswordPrompt` if a password is needed but wasn't provided.
     */
    async function _authenticateUser(username, providedPassword) {
        const users = StorageManager.loadItem(Config.STORAGE_KEYS.USER_CREDENTIALS, "User list", {});
        const userEntry = users[username];

        if (!userEntry && username !== Config.USER.DEFAULT_NAME && username !== 'root') {
            return { success: false, error: "Invalid username." };
        }

        const storedPasswordHash = userEntry ? userEntry.passwordHash : null;

        if (storedPasswordHash !== null) {
            if (providedPassword === null) {
                return { success: false, error: "Password required.", requiresPasswordPrompt: true };
            }
            const providedPasswordHash = await _secureHashPassword(providedPassword);
            if (providedPasswordHash !== storedPasswordHash) {
                return { success: false, error: Config.MESSAGES.INVALID_PASSWORD };
            }
        } else if (providedPassword !== null) {
            return { success: false, error: "This account does not require a password." };
        }

        return { success: true };
    }

    /**
     * Verifies a user's password without changing the session. Required for sudo.
     * @param {string} username - The user whose password to verify.
     * @param {string} password - The password to check.
     * @returns {Promise<{success: boolean, error?: string}>} An object indicating if the password is correct.
     */
    async function verifyPassword(username, password) {
        const users = StorageManager.loadItem(Config.STORAGE_KEYS.USER_CREDENTIALS, "User list", {});
        const userEntry = users[username];

        if (!userEntry) {
            return { success: false, error: "User not found." };
        }

        const storedPasswordHash = userEntry.passwordHash;
        if (storedPasswordHash === null) {
            // This case shouldn't be hit if sudoers requires it, but handles users with no password.
            return { success: false, error: "User does not have a password set."};
        }

        const providedPasswordHash = await _secureHashPassword(password);
        if (providedPasswordHash === storedPasswordHash) {
            return { success: true };
        } else {
            return { success: false, error: "Incorrect password." };
        }
    }

    /**
     * Executes a command with root privileges and then safely returns to the original user.
     * @param {string} commandStr - The full command string to execute as root.
     * @param {object} options - The original command options.
     * @returns {Promise<object>} The result object from the command execution.
     */
    async function sudoExecute(commandStr, options) {
        const originalUser = currentUser;
        try {
            // Escalate privileges to root
            currentUser = { name: 'root' };
            // Execute the command non-interactively, as if root typed it.
            return await CommandExecutor.processSingleCommand(commandStr, false, options.scriptingContext);
        } catch (e) {
            return { success: false, error: `sudo: an unexpected error occurred during execution: ${e.message}` };
        } finally {
            // CRITICAL: Always de-escalate privileges back to the original user.
            currentUser = originalUser;
        }
    }


    /**
     * Handles the shared authentication logic for login and su, including interactive password prompts.
     * @private
     * @param {string} username - The user to authenticate.
     * @param {string|null} providedPassword - The password from the command arguments.
     * @param {function} successCallback - The function to call upon successful authentication (e.g., _performLogin, _performSu).
     * @param {string} failureMessage - The error message to show on authentication failure.
     * @param {object} options - Command options, including scriptingContext.
     * @returns {Promise<object>} A command result object.
     */
    async function _handleAuthFlow(username, providedPassword, successCallback, failureMessage, options) {
        const authResult = await _authenticateUser(username, providedPassword);

        if (!authResult.success) {
            if (!authResult.requiresPasswordPrompt) {
                return authResult; // Return direct failure (e.g., invalid user, wrong password type)
            }
            // Password prompt is required
            return new Promise(resolve => {
                ModalInputManager.requestInput(
                    Config.MESSAGES.PASSWORD_PROMPT,
                    async (passwordFromPrompt) => {
                        const finalAuthResult = await _authenticateUser(username, passwordFromPrompt);
                        if (finalAuthResult.success) {
                            resolve(await successCallback(username));
                        } else {
                            resolve({ success: false, error: finalAuthResult.error || failureMessage });
                        }
                    },
                    () => resolve({ success: true, output: Config.MESSAGES.OPERATION_CANCELLED }),
                    true, // isObscured
                    options
                );
            });
        }
        // Authentication succeeded without needing a prompt
        return await successCallback(username);
    }

    /**
     * Logs in as a specified user, replacing the current session stack.
     * @param {string} username - The username to log in as.
     * @param {string|null} providedPassword - The password, if provided.
     * @param {object} [options={}] - Command options, including scriptingContext for automated tests.
     * @returns {Promise<object>} A command result object.
     */
    async function login(username, providedPassword, options = {}) {
        return _handleAuthFlow(username, providedPassword, _performLogin, "Login failed.", options);
    }

    /**
     * Performs the final actions of a login after authentication is successful.
     * @private
     * @param {string} username - The username to log in as.
     * @returns {Promise<object>} A command result object.
     */
    async function _performLogin(username) {
        if (currentUser.name !== Config.USER.DEFAULT_NAME) {
            SessionManager.saveAutomaticState(currentUser.name);
        }
        SessionManager.clearUserStack(username);
        currentUser = { name: username };
        SessionManager.loadAutomaticState(username);
        const homePath = `/home/${username}`;
        if (FileSystemManager.getNodeByPath(homePath)) {
            FileSystemManager.setCurrentPath(homePath);
        } else {
            FileSystemManager.setCurrentPath(Config.FILESYSTEM.ROOT_PATH);
        }
        return { success: true, message: `Logged in as ${username}.`, isLogin: true };
    }

    /**
     * Switches to a new user, stacking the session on top of the current one.
     * @param {string} username - The user to switch to.
     * @param {string|null} providedPassword - The password, if provided.
     * @param {object} [options={}] - Command options, including scriptingContext for automated tests.
     * @returns {Promise<object>} A command result object.
     */
    async function su(username, providedPassword, options = {}) {
        if (currentUser.name === username) {
            return { success: true, message: `Already user '${username}'.`, noAction: true };
        }
        return _handleAuthFlow(username, providedPassword, _performSu, "su: Authentication failure.", options);
    }

    /**
     * Performs the final actions of a user switch after authentication is successful.
     * @private
     * @param {string} username - The username to switch to.
     * @returns {Promise<object>} A command result object.
     */
    async function _performSu(username) {
        SessionManager.saveAutomaticState(currentUser.name);
        SessionManager.pushUserToStack(username);
        currentUser = { name: username };
        SessionManager.loadAutomaticState(username);
        const homePath = `/home/${username}`;
        if (FileSystemManager.getNodeByPath(homePath)) {
            FileSystemManager.setCurrentPath(homePath);
        } else {
            FileSystemManager.setCurrentPath(Config.FILESYSTEM.ROOT_PATH);
        }
        return { success: true, message: `Switched to user: ${username}.` };
    }

    /**
     * Logs out of the current stacked session and returns to the previous user.
     * @returns {Promise<object>} A command result object.
     */
    async function logout() {
        const oldUser = currentUser.name;
        if (SessionManager.getStack().length <= 1) {
            return { success: true, message: `Cannot log out from user '${oldUser}'. This is the only active session. Use 'login' to switch to a different user.`, noAction: true };
        }

        SessionManager.saveAutomaticState(oldUser);
        SessionManager.popUserFromStack();
        const newUsername = SessionManager.getCurrentUserFromStack();
        currentUser = { name: newUsername };
        SessionManager.loadAutomaticState(newUsername);
        const homePath = `/home/${newUsername}`;
        if (FileSystemManager.getNodeByPath(homePath)) {
            FileSystemManager.setCurrentPath(homePath);
        } else {
            FileSystemManager.setCurrentPath(Config.FILESYSTEM.ROOT_PATH);
        }
        return { success: true, message: `Logged out from ${oldUser}. Now logged in as ${newUsername}.`, isLogout: true, newUser: newUsername };
    }

    /**
     * Initializes the default users (root, Guest, userDiag) if they do not already exist in storage.
     * @returns {Promise<void>}
     */
    async function initializeDefaultUsers() {
        const users = StorageManager.loadItem(
            Config.STORAGE_KEYS.USER_CREDENTIALS,
            "User list",
            {}
        );
        let changesMade = false;

        if (!users["root"]) {
            users["root"] = {
                passwordHash: await _secureHashPassword("mcgoopis"),
                primaryGroup: "root",
            };
            changesMade = true;
        }

        if (!users[Config.USER.DEFAULT_NAME]) {
            users[Config.USER.DEFAULT_NAME] = {
                passwordHash: null,
                primaryGroup: Config.USER.DEFAULT_NAME,
            };
            changesMade = true;
        }

        if (!users["userDiag"]) {
            users["userDiag"] = {
                passwordHash: await _secureHashPassword("pantload"),
                primaryGroup: "userDiag",
            };
            changesMade = true;
        }

        if (changesMade) {
            StorageManager.saveItem(
                Config.STORAGE_KEYS.USER_CREDENTIALS,
                users,
                "User list"
            );
        }
    }

    /**
     * Public interface for UserManager.
     */
    return {
        getCurrentUser,
        register,
        login,
        logout,
        su,
        verifyPassword,
        sudoExecute,
        initializeDefaultUsers,
        getPrimaryGroupForUser,
    };
})();

const GroupManager = (() => {
    "use strict";
    let groups = {};

    /**
     * Initializes the GroupManager by loading groups from storage and creating defaults.
     * @returns {void}
     */
    function initialize() {
        groups = StorageManager.loadItem(
            Config.STORAGE_KEYS.USER_GROUPS,
            "User Groups",
            {}
        );
        if (!groups["root"]) {
            createGroup("root");
            addUserToGroup("root", "root");
        }
        if (!groups["Guest"]) {
            createGroup("Guest");
            addUserToGroup("Guest", "Guest");
        }
        if (!groups["userDiag"]) {
            createGroup("userDiag");
            addUserToGroup("userDiag", "userDiag");
        }
        console.log("GroupManager initialized.");
    }

    /**
     * Saves the current group data to local storage.
     * @private
     * @returns {void}
     */
    function _save() {
        StorageManager.saveItem(
            Config.STORAGE_KEYS.USER_GROUPS,
            groups,
            "User Groups"
        );
    }

    /**
     * Checks if a group exists.
     * @param {string} groupName - The name of the group to check.
     * @returns {boolean} True if the group exists, false otherwise.
     */
    function groupExists(groupName) {
        return !!groups[groupName];
    }

    /**
     * Creates a new, empty group.
     * @param {string} groupName - The name for the new group.
     * @returns {boolean} True if the group was created, false if it already existed.
     */
    function createGroup(groupName) {
        if (groupExists(groupName)) {
            return false;
        }
        groups[groupName] = { members: [] };
        _save();
        return true;
    }

    /**
     * Adds a user to a supplementary group.
     * @param {string} username - The user to add.
     * @param {string} groupName - The group to add the user to.
     * @returns {boolean} True if the user was added, false if they were already a member or the group doesn't exist.
     */
    function addUserToGroup(username, groupName) {
        if (
            groupExists(groupName) &&
            !groups[groupName].members.includes(username)
        ) {
            groups[groupName].members.push(username);
            _save();
            return true;
        }
        return false;
    }

    /**
     * Gets all groups a user belongs to (primary and supplementary).
     * @param {string} username - The user to query.
     * @returns {string[]} An array of group names.
     */
    function getGroupsForUser(username) {
        const userGroups = [];
        const users = StorageManager.loadItem(
            Config.STORAGE_KEYS.USER_CREDENTIALS,
            "User list",
            {}
        );
        const primaryGroup = users[username]?.primaryGroup;

        if (primaryGroup) {
            userGroups.push(primaryGroup);
        }

        for (const groupName in groups) {
            if (
                groups[groupName].members &&
                groups[groupName].members.includes(username)
            ) {
                if (!userGroups.includes(groupName)) {
                    userGroups.push(groupName);
                }
            }
        }
        return userGroups;
    }

    /**
     * Deletes a group, unless it is a primary group for any user.
     * @param {string} groupName - The group to delete.
     * @returns {{success: boolean, error?: string}} An object indicating the result of the operation.
     */
    function deleteGroup(groupName) {
        if (!groupExists(groupName)) {
            return { success: false, error: `group '${groupName}' does not exist.` };
        }

        const users = StorageManager.loadItem(Config.STORAGE_KEYS.USER_CREDENTIALS, "User list", {});
        for (const username in users) {
            if (users[username].primaryGroup === groupName) {
                return { success: false, error: `cannot remove group '${groupName}': it is the primary group of user '${username}'.` };
            }
        }

        delete groups[groupName];
        _save();
        return { success: true };
    }

    /**
     * Removes a user from all supplementary groups they are a member of.
     * @param {string} username - The username to remove from groups.
     * @returns {void}
     */
    function removeUserFromAllGroups(username) {
        let changed = false;
        for (const groupName in groups) {
            const index = groups[groupName].members.indexOf(username);
            if (index > -1) {
                groups[groupName].members.splice(index, 1);
                changed = true;
            }
        }
        if (changed) {
            _save();
        }
    }

    /**
     * Public interface for GroupManager.
     */
    return {
        initialize,
        createGroup,
        deleteGroup,
        addUserToGroup,
        removeUserFromAllGroups,
        getGroupsForUser,
        groupExists,
    };
})();