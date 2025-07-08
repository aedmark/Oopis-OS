(() => {
    "use strict";

    const uploadCommandDefinition = {
        commandName: "upload",
        flagDefinitions: [
            { name: "force", short: "-f", long: "--force" },
            { name: "recursive", short: "-r", long: "--recursive" },
        ],
        argValidation: {
            max: 1,
        },
        coreLogic: async (context) => {
            const { args, flags, currentUser, options } = context;

            if (!options.isInteractive)
                return { success: false, error: "upload: Can only be run in interactive mode." };

            let targetDirPath = FileSystemManager.getCurrentPath();
            const nowISO = new Date().toISOString();
            const operationMessages = [];
            let allFilesSuccess = true;
            let anyChangeMade = false;

            if (args.length === 1) {
                const destPathValidation = FileSystemManager.validatePath(
                    "upload (destination)",
                    args[0],
                    { expectedType: Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE }
                );
                if (destPathValidation.error)
                    return { success: false, error: destPathValidation.error };
                targetDirPath = destPathValidation.resolvedPath;
            }

            const initialTargetDirNode = FileSystemManager.getNodeByPath(targetDirPath);
            if (!initialTargetDirNode || !FileSystemManager.hasPermission(initialTargetDirNode, currentUser, "write"))
                return { success: false, error: `upload: cannot write to directory '${targetDirPath}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}` };

            const input = Utils.createElement("input", { type: "file" });
            if (flags.recursive) {
                input.webkitdirectory = true;
            } else {
                input.multiple = true;
            }
            input.style.display = "none";
            document.body.appendChild(input);

            try {
                const fileResult = await new Promise((resolve) => {
                    input.onchange = (e) => {
                        if (e.target.files?.length > 0) {
                            resolve({ success: true, files: e.target.files });
                        } else {
                            resolve({ success: false, error: Config.MESSAGES.UPLOAD_NO_FILE });
                        }
                    };
                    input.addEventListener('cancel', () => {
                        resolve({ success: false, error: Config.MESSAGES.UPLOAD_NO_FILE });
                    });
                    input.click();
                });

                if (!fileResult.success) {
                    return { success: false, error: `upload: ${fileResult.error}` };
                }

                const filesToUpload = fileResult.files;
                const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
                const ALLOWED_EXTENSIONS = new Set(['txt', 'md', 'html', 'sh', 'js', 'css', 'json', 'oopic', 'bas']);

                if (!primaryGroup) {
                    return { success: false, error: "upload: Could not determine primary group for user." };
                }

                for (const file of Array.from(filesToUpload)) {
                    try {
                        const fileExtension = Utils.getFileExtension(file.name);
                        if (!ALLOWED_EXTENSIONS.has(fileExtension) && file.name.includes('.')) {
                            operationMessages.push(`${Config.MESSAGES.UPLOAD_INVALID_TYPE_PREFIX}'${fileExtension}'${Config.MESSAGES.UPLOAD_INVALID_TYPE_SUFFIX}`);
                            continue;
                        }

                        const content = await file.text();
                        const relativePath = (flags.recursive && file.webkitRelativePath) ? file.webkitRelativePath : file.name;
                        const fullDestPath = FileSystemManager.getAbsolutePath(relativePath, targetDirPath);
                        const parentDestPath = fullDestPath.substring(0, fullDestPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR)) || Config.FILESYSTEM.ROOT_PATH;
                        const finalFileName = fullDestPath.substring(fullDestPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1);

                        const parentDirResult = FileSystemManager.createParentDirectoriesIfNeeded(fullDestPath);
                        if (parentDirResult.error) {
                            operationMessages.push(`Error: ${parentDirResult.error}`);
                            allFilesSuccess = false;
                            continue;
                        }
                        const finalTargetNode = parentDirResult.parentNode;

                        if (!FileSystemManager.hasPermission(finalTargetNode, currentUser, "write")) {
                            operationMessages.push(`upload: cannot write to directory '${parentDestPath}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`);
                            allFilesSuccess = false;
                            continue;
                        }

                        const existingFileNode = finalTargetNode.children[finalFileName];
                        if (existingFileNode) {
                            if (!FileSystemManager.hasPermission(existingFileNode, currentUser, "write")) {
                                operationMessages.push(`Error uploading '${relativePath}': cannot overwrite '${finalFileName}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`);
                                allFilesSuccess = false;
                                continue;
                            }
                            if (!flags.force) {
                                const confirmed = await new Promise((r) =>
                                    ModalManager.request({
                                        context: "terminal",
                                        messageLines: [`'${relativePath}' already exists. Overwrite?`],
                                        onConfirm: () => r(true),
                                        onCancel: () => r(false),
                                        options,
                                    })
                                );
                                if (!confirmed) {
                                    operationMessages.push(`Skipped '${relativePath}'.`);
                                    continue;
                                }
                            }
                        }

                        const explicitMode = finalFileName.endsWith(".sh") ? Config.FILESYSTEM.DEFAULT_SH_MODE : null;
                        finalTargetNode.children[finalFileName] = FileSystemManager._createNewFileNode(finalFileName, content, currentUser, primaryGroup, explicitMode);
                        finalTargetNode.mtime = nowISO;
                        operationMessages.push(`${Config.MESSAGES.UPLOAD_SUCCESS_PREFIX}'${relativePath}'${Config.MESSAGES.UPLOAD_SUCCESS_MIDDLE}'${targetDirPath}'${Config.MESSAGES.UPLOAD_SUCCESS_SUFFIX}`);
                        anyChangeMade = true;

                    } catch (fileError) {
                        operationMessages.push(`${Config.MESSAGES.UPLOAD_READ_ERROR_PREFIX}'${file.name}'${Config.MESSAGES.UPLOAD_READ_ERROR_SUFFIX}: ${fileError.message}`);
                        allFilesSuccess = false;
                    }
                }

                if (anyChangeMade && !(await FileSystemManager.save())) {
                    operationMessages.push("Critical: Failed to save file system changes after uploads.");
                    allFilesSuccess = false;
                }

                const outputMessage = operationMessages.join("\n");
                if (allFilesSuccess) {
                    return { success: true, output: outputMessage || "Upload complete.", messageType: Config.CSS_CLASSES.SUCCESS_MSG };
                } else {
                    return { success: false, error: outputMessage };
                }
            } catch (e) {
                return { success: false, error: `upload: ${e.message}` };
            } finally {
                if (input.parentNode) document.body.removeChild(input);
            }
        },
    };

    const uploadDescription = "Uploads files or folders from your local machine to OopisOS.";

    const uploadHelpText = `Usage: upload [-f] [-r] [destination_directory]

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
              existing files with the same name.
       -r, --recursive
              Allows uploading of an entire directory. The directory
              structure will be recreated in OopisOS.`;

    CommandRegistry.register("upload", uploadCommandDefinition, uploadDescription, uploadHelpText);
})();