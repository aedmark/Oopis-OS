(() => {
    "use strict";

    async function _getFilesForAnalysis(startPath, startNode, currentUser) {
        const files = [];
        const visited = new Set();
        const SUPPORTED_EXTENSIONS = new Set(['md', 'txt', 'js', 'sh']);

        async function recurse(currentPath, node) {
            if (visited.has(currentPath)) return;
            visited.add(currentPath);

            if (!FileSystemManager.hasPermission(node, currentUser, "read")) return;

            if (node.type === Config.FILESYSTEM.DEFAULT_FILE_TYPE) {
                if (SUPPORTED_EXTENSIONS.has(Utils.getFileExtension(currentPath))) {
                    files.push({
                        name: currentPath.split('/').pop(),
                        path: currentPath,
                        content: node.content || ''
                    });
                }
            } else if (node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
                if (!FileSystemManager.hasPermission(node, currentUser, "execute")) return;
                for (const childName of Object.keys(node.children || {})) {
                    await recurse(FileSystemManager.getAbsolutePath(childName, currentPath), node.children[childName]);
                }
            }
        }

        await recurse(startPath, startNode);
        return files;
    }

    const chidiCommandDefinition = {
        commandName: "chidi",
        flagDefinitions: [{name: "new", short: "-n", long: "--new"}],
        argValidation: {
            max: 1,
            error: "Usage: chidi [-n] [path] or <command> | chidi [-n]"
        },
        pathValidation: [{argIndex: 0, optional: true, options: {allowMissing: false}}],
        permissionChecks: [{pathArgIndex: 0, permissions: ["read"]}],

        coreLogic: async (context) => {
            const {args, flags, currentUser, validatedPaths, options} = context;

            if (!options.isInteractive) {
                return {success: false, error: "chidi: Can only be run in interactive mode."};
            }
            if (!StorageManager.loadItem(Config.STORAGE_KEYS.GEMINI_API_KEY)) {
                return {success: false, error: `chidi: Gemini API key not set. Please run 'gemini' once to set it.`};
            }

            let files = [];
            let hadErrors = false;
            const SUPPORTED_EXTENSIONS = new Set(['md', 'txt', 'js', 'sh']);

            if (options.stdinContent) {
                if (args.length > 0) return {
                    success: false,
                    error: "chidi: does not accept file arguments when receiving piped input."
                };

                const pathsFromPipe = options.stdinContent.trim().split('\n');
                for (const path of pathsFromPipe) {
                    if (!path.trim()) continue;
                    const pathValidation = FileSystemManager.validatePath("chidi (pipe)", path, {expectedType: 'file'});
                    if (pathValidation.error || !FileSystemManager.hasPermission(pathValidation.node, currentUser, "read")) {
                        hadErrors = true;
                        continue;
                    }
                    if (SUPPORTED_EXTENSIONS.has(Utils.getFileExtension(pathValidation.resolvedPath))) {
                        files.push({
                            name: pathValidation.resolvedPath.split('/').pop(),
                            path: pathValidation.resolvedPath,
                            content: pathValidation.node.content || ''
                        });
                    }
                }
            } else {
                const startPath = args.length > 0 ? validatedPaths[0].resolvedPath : FileSystemManager.getCurrentPath();
                const startNode = args.length > 0 ? validatedPaths[0].node : FileSystemManager.getNodeByPath(startPath);
                if (!startNode) return {success: false, error: "chidi: Cannot access specified path."};
                files = await _getFilesForAnalysis(startPath, startNode, currentUser);
            }

            if (files.length === 0) {
                return {success: true, output: `No supported files (.md, .txt, .js, .sh) found to open.`};
            }

            ChidiManager.launch(files, {isNewSession: flags.new});

            return {success: !hadErrors, output: ""};
        }
    };

    CommandRegistry.register("chidi", chidiCommandDefinition, "Opens the Chidi document and code analyst.", "See `man chidi` for details.");
})();