// scripts/commands/fg.js

window.FgCommand = class FgCommand extends Command {
    constructor() {
        super({
            commandName: "fg",
            description: "Resumes a job in the foreground.",
            helpText: `Usage: fg [%job_id]
      Resumes a stopped or background job in the foreground.
      DESCRIPTION
      The fg (foreground) command brings the specified job to the
      foreground, making it the active process in the terminal. If no
      job ID is specified, the most recently backgrounded job is used.
      (Note: True foreground process control is not yet implemented in OopisOS, this command currently only resumes a stopped job).`,
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
                return ErrorHandler.createError(`fg: invalid job ID: ${jobIdArg}`);
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
                return ErrorHandler.createError("fg: no current job");
            }
        }
    }
}

window.CommandRegistry.register(new FgCommand());
