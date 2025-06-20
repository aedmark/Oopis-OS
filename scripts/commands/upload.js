// scripts/commands/upload.js

(() => {
    "use strict";
    const uploadCommandDefinition = {
        commandName: "upload",
        flagDefinitions: [
            {
                name: "force",
                short: "-f",
                long: "--force",
            },
        ],
        argValidation: {
            max: 1,
        },
        coreLogic: async (context) => {
            const { args, flags, currentUser, options } = context;
            if (!options.isInteractive)
                return {
                    success: false,
                    error: "upload: Can only be run in interactive mode.",
                };
            let targetDirPath = FileSystemManager.getCurrentPath();
            const nowISO = new Date().toISOString();
            const operationMessages = [];
            let allFilesSuccess = true;
            let anyFileProcessed = false;
            if (args.length === 1) {
                const destPathValidation = FileSystemManager.validatePath(
                    "upload (destination)",
                    args[0],
                    {
                        expectedType: Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
                    }
                );
                if (destPathValidation.error)
                    return {
                        success: false,
                        error: destPathValidation.error,
                    };
                targetDirPath = destPathValidation.resolvedPath;
            }
            const targetDirNode = FileSystemManager.getNodeByPath(targetDirPath);
            if (
                !targetDirNode ||
                !FileSystemManager.hasPermission(targetDirNode, currentUser, "write")
            )
                return {
                    success: false,
                    error: `upload: cannot write to directory '${targetDirPath}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`,
                };
            const input = Utils.createElement("input", {
                type: "file",
                multiple: true,
            });
            input.style.display = "none";
            document.body.appendChild(input);
            try {
                const fileResult = await new Promise((resolve) => {
                    let dialogClosed = false;
                    const onFocus = () => {
                        setTimeout(() => {
                            window.removeEventListener("focus", onFocus);
                            if (!dialogClosed) {
                                dialogClosed = true;
                                resolve({
                                    success: false,
                                    error: Config.MESSAGES.UPLOAD_NO_FILE,
                                });
                            }
                        }, 300);
                    };
                    input.onchange = (e) => {
                        dialogClosed = true;
                        window.removeEventListener("focus", onFocus);
                        if (e.target.files?.length > 0) {
                            resolve({
                                success: true,
                                files: e.target.files,
                            });
                        } else {
                            resolve({
                                success: false,
                                error: Config.MESSAGES.UPLOAD_NO_FILE,
                            });
                        }
                    };
                    window.addEventListener("focus", onFocus);
                    input.click();
                });
                if (!fileResult.success) {
                    return {
                        success: false,
                        error: `upload: ${fileResult.error}`,
                    };
                }
                const filesToUpload = fileResult.files;
                anyFileProcessed = true;
                for (const file of Array.from(filesToUpload)) {
                    try {
                        const explicitMode = file.name.endsWith(".sh")
                            ? Config.FILESYSTEM.DEFAULT_SH_MODE
                            : null;
                        const content = await file.text();
                        const existingFileNode = targetDirNode.children[file.name];
                        if (existingFileNode) {
                            if (
                                !FileSystemManager.hasPermission(
                                    existingFileNode,
                                    currentUser,
                                    "write"
                                )
                            ) {
                                operationMessages.push(
                                    `Error uploading '${file.name}': cannot overwrite '${file.name}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`
                                );
                                allFilesSuccess = false;
                                continue;
                            }
                            if (!flags.force) {
                                const confirmed = await new Promise((r) =>
                                    ModalManager.request({
                                        context: "terminal",
                                        messageLines: [`'${file.name}' already exists. Overwrite?`],
                                        onConfirm: () => r(true),
                                        onCancel: () => r(false),
                                        options,
                                    })
                                );
                                if (!confirmed) {
                                    operationMessages.push(`Skipped '${file.name}'.`);
                                    continue;
                                }
                            }
                        }
                        const primaryGroup =
                            UserManager.getPrimaryGroupForUser(currentUser);
                        if (!primaryGroup) {
                            operationMessages.push(
                                `Error uploading '${file.name}': Could not determine primary group.`
                            );
                            allFilesSuccess = false;
                            continue;
                        }
                        targetDirNode.children[file.name] =
                            FileSystemManager._createNewFileNode(
                                file.name,
                                content,
                                currentUser,
                                primaryGroup,
                                explicitMode
                            );
                        targetDirNode.mtime = nowISO;
                        operationMessages.push(
                            `'${file.name}' uploaded to '${targetDirPath}'.`
                        );
                    } catch (fileError) {
                        operationMessages.push(
                            `Error uploading '${file.name}': ${fileError.message}`
                        );
                        allFilesSuccess = false;
                    }
                }
                if (anyFileProcessed && !(await FileSystemManager.save())) {
                    operationMessages.push(
                        "Critical: Failed to save file system changes after uploads."
                    );
                    allFilesSuccess = false;
                }

                if (allFilesSuccess) {
                    return {
                        success: true,
                        output: operationMessages.join("\n") || "Upload complete.",
                        messageType: Config.CSS_CLASSES.SUCCESS_MSG,
                    };
                } else {
                    return {
                        success: false,
                        error: operationMessages.join("\n"),
                    };
                }
            } catch (e) {
                return {
                    success: false,
                    error: `upload: ${e.message}`,
                };
            } finally {
                if (input.parentNode) document.body.removeChild(input);
            }
        },
    };

    const uploadDescription = "Uploads files from your local machine to OopisOS.";

    const uploadHelpText = `Usage: upload [-f] [destination_directory]

Upload one or more files from your local machine to OopisOS.

DESCRIPTION
       The upload command opens your browser's file selection dialog,
       allowing you to choose one or more files from your actual computer
       to upload into the OopisOS virtual file system.

       If a <destination_directory> is specified, the files will be
       uploaded there. Otherwise, they will be uploaded to the current
       working directory.

       If a file with the same name already exists in the destination,
       you will be prompted to confirm before overwriting it.

OPTIONS
       -f, --force
              Do not prompt for confirmation; automatically overwrite any
              existing files with the same name.`;

    CommandRegistry.register("upload", uploadCommandDefinition, uploadDescription, uploadHelpText);
})();