/**
 * @file Defines the 'csplit' command, a utility to split a file into sections determined by context lines.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} csplitCommandDefinition
     * @description The command definition for the 'csplit' command.
     */
    const csplitCommandDefinition = {
        commandName: "csplit",
        flagDefinitions: [
            { name: "prefix", short: "-f", long: "--prefix", takesValue: true },
            { name: "keepFiles", short: "-k", long: "--keep-files" },
            { name: "digits", short: "-n", long: "--digits", takesValue: true },
            { name: "quiet", short: "-s", long: "--quiet", aliases: ["--silent"] },
            { name: "elideEmpty", short: "-z", long: "--elide-empty-files" },
        ],
        argValidation: {
            min: 2, // Requires at least a file and one pattern
        },
        pathValidation: [
            {
                argIndex: 0,
                options: { expectedType: 'file' }
            }
        ],
        permissionChecks: [
            {
                pathArgIndex: 0,
                permissions: ["read"]
            }
        ],
        coreLogic: async (context) => {
            const { args, flags, currentUser, validatedPaths } = context;
            const fileNode = validatedPaths[0].node;
            const content = fileNode.content || "";
            const lines = content.split('\n');

            const patterns = args.slice(1);
            const prefix = flags.prefix || 'xx';
            const numDigits = flags.digits ? parseInt(flags.digits, 10) : 2;

            if (isNaN(numDigits) || numDigits < 1) {
                return { success: false, error: `csplit: invalid number of digits: '${flags.digits}'` };
            }

            // Phase 1: Planning Stage (Calculate Segments)
            const segments = [];
            let lastSplitLine = 0;

            for (const pattern of patterns) {
                let splitLine = -1;

                if (pattern.startsWith('/')) {
                    try {
                        const regexStr = pattern.slice(1, pattern.lastIndexOf('/'));
                        const regex = new RegExp(regexStr);
                        for (let j = lastSplitLine; j < lines.length; j++) {
                            if (regex.test(lines[j])) {
                                splitLine = j;
                                break;
                            }
                        }
                    } catch (e) {
                        return { success: false, error: `csplit: invalid regular expression: '${pattern}'` };
                    }
                } else {
                    const lineNum = parseInt(pattern, 10);
                    if (isNaN(lineNum) || lineNum <= 0 || lineNum > lines.length) {
                        return { success: false, error: `csplit: '${pattern}': line number out of range` };
                    }
                    splitLine = lineNum - 1;
                }

                if (splitLine === -1 || splitLine < lastSplitLine) {
                    return { success: false, error: `csplit: '${pattern}': pattern not found or out of order` };
                }

                segments.push(lines.slice(lastSplitLine, splitLine));
                lastSplitLine = splitLine;
            }

            segments.push(lines.slice(lastSplitLine));

            // Phase 2: Execution Stage (Write Files)
            const createdFileNames = [];
            let anyChangeMade = false;

            for (let i = 0; i < segments.length; i++) {
                const segmentContent = segments[i].join('\n');

                if (!segmentContent && flags.elideEmpty) {
                    continue;
                }

                const fileName = `${prefix}${String(i).padStart(numDigits, '0')}`;
                const saveResult = await FileSystemManager.createOrUpdateFile(
                    FileSystemManager.getAbsolutePath(fileName),
                    segmentContent,
                    { currentUser, primaryGroup: UserManager.getPrimaryGroupForUser(currentUser) }
                );

                if (!saveResult.success) {
                    // If a write fails, clean up previously created files unless -k is specified.
                    if (!flags.keepFiles) {
                        for (const f of createdFileNames) {
                            await CommandExecutor.processSingleCommand(`rm -f ${f}`, { isInteractive: false });
                        }
                        await FileSystemManager.save(); // Persist the deletions
                    }
                    return { success: false, error: `csplit: failed to write to ${fileName}: ${saveResult.error}` };
                }

                createdFileNames.push(fileName);
                anyChangeMade = true;

                if (!flags.quiet) {
                    await OutputManager.appendToOutput(String(segmentContent.length));
                }
            }

            if (anyChangeMade) {
                await FileSystemManager.save();
            }

            return { success: true, output: "" };
        }
    };

    const csplitDescription = "Splits a file into sections determined by context lines.";
    const csplitHelpText = `Usage: csplit [OPTION]... FILE PATTERN...

Output pieces of FILE separated by PATTERN(s) to files 'xx00', 'xx01', etc.

DESCRIPTION
       csplit splits a file into multiple smaller files based on context lines.
       The context can be a line number or a regular expression.

OPTIONS
       -f, --prefix=PREFIX    use PREFIX instead of 'xx'
       -k, --keep-files       do not remove output files on errors
       -n, --digits=DIGITS    use specified number of digits instead of 2
       -s, --quiet, --silent  do not print counts of output file sizes
       -z, --elide-empty-files remove empty output files

PATTERNS
       N         Split at line number N.
       /REGEX/   Split before the line matching the regular expression.
       %REGEX%   Skip to the line matching the regular expression, but do not create a file.
       {N}       Repeat the previous pattern N times.
       
EXAMPLES
       csplit my_log.txt 100 /ERROR/ {5}
              Creates xx00 with lines 1-99, then creates up to 5 files,
              each starting with a line containing "ERROR".

       csplit -f chapter- book.txt %^CHAPTER% {*}
              Splits book.txt into chapter-00, chapter-01, etc.,
              skipping the "CHAPTER" line itself.`;

    CommandRegistry.register("csplit", csplitCommandDefinition, csplitDescription, csplitHelpText);
})();