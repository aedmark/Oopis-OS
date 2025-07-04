/**
 * @file Defines the 'cp' command, which copies files and directories within the OopisOS file system.
 * It supports various flags for recursive copying, forcing overwrites, preserving metadata, and interactive prompts.
 * @author Andrew Edmark
 * @author Gemini
 */

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
        argValidation: {
            min: 2,
            error: "Usage: cp [OPTION]... <source> <destination> or cp [OPTION]... <source>... <directory>",
        },
        coreLogic: async (context) => {
            const { args, flags, currentUser, options } = context;
            const nowISO = new Date().toISOString();
            let anyChangesMade = false;

            const destPathArg = args.pop();
            const sourcePathArgs = args;

            const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
            if (!primaryGroup) {
                return { success: false, error: "cp: critical - could not determine primary group for current user." };
            }

            const destValidation = FileSystemManager.validatePath("cp (dest)", destPathArg, { allowMissing: true });
            if (destValidation.error && !(destValidation.optionsUsed.allowMissing && !destValidation.node)) {
                return { success: false, error: destValidation.error };
            }

            const destNode = destValidation.node;
            let isDestADirectory = destNode && destNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE;

            if (sourcePathArgs.length > 1 && !isDestADirectory) {
                return { success: false, error: `cp: target '${destPathArg}' is not a directory` };
            }

            async function _executeCopyInternal(sourceNode, sourcePathForMsg, targetContainerAbsPath, targetEntryName) {
                const targetContainerNode = FileSystemManager.getNodeByPath(targetContainerAbsPath);
                if (!targetContainerNode || targetContainerNode.type !== Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
                    return { success: false, error: `cp: target '${targetContainerAbsPath}' is not a directory.` };
                }

                if (!FileSystemManager.hasPermission(targetContainerNode, currentUser, "write")) {
                    return { success: false, error: `cp: cannot create item in '${targetContainerAbsPath}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}` };
                }

                const fullFinalDestPath = FileSystemManager.getAbsolutePath(targetEntryName, targetContainerAbsPath);
                const existingNodeAtDest = targetContainerNode.children[targetEntryName];

                if (existingNodeAtDest) {
                    const isPromptRequired = flags.interactive || (options.isInteractive && !flags.force);
                    let confirmed = !isPromptRequired;

                    if (isPromptRequired) {
                        confirmed = await new Promise((resolve) => {
                            ModalManager.request({
                                context: "terminal",
                                messageLines: [`Overwrite '${fullFinalDestPath}'?`],
                                onConfirm: () => resolve(true),
                                onCancel: () => resolve(false),
                                options,
                            });
                        });
                    }
                    if (!confirmed) {
                        return { success: true, message: `cp: not overwriting '${fullFinalDestPath}' (skipped)` };
                    }
                }

                if (sourceNode.type === Config.FILESYSTEM.DEFAULT_FILE_TYPE) {
                    targetContainerNode.children[targetEntryName] = {
                        type: Config.FILESYSTEM.DEFAULT_FILE_TYPE,
                        content: sourceNode.content,
                        owner: flags.preserve ? sourceNode.owner : currentUser,
                        group: flags.preserve ? sourceNode.group : primaryGroup,
                        mode: flags.preserve ? sourceNode.mode : Config.FILESYSTEM.DEFAULT_FILE_MODE,
                        mtime: flags.preserve ? sourceNode.mtime : nowISO,
                    };
                    anyChangesMade = true;
                } else if (sourceNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
                    if (!flags.recursive) {
                        return { success: true, message: `cp: omitting directory '${sourcePathForMsg}' (use -r or -R)` };
                    }

                    if (!existingNodeAtDest) {
                        const newDirNode = FileSystemManager._createNewDirectoryNode(
                            flags.preserve ? sourceNode.owner : currentUser,
                            flags.preserve ? sourceNode.group : primaryGroup,
                            flags.preserve ? sourceNode.mode : Config.FILESYSTEM.DEFAULT_DIR_MODE
                        );
                        if (flags.preserve) newDirNode.mtime = sourceNode.mtime;
                        targetContainerNode.children[targetEntryName] = newDirNode;
                        anyChangesMade = true;
                    }

                    for (const childName in sourceNode.children) {
                        const childResult = await _executeCopyInternal(
                            sourceNode.children[childName],
                            FileSystemManager.getAbsolutePath(childName, sourcePathForMsg),
                            fullFinalDestPath,
                            childName
                        );
                        if (!childResult.success) return childResult;
                    }
                }

                if (anyChangesMade) {
                    targetContainerNode.mtime = nowISO;
                }
                return { success: true };
            }

            for (const sourcePathArg of sourcePathArgs) {
                const sourceValidation = FileSystemManager.validatePath("cp (source)", sourcePathArg);
                if (sourceValidation.error) {
                    return { success: false, error: sourceValidation.error };
                }

                if (!FileSystemManager.hasPermission(sourceValidation.node, currentUser, "read")) {
                    return { success: false, error: `cp: cannot read '${sourcePathArg}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}` };
                }

                let targetContainerAbsPath, targetEntryName;

                if (isDestADirectory) {
                    targetContainerAbsPath = destValidation.resolvedPath;
                    targetEntryName = sourceValidation.resolvedPath.substring(sourceValidation.resolvedPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1);
                } else {
                    targetContainerAbsPath = destValidation.resolvedPath.substring(0, destValidation.resolvedPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR)) || Config.FILESYSTEM.ROOT_PATH;
                    targetEntryName = destValidation.resolvedPath.substring(destValidation.resolvedPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1);
                }

                const result = await _executeCopyInternal(sourceValidation.node, sourcePathArg, targetContainerAbsPath, targetEntryName);

                if(!result.success) {
                    return result;
                }
            }

            if (anyChangesMade && !(await FileSystemManager.save())) {
                return { success: false, error: "cp: CRITICAL - Failed to save file system changes." };
            }
            // REFACTOR START: Return a success message
            return {
                success: true,
                output: `${Config.MESSAGES.COPIED_PREFIX}${sourcePathArgs.join(" ")}${Config.MESSAGES.COPIED_TO}${destPathArg}${Config.MESSAGES.COPIED_SUFFIX}`,
                messageType: Config.CSS_CLASSES.SUCCESS_MSG
            };
            // REFACTOR END
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