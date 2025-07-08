(() => {
    "use strict";

    const tailCommandDefinition = {
        commandName: "tail",
        flagDefinitions: [
            { name: "lines", short: "-n", long: "--lines", takesValue: true },
            { name: "bytes", short: "-c", long: "--bytes", takesValue: true },
        ],
        coreLogic: async (context) => {
            const { args, flags } = context;

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
                const relevantLines = lines.at(-1) === '' ? lines.slice(0, -1) : lines;
                return relevantLines.slice(-lineCount).join('\n');
            };

            const outputParts = [];
            let fileCount = 0;

            for await (const item of Utils.generateInputContent(context)) {
                if (!item.success) {
                    outputParts.push(item.error);
                    continue;
                }

                if (args.length > 1) {
                    if (fileCount > 0) {
                        outputParts.push('');
                    }
                    outputParts.push(`==> ${item.sourceName} <==`);
                }

                outputParts.push(processContent(item.content));
                fileCount++;
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