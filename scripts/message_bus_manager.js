// /scripts/message_bus_manager.js

class MessageBusManager {
  constructor() {
    this.jobQueues = new Map();
  }

  registerJob(jobId) {
    if (!this.jobQueues.has(jobId)) {
      this.jobQueues.set(jobId, []);
    }
  }

  unregisterJob(jobId) {
    this.jobQueues.delete(jobId);
  }

  hasJob(jobId) {
    return this.jobQueues.has(jobId);
  }

  postMessage(jobId, message) {
    if (!this.jobQueues.has(jobId)) {
      return { success: false, error: "No such job ID registered." };
    }
    const queue = this.jobQueues.get(jobId);
    queue.push(message);
    return { success: true };
  }

  getMessages(jobId) {
    if (!this.jobQueues.has(jobId)) {
      return [];
    }
    const messages = this.jobQueues.get(jobId);
    this.jobQueues.set(jobId, []); // Clear the queue after reading
    return messages;
  }
}