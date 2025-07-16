// scripts/commands/code.js
(() => {
    "use strict";

    const codeCommandDefinition = {
        commandName: "code",
        completionType: "paths", // Preserved for tab completion
        argValidation: {
            max: 1,
            error: "Usage: code [filepath]"
        },
        coreLogic: async (context) => {
            const { args, options, currentUser } = context;

            try {
                if (!options.isInteractive) {
                    return { success: false, error: "code: Can only be run in interactive mode." };
                }

                if (typeof CodeManager === 'undefined' || typeof CodeUI === 'undefined') {
                    return { success: false, error: "code: The code editor application modules are not loaded." };
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
                        return { success: false, error: `code: ${pathValidation.error}` };
                    }

                    if (pathValidation.node) {
                        if (!FileSystemManager.hasPermission(pathValidation.node, currentUser, "read")) {
                            return { success: false, error: `code: cannot read file '${pathArg}': Permission denied` };
                        }
                        fileNode = pathValidation.node;
                        fileContent = fileNode.content || "";
                    }
                    resolvedPath = pathValidation.resolvedPath;
                }

                CodeManager.enter(resolvedPath, fileContent);

                return { success: true, output: "" };
            } catch (e) {
                return { success: false, error: `code: An unexpected error occurred: ${e.message}` };
            }
        }
    };

    const codeDescription = "A simple, lightweight code editor with syntax highlighting.";
    const codeHelpText = `Usage: code [filepath]

Launches the OopisOS code editor.

DESCRIPTION
        The 'code' command opens a simple modal editor designed for viewing
        and editing code files. It provides basic JavaScript syntax highlighting.

        - If a filepath is provided, it opens that file.
        - If the file does not exist, a new empty file will be created with that name upon saving.
        - If no filepath is given, it opens a new, untitled document.`;

    CommandRegistry.register("code", codeCommandDefinition, codeDescription, codeHelpText);
})();