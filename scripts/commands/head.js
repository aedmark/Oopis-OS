// scripts/commands/head.js

window.HeadCommand = class HeadCommand extends Command {
    constructor() {
        super({
            commandName: "head",
            description: "Outputs the first part of files.",
            helpText: `Usage: head [OPTION]... [FILE]...
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
      Displays the first 3 files or directories in the current location.`,
            isInputStream: true,
            flagDefinitions: [
                { name: "lines", short: "-n", long: "--lines", takesValue: true },
                { name: "bytes", short: "-c", long: "--bytes", takesValue: true },
            ],
        });
    }

    async coreLogic(context) {
        const { flags, inputItems, inputError, dependencies } = context;
        const { ErrorHandler, Utils } = dependencies;

        if (inputError) {
            return ErrorHandler.createError(
                "head: No readable input provided or permission denied."
            );
        }

        if (!inputItems || inputItems.length === 0) {
            return ErrorHandler.createSuccess("");
        }

        if (flags.lines && flags.bytes) {
            return ErrorHandler.createError("head: cannot use both -n and -c");
        }

        const input = inputItems.map((item) => item.content).join("\n");

        let lineCount = 10;
        if (flags.lines) {
            const linesResult = Utils.parseNumericArg(flags.lines, {
                allowFloat: false,
                allowNegative: false,
            });
            if (linesResult.error) {
                return ErrorHandler.createError(
                    `head: invalid number of lines: '${flags.lines}'`
                );
            }
            lineCount = linesResult.value;
        }

        let byteCount = null;
        if (flags.bytes) {
            const bytesResult = Utils.parseNumericArg(flags.bytes, {
                allowFloat: false,
                allowNegative: false,
            });
            if (bytesResult.error) {
                return ErrorHandler.createError(
                    `head: invalid number of bytes: '${flags.bytes}'`
                );
            }
            byteCount = bytesResult.value;
        }

        let output;
        if (byteCount !== null) {
            output = input.substring(0, byteCount);
        } else {
            output = input.split("\n").slice(0, lineCount).join("\n");
        }

        return ErrorHandler.createSuccess(output);
    }
}

window.CommandRegistry.register(new HeadCommand());
