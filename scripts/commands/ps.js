(() => {
    "use strict";
    /**
     * @file Defines the 'ps' command, which reports a snapshot of currently running background jobs.
     * It provides a list of process IDs (PIDs) and their associated commands.
     * @author Andrew Edmark
     * @author Gemini
     */

    /**
     * @const {object} psCommandDefinition
     * @description The command definition for the 'ps' command.
     * This object specifies the command's name, argument validation (no arguments expected),
     * and the core logic for listing background jobs.
     */
    const psCommandDefinition = {
        commandName: "ps",
        argValidation: {
            exact: 0, // This command takes no arguments.
        },
        /**
         * The core logic for the 'ps' command.
         * It retrieves all active background jobs from `CommandExecutor.getActiveJobs()`.
         * If there are no active jobs, it returns a message indicating that.
         * Otherwise, it formats the job information (PID and command string) into a table-like output.
         * @async
         * @returns {Promise<object>} A promise that resolves to a command result object
         * with the formatted list of background jobs or a message indicating no active jobs.
         */
        coreLogic: async () => {
            // Retrieve the active background jobs from the CommandExecutor.
            const jobs = CommandExecutor.getActiveJobs();
            const jobIds = Object.keys(jobs); // Get an array of all active job IDs.

            // If no active jobs, return a specific message.
            if (jobIds.length === 0) {
                return {
                    success: true,
                    output: "No active background jobs.",
                };
            }

            // Prepare the header for the output table.
            let outputLines = ["  PID   COMMAND"];

            // Iterate through each job ID and format its information.
            jobIds.forEach((id) => {
                const job = jobs[id];
                // Pad the PID to ensure consistent alignment in the output.
                outputLines.push(`  ${String(id).padEnd(5)} ${job.command}`);
            });

            // Join all formatted lines with newlines to create the final output string.
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