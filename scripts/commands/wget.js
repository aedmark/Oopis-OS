// scripts/commands/wget.js

(() => {
    "use strict";
    const wgetCommandDefinition = {
        flagDefinitions: [{
            name: "outputFile",
            short: "-O",
            takesValue: true,
        }, ],
        argValidation: {
            min: 1,
            error: "Usage: wget [-O <file>] <URL>"
        },
        coreLogic: async (context) => {
            const {
                args,
                flags,
                currentUser
            } = context;
            const url = args[0];
            let outputFileName = flags.outputFile;

            if (!outputFileName) {
                try {
                    const urlPath = new URL(url).pathname;
                    const segments = urlPath.split('/');
                    outputFileName = segments.pop() || "index.html";
                } catch (e) {
                    return {
                        success: false,
                        error: `wget: Invalid URL '${url}'`
                    };
                }
            }

            const pathValidation = FileSystemManager.validatePath("wget", outputFileName, {
                allowMissing: true,
                disallowRoot: true
            });
            if (pathValidation.error) return {
                success: false,
                error: pathValidation.error
            };

            await OutputManager.appendToOutput(`--OopisOS WGET--\nResolving ${url}...`);

            try {
                const response = await fetch(url);
                await OutputManager.appendToOutput(`Connecting to ${new URL(url).hostname}... connected.`);
                await OutputManager.appendToOutput(`HTTP request sent, awaiting response... ${response.status} ${response.statusText}`);

                if (!response.ok) {
                    return {
                        success: false,
                        error: `wget: Server responded with status ${response.status} ${response.statusText}`
                    };
                }

                const contentLength = response.headers.get('content-length');
                const sizeStr = contentLength ? Utils.formatBytes(parseInt(contentLength, 10)) : 'unknown size';
                await OutputManager.appendToOutput(`Length: ${sizeStr}`);

                const content = await response.text();
                const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
                if (!primaryGroup) {
                    return {
                        success: false,
                        error: "wget: critical - could not determine primary group for user."
                    };
                }

                const saveResult = await FileSystemManager.createOrUpdateFile(
                    pathValidation.resolvedPath,
                    content, {
                        currentUser,
                        primaryGroup
                    }
                );

                if (!saveResult.success) {
                    return {
                        success: false,
                        error: `wget: ${saveResult.error}`
                    };
                }

                await OutputManager.appendToOutput(`Saving to: ‘${outputFileName}’`);
                await FileSystemManager.save();
                return {
                    success: true,
                    output: `‘${outputFileName}’ saved [${content.length} bytes]`,
                    messageType: Config.CSS_CLASSES.SUCCESS_MSG
                };

            } catch (e) {
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
    const wgetDescription = "Downloads a file from a URL.";
    const wgetHelpText = "Usage: wget [-O <file>] <URL>\n\nDownloads a file from the specified URL.";
    CommandRegistry.register("wget", wgetCommandDefinition, wgetDescription, wgetHelpText);
})();