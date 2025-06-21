/**
 * @fileoverview Command definition for 'chidi', a Markdown file reader and analyzer.
 * This command launches a modal application to view and interact with .md files.
 */

(() => {
    /**
     * Gathers all markdown files from a given path.
     * @param {string} absolutePath - The absolute starting path (file or directory).
     * @param {object} fs - The file system manager instance.
     * @returns {Promise<Array<object>>} A promise that resolves to a list of file objects.
     */
    async function getMarkdownFiles(absolutePath, fs) {
        const node = await fs.getNode(absolutePath);
        if (!node) {
            throw new Error(`Path not found: ${absolutePath}`);
        }

        const files = [];
        const filesToRead = [];

        if (node.type === 'directory') {
            // Recursively find all .md files in the directory
            async function recurse(directory) {
                for (const childName in directory.children) {
                    const childNode = directory.children[childName];
                    if (childNode.type === 'directory') {
                        await recurse(childNode);
                    } else if (childNode.name.toLowerCase().endsWith('.md')) {
                        filesToRead.push(childNode);
                    }
                }
            }
            await recurse(node);
        } else if (node.type === 'file') {
            if (node.name.toLowerCase().endsWith('.md')) {
                filesToRead.push(node);
            } else {
                throw new Error('Specified file is not a Markdown (.md) file.');
            }
        }

        // Read content for all found files
        for (const fileNode of filesToRead) {
            files.push({
                name: fileNode.name,
                path: fileNode.path,
                content: fileNode.content || ''
            });
        }

        return files;
    }

    const commandDefinition = {
        commandName: "chidi",
        argValidation: {
            min: 1,
            max: 1
        },
        async coreLogic(args, term, fs, commandExecutor) {
            const givenPath = args[0];

            try {
                // This command will return a promise that resolves when the modal is closed.
                return new Promise(async (resolve, reject) => {
                    try {
                        // Resolve the potentially relative path to an absolute one.
                        const absolutePath = fs.resolvePath(givenPath);

                        term.pause(); // Pause terminal input
                        const files = await getMarkdownFiles(absolutePath, fs);

                        if (files.length === 0) {
                            term.resume();
                            reject(new Error(`No .md files found at path: ${absolutePath}`));
                            return;
                        }

                        // Define the onExit callback for when the app closes
                        const onExit = () => {
                            term.resume(); // Resume terminal input
                            resolve({ success: true, output: "Chidi session ended." });
                        };

                        ChidiApp.launch(files, onExit);

                    } catch (e) {
                        term.resume();
                        reject(e);
                    }
                });
            } catch (error) {
                return { success: false, output: error.message };
            }
        }
    };

    const description = "Opens the Chidi.md Markdown reader for a specified file or directory.";
    const helpText = `
Usage: chidi [path]

DESCRIPTION
    Launches a modal application to read and analyze Markdown (.md) files.
    The path can be to a single .md file or a directory containing .md files.
    If a directory is provided, all .md files within it will be loaded.

    Inside the application:
    - Use PREV/NEXT to navigate between files.
    - Use Summarize, Suggest Q's, and Ask All to interact with the Gemini API.
    - Click the '×' button or press Esc to exit and return to the terminal.
`;

    CommandRegistry.register(commandDefinition.commandName, commandDefinition, description, helpText);
})();
