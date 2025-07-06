// scripts/config.js
/**
 * @file Manages all static and dynamic configuration for OopisOS.
 * @module Config
 */

const Config = (() => {
    "use strict";

    /**
     * The default configuration object for the entire OS.
     * Contains settings for the database, OS metadata, user constraints,
     * terminal behavior, storage keys, CSS classes, file system parameters,
     * and predefined messages.
     * @private
     * @type {object}
     */
    const defaultConfig = {
        /** Database settings for IndexedDB. */
        DATABASE: {
            NAME: "OopisOsDB",
            VERSION: 20,
            FS_STORE_NAME: "FileSystemsStore",
            UNIFIED_FS_KEY: "OopisOS_SharedFS",
        },
        /** Core OS metadata. */
        OS: {
            NAME: "OopisOs",
            VERSION: "3.7",
            DEFAULT_HOST_NAME: "OopisOs",
        },
        /** User-related constants and constraints. */
        USER: {
            DEFAULT_NAME: "Guest",
            RESERVED_USERNAMES: ["guest", "root", "admin", "system"],
            MIN_USERNAME_LENGTH: 3,
            MAX_USERNAME_LENGTH: 20,
        },
        /** Sudo-related configuration. */
        SUDO: {
            SUDOERS_PATH: "/etc/sudoers",
            DEFAULT_TIMEOUT: 15, // In minutes
            AUDIT_LOG_PATH: "/var/log/sudo.log",
        },
        /** Terminal appearance and behavior settings. */
        TERMINAL: {
            MAX_HISTORY_SIZE: 50,
            PROMPT_CHAR: ">",
            PROMPT_SEPARATOR: ":",
            PROMPT_AT: "@",
        },
        /** Keys used for storing data in localStorage. */
        STORAGE_KEYS: {
            USER_CREDENTIALS: "oopisOsUserCredentials",
            USER_TERMINAL_STATE_PREFIX: "oopisOsUserTerminalState_",
            MANUAL_TERMINAL_STATE_PREFIX: "oopisOsManualUserTerminalState_",
            EDITOR_WORD_WRAP_ENABLED: "oopisOsEditorWordWrapEnabled",
            ALIAS_DEFINITIONS: "oopisOsAliasDefinitions",
            GEMINI_API_KEY: "oopisGeminiApiKey",
            USER_GROUPS: "oopisOsUserGroups",
        },
        /** CSS classes used for styling terminal output and UI components. */
        CSS_CLASSES: {
            ERROR_MSG: "text-error",
            SUCCESS_MSG: "text-success",
            CONSOLE_LOG_MSG: "text-subtle",
            WARNING_MSG: "text-warning",
            EDITOR_MSG: "text-info",
            DIR_ITEM: "text-dir",
            FILE_ITEM: "text-file",
            OUTPUT_LINE: "terminal__output-line",
            HIDDEN: "hidden",
            // Paint App specific classes
            ACTIVE_TOOL: "active",
            GRID_ACTIVE: "grid-active",
            // Chidi App specific classes
            DROPDOWN_ACTIVE: "paint-dropdown-active" // Reused for Chidi dropdown
        },
        /** File system constants and default values. */
        FILESYSTEM: {
            ROOT_PATH: "/",
            CURRENT_DIR_SYMBOL: ".",
            PARENT_DIR_SYMBOL: "..",
            DEFAULT_DIRECTORY_TYPE: "directory",
            DEFAULT_FILE_TYPE: "file",
            PATH_SEPARATOR: "/",
            DEFAULT_FILE_MODE: 0o644,
            DEFAULT_DIR_MODE: 0o755,
            DEFAULT_SCRIPT_MODE: 0o755,
            DEFAULT_SH_MODE: 0o755,
            PERMISSION_BIT_READ: 0b100,
            PERMISSION_BIT_WRITE: 0b010,
            PERMISSION_BIT_EXECUTE: 0b001,
            MAX_VFS_SIZE: 640 * 1024 * 1024,
            MAX_SCRIPT_STEPS: 10000,
        },
        /** Predefined messages for various command outputs and system events. */
        MESSAGES: {
            PERMISSION_DENIED_SUFFIX: ": You aren't allowed to do that.",
            CONFIRMATION_PROMPT: "Type 'YES' (all caps) if you really wanna go through with this.",
            OPERATION_CANCELLED: "Nevermind.",
            ALREADY_LOGGED_IN_AS_PREFIX: "I'm sure you didn't notice, but, '",
            ALREADY_LOGGED_IN_AS_SUFFIX: "' is already here.",
            NO_ACTION_TAKEN: "I didn't do anything.",
            ALREADY_IN_DIRECTORY_PREFIX: "Already in '",
            ALREADY_IN_DIRECTORY_SUFFIX: "'.",
            DIRECTORY_EMPTY: "Nothing here",
            TIMESTAMP_UPDATED_PREFIX: "Timestamp of '",
            TIMESTAMP_UPDATED_SUFFIX: "' updated.",
            FILE_CREATED_SUFFIX: "' forged.",
            ITEM_REMOVED_SUFFIX: "' destroyed.",
            FORCIBLY_REMOVED_PREFIX: "Decimated '",
            FORCIBLY_REMOVED_SUFFIX: "'.",
            REMOVAL_CANCELLED_PREFIX: "Eradication of '",
            REMOVAL_CANCELLED_SUFFIX: "' cancelled.",
            MOVED_PREFIX: "Moved '",
            MOVED_TO: "' to '",
            MOVED_SUFFIX: "'.",
            COPIED_PREFIX: "Copied '",
            COPIED_TO: "' to '",
            COPIED_SUFFIX: "'.",
            SESSION_SAVED_FOR_PREFIX: "Session manually saved for ",
            SESSION_LOADED_MSG: "Session loaded from manual save.",
            LOAD_STATE_CANCELLED: "Load state cancelled.",
            NO_MANUAL_SAVE_FOUND_PREFIX: "No manually saved state found for ",
            WELCOME_PREFIX: "Guten Tag,",
            WELCOME_SUFFIX: "! Type 'help' for commands.",
            EXPORTING_PREFIX: "Exporting '",
            EXPORTING_SUFFIX: "'... Check your browser downloads.",
            BACKUP_CREATING_PREFIX: "Creating backup '",
            BACKUP_CREATING_SUFFIX: "'... Check your browser downloads.",
            RESTORE_CANCELLED_NO_FILE: "Restore cancelled: No file selected.",
            RESTORE_SUCCESS_PREFIX: "Session for user '",
            RESTORE_SUCCESS_MIDDLE: "' successfully restored from '",
            RESTORE_SUCCESS_SUFFIX: "'.",
            UPLOAD_NO_FILE: "Upload cancelled: No file selected.",
            UPLOAD_INVALID_TYPE_PREFIX: "Error: Invalid file type '",
            UPLOAD_INVALID_TYPE_SUFFIX: "'. Only .txt, .md, .html, .sh, .js, .css, .json files are allowed.",
            UPLOAD_SUCCESS_PREFIX: "File '",
            UPLOAD_SUCCESS_MIDDLE: "' uploaded successfully to '",
            UPLOAD_SUCCESS_SUFFIX: "'.",
            UPLOAD_READ_ERROR_PREFIX: "Error reading file '",
            UPLOAD_READ_ERROR_SUFFIX: "'.",
            NO_COMMANDS_IN_HISTORY: "No commands in history.",
            EDITOR_DISCARD_CONFIRM: "Care to save your work?",
            BACKGROUND_PROCESS_STARTED_PREFIX: "[",
            BACKGROUND_PROCESS_STARTED_SUFFIX: "] Backgrounded.",
            BACKGROUND_PROCESS_OUTPUT_SUPPRESSED: "[Output suppressed for background process]",
            PIPELINE_ERROR_PREFIX: "Pipeline error in command: ",
            PASSWORD_PROMPT: "What's the password?",
            PASSWORD_CONFIRM_PROMPT: "Can you repeat that?",
            PASSWORD_MISMATCH: "You're mixed up, kid. The passwords don't match.",
            INVALID_PASSWORD: "Nope, sorry. Are you sure you typed it right?.",
            EMPTY_PASSWORD_NOT_ALLOWED: "You gonna talk or what?",
        },
        /** Predefined internal error messages for debugging. */
        INTERNAL_ERRORS: {
            DB_NOT_INITIALIZED_FS_SAVE: "DB not initialized for FS save",
            DB_NOT_INITIALIZED_FS_LOAD: "DB not initialized for FS load",
            DB_NOT_INITIALIZED_FS_DELETE: "DB not initialized for FS delete",
            DB_NOT_INITIALIZED_FS_CLEAR: "DB not initialized for clearing all FS",
            CORRUPTED_FS_DATA_PRE_SAVE: "Corrupted FS data before saving.",
            SOURCE_NOT_FOUND_IN_PARENT_PREFIX: "internal error: source '",
            SOURCE_NOT_FOUND_IN_PARENT_MIDDLE: "' not found in parent '",
            SOURCE_NOT_FOUND_IN_PARENT_SUFFIX: "'",
        },
        /** API endpoint configuration. */
        API: {
            GEMINI_URL: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
            // --- NEW ---
            LLM_PROVIDERS: {
                'gemini': {
                    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
                    defaultModel: "gemini-2.5-flash" // You can keep this for consistency
                },
                'ollama': {
                    url: "http://localhost:11434/api/generate",
                    defaultModel: "gemma3:12b" // Or whatever model the user wants to default to
                },
                'llm-studio': {
                    url: "http://localhost:1234/v1/chat/completions",
                    defaultModel: "lmstudio-community/gemma-2b-it-v1.1-gguf" // Example model
                }
            }
            // --- END NEW ---
        },
        COMMANDS_MANIFEST: [
            "adventure", "alias", "awk", "backup", "basic", "bc", "cat", "cd", "check_fail",
            "chgrp", "chidi", "chmod", "chown","cksum", "clear", "clearfs", "cp", "csplit",
            "curl", "date", "delay", "df", "diff", "du", "echo", "edit", "explore",
            "export", "find", "gemini", "grep", "groupadd", "groupdel",
            "groups", "head", "help", "history", "kill", "less", "listusers",
            "loadstate", "log", "login", "logout", "ls", "man", "more", "mkdir", "mv",
            "ocrypt","paint", "passwd", "printscreen", "ps", "pwd", "reboot",
            "removeuser", "reset", "restore", "rm", "rmdir", "run", "savefs",
            "savestate", "set", "shuf", "sort", "su", "sudo", "sync", "tail", "touch",
            "tree", "unalias", "uniq", "unset", "unzip", "upload", "useradd", "usermod",
            "visudo", "wc", "wget", "whoami", "zip", "xargs"
        ],
        // --- NEW: Editor App Configuration ---
        EditorAppConfig: {
            EDITOR: {
                DEFAULT_MODE: "text",
                MODES: {
                    TEXT: "text",
                    MARKDOWN: "markdown",
                    HTML: "html",
                },
                VIEW_MODES: {
                    SPLIT: "split",
                    EDIT_ONLY: "edit-only",
                    PREVIEW_ONLY: "preview-only",
                },
                WORD_WRAP_DEFAULT_ENABLED: true,
                DEBOUNCE_DELAY_MS: 300,
                MAX_UNDO_STATES: 100,
                TAB_REPLACEMENT: "  ", // 2 spaces for tab
                FIND_DEBOUNCE_DELAY_MS: 150,
            },
            STORAGE_KEYS: {
                EDITOR_WORD_WRAP_ENABLED: "oopisOsEditorWordWrapEnabled",
            },
        },
        // --- END NEW ---

        // --- NEW: Paint App Configuration ---
        PaintAppConfig: {
            CANVAS: {
                DEFAULT_WIDTH: 80,
                DEFAULT_HEIGHT: 24,
                BASE_FONT_SIZE_PX: 16,
            },
            BRUSH: {
                DEFAULT_SIZE: 1,
                MIN_SIZE: 1,
                MAX_SIZE: 5,
            },
            ZOOM: {
                DEFAULT_ZOOM: 100,
                MIN_ZOOM: 50,
                MAX_ZOOM: 400,
                ZOOM_STEP: 25,
            },
            PALETTE: [
                { name: "Green", value: "#00ff5b" },
                { name: "White", value: "#ffffff" },
                { name: "Light Gray", value: "#a3a3a3" },
                { name: "Dark Gray", value: "#737373" },
                { name: "Black", value: "#0a0a0a" },
                { name: "Red", value: "#ef4444" },
                { name: "Blue",
                    value: "#38bdf8" },
                { name: "Yellow", value: "#fbbF24" },
                { name: "Lime", value: "#a3e635" },
            ],
            CUSTOM_COLOR_GRID: [
                "#FF0000", "#FF4500", "#FFA500", "#FFD700", "#FFFF00", "#ADFF2F", "#00FF00", "#32CD32", "#008000",
                "#00FF7F", "#00FFFF", "#00CED1", "#4682B4", "#1E90FF", "#0000FF", "#8A2BE2", "#9400D3", "#FF00FF",
                "#FF1493", "#FF69B4", "#FA8072", "#F0E68C", "#FFFACD", "#DDA0DD", "#ADD8E6", "#F5DEB3", "#D2B48C",
                "#C0C0C0", "#808080", "#000000"
            ],
            DEFAULT_CHAR: ' ',
            ERASER_CHAR: ' ',
            DEFAULT_FG_COLOR: '#00ff5b',
            DEFAULT_BG_COLOR: 'bg-transparent',
            ERASER_BG_COLOR: 'bg-black',
            FILE_EXTENSION: 'oopic',
            EDITOR: { // Reusing some editor config for consistency, though not strictly needed here
                MAX_UNDO_STATES: 100,
                DEBOUNCE_DELAY_MS: 300,
            },
            ASCII_CHAR_RANGE: {
                START: 32, // Space
                END: 126   // Tilde
            }
        },
        // --- END NEW ---
    };

    /**
     * Parses a string value from the config file into a boolean, number, or string.
     * @private
     * @param {string} valueStr - The string value to parse.
     * @returns {boolean|number|string} The parsed value.
     */
    function parseConfigValue(valueStr) {
        if (typeof valueStr !== "string") return valueStr;

        const lowercasedVal = valueStr.toLowerCase();
        if (lowercasedVal === "true") return true;
        if (lowercasedVal === "false") return false;

        const num = Number(valueStr);
        if (!isNaN(num) && valueStr.trim() !== "") {
            return num;
        }
        return valueStr;
    }

    /**
     * Sets a property on a nested object using a dot-separated path string.
     * @private
     * @param {object} obj - The object to modify.
     * @param {string} path - The dot-separated path (e.g., "TERMINAL.PROMPT_CHAR").
     * @param {*} value - The value to set at the specified path.
     */
    function setNestedProperty(obj, path, value) {
        const parts = path.split(".");
        let current = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]] || typeof current[parts[i]] !== "object") {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }
        current[parts.length - 1] = parseConfigValue(value);
    }

    /**
     * Asynchronously loads and applies configuration settings from the `/etc/oopis.conf`
     * file within the virtual file system, overriding the default values.
     * @async
     */
    async function loadFromFile() {
        const configFilePath = "/etc/oopis.conf";
        try {
            const configNode = FileSystemManager.getNodeByPath(configFilePath);
            if (!configNode) {
                console.warn(
                    `Config: '${configFilePath}' not found. Using default configuration.`
                );
                return;
            }
            if (configNode.type !== defaultConfig.FILESYSTEM.DEFAULT_FILE_TYPE) {
                console.warn(
                    `Config: '${configFilePath}' is not a file. Using default configuration.`
                );
                return;
            }
            const currentUser = UserManager.getCurrentUser().name;
            if (!FileSystemManager.hasPermission(configNode, currentUser, "read")) {
                console.warn(
                    `Config: Permission denied to read '${configFilePath}'. Using default configuration.`
                );
                return;
            }
            const content = configNode.content || "";
            const lines = content.split("\n");
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith("#") || trimmedLine === "") {
                    continue;
                }
                const parts = trimmedLine.split("=");
                if (parts.length >= 2) {
                    const key = parts[0].trim();
                    const value = parts.slice(1).join("=").trim();
                    let tempCheck = defaultConfig;
                    let keyExistsInDefaults = true;
                    const keyParts = key.split(".");
                    for (const part of keyParts) {
                        if (
                            tempCheck &&
                            typeof tempCheck === "object" &&
                            tempCheck.hasOwnProperty(part)
                        ) {
                            tempCheck = tempCheck[part];
                        } else {
                            keyExistsInDefaults = false;
                            break;
                        }
                    }
                    if (keyExistsInDefaults) {
                        setNestedProperty(currentConfig, key, value);
                    } else {
                        console.warn(`Config: Unknown or invalid key path '${key}' in '${configFilePath}'. Ignoring.`);
                    }
                } else {
                    console.warn(`Config: Malformed line in '${configFilePath}': '${trimmedLine}'. Ignoring.`);
                }
            }
            console.log(`Config: Configuration loaded from '${configFilePath}'.`);
        } catch (error) {
            console.error(
                `Config: Error loading or parsing '${configFilePath}':`,
                error
            );
        }
    }

    /**
     * The public interface for the Config module.
     * @property {function} loadFromFile - Function to load config from the VFS.
     * @property {object} DATABASE - Database configuration.
     * @property {object} OS - OS metadata.
     * @property {object} USER - User-related constants.
     * @property {object} TERMINAL - Terminal behavior settings.
     * @property {object} STORAGE_KEYS - Keys for localStorage.
     * @property {object} CSS_CLASSES - CSS classes for styling.
     * @property {object} FILESYSTEM - File system constants.
     * @property {object} MESSAGES - Predefined system messages.
     * @property {object} INTERNAL_ERRORS - Internal error messages.
     * @property {object} API - API endpoint configuration.
     */
    return {
        ...currentConfig,
        loadFromFile,
    };
})();