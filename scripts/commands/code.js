// scripts/commands/code.js
(() => {
    "use strict";

    const codeCommandDefinition = {
        commandName: "code",
        argValidation: {
            max: 1,
            error: "Usage: code [filepath]"
        },
        pathValidation: [{
            argIndex: 0,
            optional: true,
            options: {
                allowMissing: true,
                expectedType: 'file'
            }
        }],
        coreLogic: async (context) => {
            const {args, options, currentUser, validatedPaths} = context;

            if (!options.isInteractive) {
                return {success: false, error: "code: Can only be run in interactive mode."};
            }

            if (typeof CodeManager === 'undefined' || typeof CodeUI === 'undefined') {
                return {success: false, error: "code: The code editor application modules are not loaded."};
            }

            const pathArg = args.length > 0 ? args[0] : null;
            let fileNode = null;
            let resolvedPath = null;
            let fileContent = "";

            if (pathArg) {
                const pathInfo = validatedPaths[0];
                if (pathInfo.error) {
                    return {success: false, error: `code: ${pathInfo.error}`};
                }
                if (pathInfo.node && !FileSystemManager.hasPermission(pathInfo.node, currentUser, "read")) {
                    return {success: false, error: `code: cannot read file '${pathArg}': Permission denied`};
                }
                fileNode = pathInfo.node;
                resolvedPath = pathInfo.resolvedPath;
                fileContent = fileNode ? fileNode.content : "";
            }

            // The command's only job is to launch the application manager.
            CodeManager.enter(resolvedPath, fileContent);

            return {success: true, output: ""};
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