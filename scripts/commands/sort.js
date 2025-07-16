// scripts/commands/sort.js
(() => {
    "use strict";

    const sortCommandDefinition = {
        commandName: "sort",
        completionType: "paths", // Restored for tab completion
        isInputStream: true,
        flagDefinitions: [
            { name: "reverse", short: "-r", long: "--reverse" },
            { name: "numeric", short: "-n", long: "--numeric-sort" },
            { name: "unique", short: "-u", long: "--unique" },
        ],
        coreLogic: async (context) => {
            const { flags, inputItems, inputError } = context;

            try {
                if (inputError) {
                    return { success: false, error: "sort: No readable input provided or permission denied." };
                }

                if (!inputItems || inputItems.length === 0) {
                    return { success: true, output: "" };
                }

                const input = inputItems.map(item => item.content).join('\\n');
                let lines = input.split('\\n');

                if (lines.length > 0 && lines.at(-1) === '') {
                    lines.pop();
                }

                if (flags.numeric) {
                    lines.sort((a, b) => {
                        const numA = parseFloat(a);
                        const numB = parseFloat(b);
                        if (isNaN(numA) && isNaN(numB)) return a.localeCompare(b);
                        if (isNaN(numA)) return 1;
                        if (isNaN(numB)) return -1;
                        return numA - numB;
                    });
                } else {
                    lines.sort((a, b) => a.localeCompare(b));
                }

                if (flags.reverse) {
                    lines.reverse();
                }

                if (flags.unique) {
                    const uniqueLines = [...new Set(lines)];
                    if (flags.numeric) {
                        uniqueLines.sort((a, b) => parseFloat(a) - parseFloat(b));
                    }
                    if (flags.reverse) {
                        uniqueLines.reverse();
                    }
                    lines = uniqueLines;
                }

                return {
                    success: true,
                    output: lines.join('\\n')
                };
            } catch (e) {
                return { success: false, error: `sort: An unexpected error occurred: ${e.message}` };
            }
        }
    };

    const sortDescription = "Sorts lines of text from a file or standard input.";
    const sortHelpText = `Usage: sort [OPTION]... [FILE]...

Sort lines of text.

DESCRIPTION
       Writes a sorted concatenation of all FILE(s) to standard output.
       With no FILE, or when FILE is -, read standard input.

OPTIONS
       -r, --reverse
              Reverse the result of comparisons.

       -n, --numeric-sort
              Compare according to string numerical value.
              
       -u, --unique
              Output only unique lines.

EXAMPLES
       sort data.txt
              Displays the lines of data.txt in alphabetical order.
              
       ls | sort -r
              Displays the contents of the current directory in reverse
              alphabetical order.`;

    CommandRegistry.register("sort", sortCommandDefinition, sortDescription, sortHelpText);
})();