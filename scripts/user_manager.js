// scripts/commands/user_manager.js

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


    async function login(username, providedPassword, options = {}) {
        const authResult = await _authenticateUser(username, providedPassword);

        if (!authResult.success) {
            if (!authResult.requiresPasswordPrompt) {
                return authResult;
            }
            // If password prompt is required
            return new Promise(resolve => {
                ModalInputManager.requestInput(
                    Config.MESSAGES.PASSWORD_PROMPT,
                    async (passwordFromPrompt) => {
                        const finalAuthResult = await _authenticateUser(username, passwordFromPrompt);
                        if (finalAuthResult.success) {
                            resolve(await _performLogin(username));
                        } else {
                            resolve({ success: false, error: finalAuthResult.error || "Login failed." });
                        }
                    },
                    () => resolve({ success: true, output: Config.MESSAGES.OPERATION_CANCELLED }),
                    true, // isObscured
                    options
                );
            });
        }
        return await _performLogin(username);
    }

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

    async function su(username, providedPassword, options = {}) {
        if (currentUser.name === username) {
            return { success: true, message: `Already user '${username}'.`, noAction: true };
        }
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
                            resolve(await _performSu(username));
                        } else {
                            resolve({ success: false, error: finalAuthResult.error || "su: Authentication failure." });
                        }
                    },
                    () => resolve({ success: true, output: Config.MESSAGES.OPERATION_CANCELLED }),
                    true, // isObscured
                    options
                );
            });
        }
        return await _performSu(username);
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
    return {
        getCurrentUser,
        register,
        login,
        logout,
        su,
        initializeDefaultUsers,
        getPrimaryGroupForUser,
    };
})();
const GroupManager = (() => {
    "use strict";
    let groups = {};

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

    function _save() {
        StorageManager.saveItem(
            Config.STORAGE_KEYS.USER_GROUPS,
            groups,
            "User Groups"
        );
    }

    function groupExists(groupName) {
        return !!groups[groupName];
    }

    function createGroup(groupName) {
        if (groupExists(groupName)) {
            return false;
        }
        groups[groupName] = { members: [] };
        _save();
        return true;
    }

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