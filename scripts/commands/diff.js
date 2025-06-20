/**
 * @file Defines the 'diff' command, which compares the content of two files line by line.
 * It provides a formatted output highlighting additions, deletions, and common lines.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} diffCommandDefinition
     * @description The command definition for the 'diff' command.
     * This object specifies the command's name, argument validation, path validation,
     * required permissions, and the core logic for comparing two files.
     */
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
        /**
         * The core logic for the 'diff' command.
         * It retrieves the content of the two specified files (which are guaranteed
         * to exist and be readable by `pathValidation` and `permissionChecks`).
         * It then uses the `DiffUtils.compare` function to generate a line-by-line
         * comparison and returns the formatted diff output.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {object[]} context.validatedPaths - An array containing information about the two validated file paths.
         * @returns {Promise<object>} A promise that resolves to a command result object
         * with the formatted diff output.
         */
        coreLogic: async (context) => {
            const {
                validatedPaths
            } = context;
            // The first validated path corresponds to file1.
            const file1Node = validatedPaths[0].node;
            // The second validated path corresponds to file2.
            const file2Node = validatedPaths[1].node;

            // Use DiffUtils to compare the content of the two files.
            // Provide empty strings if content is null or undefined to prevent errors.
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