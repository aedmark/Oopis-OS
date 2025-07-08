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
                        messageType: Config.CSS_CLASSES.WARNING_MSG
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

    const editDescription = "Opens a file in the full-screen text editor.";

    const editHelpText = `Usage: edit <filename>

Open a file in the OopisOS full-screen text editor.

DESCRIPTION
       The edit command launches a powerful, full-screen text editor for
       creating and modifying files. If <filename> does not exist, it will
       be created upon saving.

FEATURES
       File-Aware Modes
              The editor automatically detects the file type based on its
              extension (.md, .html, etc.) and enables special features.

       Live Preview
              For Markdown and HTML files, a live preview pane is available,
              showing the rendered output as you type.

       Formatting Toolbar
              For Markdown and HTML, a toolbar appears with buttons for
              common actions like bold, italics, lists, and links.

       Status Bar
              A detailed status bar at the bottom displays the current line
              and column number, total lines, word count, and character count.

       Word Wrap
              Toggle between wrapping long lines of text or allowing them to
              scroll horizontally. Your preference is saved across sessions.

       Export to HTML
              The rendered preview of a Markdown or HTML file can be exported
              and downloaded as a standalone .html file.

KEYBOARD SHORTCUTS
       Ctrl+S
              Save the current content and exit the editor.
       Ctrl+O
              Exit the editor. If there are unsaved changes, you will be
              prompted to confirm before discarding them.
       Ctrl+P
              Toggle the preview pane through its different modes:
              split-screen, editor only, and preview only.
       Ctrl+Z
              Undo the last action.
       Ctrl+Y / Ctrl+Shift+Z
              Redo the last undone action.
       Ctrl+B
              Apply/remove bold formatting to the selected text.
       Ctrl+I
              Apply/remove italic formatting to the selected text.

PERMISSIONS
       You must have read permission on a file to open it. To save changes,
       you must have write permission on the file. If creating a new file,
       you must have write permission in the parent directory.`;

    CommandRegistry.register("edit", editCommandDefinition, editDescription, editHelpText);
})();