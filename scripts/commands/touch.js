/**
 * @file Defines the 'touch' command, which changes file timestamps or creates empty files.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} touchCommandDefinition
     * @description The command definition for the 'touch' command.
     * This object specifies the command's name, supported flags,
     * argument validation, and the core logic for updating file timestamps or creating new, empty files.
     */
    const touchCommandDefinition = {
        commandName: "touch",
        flagDefinitions: [
            { name: "noCreate", short: "-c", long: "--no-create" },
            { name: "dateString", short: "-d", long: "--date", takesValue: true },
            { name: "stamp", short: "-t", takesValue: true },
        ],
        argValidation: { min: 1 }, // Requires at least one file path argument.
        /**
         * The core logic for the 'touch' command.
         * It iterates through each provided file path. For existing files, it updates their modification time.
         * For non-existent files, it creates them (unless the --no-create flag is present).
         * It handles timestamp parsing from -d or -t flags, permission checks, and saving file system changes.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command (file paths to touch).
         * @param {object} context.flags - An object containing the parsed flags.
         * @param {string} context.currentUser - The name of the current user.
         * @returns {Promise<object>} A promise that resolves to a command result object,
         * indicating the success or failure of the touch operation(s).
         */
        coreLogic: async (context) => {
            const { args, flags, currentUser } = context;

            // Resolve the timestamp to use from the provided flags (-d or -t).
            const timestampResult = TimestampParser.resolveTimestampFromCommandFlags(
                flags,
                "touch"
            );
            if (timestampResult.error)
                return { success: false, error: timestampResult.error };

            const timestampToUse = timestampResult.timestampISO; // The determined ISO timestamp.
            let allSuccess = true; // Tracks overall success across all file operations.
            const messages = []; // Collects messages (errors) for output.
            let changesMade = false; // Flag to indicate if a file system save is needed.

            // Get the primary group for the current user, needed for new file creation.
            const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);

            // Iterate through each path argument.
            for (const pathArg of args) {
                // Validate the path: allow missing (for new file creation), disallow root.
                const pathValidation = FileSystemManager.validatePath(
                    "touch",
                    pathArg,
                    { allowMissing: true, disallowRoot: true }
                );

                if (pathValidation.node) {
                    // If the node exists, update its timestamp.
                    if (
                        !FileSystemManager.hasPermission(
                            pathValidation.node,
                            currentUser,
                            "write"
                        )
                    ) {
                        messages.push(
                            `touch: cannot update timestamp of '${pathArg}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`
                        );
                        allSuccess = false;
                        continue;
                    }
                    pathValidation.node.mtime = timestampToUse; // Apply the resolved timestamp.
                    changesMade = true;
                } else if (pathValidation.error) {
                    // If there's an error from path validation that isn't about being missing (e.g., trying to touch root).
                    messages.push(pathValidation.error);
                    allSuccess = false;
                } else {
                    // If the node does not exist (pathValidation.node is null), attempt to create a new file.
                    if (flags.noCreate) continue; // Skip creation if -c flag is present.

                    // Prevent creating a file with a trailing slash (implies directory).
                    if (pathArg.trim().endsWith(Config.FILESYSTEM.PATH_SEPARATOR)) {
                        messages.push(
                            `touch: cannot touch '${pathArg}': No such file or directory`
                        );
                        allSuccess = false;
                        continue;
                    }

                    // Determine the parent directory path for the new file.
                    const parentPath =
                        pathValidation.resolvedPath.substring(
                            0,
                            pathValidation.resolvedPath.lastIndexOf(
                                Config.FILESYSTEM.PATH_SEPARATOR
                            )
                        ) || Config.FILESYSTEM.ROOT_PATH;
                    const parentNode = FileSystemManager.getNodeByPath(parentPath);

                    // Check if the parent directory exists and is actually a directory.
                    if (
                        !parentNode ||
                        parentNode.type !== Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
                    ) {
                        messages.push(
                            `touch: cannot create '${pathArg}': Parent directory not found or is not a directory.`
                        );
                        allSuccess = false;
                        continue;
                    }

                    // Check write permission in the parent directory to create the new file.
                    if (
                        !FileSystemManager.hasPermission(parentNode, currentUser, "write")
                    ) {
                        messages.push(
                            `touch: cannot create '${pathArg}': Permission denied in parent directory.`
                        );
                        allSuccess = false;
                        continue;
                    }

                    // Ensure primary group is available for new file ownership.
                    if (!primaryGroup) {
                        messages.push(
                            `touch: could not determine primary group for user '${currentUser}'`
                        );
                        allSuccess = false;
                        continue;
                    }

                    // Extract the new file name from the resolved path.
                    const fileName = pathValidation.resolvedPath.substring(
                        pathValidation.resolvedPath.lastIndexOf(
                            Config.FILESYSTEM.PATH_SEPARATOR
                        ) + 1
                    );

                    // Create the new empty file node and add it to the parent.
                    const newFileNode = FileSystemManager._createNewFileNode(
                        fileName,
                        "", // Empty content for a new file.
                        currentUser,
                        primaryGroup
                    );

                    // *** FIX: Apply the specified timestamp to the new file ***
                    newFileNode.mtime = timestampToUse;
                    parentNode.children[fileName] = newFileNode;

                    // Update parent's modification time to now.
                    parentNode.mtime = new Date().toISOString();
                    changesMade = true;
                }
            }

            // Save file system changes if any modifications or creations occurred.
            if (changesMade && !(await FileSystemManager.save())) {
                messages.push("touch: CRITICAL - Failed to save file system changes.");
                allSuccess = false;
            }

            // Consolidate messages for final output.
            const outputMessage = messages.join("\n");
            if (!allSuccess)
                return {
                    success: false,
                    error: outputMessage || "touch: Not all operations were successful.",
                };

            return { success: true, output: "" }; // If all successful, no output needed.
        },
    };

    /**
     * @const {string} touchDescription
     * @description A brief, one-line description of the 'touch' command for the 'help' command.
     */
    const touchDescription = "Changes file timestamps or creates empty files.";

    /**
     * @const {string} touchHelpText
     * @description The detailed help text for the 'touch' command, used by 'man'.
     */
    const touchHelpText = `Usage: touch [OPTION]... FILE...

Change file timestamps.

DESCRIPTION
       The touch command updates the modification time of each FILE to
       the current time.

       A FILE argument that does not exist is created empty, unless the
       -c option is supplied.

OPTIONS
       -c, --no-create
              Do not create any files.

       -d, --date=<string>
              Parse <string> and use it instead of the current time.
              Examples: "1 day ago", "2025-01-01"

       -t <stamp>
              Use [[CC]YY]MMDDhhmm[.ss] instead of the current time.

EXAMPLES
       touch newfile.txt
              Creates 'newfile.txt' if it does not exist, or updates its
              modification time if it does.

       touch -c existing_file.txt
              Updates the timestamp of 'existing_file.txt' but will not
              create it if it's missing.`;

    // Register the command with the system
    CommandRegistry.register("touch", touchCommandDefinition, touchDescription, touchHelpText);
})();