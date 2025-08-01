// scripts/commands/jobs.js

window.JobsCommand = class JobsCommand extends Command {
    constructor() {
        super({
            commandName: "jobs",
            description: "Lists active background jobs for the current session.",
            helpText: `Usage: jobs
      Lists the background jobs that were started from the current terminal.
      DESCRIPTION
      The jobs command provides a list of processes that are running in the
      background. This is similar to 'ps', but is typically used to manage
      jobs that can be brought to the foreground with 'fg'.`,
            validations: {
                args: {
                    exact: 0
                }
            },
        });
    }

    async coreLogic(context) {
        const { dependencies } = context;
        const { CommandExecutor, ErrorHandler } = dependencies;
        const jobs = CommandExecutor.getActiveJobs();
        const outputLines = [];

        Object.values(jobs).forEach((job, index) => {
            outputLines.push(`[${job.id}]  ${job.status.padEnd(8)}  ${job.command}`);
        });

        if (outputLines.length === 0) {
            return ErrorHandler.createSuccess("");
        }

        return ErrorHandler.createSuccess(outputLines.join("\n"));
    }
}

window.CommandRegistry.register(new JobsCommand());
