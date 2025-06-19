// scripts/commands/edit.js

(() => {
    "use strict";
    const editCommandDefinition = {
        commandName: "edit",
        argValidation: {
            exact: 1,
            error: "expects exactly one filename.",
        },
        pathValidation: [
            {
                argIndex: 0,
                options: {
                    allowMissing: true,
                    disallowRoot: true,
                    expectedType: "file",
                },
            },
        ],
        permissionChecks: [
            {
                pathArgIndex: 0,
                permissions: ["read"],
            },
        ],
        coreLogic: async (context) => {
            const { options, currentUser, validatedPaths } = context;
            if (!options.isInteractive) {
                return {
                    success: false,
                    error: "edit: Can only be run in interactive mode.",
                };
            }
            const pathInfo = validatedPaths[0];
            const resolvedPath = pathInfo.resolvedPath;
            const content = pathInfo.node ? pathInfo.node.content || "" : "";
            if (pathInfo.node) {
                if (!FileSystemManager.hasPermission(pathInfo.node, currentUser, "write")) {
                    return {
                        success: false,
                        error: `edit: '${resolvedPath}': Permission denied to write. File can be viewed but not saved.`,
                        messageType: Config.CSS_CLASSES.WARNING_MSG // Warn, but still open for read-only viewing
                    };
                }
            }
            EditorManager.enter(resolvedPath, content);
            return {
                success: true,
                output: `Opening editor for '${resolvedPath}'...`,
                messageType: Config.CSS_CLASSES.EDITOR_MSG,
            };
        },
    };

    const editDescription = "Opens a file for editing.";
    const editHelpText = "Usage: edit [filename]\n\nOpens the specified file for editing.";

    CommandRegistry.register("edit", editCommandDefinition, editDescription, editHelpText);
})();