// Corrected File: aedmark/oopis-os-dev/Oopis-OS-DEV-d433f2298e4704d53000b05f98b059a46e2196eb/scripts/commands/wc.js
(() => {
    "use strict";

    const wcCommandDefinition = {
        commandName: "wc",
        isInputStream: true, // ADDED
        flagDefinitions: [
            { name: "lines", short: "-l", long: "--lines" },
            { name: "words", short: "-w", long: "--words" },
            { name: "bytes", short: "-c", long: "--bytes" },
        ],
        coreLogic: async (context) => {
            //  Destructures correct context properties.
            const {args, flags, inputItems, inputError} = context;

            if (inputError) {
                return {success: false, error: "wc: No readable input provided or permission denied."};
            }

            // Processes the inputItems array.
            const input = inputItems.map(item => item.content).join('\\n');

            if (input === null || input === undefined) {
                return {success: false, error: "wc: No readable input provided."};
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
                return line;
            };

            const lineCount = input ? (input.match(/\\n/g) || []).length : 0;
            if (input && !input.endsWith('\\n') && input.length > 0) {
                // lineCount++; // This behavior is debatable, but common. Let's stick to newline counting.
            }

            const counts = {
                lines: lineCount,
                words: input.trim() === '' ? 0 : input.trim().split(/\\s+/).length,
                bytes: input.length
            };

            // Simplified to show a single total count, filename display is omitted for piped input.
            const fileName = inputItems.length === 1 && inputItems[0].sourceName !== 'stdin' ? inputItems[0].sourceName : '';
            const output = formatOutput(counts, fileName);

            return {
                success: true,
                output: output,
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