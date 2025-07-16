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

            try {
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

                if (options.isInteractive && !options.scriptingContext) {
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

                await Promise.race([delayPromise, abortPromise]);

                if (options.isInteractive && !options.scriptingContext) {
                    await OutputManager.appendToOutput(`Delay complete.`);
                }
                return { success: true, output: "" };
            } catch (e) {
                return { success: false, error: `delay: ${e.message}` };
            }
        },
    };

    const delayDescription = "Pauses execution for a specified time.";

    const delayHelpText = `Usage: delay <milliseconds>

Pause execution for a specified time.

DESCRIPTION
       The delay command pauses execution for the specified number of
       milliseconds.

       It is primarily used within scripts (\`run\` command) to create
       timed sequences or demonstrations.

EXAMPLES
       delay 1000
              Waits for 1000 milliseconds (1 second).

       delay 5000 &
              Starts a 5-second delay in the background. The job ID
              will be printed, and you can see it with 'ps'.`;

    CommandRegistry.register("delay", delayCommandDefinition, delayDescription, delayHelpText);
})();