/**
 * @file Defines the 'cat' command, which concatenates and displays the content of files or standard input.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    const catCommandDefinition = {
        commandName: "cat",
        flagDefinitions: [
            { name: "numberLines", short: "-n", long: "--number" }
        ],
        // --- ADDED FOR AUTO-COMPLETION ---
        pathValidation: [
            { argIndex: 0, optional: true, options: { expectedType: 'file' } }
        ],
        // --- END ADDITION ---
        coreLogic: async (context) => {
            const { args, flags, options, currentUser } = context;

            if (args.length === 0 && (options.stdinContent === null || options.stdinContent === undefined)) {
                return { success: true, output: "" };
            }

            let outputContent = "";
            let firstFile = true;
            let lineCounter = 1;

            const processAndNumberContent = (content) => {
                if (!flags.numberLines) {
                    return content;
                }
                const lines = content.split('\n');
                const processedLines = (lines.at(-1) === '' ? lines.slice(0, -1) : lines);
                return processedLines.map(line => `     ${lineCounter++}  ${line}`).join('\n');
            };

            if (options.stdinContent !== null && options.stdinContent !== undefined) {
                outputContent += processAndNumberContent(options.stdinContent);
                firstFile = false;
            }

            for (const pathArg of args) {
                const pathValidation = FileSystemManager.validatePath("cat", pathArg, { expectedType: 'file' });
                if (pathValidation.error) return { success: false, error: pathValidation.error };
                if (!FileSystemManager.hasPermission(pathValidation.node, currentUser, "read")) {
                    return { success: false, error: `cat: '${pathArg}': Permission denied` };
                }

                if (!firstFile && outputContent && !outputContent.endsWith("\n")) outputContent += "\n";

                const fileContent = pathValidation.node.content || "";
                outputContent += processAndNumberContent(fileContent);
                firstFile = false;
            }

            return { success: true, output: outputContent };
        },
    };

    const catDescription = "Concatenate and display the content of files.";

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
              how cat handles piped input.
       -n, --number
              Number all output lines, starting from 1.`;

    CommandRegistry.register("cat", catCommandDefinition, catDescription, catHelpText);
})();