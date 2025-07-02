/**
 * @file Defines the 'wc' (word count) command for OopisOS.
 * It counts lines, words, and bytes for files or standard input.
 * @author Your Name
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} wcCommandDefinition
     * @description The command definition for the 'wc' command, following the Command Contract.
     */
    const wcCommandDefinition = {
        commandName: "wc",
        flagDefinitions: [
            { name: "lines", short: "-l", long: "--lines" },
            { name: "words", short: "-w", long: "--words" },
            { name: "bytes", short: "-c", long: "--bytes" },
        ],
        /**
         * The core logic for the 'wc' command.
         * @async
         * @param {object} context - The context object from the command executor.
         * @returns {Promise<object>} The result of the command execution.
         */
        coreLogic: async (context) => {
            const { args, flags, options, currentUser } = context;

            // Determine which counts to display. If no flags, show all.
            const showAll = !flags.lines && !flags.words && !flags.bytes;
            const showLines = showAll || flags.lines;
            const showWords = showAll || flags.words;
            const showBytes = showAll || flags.bytes;

            const totals = { lines: 0, words: 0, bytes: 0 };
            const outputLines = [];
            let hadError = false;

            /**
             * Processes content and returns line, word, and byte counts.
             * @param {string} content The content to process.
             * @returns {{lines: number, words: number, bytes: number}}
             */
            const getCounts = (content) => {
                const bytes = content.length;
                // A file with no lines has 0 lines, but split produces an array of length 1.
                // A file with one line has 0 newlines. So, the number of lines is the number of newlines.
                const lines = (content.match(/\n/g) || []).length;
                // A more robust way to count words, handling various whitespace.
                const words = content.trim() === '' ? 0 : content.trim().split(/\s+/).length;
                return { lines, words, bytes };
            };

            /**
             * Formats a line of output with aligned columns.
             * @param {object} counts The counts object.
             * @param {string} name The name of the file or an empty string for totals/stdin.
             * @returns {string} The formatted output line.
             */
            const formatOutput = (counts, name) => {
                let line = " ";
                if (showLines) line += String(counts.lines).padStart(7) + " ";
                if (showWords) line += String(counts.words).padStart(7) + " ";
                if (showBytes) line += String(counts.bytes).padStart(7) + " ";
                if (name) line += name;
                return line;
            };

            // Process from standard input (e.g., from a pipe)
            if (args.length === 0) {
                if (options.stdinContent !== null) {
                    const counts = getCounts(options.stdinContent);
                    outputLines.push(formatOutput(counts, ""));
                }
                // If no files and no stdin, do nothing.
            }
            // Process from file arguments
            else {
                for (const pathArg of args) {
                    const pathValidation = FileSystemManager.validatePath("wc", pathArg, { expectedType: 'file' });
                    if (pathValidation.error) {
                        outputLines.push(pathValidation.error);
                        hadError = true;
                        continue;
                    }

                    if (!FileSystemManager.hasPermission(pathValidation.node, currentUser, "read")) {
                        outputLines.push(`wc: '${pathArg}': Permission denied`);
                        hadError = true;
                        continue;
                    }

                    const counts = getCounts(pathValidation.node.content || "");
                    totals.lines += counts.lines;
                    totals.words += counts.words;
                    totals.bytes += counts.bytes;

                    outputLines.push(formatOutput(counts, pathArg));
                }

                if (args.length > 1) {
                    outputLines.push(formatOutput(totals, "total"));
                }
            }

            return {
                success: !hadError,
                output: outputLines.join('\n'),
                error: hadError ? outputLines.join('\n') : null
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