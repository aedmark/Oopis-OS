// scripts/commands/edit.js

window.EditCommand = class EditCommand extends Command {
    constructor() {
        super({
            commandName: "edit",
            dependencies: ["apps/editor/editor_ui.js", "apps/editor/editor_manager.js"],
            applicationModules: ["EditorManager", "EditorUI", "App"],
            description: "A powerful, context-aware text and code editor.",
            helpText: `Usage: edit [filepath]
      Launches the OopisOS text editor.
      DESCRIPTION
      The 'edit' command opens a powerful, full-screen modal application for creating
      and editing files. It intelligently adapts its interface based on the file type.
      - If a filepath is provided, it opens that file.
      - If the file does not exist, a new empty file will be created with that name upon saving.
      - If no filepath is given, it opens a new, untitled document.
      MODES
      - Markdown (.md): Activates a live preview.
      - HTML (.html): Activates a live, sandboxed preview of the rendered HTML.
      - Code (.js, .sh, .css, .json): Activates syntax highlighting and word wrap.
      - Text (.txt, etc.): Provides a clean, standard text editing experience with word wrap.
      KEYBOARD SHORTCUTS
      Ctrl+S: Save       Ctrl+O: Exit
      Ctrl+P: Toggle Preview (for Markdown/HTML)
      Ctrl+Z: Undo       Ctrl+Y: Redo`,
            completionType: "paths",
            argValidation: {
                max: 1,
                error: "Usage: edit [filepath]",
            },
            validations: {
                paths: [
                    {
                        argIndex: 0,
                        options: { allowMissing: true, expectedType: "file" },
                        permissions: ["read"],
                        required: false,
                    },
                ],
            },
        });
    }

    async coreLogic(context) {
        const { args, options, validatedPaths, dependencies } = context;
        const { ErrorHandler, AppLayerManager, EditorManager, EditorUI, App } = dependencies;

        if (!options.isInteractive) {
            return ErrorHandler.createError(
                "edit: Can only be run in interactive mode."
            );
        }

        if (typeof EditorManager === 'undefined' || typeof EditorUI === 'undefined' || typeof App === 'undefined') {
            return ErrorHandler.createError(
                "edit: The editor application modules are not loaded."
            );
        }

        const hasFileArgument = args.length > 0 && validatedPaths.length > 0;
        const filePath = hasFileArgument ? validatedPaths[0].resolvedPath : null;
        const node = hasFileArgument ? validatedPaths[0].node : null;

        const fileContent = node ? node.content || "" : "";

        AppLayerManager.show(new EditorManager(), {
            filePath: filePath,
            fileContent,
            dependencies: dependencies
        });

        return ErrorHandler.createSuccess("");
    }
}

window.CommandRegistry.register(new EditCommand());
