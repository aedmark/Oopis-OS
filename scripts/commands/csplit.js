// scripts/commands/csplit.js

window.CsplitCommand = class CsplitCommand extends Command {
    constructor() {
        super({
            commandName: "csplit",
            description: "Splits a file into sections determined by context lines.",
            helpText: `Usage: csplit [OPTION]... FILE PATTERN...
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
      %REGEX%   Skip to the line matching the regular expression, but do not create a file. (Not yet implemented)
      {N}       Repeat the previous pattern N times. (Not yet implemented)
      EXAMPLES
      csplit my_log.txt 100 /ERROR/
      Creates xx00 with lines 1-99, then creates xx01 with lines starting
      from the first line containing "ERROR" to the end of the file.`,
            completionType: "paths",
            flagDefinitions: [
                { name: "prefix", short: "-f", long: "--prefix", takesValue: true },
                { name: "keepFiles", short: "-k", long: "--keep-files" },
                { name: "digits", short: "-n", long: "--digits", takesValue: true },
                { name: "quiet", short: "-s", long: "--quiet", aliases: ["--silent"] },
                { name: "elideEmpty", short: "-z", long: "--elide-empty-files" },
            ],
            validations: {
                args: {
                    min: 2,
                },
                paths: [{
                    argIndex: 0,
                    options: {
                        expectedType: 'file',
                        permissions: ['read']
                    }
                }]
            },
        });
    }

    async coreLogic(context) {
        const { args, flags, currentUser, validatedPaths, dependencies } = context;
        const { FileSystemManager, UserManager, CommandExecutor, OutputManager, ErrorHandler } = dependencies;
        const fileNode = validatedPaths[0].node;
        const patterns = args.slice(1);

        const content = fileNode.content || "";
        const lines = content.split("\n");

        const prefix = flags.prefix || "xx";
        const numDigits = flags.digits ? parseInt(flags.digits, 10) : 2;

        if (isNaN(numDigits) || numDigits < 1) {
            return ErrorHandler.createError(
                `csplit: invalid number of digits: '${flags.digits}'`
            );
        }

        const segments = [];
        let lastSplitLine = 0;

        for (const pattern of patterns) {
            let splitLine = -1;

            if (pattern.startsWith("/")) {
                try {
                    const regexStr = pattern.slice(1, pattern.lastIndexOf("/"));
                    const regex = new RegExp(regexStr);
                    for (let j = lastSplitLine; j < lines.length; j++) {
                        if (regex.test(lines[j])) {
                            splitLine = j;
                            break;
                        }
                    }
                } catch (e) {
                    return ErrorHandler.createError(
                        `csplit: invalid regular expression: '${pattern}'`
                    );
                }
            } else {
                const lineNum = parseInt(pattern, 10);
                if (isNaN(lineNum) || lineNum <= 0 || lineNum > lines.length) {
                    return ErrorHandler.createError(
                        `csplit: '${pattern}': line number out of range`
                    );
                }
                splitLine = lineNum - 1;
            }

            if (splitLine === -1 || splitLine < lastSplitLine) {
                return ErrorHandler.createError(
                    `csplit: '${pattern}': pattern not found or out of order`
                );
            }

            segments.push(lines.slice(lastSplitLine, splitLine));
            lastSplitLine = splitLine;
        }

        segments.push(lines.slice(lastSplitLine));

        const createdFileNames = [];
        let anyChangeMade = false;

        for (let i = 0; i < segments.length; i++) {
            const segmentContent = segments[i].join("\n");

            if (!segmentContent && flags.elideEmpty) {
                continue;
            }

            const fileName = `${prefix}${String(i).padStart(numDigits, "0")}`;
            const saveResult = await FileSystemManager.createOrUpdateFile(
                FileSystemManager.getAbsolutePath(fileName),
                segmentContent,
                {
                    currentUser,
                    primaryGroup: UserManager.getPrimaryGroupForUser(currentUser),
                }
            );

            if (!saveResult.success) {
                if (!flags.keepFiles) {
                    for (const f of createdFileNames) {
                        await CommandExecutor.processSingleCommand(`rm -f ${f}`, {
                            isInteractive: false,
                        });
                    }
                }
                return ErrorHandler.createError(
                    `csplit: failed to write to ${fileName}: ${saveResult.error}`
                );
            }

            createdFileNames.push(fileName);
            anyChangeMade = true;

            if (!flags.quiet) {
                await OutputManager.appendToOutput(String(segmentContent.length));
            }
        }

        return ErrorHandler.createSuccess("", { stateModified: anyChangeMade });
    }
}

window.CommandRegistry.register(new CsplitCommand());
