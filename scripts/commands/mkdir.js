/**
 * @file Defines the 'mkdir' command, which is used to create new directories in the OopisOS file system.
 * It supports creating parent directories as needed and includes checks for existing files/directories and permissions.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} mkdirCommandDefinition
     * @description The command definition for the 'mkdir' command.
     * This object specifies the command's name, supported flags (e.g., -p for parents),
     * argument validation (at least one directory name), and the core logic for directory creation.
     */
    const mkdirCommandDefinition = {
        commandName: "mkdir",
        flagDefinitions: [
            {
                name: "parents",
                short: "-p",
                long: "--parents",
            },
        ],
        argValidation: {
            min: 1, // Requires at least one directory name argument.
        },
        /**
         * The core logic for the 'mkdir' command.
         * It iterates through each provided path argument, resolves it to an absolute path,
         * and attempts to create the directory. It handles 'mkdir -p' logic by
         * calling `FileSystemManager.createParentDirectoriesIfNeeded`. It also checks
         * for invalid names, existing files/directories, and necessary write permissions.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command (directory paths to create).
         * @param {object} context.flags - An object containing the parsed flags (e.g., `parents`).
         * @param {string} context.currentUser - The name of the current user.
         * @returns {Promise<object>} A promise that resolves to a command result object
         * with messages about created directories or errors encountered.
         */
        coreLogic: async (context) => {
            const { args, flags, currentUser } = context;
            let allSuccess = true; // Tracks overall success across all directory creation attempts.
            const messages = []; // Collects messages (success or error) for output.
            let changesMade = false; // Flag to determine if a save operation is needed.
            const nowISO = new Date().toISOString(); // Current timestamp for new nodes.

            // Retrieve the primary group for the current user, essential for new directory ownership.
            const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
            if (!primaryGroup) {
                return {
                    success: false,
                    error: `mkdir: critical - could not determine primary group for user '${currentUser}'`,
                };
            }

            // Iterate through each path argument provided to `mkdir`.
            for (const pathArg of args) {
                // Resolve the path argument to an absolute path.
                const resolvedPath = FileSystemManager.getAbsolutePath(
                    pathArg,
                    FileSystemManager.getCurrentPath()
                );
                // Extract the name of the directory to be created from the resolved path.
                const dirName = resolvedPath.substring(
                    resolvedPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1
                );

                // Validate the target path: disallow root, empty names, '.' or '..'.
                if (
                    resolvedPath === Config.FILESYSTEM.ROOT_PATH ||
                    dirName === "" ||
                    dirName === "." ||
                    dirName === ".."
                ) {
                    messages.push(
                        `mkdir: cannot create directory '${pathArg}': Invalid path or name`
                    );
                    allSuccess = false;
                    continue; // Move to the next argument.
                }

                let parentNodeToCreateIn; // Reference to the parent directory node where the new directory will be added.

                if (flags.parents) {
                    // If '-p' (parents) flag is set, create all non-existent parent directories.
                    const parentDirResult =
                        FileSystemManager.createParentDirectoriesIfNeeded(resolvedPath);
                    if (parentDirResult.error) {
                        messages.push(`mkdir: ${parentDirResult.error}`);
                        allSuccess = false;
                        continue;
                    }
                    parentNodeToCreateIn = parentDirResult.parentNode;
                } else {
                    // If '-p' is not set, the parent directory must already exist.
                    const parentPathForTarget =
                        resolvedPath.substring(
                            0,
                            resolvedPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR)
                        ) || Config.FILESYSTEM.ROOT_PATH; // Get the parent's absolute path.

                    parentNodeToCreateIn =
                        FileSystemManager.getNodeByPath(parentPathForTarget);

                    // Check if the parent directory exists.
                    if (!parentNodeToCreateIn) {
                        messages.push(
                            `mkdir: cannot create directory '${pathArg}': Parent directory '${parentPathForTarget}' does not exist`
                        );
                        allSuccess = false;
                        continue;
                    }

                    // Check if the parent node is actually a directory.
                    if (
                        parentNodeToCreateIn.type !==
                        Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
                    ) {
                        messages.push(
                            `mkdir: cannot create directory '${pathArg}': Path component '${parentPathForTarget}' is not a directory`
                        );
                        allSuccess = false;
                        continue;
                    }

                    // Check write permission on the parent directory.
                    if (
                        !FileSystemManager.hasPermission(
                            parentNodeToCreateIn,
                            currentUser,
                            "write"
                        )
                    ) {
                        messages.push(
                            `mkdir: cannot create directory '${pathArg}' in '${parentPathForTarget}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`
                        );
                        allSuccess = false;
                        continue;
                    }
                }

                // Check if an item with the same name already exists in the parent directory.
                if (
                    parentNodeToCreateIn.children &&
                    parentNodeToCreateIn.children[dirName]
                ) {
                    const existingItem = parentNodeToCreateIn.children[dirName];
                    if (existingItem.type === Config.FILESYSTEM.DEFAULT_FILE_TYPE) {
                        // If it's a file, report "File exists".
                        messages.push(
                            `mkdir: cannot create directory '${pathArg}': File exists`
                        );
                        allSuccess = false;
                    } else if (
                        existingItem.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE &&
                        !flags.parents // If it's a directory and -p is not used, report "Directory already exists".
                    ) {
                        messages.push(
                            `mkdir: cannot create directory '${pathArg}': Directory already exists.`
                        );
                        allSuccess = false;
                    }
                    // If it's an existing directory and -p is used, it's not an error; mkdir -p is idempotent.
                } else {
                    // Create the new directory node.
                    parentNodeToCreateIn.children[dirName] = FileSystemManager._createNewDirectoryNode(
                        currentUser,
                        primaryGroup
                    );
                    parentNodeToCreateIn.mtime = nowISO; // Update parent's modification time.
                    messages.push(`created directory '${pathArg}'`);
                    changesMade = true; // Mark that changes were made, requiring a save.
                }
            }

            // Save file system changes if any directories were successfully created.
            if (changesMade && !(await FileSystemManager.save())) {
                allSuccess = false;
                messages.unshift("mkdir: Failed to save file system changes."); // Add critical save error to the beginning.
            }

            // If not all operations were successful, return a failure result with combined error messages.
            if (!allSuccess) {
                return {
                    success: false,
                    error: messages.join("\n"),
                };
            }
            // If all operations were successful, return a success result with combined output messages.
            return {
                success: true,
                output: messages.join("\n"),
                messageType: Config.CSS_CLASSES.SUCCESS_MSG,
            };
        },
    };

    const mkdirDescription = "Creates one or more new directories.";

    const mkdirHelpText = `Usage: mkdir [OPTION]... <DIRECTORY>...

Create the DIRECTORY(ies), if they do not already exist.

DESCRIPTION
       The mkdir command creates one or more new directories with the
       specified names.

OPTIONS
       -p, --parents
              Create parent directories as needed. If this option is not
              specified, the full path prefix of each operand must already
              exist.

EXAMPLES
       mkdir documents
              Creates a new directory named 'documents' in the current
              directory.

       mkdir -p projects/assets/images
              Creates the 'projects', 'assets', and 'images' directories
              if they do not already exist.`;

    CommandRegistry.register("mkdir", mkdirCommandDefinition, mkdirDescription, mkdirHelpText);
})();