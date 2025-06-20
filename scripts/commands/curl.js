// scripts/commands/curl.js

(() => {
    "use strict";
    const curlCommandDefinition = {
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
        coreLogic: async (context) => {
            const {
                args,
                flags,
                currentUser
            } = context;
            const url = args[0];

            try {
                const response = await fetch(url);
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
              (Not yet implemented) Follow redirects.

EXAMPLES
       curl https://api.github.com/zen
              Displays a random piece of GitHub zen wisdom.

       curl -o page.html https://example.com
              Downloads the content of example.com and saves it to a
              file named 'page.html'.`;

    CommandRegistry.register("curl", curlCommandDefinition, curlDescription, curlHelpText);
})();