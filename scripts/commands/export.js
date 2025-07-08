/**
 * @file Defines the 'export' command, which enables downloading a file from the OopisOS virtual
 * file system to the user's local machine via the browser's download mechanism.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} exportCommandDefinition
     * @description The command definition for the 'export' command.
     * This object specifies the command's name, argument validation (expecting one file path),
     * path validation (ensuring it's a file), required read permissions, and the core logic
     * for initiating the file download.
     */
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