/**
 * @file Manages the entire virtual file system for OopisOS, including its structure, persistence, and all related operations.
 * @module FileSystemManager
 * @author Andrew Edmark
 * @author Gemini
 */

const FileSystemManager = (() => {
    "use strict";
    /**
     * The in-memory representation of the entire file system.
     * @private
     * @type {object}
     */
    let fsData = {};
    /**
     * The current working directory path for the active user session.
     * @private
     * @type {string}
     */
    let currentPath = Config.FILESYSTEM.ROOT_PATH;
    /**
     * The default content for the /etc/oopis.conf file.
     * @private
     * @const {string}
     */
    const OOPIS_CONF_CONTENT = `TERMINAL.PROMPT_CHAR=>
OS.DEFAULT_HOST_NAME=OopisOS
MESSAGES.WELCOME_PREFIX=Welcome,
MESSAGES.WELCOME_SUFFIX=!`;

    /**
     * Initializes a new, default file system structure in memory if one doesn't exist.
     * Creates root, /home, /etc, and home directories for default users.
     * @param {string} guestUsername - The name of the default guest user.
     * @async
     */
    async function initialize(guestUsername) {
        const nowISO = new Date().toISOString();
        fsData = {
            [Config.FILESYSTEM.ROOT_PATH]: {
                type: Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
                children: {
                    home: {
                        type: Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
                        children: {},
                        owner: "root",
                        group: "root",
                        mode: 0o755,
                        mtime: nowISO,
                    },
                    etc: {
                        type: Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
                        children: {},
                        owner: "root",
                        group: "root",
                        mode: 0o755,
                        mtime: nowISO,
                    },
                },
                owner: "root",
                group: "root",
                mode: 0o755,
                mtime: nowISO,
            },
        };
        await createUserHomeDirectory("root");
        await createUserHomeDirectory(guestUsername);
        await createUserHomeDirectory("userDiag");
        const rootNode = fsData[Config.FILESYSTEM.ROOT_PATH];
        if (rootNode) {
            if (rootNode) {
                rootNode.children["etc"] = {
                    type: Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
                    children: {},
                    owner: "root",
                    group: "root",
                    mode: 0o755,
                    mtime: nowISO,
                };
                rootNode.mtime = nowISO;

                const etcNode = rootNode.children["etc"];
                if (etcNode) {
                    etcNode.children["oopis.conf"] = {
                        type: Config.FILESYSTEM.DEFAULT_FILE_TYPE,
                        content: OOPIS_CONF_CONTENT,
                        owner: "root",
                        group: "root",
                        mode: 0o644,
                        mtime: nowISO,
                    };
                    etcNode.mtime = nowISO;
                } else {
                    console.error("FileSystemManager: Failed to create /etc directory.");
                }
            } else {
                console.error(
                    "FileSystemManager: Root node not found during initialization. Critical error."
                );
            }
        } else {
            console.error(
                "FileSystemManager: Root node not found during initialization. Critical error."
            );
        }
    }

    /**
     * Creates a home directory for a specified user under /home if it doesn't already exist.
     * @param {string} username - The name of the user for whom to create a home directory.
     * @async
     */
    async function createUserHomeDirectory(username) {
        if (!fsData["/"]?.children?.home) {
            console.error(
                "FileSystemManager: Cannot create user home directory, /home does not exist."
            );
            return;
        }
        const homeDirNode = fsData["/"].children.home;
        if (!homeDirNode.children[username]) {
            homeDirNode.children[username] = {
                type: Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
                children: {},
                owner: username,
                group: username,
                mode: 0o700,
                mtime: new Date().toISOString(),
            };
            homeDirNode.mtime = new Date().toISOString();
        }
    }

    /**
     * Saves the current in-memory file system (fsData) to IndexedDB.
     * Rejects the promise if the operation fails.
     * @async
     * @returns {Promise<boolean>} A promise that resolves to true on success, false on failure (e.g., quota exceeded).
     */
    async function save() {
        const totalSize = _calculateTotalSize();
        if (totalSize > Config.FILESYSTEM.MAX_VFS_SIZE) {
            const errorMsg = `Disk quota exceeded. (Usage: ${Utils.formatBytes(
                totalSize
            )} / ${Utils.formatBytes(
                Config.FILESYSTEM.MAX_VFS_SIZE
            )}). Reverting last operation.`;
            await OutputManager.appendToOutput(errorMsg, {
                typeClass: Config.CSS_CLASSES.ERROR_MSG,
            });
            await load();
            return false;
        }
        let db;
        try {
            db = IndexedDBManager.getDbInstance();
        } catch (e) {
            await OutputManager.appendToOutput(
                "Error: File system storage not available for saving.",
                {
                    typeClass: Config.CSS_CLASSES.ERROR_MSG,
                }
            );
            return Promise.reject(Config.INTERNAL_ERRORS.DB_NOT_INITIALIZED_FS_SAVE);
        }
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(
                [Config.DATABASE.FS_STORE_NAME],
                "readwrite"
            );
            const store = transaction.objectStore(Config.DATABASE.FS_STORE_NAME);
            const request = store.put({
                id: Config.DATABASE.UNIFIED_FS_KEY,
                data: Utils.deepCopyNode(fsData),
            });
            request.onsuccess = () => resolve(true);
            request.onerror = (event) => {
                OutputManager.appendToOutput(
                    "Error: OopisOs failed to save the file system.",
                    {
                        typeClass: Config.CSS_CLASSES.ERROR_MSG,
                    }
                );
                reject(event.target.error);
            };
        });
    }

    /**
     * Loads the file system from IndexedDB into memory. If no saved file system is found, it initializes a new one.
     * @async
     * @returns {Promise<void>} A promise that resolves when the file system is loaded.
     */
    async function load() {
        let db;
        try {
            db = IndexedDBManager.getDbInstance();
        } catch (e) {
            await initialize(Config.USER.DEFAULT_NAME);
            return Promise.reject(Config.INTERNAL_ERRORS.DB_NOT_INITIALIZED_FS_LOAD);
        }
        return new Promise(async (resolve, reject) => {
            const transaction = db.transaction(
                [Config.DATABASE.FS_STORE_NAME],
                "readonly"
            );
            const store = transaction.objectStore(Config.DATABASE.FS_STORE_NAME);
            const request = store.get(Config.DATABASE.UNIFIED_FS_KEY);
            request.onsuccess = async (event) => {
                const result = event.target.result;
                if (result && result.data) {
                    fsData = result.data;
                } else {
                    await OutputManager.appendToOutput(
                        "No file system found. Initializing new one.",
                        {
                            typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                        }
                    );
                    await initialize(Config.USER.DEFAULT_NAME);
                    await save();
                }
                resolve();
            };
            request.onerror = async (event) => {
                await initialize(Config.USER.DEFAULT_NAME);
                reject(event.target.error);
            };
        });
    }

    /**
     * Clears the entire file system from IndexedDB. Used for system resets.
     * @async
     * @returns {Promise<boolean>} A promise that resolves to true on success.
     */
    async function clearAllFS() {
        let db;
        try {
            db = IndexedDBManager.getDbInstance();
        } catch (e) {
            await OutputManager.appendToOutput(
                "Error: File system storage not available for clearing all data.",
                {
                    typeClass: Config.CSS_CLASSES.ERROR_MSG,
                }
            );
            return Promise.reject(Config.INTERNAL_ERRORS.DB_NOT_INITIALIZED_FS_CLEAR);
        }
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(
                [Config.DATABASE.FS_STORE_NAME],
                "readwrite"
            );
            const store = transaction.objectStore(Config.DATABASE.FS_STORE_NAME);
            const request = store.clear();
            request.onsuccess = () => resolve(true);
            request.onerror = (event) => {
                console.error("Error clearing FileSystemsStore:", event.target.error);
                OutputManager.appendToOutput(
                    "Error: OopisOs could not clear all user file systems. Your data might still be present. Please try the operation again.",
                    {
                        typeClass: Config.CSS_CLASSES.ERROR_MSG,
                    }
                );
                reject(event.target.error);
            };
        });
    }

    /**
     * Gets the current working directory path.
     * @returns {string} The current path.
     */
    function getCurrentPath() {
        return currentPath;
    }

    /**
     * Sets the current working directory path.
     * @param {string} path - The new path to set.
     */
    function setCurrentPath(path) {
        currentPath = path;
    }

    /**
     * Gets the raw in-memory file system data object.
     * @returns {object} The fsData object.
     */
    function getFsData() {
        return fsData;
    }

    /**
     * Replaces the in-memory file system data object. Used for restores.
     * @param {object} newData - The new file system data object.
     */
    function setFsData(newData) {
        fsData = newData;
    }

    /**
     * Resolves a relative or absolute path to a fully qualified absolute path.
     * Handles '.', '..', and empty path segments.
     * @param {string} targetPath - The path to resolve.
     * @param {string} basePath - The base path to resolve against if targetPath is relative.
     * @returns {string} The resolved absolute path.
     */
    function getAbsolutePath(targetPath, basePath) {
        if (!targetPath) targetPath = Config.FILESYSTEM.CURRENT_DIR_SYMBOL;
        let effectiveBasePath = basePath;
        if (targetPath.startsWith(Config.FILESYSTEM.PATH_SEPARATOR))
            effectiveBasePath = Config.FILESYSTEM.ROOT_PATH;
        const baseSegments =
            effectiveBasePath === Config.FILESYSTEM.ROOT_PATH
                ? []
                : effectiveBasePath
                    .substring(1)
                    .split(Config.FILESYSTEM.PATH_SEPARATOR)
                    .filter((s) => s && s !== Config.FILESYSTEM.CURRENT_DIR_SYMBOL);
        let resolvedSegments = [...baseSegments];
        const targetSegments = targetPath.split(Config.FILESYSTEM.PATH_SEPARATOR);
        for (const segment of targetSegments) {
            if (segment === "" || segment === Config.FILESYSTEM.CURRENT_DIR_SYMBOL) {
                if (
                    targetPath.startsWith(Config.FILESYSTEM.PATH_SEPARATOR) &&
                    resolvedSegments.length === 0 &&
                    segment === ""
                ) {
                }
                continue;
            }
            if (segment === Config.FILESYSTEM.PARENT_DIR_SYMBOL) {
                if (resolvedSegments.length > 0) resolvedSegments.pop();
            } else resolvedSegments.push(segment);
        }
        if (resolvedSegments.length === 0) return Config.FILESYSTEM.ROOT_PATH;
        return (
            Config.FILESYSTEM.PATH_SEPARATOR +
            resolvedSegments.join(Config.FILESYSTEM.PATH_SEPARATOR)
        );
    }

    /**
     * Retrieves a file system node object from a given absolute path.
     * Traverses the fsData tree and respects execute permissions along the path.
     * @param {string} absolutePath - The absolute path to the node.
     * @returns {object|null} The node object if found and accessible, otherwise null.
     */
    function getNodeByPath(absolutePath) {
        const currentUser = UserManager.getCurrentUser().name;
        if (absolutePath === Config.FILESYSTEM.ROOT_PATH) {
            return fsData[Config.FILESYSTEM.ROOT_PATH];
        }
        const segments = absolutePath
            .substring(1)
            .split(Config.FILESYSTEM.PATH_SEPARATOR)
            .filter((s) => s);
        let currentNode = fsData[Config.FILESYSTEM.ROOT_PATH];
        for (const segment of segments) {
            if (!hasPermission(currentNode, currentUser, "execute")) {
                return null;
            }
            if (!currentNode.children || !currentNode.children[segment]) {
                return null;
            }
            currentNode = currentNode.children[segment];
        }
        return currentNode;
    }

    /**
     * Calculates the size of a node. For files, it's the content length.
     * For directories, it's the recursive sum of the sizes of its children.
     * @param {object} node - The file system node to measure.
     * @returns {number} The size of the node in bytes.
     */
    function calculateNodeSize(node) {
        if (!node) return 0;
        if (node.type === Config.FILESYSTEM.DEFAULT_FILE_TYPE)
            return (node.content || "").length;
        if (node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
            let totalSize = 0;
            for (const childName in node.children)
                totalSize += calculateNodeSize(node.children[childName]);
            return totalSize;
        }
        return 0;
    }

    /**
     * Updates the modification time (mtime) of a node and its direct parent.
     * @private
     * @param {string} nodePath - The absolute path of the node to update.
     * @param {string} nowISO - The ISO timestamp to set.
     */
    function _updateNodeAndParentMtime(nodePath, nowISO) {
        if (!nodePath || !nowISO) return;
        const node = getNodeByPath(nodePath);
        if (node) node.mtime = nowISO;
        if (nodePath !== Config.FILESYSTEM.ROOT_PATH) {
            const parentPath =
                nodePath.substring(
                    0,
                    nodePath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR)
                ) || Config.FILESYSTEM.ROOT_PATH;
            const parentNode = getNodeByPath(parentPath);
            if (
                parentNode &&
                parentNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
            )
                parentNode.mtime = nowISO;
        }
    }

    /**
     * Creates all non-existent parent directories for a given path, similar to `mkdir -p`.
     * @param {string} fullPath - The full path for which to create parent directories.
     * @returns {{parentNode: object|null, error: string|null}} An object containing the final parent node or an error message.
     */
    function createParentDirectoriesIfNeeded(fullPath) {
        const currentUserForCPDIF = UserManager.getCurrentUser().name;
        const nowISO = new Date().toISOString();
        if (fullPath === Config.FILESYSTEM.ROOT_PATH)
            return {
                parentNode: null,
                error: "Cannot create directory structure for root.",
            };
        const lastSlashIndex = fullPath.lastIndexOf(
            Config.FILESYSTEM.PATH_SEPARATOR
        );
        const parentPathForSegments =
            lastSlashIndex === 0
                ? Config.FILESYSTEM.ROOT_PATH
                : fullPath.substring(0, lastSlashIndex);
        const finalDirNameInPath = fullPath.substring(lastSlashIndex + 1);
        if (
            !finalDirNameInPath ||
            finalDirNameInPath === Config.FILESYSTEM.CURRENT_DIR_SYMBOL ||
            finalDirNameInPath === Config.FILESYSTEM.PARENT_DIR_SYMBOL
        ) {
        }
        if (parentPathForSegments === Config.FILESYSTEM.ROOT_PATH)
            return {
                parentNode: fsData[Config.FILESYSTEM.ROOT_PATH],
                error: null,
            };
        const segmentsToCreate = parentPathForSegments
            .substring(1)
            .split(Config.FILESYSTEM.PATH_SEPARATOR)
            .filter((s) => s);
        let currentParentNode = fsData[Config.FILESYSTEM.ROOT_PATH];
        let currentProcessedPath = Config.FILESYSTEM.ROOT_PATH;
        if (
            !currentParentNode ||
            typeof currentParentNode.owner === "undefined" ||
            typeof currentParentNode.mode === "undefined"
        )
            return {
                parentNode: null,
                error: "Internal error: Root FS node is malformed.",
            };
        for (const segment of segmentsToCreate) {
            if (
                !currentParentNode.children ||
                typeof currentParentNode.children !== "object"
            ) {
                const errorMsg = `Internal error: currentParentNode.children is not an object at path "${currentProcessedPath}" for segment "${segment}". FS may be corrupted.`;
                console.error(errorMsg, currentParentNode);
                return {
                    parentNode: null,
                    error: errorMsg,
                };
            }
            if (!currentParentNode.children[segment]) {
                if (!hasPermission(currentParentNode, currentUserForCPDIF, "write")) {
                    const errorMsg = `Cannot create directory '${segment}' in '${currentProcessedPath}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`;
                    return {
                        parentNode: null,
                        error: errorMsg,
                    };
                }
                currentParentNode.children[segment] = {
                    type: Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
                    children: {},
                    owner: currentUserForCPDIF,
                    group: currentUserForCPDIF,
                    mode: Config.FILESYSTEM.DEFAULT_DIR_MODE,
                    mtime: nowISO,
                };
                currentParentNode.mtime = nowISO;
            } else if (
                currentParentNode.children[segment].type !==
                Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
            ) {
                const errorMsg = `Path component '${getAbsolutePath(
                    segment,
                    currentProcessedPath
                )}' is not a directory.`;
                return {
                    parentNode: null,
                    error: errorMsg,
                };
            }
            currentParentNode = currentParentNode.children[segment];
            currentProcessedPath = getAbsolutePath(segment, currentProcessedPath);
            if (
                !currentParentNode ||
                typeof currentParentNode.owner === "undefined" ||
                typeof currentParentNode.mode === "undefined"
            )
                return {
                    parentNode: null,
                    error: `Internal error: Node for "${currentProcessedPath}" became malformed during parent creation.`,
                };
        }
        return {
            parentNode: currentParentNode,
            error: null,
        };
    }

    /**
     * Validates a path for a command, checking for existence, type, and permissions.
     * This is a crucial pre-execution step for most file system commands.
     * @param {string} commandName - The name of the command requesting validation.
     * @param {string} pathArg - The path argument provided to the command.
     * @param {object} [options={}] - Validation options.
     * @param {boolean} [options.allowMissing=false] - If true, does not error if the path doesn't exist.
     * @param {string|null} [options.expectedType=null] - The expected node type ('file' or 'directory').
     * @param {boolean} [options.disallowRoot=false] - If true, errors if the path resolves to the root directory.
     * @param {boolean} [options.defaultToCurrentIfEmpty=true] - If true, treats an empty path as the current directory.
     * @returns {{error: string|null, node: object|null, resolvedPath: string, optionsUsed: object}} A validation result object.
     */
    function validatePath(commandName, pathArg, options = {}) {
        const {
            allowMissing = false,
            expectedType = null,
            disallowRoot = false,
            defaultToCurrentIfEmpty = true,
        } = options;
        const currentUser = UserManager.getCurrentUser().name;
        const effectivePathArg =
            pathArg === "" && defaultToCurrentIfEmpty
                ? Config.FILESYSTEM.CURRENT_DIR_SYMBOL
                : pathArg;
        const resolvedPath = getAbsolutePath(effectivePathArg, currentPath);

        if (disallowRoot && resolvedPath === Config.FILESYSTEM.ROOT_PATH) {
            return {
                error: `${commandName}: '${pathArg}' (resolved to root) is not a valid target for this operation.`,
                node: null,
                resolvedPath,
                optionsUsed: options,
            };
        }

        let node;
        if (resolvedPath === Config.FILESYSTEM.ROOT_PATH) {
            node = fsData[Config.FILESYSTEM.ROOT_PATH];
        } else {
            const segments = resolvedPath
                .substring(1)
                .split(Config.FILESYSTEM.PATH_SEPARATOR)
                .filter((s) => s);
            let currentNode = fsData[Config.FILESYSTEM.ROOT_PATH];
            let currentPathForError = Config.FILESYSTEM.ROOT_PATH;

            for (const segment of segments) {
                if (!hasPermission(currentNode, currentUser, "execute")) {
                    return {
                        error: `${commandName}: cannot access '${resolvedPath}': Permission denied while traversing '${currentPathForError}'`,
                        node: null,
                        resolvedPath,
                        optionsUsed: options,
                    };
                }
                if (!currentNode.children || !currentNode.children[segment]) {
                    currentNode = null;
                    break;
                }
                currentNode = currentNode.children[segment];
                currentPathForError = getAbsolutePath(segment, currentPathForError);
            }
            node = currentNode;
        }

        if (!node) {
            if (allowMissing) {
                return {
                    error: null,
                    node: null,
                    resolvedPath,
                    optionsUsed: options,
                };
            }
            return {
                error: `${commandName}: '${pathArg}' (resolved to '${resolvedPath}'): No such file or directory`,
                node: null,
                resolvedPath,
                optionsUsed: options,
            };
        }

        if (expectedType && node.type !== expectedType) {
            const typeName =
                expectedType === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
                    ? "directory"
                    : "file";
            const actualTypeName =
                node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
                    ? "directory"
                    : node.type === Config.FILESYSTEM.DEFAULT_FILE_TYPE
                        ? "file"
                        : "unknown type";
            return {
                error: `${commandName}: '${pathArg}' (resolved to '${resolvedPath}') is not a ${typeName} (it's a ${actualTypeName})`,
                node,
                resolvedPath,
                optionsUsed: options,
            };
        }

        if (commandName.startsWith("cd") && node) {
            if (!hasPermission(node, currentUser, "execute")) {
                return {
                    error: `cd: '${pathArg}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`,
                    node,
                    resolvedPath,
                    optionsUsed: options,
                };
            }
        }

        return {
            error: null,
            node,
            resolvedPath,
            optionsUsed: options,
        };
    }

    /**
     * Checks if a user has a specific permission (read, write, execute) for a given node.
     * Takes into account owner, group, and other permissions. The 'root' user always has permission.
     * @param {object} node - The file system node to check.
     * @param {string} username - The name of the user to check permissions for.
     * @param {string} permissionType - The permission to check ('read', 'write', or 'execute').
     * @returns {boolean} True if the user has the permission, false otherwise.
     */
    function hasPermission(node, username, permissionType) {
        if (username === 'root') {
            return true;
        }

        if (!node) {
            return false;
        }

        const permissionMap = {
            'read': 4,
            'write': 2,
            'execute': 1
        };

        const requiredPerm = permissionMap[permissionType];
        if (!requiredPerm) {
            console.error(`Unknown permissionType requested: ${permissionType}`);
            return false;
        }

        const mode = node.mode || 0;
        const ownerPerms = (mode >> 6) & 7;
        const groupPerms = (mode >> 3) & 7;
        const otherPerms = mode & 7;

        if (node.owner === username) {
            return (ownerPerms & requiredPerm) === requiredPerm;
        }

        const userGroups = GroupManager.getGroupsForUser(username);
        if (userGroups.includes(node.group)) {
            return (groupPerms & requiredPerm) === requiredPerm;
        }

        return (otherPerms & requiredPerm) === requiredPerm;
    }

    /**
     * Formats a node's octal mode into a human-readable string (e.g., 'drwxr-xr--').
     * @param {object} node - The node whose mode should be formatted.
     * @returns {string} The formatted permission string.
     */
    function formatModeToString(node) {
        if (!node || typeof node.mode !== "number") {
            return "----------";
        }
        const typeChar =
            node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE ? "d" : "-";

        const ownerPerms = (node.mode >> 6) & 7;
        const groupPerms = (node.mode >> 3) & 7;
        let p = node.mode & 7; // Other permissions

        const perm_str = (permValue) => {
            let str = "";
            let p_copy = permValue;

            // Read
            if (p_copy >= 4) {
                str += "r";
                p_copy -= 4;
            } else {
                str += "-";
            }

            // Write
            if (p_copy >= 2) {
                str += "w";
                p_copy -= 2;
            } else {
                str += "-";
            }

            // Execute
            if (p_copy >= 1) {
                str += "x";
            } else {
                str += "-";
            }
            return str;
        };

        return (
            typeChar +
            perm_str(ownerPerms) +
            perm_str(groupPerms) +
            perm_str(p)
        );
    }

    /**
     * Recursively deletes a node and all its children. Used by the 'rm' command.
     * @param {string} path - The absolute path to the node to delete.
     * @param {object} [options={}] - Deletion options.
     * @param {boolean} [options.force=false] - If true, suppresses some permission errors.
     * @param {string} options.currentUser - The user performing the deletion.
     * @async
     * @returns {Promise<{success: boolean, messages: string[], anyChangeMade?: boolean}>} An object indicating the result of the operation.
     */
    async function deleteNodeRecursive(path, options = {}) {
        const { force = false, currentUser } = options;
        const pathValidation = validatePath("delete", path, {
            disallowRoot: true,
        });
        if (pathValidation.error) {
            if (force && !pathValidation.node) {
                return {
                    success: true,
                    messages: [],
                };
            }
            return {
                success: false,
                messages: [pathValidation.error],
            };
        }
        const node = pathValidation.node;
        const resolvedPath = pathValidation.resolvedPath;
        const parentPath =
            resolvedPath.substring(
                0,
                resolvedPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR)
            ) || Config.FILESYSTEM.ROOT_PATH;
        const parentNode = getNodeByPath(parentPath);
        const itemName = resolvedPath.substring(
            resolvedPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1
        );
        const nowISO = new Date().toISOString();
        let messages = [];
        let anyChangeMade = false;
        if (!parentNode || !hasPermission(parentNode, currentUser, "write")) {
            const permError = `cannot remove '${path}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`;
            return {
                success: force,
                messages: force ? [] : [permError],
            };
        }
        if (node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
            // Defensively check if children object exists.
            if (node.children && typeof node.children === 'object') {
                const childrenNames = Object.keys(node.children);
                for (const childName of childrenNames) {
                    const childPath = getAbsolutePath(childName, resolvedPath);
                    const result = await deleteNodeRecursive(childPath, options);
                    messages.push(...result.messages);
                    if (!result.success) {
                        return {
                            success: false,
                            messages,
                        };
                    }
                }
            } else {
                // This indicates a potential data corruption.
                console.warn(`FileSystemManager: Directory node at '${path}' is missing or has an invalid 'children' property.`, node);
            }
        }
        delete parentNode.children[itemName];
        parentNode.mtime = nowISO;
        anyChangeMade = true;
        return {
            success: true,
            messages,
            anyChangeMade,
        };
    }

    /**
     * Creates a new file node object with default properties.
     * @private
     * @param {string} name - The name of the file.
     * @param {string} content - The initial content of the file.
     * @param {string} owner - The username of the file's owner.
     * @param {string} group - The group name for the file.
     * @param {number|null} [mode=null] - The octal permission mode. Defaults to config setting if null.
     * @returns {object} The new file node object.
     */
    function _createNewFileNode(name, content, owner, group, mode = null) {
        const nowISO = new Date().toISOString();
        return {
            type: Config.FILESYSTEM.DEFAULT_FILE_TYPE,
            content: content || "",
            owner: owner,
            group: group,
            mode: mode !== null ? mode : Config.FILESYSTEM.DEFAULT_FILE_MODE,
            mtime: nowISO,
        };
    }

    /**
     * Calculates the total size of the entire file system. Used for quota checks.
     * @private
     * @returns {number} The total size in bytes.
     */
    function _calculateTotalSize() {
        if (!fsData || !fsData[Config.FILESYSTEM.ROOT_PATH]) return 0;
        return calculateNodeSize(fsData[Config.FILESYSTEM.ROOT_PATH]);
    }

    /**
     * Creates a new directory node object with default properties.
     * @private
     * @param {string} owner - The username of the directory's owner.
     * @param {string} group - The group name for the directory.
     * @param {number|null} [mode=null] - The octal permission mode. Defaults to config setting if null.
     * @returns {object} The new directory node object.
     */
    function _createNewDirectoryNode(owner, group, mode = null) {
        const nowISO = new Date().toISOString();
        return {
            type: Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
            children: {},
            owner: owner,
            group: group,
            mode: mode !== null ? mode : Config.FILESYSTEM.DEFAULT_DIR_MODE,
            mtime: nowISO
        };
    }

    /**
     * Creates a new file or updates an existing one at a given absolute path.
     * This function handles permission checks and parent directory creation.
     * @async
     * @param {string} absolutePath - The absolute path where the file should be created or updated.
     * @param {string} content - The content to write to the file.
     * @param {object} context - Contextual information for the operation.
     * @param {string} context.currentUser - The username of the user performing the action.
     * @param {string} context.primaryGroup - The primary group of the current user.
     * @param {object|null} [context.existingNode] - An optional, pre-validated existing node to speed up updates.
     * @returns {Promise<{success: boolean, error?: string}>} An object indicating the result of the operation.
     */
    async function createOrUpdateFile(absolutePath, content, context) {
        const { currentUser, primaryGroup, existingNode: providedExistingNode } = context;
        const nowISO = new Date().toISOString();

        const existingNode = providedExistingNode !== undefined ? providedExistingNode : FileSystemManager.getNodeByPath(absolutePath);

        if (existingNode) {
            if (existingNode.type !== Config.FILESYSTEM.DEFAULT_FILE_TYPE) {
                return { success: false, error: `Cannot overwrite non-file '${absolutePath}'` };
            }
            if (!hasPermission(existingNode, currentUser, "write")) {
                return { success: false, error: `'${absolutePath}': Permission denied` };
            }
            existingNode.content = content;
            existingNode.mtime = nowISO;
        } else {
            const parentDirResult = createParentDirectoriesIfNeeded(absolutePath);
            if (parentDirResult.error) {
                return { success: false, error: parentDirResult.error };
            }
            const parentNode = parentDirResult.parentNode;
            if (!hasPermission(parentNode, currentUser, "write")) {
                return { success: false, error: `Cannot create file in parent directory: Permission denied` };
            }

            // Ensure the parent node's children property is a valid object before proceeding.
            if (!parentNode.children || typeof parentNode.children !== 'object') {
                console.error(`FileSystemManager: Corrupted directory node at parent of '${absolutePath}'. Missing 'children' property. Restoring it.`, parentNode);
                parentNode.children = {}; // Attempt to repair the corrupted node.
            }

            const fileName = absolutePath.substring(absolutePath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1);
            parentNode.children[fileName] = _createNewFileNode(fileName, content, currentUser, primaryGroup);
            parentNode.mtime = nowISO; // Also update parent mtime on creation
        }

        return { success: true };
    }
    return {
        createUserHomeDirectory,
        save,
        load,
        clearAllFS,
        getCurrentPath,
        setCurrentPath,
        getFsData,
        setFsData,
        getAbsolutePath,
        getNodeByPath,
        createParentDirectoriesIfNeeded,
        calculateNodeSize,
        validatePath,
        hasPermission,
        formatModeToString,
        _updateNodeAndParentMtime,
        _createNewFileNode,
        _createNewDirectoryNode,
        deleteNodeRecursive,
        createOrUpdateFile,
    };
})();