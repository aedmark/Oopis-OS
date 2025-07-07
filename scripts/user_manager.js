const UserManager = (() => {
    "use strict";
    let currentUser = {
        name: Config.USER.DEFAULT_NAME,
    };

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

    function getCurrentUser() {
        return currentUser;
    }

    function getPrimaryGroupForUser(username) {
        const users = StorageManager.loadItem(
            Config.STORAGE_KEYS.USER_CREDENTIALS,
            "User list",
            {}
        );
        return users[username]?.primaryGroup || null;
    }

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

    async function verifyPassword(username, password) {
        const users = StorageManager.loadItem(Config.STORAGE_KEYS.USER_CREDENTIALS, "User list", {});
        const userEntry = users[username];

        if (!userEntry) {
            return { success: false, error: "User not found." };
        }

        const storedPasswordHash = userEntry.passwordHash;
        if (storedPasswordHash === null) {
            return { success: false, error: "User does not have a password set."};
        }

        const providedPasswordHash = await _secureHashPassword(password);
        if (providedPasswordHash === storedPasswordHash) {
            return { success: true };
        } else {
            return { success: false, error: "Incorrect password." };
        }
    }

    async function sudoExecute(commandStr, options) {
        const originalUser = currentUser;
        try {
            currentUser = { name: 'root' };
            return await CommandExecutor.processSingleCommand(commandStr, options);
        } catch (e) {
            return { success: false, error: `sudo: an unexpected error occurred during execution: ${e.message}` };
        } finally {
            // CRITICAL: Always de-escalate privileges back to the original user.
            currentUser = originalUser;
        }
    }

    async function changePassword(actorUsername, targetUsername, oldPassword, newPassword) {
        const users = StorageManager.loadItem(Config.STORAGE_KEYS.USER_CREDENTIALS, "User list", {});

        if (!users[targetUsername]) {
            return { success: false, error: `User '${targetUsername}' not found.` };
        }

        if (actorUsername !== 'root') {
            if (actorUsername !== targetUsername) {
                return { success: false, error: "You can only change your own password." };
            }
            const authResult = await _authenticateUser(actorUsername, oldPassword);
            if (!authResult.success) {
                return { success: false, error: "Incorrect current password." };
            }
        }

        if (!newPassword || newPassword.trim() === '') {
            return { success: false, error: "New password cannot be empty." };
        }

        const newPasswordHash = await _secureHashPassword(newPassword);
        if (!newPasswordHash) {
            return { success: false, error: "Failed to securely process new password." };
        }

        users[targetUsername].passwordHash = newPasswordHash;

        if (StorageManager.saveItem(
            Config.STORAGE_KEYS.USER_CREDENTIALS,
            users,
            "User list"
        )) {
            return { success: true, message: `Password for '${targetUsername}' updated successfully.` };
        } else {
            return { success: false, error: "Failed to save updated password." };
        }
    }

    async function _handleAuthFlow(username, providedPassword, successCallback, failureMessage, options) {
        const authResult = await _authenticateUser(username, providedPassword);

        if (!authResult.success) {
            if (!authResult.requiresPasswordPrompt) {
                return authResult;
            }
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
                    true,
                    options
                );
            });
        }
        return await successCallback(username);
    }

    async function login(username, providedPassword, options = {}) {
        const currentStack = SessionManager.getStack();
        const currentUserName = getCurrentUser().name;

        if (username === currentUserName) {
            const message = `${Config.MESSAGES.ALREADY_LOGGED_IN_AS_PREFIX}${username}${Config.MESSAGES.ALREADY_LOGGED_IN_AS_SUFFIX}`;
            return { success: true, message: message, noAction: true };
        }

        if (currentStack.includes(username)) {
            return {
                success: false,
                error: `${Config.MESSAGES.ALREADY_LOGGED_IN_AS_PREFIX}${username}${Config.MESSAGES.ALREADY_LOGGED_IN_AS_SUFFIX}`
            };
        }

        return _handleAuthFlow(username, providedPassword, _performLogin, "Login failed.", options);
    }

    async function _performLogin(username) {
        if (currentUser.name !== Config.USER.DEFAULT_NAME) {
            SessionManager.saveAutomaticState(currentUser.name);
            SudoManager.clearUserTimestamp(currentUser.name);
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

    async function su(username, providedPassword, options = {}) {
        if (currentUser.name === username) {
            return { success: true, message: `Already user '${username}'.`, noAction: true };
        }
        return _handleAuthFlow(username, providedPassword, _performSu, "su: Authentication failure.", options);
    }

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

    async function logout() {
        const oldUser = currentUser.name;
        if (SessionManager.getStack().length <= 1) {
            return { success: true, message: `Cannot log out from user '${oldUser}'. This is the only active session. Use 'login' to switch to a different user.`, noAction: true };
        }

        SessionManager.saveAutomaticState(oldUser);
        SudoManager.clearUserTimestamp(oldUser);
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

        if (changesMade) {
            StorageManager.saveItem(
                Config.STORAGE_KEYS.USER_CREDENTIALS,
                users,
                "User list"
            );
        }
    }

    return {
        getCurrentUser,
        register,
        login,
        logout,
        su,
        verifyPassword,
        sudoExecute,
        changePassword,
        initializeDefaultUsers,
        getPrimaryGroupForUser,
    };
})();