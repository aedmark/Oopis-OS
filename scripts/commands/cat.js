/**
 * @file Defines the 'cat' command, which concatenates and displays the content of files or standard input.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} catCommandDefinition
     * @description The command definition for the 'cat' command.
     */
    const catCommandDefinition = {
        commandName: "cat",
        /**
         * The core logic for the 'cat' command.
         * It reads content from standard input (if provided via a pipe) and then
         * reads and concatenates the content of each file specified in the arguments.
         * It ensures a newline is present between concatenated file contents if needed.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The file paths provided as arguments.
         * @param {object} context.options - Execution options, including stdin content.
         * @param {string} context.currentUser - The name of the current user.
         * @returns {Promise<object>} A promise that resolves to a command result object.
         */
        coreLogic: async (context) => {
            const { args, options, currentUser } = context;

            // If there are no file arguments and no piped input, do nothing.
            if (
                args.length === 0 &&
                (options.stdinContent === null || options.stdinContent === undefined)
            ) {
                return {
                    success: true,
                    output: "",
                };
            }

            let outputContent = "";
            let firstFile = true;

            // First, process any standard input from a pipe.
            if (options.stdinContent !== null && options.stdinContent !== undefined) {
                outputContent += options.stdinContent;
                firstFile = false;
            }

            // Then, process each file argument.
            for (const pathArg of args) {
                const pathValidation = FileSystemManager.validatePath("cat", pathArg, {
                    expectedType: Config.FILESYSTEM.DEFAULT_FILE_TYPE,
                });
                if (pathValidation.error)
                    return {
                        success: false,
                        error: pathValidation.error,
                    };

                if (
                    !FileSystemManager.hasPermission(
                        pathValidation.node,
                        currentUser,
                        "read"
                    )
                )
                    return {
                        success: false,
                        error: `cat: '${pathArg}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`,
                    };

                // Ensure there's a newline between concatenated file contents if the previous content didn't end with one.
                if (!firstFile && outputContent && !outputContent.endsWith("\n"))
                    outputContent += "\n";

                outputContent += pathValidation.node.content || "";
                firstFile = false;
            }

            return {
                success: true,
                output: outputContent,
            };
        },
    };

    /**
     * @const {string} catDescription
     * @description A brief, one-line description of the 'cat' command for the 'help' command.
     */
    const catDescription = "Concatenate and display the content of files.";

    /**
     * @const {string} catHelpText
     * @description The detailed help text for the 'cat' command, used by 'man'.
     */
    const catHelpText = `Usage: cat [FILE]...

Concatenate and print files to the standard output.

DESCRIPTION
       The cat utility reads files sequentially, writing them to the standard
       output. The file operands are processed in command-line order.

       If no files are specified, cat reads from standard input. This makes
       it useful in pipelines for displaying the output of other commands.

EXAMPLES
       cat file1.txt
              Displays the content of file1.txt.

       cat file1.txt file2.txt
              Displays the content of file1.txt followed by file2.txt.

       cat file1.txt file2.txt > newfile.txt
              Concatenates file1.txt and file2.txt and writes the
              result to newfile.txt.
              
       ls -l | cat
              Displays the output of the 'ls -l' command, demonstrating
              how cat handles piped input.`;

    // Register the command with the system
    CommandRegistry.register("cat", catCommandDefinition, catDescription, catHelpText);
})();
