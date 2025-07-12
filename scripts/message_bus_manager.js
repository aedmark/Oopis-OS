// /scripts/message_bus_manager.js

const MessageBusManager = (() => {
    "use strict";

    // A simple in-memory store for message queues.
    const jobQueues = new Map();

    function registerJob(jobId) {
        if (!jobQueues.has(jobId)) {
            jobQueues.set(jobId, []);
        }
    }

    function unregisterJob(jobId) {
        jobQueues.delete(jobId);
    }

    function hasJob(jobId) {
        return jobQueues.has(jobId);
    }

    function postMessage(jobId, message) {
        if (!jobQueues.has(jobId)) {
            return { success: false, error: "No such job ID registered." };
        }
        const queue = jobQueues.get(jobId);
        queue.push(message);
        return { success: true };
    }

    function getMessages(jobId) {
        if (!jobQueues.has(jobId)) {
            return [];
        }
        const messages = jobQueues.get(jobId);
        jobQueues.set(jobId, []); // Clear the queue after reading
        return messages;
    }

    return {
        registerJob,
        unregisterJob,
        hasJob,
        postMessage,
        getMessages,
    };
})();