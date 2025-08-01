// /scripts/commands/agenda.js

window.AgendaCommand = class AgendaCommand extends Command {
    constructor() {
        super({
            commandName: "agenda",
            description: "Schedules commands to run at specified times or intervals.",
            helpText: `Usage: agenda <sub-command> [options]
      Manages scheduled background tasks.

      SUB-COMMANDS:
        add "<cron>" "<cmd>"  - Schedules a new command. (Requires root)
        list                 - Lists all scheduled commands.
        remove <id>          - Removes a scheduled command by its ID. (Requires root)
        start-daemon         - (Internal) Starts the scheduling service.`,
            isInputStream: false,
        });
    }

    async coreLogic(context) {
        const { args, currentUser, dependencies } = context;
        const { ErrorHandler, CommandExecutor, OutputManager } = dependencies;
        const subCommand = args[0];

        if (!subCommand) {
            return ErrorHandler.createError("agenda: missing sub-command. Use 'add', 'list', or 'remove'.");
        }

        if (['add', 'remove'].includes(subCommand.toLowerCase()) && currentUser !== 'root') {
            return ErrorHandler.createError(`agenda: modifying the schedule requires root privileges. Try 'sudo agenda ${args.join(' ')}'.`);
        }

        if (subCommand === '--daemon-start') {
            const daemon = new AgendaDaemon(dependencies);
            await daemon.run();
            return ErrorHandler.createSuccess("Agenda daemon started.");
        }

        const psResult = await CommandExecutor.processSingleCommand("ps", { isInteractive: false });
        const isDaemonRunning = psResult.output && psResult.output.includes("agenda --daemon-start");

        if (!isDaemonRunning) {
            await OutputManager.appendToOutput("Starting agenda daemon for the first time...");
            await CommandExecutor.processSingleCommand("agenda --daemon-start &", { isInteractive: false });
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        switch (subCommand.toLowerCase()) {
            case "add":
                return this._handleAdd(context);
            case "list":
                return this._handleList(context);
            case "remove":
                return this._handleRemove(context);
            default:
                return ErrorHandler.createError(`agenda: unknown sub-command '${subCommand}'.`);
        }
    }

    async _handleAdd(context) {
        const { args, dependencies } = context;
        const { ErrorHandler, MessageBusManager } = dependencies;

        if (args.length < 3) {
            return ErrorHandler.createError(`agenda add: expected at least 3 arguments, got ${args.length}. Usage: sudo agenda add "<cron_string>" "<command>"`);
        }
        const [_, cronString, ...commandParts] = args;
        const command = commandParts.join(' ');

        if (!cronString || !command) {
            return ErrorHandler.createError("Cron string and command must be provided.");
        }

        MessageBusManager.postMessage('agenda-daemon', {
            type: 'ADD_JOB',
            payload: { cronString, command }
        });

        await new Promise(resolve => setTimeout(resolve, 1000));
        return ErrorHandler.createSuccess("Job submitted to the agenda.");
    }

    async _handleList(context) {
        const { dependencies } = context;
        const { FileSystemManager, ErrorHandler } = dependencies;
        const schedulePath = '/etc/agenda.json';

        const scheduleNode = FileSystemManager.getNodeByPath(schedulePath);
        if (!scheduleNode) {
            return ErrorHandler.createSuccess("No scheduled jobs found.");
        }

        try {
            const schedule = JSON.parse(scheduleNode.content || '[]');
            if (schedule.length === 0) {
                return ErrorHandler.createSuccess("The agenda is currently empty.");
            }
            let output = "ID  Schedule             Command\n";
            output += "-------------------------------------\n";
            schedule.forEach(job => {
                output += `${String(job.id).padEnd(3)} ${job.cronString.padEnd(20)} ${job.command}\n`;
            });
            return ErrorHandler.createSuccess(output);
        } catch (e) {
            return ErrorHandler.createError("Could not read the agenda file. It may be corrupt.");
        }
    }

    async _handleRemove(context) {
        const { args, dependencies } = context;
        const { ErrorHandler, MessageBusManager } = dependencies;

        if (args.length !== 2) {
            return ErrorHandler.createError("Usage: sudo agenda remove <job_id>");
        }
        const jobId = parseInt(args[1], 10);
        if (isNaN(jobId)) {
            return ErrorHandler.createError("Invalid Job ID.");
        }

        MessageBusManager.postMessage('agenda-daemon', {
            type: 'REMOVE_JOB',
            payload: { jobId }
        });

        // Removed the potentially unsafe setTimeout usage
        return ErrorHandler.createSuccess(`Sent request to remove job ${jobId}.`);
    }
}

window.CommandRegistry.register(new AgendaCommand());

class AgendaDaemon {
    constructor(dependencies) {
        this.dependencies = dependencies;
        this.schedule = [];
        this.schedulePath = '/etc/agenda.json';
        this.jobCounter = 0;
        this.isRunning = false;
    }

    async _loadSchedule() {
        const { FileSystemManager } = this.dependencies;
        const node = FileSystemManager.getNodeByPath(this.schedulePath);
        if (node) {
            try {
                this.schedule = JSON.parse(node.content || '[]');
                this.jobCounter = this.schedule.reduce((maxId, job) => Math.max(maxId, job.id), 0);
            } catch (e) {
                console.error("AgendaDaemon: Could not parse schedule file.", e);
                this.schedule = [];
            }
        }
    }

    async _saveSchedule() {
        const { FileSystemManager } = this.dependencies;
        const content = JSON.stringify(this.schedule, null, 2);

        const saveResult = await FileSystemManager.createOrUpdateFile(
            this.schedulePath,
            content,
            { currentUser: 'root', primaryGroup: 'root' }
        );

        if (saveResult.success) {
            const scheduleNode = FileSystemManager.getNodeByPath(this.schedulePath);
            if (scheduleNode) {
                scheduleNode.owner = 'root';
                scheduleNode.group = 'root';
                scheduleNode.mode = 0o644;
            }
            await FileSystemManager.save();
        }
    }

    _parseCron(cronString) {
        const parts = cronString.split(' ');
        if (parts.length !== 5) return null;
        const [minute, hour, dayOfMonth] = parts;
        return { minute, hour, dayOfMonth };
    }

    _checkSchedule(now) {
        const { CommandExecutor } = this.dependencies;
        this.schedule.forEach(job => {
            const cron = this._parseCron(job.cronString);
            if (!cron) return;

            let shouldRun = true;
            if (cron.minute !== '*' && parseInt(cron.minute) !== now.getMinutes()) shouldRun = false;
            if (cron.hour !== '*' && parseInt(cron.hour) !== now.getHours()) shouldRun = false;
            if (cron.dayOfMonth !== '*' && parseInt(cron.dayOfMonth) !== now.getDate()) shouldRun = false;

            if (shouldRun) {
                console.log(`AgendaDaemon: Executing job ${job.id}: ${job.command}`);
                CommandExecutor.processSingleCommand(job.command, { isInteractive: false });
            }
        });
    }

    async _handleMessage(message) {
        if (!message || !message.type) return;

        switch (message.type) {
            case 'ADD_JOB':
                this.jobCounter++;
                this.schedule.push({ id: this.jobCounter, ...message.payload });
                await this._saveSchedule();
                break;
            case 'REMOVE_JOB':
                this.schedule = this.schedule.filter(job => job.id !== message.payload.jobId);
                await this._saveSchedule();
                break;
        }
    }

    async run() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log("AgendaDaemon: Starting up.");
        await this._loadSchedule();
        this.dependencies.MessageBusManager.registerJob('agenda-daemon');
        await this._runDaemonLoop();
    }

    async _runDaemonLoop() {
        while (true) {
            try {
                const now = new Date();
                await this._processMessages();
                this._checkSchedule(now);
                await this._waitUntilNextMinute(now);
            } catch (error) {
                console.error("AgendaDaemon: Encountered an error in the main loop, but I'm doing my best!", error);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    async _processMessages() {
        const messages = this.dependencies.MessageBusManager.getMessages('agenda-daemon');
        for (const msg of messages) {
            await this._handleMessage(msg);
        }
    }

    async _waitUntilNextMinute(currentTime) {
        const secondsUntilNextMinute = 60 - currentTime.getSeconds();
        await new Promise(resolve => setTimeout(resolve, secondsUntilNextMinute * 1000));
    }
}
