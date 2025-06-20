/**
 * @file Defines the 'wget' command, a non-interactive network downloader for OopisOS.
 * It allows downloading files from specified URLs to the virtual file system.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} wgetCommandDefinition
     * @description The command definition for the 'wget' command.
     * This object specifies the command's name, supported flags (e.g., -O for output file),
     * argument validation (at least one URL), and the core logic for fetching and saving files.
     */
    const wgetCommandDefinition = {
        commandName: "wget",
        flagDefinitions: [{
            name: "outputFile",
            short: "-O", // Note: This is an uppercase 'O' as per standard `wget`.
            takesValue: true,
        }, ],
        argValidation: {
            min: 1, // Requires at least one argument: the URL to download.
            error: "Usage: wget [-O <file>] <URL>"
        },
        /**
         * The core logic for the 'wget' command.
         * It attempts to download content from a given URL.
         * It automatically determines a filename from the URL or uses the one specified with -O.
         * It displays progress messages and handles saving the downloaded content to the VFS,
         * including permission checks and error handling for network issues or CORS restrictions.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command, expecting a URL.
         * @param {object} context.flags - An object containing the parsed flags.
         * @param {string} context.currentUser - The name of the current user.
         * @returns {Promise<object>} A promise that resolves to a command result object.
         */
        coreLogic: async (context) => {
            const {
                args,
                flags,
                currentUser
            } = context;
            const url = args[0]; // The first argument is the URL.
            let outputFileName = flags.outputFile; // The filename specified by -O, if any.

            // If no output filename is specified by the flag, derive it from the URL.
            if (!outputFileName) {
                try {
                    const urlObj = new URL(url); // Parse the URL.
                    const segments = urlObj.pathname.split('/');
                    // Take the last segment as the filename. If empty (e.g., URL ends with /), default to "index.html".
                    outputFileName = segments.pop() || "index.html";
                } catch (e) {
                    return {
                        success: false,
                        error: `wget: Invalid URL '${url}'` // Report invalid URL format.
                    };
                }
            }

            // Validate the resolved output filename/path. Allow missing (it will be created), disallow root as direct target.
            const pathValidation = FileSystemManager.validatePath("wget", outputFileName, {
                allowMissing: true,
                disallowRoot: true
            });
            if (pathValidation.error) return {
                success: false,
                error: pathValidation.error
            };

            // Display initial connection messages to the terminal.
            await OutputManager.appendToOutput(`--OopisOS WGET--\nResolving ${url}...`);

            try {
                // Perform the actual network request using the Fetch API.
                const response = await fetch(url);
                await OutputManager.appendToOutput(`Connecting to ${new URL(url).hostname}... connected.`);
                await OutputManager.appendToOutput(`HTTP request sent, awaiting response... ${response.status} ${response.statusText}`);

                // Check for non-successful HTTP responses.
                if (!response.ok) {
                    return {
                        success: false,
                        error: `wget: Server responded with status ${response.status} ${response.statusText}`
                    };
                }

                // Get content length for display.
                const contentLength = response.headers.get('content-length');
                const sizeStr = contentLength ? Utils.formatBytes(parseInt(contentLength, 10)) : 'unknown size';
                await OutputManager.appendToOutput(`Length: ${sizeStr}`);

                // Read the response body as text.
                const content = await response.text();

                // Get the primary group for the current user, needed for new file ownership.
                const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
                if (!primaryGroup) {
                    return {
                        success: false,
                        error: "wget: critical - could not determine primary group for user."
                    };
                }

                // Create or update the file in the virtual file system with the downloaded content.
                const saveResult = await FileSystemManager.createOrUpdateFile(
                    pathValidation.resolvedPath,
                    content, {
                        currentUser,
                        primaryGroup
                    }
                );

                // Check if saving the file to the VFS was successful.
                if (!saveResult.success) {
                    return {
                        success: false,
                        error: `wget: ${saveResult.error}`
                    };
                }

                // Persist the file system changes to IndexedDB.
                await OutputManager.appendToOutput(`Saving to: ‘${outputFileName}’`);
                await FileSystemManager.save();

                return {
                    success: true,
                    output: `‘${outputFileName}’ saved [${content.length} bytes]`,
                    messageType: Config.CSS_CLASSES.SUCCESS_MSG
                };

            } catch (e) {
                // Catch and report network-related or other fetch errors.
                let errorMsg = `wget: An error occurred. This is often due to a network issue or a CORS policy preventing access.`;
                if (e instanceof TypeError && e.message.includes('Failed to fetch')) {
                    errorMsg = `wget: Network request failed. The server may be down, or a CORS policy is blocking the request from the browser.`;
                }
                return {
                    success: false,
                    error: errorMsg
                };
            }
        },
    };

    /**
     * @const {string} wgetDescription
     * @description A brief, one-line description of the 'wget' command for the 'help' command.
     */
    const wgetDescription = "The non-interactive network downloader.";

    /**
     * @const {string} wgetHelpText
     * @description The detailed help text for the 'wget' command, used by 'man'.
     */
    const wgetHelpText = `Usage: wget [-O <file>] <URL>

The non-interactive network downloader.

DESCRIPTION
       wget is a utility for downloading files from the Web. It will
       automatically determine the filename from the URL unless a
       different name is specified with the -O option.

       Note: Due to browser security restrictions, wget is subject to
       Cross-Origin Resource Sharing (CORS) policies and may not be able
       to fetch content from all URLs.

OPTIONS
       -O <file>
              Write documents to <file>.

EXAMPLES
       wget https://raw.githubusercontent.com/aedmark/Oopis-OS/master/LICENSE.txt
              Downloads the license file and saves it as 'LICENSE.txt'
              in the current directory.`;

    // Register the command with the system
    CommandRegistry.register("wget", wgetCommandDefinition, wgetDescription, wgetHelpText);
})();