// scripts/storage_hal.js

/**
 * @abstract
 * The Storage Hardware Abstraction Layer (HAL) interface.
 * Defines the contract for all storage backends for the FileSystemManager.
 */
class StorageHAL {
    constructor() {
        if (this.constructor === StorageHAL) {
            throw new Error("Abstract classes can't be instantiated.");
        }
    }
    /**
     * Initializes the storage backend.
     * @returns {Promise<boolean>} A promise that resolves to true on success.
     */
    async init() { throw new Error("Method 'init()' must be implemented."); }

    /**
     * Loads the entire filesystem data object.
     * @returns {Promise<object|null>} A promise resolving to the filesystem data or null.
     */
    async load() { throw new Error("Method 'load()' must be implemented."); }

    /**
     * Saves the entire filesystem data object.
     * @param {object} fsData - The complete filesystem data to save.
     * @returns {Promise<boolean>} A promise that resolves to true on success.
     */
    async save(fsData) { throw new Error("Method 'save(fsData)' must be implemented."); }

    /**
     * Clears the entire filesystem storage.
     * @returns {Promise<boolean>} A promise that resolves to true on success.
     */
    async clear() { throw new Error("Method 'clear()' must be implemented."); }
}

/**
 * The default storage implementation using IndexedDB.
 */
class IndexedDBStorageHAL extends StorageHAL {
    setDependencies(dependencies) {
        this.dependencies = dependencies;
    }

    async init() {
        const { IndexedDBManager, Config, OutputManager } = this.dependencies;
        try {
            this.dbInstance = await IndexedDBManager.init();
            return true;
        } catch (e) {
            const errorMsg = `StorageHAL Error: Could not initialize IndexedDB. Error: ${e.message}.`;
            if (
                typeof OutputManager !== "undefined" &&
                typeof OutputManager.appendToOutput === "function"
            ) {
                await OutputManager.appendToOutput(errorMsg, {
                    typeClass: Config.CSS_CLASSES.ERROR_MSG,
                });
            } else {
                console.error(errorMsg);
            }
            return false;
        }
    }

    async load() {
        const { Config } = this.dependencies;
        if (!this.dbInstance) {
            console.error("IndexedDB not initialized before load.");
            return null;
        }
        return new Promise((resolve) => {
            const transaction = this.dbInstance.transaction(
                [Config.DATABASE.FS_STORE_NAME],
                "readonly"
            );
            const store = transaction.objectStore(Config.DATABASE.FS_STORE_NAME);
            const request = store.get(Config.DATABASE.UNIFIED_FS_KEY);
            request.onsuccess = (event) => {
                const result = event.target.result;
                resolve(result ? result.data : null);
            };
            request.onerror = () => {
                resolve(null);
            };
        });
    }

    async save(fsData) {
        const { Config, Utils } = this.dependencies;
        if (!this.dbInstance) {
            console.error("IndexedDB not initialized before save.");
            return false;
        }
        return new Promise((resolve) => {
            const transaction = this.dbInstance.transaction(
                [Config.DATABASE.FS_STORE_NAME],
                "readwrite"
            );
            const store = transaction.objectStore(Config.DATABASE.FS_STORE_NAME);
            const request = store.put({
                id: Config.DATABASE.UNIFIED_FS_KEY,
                data: Utils.deepCopyNode(fsData),
            });
            request.onsuccess = () => resolve(true);
            request.onerror = () => resolve(false);
        });
    }

    async clear() {
        const { Config } = this.dependencies;
        if (!this.dbInstance) {
            console.error("IndexedDB not initialized before clear.");
            return false;
        }
        return new Promise((resolve) => {
            const transaction = this.dbInstance.transaction(
                [Config.DATABASE.FS_STORE_NAME],
                "readwrite"
            );
            const store = transaction.objectStore(Config.DATABASE.FS_STORE_NAME);
            const request = store.clear();
            request.onsuccess = () => resolve(true);
            request.onerror = () => resolve(false);
        });
    }
}

window.IndexedDBStorageHAL = IndexedDBStorageHAL;