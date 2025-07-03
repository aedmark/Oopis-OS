/**
 * @file Defines the 'run' command, which executes shell scripts within the OopisOS environment.
 * It supports argument passing, environment variable expansion, and handles interactive prompts
 * within scripts.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

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
        coreLogic: async (context) => {
            const { args, options, signal } = context;
            const scriptPathArg = args[0];
            const scriptArgs = args.slice(1);
            const scriptNode = context.validatedPaths[0].node;
            const fileExtension = Utils.getFileExtension(scriptPathArg);
            const MAX_SCRIPT_STEPS = Config.FILESYSTEM.MAX_SCRIPT_STEPS;
            let steps = 0;

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

            // This context is passed down, but the run command's loop will manage its own program counter.
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
            let programCounter = 0; // Use a dedicated program counter for the loop.

            while (programCounter < scriptingContext.lines.length) {
                // Set the shared context's index to our master program counter
                scriptingContext.currentLineIndex = programCounter;

                if (steps++ > MAX_SCRIPT_STEPS) {
                    overallScriptSuccess = false;
                    await OutputManager.appendToOutput(`Script '${scriptPathArg}' exceeded maximum execution steps (${MAX_SCRIPT_STEPS}). Terminating.`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                    break;
                }

                if (signal?.aborted) {
                    overallScriptSuccess = false;
                    await OutputManager.appendToOutput(`Script '${scriptPathArg}' cancelled.`, { typeClass: Config.CSS_CLASSES.WARNING_MSG });
                    if (scriptingContext.cancelCallback) scriptingContext.cancelCallback();
                    break;
                }

                const lineToExecuteIndex = programCounter;
                let line = scriptingContext.lines[lineToExecuteIndex];

                // --- Comment and empty line handling ---
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

                if (trimmedLine === '') {
                    programCounter++;
                    continue;
                }

                // --- Variable expansion ---
                let processedLine = line;
                for (let i = 0; i < scriptArgs.length; i++) {
                    processedLine = processedLine.replace(new RegExp(`\\$${i + 1}`, 'g'), scriptArgs[i]);
                }
                processedLine = processedLine.replace(/\$@/g, scriptArgs.join(" "));
                processedLine = processedLine.replace(/\$#/g, scriptArgs.length.toString());

                // --- Execute Command ---
                const result = await CommandExecutor.processSingleCommand(processedLine.trim(), { isInteractive: false, scriptingContext });

                // After execution, the correct next line is the one *after* where the
                // sub-process (like ModalInputManager) left off.
                programCounter = scriptingContext.currentLineIndex + 1;

                if (!result || !result.success) {
                    const errorMsg = `Script '${scriptPathArg}' error on line ${lineToExecuteIndex + 1}: ${scriptingContext.lines[lineToExecuteIndex]}\nError: ${result.error || result.output || 'Unknown error.'}`;
                    await OutputManager.appendToOutput(errorMsg, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                    overallScriptSuccess = false;
                    break;
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
       The scripting engine includes a governor to prevent infinite loops.
       A script that executes more than ${Config.FILESYSTEM.MAX_SCRIPT_STEPS} commands
       will be terminated to prevent the OS from becoming unresponsive.

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
       Welcome to OopisOS, Brave User! You provided 1 argument(s).`;

    CommandRegistry.register(runCommandDefinition.commandName, runCommandDefinition, runDescription, runHelpText);
})();