(() => {
    "use strict";

    const editCommandDefinition = {
        commandName: "edit",
        argValidation: {
            exact: 1,
            error: "expects exactly one filename.",
        },
        pathValidation: [{
            argIndex: 0,
            options: {
                allowMissing: true,
                disallowRoot: true,
                expectedType: "file",
            },
        }, ],
        permissionChecks: [{
            pathArgIndex: 0,
            permissions: ["read"],
        }, ],

        coreLogic: async (context) => {
            const {
                options,
                currentUser,
                validatedPaths
            } = context;

            if (!options.isInteractive) {
                return {
                    success: false,
                    error: "edit: Can only be run in interactive mode.",
                };
            }

            // Ensure the new Editor modules are available
            if (typeof EditorManager === 'undefined' || typeof EditorUI === 'undefined') {
                return {
                    success: false,
                    error: "edit: The new Editor V2 application modules are not loaded."
                };
            }

            const pathInfo = validatedPaths[0];
            const resolvedPath = pathInfo.resolvedPath;
            const content = pathInfo.node ? pathInfo.node.content || "" : "";

            // Check write permission for existing files
            if (pathInfo.node && !FileSystemManager.hasPermission(pathInfo.node, currentUser, "write")) {
                await OutputManager.appendToOutput(
                    `edit: Warning: File '${resolvedPath}' is read-only. You will not be able to save changes.`, {
                        typeClass: Config.CSS_CLASSES.WARNING_MSG
                    }
                );
            }

            // A callback to be executed by the editor when it closes
            const onEditorExit = () => {
                // This function can be used to perform actions after the editor closes,
                // like refreshing the terminal prompt or displaying a message.
                // For now, it does nothing, but the hook is in place.
            };

            // Launch the new editor
            EditorManager.enter(resolvedPath, content, onEditorExit);

            // The command itself returns immediately after launching the app.
            // The editor now manages its own lifecycle.
            return {
                success: true,
                output: "" // Suppress the "Opening editor..." message as the UI is now instant
            };
        },
    };

    const editDescription = "Opens a file in the V2 full-screen text editor.";

    const editHelpText = `Usage: edit <filename>

Open a file in the OopisOS full-screen text editor.

DESCRIPTION
       The edit command launches a powerful, full-screen text editor for
       creating and modifying files. If <filename> does not exist, it will
       be created upon saving.

KEYBOARD SHORTCUTS
       Ctrl+S
              Save the current content and exit the editor.
       Ctrl+O
              Exit the editor. If there are unsaved changes, you will be
              prompted to confirm before discarding them.
       Ctrl+Z
              Undo the last action.
       Ctrl+Y / Ctrl+Shift+Z
              Redo the last undone action.
       Esc
              Exit the editor (prompts if unsaved).

PERMISSIONS
       You must have read permission on a file to open it. To save changes,
       you must have write permission on the file. If creating a new file,
       you must have write permission in the parent directory.`;


    CommandRegistry.register("edit", editCommandDefinition, editDescription, editHelpText);
})();