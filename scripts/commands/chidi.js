(() => {
    "use strict";

    async function getMarkdownFiles(startPath, startNode, currentUser) {
        const files = [];
        const visited = new Set();

        async function recurse(currentPath, node) {
            if (visited.has(currentPath)) return;
            visited.add(currentPath);

            if (!FileSystemManager.hasPermission(node, currentUser, "read")) {
                return;
            }

            if (node.type === Config.FILESYSTEM.DEFAULT_FILE_TYPE) {
                if (currentPath.toLowerCase().endsWith('.md')) {
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
            throw new Error('Specified file is not a Markdown (.md) file.');
        }

        return files;
    }

    const chidiCommandDefinition = {
        commandName: "chidi",
        flagDefinitions: [{
            name: "new",
            short: "-n",
            long: "--new"
        }],
        argValidation: {
            max: 1,
            error: "Usage: chidi [-n] [path] or <command> | chidi [-n]"
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
                flags,
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

            let apiKey = StorageManager.loadItem(Config.STORAGE_KEYS.GEMINI_API_KEY, "Gemini API Key");
            if (!apiKey) {
                const keyResult = await new Promise(resolve => {
                    ModalInputManager.requestInput(
                        "A Gemini API key is required for Chidi. Please enter your key:",
                        (providedKey) => {
                            if (!providedKey || providedKey.trim() === "") {
                                resolve({
                                    success: false,
                                    error: "API key entry cancelled or empty."
                                });
                                return;
                            }
                            StorageManager.saveItem(Config.STORAGE_KEYS.GEMINI_API_KEY, providedKey, "Gemini API Key");
                            OutputManager.appendToOutput("API Key saved. Launching Chidi...", {
                                typeClass: Config.CSS_CLASSES.SUCCESS_MSG
                            });
                            resolve({
                                success: true,
                                key: providedKey
                            });
                        },
                        () => {
                            resolve({
                                success: false,
                                error: "API key entry cancelled."
                            });
                        },
                        false,
                        options
                    );
                });

                if (!keyResult.success) {
                    return {
                        success: false,
                        error: `chidi: ${keyResult.error}`
                    };
                }
            }

            let files = [];
            let hadErrors = false;

            if (options.stdinContent) {
                if (args.length > 0) {
                    return {
                        success: false,
                        error: "chidi: does not accept file arguments when receiving piped input."
                    };
                }
                const pathsFromPipe = options.stdinContent.trim().split('\n');
                for (const path of pathsFromPipe) {
                    if (!path.trim()) continue;

                    const pathValidation = FileSystemManager.validatePath("chidi (pipe)", path, {
                        expectedType: 'file'
                    });
                    if (pathValidation.error) {
                        await OutputManager.appendToOutput(`chidi: skipping '${path}': ${pathValidation.error}`, {
                            typeClass: Config.CSS_CLASSES.WARNING_MSG
                        });
                        hadErrors = true;
                        continue;
                    }

                    const node = pathValidation.node;
                    if (!FileSystemManager.hasPermission(node, currentUser, "read")) {
                        await OutputManager.appendToOutput(`chidi: skipping '${path}': Permission denied`, {
                            typeClass: Config.CSS_CLASSES.WARNING_MSG
                        });
                        hadErrors = true;
                        continue;
                    }

                    if (pathValidation.resolvedPath.toLowerCase().endsWith('.md')) {
                        files.push({
                            name: pathValidation.resolvedPath.split('/').pop(),
                            path: pathValidation.resolvedPath,
                            content: node.content || ''
                        });
                    }
                }
            } else {
                let startPath;
                let startNode;

                if (args.length === 0) {
                    startPath = FileSystemManager.getCurrentPath();
                    startNode = FileSystemManager.getNodeByPath(startPath);
                    if (!startNode) {
                        return {
                            success: false,
                            error: "chidi: Critical error - cannot access current working directory."
                        };
                    }
                } else {
                    const pathInfo = validatedPaths[0];
                    startNode = pathInfo.node;
                    startPath = pathInfo.resolvedPath;
                }

                try {
                    files = await getMarkdownFiles(startPath, startNode, currentUser);
                } catch (error) {
                    return {
                        success: false,
                        error: `chidi: ${error.message}`
                    };
                }
            }

            if (files.length === 0) {
                return {
                    success: true,
                    output: `No valid markdown (.md) files found to open.`
                };
            }

            await new Promise(resolve => {
                ChidiApp.launch(files, {
                    onExit: resolve,
                    isNewSession: flags.new
                });
            });

            return {
                success: !hadErrors,
                output: ""
            };

        }
    };

    const description = "Opens the Chidi.md Markdown reader for a specified file or directory.";
    const helpText = `
Usage: chidi [-n] [path] | <command> | chidi [-n]

DESCRIPTION
    Launches a modal application to read and analyze Markdown (.md) files.

    In the first form, 'chidi' will recursively find all .md files within the
    optional [path] (or the current directory if no path is given).

    In the second form, 'chidi' reads a newline-separated list of file
    paths from standard input (e.g., from 'find') and uses that as its
    corpus, ignoring the file system's recursive discovery.

OPTIONS
    -n, --new
          Start a new session. This clears any cached state in the application.

EXAMPLES
    chidi /docs
        Opens all .md files found inside the /docs directory.

    find . -name "*.md" | chidi
        Opens all .md files found by the 'find' command in the current
        directory and its subdirectories.
`;

    CommandRegistry.register(chidiCommandDefinition.commandName, chidiCommandDefinition, description, helpText);
})();