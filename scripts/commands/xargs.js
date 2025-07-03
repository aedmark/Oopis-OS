/**
 * @file Defines the 'xargs' command, which builds and executes command lines from standard input.
 * It serves as a crucial bridge between commands that output lists of items and commands that operate on them.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} xargsCommandDefinition
     * @description The command definition for the 'xargs' command.
     */
    const xargsCommandDefinition = {
        commandName: "xargs",
        argValidation: {
            min: 1, // Requires at least one argument: the command to execute.
            error: "missing command",
        },
        /**
         * The core logic for the 'xargs' command.
         * It reads lines from standard input and executes a specified command for each line,
         * appending the line as an argument or inserting it at the {} placeholder.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The command and its initial arguments to be executed.
         * @param {object} context.options - Execution options, including stdinContent.
         * @returns {Promise<object>} The result of the last executed command.
         */
        coreLogic: async (context) => {
            const { args, options } = context;

            if (options.stdinContent === null || options.stdinContent.trim() === "") {
                return { success: true, output: "" };
            }

            const baseCommand = args.join(" ");
            const lines = options.stdinContent.trim().split('\n');
            let lastResult = { success: true, output: "" };
            let combinedOutput = [];

            const hasPlaceholder = baseCommand.includes('{}');

            for (const line of lines) {
                if (line.trim() === "") continue;

                const finalArg = line.includes(" ") ? `"${line}"` : line;
                let commandToExecute;

                if (hasPlaceholder) {
                    commandToExecute = baseCommand.replace('{}', finalArg);
                } else {
                    commandToExecute = `${baseCommand} ${finalArg}`;
                }

                lastResult = await CommandExecutor.processSingleCommand(
                    commandToExecute,
                    { isInteractive: false }
                );

                if (lastResult.output) {
                    combinedOutput.push(lastResult.output);
                }

                if (!lastResult.success) {
                    const errorMsg = `xargs: ${commandToExecute}: ${lastResult.error || 'Command failed'}`;
                    return { success: false, error: errorMsg };
                }
            }

            return {
                success: lastResult.success,
                output: combinedOutput.join('\n')
            };
        },
    };

    const xargsDescription = "Builds and executes command lines from standard input.";

    const xargsHelpText = `Usage: xargs [command]

Read items from standard input and execute a command for each item.

DESCRIPTION
       The xargs command reads newline-delimited items from standard
       input and executes the specified [command] for each item.

       By default, the item is appended as the last argument. If the
       string '{}' appears in the command, it will be replaced by the
       input item instead.

       This is a powerful utility for turning the output of commands
       like 'ls' or 'find' into actions.

EXAMPLES
       ls *.log | xargs rm
              Deletes all files ending in .log in the current directory.

       find . -name "*.tmp" | xargs rm
              Finds and deletes all files ending in .tmp in the
              current directory and its subdirectories.
              
       ls *.txt | xargs -I {} mv {} {}.bak
              Renames all .txt files to .txt.bak.`;

    CommandRegistry.register("xargs", xargsCommandDefinition, xargsDescription, xargsHelpText);
})();