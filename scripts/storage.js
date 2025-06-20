/**
 * @file Manages all data persistence for OopisOS, providing wrappers for both
 * localStorage (for session data, users, settings) and IndexedDB (for the file system).
 * @module Storage
 */

/**
 * @module StorageManager
 * @description Provides a robust, error-handling wrapper around the browser's `localStorage` API.
 * It is used for storing simple key-value data like user credentials, session states, and settings.
 */
const StorageManager = (() => {
    "use strict";

    /**
     * Loads an item from localStorage, parsing it from JSON if possible.
     * @param {string} key - The key of the item to load.
     * @param {string} itemName - A human-readable name for the item, used in error messages.
     * @param {*} [defaultValue=null] - The value to return if the item is not found or an error occurs.
     * @returns {*} The loaded and parsed value, or the defaultValue.
     */
    function loadItem(key, itemName, defaultValue = null) {
        try {
            const storedValue = localStorage.getItem(key);
            if (storedValue !== null) {
                // Handle specific non-JSON values first
                if (key === Config.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED)
                    return storedValue === "true";
                // Attempt to parse as JSON, fall back to returning the raw string on error
                try {
                    return JSON.parse(storedValue);
                } catch (e) {
                    return storedValue;
                }
            }
        } catch (e) {
            const errorMsg = `Warning: Could not load ${itemName} for key '${key}' from localStorage. Error: ${e.message}. Using default value.`;
            if (
                typeof OutputManager !== "undefined" &&
                typeof void OutputManager.appendToOutput === "function"
            )
                void OutputManager.appendToOutput(errorMsg, {
                    typeClass: Config.CSS_CLASSES.WARNING_MSG,
                });
            else console.warn(errorMsg);
        }
        return defaultValue;
    }

    /**
     * Saves an item to localStorage, converting objects to JSON strings.
     * @param {string} key - The key under which to save the data.
     * @param {*} data - The data to save. Objects will be stringified.
     * @param {string} itemName - A human-readable name for the item, used in error messages.
     * @returns {boolean} True if the save was successful, false otherwise.
     */
    function saveItem(key, data, itemName) {
        try {
            const valueToStore =
                typeof data === "object" && data !== null
                    ? JSON.stringify(data)
                    : String(data);
            localStorage.setItem(key, valueToStore);
            return true;
        } catch (e) {
            const errorMsg = `Error saving ${itemName} for key '${key}' to localStorage. Data may be lost. Error: ${e.message}`;
            if (
                typeof OutputManager !== "undefined" &&
                typeof OutputManager.appendToOutput === "function"
            )
                void OutputManager.appendToOutput(errorMsg, {
                    typeClass: Config.CSS_CLASSES.ERROR_MSG,
                });
            else console.error(errorMsg);
        }
        return false;
    }

    /**
     * Removes an item from localStorage.
     * @param {string} key - The key of the item to remove.
     */
    function removeItem(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn(
                `StorageManager: Could not remove item for key '${key}'. Error: ${e.message}`
            );
        }
    }

    /**
     * Retrieves all keys currently stored in localStorage.
     * @returns {string[]} An array of all keys.
     */
    function getAllLocalStorageKeys() {
        const keys = [];
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key !== null) keys.push(key);
            }
        } catch (e) {
            console.error(
                `StorageManager: Could not retrieve all localStorage keys. Error: ${e.message}`
            );
        }
        return keys;
    }

    return {
        loadItem,
        saveItem,
        removeItem,
        getAllLocalStorageKeys,
    };
})();

/**
 * @module IndexedDBManager
 * @description Manages the connection to the IndexedDB database, which is used for
 * storing the entire OopisOS virtual file system.
 */
const IndexedDBManager = (() => {
    "use strict";
    /** @private @type {IDBDatabase|null} */
    let dbInstance = null;
    /** @private @type {boolean} */
    let hasLoggedNormalInitialization = false;

    /**
     * Initializes the IndexedDB database connection. This should be called once at startup.
     * It handles database creation, version upgrades, and connection success/error events.
     * @returns {Promise<IDBDatabase>} A promise that resolves with the database instance on success.
     */
    function init() {
        return new Promise((resolve, reject) => {
            if (dbInstance) {
                resolve(dbInstance);
                return;
            }
            if (!window.indexedDB) {
                const errorMsg =
                    "Error: IndexedDB is not supported by your browser. File system features will be unavailable.";
                if (
                    typeof OutputManager !== "undefined" &&
                    typeof OutputManager.appendToOutput === "function"
                )
                    void OutputManager.appendToOutput(errorMsg, {
                        typeClass: Config.CSS_CLASSES.ERROR_MSG,
                    });
                else console.error(errorMsg);
                reject(new Error("IndexedDB not supported."));
                return;
            }
            const request = indexedDB.open(
                Config.DATABASE.NAME,
                Config.DATABASE.VERSION
            );

            // Handles database creation and version upgrades.
            request.onupgradeneeded = (event) => {
                const tempDb = event.target.result;
                if (!tempDb.objectStoreNames.contains(Config.DATABASE.FS_STORE_NAME))
                    tempDb.createObjectStore(Config.DATABASE.FS_STORE_NAME, {
                        keyPath: "id",
                    });
            };

            // Handles a successful database connection.
            request.onsuccess = (event) => {
                dbInstance = event.target.result;
                if (!hasLoggedNormalInitialization) {
                    if (
                        typeof OutputManager !== "undefined" &&
                        typeof OutputManager.appendToOutput === "function"
                    )
                        setTimeout(
                            () =>
                                OutputManager.appendToOutput("FileSystem DB initialized.", {
                                    typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                                }),
                            100
                        );
                    else
                        console.log(
                            "FileSystem DB initialized (OutputManager not ready for terminal log)."
                        );
                    hasLoggedNormalInitialization = true;
                }
                resolve(dbInstance);
            };

            // Handles errors during database connection.
            request.onerror = (event) => {
                const errorMsg =
                    "Error: OopisOs could not access its file system storage. This might be due to browser settings (e.g., private Browse mode, disabled storage, or full storage). Please check your browser settings and try again. Some features may be unavailable.";
                if (
                    typeof OutputManager !== "undefined" &&
                    typeof OutputManager.appendToOutput === "function"
                )
                    void OutputManager.appendToOutput(errorMsg, {
                        typeClass: Config.CSS_CLASSES.ERROR_MSG,
                    });
                else console.error(errorMsg);
                console.error("IndexedDB Database error details: ", event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Returns the active IndexedDB database instance.
     * @throws {Error} If the database has not been initialized.
     * @returns {IDBDatabase} The active database instance.
     */
    function getDbInstance() {
        if (!dbInstance) {
            const errorMsg =
                "Error: OopisOs file system storage (IndexedDB) is not available. Please ensure browser storage is enabled and the page is reloaded.";
            if (
                typeof OutputManager !== "undefined" &&
                typeof OutputManager.appendToOutput === "function"
            )
                void OutputManager.appendToOutput(errorMsg, {
                    typeClass: Config.CSS_CLASSES.ERROR_MSG,
                });
            else console.error(errorMsg);
            throw new Error(Config.INTERNAL_ERRORS.DB_NOT_INITIALIZED_FS_LOAD);
        }
        return dbInstance;
    }
    return {
        init,
        getDbInstance,
    };
})();