// /scripts/commands/post_message.js

(() => {
    "use strict";

    const postMessageCommandDefinition = {
        commandName: "post_message",
        argValidation: {
            exact: 2,
            error: "Usage: post_message <job_id> <message>",
        },
        coreLogic: async (context) => {
            const { args } = context;
            const jobId = parseInt(args[0], 10);
            const message = args[1];

            if (isNaN(jobId)) {
                return { success: false, error: `Invalid job ID: '${args[0]}'` };
            }

            if (!MessageBusManager.hasJob(jobId)) {
                return { success: false, error: `No active job with ID: ${jobId}` };
            }

            const result = MessageBusManager.postMessage(jobId, message);

            if (result.success) {
                return { success: true, output: `Message sent to job ${jobId}.` };
            } else {
                return { success: false, error: result.error };
            }
        },
    };

    CommandRegistry.register(
        "post_message",
        postMessageCommandDefinition,
        "Sends a message to a background job.",
        "Usage: post_message <job_id> <message>"
    );
})();