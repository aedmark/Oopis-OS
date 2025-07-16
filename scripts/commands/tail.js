// scripts/commands/tail.js
(() => {
    "use strict";

    const tailCommandDefinition = {
        commandName: "tail",
        isInputStream: true,
        completionType: "paths", // Added for consistency and future-proofing.
        flagDefinitions: [
            { name: "lines", short: "-n", long: "--lines", takesValue: true },
            { name: "bytes", short: "-c", long: "--bytes", takesValue: true },
        ],
        coreLogic: async (context) => {
            const { flags, inputItems, inputError } = context;

            try {
                if (inputError) {
                    return { success: false, error: "tail: No readable input provided or permission denied." };
                }

                if (!inputItems || inputItems.length === 0) {
                    return { success: true, output: "" };
                }

                if (flags.lines && flags.bytes) {
                    return { success: false, error: "tail: cannot use both -n and -c" };
                }

                const input = inputItems.map(item => item.content).join('\\n');

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

                let output;
                if (byteCount !== null) {
                    output = input.substring(input.length - byteCount);
                } else {
                    const lines = input.split('\\n');
                    // Per standard 'tail' behavior, don't treat a final blank line as a line to be counted.
                    const relevantLines = lines.at(-1) === '' ? lines.slice(0, -1) : lines;
                    output = relevantLines.slice(-lineCount).join('\\n');
                }

                return { success: true, output: output };
            } catch (e) {
                return { success: false, error: `tail: An unexpected error occurred: ${e.message}` };
            }
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