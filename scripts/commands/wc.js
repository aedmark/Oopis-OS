// scripts/commands/wc.js

window.WcCommand = class WcCommand extends Command {
    constructor() {
        super({
            commandName: "wc",
            description: "Counts lines, words, and bytes in files.",
            helpText: `Usage: wc [OPTION]... [FILE]...
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
      directory by counting the lines from 'ls' output.`,
            isInputStream: true,
            completionType: "paths",
            flagDefinitions: [
                { name: "lines", short: "-l", long: "--lines" },
                { name: "words", short: "-w", long: "--words" },
                { name: "bytes", short: "-c", long: "--bytes" },
            ],
        });
    }

    async coreLogic(context) {
        const { flags, inputItems, inputError, dependencies } = context;
        const { ErrorHandler } = dependencies;

        if (inputError) {
            return ErrorHandler.createError(
                "wc: No readable input provided or permission denied."
            );
        }

        if (!inputItems || inputItems.length === 0) {
            return ErrorHandler.createSuccess("");
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
            const lines = content.split("\n");
            const lineCount =
                lines.length > 0 && lines[lines.length - 1] === ""
                    ? lines.length - 1
                    : lines.length;

            const counts = {
                lines: lineCount,
                words:
                    content.trim() === "" ? 0 : content.trim().split(/\s+/).length,
                bytes: content.length,
            };

            totalCounts.lines += counts.lines;
            totalCounts.words += counts.words;
            totalCounts.bytes += counts.bytes;

            if (
                context.inputFileCount > 1 ||
                (context.inputFileCount > 0 && item.sourceName !== "stdin")
            ) {
                outputLines.push(formatOutput(counts, item.sourceName));
            }
        }

        if (context.inputFileCount > 1) {
            outputLines.push(formatOutput(totalCounts, "total"));
        } else if (
            context.inputFileCount === 1 &&
            inputItems[0].sourceName !== "stdin"
        ) {
        } else {
            outputLines.push(formatOutput(totalCounts));
        }

        return ErrorHandler.createSuccess(outputLines.join("\n"));
    }
}

window.CommandRegistry.register(new WcCommand());
