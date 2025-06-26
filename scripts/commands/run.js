(() => {
    "use strict";
    /**
     * @file Defines the 'run' command, which executes shell scripts within the OopisOS environment.
     * It supports argument passing, environment variable expansion, and handles interactive prompts
     * within scripts.
     * @author Andrew Edmark
     * @author Gemini
     */

    /**
     * @const {object} runCommandDefinition
     * @description The command definition for the 'run' command.
     * This object specifies the command's name, argument validation (at least one script path),
     * path validation (ensuring it's a file), required read and execute permissions,
     * and the core logic for script interpretation and execution.
     */
    const runCommandDefinition = {
        commandName: "run",
        argValidation: {
            min: 1, // Requires at least one argument: the script path.
        },
        pathValidation: [
            {
                argIndex: 0,
                options: {
                    expectedType: Config.FILESYSTEM.DEFAULT_FILE_TYPE, // The first argument must be a file.
                },
            },
        ],
        permissionChecks: [
            {
                pathArgIndex: 0,
                permissions: ["read", "execute"], // Script must be readable and executable.
            },
        ],
        /**
         * The core logic for the 'run' command.
         * It validates the script file type (.sh) and content.
         * It prevents nested script execution in interactive mode.
         * It sets up a `scriptingContext` to manage script state,
         * including lines, current line index, and callbacks for interactive inputs.
         * It then processes each line of the script, handling comments, argument expansion,
         * and executing commands. It pauses for interactive prompts if necessary
         * and stops execution on any command failure.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command,
         * where `args[0]` is the script path and subsequent args are script arguments.
         * @param {object} context.options - Execution options, including `isInteractive`.
         * @param {AbortSignal} context.signal - An AbortSignal for script cancellation (e.g., from `kill` command).
         * @returns {Promise<object>} A promise that resolves to a command result object
         * indicating the overall success or failure of the script execution.
         */
        coreLogic: async (context) => {
            const { args, options, signal } = context;
            const scriptPathArg = args[0];
            const scriptArgs = args.slice(1);
            const scriptNode = context.validatedPaths[0].node;
            const fileExtension = Utils.getFileExtension(scriptPathArg);

            if (fileExtension !== "sh") {
                return { success: false, error: `run: '${scriptPathArg}' is not a shell script (.sh) file.` };
            }
            if (!scriptNode.content) {
                return { success: true, output: `run: Script '${scriptPathArg}' is empty.` };
            }
            if (CommandExecutor.isScriptRunning() && options.isInteractive) {
                return { success: false, error: "run: Cannot execute a script while another is already running in interactive mode." };
            }

            const rawScriptLines = scriptNode.content.split('\n');

            const scriptingContext = {
                isScripting: true,
                waitingForInput: false,
                inputCallback: null,
                cancelCallback: null,
                lines: rawScriptLines,
                currentLineIndex: 0,
            };

            const previousScriptExecutionState = CommandExecutor.isScriptRunning();
            CommandExecutor.setScriptExecutionInProgress(true);
            if (options.isInteractive) TerminalUI.setInputState(false);

            let overallScriptSuccess = true;

            // Main script execution loop
            while (scriptingContext.currentLineIndex < scriptingContext.lines.length) {
                const lineIndexBeforeCommand = scriptingContext.currentLineIndex; // Capture index at start of loop

                if (signal?.aborted) {
                    overallScriptSuccess = false;
                    await OutputManager.appendToOutput(`Script '${scriptPathArg}' cancelled.`, { typeClass: Config.CSS_CLASSES.WARNING_MSG });
                    if (scriptingContext.cancelCallback) scriptingContext.cancelCallback();
                    break;
                }

                let line = scriptingContext.lines[scriptingContext.currentLineIndex];

                let inDoubleQuote = false;
                let inSingleQuote = false;
                let commentIndex = -1;
                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    const prevChar = i > 0 ? line[i - 1] : null;
                    if (char === '"' && prevChar !== '\\' && !inSingleQuote) {
                        inDoubleQuote = !inDoubleQuote;
                    } else if (char === '\'' && prevChar !== '\\' && !inDoubleQuote) {
                        inSingleQuote = !inSingleQuote;
                    } else if (char === '#' && !inDoubleQuote && !inSingleQuote) {
                        commentIndex = i;
                        break;
                    }
                }
                if (commentIndex !== -1) {
                    line = line.substring(0, commentIndex);
                }
                const trimmedLine = line.trim();

                if (scriptingContext.waitingForInput) {
                    const cb = scriptingContext.inputCallback;
                    scriptingContext.inputCallback = null;
                    scriptingContext.waitingForInput = false;
                    if (cb) {
                        await cb(trimmedLine);
                    }
                    if (scriptingContext.currentLineIndex === lineIndexBeforeCommand) {
                        scriptingContext.currentLineIndex++;
                    }
                    continue;
                }

                if (trimmedLine === '') {
                    if (scriptingContext.currentLineIndex === lineIndexBeforeCommand) {
                        scriptingContext.currentLineIndex++;
                    }
                    continue;
                }

                let processedLine = line;
                for (let i = 0; i < scriptArgs.length; i++) {
                    processedLine = processedLine.replace(new RegExp(`\\$${i + 1}`, 'g'), scriptArgs[i]);
                }
                processedLine = processedLine.replace(/\$@/g, scriptArgs.map(arg => arg.includes(" ") ? `"${arg}"` : arg).join(" "));
                processedLine = processedLine.replace(/\$#/g, scriptArgs.length.toString());

                const result = await CommandExecutor.processSingleCommand(processedLine.trim(), false, scriptingContext);

                if (scriptingContext.waitingForInput) {
                    let lineForInput = line;
                    const commentIndex = lineForInput.indexOf('#');
                    if (commentIndex !== -1) {
                        lineForInput = lineForInput.substring(0, commentIndex);
                    }
                    lineForInput = lineForInput.trim();
                    const cb = scriptingContext.inputCallback;
                    scriptingContext.inputCallback = null;
                    scriptingContext.waitingForInput = false;
                    if (cb) {
                        await cb(lineForInput);
                    }
                    if (scriptingContext.currentLineIndex === lineIndexBeforeCommand) {
                        scriptingContext.currentLineIndex++;
                    }
                    continue;
                }

                if (!result || !result.success) {
                    const errorMsg = `Script '${scriptPathArg}' error on line: ${scriptingContext.lines[scriptingContext.currentLineIndex]}\nError: ${result.error || result.output || 'Unknown error.'}`;
                    await OutputManager.appendToOutput(errorMsg, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                    overallScriptSuccess = false;
                    break;
                }

                // The command at `lineIndexBeforeCommand` and any lines it consumed as input have been processed.
                // We must always advance to the next line for the subsequent iteration of the loop.
                if (scriptingContext.currentLineIndex === lineIndexBeforeCommand) {
                    scriptingContext.currentLineIndex++;
                } else {
                    // If the index was advanced by a subroutine (like a password prompt),
                    // the loop will naturally continue from the new, correct index.
                    // However, we must increment once more to move *past* the line that was
                    // just consumed as input.
                    scriptingContext.currentLineIndex++;
                }
            }

            CommandExecutor.setScriptExecutionInProgress(previousScriptExecutionState);
            if (options.isInteractive && !CommandExecutor.isScriptRunning()) {
                TerminalUI.setInputState(true);
            }

            return {
                success: overallScriptSuccess,
                error: overallScriptSuccess ? null : `Script '${scriptPathArg}' failed.`
            };
        }
    };

    const runDescription = "Executes a shell script.";

    const runHelpText = `Usage: run <script_path> [arguments...]

Execute a shell script.

DESCRIPTION
       The run command executes a script file containing a sequence of
       OopisOS commands. The script is read and executed line by line.

       By convention, script files should have a '.sh' extension.
       To be executed, the script file must have execute (x) permissions
       for the current user (see 'chmod').

SCRIPTING
       Scripts can be made more powerful and flexible using the following
       features:

       Comments
              Lines beginning with a '#' are treated as comments and are
              ignored by the executor.

       Arguments
              You can pass arguments to your script from the command line.
              These arguments can be accessed within the script using
              special variables:
              $1, $2, ...  - The first, second, etc., argument.
              $@           - All arguments as a single string.
              $#           - The total number of arguments.

       Error Handling
              If any command within the script fails, the script will
              stop execution immediately.

WARNING
       The scripting engine does not have infinite loop detection.
       A script that does not terminate (e.g., 'while true; do echo hello; done')
       will cause the OopisOS tab to become unresponsive, requiring a
       manual browser page reload.

EXAMPLES
       Suppose you have a file named 'greet.sh' with the following content:
       #!/bin/oopis_shell
       # This is a simple greeting script
       echo "Welcome to OopisOS, $1! You provided $# argument(s)."

       First, make the script executable:
       chmod 755 greet.sh

       Then, run it with an argument:
       run ./greet.sh "Brave User"

       This will output:
       Welcome to OopisOS, Developer!`;

    CommandRegistry.register("run", runCommandDefinition, runDescription, runHelpText);
})();