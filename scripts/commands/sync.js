(() => {
    "use strict";

    const syncCommandDefinition = {
        commandName: "sync",
        argValidation: {
            exact: 0,
        },
        coreLogic: async () => {
            try {
                const saveSuccessful = await FileSystemManager.save();
                if (saveSuccessful) {
                    return { success: true, output: "" };
                } else {
                    return { success: false, error: "sync: Filesystem failed to save state." };
                }
            } catch (error) {
                console.error("Error during sync operation:", error);
                return { success: false, error: "sync: An unexpected error occurred." };
            }
        }
    };

    const syncDescription = "Commit filesystem caches to persistent storage.";

    const syncHelpText = `Usage: sync

Flush file system buffers.

DESCRIPTION
       The sync command forces a write of all buffered file system data
       in memory (the live fsData object) to the underlying persistent
       storage (IndexedDB).

       While most file operations in OopisOS trigger a save automatically,
       'sync' can be used to ensure all pending changes are written before
       a critical operation or closing the session.`;

    CommandRegistry.register("sync", syncCommandDefinition, syncDescription, syncHelpText);
})();