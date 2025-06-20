// scripts/commands/clearfs.js

/**
 * @file Defines the 'clearfs' command, which clears the current user's home directory.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} clearfsCommandDefinition
     * @description The command definition for the 'clearfs' command.
     * This command allows a user to permanently erase all contents within their home directory.
     * It includes an interactive confirmation prompt to prevent accidental data loss.
     */
    const clearfsCommandDefinition = {
        commandName: "clearfs",
        argValidation: {
            exact: 0,
        },
        /**
         * The core logic for the 'clearfs' command.
         * It prompts the user for confirmation before proceeding to empty the current user's
         * home directory. It ensures the command is run in interactive mode and handles
         * updating the file system and UI after the operation.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {object} context.options - Execution options, including `isInteractive`.
         * @param {string} context.currentUser - The name of the current user.
         * @returns {Promise<object>} A promise that resolves to a command result object.
         */
        coreLogic: async (context) => {
            const { options, currentUser } = context;
            // Ensure the command is run in an interactive terminal session.
            if (!options.isInteractive) {
                return {
                    success: false,
                    error: "clearfs: Can only be run in interactive mode.",
                };
            }

            const username = currentUser;
            const userHomePath = `/home/${username}`;

            // Request confirmation from the user before proceeding with the destructive operation.
            const confirmed = await new Promise((resolve) =>
                ModalManager.request({
                    context: "terminal",
                    messageLines: [
                        `WARNING: This will permanently erase ALL files and directories in your home directory (${userHomePath}).`,
                        "This action cannot be undone.",
                        "Are you sure you want to clear your home directory?",
                    ],
                    onConfirm: () => resolve(true),
                    onCancel: () => resolve(false),
                    options, // Pass options to ModalManager for scripting context awareness
                })
            );

            // If the user cancels the operation, return a success message indicating no action was taken.
            if (!confirmed) {
                return {
                    success: true,
                    output: `Home directory clear for '${username}' cancelled. No action taken.`,
                    messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                };
            }

            // Retrieve the home directory node.
            const homeDirNode = FileSystemManager.getNodeByPath(userHomePath);

            // Critical error check: Ensure the home directory exists and is a directory.
            if (
                !homeDirNode ||
                homeDirNode.type !== Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
            ) {
                return {
                    success: false,
                    error: `clearfs: Critical error - Could not find home directory for '${username}' at '${userHomePath}'.`,
                };
            }

            // Clear the children of the home directory node, effectively emptying it.
            homeDirNode.children = {};
            homeDirNode.mtime = new Date().toISOString(); // Update modification time of the home directory

            // Save the updated file system to persistent storage.
            if (!(await FileSystemManager.save())) {
                return {
                    success: false,
                    error:
                        "clearfs: CRITICAL - Failed to save file system changes after clearing home directory.",
                };
            }

            // If the current path was inside the cleared home directory, reset it to the home directory itself.
            const currentPath = FileSystemManager.getCurrentPath();
            if (currentPath.startsWith(userHomePath)) {
                FileSystemManager.setCurrentPath(userHomePath);
            }

            // Update the terminal UI to reflect the changes.
            TerminalUI.updatePrompt();
            OutputManager.clearOutput(); // Clear the screen after successful operation for a clean slate.

            const successMessage = `Home directory for user '${username}' has been cleared.`;
            await OutputManager.appendToOutput(successMessage, {
                typeClass: Config.CSS_CLASSES.SUCCESS_MSG,
            });

            return {
                success: true,
                output: "", // No further output needed as success message is handled by appendToOutput
            };
        },
    };

    const clearfsDescription = "Clears the current user's home directory of all contents.";

    const clearfsHelpText = `Usage: clearfs

Clears the current user's home directory of all contents.

DESCRIPTION
       The clearfs command permanently removes all files and subdirectories
       within the current user's home directory (e.g., /home/Guest),
       effectively resetting it to an empty state.

       This command only affects the home directory of the user who runs it.
       It does not affect other parts of the file system.

WARNING
       This operation is irreversible. All data within your home
       directory will be permanently lost. The command will prompt for
       confirmation before proceeding.`;

    CommandRegistry.register("clearfs", clearfsCommandDefinition, clearfsDescription, clearfsHelpText);
})();