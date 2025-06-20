/**
 * @file Defines the 'edit' command, which launches the full-screen text editor.
 * This command provides a rich environment for creating and modifying text-based files,
 * with features like syntax-aware modes, live preview, and formatting tools.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} editCommandDefinition
     * @description The command definition for the 'edit' command.
     * This object specifies the command's name, argument validation (expecting one filename),
     * path validation (allowing missing files as they can be created), required read permissions,
     * and the core logic for launching the editor.
     */
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
                    allowMissing: true, // A new file can be created.
                    disallowRoot: true, // Cannot edit the root directory itself.
                    expectedType: "file", // If it exists, it should be a file.
                },
            },
        ],
        permissionChecks: [
            {
                pathArgIndex: 0,
                permissions: ["read"], // Read permission is always required to open.
            },
        ],
        /**
         * The core logic for the 'edit' command.
         * It first checks if the command is run in an interactive session, as the editor is UI-based.
         * It then retrieves the file path and its content (if the file exists).
         * It performs a separate write permission check to inform the user if the file can only be viewed.
         * Finally, it delegates to the `EditorManager.enter` function to launch the editor UI.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {object} context.options - Execution options, including `isInteractive`.
         * @param {string} context.currentUser - The name of the current user.
         * @param {object[]} context.validatedPaths - An array of validated path information objects.
         * @returns {Promise<object>} A promise that resolves to a command result object,
         * indicating the editor is opening or an error occurred.
         */
        coreLogic: async (context) => {
            const { options, currentUser, validatedPaths } = context;

            // The editor is a UI-based application, so it must be run in an interactive terminal session.
            if (!options.isInteractive) {
                return {
                    success: false,
                    error: "edit: Can only be run in interactive mode.",
                };
            }

            const pathInfo = validatedPaths[0]; // Get the validation result for the single path argument.
            const resolvedPath = pathInfo.resolvedPath; // The absolute resolved path.
            // Get content: If the node exists, use its content; otherwise, it's a new file with empty content.
            const content = pathInfo.node ? pathInfo.node.content || "" : "";

            // Check for write permission separately. If the user only has read permission,
            // the file can still be opened for viewing, but a warning will be displayed.
            if (pathInfo.node) {
                if (!FileSystemManager.hasPermission(pathInfo.node, currentUser, "write")) {
                    return {
                        success: false,
                        error: `edit: '${resolvedPath}': Permission denied to write. File can be viewed but not saved.`,
                        messageType: Config.CSS_CLASSES.WARNING_MSG // Use a warning message type.
                    };
                }
            }

            // Launch the editor by calling `EditorManager.enter` with the resolved path and content.
            EditorManager.enter(resolvedPath, content);

            return {
                success: true,
                output: `Opening editor for '${resolvedPath}'...`,
                messageType: Config.CSS_CLASSES.EDITOR_MSG, // Use a specific message type for editor messages.
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

    // Register the command with the CommandRegistry.
    CommandRegistry.register("edit", editCommandDefinition, editDescription, editHelpText);
})();