const FileSystemManager = (() => {
    "use strict";

    let fsData = {};
    let currentPath = Config.FILESYSTEM.ROOT_PATH;

    const OOPIS_CONF_CONTENT = `TERMINAL.PROMPT_CHAR=>
OS.DEFAULT_HOST_NAME=OopisOS
MESSAGES.WELCOME_PREFIX=Welcome,
MESSAGES.WELCOME_SUFFIX=!`;

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
                "Error: File system storage not available for saving.", {
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
                    "Error: OopisOs failed to save the file system.", {
                        typeClass: Config.CSS_CLASSES.ERROR_MSG,
                    }
                );
                reject(event.target.error);
            };
        });
    }

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
                        "No file system found. Initializing new one.", {
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

    async function clearAllFS() {
        let db;
        try {
            db = IndexedDBManager.getDbInstance();
        } catch (e) {
            await OutputManager.appendToOutput(
                "Error: File system storage not available for clearing all data.", {
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
                    "Error: OopisOs could not clear all user file systems. Your data might still be present. Please try the operation again.", {
                        typeClass: Config.CSS_CLASSES.ERROR_MSG,
                    }
                );
                reject(event.target.error);
            };
        });
    }

    function getCurrentPath() {
        return currentPath;
    }

    function setCurrentPath(path) {
        currentPath = path;
    }

    function getFsData() {
        return fsData;
    }

    function setFsData(newData) {
        fsData = newData;
    }

    // --- Start of Refactored Functions ---

    /**
     * The Path Resolver.
     * Takes a user-provided path string and resolves it to a true, absolute path.
     * @param {string} targetPath - The path to resolve.
     * @param {string} [basePath=currentPath] - The base path to resolve from.
     * @returns {string} The absolute path.
     */
    function getAbsolutePath(targetPath, basePath = currentPath) {
        if (!targetPath) targetPath = Config.FILESYSTEM.CURRENT_DIR_SYMBOL;
        let effectiveBasePath = basePath;
        if (targetPath.startsWith(Config.FILESYSTEM.PATH_SEPARATOR))
            effectiveBasePath = Config.FILESYSTEM.ROOT_PATH;
        const baseSegments =
            effectiveBasePath === Config.FILESYSTEM.ROOT_PATH ?
                [] :
                effectiveBasePath
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
                ) {}
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
     * The Node Retriever.
     * Traverses the file system from an absolute path and returns the corresponding node.
     * It performs permission checks during traversal.
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
                return null; // Permission denied during traversal
            }
            if (!currentNode.children || !currentNode.children[segment]) {
                return null; // Path does not exist
            }
            currentNode = currentNode.children[segment];
        }
        return currentNode;
    }

    /**
     * The Path Validator.
     * Orchestrates path resolution, node retrieval, and final validation checks.
     * @param {string} pathArg - The user-provided path.
     * @param {object} options - Validation options.
     * @param {string} [options.expectedType] - e.g., 'file' or 'directory'.
     * @param {string[]} [options.permissions] - e.g., ['read', 'write'].
     * @param {boolean} [options.allowMissing=false] - If true, doesn't error if the node is null.
     * @returns {{node: object, resolvedPath: string, error: string|null}}
     */
    function validatePath(pathArg, options = {}) {
        const { expectedType = null, permissions = [], allowMissing = false } = options;
        const currentUser = UserManager.getCurrentUser().name;

        // 1. Resolve Path
        const resolvedPath = getAbsolutePath(pathArg);

        // 2. Retrieve Node
        const node = getNodeByPath(resolvedPath);

        // 3. Validate Node Existence
        if (!node) {
            if (allowMissing) {
                return { node: null, resolvedPath, error: null };
            }
            return { node: null, resolvedPath, error: `${pathArg}: No such file or directory` };
        }

        // 4. Validate Expected Type
        if (expectedType && node.type !== expectedType) {
            if (expectedType === 'file') {
                return { node, resolvedPath, error: `${pathArg}: Is not a file` };
            }
            if (expectedType === 'directory') {
                return { node, resolvedPath, error: `${pathArg}: Is not a directory` };
            }
        }

        // 5. Validate Permissions
        for (const perm of permissions) {
            if (!hasPermission(node, currentUser, perm)) {
                return { node, resolvedPath, error: `${pathArg}: Permission denied` };
            }
        }

        // 6. Success
        return { node, resolvedPath, error: null };
    }

    // --- End of Refactored Functions ---


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
            lastSlashIndex === 0 ?
                Config.FILESYSTEM.ROOT_PATH :
                fullPath.substring(0, lastSlashIndex);
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

            if (p_copy >= 4) {
                str += "r";
                p_copy -= 4;
            } else {
                str += "-";
            }
            if (p_copy >= 2) {
                str += "w";
                p_copy -= 2;
            } else {
                str += "-";
            }
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

    async function deleteNodeRecursive(path, options = {}) {
        const {
            force = false, currentUser
        } = options;
        const pathValidation = validatePath(path, { disallowRoot: true });
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

    function _calculateTotalSize() {
        if (!fsData || !fsData[Config.FILESYSTEM.ROOT_PATH]) return 0;
        return calculateNodeSize(fsData[Config.FILESYSTEM.ROOT_PATH]);
    }

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

    async function createOrUpdateFile(absolutePath, content, context) {
        const {
            currentUser,
            primaryGroup,
            existingNode: providedExistingNode
        } = context;
        const nowISO = new Date().toISOString();

        const existingNode = providedExistingNode !== undefined ? providedExistingNode : getNodeByPath(absolutePath);

        if (existingNode) {
            if (existingNode.type !== Config.FILESYSTEM.DEFAULT_FILE_TYPE) {
                return {
                    success: false,
                    error: `Cannot overwrite non-file '${absolutePath}'`
                };
            }
            if (!hasPermission(existingNode, currentUser, "write")) {
                return {
                    success: false,
                    error: `'${absolutePath}': Permission denied`
                };
            }
            existingNode.content = content;
            existingNode.mtime = nowISO;
        } else {
            const parentDirResult = createParentDirectoriesIfNeeded(absolutePath);
            if (parentDirResult.error) {
                return {
                    success: false,
                    error: parentDirResult.error
                };
            }
            const parentNode = parentDirResult.parentNode;

            if (!parentNode) {
                return {
                    success: false,
                    error: `Could not find or create parent directory for '${absolutePath}'.`
                };
            }

            if (!hasPermission(parentNode, currentUser, "write")) {
                return {
                    success: false,
                    error: `Cannot create file in parent directory: Permission denied`
                };
            }

            if (!parentNode.children || typeof parentNode.children !== 'object') {
                console.error(`FileSystemManager: Corrupted directory node at parent of '${absolutePath}'. Missing 'children' property. Restoring it.`, parentNode);
                parentNode.children = {};
            }

            const fileName = absolutePath.substring(absolutePath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1);
            parentNode.children[fileName] = _createNewFileNode(fileName, content, currentUser, primaryGroup);
            parentNode.mtime = nowISO;
        }

        return {
            success: true
        };
    }

    /**
     * Checks if a user has administrative rights to modify a node's metadata (owner/permissions).
     * @param {object} node The filesystem node in question.
     * @param {string} username The name of the user attempting the action.
     * @returns {boolean} True if the user is the owner or root.
     */
    function canUserModifyNode(node, username) {
        return username === 'root' || node.owner === username;
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
        canUserModifyNode,
    };
})();