(() => {
    "use strict";

    const paintCommandDefinition = {
        commandName: "paint",
        argValidation: {
            max: 1,
            error: "Usage: paint [filename.oopic]"
        },
        pathValidation: [{
            argIndex: 0,
            optional: true, // It's optional, a new file can be created.
            options: {
                allowMissing: true,
                expectedType: 'file'
            }
        }],

        coreLogic: async (context) => {
            const { args, options, currentUser, validatedPaths } = context;

            if (!options.isInteractive) {
                return { success: false, error: "paint: Can only be run in interactive mode." };
            }

            // Verify that the required application modules are present.
            if (typeof PaintManager === 'undefined' || typeof PaintUI === 'undefined') {
                return {
                    success: false,
                    error: "paint: The Paint application module is not loaded."
                };
            }

            const pathArg = args[0] || `untitled-${new Date().getTime()}.oopic`;
            const pathInfo = validatedPaths[0] || FileSystemManager.validatePath("paint", pathArg, { allowMissing: true });
            const filePath = pathInfo.resolvedPath;
            let fileContent = "";

            if (Utils.getFileExtension(filePath) !== 'oopic') {
                return { success: false, error: `paint: can only edit .oopic files.` };
            }

            if (pathInfo && pathInfo.node) {
                // Check read permissions before trying to load content.
                if (!FileSystemManager.hasPermission(pathInfo.node, currentUser, "read")) {
                    return { success: false, error: `paint: '${filePath}': Permission denied` };
                }
                fileContent = pathInfo.node.content || "";
            }

            // The command's only job is to call the manager's entry point.
            PaintManager.enter(filePath, fileContent);

            // The command succeeds by launching the app. The app itself now handles its own lifecycle.
            return {
                success: true,
                output: "" // The UI appears instantly, no need for a message.
            };
        }
    };

    const paintDescription = "Opens the character-based art editor.";

    const paintHelpText = `Usage: paint [filename.oopic]

Launch the OopisOS character-based art editor.

DESCRIPTION
       The paint command opens a full-screen, grid-based editor for
       creating ASCII and ANSI art. The canvas is 80 characters wide
       by 24 characters high.

       If a <filename> is provided, it will be opened. If it does not
       exist, it will be created upon saving. Files must have the
       '.oopic' extension.

KEYBOARD SHORTCUTS
       P - Pencil      E - Eraser      L - Line      R - Rect
       G - Toggle Grid
       1-7 - Select Color (Red, Green, Blue, Yellow, Magenta, Cyan, White)

       Ctrl+S - Save and Exit
       Ctrl+O - Exit (prompts if unsaved)
       Ctrl+Z - Undo
       Ctrl+Y - Redo`;

    CommandRegistry.register("paint", paintCommandDefinition, paintDescription, paintHelpText);
})();