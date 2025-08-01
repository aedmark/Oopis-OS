// scripts/commands/kill.js

window.KillCommand = class KillCommand extends Command {
  constructor() {
    super({
      commandName: "kill",
      description: "Terminates, pauses, or continues background jobs.",
      helpText: `Usage: kill [signal] <job_id>
      Send a signal to a background job.
      DESCRIPTION
      The kill command sends a signal to the background job identified by
      <job_id>. Use the 'ps' command to get a list of active background jobs.
      SIGNALS
      -s, --signal <signal>
            Specify the signal to send. Can be KILL, TERM, STOP, or CONT.
      -STOP
            Stop (pause) the job.
      -CONT
            Continue (resume) a stopped job.
      -KILL
            Forcibly terminate the job.
      If no signal is specified, the default is to terminate the job (TERM).
      EXAMPLES
      kill 1
      Terminates job 1.
      kill -STOP 1
      Pauses job 1. You will see its status as 'T' in 'ps'.
      kill -CONT 1
      Resumes job 1.`,
      flagDefinitions: [
        { name: "signal", short: "-s", long: "--signal", takesValue: true },
        { name: "STOP", short: "-STOP" },
        { name: "CONT", short: "-CONT" },
        { name: "KILL", short: "-KILL" },
        { name: "TERM", short: "-TERM" },
      ],
      argValidation: {
        min: 1,
        error: "Usage: kill [signal] <job_id>",
      },
    });
  }

  async coreLogic(context) {
    const { args, flags, dependencies } = context;
    const { ErrorHandler, CommandExecutor, Utils } = dependencies;

    let signal = "TERM";
    const signalFlags = ["STOP", "CONT", "KILL", "TERM"];
    let signalsProvided = [];

    if (flags.signal) {
      signalsProvided.push(flags.signal.toUpperCase());
    }
    signalFlags.forEach(sig => {
      if (flags[sig]) {
        signalsProvided.push(sig);
      }
    });

    if (signalsProvided.length > 1) {
      return ErrorHandler.createError("kill: only one signal may be specified.");
    }
    if (signalsProvided.length === 1) {
      signal = signalsProvided[0];
    }

    const validSignals = ["KILL", "TERM", "STOP", "CONT"];
    if (!validSignals.includes(signal)) {
      return ErrorHandler.createError(`kill: invalid signal: ${signal}`);
    }

    const jobIdArg = args[0];
    const parsedJobId = Utils.parseNumericArg(jobIdArg, { allowFloat: false, allowNegative: false });

    if (parsedJobId.error) {
      return ErrorHandler.createError(`kill: invalid job ID: ${jobIdArg}`);
    }
    const jobId = parsedJobId.value;

    const result = CommandExecutor.sendSignalToJob(jobId, signal);

    if (result.success) {
      return ErrorHandler.createSuccess(result.data || "");
    } else {
      return ErrorHandler.createError(result.error || "Failed to send signal to job.");
    }
  }
}

window.CommandRegistry.register(new KillCommand());
