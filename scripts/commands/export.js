// scripts/commands/export.js
(() => {
    "use strict";

    const exportCommandDefinition = {
        commandName: "export",
        completionType: "paths", // Preserved for tab completion
        argValidation: {
            exact: 1,
            error: "expects exactly one file path.",
        },
        coreLogic: async (context) => {
            const { args } = context;
            const pathArg = args[0];

            try {
                const pathValidation = FileSystemManager.validatePath(pathArg, {
                    expectedType: 'file',
                    permissions: ['read']
                });

                if (pathValidation.error) {
                    return { success: false, error: `export: ${pathValidation.error.replace(pathArg + ':', '').trim()}` };
                }

                const fileNode = pathValidation.node;
                const fileName = pathValidation.resolvedPath.substring(
                    pathValidation.resolvedPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1
                );

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
                };
            } catch (e) {
                return {
                    success: false,
                    error: `export: Failed to download file: ${e.message}`,
                };
            }
        },
    };

    const exportDescription = "Downloads a file from OopisOS to your local machine.";
    const exportHelpText = `Usage: export <file_path>

Download a file from OopisOS to your local machine.

DESCRIPTION
       The export command initiates a browser download for the file
       specified by <file_path>. This allows you to save files from
       the OopisOS virtual file system onto your actual computer's
       hard drive.

EXAMPLES
       export /home/Guest/documents/report.txt
              Triggers a download of 'report.txt' to your computer.`;

    CommandRegistry.register("export", exportCommandDefinition, exportDescription, exportHelpText);
})();