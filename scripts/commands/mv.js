// scripts/commands/mv.js

(() => {
    "use strict";
    const mvCommandDefinition = {
        commandName: "mv",
        flagDefinitions: [
            {
                name: "force",
                short: "-f",
                long: "--force",
            },
            {
                name: "interactive",
                short: "-i",
                long: "--interactive",
            },
        ],
        argValidation: {
            exact: 2,
        },
        coreLogic: async (context) => {
            const { args, currentUser, flags, options } = context;
            const sourcePathArg = args[0];
            const destPathArg = args[1];
            const nowISO = new Date().toISOString();
            const isInteractiveEffective = flags.interactive && !flags.force;
            const sourceValidation = FileSystemManager.validatePath(
                "mv (source)",
                sourcePathArg,
                {
                    disallowRoot: true,
                }
            );
            if (sourceValidation.error)
                return {
                    success: false,
                    error: sourceValidation.error,
                };
            const sourceNode = sourceValidation.node;
            const absSourcePath = sourceValidation.resolvedPath;
            const sourceParentPath =
                absSourcePath.substring(
                    0,
                    absSourcePath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR)
                ) || Config.FILESYSTEM.ROOT_PATH;
            const sourceParentNode =
                FileSystemManager.getNodeByPath(sourceParentPath);
            if (
                !sourceParentNode ||
                !FileSystemManager.hasPermission(sourceParentNode, currentUser, "write")
            ) {
                return {
                    success: false,
                    error: `mv: cannot move '${sourcePathArg}' from '${sourceParentPath}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`,
                };
            }
            const destValidation = FileSystemManager.validatePath(
                "mv (destination)",
                destPathArg,
                {
                    allowMissing: true,
                }
            );
            if (
                destValidation.error &&
                !(destValidation.optionsUsed.allowMissing && !destValidation.node)
            ) {
                return {
                    success: false,
                    error: destValidation.error,
                };
            }
            let absDestPath = destValidation.resolvedPath;
            let destNode = destValidation.node;
            const sourceName = absSourcePath.substring(
                absSourcePath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1
            );
            let finalDestName = sourceName;
            let targetContainerNode;
            let targetContainerAbsPath;
            if (
                destNode &&
                destNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
            ) {
                targetContainerNode = destNode;
                targetContainerAbsPath = absDestPath;
                absDestPath = FileSystemManager.getAbsolutePath(
                    sourceName,
                    absDestPath
                );
                destNode = targetContainerNode.children[sourceName];
            } else {
                targetContainerAbsPath =
                    absDestPath.substring(
                        0,
                        absDestPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR)
                    ) || Config.FILESYSTEM.ROOT_PATH;
                targetContainerNode = FileSystemManager.getNodeByPath(
                    targetContainerAbsPath
                );
                finalDestName = absDestPath.substring(
                    absDestPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1
                );
            }
            if (
                !targetContainerNode ||
                targetContainerNode.type !== Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
            ) {
                return {
                    success: false,
                    error: `mv: target '${targetContainerAbsPath}' is not a directory or does not exist.`,
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
                    error: `mv: cannot create item in '${targetContainerAbsPath}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`,
                };
            }
            if (absSourcePath === absDestPath) {
                return {
                    success: true,
                    output: `mv: '${sourcePathArg}' and '${destPathArg}' are the same file. ${Config.MESSAGES.NO_ACTION_TAKEN}`,
                    messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                };
            }
            if (destNode) {
                if (
                    sourceNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE &&
                    destNode.type !== Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
                ) {
                    return {
                        success: false,
                        error: `mv: cannot overwrite non-directory '${absDestPath}' with directory '${sourcePathArg}'`,
                    };
                }
                if (
                    sourceNode.type !== Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE &&
                    destNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
                ) {
                    return {
                        success: false,
                        error: `mv: cannot overwrite directory '${absDestPath}' with non-directory '${sourcePathArg}'`,
                    };
                }
                if (isInteractiveEffective) {
                    const confirmed = await new Promise((resolve) => {
                        ModalManager.request({
                            context: "terminal",
                            messageLines: [`Overwrite '${absDestPath}'?`],
                            onConfirm: () => resolve(true),
                            onCancel: () => resolve(false),
                            options,
                        });
                    });
                    if (!confirmed)
                        return {
                            success: true,
                            output: `${Config.MESSAGES.OPERATION_CANCELLED} No changes made.`,
                            messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                        };
                } else if (!flags.force) {
                    return {
                        success: false,
                        error: `mv: '${absDestPath}' already exists. Use -f to overwrite or -i to prompt.`,
                    };
                }
            }
            if (
                sourceNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE &&
                absDestPath.startsWith(absSourcePath + Config.FILESYSTEM.PATH_SEPARATOR)
            ) {
                return {
                    success: false,
                    error: `mv: cannot move '${sourcePathArg}' to a subdirectory of itself, '${absDestPath}'`,
                };
            }
            const movedNode = Utils.deepCopyNode(sourceNode);
            movedNode.mtime = nowISO;
            targetContainerNode.children[finalDestName] = movedNode;
            targetContainerNode.mtime = nowISO;
            if (
                sourceParentNode &&
                sourceParentNode.children &&
                sourceParentNode.children[sourceName]
            ) {
                delete sourceParentNode.children[sourceName];
                sourceParentNode.mtime = nowISO;
            } else {
                delete targetContainerNode.children[finalDestName];
                console.error(
                    Config.INTERNAL_ERRORS.SOURCE_NOT_FOUND_IN_PARENT_PREFIX +
                    sourceName +
                    Config.INTERNAL_ERRORS.SOURCE_NOT_FOUND_IN_PARENT_MIDDLE +
                    sourceParentPath +
                    Config.INTERNAL_ERRORS.SOURCE_NOT_FOUND_IN_PARENT_SUFFIX
                );
                return {
                    success: false,
                    error: `mv: Internal error - source item not found for removal after copy part of move.`,
                };
            }
            if (!(await FileSystemManager.save(currentUser))) {
                return {
                    success: false,
                    error: "mv: Failed to save file system changes.",
                };
            }
            return {
                success: true,
                output: `${Config.MESSAGES.MOVED_PREFIX}${sourcePathArg}${Config.MESSAGES.MOVED_TO}'${absDestPath}'${Config.MESSAGES.MOVED_SUFFIX}`,
                messageType: Config.CSS_CLASSES.SUCCESS_MSG,
            };
        },
    };

    const mvDescription = "Move or rename files and directories.";

    const mvHelpText = `Usage: mv [OPTION]... <source> <destination>

Rename SOURCE to DEST, or move SOURCE to DIRECTORY.

DESCRIPTION
       The mv command renames the file or directory at <source> to the
       name given by <destination>, or moves it into an existing
       <directory>.

       If <destination> is an existing directory, the source file or
       directory is moved inside of it.

       If <destination> is not an existing directory, the source file or
       directory is renamed to <destination>.

OPTIONS
       -f, --force
              Do not prompt before overwriting. This option overrides a
              previous -i option.

       -i, --interactive
              Prompt before overwriting an existing file.

EXAMPLES
       mv old_name.txt new_name.txt
              Renames 'old_name.txt' to 'new_name.txt'.

       mv report.txt /home/Guest/documents/
              Moves 'report.txt' into the 'documents' directory.

       mv old_dir new_dir
              Renames the directory 'old_dir' to 'new_dir'.`;

    CommandRegistry.register("mv", mvCommandDefinition, mvDescription, mvHelpText);
})();