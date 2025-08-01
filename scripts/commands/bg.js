// scripts/commands/bg.js

window.BgCommand = class BgCommand extends Command {
    constructor() {
        super({
            commandName: "bg",
            description: "Resumes a stopped job in the background.",
            helpText: `Usage: bg [%job_id]
      Resumes a stopped background job, keeping it in the background.
      DESCRIPTION
      The bg (background) command resumes a job that has been stopped
      (e.g., with 'kill -STOP'), allowing it to continue its execution
      in the background.`,
            validations: {
                args: {
                    max: 1
                }
            },
        });
    }

    async coreLogic(context) {
        const { args, dependencies } = context;
        const { CommandExecutor, ErrorHandler } = dependencies;
        const jobIdArg = args[0] ? args[0].replace('%', '') : null;
        if (jobIdArg) {
            const jobId = parseInt(jobIdArg, 10);
            if (isNaN(jobId)) {
                return ErrorHandler.createError(`bg: invalid job ID: ${jobIdArg}`);
            }
            const result = CommandExecutor.sendSignalToJob(jobId, 'CONT');
            return result.success ? ErrorHandler.createSuccess() : ErrorHandler.createError(result.error);
        } else {
            const jobs = CommandExecutor.getActiveJobs();
            const jobIds = Object.keys(jobs);
            if (jobIds.length > 0) {
                const lastJobId = jobIds[jobIds.length - 1];
                const result = CommandExecutor.sendSignalToJob(parseInt(lastJobId, 10), 'CONT');
                return result.success ? ErrorHandler.createSuccess() : ErrorHandler.createError(result.error);
            } else {
                return ErrorHandler.createError("bg: no current job");
            }
        }
    }
}

window.CommandRegistry.register(new BgCommand());
