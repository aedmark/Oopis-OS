// scripts/commands/shuf.js
(() => {
    "use strict";

    function fisherYatesShuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    const shufCommandDefinition = {
        commandName: "shuf",
        completionType: "paths", // Preserved for tab completion
        isInputStream: true, // Uses the new unified input stream
        flagDefinitions: [
            { name: "count", short: "-n", long: "--head-count", takesValue: true },
            { name: "inputRange", short: "-i", long: "--input-range", takesValue: true },
            { name: "echo", short: "-e", long: "--echo" },
        ],
        // The first file arg could be at index 0 if -e is not present
        firstFileArgIndex: 0,
        coreLogic: async (context) => {
            const { args, flags, inputItems, inputError } = context;

            try {
                let lines = [];
                let outputCount = null;

                if (flags.inputRange) {
                    const rangeParts = flags.inputRange.split('-');
                    if (rangeParts.length !== 2) {
                        return { success: false, error: "shuf: invalid input range format for -i. Expected LO-HI." };
                    }
                    const lo = parseInt(rangeParts[0], 10);
                    const hi = parseInt(rangeParts[1], 10);

                    if (isNaN(lo) || isNaN(hi) || lo > hi) {
                        return { success: false, error: "shuf: invalid numeric range for -i." };
                    }
                    for (let i = lo; i <= hi; i++) {
                        lines.push(String(i));
                    }
                } else if (flags.echo) {
                    lines = args;
                } else {
                    if (inputError) {
                        return { success: false, error: "shuf: No readable input provided or permission denied."};
                    }
                    if (inputItems && inputItems.length > 0) {
                        lines = inputItems.map(item => item.content).join('\\n').split('\\n');
                    } else if (args.length === 0) { // No piped input and no file args
                        return { success: true, output: "" };
                    }
                }

                if (flags.count) {
                    const countResult = Utils.parseNumericArg(flags.count, { allowFloat: false, allowNegative: false });
                    if (countResult.error) {
                        return { success: false, error: `shuf: invalid count for -n: ${countResult.error}` };
                    }
                    outputCount = countResult.value;
                }

                // Remove trailing empty line if it exists from file read
                if (lines.length > 0 && lines[lines.length - 1] === '') {
                    lines.pop();
                }

                const shuffledLines = fisherYatesShuffle(lines);

                let finalOutput;
                if (outputCount !== null) {
                    finalOutput = shuffledLines.slice(0, outputCount);
                } else {
                    finalOutput = shuffledLines;
                }

                return { success: true, output: finalOutput.join('\\n') };
            } catch (e) {
                return { success: false, error: `shuf: An unexpected error occurred: ${e.message}` };
            }
        },
    };

    const shufDescription = "Generates a random permutation of lines.";
    const shufHelpText = `Usage: shuf [OPTION]... [FILE]
   or:  shuf -e [ARG]...
   or:  shuf -i LO-HI

Write a random permutation of the input lines to standard output.

DESCRIPTION
       The shuf command randomly shuffles its input lines. The input can
       come from a file, from standard input (a pipe), from command-line
       arguments, or from a numeric range.

OPTIONS
       -e, --echo
              Treat each command-line ARG as an input line.
       -i, --input-range=LO-HI
              Treat each number in the range LO-HI as an input line.
       -n, --head-count=COUNT
              Output at most COUNT lines.

EXAMPLES
       ls | shuf
              Displays the contents of the current directory in a random order.

       shuf -n 1 /home/Guest/data/pangrams.txt
              Selects one random line from the pangrams file.

       shuf -i 1-10 -n 3
              Selects three unique random numbers from 1 to 10.
              
       shuf -e one two three
              Shuffles the words 'one', 'two', and 'three'.`;

    CommandRegistry.register("shuf", shufCommandDefinition, shufDescription, shufHelpText);
})();