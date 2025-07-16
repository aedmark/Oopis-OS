// scripts/commands/mv.js
(() => {
    "use strict";

    const mvCommandDefinition = {
        commandName: "mv",
        completionType: "paths", // Preserved for tab completion
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

            try {
                const destPathArg = args.pop();
                const sourcePathArgs = args;

                const destAbsPath = FileSystemManager.getAbsolutePath(destPathArg);
                let destNode = FileSystemManager.getNodeByPath(destAbsPath);

                const isDestADirectory = destNode && destNode.type === 'directory';

                if (sourcePathArgs.length > 1 && !isDestADirectory) {
                    return { success: false, error: `mv: target '${destPathArg}' is not a directory` };
                }

                for (const sourcePathArg of sourcePathArgs) {
                    const sourceAbsPath = FileSystemManager.getAbsolutePath(sourcePathArg);
                    const sourceNode = FileSystemManager.getNodeByPath(sourceAbsPath);

                    if (sourceAbsPath === '/') {
                        return { success: false, error: "mv: cannot move root directory" };
                    }

                    if (!sourceNode) {
                        return { success: false, error: `mv: cannot stat '${sourcePathArg}': No such file or directory` };
                    }

                    const sourceName = sourceAbsPath.substring(sourceAbsPath.lastIndexOf('/') + 1);
                    const sourceParentPath = sourceAbsPath.substring(0, sourceAbsPath.lastIndexOf('/')) || '/';
                    const sourceParentNode = FileSystemManager.getNodeByPath(sourceParentPath);

                    if (!sourceParentNode || !FileSystemManager.hasPermission(sourceParentNode, currentUser, "write")) {
                        return { success: false, error: `mv: cannot move '${sourcePathArg}': Permission denied in source directory` };
                    }

                    let finalDestPath;
                    let finalDestName;
                    let targetContainerNode;

                    if (isDestADirectory) {
                        finalDestName = sourceName;
                        targetContainerNode = destNode;
                        finalDestPath = FileSystemManager.getAbsolutePath(finalDestName, destAbsPath);
                    } else {
                        finalDestName = destAbsPath.substring(destAbsPath.lastIndexOf('/') + 1);
                        const destParentPath = destAbsPath.substring(0, destAbsPath.lastIndexOf('/')) || '/';
                        targetContainerNode = FileSystemManager.getNodeByPath(destParentPath);
                        finalDestPath = destAbsPath;
                    }

                    if (!targetContainerNode || targetContainerNode.type !== 'directory') {
                        return { success: false, error: `mv: destination '${destPathArg}' is not a valid directory.` };
                    }

                    if (!FileSystemManager.hasPermission(targetContainerNode, currentUser, "write")) {
                        return { success: false, error: `mv: cannot write to '${destPathArg}': Permission denied` };
                    }

                    if (sourceAbsPath === finalDestPath) {
                        continue;
                    }

                    if (sourceNode.type === 'directory' && finalDestPath.startsWith(sourceAbsPath + '/')) {
                        return { success: false, error: `mv: cannot move '${sourcePathArg}' to a subdirectory of itself, '${finalDestPath}'` };
                    }

                    const existingNodeAtDest = targetContainerNode.children[finalDestName];
                    if (existingNodeAtDest) {
                        const isPromptRequired = flags.interactive || (options.isInteractive && !flags.force);
                        if (isPromptRequired) {
                            const confirmed = await new Promise((resolve) => {
                                ModalManager.request({
                                    context: "terminal",
                                    messageLines: [`Overwrite '${finalDestPath}'?`],
                                    onConfirm: () => resolve(true),
                                    onCancel: () => resolve(false),
                                    options,
                                });
                            });
                            if(!confirmed) {
                                continue;
                            }
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

                return {
                    success: true,
                    output: ""
                };
            } catch (e) {
                return { success: false, error: `mv: An unexpected error occurred: ${e.message}` };
            }
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