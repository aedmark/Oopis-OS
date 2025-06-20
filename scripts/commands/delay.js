/**
 * @file Defines the 'delay' command, which pauses command execution for a specified duration.
 * It is particularly useful in scripts for timed sequences or demonstrations.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} delayCommandDefinition
     * @description The command definition for the 'delay' command.
     * This object specifies the command's name, argument validation, and
     * the core logic for pausing execution. It supports cancellation via an AbortSignal,
     * which is used for background processes.
     */
    const delayCommandDefinition = {
        commandName: "delay",
        argValidation: {
            exact: 1,
        },
        /**
         * The core logic for the 'delay' command.
         * It parses the provided time in milliseconds and pauses execution for that duration.
         * It integrates with the AbortSignal mechanism to allow for early cancellation,
         * particularly important for background jobs.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command, expecting one numeric string (milliseconds).
         * @param {object} context.options - Execution options, including `isInteractive`.
         * @param {AbortSignal} context.signal - The AbortSignal for cancellation, used primarily by background jobs.
         * @returns {Promise<object>} A promise that resolves to a command result object.
         */
        coreLogic: async (context) => {
            const { args, options, signal } = context;
            // Parse the numeric argument for delay time, ensuring it's a positive integer.
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

            // Display a message if run interactively and not as part of a script.
            if (options.isInteractive && !CommandExecutor.isScriptRunning()) {
                await OutputManager.appendToOutput(`Delaying for ${ms}ms...`);
            }

            // Check if the operation was already aborted before starting the delay.
            if (signal?.aborted) {
                return { success: false, error: `delay: Operation already cancelled.` };
            }

            // Create a promise that resolves after the specified delay.
            const delayPromise = new Promise((resolve) => setTimeout(resolve, ms));

            // Create a promise that rejects if the AbortSignal is triggered.
            const abortPromise = new Promise((_, reject) => {
                if (!signal) return; // If no signal is provided (e.g., non-background), this promise won't be relevant.
                signal.addEventListener(
                    "abort",
                    () => {
                        reject(
                            new Error(`Operation cancelled. (Reason: ${signal.reason})`)
                        );
                    },
                    { once: true } // Ensure the listener is removed after first use.
                );
            });

            try {
                // Race the delay promise against the abort promise.
                // Whichever resolves/rejects first determines the outcome.
                await Promise.race([delayPromise, abortPromise]);

                // Display a completion message if run interactively and not as part of a script.
                if (options.isInteractive && !CommandExecutor.isScriptRunning()) {
                    await OutputManager.appendToOutput(`Delay complete.`);
                }
                return { success: true, output: "" };
            } catch (e) {
                // Catch errors from the abortPromise (i.e., when the signal is triggered).
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