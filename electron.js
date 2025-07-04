const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 960,
        resizable: false,
        frame: process.platform === 'darwin' ? true : false, // On macOS, we handle the frame differently
        titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            sandbox: true
        }
    });

    mainWindow.loadFile('index.html');

    // For debugging, you can uncomment the next line
    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    // IPC handler for the backup command
    ipcMain.handle('dialog:showSaveDialog', async (event, options) => {
        const { filePath } = await dialog.showSaveDialog(options);
        return filePath;
    });

    // IPC handler for the restore command
    ipcMain.handle('dialog:showOpenDialog', async (event, options) => {
        const { filePaths } = await dialog.showOpenDialog(options);
        return filePaths && filePaths.length > 0 ? filePaths[0] : null;
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});