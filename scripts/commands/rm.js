(() => {
    "use strict";
    /**
     * @file Defines the 'rm' command, which removes files or directories from the OopisOS file system.
     * It supports recursive deletion, forced removal, and interactive confirmation prompts.
     * @author Andrew Edmark
     * @author Gemini
     */

    /**
     * @const {object} rmCommandDefinition
     * @description The command definition for the 'rm' command.
     * This object specifies the command's name, supported flags, argument validation,
     * and the core logic for removing file system entries.
     */
    const rmCommandDefinition = {
        commandName: "rm",
        flagDefinitions: [
            {
                name: "recursive",
                short: "-r",
                long: "--recursive",
                aliases: ["-R"],
            },
            {
                name: "force",
                short: "-f",
                long: "--force",
            },
            {
                name: "interactive",
                short: "-i",
                long: "--interactive",
            },
        ],
        argValidation: {
            min: 1, // Requires at least one operand (file/directory to remove).
            error: "missing operand",
        },
        // --- ADDED FOR AUTO-COMPLETION ---
        pathValidation: [
            { argIndex: 0, options: { allowMissing: true } }
        ],
        // --- END ADDITION ---
        /**
         * The core logic for the 'rm' command.
         * It iterates through each provided path argument and attempts to remove the corresponding
         * file or directory. It handles various scenarios:
         * - Skipping non-existent files if 'force' flag is present.
         * - Preventing deletion of directories without the 'recursive' flag.
         * - Managing interactive confirmation prompts based on '-i', '-f' flags, and interactive session status.
         * It delegates the actual recursive deletion to `FileSystemManager.deleteNodeRecursive` and saves changes.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command (paths to remove).
         * @param {object} context.flags - An object containing the parsed flags.
         * @param {string} context.currentUser - The name of the current user.
         * @param {object} context.options - Execution options, including `isInteractive` and `scriptingContext`.
         * @returns {Promise<object>} A promise that resolves to a command result object
         * with messages about the operation's success or failure.
         */
        coreLogic: async (context) => {
            const { args, flags, currentUser, options } = context;
            let allSuccess = true; // Tracks overall success across all removal attempts.
            let anyChangeMade = false; // Flag to determine if a save operation is needed.
            const messages = []; // Collects messages (success or error) for output.

            // Iterate through each path argument provided to `rm`.
            for (const pathArg of args) {
                // Validate the path; disallow removal of the root directory.
                const pathValidation = FileSystemManager.validatePath("rm", pathArg, {
                    disallowRoot: true,
                });

                // If 'force' flag is present and the path does not exist, just skip it.
                if (flags.force && !pathValidation.node) continue;

                // If path validation fails (and not skipped by -f), record the error and continue.
                if (pathValidation.error) {
                    messages.push(pathValidation.error);
                    allSuccess = false;
                    continue;
                }

                const node = pathValidation.node; // The file system node to be removed.

                // Prevent removal of directories without the recursive flag.
                if (
                    node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE &&
                    !flags.recursive
                ) {
                    messages.push(
                        `rm: cannot remove '${pathArg}': Is a directory (use -r or -R)`
                    );
                    allSuccess = false;
                    continue;
                }

                const isPromptRequired = flags.interactive || (options.isInteractive && !flags.force);
                let confirmed = false;

                if (isPromptRequired) {
                    const promptMsg =
                        node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
                            ? `Recursively remove directory '${pathArg}'?`
                            : `Remove file '${pathArg}'?`;

                    confirmed = await new Promise((resolve) => {
                        ModalManager.request({
                            context: "terminal",
                            messageLines: [promptMsg],
                            onConfirm: () => resolve(true),
                            onCancel: () => resolve(false),
                            options, // Pass context for scripted prompts.
                        });
                    });
                } else {
                    // Auto-confirm if -f is used or if in a non-interactive script.
                    confirmed = true;
                }

                // Proceed with deletion if confirmed.
                if (confirmed) {
                    const deleteResult = await FileSystemManager.deleteNodeRecursive(
                        pathArg,
                        {
                            force: true, // Internal call is always forced after confirmation/decision by rm logic.
                            currentUser, // Pass current user for permission checks during recursive deletion.
                        }
                    );
                    if (deleteResult.success) {
                        if (deleteResult.anyChangeMade) anyChangeMade = true; // Flag for saving changes.
                        if(flags.force) {
                            messages.push(`${Config.MESSAGES.FORCIBLY_REMOVED_PREFIX}'${pathArg}'${Config.MESSAGES.FORCIBLY_REMOVED_SUFFIX}`);
                        } else {
                            messages.push(`'${pathArg}'${Config.MESSAGES.ITEM_REMOVED_SUFFIX}`);
                        }
                    } else {
                        allSuccess = false;
                        messages.push(...deleteResult.messages); // Collect messages from failed recursive deletions.
                    }
                } else {
                    // If not confirmed (user cancelled), add a cancellation message.
                    messages.push(
                        `${Config.MESSAGES.REMOVAL_CANCELLED_PREFIX}'${pathArg}'${Config.MESSAGES.REMOVAL_CANCELLED_SUFFIX}`
                    );
                }
            }
            // Save file system changes if any nodes were successfully removed.
            if (anyChangeMade) await FileSystemManager.save();

            // Filter out any empty messages and join them for final output/error.
            const finalOutput = messages.filter((m) => m).join("\n");
            return {
                success: allSuccess,
                output: allSuccess ? finalOutput : null,
                error: allSuccess // If overall success, no error; otherwise, use collected messages as error.
                    ? null
                    : finalOutput || "Unknown error during rm operation.",
            };
        },
    };

    const rmDescription = "Removes files or directories.";

    const rmHelpText = `Usage: rm [OPTION]... [FILE]...

Remove files or directories.

DESCRIPTION
       The rm command removes each specified file. By default, it does not
       remove directories.

       In an interactive session, rm will prompt for confirmation before
       removing a file. This behavior can be controlled with the -f and
       -i flags.

OPTIONS
       -f, --force
              Attempt to remove the files without prompting for
              confirmation, regardless of the file's permissions.

       -i, --interactive
              Prompt for confirmation before every removal.

       -r, -R, --recursive
              Remove directories and their contents recursively.

WARNING
       Use this command with caution. Deleted files and directories
       cannot be recovered.`;

    CommandRegistry.register("rm", rmCommandDefinition, rmDescription, rmHelpText);
})();