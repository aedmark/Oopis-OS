/**
 * @fileoverview Command definition for 'chidi', a Markdown file reader and analyzer.
 * This command launches a modal application to view and interact with .md and .txt files.
 */

(() => {
    "use strict";

    /**
     * Gathers all analyzable files (.md, .txt) from a given path, recursively.
     * @param {string} startPath - The absolute starting path (file or directory).
     * @param {object} startNode - The file system node for the starting path.
     * @param {string} currentUser - The name of the user executing the command.
     * @returns {Promise<Array<object>>} A promise that resolves to a list of file objects.
     */
    async function getAnalyzableFiles(startPath, startNode, currentUser) {
        const files = [];
        const visited = new Set();
        const ALLOWED_EXTENSIONS = ['.md', '.txt'];

        async function recurse(currentPath, node) {
            if (visited.has(currentPath)) return;
            visited.add(currentPath);

            if (!FileSystemManager.hasPermission(node, currentUser, "read")) {
                return;
            }

            if (node.type === Config.FILESYSTEM.DEFAULT_FILE_TYPE) {
                const lowerPath = currentPath.toLowerCase();
                if (ALLOWED_EXTENSIONS.some(ext => lowerPath.endsWith(ext))) {
                    files.push({
                        name: currentPath.split('/').pop(),
                        path: currentPath,
                        content: node.content || ''
                    });
                }
            } else if (node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
                if (!FileSystemManager.hasPermission(node, currentUser, "execute")) {
                    return;
                }
                for (const childName of Object.keys(node.children || {})) {
                    const childNode = node.children[childName];
                    const childPath = FileSystemManager.getAbsolutePath(childName, currentPath);
                    await recurse(childPath, childNode);
                }
            }
        }

        await recurse(startPath, startNode);

        if (startNode.type === Config.FILESYSTEM.DEFAULT_FILE_TYPE && files.length === 0) {
            throw new Error('Specified file is not an analyzable file type (.md, .txt).');
        }

        return files;
    }

    const chidiCommandDefinition = {
        commandName: "chidi",
        argValidation: {
            max: 1,
            error: "Usage: chidi [path_to_file_or_directory]"
        },
        pathValidation: [{
            argIndex: 0,
            optional: true,
            options: {
                allowMissing: false
            }
        }],
        permissionChecks: [{
            pathArgIndex: 0,
            permissions: ["read"]
        }],
        coreLogic: async (context) => {
            const {
                args,
                currentUser,
                validatedPaths,
                options
            } = context;

            if (!options.isInteractive) {
                return {
                    success: false,
                    error: "chidi: Can only be run in interactive mode."
                };
            }

            // API key check remains the same
            let apiKey = StorageManager.loadItem(Config.STORAGE_KEYS.GEMINI_API_KEY, "Gemini API Key");
            if (!apiKey) {
                const keyResult = await new Promise(resolve => {
                    ModalInputManager.requestInput("A Gemini API key is required for Chidi. Please enter your key:",
                        (providedKey) => {
                            if (!providedKey || providedKey.trim() === "") {
                                return resolve({ success: false, error: "API key entry cancelled or empty." });
                            }
                            StorageManager.saveItem(Config.STORAGE_KEYS.GEMINI_API_KEY, providedKey, "Gemini API Key");
                            OutputManager.appendToOutput("API Key saved. Launching Chidi...", { typeClass: Config.CSS_CLASSES.SUCCESS_MSG });
                            resolve({ success: true, key: providedKey });
                        },
                        () => resolve({ success: false, error: "API key entry cancelled." }),
                        false, options
                    );
                });
                if (!keyResult.success) {
                    return { success: false, error: `chidi: ${keyResult.error}` };
                }
                apiKey = keyResult.key;
            }

            let files = [];
            let pathForMsgs;

            // --- NEW: Prioritize piped input from stdin ---
            if (options.stdinContent) {
                pathForMsgs = "the piped input";
                const pathsFromStdin = options.stdinContent.split('\n').filter(p => p.trim() !== '');

                for (const path of pathsFromStdin) {
                    const pathInfo = FileSystemManager.validatePath("chidi (stdin)", path, { expectedType: 'file' });
                    if (pathInfo.error) {
                        await OutputManager.appendToOutput(`chidi: skipping invalid path from pipe: '${path}' - ${pathInfo.error}`, { typeClass: Config.CSS_CLASSES.WARNING_MSG });
                        continue;
                    }
                    if (!FileSystemManager.hasPermission(pathInfo.node, currentUser, "read")) {
                        await OutputManager.appendToOutput(`chidi: skipping unreadable path from pipe: '${path}'`, { typeClass: Config.CSS_CLASSES.WARNING_MSG });
                        continue;
                    }
                    const lowerPath = path.toLowerCase();
                    const ALLOWED_EXTENSIONS = ['.md', '.txt'];
                    if (ALLOWED_EXTENSIONS.some(ext => lowerPath.endsWith(ext))) {
                        files.push({
                            name: path.split('/').pop(),
                            path: pathInfo.resolvedPath,
                            content: pathInfo.node.content || ''
                        });
                    }
                }
            } else {
                // --- FALLBACK: Use argument-based logic if no pipe ---
                let startPath;
                let startNode;

                if (args.length === 0) {
                    pathForMsgs = "the current directory";
                    startPath = FileSystemManager.getCurrentPath();
                    startNode = FileSystemManager.getNodeByPath(startPath);
                    if (!startNode) {
                        return { success: false, error: "chidi: Critical error - cannot access current working directory." };
                    }
                } else {
                    pathForMsgs = `'${args[0]}'`;
                    const pathInfo = validatedPaths[0];
                    startNode = pathInfo.node;
                    startPath = pathInfo.resolvedPath;
                }
                files = await getAnalyzableFiles(startPath, startNode, currentUser);
            }

            // --- LAUNCH LOGIC (remains the same) ---
            if (files.length === 0) {
                return { success: true, output: `No analyzable files (.md, .txt) found in ${pathForMsgs}.` };
            }

            return new Promise((resolve) => {
                const onExit = () => {
                    TerminalUI.setInputState(true);
                    TerminalUI.focusInput();
                    resolve({ success: true, output: "" });
                };
                TerminalUI.setInputState(false);
                ChidiApp.launch(files, onExit);
            });
        }
    };

    // --- UPDATED HELP TEXT ---
    const description = "Opens the Chidi AI reader for specified documents.";
    const helpText = `
Usage: chidi [path]

DESCRIPTION
    Launches a modal application to read and analyze Markdown (.md) and text (.txt) files.
    
    If a <path> is provided, Chidi will recursively find and load all supported files within it.
    If no path is given, it scans the current directory.
    
    Chidi also accepts a list of file paths from standard input, allowing it to be used in pipelines.

    The first time you run this command, you will be prompted for a Gemini API key
    if one is not already saved.

EXAMPLES
    chidi /docs
        Analyzes all supported files in the /docs directory.

    find . -name "*.txt" | chidi
        Finds all .txt files in the current hierarchy and opens them in Chidi.
`;

    CommandRegistry.register(chidiCommandDefinition.commandName, chidiCommandDefinition, description, helpText);
})();