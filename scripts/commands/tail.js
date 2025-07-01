/**
 * @file Defines the 'tail' command, which outputs the last part of files.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    const tailCommandDefinition = {
        commandName: "tail",
        flagDefinitions: [
            { name: "lines", short: "-n", long: "--lines", takesValue: true },
            { name: "bytes", short: "-c", long: "--bytes", takesValue: true },
        ],
        // argValidation is handled inside coreLogic due to multiple input modes.
        coreLogic: async (context) => {
            const { args, flags, options, currentUser } = context;

            if (flags.lines && flags.bytes) {
                return { success: false, error: "tail: cannot use both -n and -c" };
            }

            let lineCount = 10;
            if (flags.lines) {
                const linesResult = Utils.parseNumericArg(flags.lines, { allowFloat: false, allowNegative: false });
                if (linesResult.error) {
                    return { success: false, error: `tail: invalid number of lines: '${flags.lines}'` };
                }
                lineCount = linesResult.value;
            }

            let byteCount = null;
            if (flags.bytes) {
                const bytesResult = Utils.parseNumericArg(flags.bytes, { allowFloat: false, allowNegative: false });
                if (bytesResult.error) {
                    return { success: false, error: `tail: invalid number of bytes: '${flags.bytes}'` };
                }
                byteCount = bytesResult.value;
            }

            const processContent = (content) => {
                if (byteCount !== null) {
                    return content.substring(content.length - byteCount);
                }
                const lines = content.split('\n');
                // If the last line is empty (due to a trailing newline), ignore it for slicing purposes
                const relevantLines = lines.at(-1) === '' ? lines.slice(0, -1) : lines;
                return relevantLines.slice(-lineCount).join('\n');
            };

            // Handle standard input
            if (args.length === 0) {
                if (options.stdinContent !== null) {
                    return { success: true, output: processContent(options.stdinContent) };
                }
                return { success: true, output: "" }; // No files and no stdin
            }

            // Handle file inputs
            const outputParts = [];
            for (let i = 0; i < args.length; i++) {
                const pathArg = args[i];
                const pathValidation = FileSystemManager.validatePath("tail", pathArg, { expectedType: 'file' });

                if (pathValidation.error) {
                    outputParts.push(pathValidation.error);
                    continue;
                }

                if (!FileSystemManager.hasPermission(pathValidation.node, currentUser, "read")) {
                    outputParts.push(`tail: cannot open '${pathArg}' for reading: Permission denied`);
                    continue;
                }

                if (args.length > 1) {
                    outputParts.push(`${i > 0 ? '\n' : ''}==> ${pathArg} <==`);
                }

                const content = pathValidation.node.content || "";
                outputParts.push(processContent(content));
            }

            return { success: true, output: outputParts.join('\n') };
        },
    };

    const tailDescription = "Outputs the last part of files.";

    const tailHelpText = `Usage: tail [OPTION]... [FILE]...

Print the last 10 lines of each FILE to standard output.
With more than one FILE, precede each with a header giving the file name.

DESCRIPTION
       The tail command displays the end of a text file. It is useful
       for quickly checking the most recent entries in log files.

OPTIONS
       -n, --lines=COUNT
              Print the last COUNT lines instead of the last 10.
       -c, --bytes=COUNT
              Print the last COUNT bytes of each file.

EXAMPLES
       tail /var/log/sudo.log
              Displays the last 10 lines of the sudo log file.

       tail -n 5 README.md
              Displays the last 5 lines of the README.md file.

       ls | tail -n 3
              Displays the last 3 files or directories in the current location.`;

    CommandRegistry.register("tail", tailCommandDefinition, tailDescription, tailHelpText);
})();