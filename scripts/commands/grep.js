/**
 * @file Defines the 'grep' command, which searches for patterns within files or standard input.
 * It supports various flags for case-insensitivity, inverting matches, line numbers, and recursion.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} grepCommandDefinition
     * @description The command definition for the 'grep' command.
     * This object specifies the command's name, supported flags, and the core logic
     * for pattern matching in file contents or standard input.
     */
    const grepCommandDefinition = {
        commandName: "grep",
        flagDefinitions: [
            {
                name: "ignoreCase",
                short: "-i",
                long: "--ignore-case",
            },
            {
                name: "invertMatch",
                short: "-v",
                long: "--invert-match",
            },
            {
                name: "lineNumber",
                short: "-n",
                long: "--line-number",
            },
            {
                name: "count",
                short: "-c",
                long: "--count",
            },
            {
                name: "recursive",
                short: "-R",
            },
        ],
        /**
         * The core logic for the 'grep' command.
         * It takes a regular expression pattern and a list of files (or standard input).
         * It processes the content line by line, applying the pattern and various flags
         * to filter, count, or format the output. Supports recursive search for directories.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command,
         * where `args[0]` is the pattern and subsequent args are file paths.
         * @param {object} context.flags - An object containing the parsed flags.
         * @param {object} context.options - Execution options, including `stdinContent` for piped input.
         * @param {string} context.currentUser - The name of the current user.
         * @returns {Promise<object>} A promise that resolves to a command result object
         * with the matching lines or count.
         */
        coreLogic: async (context) => {
            const { args, flags, options, currentUser } = context;

            // Check if a pattern is missing when no stdin content is provided.
            if (args.length === 0 && options.stdinContent === null)
                return {
                    success: false,
                    error: "grep: missing pattern",
                };

            const patternStr = args[0]; // The first argument is the pattern.
            const filePathsArgs = args.slice(1); // Remaining arguments are file paths.
            let regex;

            // Attempt to create a RegExp object from the pattern string.
            try {
                regex = new RegExp(patternStr, flags.ignoreCase ? "i" : "");
            } catch (e) {
                return {
                    success: false,
                    error: `grep: invalid regular expression '${patternStr}': ${e.message}`,
                };
            }

            let outputLines = []; // Collects all output lines.
            let overallSuccess = true; // Tracks if the overall command execution was successful across all files.

            /**
             * Processes the content of a single file (or stdin content) for pattern matches.
             * @param {string} content - The text content to search within.
             * @param {string|null} filePathForDisplay - The path of the file (for display in output), or null for stdin.
             */
            const processContent = (content, filePathForDisplay) => {
                const lines = content.split("\n");
                let fileMatchCount = 0; // Counter for matches in the current file/content block.
                let currentFileLines = []; // Stores matching lines for the current file/content block.

                lines.forEach((line, index) => {
                    // Skip the last line if it's empty and the content ends with a newline, to avoid an extra blank line.
                    if (
                        index === lines.length - 1 &&
                        line === "" &&
                        content.endsWith("\n")
                    )
                        return;

                    const isMatch = regex.test(line); // Test the line against the regex.
                    // Determine effective match based on 'invertMatch' flag.
                    const effectiveMatch = flags.invertMatch ? !isMatch : isMatch;

                    if (effectiveMatch) {
                        fileMatchCount++;
                        if (!flags.count) { // If 'count' flag is not set, format and store the line.
                            let outputLine = "";
                            if (filePathForDisplay) outputLine += `${filePathForDisplay}:`; // Prefix with file path if available.
                            if (flags.lineNumber) outputLine += `${index + 1}:`; // Prefix with line number if set.
                            outputLine += line;
                            currentFileLines.push(outputLine);
                        }
                    }
                });

                // If 'count' flag is set, add the total match count. Otherwise, add collected lines.
                if (flags.count) {
                    let countOutput = "";
                    if (filePathForDisplay) countOutput += `${filePathForDisplay}:`;
                    countOutput += fileMatchCount;
                    outputLines.push(countOutput);
                } else {
                    outputLines.push(...currentFileLines);
                }
            };

            /**
             * Recursively searches for patterns within a directory and its subdirectories.
             * @async
             * @param {string} currentPath - The current absolute path being searched.
             * @param {string} displayPathArg - The path to display in error messages (can be relative to initial call).
             */
            async function searchRecursively(currentPath, displayPathArg) {
                const pathValidation = FileSystemManager.validatePath(
                    "grep",
                    currentPath
                );
                if (pathValidation.error) {
                    await OutputManager.appendToOutput(pathValidation.error, {
                        typeClass: Config.CSS_CLASSES.ERROR_MSG,
                    });
                    overallSuccess = false;
                    return;
                }
                const node = pathValidation.node;

                // Check read permission on the current node.
                if (!FileSystemManager.hasPermission(node, currentUser, "read")) {
                    await OutputManager.appendToOutput(
                        `grep: ${displayPathArg}${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`,
                        {
                            typeClass: Config.CSS_CLASSES.ERROR_MSG,
                        }
                    );
                    overallSuccess = false;
                    return;
                }

                if (node.type === Config.FILESYSTEM.DEFAULT_FILE_TYPE) {
                    // If it's a file, process its content.
                    processContent(node.content || "", currentPath);
                } else if (node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
                    // If it's a directory:
                    if (!flags.recursive) {
                        // If recursive flag is not set, report it as a directory and skip.
                        await OutputManager.appendToOutput(
                            `grep: ${displayPathArg}: Is a directory`,
                            {
                                typeClass: Config.CSS_CLASSES.ERROR_MSG,
                            }
                        );
                        overallSuccess = false;
                        return;
                    }
                    // If recursive, iterate through children and call recursively for each.
                    for (const childName of Object.keys(node.children || {})) {
                        await searchRecursively(
                            FileSystemManager.getAbsolutePath(childName, currentPath),
                            FileSystemManager.getAbsolutePath(childName, currentPath) // Display full path for recursive calls
                        );
                    }
                }
            }

            // Determine input source: file paths or stdin.
            if (filePathsArgs.length > 0) { // If file paths are provided.
                for (const pathArg of filePathsArgs) {
                    if (flags.recursive) {
                        // If recursive, start recursive search from each path.
                        await searchRecursively(
                            FileSystemManager.getAbsolutePath(
                                pathArg,
                                FileSystemManager.getCurrentPath() // Resolve path relative to current directory.
                            ),
                            pathArg // Use original arg for display.
                        );
                    } else {
                        // If not recursive, validate and process each file directly.
                        const pathValidation = FileSystemManager.validatePath(
                            "grep",
                            pathArg,
                            {
                                expectedType: Config.FILESYSTEM.DEFAULT_FILE_TYPE,
                            }
                        );
                        if (pathValidation.error) {
                            await OutputManager.appendToOutput(pathValidation.error, {
                                typeClass: Config.CSS_CLASSES.ERROR_MSG,
                            });
                            overallSuccess = false;
                            continue;
                        }
                        if (
                            !FileSystemManager.hasPermission(
                                pathValidation.node,
                                currentUser,
                                "read"
                            )
                        ) {
                            await OutputManager.appendToOutput(
                                `grep: ${pathArg}${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`,
                                {
                                    typeClass: Config.CSS_CLASSES.ERROR_MSG,
                                }
                            );
                            overallSuccess = false;
                            continue;
                        }
                        processContent(pathValidation.node.content || "", pathArg);
                    }
                }
            } else if (options.stdinContent !== null) { // If stdin content is provided (via pipe).
                processContent(options.stdinContent, null); // Process stdin content without a file path prefix.
            } else {
                // Should not happen due to initial check, but as a fallback.
                return {
                    success: false,
                    error: "grep: No input files or stdin provided after pattern.",
                };
            }

            return {
                success: overallSuccess,
                output: outputLines.join("\n"),
            };
        },
    };

    const grepDescription = "Searches for a pattern in files or standard input.";

    const grepHelpText = `Usage: grep [OPTION]... <PATTERN> [FILE]...

Search for PATTERN in each FILE or standard input.

DESCRIPTION
       The grep utility searches any given input files, selecting lines
       that match one or more patterns. The pattern is specified by the
       <PATTERN> option and can be a string or a regular expression.

       By default, grep prints the matching lines. If no files are
       specified, it reads from standard input, which is useful when
       combined with other commands in a pipeline.

OPTIONS
       -i, --ignore-case
              Perform case-insensitive matching.

       -v, --invert-match
              Select non-matching lines.

       -n, --line-number
              Prefix each line of output with its line number within
              its input file.

       -c, --count
              Suppress normal output; instead print a count of matching
              lines for each input file.
              
       -R
              Recursively search subdirectories listed.

EXAMPLES
       grep "error" log.txt
              Finds all lines containing "error" in log.txt.

       history | grep -i "git"
              Searches your command history for the word "git",
              ignoring case.

       grep -v "success" results.txt
              Displays all lines that DO NOT contain "success".`;

    CommandRegistry.register("grep", grepCommandDefinition, grepDescription, grepHelpText);
})();