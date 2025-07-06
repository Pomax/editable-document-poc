import { app, BrowserWindow } from "electron/main";
import path from "node:path";

function createWindow() {
  const win = new BrowserWindow({
    width: 960,
    height: 600,
    webPreferences: {
      preload: undefined,
    },
  });

  win.loadFile("index.html");
  win.webContents.openDevTools();
}

app.whenReady().then(() => {
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
