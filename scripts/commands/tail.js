// scripts/commands/tail.js

window.TailCommand = class TailCommand extends Command {
    constructor() {
        super({
            commandName: "tail",
            description: "Outputs the last part of files.",
            helpText: `Usage: tail [OPTION]... [FILE]...
      Print the last 10 lines of each FILE to standard output.
      With more than one FILE, precede each with a header giving the file name.
      DESCRIPTION
      The tail command displays the end of a text file. It is a useful
      way to see the most recent entries in a log file.
      OPTIONS
      -n, --lines=COUNT
      Output the last COUNT lines, instead of the last 10.
      -f, --follow
      Output appended data as the file grows. This is ignored
      if standard input is a pipe. In OopisOS, this simulates
      watching a file for changes.
      EXAMPLES
      tail /data/logs/system.log
      Displays the last 10 lines of the system log.
      tail -n 100 /data/logs/system.log
      Displays the last 100 lines of the system log.
      tail -f /data/logs/app.log
      Displays the last 10 lines of the app log and continues
      to display new lines as they are added.`,
            isInputStream: true,
            completionType: "paths",
            flagDefinitions: [
                { name: "lines", short: "-n", long: "--lines", takesValue: true },
                { name: "follow", short: "-f", long: "--follow" },
            ],
        });
    }

    async coreLogic(context) {
        const { flags, args, inputItems, inputError, signal, dependencies } = context;
        const { ErrorHandler, Utils, FileSystemManager, OutputManager, Config } = dependencies;

        if (inputError && (!args || args.length === 0)) {
            return ErrorHandler.createError(
                "tail: No readable input provided or permission denied."
            );
        }

        let lineCount = 10;
        if (flags.lines) {
            const linesResult = Utils.parseNumericArg(flags.lines, {
                allowFloat: false,
                allowNegative: false,
            });
            if (linesResult.error) {
                return ErrorHandler.createError(
                    `tail: invalid number of lines: '${flags.lines}'`
                );
            }
            lineCount = linesResult.value;
        }

        if (flags.follow) {
            if (args.length !== 1) {
                return ErrorHandler.createError(
                    "tail: -f option can only be used with a single file argument."
                );
            }
            const filePath = args[0];
            const pathValidation = FileSystemManager.validatePath(filePath, {
                expectedType: "file",
                permissions: ["read"],
            });
            if (!pathValidation.success) {
                return ErrorHandler.createError(`tail: ${pathValidation.error}`);
            }

            let lastContent = pathValidation.data.node.content || "";
            const initialLines = lastContent.split("\n").slice(-lineCount);
            await OutputManager.appendToOutput(initialLines.join("\n"));

            const followPromise = new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    if (signal?.aborted) {
                        clearInterval(checkInterval);
                        resolve(ErrorHandler.createSuccess(""));
                        return;
                    }
                    const currentNode = FileSystemManager.getNodeByPath(
                        pathValidation.data.resolvedPath
                    );
                    if (!currentNode) {
                        clearInterval(checkInterval);
                        resolve(
                            ErrorHandler.createError("tail: file deleted or moved")
                        );
                        return;
                    }
                    const newContent = currentNode.content || "";
                    if (newContent.length > lastContent.length) {
                        const appendedContent = newContent.substring(
                            lastContent.length
                        );
                        void OutputManager.appendToOutput(appendedContent.trim());
                        lastContent = newContent;
                    } else if (newContent.length < lastContent.length) {
                        void OutputManager.appendToOutput(
                            Config.MESSAGES.FILE_TRUNCATED_PREFIX +
                            filePath +
                            Config.MESSAGES.FILE_TRUNCATED_SUFFIX
                        );
                        const newLines = newContent.split("\n").slice(-lineCount);
                        void OutputManager.appendToOutput(newLines.join("\n"));
                        lastContent = newContent;
                    }
                }, 1000);
            });

            return await followPromise;
        }

        if (!inputItems || inputItems.length === 0) {
            return ErrorHandler.createSuccess("");
        }

        const content = inputItems.map((item) => item.content).join("\n");
        const output = content.split("\n").slice(-lineCount).join("\n");
        return ErrorHandler.createSuccess(output);
    }
}

window.CommandRegistry.register(new TailCommand());
