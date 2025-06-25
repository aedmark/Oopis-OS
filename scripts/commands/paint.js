(() => {
    "use strict";
    /**
     * @file Defines the 'paint' command, which launches the OopisOS character-based art editor.
     * This command provides a full-screen canvas for creating ASCII and ANSI art.
     * @author Andrew Edmark
     * @author Gemini
     */

    /**
     * @const {object} paintCommandDefinition
     * @description The command definition for the 'paint' command.
     * This object specifies the command's name, argument validation (optional filename),
     * path validation (allowing missing files), and the core logic for launching the paint editor.
     */
    const paintCommandDefinition = {
        commandName: "paint",
        argValidation: {
            exact: 1,
            error: "a filename is required. Usage: paint <filename.oopic>"
        }, // Accepts at most one argument (optional filename).
        pathValidation: [{
            argIndex: 0,
            options: {
                allowMissing: true, // If file doesn't exist, it can be created upon saving.
                expectedType: 'file' // If it exists, it should be a file.
            }
        }],
        /**
         * The core logic for the 'paint' command.
         * It validates that the command is run in interactive mode.
         * It checks the provided file path: if an existing file, it validates its type (.oopic)
         * and read permissions to load its content. If it's a new file, it ensures the
         * specified name has the correct extension. Finally, it delegates to `PaintManager.enter`
         * to launch the graphical editor.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command (optional filename).
         * @param {object} context.options - Execution options, including `isInteractive`.
         * @param {string} context.currentUser - The name of the current user.
         * @param {object[]} context.validatedPaths - An array of validated path information objects.
         * @returns {Promise<object>} A promise that resolves to a command result object,
         * indicating the paint editor is opening or an error occurred.
         */
        coreLogic: async (context) => {
            const { args, options, currentUser, validatedPaths } = context;

            // The paint editor is a UI-based application, so it must be run in an interactive terminal session.
            if (!options.isInteractive) {
                return { success: false, error: "paint: Can only be run in interactive mode." };
            }

            const pathInfo = validatedPaths[0]; // Get the validated path info for the single argument.
            const filePath = pathInfo ? pathInfo.resolvedPath : (args[0] || null); // Get the resolved path or original arg.
            let fileContent = "";

            if (pathInfo && pathInfo.node) {
                // If a node exists (i.e., opening an existing file).
                if (Utils.getFileExtension(filePath) !== 'oopic') {
                    return { success: false, error: `paint: can only edit .oopic files.` };
                }
                // Check read permission on the existing file.
                if (!FileSystemManager.hasPermission(pathInfo.node, currentUser, "read")) {
                    return { success: false, error: `paint: '${filePath}': Permission denied` };
                }
                fileContent = pathInfo.node.content || ""; // Load content from the existing file.
            } else if (filePath && Utils.getFileExtension(filePath) !== 'oopic') {
                // If it's a new file path (pathInfo.node is null), ensure it has .oopic extension.
                return { success: false, error: `paint: new file must have .oopic extension.` };
            }

            // Launch the paint editor.
            PaintManager.enter(filePath, fileContent);

            return {
                success: true,
                output: `Opening paint for '${filePath || "new file"}'...`,
                messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG
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