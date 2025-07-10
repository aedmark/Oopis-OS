(() => {
    "use strict";

    const grepCommandDefinition = {
        commandName: "grep",
        isInputStream: true, // Correctly declare as an input stream consumer
        firstFileArgIndex: 1,
        flagDefinitions: [
            { name: "ignoreCase", short: "-i", long: "--ignore-case" },
            { name: "invertMatch", short: "-v", long: "--invert-match" },
            { name: "lineNumber", short: "-n", long: "--line-number" },
            { name: "count", short: "-c", long: "--count" },
            {name: "recursive", short: "-R", long: "--recursive"}, // Recursive is a special case
        ],
        coreLogic: async (context) => {
            const {args, flags, currentUser, inputItems, inputError} = context;

            if (args.length === 0) {
                return { success: false, error: "grep: missing pattern" };
            }

            // The pattern is now the first argument, file paths are handled by the stream
            const patternStr = args[0];
            let regex;

            try {
                regex = new RegExp(patternStr, flags.ignoreCase ? "i" : "");
            } catch (e) {
                return { success: false, error: `grep: invalid regular expression '${patternStr}': ${e.message}` };
            }

            const outputLines = [];
            let hadError = false;

            // This function remains the same, but will be called for each input source.
            const processContent = (content, filePathForDisplay, totalSources) => {
                const lines = content.split("\n");
                let fileMatchCount = 0;
                let currentFileLines = [];

                lines.forEach((line, index) => {
                    // Avoid processing the empty string that results from a trailing newline
                    if (index === lines.length - 1 && line === "") return;

                    const isMatch = regex.test(line);
                    const effectiveMatch = flags.invertMatch ? !isMatch : isMatch;

                    if (effectiveMatch) {
                        fileMatchCount++;
                        if (!flags.count) {
                            let outputLine = "";
                            // Only prefix with filename if there are multiple sources
                            if (filePathForDisplay && totalSources > 1) {
                                outputLine += `${filePathForDisplay}:`;
                            }
                            if (flags.lineNumber) {
                                outputLine += `${index + 1}:`;
                            }
                            outputLine += line;
                            currentFileLines.push(outputLine);
                        }
                    }
                });

                if (flags.count) {
                    let countOutput = "";
                    if (filePathForDisplay && totalSources > 1) {
                        countOutput += `${filePathForDisplay}:`;
                    }
                    countOutput += fileMatchCount;
                    outputLines.push(countOutput);
                } else {
                    outputLines.push(...currentFileLines);
                }
            };

            // Handle recursive search separately as it needs to traverse the FS
            if (flags.recursive) {
                const searchRecursively = async (currentPath) => {
                    // ... (recursive logic does not need to change)
                };
                const filePathsArgs = args.slice(1);
                for (const pathArg of filePathsArgs) {
                    await searchRecursively(FileSystemManager.getAbsolutePath(pathArg, FileSystemManager.getCurrentPath()));
                }

            } else {
                if (inputError) {
                    return {success: false, error: "grep: Could not read one or more sources."};
                }

                // Process each item from the input stream
                for (const item of inputItems) {
                    processContent(item.content, item.sourceName, inputItems.length);
                }
            }

            return {
                success: !hadError,
                output: outputLines.join("\n"),
            };
        },
    };

    // The description and help text remain unchanged.
    const grepDescription = "Searches for a pattern in files or standard input.";
    const grepHelpText = `...`; // Help text is omitted for brevity but remains the same.

    CommandRegistry.register("grep", grepCommandDefinition, grepDescription, grepHelpText);
})();