/**
 * @file Defines the 'mv' command, which is used to move or rename files and directories
 * within the OopisOS file system. It handles various scenarios including overwriting,
 * interactive prompts, and recursive moves.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} mvCommandDefinition
     * @description The command definition for the 'mv' command.
     * This object specifies the command's name, supported flags, argument validation,
     * and the core logic for moving/renaming operations.
     */
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
            exact: 2, // Requires exactly two arguments: source and destination.
        },
        /**
         * The core logic for the 'mv' command.
         * It validates source and destination paths, handles permissions, and performs
         * the move/rename operation. This involves copying the source node to the new
         * location and then deleting it from the original location. It includes logic
         * for interactive prompts and forced overwrites based on flags.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command,
         * where `args[0]` is the source path and `args[1]` is the destination path.
         * @param {string} context.currentUser - The name of the current user.
         * @param {object} context.flags - An object containing the parsed flags.
         * @param {object} context.options - Execution options, including scriptingContext for modal interactions.
         * @returns {Promise<object>} A promise that resolves to a command result object.
         */
        coreLogic: async (context) => {
            const { args, currentUser, flags, options } = context;
            const sourcePathArg = args[0];
            const destPathArg = args[1];
            const nowISO = new Date().toISOString();

            // Validate the source path. It must exist and cannot be the root.
            const sourceValidation = FileSystemManager.validatePath(
                "mv (source)",
                sourcePathArg,
                {
                    disallowRoot: true, // Cannot move the root directory itself.
                }
            );
            if (sourceValidation.error)
                return {
                    success: false,
                    error: sourceValidation.error,
                };

            const sourceNode = sourceValidation.node; // The file system node for the source.
            const absSourcePath = sourceValidation.resolvedPath; // The absolute path of the source.
            // Determine the parent path of the source node.
            const sourceParentPath =
                absSourcePath.substring(
                    0,
                    absSourcePath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR)
                ) || Config.FILESYSTEM.ROOT_PATH;
            const sourceParentNode =
                FileSystemManager.getNodeByPath(sourceParentPath);

            // Check if the current user has write permission in the source's parent directory (to delete the source).
            if (
                !sourceParentNode ||
                !FileSystemManager.hasPermission(sourceParentNode, currentUser, "write")
            ) {
                return {
                    success: false,
                    error: `mv: cannot move '${sourcePathArg}' from '${sourceParentPath}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`,
                };
            }

            // Validate the destination path. It can be missing if it's a new name.
            const destValidation = FileSystemManager.validatePath(
                "mv (destination)",
                destPathArg,
                {
                    allowMissing: true, // Destination can be a new name.
                }
            );
            if (
                destValidation.error &&
                !(destValidation.optionsUsed.allowMissing && !destValidation.node)
            ) {
                // If the error is not due to a missing (but allowed) path, return an error.
                return {
                    success: false,
                    error: destValidation.error,
                };
            }

            let absDestPath = destValidation.resolvedPath; // The absolute path of the destination.
            let destNode = destValidation.node; // The file system node for the destination (if it exists).
            const sourceName = absSourcePath.substring(
                absSourcePath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1
            );
            let finalDestName = sourceName; // The final name of the item at the destination.
            let targetContainerNode; // The parent directory node where the item will be moved/renamed.
            let targetContainerAbsPath; // The absolute path of the target container.

            // Determine if the destination is an existing directory or a new file/directory name.
            if (
                destNode &&
                destNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
            ) {
                // If the destination exists and is a directory, move the source *into* it.
                targetContainerNode = destNode;
                targetContainerAbsPath = absDestPath;
                // The new absolute path will include the source name.
                absDestPath = FileSystemManager.getAbsolutePath(
                    sourceName,
                    absDestPath
                );
                // Check if an item with the source's name already exists within the destination directory.
                destNode = targetContainerNode.children[sourceName];
            } else {
                // If the destination is not an existing directory, it's a rename or move to a new file/directory.
                // The target container is the parent directory of the destination path.
                targetContainerAbsPath =
                    absDestPath.substring(
                        0,
                        absDestPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR)
                    ) || Config.FILESYSTEM.ROOT_PATH;
                targetContainerNode = FileSystemManager.getNodeByPath(
                    targetContainerAbsPath
                );
                // The final name will be the last segment of the destination path.
                finalDestName = absDestPath.substring(
                    absDestPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1
                );
            }

            // Check if the target container exists and is a directory.
            if (
                !targetContainerNode ||
                targetContainerNode.type !== Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
            ) {
                return {
                    success: false,
                    error: `mv: target '${targetContainerAbsPath}' is not a directory or does not exist.`,
                };
            }

            // Check if the current user has write permission in the target container (to create the new item).
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

            // If source and destination paths are the same, no action is needed.
            if (absSourcePath === absDestPath) {
                return {
                    success: true,
                    output: `mv: '${sourcePathArg}' and '${destPathArg}' are the same file. ${Config.MESSAGES.NO_ACTION_TAKEN}`,
                    messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                };
            }

            // Handle cases where a destination node already exists.
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

                // --- REFACTORED CONFIRMATION LOGIC ---
                const isPromptRequired = flags.interactive || (options.isInteractive && !flags.force);
                let confirmed = false;

                if (isPromptRequired) {
                    confirmed = await new Promise((resolve) => {
                        ModalManager.request({
                            context: "terminal",
                            messageLines: [`Overwrite '${absDestPath}'?`],
                            onConfirm: () => resolve(true),
                            onCancel: () => resolve(false),
                            options,
                        });
                    });
                } else {
                    // Auto-confirm if -f is used or if in a non-interactive script.
                    confirmed = true;
                }

                if (!confirmed) {
                    return {
                        success: true,
                        output: `${Config.MESSAGES.OPERATION_CANCELLED} No changes made.`,
                        messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                    };
                }
            }

            // Prevent moving a directory into one of its subdirectories.
            if (
                sourceNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE &&
                absDestPath.startsWith(absSourcePath + Config.FILESYSTEM.PATH_SEPARATOR)
            ) {
                return {
                    success: false,
                    error: `mv: cannot move '${sourcePathArg}' to a subdirectory of itself, '${absDestPath}'`,
                };
            }

            // Perform the move: deep copy the source node, assign to new location, delete from old.
            const movedNode = Utils.deepCopyNode(sourceNode);
            movedNode.mtime = nowISO; // Update modification time of the moved node.
            targetContainerNode.children[finalDestName] = movedNode; // Place the copied node in the new location.
            targetContainerNode.mtime = nowISO; // Update parent's modification time.

            // Delete the original source node from its parent.
            if (
                sourceParentNode &&
                sourceParentNode.children &&
                sourceParentNode.children[sourceName]
            ) {
                delete sourceParentNode.children[sourceName];
                sourceParentNode.mtime = nowISO; // Update original parent's modification time.
            } else {
                // This is a critical internal error if the source was not found in its parent after successful copy.
                delete targetContainerNode.children[finalDestName]; // Rollback the creation.
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

            // Save the file system changes.
            if (!(await FileSystemManager.save(currentUser))) {
                return {
                    success: false,
                    error: "mv: Failed to save file system changes.",
                };
            }

            return {
                success: true,
                output: `${Config.MESSAGES.MOVED_PREFIX}${sourcePathArg}${Config.MESSAGES.MOVED_TO}${absDestPath}'${Config.MESSAGES.MOVED_SUFFIX}`,
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