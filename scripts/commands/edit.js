// scripts/commands/edit.js
(() => {
    "use strict";

    const editCommandDefinition = {
        commandName: "edit",
        completionType: "paths", // Preserved for tab completion
        argValidation: {
            max: 1,
            error: "Usage: edit [filepath]"
        },
        coreLogic: async (context) => {
            const { args, options, currentUser } = context;

            try {
                if (!options.isInteractive) {
                    return { success: false, error: "edit: Can only be run in interactive mode." };
                }

                if (typeof EditorManager === 'undefined' || typeof EditorUI === 'undefined') {
                    return { success: false, error: "edit: The editor application modules are not loaded." };
                }

                const pathArg = args.length > 0 ? args[0] : null;
                let fileNode = null;
                let resolvedPath = null;
                let fileContent = "";

                if (pathArg) {
                    const pathValidation = FileSystemManager.validatePath(pathArg, {
                        allowMissing: true,
                        expectedType: 'file'
                    });

                    if (pathValidation.error && !(pathValidation.node === null && pathValidation.error.includes("No such file or directory"))) {
                        return { success: false, error: `edit: ${pathValidation.error}` };
                    }

                    if (pathValidation.node) {
                        if (!FileSystemManager.hasPermission(pathValidation.node, currentUser, "read")) {
                            return { success: false, error: `edit: cannot read file '${pathArg}': Permission denied` };
                        }
                        fileNode = pathValidation.node;
                        fileContent = fileNode.content || "";
                    }
                    resolvedPath = pathValidation.resolvedPath;
                }

                EditorManager.enter(resolvedPath, fileContent);

                return { success: true, output: "" };
            } catch (e) {
                return { success: false, error: `edit: An unexpected error occurred: ${e.message}` };
            }
        }
    };

    const editDescription = "A powerful, context-aware text and code editor.";
    const editHelpText = `Usage: edit [filepath]

Launches the OopisOS text editor.

DESCRIPTION
       The 'edit' command opens a powerful, full-screen modal application for creating
       and editing files. It intelligently adapts its interface based on the file type.

       - If a filepath is provided, it opens that file.
       - If the file does not exist, a new empty file will be created with that name upon saving.
       - If no filepath is given, it opens a new, untitled document.

MODES
       - Markdown (.md): Activates a live preview and a formatting toolbar.
       - HTML (.html): Activates a live, sandboxed preview of the rendered HTML.
       - Other (e.g., .txt, .js, .sh): Provides a clean, standard text editing experience.

KEYBOARD SHORTCUTS
       Ctrl+S: Save       Ctrl+O: Exit
       Ctrl+P: Toggle Preview    Ctrl+B: Bold
       Ctrl+I: Italic      Ctrl+K: Insert Link`;

    CommandRegistry.register("edit", editCommandDefinition, editDescription, editHelpText);
})();