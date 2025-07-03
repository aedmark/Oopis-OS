/**
 * @file Defines the 'zip' command for creating simulated zip archives.
 * @author Andrew Edmark & Gemini
 */
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
        argValidation: {
            exact: 2,
            error: "Usage: zip <archive.zip> <path_to_zip>"
        },
        coreLogic: async (context) => {
            const { args, currentUser } = context;
            let archivePath = args[0];
            const sourcePath = args[1];

            if (!archivePath.endsWith('.zip')) {
                archivePath += '.zip';
            }

            const sourceValidation = FileSystemManager.validatePath("zip", sourcePath);
            if (sourceValidation.error) {
                return { success: false, error: sourceValidation.error };
            }

            const archiveValidation = FileSystemManager.validatePath("zip", archivePath, { allowMissing: true });
            if (archiveValidation.error && !archiveValidation.optionsUsed.allowMissing) {
                return { success: false, error: archiveValidation.error };
            }
            if (archiveValidation.node && archiveValidation.node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
                return { success: false, error: `zip: cannot overwrite directory '${archivePath}' with a file` };
            }

            await OutputManager.appendToOutput(`Zipping '${sourcePath}'...`);

            // *** FIX: Wrap the archive in an object with the source's name as the key ***
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