(() => {
    "use strict";

    const psCommandDefinition = {
        commandName: "ps",
        argValidation: {
            exact: 0, // This command takes no arguments.
        },

        coreLogic: async () => {
            const jobs = CommandExecutor.getActiveJobs();
            const jobIds = Object.keys(jobs);

            if (jobIds.length === 0) {
                return {
                    success: true,
                    output: "No active background jobs.",
                };
            }

            let outputLines = ["  PID   COMMAND"];

            jobIds.forEach((id) => {
                const job = jobs[id];
                outputLines.push(`  ${String(id).padEnd(5)} ${job.command}`);
            });

            return {
                success: true,
                output: outputLines.join("\n"),
            };
        },
    };

    const psDescription = "Reports a snapshot of current background jobs.";

    const psHelpText = `Usage: ps

Report a snapshot of the current background processes.

DESCRIPTION
       The ps command displays information about active background jobs
       running in the current session.

       To start a background job, append an ampersand (&) to your command.
       Each job is assigned a unique Process ID (PID) which can be used
       by the 'kill' command to terminate the process.

EXAMPLES
       delay 10000 &
              [1] Backgrounded.
       ps
                PID   COMMAND
                1     delay 10000`;

    CommandRegistry.register("ps", psCommandDefinition, psDescription, psHelpText);
})();