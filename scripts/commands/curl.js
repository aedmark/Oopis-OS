/**
 * @file Defines the 'curl' command, a network utility for transferring data from or to a server.
 * It supports displaying fetched content to standard output or saving it to a file.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} curlCommandDefinition
     * @description The command definition for the 'curl' command.
     * This object specifies the command's name, supported flags, argument validation,
     * and the core logic for making HTTP requests.
     */
    const curlCommandDefinition = {
        commandName: "curl",
        flagDefinitions: [{
            name: "output",
            short: "-o",
            long: "--output",
            takesValue: true
        }, {
            name: "include",
            short: "-i",
            long: "--include",
        }, {
            name: "location",
            short: "-L",
            long: "--location",
        }, ],
        argValidation: {
            min: 1,
            error: "Usage: curl [options] <URL>"
        },
        /**
         * The core logic for the 'curl' command.
         * It performs a fetch request to the specified URL.
         * Depending on the flags, it can include HTTP headers in the output,
         * and save the content to a file instead of printing to the terminal.
         * It also includes basic error handling for network issues and CORS.
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
            let currentUrl = args[0];
            const maxRedirects = 10;

            try {
                for (let i = 0; i < maxRedirects; i++) {
                    const response = await fetch(currentUrl, { redirect: 'manual' });

                    if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
                        if (!flags.location) {
                            return {
                                success: false,
                                error: `Redirected to ${response.headers.get('location')}. Use -L to follow.`
                            };
                        }
                        currentUrl = new URL(response.headers.get('location'), currentUrl).href;
                        continue;
                    }

                    const content = await response.text();
                    let outputString = "";

                    if (flags.include) {
                        outputString += `HTTP/1.1 ${response.status} ${response.statusText}\n`;
                        response.headers.forEach((value, name) => {
                            outputString += `${name}: ${value}\n`;
                        });
                        outputString += '\n';
                    }

                    outputString += content;

                    if (flags.output) {
                        const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
                        if (!primaryGroup) {
                            return {
                                success: false,
                                error: "curl: critical - could not determine primary group for user."
                            };
                        }
                        const absPath = FileSystemManager.getAbsolutePath(flags.output, FileSystemManager.getCurrentPath());
                        const saveResult = await FileSystemManager.createOrUpdateFile(
                            absPath,
                            outputString, {
                                currentUser,
                                primaryGroup
                            }
                        );

                        if (!saveResult.success) {
                            return {
                                success: false,
                                error: `curl: ${saveResult.error}`
                            };
                        }
                        await FileSystemManager.save();
                        return {
                            success: true,
                            output: ""
                        };
                    } else {
                        return {
                            success: true,
                            output: outputString
                        };
                    }
                }

                return {
                    success: false,
                    error: 'Too many redirects.'
                };

            } catch (e) {
                let errorMsg = `curl: (7) Failed to connect to host. This is often a network issue or a CORS policy preventing access.`;
                if (e instanceof TypeError && e.message.includes('Failed to fetch')) {
                    errorMsg = `curl: (7) Couldn't connect to server. The server may be down, or a CORS policy is blocking the request from the browser.`
                } else if (e instanceof URIError) {
                    errorMsg = `curl: (3) URL using bad/illegal format or missing URL`;
                }
                return {
                    success: false,
                    error: errorMsg
                };
            }
        },
    };

    const curlDescription = "Transfer data from or to a server.";

    const curlHelpText = `Usage: curl [options] <URL>

Transfer data from or to a server.

DESCRIPTION
       curl is a tool to transfer data from or to a server. By default,
       it prints the fetched content to standard output.

       Note: Due to browser security restrictions, curl is subject to
       Cross-Origin Resource Sharing (CORS) policies and may not be able
       to fetch content from all URLs.

OPTIONS
       -o, --output <file>
              Write output to <file> instead of standard output.

       -i, --include
              Include protocol response headers in the output.

       -L, --location
              Follow redirects.

EXAMPLES
       curl https://api.github.com/zen
              Displays a random piece of GitHub zen wisdom.

       curl -o page.html https://example.com
              Downloads the content of example.com and saves it to a
              file named 'page.html'.`;

    CommandRegistry.register("curl", curlCommandDefinition, curlDescription, curlHelpText);
})();