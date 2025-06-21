/**
 * @fileoverview Command definition for 'chidi', a Markdown file reader and analyzer.
 * This command launches a modal application to view and interact with .md files.
 */

(() => {
    "use strict";

    /**
     * Gathers all markdown files from a given path, recursively.
     * @param {string} startPath - The absolute starting path (file or directory).
     * @param {object} startNode - The file system node for the starting path.
     * @param {string} currentUser - The name of the user executing the command.
     * @returns {Promise<Array<object>>} A promise that resolves to a list of file objects.
     */
    async function getMarkdownFiles(startPath, startNode, currentUser) {
        const files = [];
        const visited = new Set(); // Prevent infinite loops

        async function recurse(currentPath, node) {
            if (visited.has(currentPath)) return;
            visited.add(currentPath);

            // We need to be able to read the item to process it.
            if (!FileSystemManager.hasPermission(node, currentUser, "read")) {
                return; // Skip unreadable files/dirs
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
                // To list children of a directory, we need execute permission on it.
                if (!FileSystemManager.hasPermission(node, currentUser, "execute")) {
                    return; // Skip un-enterable directories
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
        argValidation: {
            exact: 1,
            error: "Usage: chidi <path_to_file_or_directory>"
        },
        pathValidation: [
            {
                argIndex: 0,
                options: { allowMissing: false }
            }
        ],
        // Read permission on the top-level path is checked here.
        // The recursive search will handle permissions for sub-items.
        permissionChecks: [
            {
                pathArgIndex: 0,
                permissions: ["read"]
            }
        ],
        async coreLogic(context) {
            const { args, currentUser, validatedPaths, options } = context;

            // This is the key part - the command executor has done the initial validation.
            const pathInfo = validatedPaths[0];
            const startNode = pathInfo.node;
            const startPath = pathInfo.resolvedPath;

            try {
                // Using a promise to correctly handle the async nature of the modal UI.
                // The command executor will `await` this promise.
                return new Promise(async (resolve, reject) => {
                    if (!options.isInteractive) {
                        return reject(new Error("chidi: Can only be run in interactive mode."));
                    }

                    try {
                        const files = await getMarkdownFiles(startPath, startNode, currentUser);

                        if (files.length === 0) {
                            return resolve({
                                success: true,
                                output: `No markdown (.md) files found at '${args[0]}'.`
                            });
                        }

                        // Define the onExit callback for when the app closes.
                        // This callback is what resolves the promise, ending the command.
                        const onExit = () => {
                            // No need to manually resume terminal; the modal manager should handle it,
                            // but let's ensure it's re-enabled.
                            TerminalUI.setInputState(true);
                            TerminalUI.focusInput();
                            resolve({
                                success: true,
                                output: "" // No output on successful exit
                            });
                        };

                        // Pause terminal input before launching the modal.
                        TerminalUI.setInputState(false);

                        // Assuming ChidiApp is globally available from chidi_app.js
                        ChidiApp.launch(files, onExit);

                    } catch (e) {
                        // If an error occurs (e.g., parsing, file access),
                        // ensure terminal is re-enabled and reject the promise.
                        TerminalUI.setInputState(true);
                        TerminalUI.focusInput();
                        reject(e);
                    }
                });
            } catch (error) {
                // This catch block will handle synchronous errors in the setup.
                return { success: false, error: error.message };
            }
        }
    };

    const description = "Opens the Chidi.md Markdown reader for a specified file or directory.";
    const helpText = `
Usage: chidi <path>

DESCRIPTION
    Launches a modal application to read and analyze Markdown (.md) files.
    The path can be to a single .md file or a directory.
    If a directory is provided, Chidi will recursively find and load all .md files within it.

    Inside the application:
    - Use PREV/NEXT to navigate between files if multiple are loaded.
    - Use the buttons to interact with the Gemini API regarding the current document.
    - Click the '×' button or press Esc to exit and return to the terminal.
`;

    CommandRegistry.register(chidiCommandDefinition.commandName, chidiCommandDefinition, description, helpText);
})();