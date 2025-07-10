// Corrected File: aedmark/oopis-os-dev/Oopis-OS-DEV-d433f2298e4704d53000b05f98b059a46e2196eb/scripts/commands/uniq.js
(() => {
    "use strict";

    const uniqCommandDefinition = {
        commandName: "uniq",
        isInputStream: true, // ADDED: Declares compliance with the new architecture.
        flagDefinitions: [
            { name: "count", short: "-c", long: "--count" },
            { name: "repeated", short: "-d", long: "--repeated" },
            { name: "unique", short: "-u", long: "--unique" },
        ],
        argValidation: {
            max: 1, // No change needed here.
        },
        coreLogic: async (context) => {
            // MODIFIED: Destructures the correct properties.
            const {flags, inputItems, inputError} = context;

            if (flags.repeated && flags.unique) {
                return { success: false, error: "uniq: printing only unique and repeated lines is mutually exclusive" };
            }

            // ADDED: Handles input stream errors.
            if (inputError) {
                return {success: false, error: "uniq: No readable input provided or permission denied."};
            }

            // MODIFIED: Processes the inputItems array.
            const input = inputItems.map(item => item.content).join('\\n');

            if (input === null || input === undefined) {
                return {success: true, output: ""};
            }

            let lines = input.split('\\n');

            if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
                return {success: true, output: ""};
            }
            // The rest of the core logic remains sound and operates on the corrected 'lines' variable.
            const outputLines = [];
            let currentLine = lines[0];
            let count = 1;

            for (let i = 1; i < lines.length; i++) {
                if (lines[i] === currentLine) {
                    count++;
                } else {
                    if (flags.count) {
                        outputLines.push(`${String(count).padStart(7)} ${currentLine}`);
                    } else if (flags.repeated) {
                        if (count > 1) outputLines.push(currentLine);
                    } else if (flags.unique) {
                        if (count === 1) outputLines.push(currentLine);
                    } else {
                        outputLines.push(currentLine);
                    }
                    currentLine = lines[i];
                    count = 1;
                }
            }

            if (flags.count) {
                outputLines.push(`${String(count).padStart(7)} ${currentLine}`);
            } else if (flags.repeated) {
                if (count > 1) outputLines.push(currentLine);
            } else if (flags.unique) {
                if (count === 1) outputLines.push(currentLine);
            } else {
                outputLines.push(currentLine);
            }

            return {success: true, output: outputLines.join('\\n')};
        }
    };

    const uniqDescription = "Reports or filters out repeated lines in a file.";
    const uniqHelpText = `Usage: uniq [OPTION]... [FILE]...

Filter adjacent matching lines from input, writing to output.

DESCRIPTION
       With no options, matching lines are merged to the first occurrence.
       Note: 'uniq' does not detect repeated lines unless they are adjacent.
       You may want to 'sort' the input first.

OPTIONS
       -c, --count
              Prefix lines by the number of occurrences.
       -d, --repeated
              Only print duplicate lines, one for each group.
       -u, --unique
              Only print lines that are not repeated.

EXAMPLES
       sort data.log | uniq
              Displays the unique lines from data.log.
              
       sort data.log | uniq -c
              Displays each unique line, prefixed by its frequency count.
              
       sort data.log | uniq -d
              Displays only the lines that appeared more than once.`;

    CommandRegistry.register("uniq", uniqCommandDefinition, uniqDescription, uniqHelpText);
})();