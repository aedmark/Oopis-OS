// /scripts/commands/read_messages.js

(() => {
    "use strict";

    const readMessagesCommandDefinition = {
        commandName: "read_messages",
        argValidation: { exact: 0 },
        coreLogic: async (context) => {
            const jobId = context.options?.jobId;

            if (jobId === undefined) {
                return { success: false, error: "read_messages: can only be run from within a background job." };
            }

            const messages = MessageBusManager.getMessages(jobId);

            if (messages.length === 0) {
                return { success: true, output: "" };
            }

            return { success: true, output: messages.join('\n') };
        },
    };

    CommandRegistry.register(
        "read_messages",
        readMessagesCommandDefinition,
        "Reads messages from the job's own message queue.",
        "Usage: read_messages (must be run within a background job)"
    );
})();