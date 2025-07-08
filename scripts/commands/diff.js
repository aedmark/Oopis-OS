(() => {
    "use strict";

    const diffCommandDefinition = {
        commandName: "diff",
        argValidation: {
            exact: 2,
            error: "Usage: diff <file1> <file2>",
        },
        pathValidation: [{
            argIndex: 0,
            options: {
                expectedType: Config.FILESYSTEM.DEFAULT_FILE_TYPE
            }
        }, {
            argIndex: 1,
            options: {
                expectedType: Config.FILESYSTEM.DEFAULT_FILE_TYPE
            }
        }, ],
        permissionChecks: [{
            pathArgIndex: 0,
            permissions: ["read"]
        }, {
            pathArgIndex: 1,
            permissions: ["read"]
        }, ],

        coreLogic: async (context) => {
            const {
                validatedPaths
            } = context;
            const file1Node = validatedPaths[0].node;
            const file2Node = validatedPaths[1].node;
            const diffResult = DiffUtils.compare(
                file1Node.content || "",
                file2Node.content || ""
            );

            return {
                success: true,
                output: diffResult,
            };
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
              Shows the differences between the two text files.`;

    CommandRegistry.register("diff", diffCommandDefinition, diffDescription, diffHelpText);
})();