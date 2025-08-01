// scripts/commands/post_message.js

window.PostMessageCommand = class PostMessageCommand extends Command {
    constructor() {
        super({
            commandName: "post_message",
            description: "Sends a message to a background job.",
            helpText: `Usage: post_message <job_id> "<message>"
      Send a message to a background job's message queue.
      DESCRIPTION
      The post_message command allows for inter-process communication
      by sending a string <message> to the specified <job_id>.
      Background jobs can check for and read these messages using the
      'read_messages' command. This enables dynamic control over
      long-running background tasks.
      The <message> must be enclosed in quotes.
      EXAMPLES
      post_message 1 "stop"
      Sends the message "stop" to the job with ID 1.`,
            validations: {
                args: {
                    exact: 2
                }
            },
        });
    }

    async coreLogic(context) {
        const { args, dependencies } = context;
        const { MessageBusManager, ErrorHandler } = dependencies;

        try {
            const jobId = parseInt(args[0], 10);
            const message = args[1];

            if (isNaN(jobId)) {
                return ErrorHandler.createError(
                    `post_message: invalid job ID: ${args[0]}`
                );
            }

            if (typeof message !== "string") {
                return ErrorHandler.createError("post_message: message must be a string");
            }

            const result = MessageBusManager.postMessage(jobId, message);

            if (result.success) {
                return ErrorHandler.createSuccess("");
            } else {
                return ErrorHandler.createError(
                    result.error || `Failed to post message to job ${jobId}.`
                );
            }
        } catch (e) {
            return ErrorHandler.createError(
                `post_message: An unexpected error occurred: ${e.message}`
            );
        }
    }
}

window.CommandRegistry.register(new PostMessageCommand());
