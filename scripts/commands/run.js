// scripts/commands/run.js

(() => {
    "use strict";
    const runCommandDefinition = {
        commandName: "run",
        argValidation: {
            min: 1,
        },
        pathValidation: [
            {
                argIndex: 0,
                options: {
                    expectedType: Config.FILESYSTEM.DEFAULT_FILE_TYPE,
                },
            },
        ],
        permissionChecks: [
            {
                pathArgIndex: 0,
                permissions: ["read", "execute"],
            },
        ],
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

            while (scriptingContext.currentLineIndex < scriptingContext.lines.length) {
                if (signal?.aborted) {
                    overallScriptSuccess = false;
                    await OutputManager.appendToOutput(`Script '${scriptPathArg}' cancelled.`, { typeClass: Config.CSS_CLASSES.WARNING_MSG });
                    if (scriptingContext.cancelCallback) scriptingContext.cancelCallback();
                    break;
                }

                let line = scriptingContext.lines[scriptingContext.currentLineIndex];

                // --- START OF FIX ---
                // Find the first '#' and treat the rest of the line as a comment.
                const commentIndex = line.indexOf('#');
                if (commentIndex !== -1) {
                    line = line.substring(0, commentIndex);
                }
                const trimmedLine = line.trim();
                // --- END OF FIX ---


                if (scriptingContext.waitingForInput) {
                    // This block handles scripted input for interactive prompts like 'rm -i'
                    const cb = scriptingContext.inputCallback;
                    scriptingContext.inputCallback = null;
                    scriptingContext.waitingForInput = false;

                    if (cb) {
                        await cb(trimmedLine);
                    }
                    scriptingContext.currentLineIndex++;
                    continue;
                }

                if (trimmedLine === '') { // Use the now-comment-free trimmedLine
                    scriptingContext.currentLineIndex++;
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
                    scriptingContext.currentLineIndex++;
                    continue;
                }

                if (!result || !result.success) {
                    const errorMsg = `Script '${scriptPathArg}' error on line: ${scriptingContext.lines[scriptingContext.currentLineIndex]}\nError: ${result.error || result.output || 'Unknown error.'}`;
                    await OutputManager.appendToOutput(errorMsg, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                    overallScriptSuccess = false;
                    break;
                }
                scriptingContext.currentLineIndex++;
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
    const runDescription = "Runs a shell script.";
    const runHelpText = "Usage: run [script] [args]\n\nRuns the specified shell script with the specified arguments.";
    CommandRegistry.register("run", runCommandDefinition, runDescription, runHelpText);
})();