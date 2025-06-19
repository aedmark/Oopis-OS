// scripts/commands/export.js

(() => {
    "use strict";
    const exportCommandDefinition = {
        commandName: "export",
        argValidation: {
            exact: 1,
            error: "expects exactly one file path.",
        },
        pathValidation: [
            {
                argIndex: 0,
                options: {
                    expectedType: Config.FILESYSTEM.DEFAULT_FILE_TYPE,
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
            const pathInfo = context.validatedPaths[0];
            const fileNode = pathInfo.node;
            const fileName = pathInfo.resolvedPath.substring(
                pathInfo.resolvedPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1
            );
            try {
                const blob = new Blob([fileNode.content || ""], {
                    type: "text/plain;charset=utf-8",
                });
                const url = URL.createObjectURL(blob);
                const a = Utils.createElement("a", {
                    href: url,
                    download: fileName,
                });
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                return {
                    success: true,
                    output: `${Config.MESSAGES.EXPORTING_PREFIX}${fileName}${Config.MESSAGES.EXPORTING_SUFFIX}`,
                    messageType: Config.CSS_CLASSES.SUCCESS_MSG,
                };
            } catch (e) {
                return {
                    success: false,
                    error: `export: Failed to download '${fileName}': ${e.message}`,
                };
            }
        },
    };
    const exportDescription = "Exports a file to a local file.";
    const exportHelpText = "Usage: export [filename]\n\nExports the specified file to a local file.";
    CommandRegistry.register("export", exportCommandDefinition, exportDescription, exportHelpText);
})();