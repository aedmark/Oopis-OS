// scripts/commands/delay.js

(() => {
    "use strict";

    const delayCommandDefinition = {
        commandName: "delay",
        argValidation: {
            exact: 1,
        },
        coreLogic: async (context) => {
            const { args, options, signal } = context;
            const parsedArg = Utils.parseNumericArg(args[0], {
                allowFloat: false,
                allowNegative: false,
                min: 1,
            });

            if (parsedArg.error) {
                return {
                    success: false,
                    error: `delay: Invalid delay time '${args[0]}': ${parsedArg.error}. Must be a positive integer.`,
                };
            }

            const ms = parsedArg.value;

            if (options.isInteractive && !CommandExecutor.isScriptRunning()) {
                await OutputManager.appendToOutput(`Delaying for ${ms}ms...`);
            }

            if (signal?.aborted) {
                return { success: false, error: `delay: Operation already cancelled.` };
            }

            const delayPromise = new Promise((resolve) => setTimeout(resolve, ms));

            const abortPromise = new Promise((_, reject) => {
                if (!signal) return;
                signal.addEventListener(
                    "abort",
                    () => {
                        reject(
                            new Error(`Operation cancelled. (Reason: ${signal.reason})`)
                        );
                    },
                    { once: true }
                );
            });

            try {
                await Promise.race([delayPromise, abortPromise]);

                if (options.isInteractive && !CommandExecutor.isScriptRunning()) {
                    await OutputManager.appendToOutput(`Delay complete.`);
                }
                return { success: true, output: "" };
            } catch (e) {
                return { success: false, error: `delay: ${e.message}` };
            }
        },
    };
    const delayDescription = "Delays the execution of the next command for a specified amount of time.";
    const delayHelpText = "Usage: delay <milliseconds>\n\nDelays the execution of the next command for a specified amount of time.";
    CommandRegistry.register("delay", delayCommandDefinition, delayDescription, delayHelpText);

})();