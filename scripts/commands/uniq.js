// scripts/commands/uniq.js

window.UniqCommand = class UniqCommand extends Command {
    constructor() {
        super({
            commandName: "uniq",
            description: "Reports or filters out repeated lines in a file.",
            helpText: `Usage: uniq [OPTION]... [FILE]...
      Filter adjacent matching lines from input, writing to output.
      DESCRIPTION
      With no options, matching lines are merged to the first occurrence.
      Note: 'uniq' does not detect repeated lines unless they are adjacent.
      You may want to 'sort' the input first.
      OPTIONS
      -c, --count
      Prefix lines by the number of occurrences.
      -d, --repeated
      Only print duplicate lines, one for each group.
      -u, --unique
      Only print lines that are not repeated.
      EXAMPLES
      sort data.log | uniq
      Displays the unique lines from data.log.
      sort data.log | uniq -c
      Displays each unique line, prefixed by its frequency count.
      sort data.log | uniq -d
      Displays only the lines that appeared more than once.`,
            completionType: "paths",
            isInputStream: true,
            flagDefinitions: [
                { name: "count", short: "-c", long: "--count" },
                { name: "repeated", short: "-d", long: "--repeated" },
                { name: "unique", short: "-u", long: "--unique" },
            ],
        });
    }

    async coreLogic(context) {
        const { flags, inputItems, inputError, dependencies } = context;
        const { ErrorHandler } = dependencies;

        if (inputError) {
            return ErrorHandler.createError(
                "uniq: One or more input files could not be read."
            );
        }

        if (flags.repeated && flags.unique) {
            return ErrorHandler.createError(
                "uniq: printing only unique and repeated lines is mutually exclusive"
            );
        }

        if (!inputItems || inputItems.length === 0) {
            return ErrorHandler.createSuccess("");
        }

        const inputText = inputItems.map((item) => item.content).join("\n");
        if (!inputText) {
            return ErrorHandler.createSuccess("");
        }

        let lines = inputText.split("\n");
        if (lines.length > 0 && lines[lines.length - 1] === "") {
            lines.pop();
        }

        const outputLines = [];
        if (lines.length > 0) {
            let currentLine = lines[0];
            let count = 1;

            for (let i = 1; i <= lines.length; i++) {
                if (i < lines.length && lines[i] === currentLine) {
                    count++;
                } else {
                    if (!flags.repeated && !flags.unique) {
                        outputLines.push(
                            flags.count
                                ? `${String(count).padStart(7)} ${currentLine}`
                                : currentLine
                        );
                    } else if (flags.repeated && count > 1) {
                        outputLines.push(
                            flags.count
                                ? `${String(count).padStart(7)} ${currentLine}`
                                : currentLine
                        );
                    } else if (flags.unique && count === 1) {
                        outputLines.push(
                            flags.count
                                ? `${String(count).padStart(7)} ${currentLine}`
                                : currentLine
                        );
                    }
                    if (i < lines.length) {
                        currentLine = lines[i];
                        count = 1;
                    }
                }
            }
        }
        return ErrorHandler.createSuccess(outputLines.join("\n"));
    }
}

window.CommandRegistry.register(new UniqCommand());
