// scripts/commands/printscreen.js

(() => {
    "use strict";
    const printscreenCommandDefinition = {
        commandName: "printscreen",
        argValidation: {
            exact: 1,
            error: "Usage: printscreen <filepath>",
        },
        pathValidation: [
            {
                argIndex: 0,
                options: {
                    allowMissing: true,
                    disallowRoot: true,
                },
            },
        ],
        coreLogic: async (context) => {
            const { args, currentUser, validatedPaths } = context;
            const filePathArg = args[0];
            const pathInfo = validatedPaths[0];
            const resolvedPath = pathInfo.resolvedPath;
            const nowISO = new Date().toISOString();
            if (resolvedPath === Config.FILESYSTEM.ROOT_PATH) {
                return {
                    success: false,
                    error: `printscreen: Cannot save directly to root ('${Config.FILESYSTEM.ROOT_PATH}'). Please specify a filename.`,
                };
            }
            if (resolvedPath.endsWith(Config.FILESYSTEM.PATH_SEPARATOR)) {
                return {
                    success: false,
                    error: `printscreen: Target path '${filePathArg}' must be a file, not a directory path (ending with '${Config.FILESYSTEM.PATH_SEPARATOR}').`,
                };
            }
            const outputContent = DOM.outputDiv ? DOM.outputDiv.innerText : "";
            const existingNode = pathInfo.node;
            if (existingNode) {
                if (existingNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
                    return {
                        success: false,
                        error: `printscreen: Cannot overwrite directory '${filePathArg}'.`,
                    };
                }
                if (
                    !FileSystemManager.hasPermission(existingNode, currentUser, "write")
                ) {
                    return {
                        success: false,
                        error: `printscreen: '${filePathArg}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`,
                    };
                }
                existingNode.content = outputContent;
            } else {
                const parentDirResult =
                    FileSystemManager.createParentDirectoriesIfNeeded(resolvedPath);
                if (parentDirResult.error) {
                    return {
                        success: false,
                        error: `printscreen: ${parentDirResult.error}`,
                    };
                }
                const parentNodeForCreation = parentDirResult.parentNode;
                const fileName = resolvedPath.substring(
                    resolvedPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1
                );
                if (!parentNodeForCreation) {
                    console.error(
                        "printscreen: parentNodeForCreation is null despite createParentDirectoriesIfNeeded success."
                    );
                    return {
                        success: false,
                        error: `printscreen: Critical internal error obtaining parent directory for '${filePathArg}'.`,
                    };
                }
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
                            fileName,
                            parentNodeForCreation.path
                        )}', permission denied in parent.`,
                    };
                }
                const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
                if (!primaryGroup) {
                    return {
                        success: false,
                        error:
                            "printscreen: critical - could not determine primary group for user.",
                    };
                }
                parentNodeForCreation.children[fileName] = {
                    type: Config.FILESYSTEM.DEFAULT_FILE_TYPE,
                    content: outputContent,
                    owner: currentUser,
                    group: primaryGroup,
                    mode: Config.FILESYSTEM.DEFAULT_FILE_MODE,
                    mtime: nowISO,
                };
            }
            FileSystemManager._updateNodeAndParentMtime(resolvedPath, nowISO);
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