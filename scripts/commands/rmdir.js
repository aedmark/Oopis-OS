/**
 * @file Defines the 'rmdir' command, which removes empty directories.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} rmdirCommandDefinition
     * @description The command definition for the 'rmdir' command. Adheres to the Command Contract.
     */
    const rmdirCommandDefinition = {
        commandName: "rmdir",
        argValidation: {
            min: 1,
            error: "missing operand"
        },
        coreLogic: async (context) => {
            const { args, currentUser } = context;
            const outputMessages = [];
            let allSuccess = true;

            for (const pathArg of args) {
                const pathValidation = FileSystemManager.validatePath("rmdir", pathArg, {
                    expectedType: 'directory' // Explicitly require a directory
                });

                if (pathValidation.error) {
                    outputMessages.push(pathValidation.error);
                    allSuccess = false;
                    continue;
                }

                const node = pathValidation.node;
                const parentPath = pathValidation.resolvedPath.substring(0, pathValidation.resolvedPath.lastIndexOf('/')) || '/';
                const parentNode = FileSystemManager.getNodeByPath(parentPath);

                // Check if the directory is empty
                if (Object.keys(node.children).length > 0) {
                    outputMessages.push(`rmdir: failed to remove '${pathArg}': Directory not empty`);
                    allSuccess = false;
                    continue;
                }

                // Check for write permission on the parent directory
                if (!FileSystemManager.hasPermission(parentNode, currentUser, "write")) {
                    outputMessages.push(`rmdir: failed to remove '${pathArg}': Permission denied`);
                    allSuccess = false;
                    continue;
                }

                // Perform the deletion
                const dirName = pathValidation.resolvedPath.split('/').pop();
                delete parentNode.children[dirName];
                parentNode.mtime = new Date().toISOString();
            }

            if (allSuccess) {
                await FileSystemManager.save();
                return { success: true, output: "" };
            } else {
                return { success: false, error: outputMessages.join('\n') };
            }
        }
    };

    const rmdirDescription = "Removes empty directories.";

    const rmdirHelpText = `Usage: rmdir [DIRECTORY]...

Remove the DIRECTORY(ies), if they are empty.

DESCRIPTION
       The rmdir command removes empty directories from the filesystem.
       This command provides a safe way to clean up directory structures,
       as it will fail rather than delete a directory that still contains
       files or other subdirectories.

EXAMPLES
       rmdir old_project/
              Removes the 'old_project' directory, but only if it is empty.

SEE ALSO
       rm(1)`;

    CommandRegistry.register("rmdir", rmdirCommandDefinition, rmdirDescription, rmdirHelpText);
})();