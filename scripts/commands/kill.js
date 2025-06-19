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
            const jobId = parseInt(args[0], 10);
            if (isNaN(jobId)) {
                return {
                    success: false,
                    error: `kill: invalid job ID: ${args[0]}`,
                };
            }
            const result = CommandExecutor.killJob(jobId);
            return {
                success: result.success,
                output: result.message || "",
                error: result.error || null,
                messageType: result.success
                    ? Config.CSS_CLASSES.SUCCESS_MSG
                    : Config.CSS_CLASSES.ERROR_MSG,
            };
        },
    };
    const killDescription = "Kills a running job.";
    const killHelpText = "Usage: kill <job_id>";
    CommandRegistry.register("kill", killCommandDefinition, killDescription, killHelpText);

})();