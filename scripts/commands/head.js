/**
 * @file Defines the 'head' command, which outputs the first part of files.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    const headCommandDefinition = {
        commandName: "head",
        flagDefinitions: [
            { name: "lines", short: "-n", long: "--lines", takesValue: true },
            { name: "bytes", short: "-c", long: "--bytes", takesValue: true },
        ],
        // No argValidation needed as it can take 0 or more file arguments.
        coreLogic: async (context) => {
            const { args, flags, options, currentUser } = context;

            if (flags.lines && flags.bytes) {
                return { success: false, error: "head: cannot use both -n and -c" };
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

            const processContent = (content) => {
                if (byteCount !== null) {
                    return content.substring(0, byteCount);
                }
                return content.split('\n').slice(0, lineCount).join('\n');
            };

            // Handle standard input
            if (args.length === 0) {
                if (options.stdinContent !== null) {
                    return { success: true, output: processContent(options.stdinContent) };
                }
                return { success: true, output: "" }; // No files and no stdin
            }

            // Handle file inputs
            const outputParts = [];
            for (let i = 0; i < args.length; i++) {
                const pathArg = args[i];
                const pathValidation = FileSystemManager.validatePath("head", pathArg, { expectedType: 'file' });

                if (pathValidation.error) {
                    outputParts.push(pathValidation.error);
                    continue;
                }

                if (!FileSystemManager.hasPermission(pathValidation.node, currentUser, "read")) {
                    outputParts.push(`head: cannot open '${pathArg}' for reading: Permission denied`);
                    continue;
                }

                if (args.length > 1) {
                    outputParts.push(`==> ${pathArg} <==`);
                }

                const content = pathValidation.node.content || "";
                outputParts.push(processContent(content));

                if (args.length > 1 && i < args.length - 1) {
                    outputParts.push('\n');
                }
            }

            return { success: true, output: outputParts.join('\n') };
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