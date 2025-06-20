// scripts/commands/cp.js

(() => {
    "use strict";
    const cpCommandDefinition = {
        commandName: "cp",
        flagDefinitions: [
            { name: "recursive", short: "-r", long: "--recursive", aliases: ["-R"] },
            { name: "force", short: "-f", long: "--force" },
            { name: "preserve", short: "-p", long: "--preserve" },
            { name: "interactive", short: "-i", long: "--interactive" },
        ],
        argValidation: { min: 2 },
        coreLogic: async (context) => {
            const { args, flags, currentUser, options } = context;
            const nowISO = new Date().toISOString();
            flags.isInteractiveEffective = flags.interactive && !flags.force;

            const rawDestPathArg = args.pop();
            const sourcePathArgs = args;
            let operationMessages = [];
            let overallSuccess = true;
            let anyChangesMadeGlobal = false;

            const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
            if (!primaryGroup) {
                return {
                    success: false,
                    error:
                        "cp: critical - could not determine primary group for current user.",
                };
            }

            async function _executeCopyInternal(
                sourceNode,
                sourcePathForMsg,
                targetContainerAbsPath,
                targetEntryName,
                currentCommandFlags,
                userPrimaryGroup
            ) {
                let currentOpMessages = [];
                let currentOpSuccess = true;
                let madeChangeInThisCall = false;

                const targetContainerNode = FileSystemManager.getNodeByPath(
                    targetContainerAbsPath
                );
                if (
                    !targetContainerNode ||
                    targetContainerNode.type !== Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
                ) {
                    return {
                        success: false,
                        messages: [
                            `cp: target '${targetContainerAbsPath}' is not a directory.`,
                        ],
                        changesMade: false,
                    };
                }

                if (
                    !FileSystemManager.hasPermission(
                        targetContainerNode,
                        currentUser,
                        "write"
                    )
                ) {
                    return {
                        success: false,
                        messages: [
                            `cp: cannot create item in '${targetContainerAbsPath}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`,
                        ],
                        changesMade: false,
                    };
                }

                const fullFinalDestPath = FileSystemManager.getAbsolutePath(
                    targetEntryName,
                    targetContainerAbsPath
                );
                let existingNodeAtDest = targetContainerNode.children[targetEntryName];

                if (existingNodeAtDest) {
                    if (sourceNode.type !== existingNodeAtDest.type) {
                        return {
                            success: false,
                            messages: [
                                `cp: cannot overwrite ${existingNodeAtDest.type} '${fullFinalDestPath}' with ${sourceNode.type} '${sourcePathForMsg}'`,
                            ],
                            changesMade: false,
                        };
                    }
                    if (currentCommandFlags.isInteractiveEffective) {
                        const confirmed = await new Promise((r) =>
                            ModalManager.request({
                                context: "terminal",
                                messageLines: [`Overwrite '${fullFinalDestPath}'?`],
                                onConfirm: () => r(true),
                                onCancel: () => r(false),
                                options,
                            })
                        );
                        if (!confirmed)
                            return {
                                success: true,
                                messages: [
                                    `cp: not overwriting '${fullFinalDestPath}' (skipped)`,
                                ],
                                changesMade: false,
                            };
                    } else if (!currentCommandFlags.force) {
                        return {
                            success: false,
                            messages: [
                                `cp: '${fullFinalDestPath}' already exists. Use -f to overwrite or -i to prompt.`,
                            ],
                            changesMade: false,
                        };
                    }
                }

                if (sourceNode.type === Config.FILESYSTEM.DEFAULT_FILE_TYPE) {
                    targetContainerNode.children[targetEntryName] = {
                        type: Config.FILESYSTEM.DEFAULT_FILE_TYPE,
                        content: sourceNode.content,
                        owner: currentCommandFlags.preserve
                            ? sourceNode.owner
                            : currentUser,
                        group: currentCommandFlags.preserve
                            ? sourceNode.group
                            : userPrimaryGroup,
                        mode: currentCommandFlags.preserve
                            ? sourceNode.mode
                            : Config.FILESYSTEM.DEFAULT_FILE_MODE,
                        mtime: currentCommandFlags.preserve ? sourceNode.mtime : nowISO,
                    };
                    madeChangeInThisCall = true;
                } else if (
                    sourceNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
                ) {
                    if (!currentCommandFlags.recursive) {
                        return {
                            success: true,
                            messages: [
                                `cp: omitting directory '${sourcePathForMsg}' (use -r or -R)`,
                            ],
                            changesMade: false,
                        };
                    }

                    if (!existingNodeAtDest) {
                        const owner = currentCommandFlags.preserve ? sourceNode.owner : currentUser;
                        const group = currentCommandFlags.preserve ? sourceNode.group : userPrimaryGroup;
                        const mode = currentCommandFlags.preserve ? sourceNode.mode : Config.FILESYSTEM.DEFAULT_DIR_MODE;

                        const newDirNode = FileSystemManager._createNewDirectoryNode(owner, group, mode);

                        if (currentCommandFlags.preserve) {
                            newDirNode.mtime = sourceNode.mtime;
                        }

                        targetContainerNode.children[targetEntryName] = newDirNode;
                        madeChangeInThisCall = true;
                    }
                    for (const childName in sourceNode.children) {
                        const childCopyResult = await _executeCopyInternal(
                            sourceNode.children[childName],
                            FileSystemManager.getAbsolutePath(childName, sourcePathForMsg),
                            fullFinalDestPath,
                            childName,
                            currentCommandFlags,
                            userPrimaryGroup
                        );
                        currentOpMessages.push(...childCopyResult.messages);
                        if (!childCopyResult.success) currentOpSuccess = false;
                        if (childCopyResult.changesMade) madeChangeInThisCall = true;
                    }
                }

                if (madeChangeInThisCall) {
                    targetContainerNode.mtime = nowISO;
                }

                return {
                    success: currentOpSuccess,
                    messages: currentOpMessages,
                    changesMade: madeChangeInThisCall,
                };
            }

            const destValidation = FileSystemManager.validatePath(
                "cp (dest)",
                rawDestPathArg,
                { allowMissing: true }
            );
            if (
                destValidation.error &&
                !(destValidation.optionsUsed.allowMissing && !destValidation.node)
            ) {
                return { success: false, error: destValidation.error };
            }

            const isDestADirectory =
                destValidation.node &&
                destValidation.node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE;
            if (sourcePathArgs.length > 1 && !isDestADirectory) {
                return {
                    success: false,
                    error: `cp: target '${rawDestPathArg}' is not a directory`,
                };
            }

            for (const sourcePathArg of sourcePathArgs) {
                const sourceValidation = FileSystemManager.validatePath(
                    "cp (source)",
                    sourcePathArg
                );
                if (sourceValidation.error) {
                    operationMessages.push(sourceValidation.error);
                    overallSuccess = false;
                    continue;
                }
                if (
                    !FileSystemManager.hasPermission(
                        sourceValidation.node,
                        currentUser,
                        "read"
                    )
                ) {
                    operationMessages.push(
                        `cp: cannot read '${sourcePathArg}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`
                    );
                    overallSuccess = false;
                    continue;
                }
                let targetContainerAbsPath, targetEntryName;
                if (isDestADirectory) {
                    targetContainerAbsPath = destValidation.resolvedPath;
                    targetEntryName = sourceValidation.resolvedPath.substring(
                        sourceValidation.resolvedPath.lastIndexOf(
                            Config.FILESYSTEM.PATH_SEPARATOR
                        ) + 1
                    );
                } else {
                    targetContainerAbsPath =
                        destValidation.resolvedPath.substring(
                            0,
                            destValidation.resolvedPath.lastIndexOf(
                                Config.FILESYSTEM.PATH_SEPARATOR
                            )
                        ) || Config.FILESYSTEM.ROOT_PATH;
                    targetEntryName = destValidation.resolvedPath.substring(
                        destValidation.resolvedPath.lastIndexOf(
                            Config.FILESYSTEM.PATH_SEPARATOR
                        ) + 1
                    );
                }

                const copyResult = await _executeCopyInternal(
                    sourceValidation.node,
                    sourcePathArg,
                    targetContainerAbsPath,
                    targetEntryName,
                    flags,
                    primaryGroup
                );

                operationMessages.push(...copyResult.messages);
                if (!copyResult.success) overallSuccess = false;
                if (copyResult.changesMade) anyChangesMadeGlobal = true;
            }

            if (anyChangesMadeGlobal && !(await FileSystemManager.save())) {
                operationMessages.push(
                    "cp: CRITICAL - Failed to save file system changes."
                );
                overallSuccess = false;
            }

            const finalMessages = operationMessages.filter((m) => m).join("\n");
            return {
                success: overallSuccess,
                output: finalMessages,
                error: overallSuccess
                    ? null
                    : finalMessages || "An unknown error occurred.",
            };
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