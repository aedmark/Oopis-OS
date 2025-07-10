(() => {
    "use strict";

    const headCommandDefinition = {
        commandName: "head",
        isInputStream: true,
        flagDefinitions: [
            { name: "lines", short: "-n", long: "--lines", takesValue: true },
            { name: "bytes", short: "-c", long: "--bytes", takesValue: true },
        ],
        coreLogic: async (context) => {
            const {flags, inputItems, inputError} = context; // Now uses inputItems

            if (inputError) {
                return {success: false, error: "head: No readable input provided."};
            }
            const input = inputItems.map(item => item.content).join('\n');

            if (flags.lines && flags.bytes) {
                return { success: false, error: "head: cannot use both -n and -c" };
            }

            if (input === null) {
                return {success: false, error: "head: No readable input provided."};
            }

            let lineCount = 10;
            if (flags.lines) {
                const linesResult = Utils.parseNumericArg(flags.lines, { allowFloat: false, allowNegative: false });
                if (linesResult.error) {
                    return { success: false, error: `head: invalid number of lines: '${flags.lines}'` };
                }
                lineCount = linesResult.value;
            }

            let byteCount = null;
            if (flags.bytes) {
                const bytesResult = Utils.parseNumericArg(flags.bytes, { allowFloat: false, allowNegative: false });
                if (bytesResult.error) {
                    return { success: false, error: `head: invalid number of bytes: '${flags.bytes}'` };
                }
                byteCount = bytesResult.value;
            }

            let output;
            if (byteCount !== null) {
                output = input.substring(0, byteCount);
            } else {
                output = input.split('\n').slice(0, lineCount).join('\n');
            }

            return {success: true, output: output};
        },
    };

    const headDescription = "Outputs the first part of files.";
    const headHelpText = `Usage: head [OPTION]... [FILE]...

Print the first 10 lines of each FILE to standard output.
With more than one FILE, precede each with a header giving the file name.

DESCRIPTION
       The head command displays the beginning of a text file. It is a quick
       way to preview a file's content without opening it in an editor.

OPTIONS
       -n, --lines=COUNT
              Print the first COUNT lines instead of the first 10.
       -c, --bytes=COUNT
              Print the first COUNT bytes of each file.

EXAMPLES
       head /etc/motd
              Displays the first 10 lines of the message of the day file.

       head -n 5 README.md
              Displays the first 5 lines of the README.md file.

       ls | head -n 3
              Displays the first 3 files or directories in the current location.`;

    CommandRegistry.register("head", headCommandDefinition, headDescription, headHelpText);
})();