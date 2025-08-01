// scripts/commands/ps.js

window.PsCommand = class PsCommand extends Command {
    constructor() {
        super({
            commandName: "ps",
            description: "Reports a snapshot of the current background processes.",
            helpText: `Usage: ps
      Report a snapshot of current background processes.
      DESCRIPTION
      The ps command displays information about active background jobs
      started with the '&' operator.
      The output includes:
      PID     The unique process ID for the job.
      STAT    The current status of the job (R for running, T for stopped).
      COMMAND The command that was executed.
      Use 'kill <PID>' to terminate a background job.`,
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

        if (Object.keys(jobs).length === 0) {
            return ErrorHandler.createSuccess("");
        }

        let output = "  PID  STAT  COMMAND\n";
        for (const pid in jobs) {
            const job = jobs[pid];
            const command = job.command;
            let status = 'R';
            if (job.status === 'paused') {
                status = 'T';
            }

            output += `  ${String(pid).padEnd(4)} ${status.padEnd(5)} ${command}\n`;
        }

        return ErrorHandler.createSuccess(output.trim());
    }
}

window.CommandRegistry.register(new PsCommand());
