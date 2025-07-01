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
         * appending the line as an argument.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The command and its initial arguments to be executed.
         * @param {object} context.options - Execution options, including stdinContent.
         * @returns {Promise<object>} A promise that resolves to the result of the last executed command.
         */
        coreLogic: async (context) => {
            const { args, options } = context;

            // xargs is only useful with piped input.
            if (options.stdinContent === null || options.stdinContent.trim() === "") {
                return { success: true, output: "" }; // Do nothing if there's no input.
            }

            const baseCommand = args.join(" ");
            const lines = options.stdinContent.trim().split('\n');
            let lastResult = { success: true, output: "" };
            let combinedOutput = [];

            for (const line of lines) {
                if (line.trim() === "") continue;

                // If the line contains spaces, wrap it in quotes to treat it as a single argument.
                const finalArg = line.includes(" ") ? `"${line}"` : line;
                const commandToExecute = `${baseCommand} ${finalArg}`;

                // Execute the constructed command.
                lastResult = await CommandExecutor.processSingleCommand(
                    commandToExecute,
                    { isInteractive: false } // Commands executed by xargs are non-interactive.
                );

                if (lastResult.output) {
                    combinedOutput.push(lastResult.output);
                }

                // If any command fails, stop execution and report the failure.
                if (!lastResult.success) {
                    const errorMsg = `xargs: ${commandToExecute}: ${lastResult.error || 'Command failed'}`;
                    // Don't append to output here, as processSingleCommand already did.
                    return { success: false, error: errorMsg };
                }
            }

            // Return the result of the last command, but with combined output.
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
       input and executes the specified [command] for each item,
       appending the item as the last argument to the command.

       This is a powerful utility for turning the output of commands
       like 'ls' or 'find' into actions.

EXAMPLES
       ls *.log | xargs rm
              Deletes all files ending in .log in the current directory.

       find . -name "*.tmp" | xargs rm
              Finds and deletes all files ending in .tmp in the
              current directory and its subdirectories.`;

    CommandRegistry.register("xargs", xargsCommandDefinition, xargsDescription, xargsHelpText);
})();