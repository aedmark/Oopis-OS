const { contextBridge, ipcRenderer } = require('electron');

// Expose a controlled API to the renderer process (OopisOS)
contextBridge.exposeInMainWorld('electronAPI', {
    /**
     * Invokes the main process to show a native "Save File" dialog.
     * @param {object} options - Options for the save dialog (e.g., defaultPath).
     * @returns {Promise<string|null>} A promise that resolves with the selected file path or null if cancelled.
     */
    showSaveDialog: (options) => ipcRenderer.invoke('dialog:showSaveDialog', options),

    /**
     * Invokes the main process to show a native "Open File" dialog.
     * @param {object} options - Options for the open dialog (e.g., filters).
     * @returns {Promise<string|null>} A promise that resolves with the selected file path or null if cancelled.
     */
    showOpenDialog: (options) => ipcRenderer.invoke('dialog:showOpenDialog', options)
});