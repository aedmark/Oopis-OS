// scripts/commands/unzip.js

async function _restoreNode(name, nodeData, parentPath, dependencies, currentUser) {
    const { FileSystemManager, UserManager } = dependencies;
    const fullPath = FileSystemManager.getAbsolutePath(name, parentPath);

    if (nodeData.type === 'file') {
        const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
        const result = await FileSystemManager.createOrUpdateFile(
            fullPath,
            nodeData.content || '',
            { currentUser, primaryGroup }
        );
        if (!result.success) {
            throw new Error(`Failed to create file ${fullPath}: ${result.error}`);
        }
    } else if (nodeData.type === 'directory') {
        const mkdirResult = await FileSystemManager.createOrUpdateFile(
            fullPath,
            null,
            {
                isDirectory: true,
                currentUser: currentUser,
                primaryGroup: UserManager.getPrimaryGroupForUser(currentUser),
            }
        );

        if (!mkdirResult.success) {
            throw new Error(`Failed to create directory ${fullPath}: ${mkdirResult.error}`);
        }

        if (nodeData.children) {
            for (const childName in nodeData.children) {
                await _restoreNode(childName, nodeData.children[childName], fullPath, dependencies, currentUser);
            }
        }
    }
}


window.UnzipCommand = class UnzipCommand extends Command {
    constructor() {
        super({
            commandName: "unzip",
            description: "Extracts files from a .zip archive.",
            helpText: `Usage: unzip <archive.zip>
      Extract files from a OopisOS zip archive.
      DESCRIPTION
      The unzip command extracts the contents of a .zip file created with
      the 'zip' command. It recreates the archived directory structure
      in the current working directory.
      If files or directories from the archive already exist in the
      current location, they will be overwritten.
      EXAMPLES
      unzip my_project.zip
      Extracts the contents of 'my_project.zip' into the current
      directory.`,
            completionType: "paths",
            validations: {
                args: {
                    exact: 1,
                    error: "Usage: unzip <archive.zip>"
                },
                paths: [{
                    argIndex: 0,
                    options: {
                        expectedType: 'file',
                        permissions: ['read']
                    }
                }]
            },
        });
    }

    async coreLogic(context) {
        const { currentUser, validatedPaths, dependencies } = context;
        const { ErrorHandler, FileSystemManager } = dependencies;

        if (!validatedPaths || validatedPaths.length === 0) {
            return ErrorHandler.createError("unzip: missing file operand");
        }

        const { node: archiveNode, arg: archivePath } = validatedPaths[0];

        if (!archiveNode || !archivePath.endsWith(".zip")) {
            return ErrorHandler.createError(
                "unzip: provided file is not a .zip archive."
            );
        }

        let archiveData;
        try {
            archiveData = JSON.parse(archiveNode.content || "{}");
        } catch (e) {
            return ErrorHandler.createError(
                `unzip: cannot process archive, invalid JSON format. ${e.message}`
            );
        }

        const currentDirectory = FileSystemManager.getCurrentPath();

        try {
            for (const name in archiveData) {
                await _restoreNode(
                    name,
                    archiveData[name],
                    currentDirectory,
                    dependencies,
                    currentUser
                );
            }
            await FileSystemManager.save();
            return ErrorHandler.createSuccess(
                `Archive '${archivePath}' successfully unzipped.`
            );
        } catch (e) {
            return ErrorHandler.createError(
                `unzip: an error occurred during extraction: ${e.message}`
            );
        }
    }
}

window.CommandRegistry.register(new UnzipCommand());
