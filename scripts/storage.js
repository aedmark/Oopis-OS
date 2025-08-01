// /scripts/storage.js

class StorageManager {
  constructor() {
    this.dependencies = {};
  }

  setDependencies(dependencies) {
    this.dependencies = dependencies;
  }

  loadItem(key, itemName, defaultValue = null) {
    const { Config, OutputManager } = this.dependencies;
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

  saveItem(key, data, itemName) {
    const { Config, OutputManager } = this.dependencies;
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

  removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(
          `StorageManager: Could not remove item for key '${key}'. Error: ${e.message}`
      );
    }
  }

  getAllLocalStorageKeys() {
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
}

class IndexedDBManager {
  constructor() {
    this.dbInstance = null;
    this.hasLoggedNormalInitialization = false;
    this.dependencies = {};
  }

  setDependencies(dependencies) {
    this.dependencies = dependencies;
  }

  init() {
    const { Config, OutputManager } = this.dependencies;
    return new Promise((resolve, reject) => {
      if (this.dbInstance) {
        resolve(this.dbInstance);
        return;
      }
      if (!window.indexedDB) {
        const errorMsg = "Error: IndexedDB is not supported by your browser. File system features will be unavailable.";
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
        this.dbInstance = event.target.result;
        if (!this.hasLoggedNormalInitialization) {
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
          this.hasLoggedNormalInitialization = true;
        }
        resolve(this.dbInstance);
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

  getDbInstance() {
    const { Config, OutputManager } = this.dependencies;
    if (!this.dbInstance) {
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
    return this.dbInstance;
  }
}