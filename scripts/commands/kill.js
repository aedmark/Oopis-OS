/**
 * @file Defines the 'kill' command, which is used to terminate a running background job.
 * It allows users to manage processes initiated with the '&' operator.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} killCommandDefinition
     * @description The command definition for the 'kill' command.
     * This object specifies the command's name, argument validation (expecting a single job ID),
     * and the core logic for sending a termination signal to a background job.
     */
    const killCommandDefinition = {
        commandName: "kill",
        argValidation: {
            exact: 1, // Requires exactly one argument: the job ID.
            error: "Usage: kill <job_id>",
        },
        /**
         * The core logic for the 'kill' command.
         * It parses the provided job ID, validates it as a number, and then
         * attempts to terminate the corresponding background job using `CommandExecutor.killJob`.
         * It returns a success or error message based on the outcome of the termination attempt.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command, expecting a single job ID as a string.
         * @returns {Promise<object>} A promise that resolves to a command result object
         * indicating whether the job was successfully signaled for termination or if an error occurred.
         */
        coreLogic: async (context) => {
            const { args } = context;
            // Parse the first argument as an integer representing the job ID.
            const jobId = parseInt(args[0], 10);

            // Validate if the parsed job ID is a valid number.
            if (isNaN(jobId)) {
                return {
                    success: false,
                    error: `kill: invalid job ID: ${args[0]}`,
                };
            }

            // Attempt to kill the job using the CommandExecutor's internal function.
            const result = CommandExecutor.killJob(jobId);

            // Return the result of the kill operation, formatting output and error messages.
            return {
                success: result.success,
                output: result.message || "", // Message if successful (e.g., "Signal sent to terminate job X").
                error: result.error || null, // Error message if unsuccessful.
                messageType: result.success
                    ? Config.CSS_CLASSES.SUCCESS_MSG // Success styling.
                    : Config.CSS_CLASSES.ERROR_MSG, // Error styling.
            };
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