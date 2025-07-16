// scripts/commands/cp.js
(() => {
    "use strict";

    const cpCommandDefinition = {
        commandName: "cp",
        completionType: "paths", // Preserved for tab completion
        flagDefinitions: [
            { name: "recursive", short: "-r", long: "--recursive", aliases: ["-R"] },
            { name: "force", short: "-f", long: "--force" },
            { name: "preserve", short: "-p", long: "--preserve" },
            { name: "interactive", short: "-i", long: "--interactive" },
        ],
        argValidation: {
            min: 2,
            error: "Usage: cp [OPTION]... <source> <destination> or cp [OPTION]... <source>... <directory>",
        },
        coreLogic: async (context) => {
            const { args, flags, currentUser, options } = context;
            const nowISO = new Date().toISOString();
            let anyChangesMade = false;

            try {
                const destPathArg = args.pop();
                const sourcePathArgs = args;

                const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
                if (!primaryGroup) {
                    return { success: false, error: "cp: critical - could not determine primary group for current user." };
                }

                const destAbsPath = FileSystemManager.getAbsolutePath(destPathArg);
                let destNode = FileSystemManager.getNodeByPath(destAbsPath);

                let isDestADirectory = destNode && destNode.type === 'directory';

                if (sourcePathArgs.length > 1 && !isDestADirectory) {
                    return { success: false, error: `cp: target '${destPathArg}' is not a directory` };
                }

                for (const sourcePathArg of sourcePathArgs) {
                    const sourceAbsPath = FileSystemManager.getAbsolutePath(sourcePathArg);
                    const sourceNode = FileSystemManager.getNodeByPath(sourceAbsPath);

                    if (!sourceNode) {
                        return { success: false, error: `cp: cannot stat '${sourcePathArg}': No such file or directory` };
                    }

                    if (!FileSystemManager.hasPermission(sourceNode, currentUser, "read")) {
                        return { success: false, error: `cp: cannot read '${sourcePathArg}': Permission denied` };
                    }

                    let targetContainerAbsPath, targetEntryName;

                    if (isDestADirectory) {
                        targetContainerAbsPath = destAbsPath;
                        targetEntryName = sourceAbsPath.substring(sourceAbsPath.lastIndexOf('/') + 1);
                    } else {
                        targetContainerAbsPath = destAbsPath.substring(0, destAbsPath.lastIndexOf('/')) || '/';
                        targetEntryName = destAbsPath.substring(destAbsPath.lastIndexOf('/') + 1);
                    }

                    const copyResult = await _executeCopyInternal(sourceNode, sourcePathArg, targetContainerAbsPath, targetEntryName);

                    if(!copyResult.success) {
                        return copyResult;
                    }
                    if(copyResult.changed) anyChangesMade = true;
                }

                if (anyChangesMade && !(await FileSystemManager.save())) {
                    return { success: false, error: "cp: CRITICAL - Failed to save file system changes." };
                }

                return {
                    success: true,
                    output: ""
                };


                async function _executeCopyInternal(sourceNode, sourcePathForMsg, targetContainerAbsPath, targetEntryName) {
                    const targetContainerNode = FileSystemManager.getNodeByPath(targetContainerAbsPath);
                    if (!targetContainerNode || targetContainerNode.type !== 'directory') {
                        return { success: false, error: `cp: target '${targetContainerAbsPath}' is not a directory.` };
                    }

                    if (!FileSystemManager.hasPermission(targetContainerNode, currentUser, "write")) {
                        return { success: false, error: `cp: cannot create item in '${targetContainerAbsPath}': Permission denied` };
                    }

                    const fullFinalDestPath = FileSystemManager.getAbsolutePath(targetEntryName, targetContainerAbsPath);
                    const existingNodeAtDest = targetContainerNode.children[targetEntryName];

                    if (existingNodeAtDest) {
                        const isPromptRequired = flags.interactive || (options.isInteractive && !flags.force);
                        if (isPromptRequired) {
                            const confirmed = await new Promise((resolve) => {
                                ModalManager.request({
                                    context: "terminal",
                                    messageLines: [`Overwrite '${fullFinalDestPath}'?`],
                                    onConfirm: () => resolve(true),
                                    onCancel: () => resolve(false),
                                    options,
                                });
                            });
                            if (!confirmed) {
                                return { success: true, message: `cp: not overwriting '${fullFinalDestPath}' (skipped)` };
                            }
                        }
                    }

                    if (sourceNode.type === 'file') {
                        targetContainerNode.children[targetEntryName] = {
                            type: 'file',
                            content: sourceNode.content,
                            owner: flags.preserve ? sourceNode.owner : currentUser,
                            group: flags.preserve ? sourceNode.group : primaryGroup,
                            mode: flags.preserve ? sourceNode.mode : Config.FILESYSTEM.DEFAULT_FILE_MODE,
                            mtime: flags.preserve ? sourceNode.mtime : nowISO,
                        };
                    } else if (sourceNode.type === 'directory') {
                        if (!flags.recursive) {
                            await OutputManager.appendToOutput(`cp: omitting directory '${sourcePathForMsg}'`);
                            return { success: true, changed: false };
                        }

                        if (!existingNodeAtDest) {
                            const newDirNode = FileSystemManager._createNewDirectoryNode(
                                flags.preserve ? sourceNode.owner : currentUser,
                                flags.preserve ? sourceNode.group : primaryGroup,
                                flags.preserve ? sourceNode.mode : Config.FILESYSTEM.DEFAULT_DIR_MODE
                            );
                            if (flags.preserve) newDirNode.mtime = sourceNode.mtime;
                            targetContainerNode.children[targetEntryName] = newDirNode;
                        }

                        const newContainerPath = FileSystemManager.getAbsolutePath(targetEntryName, targetContainerAbsPath);

                        for (const childName in sourceNode.children) {
                            const childSourceNode = sourceNode.children[childName];
                            const childSourcePath = FileSystemManager.getAbsolutePath(childName, sourcePathForMsg);
                            const childResult = await _executeCopyInternal(
                                childSourceNode,
                                childSourcePath,
                                newContainerPath,
                                childName
                            );
                            if (!childResult.success) return childResult;
                        }
                    }

                    targetContainerNode.mtime = nowISO;
                    return { success: true, changed: true };
                }
            } catch (e) {
                return { success: false, error: `cp: An unexpected error occurred: ${e.message}` };
            }
        },
    };

    const cpDescription = "Copies files and directories.";
    const cpHelpText = `Usage: cp [OPTION]... <source> <destination>
       cp [OPTION]... <source>... <directory>

Copy files and directories.

DESCRIPTION
       In the first form, the cp utility copies the contents of the <source>
       file to the <destination> file.

       In the second form, each <source> file is copied to the destination
       <directory>. The destination must be a directory and must exist.

       Copying a directory requires the -r or -R (recursive) option.

OPTIONS
       -f, --force
              If a destination file cannot be opened, remove it and try
              again. Overwrites existing files without prompting.

       -i, --interactive
              Prompt before overwriting an existing file.

       -p, --preserve
              Preserve the original file's mode, owner, group, and
              modification time.

       -r, -R, --recursive
              Copy directories recursively.

EXAMPLES
       cp file1.txt file2.txt
              Copies the content of file1.txt to file2.txt.

       cp -i notes.txt /home/Guest/docs/
              Copies 'notes.txt' to the docs directory, prompting if a
              file with the same name exists.

       cp -r project/ backup/
              Recursively copies the entire 'project' directory into the
              'backup' directory.`;

    CommandRegistry.register("cp", cpCommandDefinition, cpDescription, cpHelpText);
})();