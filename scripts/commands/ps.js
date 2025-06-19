// scripts/commands/ps.js

(() => {
    "use strict";
    const psCommandDefinition = {
        commandName: "ps",
        argValidation: {
            exact: 0,
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
    const psDescription = "Displays a list of active background jobs.";
    const psHelpText = "Usage: ps";
    CommandRegistry.register("ps", psCommandDefinition, psDescription, psHelpText);

})();