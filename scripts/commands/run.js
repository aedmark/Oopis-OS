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

                let line = scriptingContext.lines[scriptingContext.currentLineIndex]; // Keep original for input
                const trimmedLine = line.trim();

                if (scriptingContext.waitingForInput) {
                    // New, more robust state management
                    const cb = scriptingContext.inputCallback;
                    scriptingContext.inputCallback = null;
                    scriptingContext.waitingForInput = false;

                    if (cb) {
                        await cb(line); // Pass the raw line, not trimmed
                    }
                    scriptingContext.currentLineIndex++;
                    continue;
                }

                if (trimmedLine.startsWith('#') || trimmedLine.startsWith('#!') || trimmedLine === '') {
                    scriptingContext.currentLineIndex++;
                    continue;
                }

                let processedLine = line; // Use original line for processing
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
                        await cb(lineForInput); // Use the cleaned line
                    }
                    scriptingContext.currentLineIndex++;
                    continue;
                }

                if (!result || !result.success) {
                    const errorMsg = `Script '${scriptPathArg}' error on line: ${line}\nError: ${result.error || result.output || 'Unknown error.'}`;
                    await OutputManager.appendToOutput(errorMsg, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                    overallScriptSuccess = false;
                    break; // Exit the script on the first error
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