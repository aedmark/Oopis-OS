/**
 * @file Defines the 'mv' command, which is used to move or rename files and directories
 * within the OopisOS file system. It handles various scenarios including overwriting,
 * interactive prompts, and multi-file moves.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    const mvCommandDefinition = {
        commandName: "mv",
        flagDefinitions: [
            { name: "force", short: "-f", long: "--force" },
            { name: "interactive", short: "-i", long: "--interactive" },
        ],
        argValidation: {
            min: 2,
            error: "Usage: mv [OPTION]... <source> <destination> or mv [OPTION]... <source>... <directory>",
        },
        coreLogic: async (context) => {
            const { args, currentUser, flags, options } = context;
            const nowISO = new Date().toISOString();
            let changesMade = false;

            const destPathArg = args.pop();
            const sourcePathArgs = args;

            const destValidation = FileSystemManager.validatePath("mv (dest)", destPathArg, { allowMissing: true });

            if (destValidation.error && !(destValidation.optionsUsed.allowMissing && !destValidation.node)) {
                return { success: false, error: destValidation.error };
            }

            const destNode = destValidation.node;

            // --- REFINED OVERWRITE PROTECTION LOGIC v2 ---
            // This logic correctly distinguishes between `mv file dir` and `mv file dir/`
            if (destNode && destNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
                if (sourcePathArgs.length === 1) {
                    const sourceValidation = FileSystemManager.validatePath("mv (source)", sourcePathArgs[0]);
                    if (sourceValidation.node && sourceValidation.node.type === Config.FILESYSTEM.DEFAULT_FILE_TYPE && !destPathArg.endsWith(Config.FILESYSTEM.PATH_SEPARATOR)) {
                        // This case is now specifically for `mv file dir` (no trailing slash), which we disallow.
                        return {
                            success: false,
                            error: `mv: cannot overwrite directory '${destPathArg}' with non-directory; to move into directory, use '${destPathArg}/'`
                        };
                    }
                }
            }
            // --- END REFINED LOGIC ---

            const isDestADirectory = destNode && destNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE;

            if (sourcePathArgs.length > 1 && !isDestADirectory) {
                return { success: false, error: `mv: target '${destPathArg}' is not a directory` };
            }

            for (const sourcePathArg of sourcePathArgs) {
                const sourceValidation = FileSystemManager.validatePath("mv (source)", sourcePathArg, { disallowRoot: true });

                if (sourceValidation.error) {
                    return { success: false, error: sourceValidation.error };
                }

                const sourceNode = sourceValidation.node;
                const absSourcePath = sourceValidation.resolvedPath;
                const sourceName = absSourcePath.substring(absSourcePath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1);

                const sourceParentPath = absSourcePath.substring(0, absSourcePath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR)) || Config.FILESYSTEM.ROOT_PATH;
                const sourceParentNode = FileSystemManager.getNodeByPath(sourceParentPath);

                if (!sourceParentNode || !FileSystemManager.hasPermission(sourceParentNode, currentUser, "write")) {
                    return { success: false, error: `mv: cannot move '${sourcePathArg}': Permission denied in source directory` };
                }

                let finalDestPath;
                let finalDestName;
                let targetContainerNode;

                if (isDestADirectory) {
                    finalDestName = sourceName;
                    targetContainerNode = destValidation.node;
                    finalDestPath = FileSystemManager.getAbsolutePath(finalDestName, destValidation.resolvedPath);
                } else {
                    finalDestName = destValidation.resolvedPath.substring(destValidation.resolvedPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1);
                    const destParentPath = destValidation.resolvedPath.substring(0, destValidation.resolvedPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR)) || Config.FILESYSTEM.ROOT_PATH;
                    targetContainerNode = FileSystemManager.getNodeByPath(destParentPath);
                    finalDestPath = destValidation.resolvedPath;
                }

                if (!targetContainerNode || targetContainerNode.type !== Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
                    return { success: false, error: `mv: destination '${destPathArg}' is not a valid directory.` };
                }

                if (!FileSystemManager.hasPermission(targetContainerNode, currentUser, "write")) {
                    return { success: false, error: `mv: cannot write to '${destPathArg}': Permission denied` };
                }

                if (absSourcePath === finalDestPath) {
                    continue;
                }

                if (sourceNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE && finalDestPath.startsWith(absSourcePath + Config.FILESYSTEM.PATH_SEPARATOR)) {
                    return { success: false, error: `mv: cannot move '${sourcePathArg}' to a subdirectory of itself, '${finalDestPath}'` };
                }

                const existingNodeAtDest = targetContainerNode.children[finalDestName];
                if (existingNodeAtDest) {
                    const isPromptRequired = flags.interactive || (options.isInteractive && !flags.force);
                    let confirmed = !isPromptRequired;

                    if (isPromptRequired) {
                        confirmed = await new Promise((resolve) => {
                            ModalManager.request({
                                context: "terminal",
                                messageLines: [`Overwrite '${finalDestPath}'?`],
                                onConfirm: () => resolve(true),
                                onCancel: () => resolve(false),
                                options,
                            });
                        });
                    }
                    if (!confirmed) {
                        console.log(`Skipping move of '${sourcePathArg}' due to user cancellation.`);
                        continue;
                    }
                }

                const movedNode = Utils.deepCopyNode(sourceNode);
                movedNode.mtime = nowISO;
                targetContainerNode.children[finalDestName] = movedNode;
                targetContainerNode.mtime = nowISO;
                delete sourceParentNode.children[sourceName];
                sourceParentNode.mtime = nowISO;
                changesMade = true;
            }

            if (changesMade && !(await FileSystemManager.save())) {
                return { success: false, error: "mv: Failed to save file system changes." };
            }

            return { success: true, output: "" };
        }
    };

    const mvDescription = "Move or rename files and directories.";
    const mvHelpText = `Usage: mv [OPTION]... <source> <destination>
       mv [OPTION]... <source>... <directory>

Rename SOURCE to DEST, or move SOURCE(s) to DIRECTORY.

DESCRIPTION
       The mv command renames the file or directory at <source> to the
       name given by <destination>, or moves it into an existing
       <directory>.

       If the last argument is an existing directory, all preceding
       source files and directories are moved inside of it.

OPTIONS
       -f, --force
              Do not prompt before overwriting. This option overrides a
              previous -i option.

       -i, --interactive
              Prompt before overwriting an existing file.

EXAMPLES
       mv old_name.txt new_name.txt
              Renames 'old_name.txt' to 'new_name.txt'.

       mv report.txt notes.txt /home/Guest/documents/
              Moves both 'report.txt' and 'notes.txt' into the 
              'documents' directory.`;

    CommandRegistry.register("mv", mvCommandDefinition, mvDescription, mvHelpText);
})();