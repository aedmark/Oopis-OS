// scripts/commands/sync.js

window.SyncCommand = class SyncCommand extends Command {
  constructor() {
    super({
      commandName: "sync",
      description: "Manually saves the current file system to the database.",
      helpText: `Usage: sync
      Synchronize cached file data with persistent storage.
      DESCRIPTION
      The sync command writes any buffered file system modifications to
      the underlying persistent storage (IndexedDB).
      In OopisOS, this happens automatically on events like logout, but
      'sync' provides a way to force a save manually, ensuring data

      persistence without ending the session.`,
      validations: {
        args: {
          exact: 0
        }
      },
    });
  }

  async coreLogic(context) {
    const { dependencies, currentUser } = context;
    const { FileSystemManager, ErrorHandler } = dependencies;

    try {
      await FileSystemManager.save(currentUser);
      return ErrorHandler.createSuccess(
          "File system cache synchronized with persistent storage."
      );
    } catch (e) {
      return ErrorHandler.createError(
          `sync: An error occurred during synchronization: ${e.message}`
      );
    }
  }
}

window.CommandRegistry.register(new SyncCommand());
