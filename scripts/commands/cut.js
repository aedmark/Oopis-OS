// scripts/commands/cut.js

window.CutCommand = class CutCommand extends Command {
    constructor() {
        super({
            commandName: "cut",
            description: "Extract sections from each line of files.",
            helpText: `Usage: cut [OPTION]... [FILE]...
      Print selected parts of lines from each FILE to standard output.

      DESCRIPTION
      The cut utility extracts sections from each line of its input.
      Selection can be by characters or fields.

      OPTIONS
      -d, --delimiter=DELIM
            Use DELIM instead of TAB for field delimiter.
      -f, --fields=LIST
            Select only these fields. LIST is a comma-separated list of
            positive integers (e.g., 1,3,4).
      -c, --characters=LIST
            Select only these characters. LIST is a comma-separated list
            of positive integers or ranges (e.g., 1,3,5-7).

      EXAMPLES
      cat data.csv | cut -d',' -f1,3
            Extracts the 1st and 3rd fields from a CSV file.
      echo "Hello World" | cut -c 1-5
            Extracts the first 5 characters, resulting in "Hello".`,
            isInputStream: true,
            completionType: "paths",
            flagDefinitions: [
                { name: "delimiter", short: "-d", long: "--delimiter", takesValue: true },
                { name: "fields", short: "-f", long: "--fields", takesValue: true },
                { name: "characters", short: "-c", long: "--characters", takesValue: true },
            ],
        });
    }

    _parseRange(list) {
        const indices = new Set();
        const ranges = list.split(',');
        for (const range of ranges) {
            if (range.includes('-')) {
                const [start, end] = range.split('-').map(Number);
                if (!isNaN(start) && !isNaN(end) && start > 0 && end >= start) {
                    for (let i = start; i <= end; i++) {
                        indices.add(i - 1);
                    }
                }
            } else {
                const num = Number(range);
                if (!isNaN(num) && num > 0) {
                    indices.add(num - 1);
                }
            }
        }
        return Array.from(indices).sort((a, b) => a - b);
    }


    async coreLogic(context) {
        const { flags, inputItems, inputError, dependencies } = context;
        const { ErrorHandler } = dependencies;

        if (inputError) {
            return ErrorHandler.createError("cut: No readable input provided or permission denied.");
        }

        if (flags.fields && flags.characters) {
            return ErrorHandler.createError("cut: only one type of list may be specified");
        }

        if (!flags.fields && !flags.characters) {
            return ErrorHandler.createError("cut: you must specify a list of fields with -f or a list of characters with -c");
        }

        if (!inputItems || inputItems.length === 0) {
            return ErrorHandler.createSuccess("");
        }

        const content = inputItems.map((item) => item.content).join("\n");
        const lines = content.split('\n');
        const outputLines = [];

        if (flags.fields) {
            const delimiter = flags.delimiter || '\t';
            const fieldList = this._parseRange(flags.fields);

            if (fieldList.length === 0) {
                return ErrorHandler.createError("cut: invalid field list");
            }

            for (const line of lines) {
                if (line === "" && lines.indexOf(line) === lines.length -1) continue;
                const fields = line.split(delimiter);
                const selectedFields = fieldList.map(index => fields[index]).filter(f => f !== undefined);
                outputLines.push(selectedFields.join(delimiter));
            }
        } else if (flags.characters) {
            const charList = this._parseRange(flags.characters);

            if (charList.length === 0) {
                return ErrorHandler.createError("cut: invalid character list");
            }

            for (const line of lines) {
                if (line === "" && lines.indexOf(line) === lines.length -1) continue;
                let newLine = '';
                for (const index of charList) {
                    if (index < line.length) {
                        newLine += line[index];
                    }
                }
                outputLines.push(newLine);
            }
        }

        return ErrorHandler.createSuccess(outputLines.join('\n'));
    }
}

window.CommandRegistry.register(new CutCommand());
