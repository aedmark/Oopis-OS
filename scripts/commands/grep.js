// scripts/commands/grep.js

(() => {
    "use strict";
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
        coreLogic: async (context) => {
            const { args, flags, options, currentUser } = context;
            if (args.length === 0 && options.stdinContent === null)
                return {
                    success: false,
                    error: "grep: missing pattern",
                };
            const patternStr = args[0];
            const filePathsArgs = args.slice(1);
            let regex;
            try {
                regex = new RegExp(patternStr, flags.ignoreCase ? "i" : "");
            } catch (e) {
                return {
                    success: false,
                    error: `grep: invalid regular expression '${patternStr}': ${e.message}`,
                };
            }
            let outputLines = [];
            let overallSuccess = true;
            const processContent = (content, filePathForDisplay) => {
                const lines = content.split("\n");
                let fileMatchCount = 0;
                let currentFileLines = [];
                lines.forEach((line, index) => {
                    if (
                        index === lines.length - 1 &&
                        line === "" &&
                        content.endsWith("\n")
                    )
                        return;
                    const isMatch = regex.test(line);
                    const effectiveMatch = flags.invertMatch ? !isMatch : isMatch;
                    if (effectiveMatch) {
                        fileMatchCount++;
                        if (!flags.count) {
                            let outputLine = "";
                            if (filePathForDisplay) outputLine += `${filePathForDisplay}:`;
                            if (flags.lineNumber) outputLine += `${index + 1}:`;
                            outputLine += line;
                            currentFileLines.push(outputLine);
                        }
                    }
                });
                if (flags.count) {
                    let countOutput = "";
                    if (filePathForDisplay) countOutput += `${filePathForDisplay}:`;
                    countOutput += fileMatchCount;
                    outputLines.push(countOutput);
                } else {
                    outputLines.push(...currentFileLines);
                }
            };
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
                    processContent(node.content || "", currentPath);
                } else if (node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
                    if (!flags.recursive) {
                        await OutputManager.appendToOutput(
                            `grep: ${displayPathArg}: Is a directory`,
                            {
                                typeClass: Config.CSS_CLASSES.ERROR_MSG,
                            }
                        );
                        overallSuccess = false;
                        return;
                    }
                    for (const childName of Object.keys(node.children || {})) {
                        await searchRecursively(
                            FileSystemManager.getAbsolutePath(childName, currentPath),
                            FileSystemManager.getAbsolutePath(childName, currentPath)
                        );
                    }
                }
            }
            if (filePathsArgs.length > 0) {
                for (const pathArg of filePathsArgs) {
                    if (flags.recursive) {
                        await searchRecursively(
                            FileSystemManager.getAbsolutePath(
                                pathArg,
                                FileSystemManager.getCurrentPath()
                            ),
                            pathArg
                        );
                    } else {
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
            } else if (options.stdinContent !== null) {
                processContent(options.stdinContent, null);
            } else {
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