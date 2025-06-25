/**
 * @file Defines the 'unzip' command for extracting simulated zip archives.
 * @author Andrew Edmark & Gemini
 */
(() => {
    "use strict";

    /**
     * Recursively creates files and directories from an archive object.
     * @private
     * @param {object} archiveObject - The current object from the parsed archive JSON.
     * @param {string} destinationPath - The path to extract the current object into.
     * @param {object} extractionContext - Contains currentUser and primaryGroup for new files.
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async function _extractFromArchive(archiveObject, destinationPath, extractionContext) {
        if (!archiveObject || typeof archiveObject !== 'object') {
            return { success: false, error: "Invalid archive format." };
        }

        // Handle case where archive represents a single file
        if (archiveObject.type === 'file') {
            const saveResult = await FileSystemManager.createOrUpdateFile(
                destinationPath,
                archiveObject.content,
                extractionContext
            );
            return { success: saveResult.success, error: saveResult.error };
        }

        // Handle directory archives
        for (const name in archiveObject.children) {
            const childNode = archiveObject.children[name];
            const newPath = FileSystemManager.getAbsolutePath(name, destinationPath);

            if (childNode.type === 'file') {
                const saveResult = await FileSystemManager.createOrUpdateFile(
                    newPath,
                    childNode.content,
                    extractionContext
                );
                if (!saveResult.success) return saveResult;
            } else if (childNode.type === 'directory') {
                const mkdirResult = await CommandExecutor.processSingleCommand(`mkdir -p "${newPath}"`, false);
                if (!mkdirResult.success) {
                    return { success: false, error: `Could not create directory ${newPath}: ${mkdirResult.error}` };
                }
                const recursiveResult = await _extractFromArchive(childNode, newPath, extractionContext);
                if (!recursiveResult.success) return recursiveResult;
            }
        }
        return { success: true };
    }

    const unzipCommandDefinition = {
        commandName: "unzip",
        argValidation: {
            min: 1,
            max: 2,
            error: "Usage: unzip <archive.zip> [destination_path]"
        },
        pathValidation: [{
            argIndex: 0,
            options: { expectedType: 'file' }
        }],
        coreLogic: async (context) => {
            const { args, currentUser, validatedPaths } = context;
            const archivePathArg = args[0];
            const destinationPathArg = args.length > 1 ? args[1] : '.';

            if (!archivePathArg.endsWith('.zip')) {
                return { success: false, error: `unzip: invalid file extension for '${archivePathArg}'. Must be .zip` };
            }

            const archiveNode = validatedPaths[0].node;
            let archiveContent;
            try {
                archiveContent = JSON.parse(archiveNode.content);
            } catch (e) {
                return { success: false, error: `unzip: failed to parse archive file '${archivePathArg}'. Not a valid zip file.` };
            }

            const destValidation = FileSystemManager.validatePath("unzip", destinationPathArg, {
                allowMissing: true
            });

            if (destValidation.error && !(destValidation.optionsUsed.allowMissing && !destValidation.node)) {
                return { success: false, error: destValidation.error };
            }

            if (destValidation.node && destValidation.node.type !== Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
                return { success: false, error: `unzip: destination '${destinationPathArg}' is not a directory.`};
            }

            if (!destValidation.node) {
                const mkdirResult = await CommandExecutor.processSingleCommand(`mkdir -p "${destValidation.resolvedPath}"`, false);
                if (!mkdirResult.success) {
                    return { success: false, error: `unzip: could not create destination directory: ${mkdirResult.error}` };
                }
            }

            await OutputManager.appendToOutput(`Extracting archive '${archivePathArg}'...`);

            const extractionContext = {
                currentUser,
                primaryGroup: UserManager.getPrimaryGroupForUser(currentUser)
            };

            const extractResult = await _extractFromArchive(archiveContent, destValidation.resolvedPath, extractionContext);

            if (!extractResult.success) {
                return { success: false, error: `unzip: extraction failed. ${extractResult.error}` };
            }

            if (!(await FileSystemManager.save())) {
                return { success: false, error: "unzip: Failed to save file system changes." };
            }

            return { success: true, output: `Archive '${archivePathArg}' successfully extracted to '${destValidation.resolvedPath}'.` };
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