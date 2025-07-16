// scripts/commands/wc.js
(() => {
    "use strict";

    const wcCommandDefinition = {
        commandName: "wc",
        isInputStream: true,
        completionType: "paths",
        flagDefinitions: [
            { name: "lines", short: "-l", long: "--lines" },
            { name: "words", short: "-w", long: "--words" },
            { name: "bytes", short: "-c", long: "--bytes" },
        ],
        coreLogic: async (context) => {
            const { flags, inputItems, inputError } = context;

            try {
                if (inputError) {
                    return { success: false, error: "wc: No readable input provided or permission denied." };
                }

                if (!inputItems || inputItems.length === 0) {
                    return { success: true, output: "" };
                }

                const showAll = !flags.lines && !flags.words && !flags.bytes;
                const showLines = showAll || flags.lines;
                const showWords = showAll || flags.words;
                const showBytes = showAll || flags.bytes;

                const formatOutput = (counts, name) => {
                    let line = " ";
                    if (showLines) line += String(counts.lines).padStart(7) + " ";
                    if (showWords) line += String(counts.words).padStart(7) + " ";
                    if (showBytes) line += String(counts.bytes).padStart(7) + " ";
                    if (name) line += name;
                    return line.trim();
                };

                const totalCounts = { lines: 0, words: 0, bytes: 0 };
                const outputLines = [];

                for (const item of inputItems) {
                    const content = item.content || "";
                    const lines = content.split('\\n');
                    const lineCount = (lines.length > 0 && lines[lines.length - 1] === '') ? lines.length - 1 : lines.length;

                    const counts = {
                        lines: lineCount,
                        words: content.trim() === '' ? 0 : content.trim().split(/\\s+/).length,
                        bytes: content.length
                    };

                    totalCounts.lines += counts.lines;
                    totalCounts.words += counts.words;
                    totalCounts.bytes += counts.bytes;

                    if (context.inputFileCount > 1 || (context.inputFileCount > 0 && item.sourceName !== 'stdin')) {
                        outputLines.push(formatOutput(counts, item.sourceName));
                    }
                }

                if (context.inputFileCount > 1) {
                    outputLines.push(formatOutput(totalCounts, 'total'));
                } else if (context.inputFileCount === 1 && inputItems[0].sourceName !== 'stdin') {
                    // No total line needed, already displayed the single file
                }
                else {
                    // This handles the case for single file input (no filename display) or stdin
                    outputLines.push(formatOutput(totalCounts));
                }

                return {
                    success: true,
                    output: outputLines.join('\\n'),
                };
            } catch (e) {
                return { success: false, error: `wc: An unexpected error occurred: ${e.message}` };
            }
        }
    };

    const wcDescription = "Counts lines, words, and bytes in files.";
    const wcHelpText = `Usage: wc [OPTION]... [FILE]...

Print newline, word, and byte counts for each FILE, and a total line if
more than one FILE is specified. With no FILE, or when FILE is -,
read standard input.

DESCRIPTION
       The wc utility displays the number of lines, words, and bytes
       contained in each input file or standard input.

OPTIONS
       -c, --bytes
              Print the byte counts.
       -l, --lines
              Print the newline counts.
       -w, --words
              Print the word counts.

       If no options are specified, all three counts are printed.

EXAMPLES
       wc /docs/api/best_practices.md
              Displays the line, word, and byte count for the file.

       ls | wc -l
              Counts the number of files and directories in the current
              directory by counting the lines from 'ls' output.`;

    CommandRegistry.register("wc", wcCommandDefinition, wcDescription, wcHelpText);
})();