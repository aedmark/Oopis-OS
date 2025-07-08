(() => {
    "use strict";

    const sortCommandDefinition = {
        commandName: "sort",
        flagDefinitions: [
            { name: "reverse", short: "-r", long: "--reverse" },
            { name: "numeric", short: "-n", long: "--numeric-sort" },
            { name: "unique", short: "-u", long: "--unique" },
        ],
        coreLogic: async (context) => {
            const { flags } = context;
            let allContent = "";
            let hadError = false;

            for await (const item of Utils.generateInputContent(context)) {
                if (!item.success) {
                    await OutputManager.appendToOutput(item.error, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                    hadError = true;
                    continue;
                }
                allContent += item.content;
            }

            if (hadError && !allContent) {
                return { success: false, error: "sort: No readable input provided." };
            }

            let lines = allContent.split('\n');
            if (lines.length > 0 && lines[lines.length - 1] === '') {
                lines.pop();
            }

            if (flags.numeric) {
                lines.sort((a, b) => {
                    const numA = parseFloat(a);
                    const numB = parseFloat(b);
                    if (isNaN(numA) && isNaN(numB)) return a.localeCompare(b);
                    if (isNaN(numA)) return -1;
                    if (isNaN(numB)) return 1;
                    return numA - numB;
                });
            } else {
                lines.sort((a, b) => a.localeCompare(b));
            }

            if (flags.reverse) {
                lines.reverse();
            }

            if (flags.unique) {
                lines = [...new Set(lines)];
                if (flags.numeric) lines.sort((a, b) => parseFloat(a) - parseFloat(b));
                if (flags.reverse) lines.reverse();
            }

            return {
                success: !hadError,
                output: lines.join('\n')
            };
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