// scripts/commands/comm.js

window.CommCommand = class CommCommand extends Command {
    constructor() {
        super({
            commandName: "comm",
            description: "Compares two sorted files line by line.",
            helpText: `Usage: comm [OPTION]... FILE1 FILE2
      Compare two sorted files line by line.

      DESCRIPTION
      The comm utility reads two files and compares them line by line.
      The output is in three columns. Column one contains lines unique to FILE1,
      column two contains lines unique to FILE2, and column three contains lines
      common to both files. It is assumed that the files are already sorted.

      OPTIONS
      -1              Suppress printing of column 1 (lines unique to FILE1).
      -2              Suppress printing of column 2 (lines unique to FILE2).
      -3              Suppress printing of column 3 (lines common to both).

      EXAMPLES
      comm sorted_a.txt sorted_b.txt
      Displays the differences and commonalities between the two files.

      comm -12 sorted_a.txt sorted_b.txt
      Displays only the lines that appear in both files.`,
            isInputStream: false,
            completionType: "paths",
            flagDefinitions: [
                { name: "suppressCol1", short: "-1" },
                { name: "suppressCol2", short: "-2" },
                { name: "suppressCol3", short: "-3" },
            ],
            validations: {
                args: {
                    exact: 2,
                    error: "Usage: comm [OPTION]... FILE1 FILE2"
                },
                paths: [
                    { argIndex: 0, options: { expectedType: 'file', permissions: ['read'] } },
                    { argIndex: 1, options: { expectedType: 'file', permissions: ['read'] } }
                ]
            },
        });
    }

    async coreLogic(context) {
        const { flags, validatedPaths, dependencies } = context;
        const { ErrorHandler } = dependencies;

        const file1Node = validatedPaths[0].node;
        const file2Node = validatedPaths[1].node;

        const lines1 = (file1Node.content || "").split('\n');
        const lines2 = (file2Node.content || "").split('\n');

        let i = 0;
        let j = 0;
        const outputLines = [];
        const col1Prefix = "";
        const col2Prefix = flags.suppressCol1 ? "" : "\t";
        const col3Prefix = flags.suppressCol1 && flags.suppressCol2 ? "" :
            (flags.suppressCol1 || flags.suppressCol2 ? "\t" : "\t\t");

        while (i < lines1.length && j < lines2.length) {
            if (lines1[i] < lines2[j]) {
                if (!flags.suppressCol1) {
                    outputLines.push(`${col1Prefix}${lines1[i]}`);
                }
                i++;
            } else if (lines2[j] < lines1[i]) {
                if (!flags.suppressCol2) {
                    outputLines.push(`${col2Prefix}${lines2[j]}`);
                }
                j++;
            } else {
                if (!flags.suppressCol3) {
                    outputLines.push(`${col3Prefix}${lines1[i]}`);
                }
                i++;
                j++;
            }
        }

        while (i < lines1.length) {
            if (!flags.suppressCol1 && lines1[i]) {
                outputLines.push(`${col1Prefix}${lines1[i]}`);
            }
            i++;
        }

        while (j < lines2.length) {
            if (!flags.suppressCol2 && lines2[j]) {
                outputLines.push(`${col2Prefix}${lines2[j]}`);
            }
            j++;
        }

        return ErrorHandler.createSuccess(outputLines.join('\n'));
    }
}

window.CommandRegistry.register(new CommCommand());
