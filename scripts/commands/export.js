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
        /**
         * The core logic for the 'export' command.
         * It retrieves the content of the specified file (guaranteed to be readable by checks),
         * creates a Blob from its content, generates a temporary URL for the Blob,
         * and then programmatically triggers a download in the user's browser.
         * Finally, it revokes the temporary URL to free up resources.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {object[]} context.validatedPaths - An array containing information about the single validated file path.
         * @returns {Promise<object>} A promise that resolves to a command result object,
         * indicating whether the download was successfully initiated or if an error occurred.
         */
        coreLogic: async (context) => {
            const pathInfo = context.validatedPaths[0]; // Get the validated path info for the single argument.
            const fileNode = pathInfo.node; // The file system node object.
            // Extract the file name from the resolved path for the download.
            const fileName = pathInfo.resolvedPath.substring(
                pathInfo.resolvedPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1
            );

            try {
                // Create a Blob from the file's content. Default to empty string if content is null/undefined.
                const blob = new Blob([fileNode.content || ""], {
                    type: "text/plain;charset=utf-8",
                });
                // Create a temporary URL for the Blob.
                const url = URL.createObjectURL(blob);

                // Create a temporary anchor element to trigger the download.
                const a = Utils.createElement("a", {
                    href: url,
                    download: fileName, // Set the download attribute to specify the filename.
                });

                // Append the anchor to the body, click it, and then remove it.
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                // Revoke the Blob URL to free up memory.
                URL.revokeObjectURL(url);

                return {
                    success: true,
                    // Provide a user-friendly message about the export.
                    output: `${Config.MESSAGES.EXPORTING_PREFIX}${fileName}${Config.MESSAGES.EXPORTING_SUFFIX}`,
                    messageType: Config.CSS_CLASSES.SUCCESS_MSG,
                };
            } catch (e) {
                // Catch and report any errors during the download process.
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