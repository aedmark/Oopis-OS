const {app, BrowserWindow, ipcMain, dialog} = require('electron');
const path = require('path');
const fs = require('fs');

// --- START: ENFORCED PORTABLE APP LOGIC ---

// Determine if we are running in a packaged app or in development
// The 'isPackaged' property is the correct one, not 'ispackaged'.
const isPackaged = app.isPackaged;

// Define the root directory of the application
const rootDir = isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath();

// Unconditionally set the user data path to be a 'data' folder
// right next to our executable. This enforces portable mode.
const portableDataPath = path.join(rootDir, 'data');
app.setPath('userData', portableDataPath);

// Log the enforced portable mode status.
console.log("OopisOS is running in Portable Mode. Data will be stored at:", portableDataPath);

// --- END: ENFORCED PORTABLE APP LOGIC ---


let mainWindow;

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 960,
        resizable: true,
        autoHideMenuBar: true, // This will hide the menu bar by default.
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
        const {filePath} = await dialog.showSaveDialog(options);
        return filePath;
    });

    // IPC handler for the restore command
    ipcMain.handle('dialog:showOpenDialog', async (event, options) => {
        const {filePaths} = await dialog.showOpenDialog(options);
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