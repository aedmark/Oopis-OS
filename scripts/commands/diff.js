// scripts/commands/diff.js
(() => {
    "use strict";

    const diffCommandDefinition = {
        commandName: "diff",
        completionType: "paths", // Preserved for tab completion.
        argValidation: {
            exact: 2,
            error: "Usage: diff <file1> <file2>",
        },
        coreLogic: async (context) => {
            const { args } = context;
            const file1Path = args[0];
            const file2Path = args[1];

            try {
                const validation1 = FileSystemManager.validatePath(file1Path, { expectedType: 'file', permissions: ['read'] });
                if (validation1.error) {
                    return { success: false, error: `diff: ${file1Path}: ${validation1.error.replace(file1Path + ':', '').trim()}` };
                }

                const validation2 = FileSystemManager.validatePath(file2Path, { expectedType: 'file', permissions: ['read'] });
                if (validation2.error) {
                    return { success: false, error: `diff: ${file2Path}: ${validation2.error.replace(file2Path + ':', '').trim()}` };
                }

                const file1Node = validation1.node;
                const file2Node = validation2.node;

                const diffResult = DiffUtils.compare(
                    file1Node.content || "",
                    file2Node.content || ""
                );

                return {
                    success: true,
                    output: diffResult,
                };
            } catch (e) {
                return { success: false, error: `diff: An unexpected error occurred: ${e.message}` };
            }
        },
    };

    const diffDescription = "Compares two files line by line.";
    const diffHelpText = `Usage: diff <file1> <file2>

Compare two files line by line.

DESCRIPTION
       The diff command analyzes two files and prints the lines that are
       different.

       The output format uses the following prefixes:
       <      A line that is in <file1> but not in <file2>.
       >      A line that is in <file2> but not in <file1>.
         (a space) A line that is common to both files (context).

EXAMPLES
       diff original.txt updated.txt
              Shows the differences between the two text text files.`;

    CommandRegistry.register("diff", diffCommandDefinition, diffDescription, diffHelpText);
})();