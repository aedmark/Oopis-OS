const StorageManager = (() => {
    "use strict";

    function loadItem(key, itemName, defaultValue = null) {
        try {
            const storedValue = localStorage.getItem(key);
            if (storedValue !== null) {
                if (key === Config.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED)
                    return storedValue === "true";
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
                typeof OutputManager.appendToOutput === "function"
            )
                void OutputManager.appendToOutput(errorMsg, {
                    typeClass: Config.CSS_CLASSES.WARNING_MSG,
                });
            else console.warn(errorMsg);
        }
        return defaultValue;
    }

    function saveItem(key, data, itemName) {
        try {
            const valueToStore =
                typeof data === "object" && data !== null ?
                    JSON.stringify(data) :
                    String(data);
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

    function removeItem(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn(
                `StorageManager: Could not remove item for key '${key}'. Error: ${e.message}`
            );
        }
    }

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

const IndexedDBManager = (() => {
    "use strict";

    let dbInstance = null;

    let hasLoggedNormalInitialization = false;

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

            request.onupgradeneeded = (event) => {
                const tempDb = event.target.result;
                if (!tempDb.objectStoreNames.contains(Config.DATABASE.FS_STORE_NAME))
                    tempDb.createObjectStore(Config.DATABASE.FS_STORE_NAME, {
                        keyPath: "id",
                    });
            };

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