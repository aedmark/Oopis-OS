// scripts/commands/diff.js

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
    const diffDescription = "Displays the differences between two files.";
    const diffHelpText = "Usage: diff <file1> <file2>\n\nDisplays the differences between the specified files.";
    CommandRegistry.register("diff", diffCommandDefinition, diffDescription, diffHelpText);
})();