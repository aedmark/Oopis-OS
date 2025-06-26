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
            const scriptPathArg = args[0]; // The path to the script file.
            const scriptArgs = args.slice(1); // Arguments passed to the script.
            const scriptNode = context.validatedPaths[0].node; // The file system node of the script.
            const fileExtension = Utils.getFileExtension(scriptPathArg);

            // Validate script file extension.
            if (fileExtension !== "sh") {
                return { success: false, error: `run: '${scriptPathArg}' is not a shell script (.sh) file.` };
            }
            // Check if the script content is empty.
            if (!scriptNode.content) {
                return { success: true, output: `run: Script '${scriptPathArg}' is empty.` };
            }
            // Prevent nested script execution in interactive mode.
            if (CommandExecutor.isScriptRunning() && options.isInteractive) {
                return { success: false, error: "run: Cannot execute a script while another is already running in interactive mode." };
            }

            const rawScriptLines = scriptNode.content.split('\n');

            // Initialize the scripting context.
            const scriptingContext = {
                isScripting: true, // Flag indicating script is running.
                waitingForInput: false, // Flag for when script is waiting for user/scripted input.
                inputCallback: null, // Callback to resolve when input is received.
                cancelCallback: null, // Callback to resolve if input is cancelled.
                lines: rawScriptLines, // All lines of the script.
                currentLineIndex: 0, // Current line being executed.
            };

            // Save previous script execution state and set new state.
            const previousScriptExecutionState = CommandExecutor.isScriptRunning();
            CommandExecutor.setScriptExecutionInProgress(true);
            // If interactive, temporarily disable terminal input.
            if (options.isInteractive) TerminalUI.setInputState(false);

            let overallScriptSuccess = true; // Tracks if the entire script executed successfully.

            // Main script execution loop.
            while (scriptingContext.currentLineIndex < scriptingContext.lines.length) {
                // Check if the script has been aborted (e.g., via `kill` command).
                if (signal?.aborted) {
                    overallScriptSuccess = false;
                    await OutputManager.appendToOutput(`Script '${scriptPathArg}' cancelled.`, { typeClass: Config.CSS_CLASSES.WARNING_MSG });
                    if (scriptingContext.cancelCallback) scriptingContext.cancelCallback();
                    break; // Exit loop on cancellation.
                }

                let line = scriptingContext.lines[scriptingContext.currentLineIndex];

                // --- START OF REFINED FIX FOR COMMENT HANDLING ---
                // This logic correctly finds the first '#' that is not inside single or double quotes.
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
                        break; // Found the real comment, no need to look further.
                    }
                }

                if (commentIndex !== -1) {
                    line = line.substring(0, commentIndex); // Truncate line at the start of the comment.
                }
                const trimmedLine = line.trim();
                // --- END OF REFINED FIX ---


                // Handle cases where the script is waiting for interactive input (e.g., from `ModalManager.request`).
                if (scriptingContext.waitingForInput) {
                    const cb = scriptingContext.inputCallback; // Get the pending callback.
                    scriptingContext.inputCallback = null; // Clear callback.
                    scriptingContext.waitingForInput = false; // Reset waiting flag.

                    if (cb) {
                        await cb(trimmedLine); // Provide the current line as input to the waiting callback.
                    }
                    scriptingContext.currentLineIndex++; // Move to next script line.
                    continue;
                }

                // Skip empty lines (after comment removal).
                if (trimmedLine === '') {
                    scriptingContext.currentLineIndex++;
                    continue;
                }

                // Process command line arguments ($1, $2, $@, $#).
                let processedLine = line;
                for (let i = 0; i < scriptArgs.length; i++) {
                    processedLine = processedLine.replace(new RegExp(`\\$${i + 1}`, 'g'), scriptArgs[i]);
                }
                processedLine = processedLine.replace(/\$@/g, scriptArgs.map(arg => arg.includes(" ") ? `"${arg}"` : arg).join(" "));
                processedLine = processedLine.replace(/\$#/g, scriptArgs.length.toString());

                // Execute the processed command line. Commands within a script are non-interactive.
                const result = await CommandExecutor.processSingleCommand(processedLine.trim(), false, scriptingContext);

                // Handle cases where `processSingleCommand` sets `waitingForInput` (e.g., `rm -i` in script).
                if (scriptingContext.waitingForInput) {
                    let lineForInput = line; // Use the original line (before trimming/comment removal) for input to preserve context.
                    const commentIndex = lineForInput.indexOf('#'); // Re-find comment index.
                    if (commentIndex !== -1) {
                        lineForInput = lineForInput.substring(0, commentIndex);
                    }
                    lineForInput = lineForInput.trim(); // Trim for actual input.

                    const cb = scriptingContext.inputCallback;
                    scriptingContext.inputCallback = null;
                    scriptingContext.waitingForInput = false;

                    if (cb) {
                        await cb(lineForInput);
                    }
                    scriptingContext.currentLineIndex++;
                    continue;
                }

                // If any command within the script fails, set overall success to false and break the loop.
                if (!result || !result.success) {
                    const errorMsg = `Script '${scriptPathArg}' error on line: ${scriptingContext.lines[scriptingContext.currentLineIndex]}\nError: ${result.error || result.output || 'Unknown error.'}`;
                    await OutputManager.appendToOutput(errorMsg, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                    overallScriptSuccess = false;
                    break;
                }
                scriptingContext.currentLineIndex++; // Move to the next line.
            }

            // Restore previous script execution state and re-enable terminal input if necessary.
            CommandExecutor.setScriptExecutionInProgress(previousScriptExecutionState);
            if (options.isInteractive && !CommandExecutor.isScriptRunning()) {
                TerminalUI.setInputState(true);
            }

            // Return the final result of the script execution.
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