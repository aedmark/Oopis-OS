// scripts/commands/uniq.js
(() => {
    "use strict";

    const uniqCommandDefinition = {
        commandName: "uniq",
        // isInputStream is removed.
        flagDefinitions: [
            { name: "count", short: "-c", long: "--count" },
            { name: "repeated", short: "-d", long: "--repeated" },
            { name: "unique", short: "-u", long: "--unique" },
        ],
        coreLogic: async (context) => {
            const {flags, args, options, currentUser } = context;

            if (flags.repeated && flags.unique) {
                return { success: false, error: "uniq: printing only unique and repeated lines is mutually exclusive"};
            }

            // Determine input source: file argument or piped stdin.
            let inputText;
            if (args.length > 0) {
                const pathValidation = FileSystemManager.validatePath("uniq", args[0], { expectedType: 'file' });
                if (pathValidation.error) {
                    return { success: false, error: pathValidation.error };
                }
                if (!FileSystemManager.hasPermission(pathValidation.node, currentUser, "read")) {
                    return { success: false, error: `uniq: cannot read file: ${args[0]}` };
                }
                inputText = pathValidation.node.content || "";
            } else if (options.stdinContent !== null && options.stdinContent !== undefined) {
                inputText = options.stdinContent;
            } else {
                // If no file and no stdin, do nothing.
                return { success: true, output: "" };
            }

            if (!inputText) {
                return { success: true, output: "" };
            }

            let lines = inputText.split('\n');
            // Gracefully handle empty input or input with only a trailing newline.
            if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) return {success: true, output: ""};

            const outputLines = [];
            let currentLine = lines[0];
            let count = 1;

            // Process the lines as before.
            for (let i = 1; i <= lines.length; i++) {
                if (i < lines.length && lines[i] === currentLine) {
                    count++;
                } else {
                    if (!flags.repeated && !flags.unique) {
                        outputLines.push(flags.count ? `${String(count).padStart(7)} ${currentLine}` : currentLine);
                    } else if (flags.repeated && count > 1) {
                        outputLines.push(flags.count ? `${String(count).padStart(7)} ${currentLine}` : currentLine);
                    } else if (flags.unique && count === 1) {
                        outputLines.push(flags.count ? `${String(count).padStart(7)} ${currentLine}` : currentLine);
                    }
                    if (i < lines.length) {
                        currentLine = lines[i];
                        count = 1;
                    }
                }
            }
            return {success: true, output: outputLines.join('\n')};
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