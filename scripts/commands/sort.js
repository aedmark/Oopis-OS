/**
 * @file Defines the 'sort' command for OopisOS.
 * @author Andrew Edmark
 * @author Gemini
 */

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
            const { args, flags, options, currentUser } = context;

            let lines = [];
            let hadError = false;
            let combinedContent = "";

            if (args.length > 0) {
                // Read from all specified files
                for (const pathArg of args) {
                    const pathValidation = FileSystemManager.validatePath("sort", pathArg, { expectedType: 'file' });
                    if (pathValidation.error) {
                        // Using OutputManager directly for errors in multi-file scenarios
                        await OutputManager.appendToOutput(pathValidation.error, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                        hadError = true;
                        continue;
                    }
                    if (!FileSystemManager.hasPermission(pathValidation.node, currentUser, "read")) {
                        await OutputManager.appendToOutput(`sort: cannot read '${pathArg}': Permission denied`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                        hadError = true;
                        continue;
                    }
                    combinedContent += pathValidation.node.content || "";
                }
                lines = combinedContent.split('\n');
            } else if (options.stdinContent !== null) {
                // Read from standard input
                lines = options.stdinContent.split('\n');
            }

            // If the last line of input is empty (from a trailing newline), remove it.
            if (lines.length > 0 && lines[lines.length - 1] === '') {
                lines.pop();
            }

            // Perform the sort
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
                lines = [...new Set(lines)]; // Simple way to get unique lines
                // Re-sort after uniquing if numeric or reverse, as Set doesn't preserve numeric sort order.
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