const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// --- START: PORTABLE APP LOGIC ---

// Determine if we are running in a packaged app or in development
const ispackaged = app.ispackaged;

// Define the root directory of the application
// CORRECTED LINE: app.getPath('exe') and app.getAppPath()
const rootdir = ispackaged ? path.dirname(app.getPath('exe')) : app.getAppPath();

// Define the path to our portable mode marker file
const portablemarkpath = path.join(rootdir, '.portable');

// Check if the marker file exists
if (fs.existsSync(portablemarkpath)) {
    // If it exists, we set the user data path to be a 'data' folder
    // right next to our executable.
    const portabledatapath = path.join(rootdir, 'data');
    app.setPath('userData', portabledatapath);
    console.log("Running in Portable Mode. Data stored at:", portabledatapath);
}

// --- END: PORTABLE APP LOGIC ---


let mainWindow;

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 960,
        resizable: true,
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