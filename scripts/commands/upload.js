// gem/scripts/commands/upload.js

window.UploadCommand = class UploadCommand extends Command {
    constructor() {
        super({
            commandName: "upload",
            description: "Uploads one or more files from your local machine to the current OopisOS directory.",
            helpText: `Usage: upload
      Initiate a file upload from your local machine.
      DESCRIPTION
      The upload command opens your computer's native file selection
      dialog, allowing you to choose one or more files to upload into
      the OopisOS virtual file system.
      Selected files will be placed in the current working directory.
      If a file with the same name already exists, you will be prompted
      to confirm the overwrite for that specific file.
      NOTE: This command is only available in interactive sessions.`,
            validations: {
                args: {
                    exact: 0
                }
            },
        });
    }

    async coreLogic(context) {
        const { options, currentUser, dependencies } = context;
        const {
            FileSystemManager,
            UserManager,
            OutputManager,
            Config,
            ErrorHandler,
            Utils,
            ModalManager,
        } = dependencies;

        if (!options.isInteractive) {
            return ErrorHandler.createError(
                "upload: Can only be run in interactive mode."
            );
        }

        const input = Utils.createElement("input", { type: "file", multiple: true });
        input.style.display = 'none';
        document.body.appendChild(input);

        return new Promise((resolve) => {
            let fileSelected = false;

            const cleanup = () => {
                window.removeEventListener('focus', handleFocus);
                if (document.body.contains(input)) {
                    document.body.removeChild(input);
                }
            };

            const handleFocus = () => {
                setTimeout(() => {
                    if (!fileSelected) {
                        cleanup();
                        resolve(ErrorHandler.createSuccess(Config.MESSAGES.UPLOAD_NO_FILE));
                    }
                }, 500);
            };

            window.addEventListener('focus', handleFocus, { once: true });

            input.onchange = async (e) => {
                fileSelected = true;
                const files = e.target.files;

                if (!files || files.length === 0) {
                    cleanup();
                    resolve(ErrorHandler.createSuccess(Config.MESSAGES.UPLOAD_CANCELLED));
                    return;
                }

                let anyFileUploaded = false;
                let errorOccurred = false;

                for (const file of files) {
                    const currentPath = FileSystemManager.getCurrentPath();
                    const newFilePath = `${currentPath === "/" ? "" : currentPath}/${file.name}`;
                    const existingNode = FileSystemManager.getNodeByPath(newFilePath);

                    if (existingNode) {
                        const confirmed = await new Promise((confirmResolve) => {
                            ModalManager.request({
                                context: "terminal",
                                type: "confirm",
                                messageLines: [`'${file.name}' already exists. Overwrite it?`],
                                onConfirm: () => confirmResolve(true),
                                onCancel: () => confirmResolve(false),
                                options,
                            });
                        });

                        if (!confirmed) {
                            await OutputManager.appendToOutput(`Skipping '${file.name}'.`);
                            continue;
                        }
                    }

                    const uploadPromise = new Promise((fileResolve) => {
                        const reader = new FileReader();
                        reader.onload = async (event) => {
                            const content = event.target.result;
                            const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);

                            const saveResult = await FileSystemManager.createOrUpdateFile(
                                newFilePath,
                                content,
                                { currentUser, primaryGroup }
                            );

                            if (saveResult.success) {
                                await OutputManager.appendToOutput(
                                    `${Config.MESSAGES.UPLOAD_SUCCESS_PREFIX}${file.name}${Config.MESSAGES.UPLOAD_SUCCESS_MIDDLE}${newFilePath}${Config.MESSAGES.UPLOAD_SUCCESS_SUFFIX}`
                                );
                                anyFileUploaded = true;
                                fileResolve(true);
                            } else {
                                await OutputManager.appendToOutput(`Error uploading '${file.name}': ${saveResult.error}`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                                errorOccurred = true;
                                fileResolve(false);
                            }
                        };
                        reader.onerror = () => {
                            OutputManager.appendToOutput(`Error reading file '${file.name}'.`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                            errorOccurred = true;
                            fileResolve(false);
                        };

                        const binaryExtensions = ['mxl'];
                        const extension = file.name.split('.').pop().toLowerCase();
                        if (binaryExtensions.includes(extension)) {
                            reader.readAsArrayBuffer(file);
                        } else {
                            reader.readAsText(file);
                        }

                    });

                    await uploadPromise;
                }

                cleanup();
                if (errorOccurred) {
                    resolve(ErrorHandler.createError("One or more files failed to upload."));
                } else {
                    resolve(ErrorHandler.createSuccess("", { stateModified: anyFileUploaded }));
                }
            };
            input.click();
        });
    }
}

window.CommandRegistry.register(new UploadCommand());
