// scripts/commands/rmdir.js
(() => {
    "use strict";

    const rmdirCommandDefinition = {
        commandName: "rmdir",
        completionType: "paths", // Preserved for tab completion
        argValidation: {
            min: 1,
            error: "missing operand"
        },
        coreLogic: async (context) => {
            const { args, currentUser } = context;
            const outputMessages = [];
            let allSuccess = true;
            let changesMade = false;

            try {
                for (const pathArg of args) {
                    const resolvedPath = FileSystemManager.getAbsolutePath(pathArg);
                    const node = FileSystemManager.getNodeByPath(resolvedPath);

                    if (!node) {
                        outputMessages.push(`rmdir: failed to remove '${pathArg}': No such file or directory`);
                        allSuccess = false;
                        continue;
                    }

                    if (node.type !== 'directory') {
                        outputMessages.push(`rmdir: failed to remove '${pathArg}': Not a directory`);
                        allSuccess = false;
                        continue;
                    }

                    const parentPath = resolvedPath.substring(0, resolvedPath.lastIndexOf('/')) || '/';
                    const parentNode = FileSystemManager.getNodeByPath(parentPath);

                    if (Object.keys(node.children).length > 0) {
                        outputMessages.push(`rmdir: failed to remove '${pathArg}': Directory not empty`);
                        allSuccess = false;
                        continue;
                    }

                    if (!FileSystemManager.hasPermission(parentNode, currentUser, "write")) {
                        outputMessages.push(`rmdir: failed to remove '${pathArg}': Permission denied`);
                        allSuccess = false;
                        continue;
                    }

                    const dirName = resolvedPath.split('/').pop();
                    delete parentNode.children[dirName];
                    parentNode.mtime = new Date().toISOString();
                    changesMade = true;
                }

                if (changesMade) {
                    await FileSystemManager.save();
                }

                if (allSuccess) {
                    return { success: true, output: "" };
                } else {
                    return { success: false, error: outputMessages.join('\\n') };
                }
            } catch (e) {
                return { success: false, error: `rmdir: An unexpected error occurred: ${e.message}` };
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
