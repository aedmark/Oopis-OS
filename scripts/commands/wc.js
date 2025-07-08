(() => {
    "use strict";

    const wcCommandDefinition = {
        commandName: "wc",
        flagDefinitions: [
            { name: "lines", short: "-l", long: "--lines" },
            { name: "words", short: "-w", long: "--words" },
            { name: "bytes", short: "-c", long: "--bytes" },
        ],
        coreLogic: async (context) => {
            const { args, flags } = context;

            const showAll = !flags.lines && !flags.words && !flags.bytes;
            const showLines = showAll || flags.lines;
            const showWords = showAll || flags.words;
            const showBytes = showAll || flags.bytes;

            const totals = { lines: 0, words: 0, bytes: 0 };
            const outputLines = [];
            let hadError = false;
            let fileCount = 0;

            const getCounts = (content) => {
                const bytes = content.length;
                const lines = (content.match(/\n/g) || []).length;
                const words = content.trim() === '' ? 0 : content.trim().split(/\s+/).length;
                return { lines, words, bytes };
            };

            const formatOutput = (counts, name) => {
                let line = " ";
                if (showLines) line += String(counts.lines).padStart(7) + " ";
                if (showWords) line += String(counts.words).padStart(7) + " ";
                if (showBytes) line += String(counts.bytes).padStart(7) + " ";
                if (name) line += name;
                return line;
            };

            for await (const item of Utils.generateInputContent(context)) {
                if (!item.success) {
                    outputLines.push(item.error);
                    hadError = true;
                    continue;
                }

                const counts = getCounts(item.content);
                outputLines.push(formatOutput(counts, item.sourceName === 'stdin' ? '' : item.sourceName));

                totals.lines += counts.lines;
                totals.words += counts.words;
                totals.bytes += counts.bytes;
                fileCount++;
            }

            if (fileCount > 1) {
                outputLines.push(formatOutput(totals, "total"));
            }

            return {
                success: !hadError,
                output: outputLines.join('\n'),
                error: hadError ? "One or more files could not be processed." : null
            };
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