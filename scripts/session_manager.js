/**
 * @file Manages all aspects of a user's session, including environment variables,
 * command history, aliases, and the saving/loading of terminal states. This file
 * contains multiple manager modules related to the session.
 * @module SessionManagement
 */

/**
 * @module EnvironmentManager
 * @description Manages session-specific environment variables.
 */
const EnvironmentManager = (() => {
    "use strict";
    /**
     * In-memory object storing the current session's environment variables.
     * @private
     * @type {Object.<string, string>}
     */
    let envVars = {};

    /**
     * Initializes the environment variables with default values for the current user.
     */
    function initialize() {
        const currentUser = UserManager.getCurrentUser().name;
        envVars = {
            'USER': currentUser,
            'HOME': `/home/${currentUser}`,
            'HOST': Config.OS.DEFAULT_HOST_NAME,
            'PATH': '/bin:/usr/bin', // Standard practice
        };
    }

    /**
     * Gets the value of a specific environment variable.
     * @param {string} varName - The name of the variable to retrieve.
     * @returns {string} The value of the variable, or an empty string if not found.
     */
    function get(varName) {
        return envVars[varName] || '';
    }

    /**
     * Sets the value of an environment variable.
     * @param {string} varName - The name of the variable to set.
     * @param {string} value - The value to assign to the variable.
     * @returns {{success: boolean, error?: string}} A result object.
     */
    function set(varName, value) {
        // Basic validation for variable names
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varName)) {
            return { success: false, error: `Invalid variable name: '${varName}'. Must start with a letter or underscore, followed by letters, numbers, or underscores.` };
        }
        envVars[varName] = value;
        return { success: true };
    }

    /**
     * Deletes an environment variable.
     * @param {string} varName - The name of the variable to unset.
     */
    function unset(varName) {
        delete envVars[varName];
    }

    /**
     * Gets a copy of all current environment variables.
     * @returns {Object.<string, string>} An object containing all variables.
     */
    function getAll() {
        return { ...envVars };
    }

    /**
     * Loads a new set of environment variables, replacing the existing ones. Used for session restoration.
     * @param {Object.<string, string>} vars - The new set of variables.
     */
    function load(vars) {
        envVars = { ...(vars || {}) };
    }

    /**
     * Clears all environment variables.
     */
    function clear() {
        envVars = {};
    }

    return {
        initialize,
        get,
        set,
        unset,
        getAll,
        load,
        clear
    };
})();

/**
 * @module HistoryManager
 * @description Manages the command history for the current session.
 */
const HistoryManager = (() => {
    "use strict";
    /** @private @type {string[]} */
    let commandHistory = [];
    /** @private @type {number} */
    let historyIndex = 0;

    /**
     * Adds a command to the history.
     * @param {string} command - The command string to add.
     */
    function add(command) {
        const trimmedCommand = command.trim();
        if (
            trimmedCommand &&
            (commandHistory.length === 0 ||
                commandHistory[commandHistory.length - 1] !== trimmedCommand)
        ) {
            commandHistory.push(trimmedCommand);
            if (commandHistory.length > Config.TERMINAL.MAX_HISTORY_SIZE)
                commandHistory.shift();
        }
        historyIndex = commandHistory.length;
    }

    /**
     * Retrieves the previous command from history for arrow-up navigation.
     * @returns {string|null} The command string, or null if at the beginning of history.
     */
    function getPrevious() {
        if (commandHistory.length > 0 && historyIndex > 0) {
            historyIndex--;
            return commandHistory[historyIndex];
        }
        return null;
    }

    /**
     * Retrieves the next command from history for arrow-down navigation.
     * @returns {string|null} The command string, or an empty string if at the end of history.
     */
    function getNext() {
        if (historyIndex < commandHistory.length - 1) {
            historyIndex++;
            return commandHistory[historyIndex];
        } else if (historyIndex >= commandHistory.length - 1) {
            historyIndex = commandHistory.length;
            return "";
        }
        return null;
    }

    /**
     * Resets the history navigation index, typically after a new command is entered.
     */
    function resetIndex() {
        historyIndex = commandHistory.length;
    }

    /**
     * Returns a copy of the entire command history array.
     * @returns {string[]}
     */
    function getFullHistory() {
        return [...commandHistory];
    }

    /**
     * Clears the command history for the current session.
     */
    function clearHistory() {
        commandHistory = [];
        historyIndex = 0;
    }

    /**
     * Sets the command history to a new array, used for session restoration.
     * @param {string[]} newHistory - The array of commands to set as the new history.
     */
    function setHistory(newHistory) {
        commandHistory = Array.isArray(newHistory) ? [...newHistory] : [];
        if (commandHistory.length > Config.TERMINAL.MAX_HISTORY_SIZE)
            commandHistory = commandHistory.slice(
                commandHistory.length - Config.TERMINAL.MAX_HISTORY_SIZE
            );
        historyIndex = commandHistory.length;
    }
    return {
        add,
        getPrevious,
        getNext,
        resetIndex,
        getFullHistory,
        clearHistory,
        setHistory,
    };
})();

/**
 * @module AliasManager
 * @description Manages user-defined command aliases, including persistence.
 */
const AliasManager = (() => {
    "use strict";
    /** @private @type {Object.<string, string>} */
    let aliases = {};

    /**
     * Initializes the manager by loading aliases from localStorage.
     */
    function initialize() {
        aliases = StorageManager.loadItem(
            Config.STORAGE_KEYS.ALIAS_DEFINITIONS,
            "Aliases",
            {}
        );
    }

    /**
     * Saves the current aliases to localStorage.
     * @private
     */
    function _save() {
        StorageManager.saveItem(
            Config.STORAGE_KEYS.ALIAS_DEFINITIONS,
            aliases,
            "Aliases"
        );
    }

    /**
     * Creates or updates an alias.
     * @param {string} name - The name of the alias.
     * @param {string} value - The command string the alias should expand to.
     * @returns {boolean} True on success.
     */
    function setAlias(name, value) {
        if (!name || typeof value !== "string") return false;
        aliases[name] = value;
        _save();
        return true;
    }

    /**
     * Removes a defined alias.
     * @param {string} name - The name of the alias to remove.
     * @returns {boolean} True if the alias was found and removed.
     */
    function removeAlias(name) {
        if (!aliases[name]) return false;
        delete aliases[name];
        _save();
        return true;
    }

    /**
     * Retrieves the definition of a single alias.
     * @param {string} name - The name of the alias to get.
     * @returns {string|null} The alias definition, or null if not found.
     */
    function getAlias(name) {
        return aliases[name] || null;
    }

    /**
     * Returns a copy of all defined aliases.
     * @returns {Object.<string, string>}
     */
    function getAllAliases() {
        return { ...aliases };
    }

    /**
     * Expands an alias in a command string, handling recursive expansion up to a limit.
     * @param {string} commandString - The initial command string to resolve.
     * @returns {{newCommand: string, error?: string}} An object with the resolved command or an error.
     */
    function resolveAlias(commandString) {
        const parts = commandString.split(/\s+/);
        let commandName = parts[0];
        const remainingArgs = parts.slice(1).join(" ");
        const MAX_RECURSION = 10;
        let count = 0;
        while (aliases[commandName] && count < MAX_RECURSION) {
            const aliasValue = aliases[commandName];
            const aliasParts = aliasValue.split(/\s+/);
            commandName = aliasParts[0];
            const aliasArgs = aliasParts.slice(1).join(" ");
            commandString = `${commandName} ${aliasArgs} ${remainingArgs}`.trim();
            count++;
        }
        if (count === MAX_RECURSION) {
            return {
                error: `Alias loop detected for '${parts[0]}'`,
            };
        }
        return {
            newCommand: commandString,
        };
    }
    return {
        initialize,
        setAlias,
        removeAlias,
        getAlias,
        getAllAliases,
        resolveAlias,
    };
})();

/**
 * @module SessionManager
 * @description Orchestrates user sessions, including the user stack for `su`/`logout`
 * and the automatic/manual saving and loading of terminal states.
 */
const SessionManager = (() => {
    "use strict";
    /** @private @type {string[]} */
    let userSessionStack = [];

    /**
     * Initializes the user session stack with the default user.
     */
    function initializeStack() {
        userSessionStack = [Config.USER.DEFAULT_NAME];
    }

    /**
     * Gets the current user session stack.
     * @returns {string[]}
     */
    function getStack() {
        return userSessionStack;
    }

    /**
     * Pushes a new user onto the session stack (used for `su`).
     * @param {string} username - The username to push.
     */
    function pushUserToStack(username) {
        userSessionStack.push(username);
    }

    /**
     * Pops the current user from the session stack (used for `logout`).
     * @returns {string|null} The username that was popped, or null if it's the last user.
     */
    function popUserFromStack() {
        if (userSessionStack.length > 1) {
            return userSessionStack.pop();
        }
        return null;
    }

    /**
     * Gets the current user from the top of the session stack.
     * @returns {string} The current active username.
     */
    function getCurrentUserFromStack() {
        return userSessionStack.length > 0
            ? userSessionStack[userSessionStack.length - 1]
            : Config.USER.DEFAULT_NAME;
    }

    /**
     * Clears the session stack and starts a new one with the given user (used for `login`).
     * @param {string} username - The username to start the new stack with.
     */
    function clearUserStack(username) {
        userSessionStack = [username];
    }

    /**
     * Generates the localStorage key for a user's automatic session state.
     * @private
     * @param {string} user - The username.
     * @returns {string} The storage key.
     */
    function _getAutomaticSessionStateKey(user) {
        return `${Config.STORAGE_KEYS.USER_TERMINAL_STATE_PREFIX}${user}`;
    }

    /**
     * Generates the localStorage key for a user's manual session state.
     * @private
     * @param {string|{name: string}} user - The username or user object.
     * @returns {string} The storage key.
     */
    function _getManualUserTerminalStateKey(user) {
        const userName =
            typeof user === "object" && user !== null && user.name
                ? user.name
                : String(user);
        return `${Config.STORAGE_KEYS.MANUAL_TERMINAL_STATE_PREFIX}${userName}`;
    }

    /**
     * Saves the current terminal state automatically for a user.
     * This is typically called before switching users.
     * @param {string} username - The user whose state is being saved.
     */
    function saveAutomaticState(username) {
        if (!username) {
            console.warn(
                "saveAutomaticState: No username provided. State not saved."
            );
            return;
        }
        const currentInput = TerminalUI.getCurrentInputValue();
        const autoState = {
            currentPath: FileSystemManager.getCurrentPath(),
            outputHTML: DOM.outputDiv ? DOM.outputDiv.innerHTML : "",
            currentInput: currentInput,
            commandHistory: HistoryManager.getFullHistory(),
            environmentVariables: EnvironmentManager.getAll(),
        };
        StorageManager.saveItem(
            _getAutomaticSessionStateKey(username),
            autoState,
            `Auto session for ${username}`
        );
    }

    /**
     * Loads a user's automatic session state from localStorage.
     * @param {string} username - The user whose state is being loaded.
     * @returns {boolean} True if a state was found and loaded, false otherwise.
     */
    function loadAutomaticState(username) {
        if (!username) {
            console.warn(
                "loadAutomaticState: No username provided. Cannot load state."
            );
            if (DOM.outputDiv) DOM.outputDiv.innerHTML = "";
            TerminalUI.setCurrentInputValue("");
            FileSystemManager.setCurrentPath(Config.FILESYSTEM.ROOT_PATH);
            HistoryManager.clearHistory();
            void OutputManager.appendToOutput(
                `${Config.MESSAGES.WELCOME_PREFIX} ${Config.USER.DEFAULT_NAME}${Config.MESSAGES.WELCOME_SUFFIX}`
            );
            TerminalUI.updatePrompt();
            if (DOM.outputDiv) DOM.outputDiv.scrollTop = DOM.outputDiv.scrollHeight;
            return false;
        }
        const autoState = StorageManager.loadItem(
            _getAutomaticSessionStateKey(username),
            `Auto session for ${username}`
        );
        if (autoState) {
            FileSystemManager.setCurrentPath(
                autoState.currentPath || Config.FILESYSTEM.ROOT_PATH
            );
            if (DOM.outputDiv) {
                if (autoState.hasOwnProperty("outputHTML")) {
                    DOM.outputDiv.innerHTML = autoState.outputHTML || "";
                } else {
                    DOM.outputDiv.innerHTML = "";
                    void OutputManager.appendToOutput(
                        `${Config.MESSAGES.WELCOME_PREFIX} ${username}${Config.MESSAGES.WELCOME_SUFFIX}`
                    );
                }
            }
            TerminalUI.setCurrentInputValue(autoState.currentInput || "");
            HistoryManager.setHistory(autoState.commandHistory || []);
            EnvironmentManager.load(autoState.environmentVariables);
        } else {
            if (DOM.outputDiv) DOM.outputDiv.innerHTML = "";
            TerminalUI.setCurrentInputValue("");
            const homePath = `/home/${username}`;
            if (FileSystemManager.getNodeByPath(homePath)) {
                FileSystemManager.setCurrentPath(homePath);
            } else {
                FileSystemManager.setCurrentPath(Config.FILESYSTEM.ROOT_PATH);
            }
            HistoryManager.clearHistory();
            EnvironmentManager.initialize();
            void OutputManager.appendToOutput(
                `${Config.MESSAGES.WELCOME_PREFIX} ${username}${Config.MESSAGES.WELCOME_SUFFIX}`
            );
        }
        TerminalUI.updatePrompt();
        if (DOM.outputDiv) DOM.outputDiv.scrollTop = DOM.outputDiv.scrollHeight;
        return !!autoState;
    }

    /**
     * Saves a complete snapshot of the current session and file system manually.
     * @returns {Promise<{success: boolean, message?: string, error?: string}>}
     * @async
     */
    async function saveManualState() {
        const currentUser = UserManager.getCurrentUser();
        const currentInput = TerminalUI.getCurrentInputValue();
        const manualStateData = {
            user: currentUser.name,
            osVersion: Config.OS.VERSION,
            timestamp: new Date().toISOString(),
            currentPath: FileSystemManager.getCurrentPath(),
            outputHTML: DOM.outputDiv ? DOM.outputDiv.innerHTML : "",
            currentInput: currentInput,
            fsDataSnapshot: Utils.deepCopyNode(FileSystemManager.getFsData()),
            commandHistory: HistoryManager.getFullHistory(),
        };
        if (
            StorageManager.saveItem(
                _getManualUserTerminalStateKey(currentUser),
                manualStateData,
                `Manual save for ${currentUser.name}`
            )
        )
            return {
                success: true,
                message: `${Config.MESSAGES.SESSION_SAVED_FOR_PREFIX}${currentUser.name}.`,
            };
        else
            return {
                success: false,
                error: "Failed to save session manually.",
            };
    }

    /**
     * Loads a manually saved session state, including the file system.
     * @returns {Promise<{success: boolean, message: string}>}
     * @async
     */
    async function loadManualState() {
        const currentUser = UserManager.getCurrentUser();
        const manualStateData = StorageManager.loadItem(
            _getManualUserTerminalStateKey(currentUser),
            `Manual save for ${currentUser.name}`
        );
        if (manualStateData) {
            if (manualStateData.user && manualStateData.user !== currentUser.name) {
                await OutputManager.appendToOutput(
                    `Warning: Saved state is for user '${manualStateData.user}'. Current user is '${currentUser.name}'. Load aborted. Use 'login ${manualStateData.user}' then 'loadstate'.`,
                    {
                        typeClass: Config.CSS_CLASSES.WARNING_MSG,
                    }
                );
                return {
                    success: false,
                    message: `Saved state user mismatch. Current: ${currentUser.name}, Saved: ${manualStateData.user}.`,
                };
            }
            ModalManager.request({
                context: "terminal",
                messageLines: [
                    `Load manually saved state for '${currentUser.name}'? This overwrites current session & filesystem.`,
                ],
                data: {
                    pendingData: manualStateData,
                    userNameToRestoreTo: currentUser.name,
                },
                onConfirm: async (data) => {
                    FileSystemManager.setFsData(
                        Utils.deepCopyNode(data.pendingData.fsDataSnapshot) || {
                            [Config.FILESYSTEM.ROOT_PATH]: {
                                type: Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
                                children: {},
                                owner: data.userNameToRestoreTo,
                                mode: Config.FILESYSTEM.DEFAULT_DIR_MODE,
                                mtime: new Date().toISOString(),
                            },
                        }
                    );
                    FileSystemManager.setCurrentPath(
                        data.pendingData.currentPath || Config.FILESYSTEM.ROOT_PATH
                    );
                    if (DOM.outputDiv)
                        DOM.outputDiv.innerHTML = data.pendingData.outputHTML || "";
                    TerminalUI.setCurrentInputValue(data.pendingData.currentInput || "");
                    HistoryManager.setHistory(data.pendingData.commandHistory || []);
                    await FileSystemManager.save(data.userNameToRestoreTo);
                    await OutputManager.appendToOutput(
                        Config.MESSAGES.SESSION_LOADED_MSG,
                        {
                            typeClass: Config.CSS_CLASSES.SUCCESS_MSG,
                        }
                    );
                    TerminalUI.updatePrompt();
                    if (DOM.outputDiv)
                        DOM.outputDiv.scrollTop = DOM.outputDiv.scrollHeight;
                },
                onCancel: () => {
                    OutputManager.appendToOutput(Config.MESSAGES.LOAD_STATE_CANCELLED, {
                        typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                    });
                },
            });
            return {
                success: true,
                message: "Confirmation requested for loading state.",
            };
        } else
            return {
                success: false,
                message: `${Config.MESSAGES.NO_MANUAL_SAVE_FOUND_PREFIX}${currentUser.name}.`,
            };
    }

    /**
     * Clears all saved session data for a specific user from localStorage.
     * @param {string} username - The user whose data should be cleared.
     * @returns {boolean} True on success.
     */
    function clearUserSessionStates(username) {
        if (!username || typeof username !== "string") {
            console.warn(
                "SessionManager.clearUserSessionStates: Invalid username provided.",
                username
            );
            return false;
        }
        try {
            StorageManager.removeItem(_getAutomaticSessionStateKey(username));
            StorageManager.removeItem(_getManualUserTerminalStateKey(username));
            const users = StorageManager.loadItem(
                Config.STORAGE_KEYS.USER_CREDENTIALS,
                "User list",
                {}
            );
            if (users.hasOwnProperty(username)) {
                delete users[username];
                StorageManager.saveItem(
                    Config.STORAGE_KEYS.USER_CREDENTIALS,
                    users,
                    "User list"
                );
            }
            return true;
        } catch (e) {
            console.error(`Error clearing session states for user '${username}':`, e);
            return false;
        }
    }

    /**
     * Performs a full "factory reset" of the entire OS, clearing all data from
     * localStorage and IndexedDB, then triggering a page reload.
     * @async
     */
    async function performFullReset() {
        OutputManager.clearOutput();
        TerminalUI.clearInput();
        const allKeys = StorageManager.getAllLocalStorageKeys();

        // DEFINITIVE FIX: Use a prefix to robustly identify all OS-related keys.
        const OS_KEY_PREFIX = 'oopisOs';

        allKeys.forEach((key) => {
            // Remove any key that starts with our OS prefix.
            // This is more robust than a hardcoded list.
            // The Gemini API key ("oopisGeminiApiKey") does not match and will be preserved.
            if (key.startsWith(OS_KEY_PREFIX)) {
                StorageManager.removeItem(key);
            }
        });

        await OutputManager.appendToOutput(
            "All session states, credentials, aliases, groups, and editor settings cleared from local storage."
        );
        try {
            await FileSystemManager.clearAllFS();
            await OutputManager.appendToOutput(
                "All user filesystems cleared from DB."
            );
        } catch (error) {
            await OutputManager.appendToOutput(
                `Warning: Could not fully clear all user filesystems from DB. Error: ${error.message}`,
                {
                    typeClass: Config.CSS_CLASSES.WARNING_MSG,
                }
            );
        }
        await OutputManager.appendToOutput("Reset complete. Rebooting OopisOS...", {
            typeClass: Config.CSS_CLASSES.SUCCESS_MSG,
        });
        TerminalUI.setInputState(false);
        if (DOM.inputLineContainerDiv) {
            DOM.inputLineContainerDiv.classList.add(Config.CSS_CLASSES.HIDDEN);
        }
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    }

    return {
        initializeStack,
        getStack,
        pushUserToStack,
        popUserFromStack,
        getCurrentUserFromStack,
        clearUserStack,
        saveAutomaticState,
        loadAutomaticState,
        saveManualState,
        loadManualState,
        clearUserSessionStates,
        performFullReset,
    };
})();