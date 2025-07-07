const EnvironmentManager = (() => {
    "use strict";
    let envStack = [{}];

    function _getActiveEnv() {
        return envStack[envStack.length - 1];
    }

    function push() {
        // Push a clone of the current environment to create a new scope
        envStack.push(JSON.parse(JSON.stringify(_getActiveEnv())));
    }

    function pop() {
        if (envStack.length > 1) {
            envStack.pop();
        } else {
            console.error("EnvironmentManager: Attempted to pop the base environment stack.");
        }
    }

    function initialize() {
        const baseEnv = {};
        const currentUser = UserManager.getCurrentUser().name;
        baseEnv['USER'] = currentUser;
        baseEnv['HOME'] = `/home/${currentUser}`;
        baseEnv['HOST'] = Config.OS.DEFAULT_HOST_NAME;
        baseEnv['PATH'] = '/bin:/usr/bin';
        // Reset the stack with the new base environment
        envStack = [baseEnv];
    }

    function get(varName) {
        return _getActiveEnv()[varName] || '';
    }

    function set(varName, value) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varName)) {
            return { success: false, error: `Invalid variable name: '${varName}'. Must start with a letter or underscore, followed by letters, numbers, or underscores.` };
        }
        _getActiveEnv()[varName] = value;
        return { success: true };
    }

    function unset(varName) {
        delete _getActiveEnv()[varName];
    }

    function getAll() {
        return { ..._getActiveEnv() };
    }

    function load(vars) {
        envStack[envStack.length - 1] = { ...(vars || {}) };
    }

    function clear() {
        envStack[envStack.length - 1] = {};
    }

    return {
        initialize,
        get,
        set,
        unset,
        getAll,
        load,
        clear,
        push,
        pop
    };
})();

const HistoryManager = (() => {
    "use strict";
    let commandHistory = [];
    let historyIndex = 0;

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

    function getPrevious() {
        if (commandHistory.length > 0 && historyIndex > 0) {
            historyIndex--;
            return commandHistory[historyIndex];
        }
        return null;
    }

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

    function resetIndex() {
        historyIndex = commandHistory.length;
    }

    function getFullHistory() {
        return [...commandHistory];
    }

    function clearHistory() {
        commandHistory = [];
        historyIndex = 0;
    }

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

const AliasManager = (() => {
    "use strict";
    let aliases = {};

    function initialize() {
        aliases = StorageManager.loadItem(
            Config.STORAGE_KEYS.ALIAS_DEFINITIONS,
            "Aliases",
            {}
        );
    }

    function _save() {
        StorageManager.saveItem(
            Config.STORAGE_KEYS.ALIAS_DEFINITIONS,
            aliases,
            "Aliases"
        );
    }

    function setAlias(name, value) {
        if (!name || typeof value !== "string") return false;
        aliases[name] = value;
        _save();
        return true;
    }

    function removeAlias(name) {
        if (!aliases[name]) return false;
        delete aliases[name];
        _save();
        return true;
    }

    function getAlias(name) {
        return aliases[name] || null;
    }

    function getAllAliases() {
        return { ...aliases };
    }

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

const SessionManager = (() => {
    "use strict";
    let userSessionStack = [];

    function initializeStack() {
        userSessionStack = [Config.USER.DEFAULT_NAME];
    }


    function getStack() {
        return userSessionStack;
    }

    function pushUserToStack(username) {
        userSessionStack.push(username);
    }

    function popUserFromStack() {
        if (userSessionStack.length > 1) {
            return userSessionStack.pop();
        }
        return null;
    }

    function getCurrentUserFromStack() {
        return userSessionStack.length > 0
            ? userSessionStack[userSessionStack.length - 1]
            : Config.USER.DEFAULT_NAME;
    }

    function clearUserStack(username) {
        userSessionStack = [username];
    }

    function _getAutomaticSessionStateKey(user) {
        return `${Config.STORAGE_KEYS.USER_TERMINAL_STATE_PREFIX}${user}`;
    }


    function _getManualUserTerminalStateKey(user) {
        const userName =
            typeof user === "object" && user !== null && user.name
                ? user.name
                : String(user);
        return `${Config.STORAGE_KEYS.MANUAL_TERMINAL_STATE_PREFIX}${userName}`;
    }

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

            const newEnv = {};
            newEnv['USER'] = username;
            newEnv['HOME'] = `/home/${username}`;
            newEnv['HOST'] = Config.OS.DEFAULT_HOST_NAME;
            newEnv['PATH'] = '/bin:/usr/bin';
            EnvironmentManager.load(newEnv);

            void OutputManager.appendToOutput(
                `${Config.MESSAGES.WELCOME_PREFIX} ${username}${Config.MESSAGES.WELCOME_SUFFIX}`
            );
        }
        TerminalUI.updatePrompt();
        if (DOM.outputDiv) DOM.outputDiv.scrollTop = DOM.outputDiv.scrollHeight;
        return !!autoState;
    }

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

    async function performFullReset() {
        OutputManager.clearOutput();
        TerminalUI.clearInput();
        const allKeys = StorageManager.getAllLocalStorageKeys();

        const OS_KEY_PREFIX = 'oopisOs';

        allKeys.forEach((key) => {
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