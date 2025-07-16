// scripts/commands/zip.js
(() => {
    "use strict";

    async function _archiveNode(node) {
        if (node.type === Config.FILESYSTEM.DEFAULT_FILE_TYPE) {
            return {
                type: 'file',
                content: node.content
            };
        }

        if (node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
            const children = {};
            const childNames = Object.keys(node.children).sort();
            for (const childName of childNames) {
                const childNode = node.children[childName];
                children[childName] = await _archiveNode(childNode);
            }
            return {
                type: 'directory',
                children: children
            };
        }
        return null;
    }

    const zipCommandDefinition = {
        commandName: "zip",
        completionType: "paths", // Preserved for tab completion.
        argValidation: {
            exact: 2,
            error: "Usage: zip <archive.zip> <path_to_zip>"
        },
        coreLogic: async (context) => {
            const { args, currentUser } = context;
            let archivePath = args[0];
            const sourcePath = args[1];

            try {
                if (!archivePath.endsWith('.zip')) {
                    archivePath += '.zip';
                }

                const sourceValidation = FileSystemManager.validatePath(sourcePath, {
                    permissions: ['read']
                });
                if (sourceValidation.error) {
                    return { success: false, error: `zip: ${sourceValidation.error}` };
                }

                const archiveValidation = FileSystemManager.validatePath(archivePath, {
                    allowMissing: true,
                    expectedType: 'file'
                });
                if (archiveValidation.error && !archiveValidation.node && !archiveValidation.error.includes("No such file or directory")) {
                    return { success: false, error: `zip: ${archiveValidation.error}` };
                }
                if (archiveValidation.node && archiveValidation.node.type === 'directory') {
                    return { success: false, error: `zip: cannot overwrite directory '${archivePath}' with a file` };
                }

                await OutputManager.appendToOutput(`Zipping '${sourcePath}'...`);

                const sourceName = sourceValidation.resolvedPath.split('/').pop() || sourceValidation.resolvedPath;
                const archiveObject = {
                    [sourceName]: await _archiveNode(sourceValidation.node)
                };
                const archiveContent = JSON.stringify(archiveObject, null, 2);

                const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
                const saveResult = await FileSystemManager.createOrUpdateFile(
                    archiveValidation.resolvedPath,
                    archiveContent,
                    { currentUser, primaryGroup }
                );

                if (!saveResult.success) {
                    return { success: false, error: `zip: ${saveResult.error}` };
                }

                if (!(await FileSystemManager.save())) {
                    return { success: false, error: "zip: Failed to save file system changes." };
                }

                return { success: true, output: `Successfully zipped '${sourcePath}' to '${archivePath}'.` };
            } catch (e) {
                return { success: false, error: `zip: An unexpected error occurred: ${e.message}` };
            }
        }
    };

    const zipDescription = "Creates a compressed .zip archive of a file or directory.";
    const zipHelpText = `Usage: zip <archive.zip> <path>

Creates a simulated compressed archive of a file or directory.

DESCRIPTION
       The zip command recursively archives the contents of the specified
       <path> into a single file named <archive.zip>. The resulting
       .zip file is a JSON representation of the file structure, not
       a standard binary zip file. It can be unzipped using the 'unzip'
       command.

EXAMPLES
       zip my_project.zip /home/Guest/project
              Creates 'my_project.zip' containing the 'project' directory.`;

    CommandRegistry.register("zip", zipCommandDefinition, zipDescription, zipHelpText);
})();