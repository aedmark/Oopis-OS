// scripts/commands/clearfs.js

(() => {
    "use strict";
    const clearfsCommandDefinition = {
        commandName: "clearfs",
        argValidation: {
            exact: 0,
        },
        coreLogic: async (context) => {
            const { options, currentUser } = context;
            if (!options.isInteractive) {
                return {
                    success: false,
                    error: "clearfs: Can only be run in interactive mode.",
                };
            }
            const username = currentUser;
            const userHomePath = `/home/${username}`;
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
                    options,
                })
            );
            if (!confirmed) {
                return {
                    success: true,
                    output: `Home directory clear for '${username}' cancelled. No action taken.`,
                    messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                };
            }
            const homeDirNode = FileSystemManager.getNodeByPath(userHomePath);
            if (
                !homeDirNode ||
                homeDirNode.type !== Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
            ) {
                return {
                    success: false,
                    error: `clearfs: Critical error - Could not find home directory for '${username}' at '${userHomePath}'.`,
                };
            }
            homeDirNode.children = {};
            homeDirNode.mtime = new Date().toISOString();
            if (!(await FileSystemManager.save())) {
                return {
                    success: false,
                    error:
                        "clearfs: CRITICAL - Failed to save file system changes after clearing home directory.",
                };
            }
            const currentPath = FileSystemManager.getCurrentPath();
            if (currentPath.startsWith(userHomePath)) {
                FileSystemManager.setCurrentPath(userHomePath);
            }
            TerminalUI.updatePrompt();
            OutputManager.clearOutput();
            const successMessage = `Home directory for user '${username}' has been cleared.`;
            await OutputManager.appendToOutput(successMessage, {
                typeClass: Config.CSS_CLASSES.SUCCESS_MSG,
            });
            return {
                success: true,
                output: "",
            };
        },
    };
    const clearfsDescription = "Clears the current user's home directory.";
    const clearfsHelpText = "Usage: clearfs";
    CommandRegistry.register("clearfs", clearfsCommandDefinition, clearfsDescription, clearfsHelpText);
})();