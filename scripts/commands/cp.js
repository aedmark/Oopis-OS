/**
 * @file Defines the 'cp' command, which copies files and directories within the OopisOS file system.
 * It supports various flags for recursive copying, forcing overwrites, preserving metadata, and interactive prompts.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} cpCommandDefinition
     * @description The command definition for the 'cp' command.
     * This object specifies the command's name, supported flags, argument validation,
     * and the core logic for copying operations.
     */
    const cpCommandDefinition = {
        commandName: "cp",
        flagDefinitions: [
            { name: "recursive", short: "-r", long: "--recursive", aliases: ["-R"] },
            { name: "force", short: "-f", long: "--force" },
            { name: "preserve", short: "-p", long: "--preserve" },
            { name: "interactive", short: "-i", long: "--interactive" },
        ],
        argValidation: { min: 2 },
        /**
         * The core logic for the 'cp' command.
         * It handles copying one or more source files/directories to a destination.
         * It performs various checks including existence of source and destination,
         * type compatibility, and user permissions. It also manages interactive prompts
         * and recursive copying based on provided flags.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command (source paths and destination path).
         * @param {object} context.flags - An object containing the parsed flags.
         * @param {string} context.currentUser - The name of the current user.
         * @param {object} context.options - Execution options, including scriptingContext for modal interactions.
         * @returns {Promise<object>} A promise that resolves to a command result object.
         */
        coreLogic: async (context) => {
            const { args, flags, currentUser, options } = context;
            const nowISO = new Date().toISOString();
            // Determine effective interactive mode: -i takes precedence unless -f is also present.
            flags.isInteractiveEffective = flags.interactive && !flags.force;

            const rawDestPathArg = args.pop(); // The last argument is always the destination.
            const sourcePathArgs = args; // Remaining arguments are source paths.
            let operationMessages = [];
            let overallSuccess = true;
            let anyChangesMadeGlobal = false;

            // Retrieve the primary group for the current user, essential for creating new nodes.
            const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
            if (!primaryGroup) {
                return {
                    success: false,
                    error:
                        "cp: critical - could not determine primary group for current user.",
                };
            }

            /**
             * Internal recursive function to perform the actual copying of a single node.
             * It handles file content copying, directory creation, and recursive calls for subdirectories.
             * @param {object} sourceNode - The source file system node to copy.
             * @param {string} sourcePathForMsg - The path of the source node (for messages).
             * @param {string} targetContainerAbsPath - The absolute path of the directory where the new node will be placed.
             * @param {string} targetEntryName - The name of the new node at the destination.
             * @param {object} currentCommandFlags - The flags object relevant to the current copy operation.
             * @param {string} userPrimaryGroup - The primary group of the current user, for new node creation.
             * @returns {Promise<{success: boolean, messages: string[], changesMade: boolean}>} The result of the internal copy operation.
             * @private
             */
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

                // Validate the target container (must exist and be a directory).
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

                // Check write permission on the target container.
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

                // Handle existing destination node.
                if (existingNodeAtDest) {
                    // Prevent overwriting a file with a directory or vice-versa.
                    if (sourceNode.type !== existingNodeAtDest.type) {
                        return {
                            success: false,
                            messages: [
                                `cp: cannot overwrite ${existingNodeAtDest.type} '${fullFinalDestPath}' with ${sourceNode.type} '${sourcePathForMsg}'`,
                            ],
                            changesMade: false,
                        };
                    }
                    // Handle interactive overwrite prompt.
                    if (currentCommandFlags.isInteractiveEffective) {
                        const confirmed = await new Promise((r) =>
                            ModalManager.request({
                                context: "terminal",
                                messageLines: [`Overwrite '${fullFinalDestPath}'?`],
                                onConfirm: () => r(true),
                                onCancel: () => r(false),
                                options, // Pass context for scripting
                            })
                        );
                        if (!confirmed)
                            return {
                                success: true, // Operation not performed, but not an error for cp.
                                messages: [
                                    `cp: not overwriting '${fullFinalDestPath}' (skipped)`,
                                ],
                                changesMade: false,
                            };
                    } else if (!currentCommandFlags.force) {
                        // If not interactive and not forced, report error for existing file.
                        return {
                            success: false,
                            messages: [
                                `cp: '${fullFinalDestPath}' already exists. Use -f to overwrite or -i to prompt.`,
                            ],
                            changesMade: false,
                        };
                    }
                }

                // Perform the copy based on node type.
                if (sourceNode.type === Config.FILESYSTEM.DEFAULT_FILE_TYPE) {
                    targetContainerNode.children[targetEntryName] = {
                        type: Config.FILESYSTEM.DEFAULT_FILE_TYPE,
                        content: sourceNode.content,
                        owner: currentCommandFlags.preserve // Preserve owner/group/mode if -p flag is used, otherwise set to current user/defaults.
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
                    // If recursive flag is not present, omit directory copying.
                    if (!currentCommandFlags.recursive) {
                        return {
                            success: true, // Omission is not an error for cp.
                            messages: [
                                `cp: omitting directory '${sourcePathForMsg}' (use -r or -R)`,
                            ],
                            changesMade: false,
                        };
                    }

                    // If destination directory does not exist, create it.
                    if (!existingNodeAtDest) {
                        const owner = currentCommandFlags.preserve ? sourceNode.owner : currentUser;
                        const group = currentCommandFlags.preserve ? sourceNode.group : userPrimaryGroup;
                        const mode = currentCommandFlags.preserve ? sourceNode.mode : Config.FILESYSTEM.DEFAULT_DIR_MODE;

                        const newDirNode = FileSystemManager._createNewDirectoryNode(owner, group, mode);

                        if (currentCommandFlags.preserve) {
                            newDirNode.mtime = sourceNode.mtime; // Preserve mtime for newly created directories if -p.
                        }

                        targetContainerNode.children[targetEntryName] = newDirNode;
                        madeChangeInThisCall = true;
                    }
                    // Recursively copy children of the source directory.
                    for (const childName in sourceNode.children) {
                        const childCopyResult = await _executeCopyInternal(
                            sourceNode.children[childName],
                            FileSystemManager.getAbsolutePath(childName, sourcePathForMsg),
                            fullFinalDestPath, // The new parent path for the child.
                            childName,
                            currentCommandFlags,
                            userPrimaryGroup
                        );
                        currentOpMessages.push(...childCopyResult.messages);
                        if (!childCopyResult.success) currentOpSuccess = false;
                        if (childCopyResult.changesMade) madeChangeInThisCall = true;
                    }
                }

                // Update the modification time of the target container if changes were made within it.
                if (madeChangeInThisCall) {
                    targetContainerNode.mtime = nowISO;
                }

                return {
                    success: currentOpSuccess,
                    messages: currentOpMessages,
                    changesMade: madeChangeInThisCall,
                };
            }

            // Validate the destination path first.
            const destValidation = FileSystemManager.validatePath(
                "cp (dest)",
                rawDestPathArg,
                { allowMissing: true } // Destination can be missing if it's a new file.
            );
            if (
                destValidation.error &&
                !(destValidation.optionsUsed.allowMissing && !destValidation.node)
            ) {
                // If the error is not due to a missing but allowed path, return error.
                return { success: false, error: destValidation.error };
            }

            // Determine if the destination is an existing directory.
            const isDestADirectory =
                destValidation.node &&
                destValidation.node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE;

            // If multiple sources are provided, the destination MUST be a directory.
            if (sourcePathArgs.length > 1 && !isDestADirectory) {
                return {
                    success: false,
                    error: `cp: target '${rawDestPathArg}' is not a directory`,
                };
            }

            // Process each source path.
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
                // Check read permission on the source.
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

                // Determine the final destination path and name based on whether the destination is a directory.
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

                // Execute the internal copy logic.
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

            // Save the file system if any changes were made globally.
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