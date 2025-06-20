(() => {
    "use strict";
    /**
     * @file Defines the 'printscreen' command, which captures the visible content of the terminal output
     * and saves it to a specified file within the OopisOS virtual file system.
     * @author Andrew Edmark
     * @author Gemini
     */

    /**
     * @const {object} printscreenCommandDefinition
     * @description The command definition for the 'printscreen' command.
     * This object specifies the command's name, argument validation (expecting one file path),
     * path validation (allowing missing files and disallowing root as a direct target),
     * and the core logic for capturing and saving terminal output.
     */
    const printscreenCommandDefinition = {
        commandName: "printscreen",
        argValidation: {
            exact: 1, // Expects exactly one argument: the file path.
            error: "Usage: printscreen <filepath>",
        },
        pathValidation: [
            {
                argIndex: 0,
                options: {
                    allowMissing: true, // File can be new, it will be created.
                    disallowRoot: true, // Cannot save directly to the root directory.
                },
            },
        ],
        /**
         * The core logic for the 'printscreen' command.
         * It captures the innerText of the terminal's output area.
         * It then validates the target file path, handling cases where the file exists
         * (checking for directories and write permissions) or needs to be created
         * (creating parent directories and checking write permissions in the parent).
         * Finally, it saves the captured content to the specified file and persists the file system changes.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command, expecting a single file path.
         * @param {string} context.currentUser - The name of the current user.
         * @param {object[]} context.validatedPaths - An array of validated path information objects.
         * @returns {Promise<object>} A promise that resolves to a command result object,
         * indicating whether the output was successfully saved or if an error occurred.
         */
        coreLogic: async (context) => {
            const { args, currentUser, validatedPaths } = context;
            const filePathArg = args[0]; // The provided file path argument.
            const pathInfo = validatedPaths[0]; // The validation result for the file path.
            const resolvedPath = pathInfo.resolvedPath; // The absolute resolved path for the target file.
            const nowISO = new Date().toISOString(); // Current timestamp for file modification.

            // Additional check: Ensure the resolved path is not the root directory itself.
            // (DisallowRoot in pathValidation already covers this for single segments,
            // but this catches if a relative path resolves *to* root).
            if (resolvedPath === Config.FILESYSTEM.ROOT_PATH) {
                return {
                    success: false,
                    error: `printscreen: Cannot save directly to root ('${Config.FILESYSTEM.ROOT_PATH}'). Please specify a filename.`,
                };
            }

            // Additional check: Ensure the target path is not a directory path (does not end with '/').
            if (resolvedPath.endsWith(Config.FILESYSTEM.PATH_SEPARATOR)) {
                return {
                    success: false,
                    error: `printscreen: Target path '${filePathArg}' must be a file, not a directory path (ending with '${Config.FILESYSTEM.PATH_SEPARATOR}').`,
                };
            }

            // Capture the visible text content from the terminal's output area.
            const outputContent = DOM.outputDiv ? DOM.outputDiv.innerText : "";

            const existingNode = pathInfo.node; // The existing file system node at the resolved path, if any.

            if (existingNode) {
                // If a node already exists at the target path:
                if (existingNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
                    // Cannot overwrite a directory with the printscreen content.
                    return {
                        success: false,
                        error: `printscreen: Cannot overwrite directory '${filePathArg}'.`,
                    };
                }
                // Check if the current user has write permission on the existing file.
                if (
                    !FileSystemManager.hasPermission(existingNode, currentUser, "write")
                ) {
                    return {
                        success: false,
                        error: `printscreen: '${filePathArg}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`,
                    };
                }
                // Update the content of the existing file.
                existingNode.content = outputContent;
            } else {
                // If no node exists at the target path, create a new file.
                // First, ensure all parent directories exist.
                const parentDirResult =
                    FileSystemManager.createParentDirectoriesIfNeeded(resolvedPath);
                if (parentDirResult.error) {
                    return {
                        success: false,
                        error: `printscreen: ${parentDirResult.error}`,
                    };
                }
                const parentNodeForCreation = parentDirResult.parentNode; // The parent directory node.
                // Extract the new file name.
                const fileName = resolvedPath.substring(
                    resolvedPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1
                );

                // Critical check: parentNodeForCreation should not be null if createParentDirectoriesIfNeeded succeeded.
                if (!parentNodeForCreation) {
                    console.error(
                        "printscreen: parentNodeForCreation is null despite createParentDirectoriesIfNeeded success."
                    );
                    return {
                        success: false,
                        error: `printscreen: Critical internal error obtaining parent directory for '${filePathArg}'.`,
                    };
                }

                // Check write permission in the parent directory to create the new file.
                if (
                    !FileSystemManager.hasPermission(
                        parentNodeForCreation,
                        currentUser,
                        "write"
                    )
                ) {
                    return {
                        success: false,
                        error: `printscreen: Cannot create file in '${FileSystemManager.getAbsolutePath(
                            fileName, // The error message should accurately reflect the intended path for creation
                            parentNodeForCreation.path // Use parent's resolved path if needed for clarity
                        )}', permission denied in parent.`,
                    };
                }

                // Get the primary group for the current user, needed for new file ownership.
                const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
                if (!primaryGroup) {
                    return {
                        success: false,
                        error:
                            "printscreen: critical - could not determine primary group for user.",
                    };
                }

                // Create the new file node and add it to the parent's children.
                parentNodeForCreation.children[fileName] = {
                    type: Config.FILESYSTEM.DEFAULT_FILE_TYPE,
                    content: outputContent,
                    owner: currentUser,
                    group: primaryGroup,
                    mode: Config.FILESYSTEM.DEFAULT_FILE_MODE,
                    mtime: nowISO,
                };
            }

            // Update the modification time of the target node (if existing) or the newly created file, and its parent.
            FileSystemManager._updateNodeAndParentMtime(resolvedPath, nowISO);

            // Persist the file system changes.
            // Note: The `currentUser` argument to `FileSystemManager.save` is not used by the function,
            // but is kept here for consistency with the provided code.
            if (!(await FileSystemManager.save(currentUser))) {
                return {
                    success: false,
                    error: "printscreen: Failed to save file system changes.",
                };
            }

            return {
                success: true,
                output: `Terminal output saved to '${resolvedPath}'`,
                messageType: Config.CSS_CLASSES.SUCCESS_MSG,
            };
        },
    };

    const printscreenDescription = "Saves the visible terminal output to a file.";

    const printscreenHelpText = `Usage: printscreen <filepath>

Save the visible terminal output to a file.

DESCRIPTION
       The printscreen command captures all text currently visible in the
       terminal's output area and saves it as plain text to the specified
       <filepath>.

       This is useful for creating logs or saving the results of a series
       of commands for later review. If the file already exists, it will be
       overwritten.

EXAMPLES
       ls -la /
       printscreen /home/Guest/root_listing.txt
              Saves the output of the 'ls -la /' command into a new file.`;

    CommandRegistry.register("printscreen", printscreenCommandDefinition, printscreenDescription, printscreenHelpText);
})();