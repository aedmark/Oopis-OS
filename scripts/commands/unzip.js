// scripts/commands/unzip.js
(() => {
    "use strict";

    const MAX_EXTRACTION_DEPTH = 100;

    async function _extractChildren(children, parentPath, context, baseExtractionPath, currentDepth) {
        if (currentDepth > MAX_EXTRACTION_DEPTH) {
            return { success: false, error: "Archive nesting level exceeds maximum depth." };
        }

        for (const name in children) {
            const node = children[name];
            const newPath = FileSystemManager.getAbsolutePath(name, parentPath);

            if (!newPath.startsWith(baseExtractionPath)) {
                return { success: false, error: `Path traversal attempt detected.` };
            }

            if (node.type === 'file') {
                const saveResult = await FileSystemManager.createOrUpdateFile(newPath, node.content, context);
                if (!saveResult.success) return saveResult;
            } else if (node.type === 'directory') {
                const mkdirResult = await CommandExecutor.processSingleCommand(`mkdir -p "${newPath}"`, { isInteractive: false });
                if (!mkdirResult.success) {
                    return { success: false, error: `Could not create directory ${newPath}: ${mkdirResult.error}` };
                }
                const recursiveResult = await _extractChildren(node.children, newPath, context, baseExtractionPath, currentDepth + 1);
                if (!recursiveResult.success) return recursiveResult;
            }
        }
        return { success: true };
    }

    async function _performExtraction(archive, destinationPath, context) {
        for (const name in archive) {
            const node = archive[name];
            const newPath = FileSystemManager.getAbsolutePath(name, destinationPath);

            if (!newPath.startsWith(destinationPath)) {
                return { success: false, error: `Path traversal attempt detected.` };
            }

            if (node.type === 'file') {
                const saveResult = await FileSystemManager.createOrUpdateFile(newPath, node.content, context);
                if (!saveResult.success) return saveResult;
            } else if (node.type === 'directory') {
                const mkdirResult = await CommandExecutor.processSingleCommand(`mkdir -p "${newPath}"`, { isInteractive: false });
                if (!mkdirResult.success) {
                    return { success: false, error: `Could not create directory ${newPath}: ${mkdirResult.error}` };
                }
                const childrenResult = await _extractChildren(node.children, newPath, context, newPath, 1);
                if (!childrenResult.success) return childrenResult;
            }
        }
        return { success: true };
    }


    const unzipCommandDefinition = {
        commandName: "unzip",
        completionType: "paths", // Preserved for tab completion.
        argValidation: {
            min: 1,
            max: 2,
            error: "Usage: unzip <archive.zip> [destination_path]"
        },
        coreLogic: async (context) => {
            const { args, currentUser } = context;
            const archivePathArg = args[0];
            const destinationPathArg = args.length > 1 ? args[1] : '.';

            try {
                if (!archivePathArg.endsWith('.zip')) {
                    return { success: false, error: `unzip: invalid file extension for '${archivePathArg}'. Must be .zip` };
                }

                const archiveValidation = FileSystemManager.validatePath(archivePathArg, {
                    expectedType: 'file',
                    permissions: ['read']
                });
                if (archiveValidation.error) {
                    return { success: false, error: `unzip: ${archiveValidation.error}` };
                }
                const archiveNode = archiveValidation.node;

                let archiveContent;
                try {
                    archiveContent = JSON.parse(archiveNode.content);
                } catch (e) {
                    return { success: false, error: `unzip: Archive is corrupted or not a valid .zip file.` };
                }

                const destValidation = FileSystemManager.validatePath(destinationPathArg, {
                    allowMissing: true,
                    expectedType: 'directory'
                });

                if (destValidation.error && !(destValidation.node === null && destValidation.error.includes("No such file or directory"))) {
                    return { success: false, error: `unzip: ${destValidation.error}` };
                }

                const resolvedDestPath = destValidation.resolvedPath;

                if (!destValidation.node) {
                    const mkdirResult = await CommandExecutor.processSingleCommand(`mkdir -p "${resolvedDestPath}"`, { isInteractive: false });
                    if (!mkdirResult.success) {
                        return { success: false, error: `unzip: could not create destination directory: ${mkdirResult.error}` };
                    }
                }

                await OutputManager.appendToOutput(`Extracting archive '${archivePathArg}'...`);

                const extractionContext = {
                    currentUser,
                    primaryGroup: UserManager.getPrimaryGroupForUser(currentUser)
                };

                const extractResult = await _performExtraction(archiveContent, resolvedDestPath, extractionContext);

                if (!extractResult.success) {
                    return { success: false, error: `unzip: extraction failed. ${extractResult.error}` };
                }

                if (!(await FileSystemManager.save())) {
                    return { success: false, error: "unzip: Failed to save file system changes." };
                }

                return { success: true, output: `Archive '${archivePathArg}' successfully extracted to '${resolvedDestPath}'.` };
            } catch (e) {
                return { success: false, error: `unzip: An unexpected error occurred: ${e.message}` };
            }
        }
    };

    const unzipDescription = "Extracts files from a .zip archive.";
    const unzipHelpText = `Usage: unzip <archive.zip> [destination]

Extracts a simulated .zip archive created by the 'zip' command.

DESCRIPTION
       The unzip command extracts the files and directories from
       <archive.zip> into the specified [destination] directory.
       If no destination is provided, it extracts to the current
       directory.

EXAMPLES
       unzip my_project.zip
              Extracts the archive into the current directory.

       unzip my_project.zip /home/Guest/backups/
              Extracts the archive into the 'backups' directory.`;

    CommandRegistry.register("unzip", unzipCommandDefinition, unzipDescription, unzipHelpText);
})();