(() => {
    "use strict";

    const catCommandDefinition = {
        commandName: "cat",
        flagDefinitions: [
            { name: "numberLines", short: "-n", long: "--number" }
        ],
        pathValidation: [
            { argIndex: 0, optional: true, options: { expectedType: 'file' } }
        ],
        coreLogic: async (context) => {
            const { flags } = context;
            const outputParts = [];
            let lineCounter = 1;
            let hadError = false;

            const processAndNumberContent = (content) => {
                if (!flags.numberLines) {
                    return content;
                }
                const lines = content.split('\n');
                const processedLines = (lines.at(-1) === '' ? lines.slice(0, -1) : lines);
                return processedLines.map(line => `     ${lineCounter++}  ${line}`).join('\n');
            };

            for await (const item of Utils.generateInputContent(context)) {
                if (!item.success) {
                    outputParts.push(item.error);
                    hadError = true;
                    continue;
                }
                outputParts.push(processAndNumberContent(item.content));
            }

            return {
                success: !hadError,
                output: outputParts.join('\n')
            };
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