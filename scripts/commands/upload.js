/**
 * @file Defines the 'upload' command, which enables uploading files from the user's local machine
 * to the OopisOS virtual file system via a browser's file selection dialog.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} uploadCommandDefinition
     * @description The command definition for the 'upload' command.
     * This object specifies the command's name, supported flags (e.g., -f for force),
     * argument validation (optional destination directory), and the core logic for file uploads.
     */
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
            max: 1, // Allows 0 arguments (upload to current dir) or 1 argument (destination dir).
        },
        /**
         * The core logic for the 'upload' command.
         * It requires an interactive session to prompt the user for file selection.
         * It determines the target directory (current or specified).
         * It then opens a native file selection dialog, reads selected files,
         * handles overwriting existing files (with or without confirmation based on -f flag),
         * and saves the content to the virtual file system.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command (optional destination directory path).
         * @param {object} context.flags - An object containing the parsed flags (e.g., `force`).
         * @param {string} context.currentUser - The name of the current user.
         * @param {object} context.options - Execution options, including `isInteractive` for UI prompts and `scriptingContext`.
         * @returns {Promise<object>} A promise that resolves to a command result object,
         * indicating the success or failure of the upload operation(s).
         */
        coreLogic: async (context) => {
            const { args, flags, currentUser, options } = context;

            // Ensure the command is run in an interactive terminal session as it requires UI interaction.
            if (!options.isInteractive)
                return {
                    success: false,
                    error: "upload: Can only be run in interactive mode.",
                };

            let targetDirPath = FileSystemManager.getCurrentPath(); // Default to current directory.
            const nowISO = new Date().toISOString();
            const operationMessages = [];
            let allFilesSuccess = true;
            let anyFileProcessed = false;

            // If a destination directory argument is provided, validate it.
            if (args.length === 1) {
                const destPathValidation = FileSystemManager.validatePath(
                    "upload (destination)",
                    args[0],
                    {
                        expectedType: Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE, // Must be an existing directory.
                    }
                );
                if (destPathValidation.error)
                    return {
                        success: false,
                        error: destPathValidation.error,
                    };
                targetDirPath = destPathValidation.resolvedPath;
            }

            // Get the target directory node and check write permissions.
            const targetDirNode = FileSystemManager.getNodeByPath(targetDirPath);
            if (
                !targetDirNode ||
                !FileSystemManager.hasPermission(targetDirNode, currentUser, "write")
            )
                return {
                    success: false,
                    error: `upload: cannot write to directory '${targetDirPath}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`,
                };

            // Create a hidden file input element to trigger the browser's file selection dialog.
            const input = Utils.createElement("input", {
                type: "file",
                multiple: true, // Allow multiple file selection.
            });
            input.style.display = "none";
            document.body.appendChild(input); // Temporarily append to the DOM.

            try {
                // Wait for the user to select file(s) or cancel the dialog.
                const fileResult = await new Promise((resolve) => {
                    let dialogClosed = false;
                    // Timeout to detect if the user closes the file dialog without selecting a file.
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

                    // Handle file selection change event.
                    input.onchange = (e) => {
                        dialogClosed = true;
                        window.removeEventListener("focus", onFocus); // Remove focus listener once dialog is handled.
                        if (e.target.files?.length > 0) {
                            resolve({
                                success: true,
                                files: e.target.files, // Get the selected files.
                            });
                        } else {
                            resolve({
                                success: false,
                                error: Config.MESSAGES.UPLOAD_NO_FILE,
                            });
                        }
                    };

                    // Add a focus listener to detect dialog cancellation.
                    window.addEventListener("focus", onFocus);
                    input.click(); // Programmatically click the hidden input to open the dialog.
                });

                // If no files were selected or dialog was cancelled, return an error.
                if (!fileResult.success) {
                    return {
                        success: false,
                        error: `upload: ${fileResult.error}`,
                    };
                }

                const filesToUpload = fileResult.files;
                anyFileProcessed = true; // Flag that at least one file dialog interaction happened.

                // Process each selected file.
                for (const file of Array.from(filesToUpload)) {
                    try {
                        // Determine default permissions for .sh files.
                        const explicitMode = file.name.endsWith(".sh")
                            ? Config.FILESYSTEM.DEFAULT_SH_MODE
                            : null;

                        // Read the content of the local file as text.
                        const content = await file.text();

                        const existingFileNode = targetDirNode.children[file.name];

                        if (existingFileNode) {
                            // If a file with the same name exists, check permissions and prompt for overwrite.
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
                                // If -f is not present, prompt for confirmation.
                                const confirmed = await new Promise((r) =>
                                    ModalManager.request({
                                        context: "terminal",
                                        messageLines: [`'${file.name}' already exists. Overwrite?`],
                                        onConfirm: () => r(true),
                                        onCancel: () => r(false),
                                        options, // Pass context for scripting.
                                    })
                                );
                                if (!confirmed) {
                                    operationMessages.push(`Skipped '${file.name}'.`);
                                    continue;
                                }
                            }
                        }

                        // Get the primary group for the current user, needed for new file ownership.
                        const primaryGroup =
                            UserManager.getPrimaryGroupForUser(currentUser);
                        if (!primaryGroup) {
                            operationMessages.push(
                                `Error uploading '${file.name}': Could not determine primary group.`
                            );
                            allFilesSuccess = false;
                            continue;
                        }

                        // Create the new file node (or overwrite existing content).
                        targetDirNode.children[file.name] =
                            FileSystemManager._createNewFileNode(
                                file.name,
                                content,
                                currentUser,
                                primaryGroup,
                                explicitMode
                            );
                        targetDirNode.mtime = nowISO; // Update target directory's modification time.
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

                // Save file system changes if any files were successfully processed.
                if (anyFileProcessed && !(await FileSystemManager.save())) {
                    operationMessages.push(
                        "Critical: Failed to save file system changes after uploads."
                    );
                    allFilesSuccess = false;
                }

                // Return final result based on overall success.
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
                // Catch any unexpected errors during the overall upload process.
                return {
                    success: false,
                    error: `upload: ${e.message}`,
                };
            } finally {
                // Ensure the hidden input element is removed from the DOM.
                if (input.parentNode) document.body.removeChild(input);
            }
        },
    };

    /**
     * @const {string} uploadDescription
     * @description A brief, one-line description of the 'upload' command for the 'help' command.
     */
    const uploadDescription = "Uploads files from your local machine to OopisOS.";

    /**
     * @const {string} uploadHelpText
     * @description The detailed help text for the 'upload' command, used by 'man'.
     */
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

    // Register the command with the system
    CommandRegistry.register("upload", uploadCommandDefinition, uploadDescription, uploadHelpText);
})();