// scripts/commands/delay.js

window.DelayCommand = class DelayCommand extends Command {
    constructor() {
        super({
            commandName: "delay",
            description: "Pauses script or command execution for a specified time.",
            helpText: `Usage: delay <milliseconds>
      Pause execution for a specified time.
      DESCRIPTION
      The delay command pauses execution for the specified number of
      milliseconds.
      It is primarily used within scripts ('run' command) to create
      timed sequences or demonstrations.
      EXAMPLES
      delay 1000
      Waits for 1000 milliseconds (1 second).
      delay 5000 &
      Starts a 5-second delay in the background. The job ID
      will be printed, and you can see it with 'ps'.`,
            validations: {
                args: {
                    exact: 1
                }
            },
        });
    }

    async coreLogic(context) {
        const { args, options, signal, dependencies } = context;
        const { Utils, ErrorHandler, OutputManager } = dependencies;

        const parsedArg = Utils.parseNumericArg(args[0], {
            allowFloat: false,
            allowNegative: false,
            min: 1,
        });

        if (parsedArg.error) {
            return ErrorHandler.createError(
                `delay: Invalid delay time '${args[0]}': ${parsedArg.error}. Must be a positive integer.`
            );
        }

        const ms = parsedArg.value;

        if (options.isInteractive && !options.scriptingContext) {
            await OutputManager.appendToOutput(`Delaying for ${ms}ms...`);
        }

        if (signal?.aborted) {
            return ErrorHandler.createError(
                `delay: Operation already cancelled.`
            );
        }

        // Use a safe delay function instead of setTimeout
        const delayPromise = Utils.safeDelay(ms);

        const abortPromise = new Promise((resolve) => {
            if (!signal) return;
            signal.addEventListener(
                "abort",
                () => {
                    resolve("cancelled");
                },
                { once: true }
            );
        });

        const result = await Promise.race([delayPromise, abortPromise]);
        
        if (result === "cancelled") {
            return ErrorHandler.createSuccess("");
        }

        if (options.isInteractive && !options.scriptingContext) {
            await OutputManager.appendToOutput(`Delay complete.`);
        }
        return ErrorHandler.createSuccess("");
    }
}

window.CommandRegistry.register(new DelayCommand());
