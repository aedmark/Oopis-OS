// scripts/commands/mkdir.js

(() => {
    "use strict";
    const mkdirCommandDefinition = {
        commandName: "mkdir",
        flagDefinitions: [
            {
                name: "parents",
                short: "-p",
                long: "--parents",
            },
        ],
        argValidation: {
            min: 1,
        },
        coreLogic: async (context) => {
            const { args, flags, currentUser } = context;
            let allSuccess = true;
            const messages = [];
            let changesMade = false;
            const nowISO = new Date().toISOString();

            const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
            if (!primaryGroup) {
                return {
                    success: false,
                    error: `mkdir: critical - could not determine primary group for user '${currentUser}'`,
                };
            }

            for (const pathArg of args) {
                const resolvedPath = FileSystemManager.getAbsolutePath(
                    pathArg,
                    FileSystemManager.getCurrentPath()
                );
                const dirName = resolvedPath.substring(
                    resolvedPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1
                );
                if (
                    resolvedPath === Config.FILESYSTEM.ROOT_PATH ||
                    dirName === "" ||
                    dirName === "." ||
                    dirName === ".."
                ) {
                    messages.push(
                        `mkdir: cannot create directory '${pathArg}': Invalid path or name`
                    );
                    allSuccess = false;
                    continue;
                }
                let parentNodeToCreateIn;
                if (flags.parents) {
                    const parentDirResult =
                        FileSystemManager.createParentDirectoriesIfNeeded(resolvedPath);
                    if (parentDirResult.error) {
                        messages.push(`mkdir: ${parentDirResult.error}`);
                        allSuccess = false;
                        continue;
                    }
                    parentNodeToCreateIn = parentDirResult.parentNode;
                } else {
                    const parentPathForTarget =
                        resolvedPath.substring(
                            0,
                            resolvedPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR)
                        ) || Config.FILESYSTEM.ROOT_PATH;
                    parentNodeToCreateIn =
                        FileSystemManager.getNodeByPath(parentPathForTarget);
                    if (!parentNodeToCreateIn) {
                        messages.push(
                            `mkdir: cannot create directory '${pathArg}': Parent directory '${parentPathForTarget}' does not exist`
                        );
                        allSuccess = false;
                        continue;
                    }
                    if (
                        parentNodeToCreateIn.type !==
                        Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
                    ) {
                        messages.push(
                            `mkdir: cannot create directory '${pathArg}': Path component '${parentPathForTarget}' is not a directory`
                        );
                        allSuccess = false;
                        continue;
                    }
                    if (
                        !FileSystemManager.hasPermission(
                            parentNodeToCreateIn,
                            currentUser,
                            "write"
                        )
                    ) {
                        messages.push(
                            `mkdir: cannot create directory '${pathArg}' in '${parentPathForTarget}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`
                        );
                        allSuccess = false;
                        continue;
                    }
                }
                if (
                    parentNodeToCreateIn.children &&
                    parentNodeToCreateIn.children[dirName]
                ) {
                    const existingItem = parentNodeToCreateIn.children[dirName];
                    if (existingItem.type === Config.FILESYSTEM.DEFAULT_FILE_TYPE) {
                        messages.push(
                            `mkdir: cannot create directory '${pathArg}': File exists`
                        );
                        allSuccess = false;
                    } else if (
                        existingItem.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE &&
                        !flags.parents
                    ) {
                        messages.push(
                            `mkdir: cannot create directory '${pathArg}': Directory already exists.`
                        );
                        allSuccess = false;
                    }
                } else {
                    parentNodeToCreateIn.children[dirName] = FileSystemManager._createNewDirectoryNode(
                        currentUser,
                        primaryGroup
                    );
                    parentNodeToCreateIn.mtime = nowISO;
                    messages.push(`created directory '${pathArg}'`);
                    changesMade = true;
                }
            }
            if (changesMade && !(await FileSystemManager.save())) {
                allSuccess = false;
                messages.unshift("mkdir: Failed to save file system changes.");
            }
            if (!allSuccess) {
                return {
                    success: false,
                    error: messages.join("\n"),
                };
            }
            return {
                success: true,
                output: messages.join("\n"),
                messageType: Config.CSS_CLASSES.SUCCESS_MSG,
            };
        },
    };
    const mkdirDescription = "Creates one or more new directories.";
    const mkdirHelpText = "Usage: mkdir [options] <directory>...\n\nCreates one or more new directories.";
    CommandRegistry.register("mkdir", mkdirCommandDefinition, mkdirDescription, mkdirHelpText);
})();