// scripts/commands/paint.js

(() => {
    "use strict";
    const paintCommandDefinition = {
        commandName: "paint",
        argValidation: { max: 1 },
        pathValidation: [{
            argIndex: 0,
            optional: true,
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

            const pathInfo = validatedPaths[0];
            const filePath = pathInfo ? pathInfo.resolvedPath : (args[0] || null);
            let fileContent = "";

            if (pathInfo && pathInfo.node) {
                if (Utils.getFileExtension(filePath) !== 'oopic') {
                    return { success: false, error: `paint: can only edit .oopic files.` };
                }
                if (!FileSystemManager.hasPermission(pathInfo.node, currentUser, "read")) {
                    return { success: false, error: `paint: '${filePath}': Permission denied` };
                }
                fileContent = pathInfo.node.content || "";
            } else if (filePath && Utils.getFileExtension(filePath) !== 'oopic') {
                return { success: false, error: `paint: new file must have .oopic extension.` };
            }

            PaintManager.enter(filePath, fileContent);

            return {
                success: true,
                output: `Opening paint for '${filePath || "new file"}'...`,
                messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG
            };
        }
    };

    const paintDescription = "Opens a file for painting.";
    const paintHelpText = "Usage: paint [filename]\n\nOpens the specified file for painting.";

    CommandRegistry.register("paint", paintCommandDefinition, paintDescription, paintHelpText);
})();