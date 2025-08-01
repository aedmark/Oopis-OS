const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");

const isPackaged = app.isPackaged;

const rootDir = isPackaged
  ? path.dirname(app.getPath("exe"))
  : app.getAppPath();

const portableDataPath = path.join(rootDir, "data");
app.setPath("userData", portableDataPath);

console.log(
  "OopisOS is running in Portable Mode. Data will be stored at:",
  portableDataPath
);


function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 960,
    resizable: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname),
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow
      .loadFile(path.join(app.getAppPath(), "index.html"))
      .catch((err) => console.error("Failed to load index.html", err));

   mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  ipcMain.handle("dialog:showSaveDialog", async (event, options) => {
    const { filePath } = await dialog.showSaveDialog(options);
    return filePath;
  });

  ipcMain.handle("dialog:showOpenDialog", async (event, options) => {
    const { filePaths } = await dialog.showOpenDialog(options);
    return filePaths && filePaths.length > 0 ? filePaths[0] : null;
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
