(() => {
    "use strict";

    const paintCommandDefinition = {
        commandName: "paint",
        argValidation: {
            exact: 1,
            error: "a filename is required. Usage: paint <filename.oopic>"
        },
        pathValidation: [{
            argIndex: 0,
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

            // Verify that the new, required modules are loaded.
            if (typeof PaintManager === 'undefined' || typeof PaintUI === 'undefined') {
                return {
                    success: false,
                    error: "paint: The Paint application module is not loaded."
                };
            }

            const pathInfo = validatedPaths[0];
            const filePath = pathInfo ? pathInfo.resolvedPath : (args[0] || null);
            let fileContent = "";

            if (pathInfo && pathInfo.node) {
                // Ensure we are only opening .oopic files
                if (Utils.getFileExtension(filePath) !== 'oopic') {
                    return { success: false, error: `paint: can only edit .oopic files.` };
                }
                // Check read permissions before trying to load content
                if (!FileSystemManager.hasPermission(pathInfo.node, currentUser, "read")) {
                    return { success: false, error: `paint: '${filePath}': Permission denied` };
                }
                fileContent = pathInfo.node.content || "";
            } else if (filePath && Utils.getFileExtension(filePath) !== 'oopic') {
                // Ensure new files also have the correct extension
                return { success: false, error: `paint: new file must have .oopic extension.` };
            }

            // The command's only job is to call the manager's entry point.
            await PaintManager.enter(filePath, fileContent);

            // The command succeeds by launching the app. The app itself now handles its own lifecycle.
            return {
                success: true,
                output: ""
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
       exist, it will be created upon saving. Files should have the
       '.oopic' extension.

CONTROLS
       Mouse
              Click or click-and-drag on the canvas to draw with the
              selected tool, character, and color.

       Keyboard
              P - Select the Pencil tool.
              E - Select the Eraser tool.
              1-6 - Select a color from the palette.
              Any other character key - Set the drawing character.

KEYBOARD SHORTCUTS
       Ctrl+S
              Save the current artwork and exit the editor.
       Ctrl+O
              Exit the editor. If there are unsaved changes, you will be
              prompted to confirm before discarding them.
       Ctrl+Z
              Undo the last stroke.
       Ctrl+Y / Ctrl+Shift+Z
              Redo the last undone stroke.`;

    CommandRegistry.register("paint", paintCommandDefinition, paintDescription, paintHelpText);
})();