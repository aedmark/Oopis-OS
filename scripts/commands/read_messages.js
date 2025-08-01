// scripts/commands/read_messages.js

window.ReadMessagesCommand = class ReadMessagesCommand extends Command {
    constructor() {
        super({
            commandName: "read_messages",
            description: "Reads all messages from a job's message queue.",
            helpText: `Usage: read_messages <job_id>
      Read all messages from a background job's message queue.
      DESCRIPTION
      The read_messages command retrieves all pending string messages for
      the specified <job_id>. This is the counterpart to 'post_message'.
      Once read, the messages are removed from the queue.
      This command is intended for use within scripts ('run' command) to
      allow background processes to be controlled by other processes.
      The output is a space-separated string of all messages.
      EXAMPLES
      (In a script running as job 2)
      loop_variable=true
      while $loop_variable; do
          messages=$(read_messages 2)
          if [[ "$messages" == "stop" ]]; then
              loop_variable=false
          fi
          delay 1000
      done`,
            validations: {
                args: {
                    exact: 1
                }
            },
        });
    }

    async coreLogic(context) {
        const { args, dependencies } = context;
        const { MessageBusManager, ErrorHandler } = dependencies;

        try {
            const jobId = parseInt(args[0], 10);

            if (isNaN(jobId)) {
                return ErrorHandler.createError(
                    `read_messages: invalid job ID: ${args[0]}`
                );
            }

            const messages = MessageBusManager.getMessages(jobId);
            return ErrorHandler.createSuccess(messages.join(" "));
        } catch (e) {
            return ErrorHandler.createError(
                `read_messages: An unexpected error occurred: ${e.message}`
            );
        }
    }
}

window.CommandRegistry.register(new ReadMessagesCommand());
