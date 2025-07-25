// scripts/commands/kill.js
(() => {
    "use strict";

    const killCommandDefinition = {
        commandName: "kill",
        argValidation: {
            exact: 1,
            error: "Usage: kill <job_id>",
        },

        coreLogic: async (context) => {
            const { args } = context;

            try {
                const jobId = parseInt(args[0], 10);

                if (isNaN(jobId)) {
                    return {
                        success: false,
                        error: `kill: invalid job ID: ${args[0]}`,
                    };
                }

                const result = await CommandExecutor.killJob(jobId);

                return {
                    success: result.success,
                    output: result.message || "",
                    error: result.error || null,
                };
            } catch (e) {
                return { success: false, error: `kill: An unexpected error occurred: ${e.message}` };
            }
        },
    };

    const killDescription = "Terminates a background job.";

    const killHelpText = `Usage: kill <job_id>

Terminate a background job.

DESCRIPTION
       The kill command sends a termination signal to the background job
       identified by <job_id>.

       This is part of OopisOS's job control feature set. Use the 'ps'
       command to get a list of active background jobs and their
       corresponding job IDs.

EXAMPLES
       delay 10000 &
              [1] Backgrounded.
              
       ps
                PID   COMMAND
                1     delay 10000

       kill 1
              Signal sent to terminate job 1.`;

    CommandRegistry.register("kill", killCommandDefinition, killDescription, killHelpText);
})();