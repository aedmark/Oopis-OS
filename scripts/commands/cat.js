(() => {
    "use strict";

    const catCommandDefinition = {
        commandName: "cat",
        isInputStream: true, // Correctly declares that it handles input streams
        flagDefinitions: [
            { name: "numberLines", short: "-n", long: "--number" }
        ],
        // pathValidation is no longer needed here as the stream processor handles it.
        coreLogic: async (context) => {
            const {flags, inputItems, inputError} = context;

            // The CommandExecutor now provides an error flag for input stream issues.
            if (inputError) {
                return {success: false, error: "cat: Could not read one or more sources."};
            }

            // The inputItems array contains the content from all sources (stdin or files).
            const input = inputItems.map(item => item.content).join('');

            if (input === null) {
                return {success: true, output: ""}; // Handle no input gracefully.
            }

            if (!flags.numberLines) {
                return {success: true, output: input};
            }

            // The rest of the logic remains the same but now operates on a guaranteed input string.
            let lineCounter = 1;
            const lines = input.split('\n');
            // Handles files that may or may not have a trailing newline.
            const processedLines = (lines.length > 0 && lines.at(-1) === '' ? lines.slice(0, -1) : lines);
            const numberedOutput = processedLines.map(line => `     ${String(lineCounter++).padStart(5)}  ${line}`).join('\n');

            return {success: true, output: numberedOutput};
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

OPTIONS
       -n, --number
              Number all output lines, starting from 1.

EXAMPLES
       cat file1.txt
              Displays the content of file1.txt.

       cat file1.txt file2.txt > newfile.txt
              Concatenates file1.txt and file2.txt and writes the
              result to newfile.txt.
              
       ls -l | cat
              Displays the output of the 'ls -l' command, demonstrating
              how cat handles piped input.`;

    CommandRegistry.register("cat", catCommandDefinition, catDescription, catHelpText);
})();