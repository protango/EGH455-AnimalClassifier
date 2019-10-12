const { app, BrowserWindow, Menu, MenuItem } = require('electron')
const fs = require('fs')
var rimraf = require("rimraf");

/** @type {Electron.BrowserWindow} */
let win

function createWindow () {
  // create output dir
  try {
    if (fs.existsSync("./DLM/Output"))
      rimraf.sync("./DLM/Output");
    fs.mkdirSync("./DLM/Output");
  } catch {}

  win = new BrowserWindow({
    width: 1100,
    height: 590,
    webPreferences: {
      nodeIntegration: true
    }
  });

  win.loadFile('views/index.html');

const menu = new Menu()
menu.append(new MenuItem({ label: 'File', submenu: [{label: "Load Data"}, {label: "Import CSV"}] }))
menu.append(new MenuItem({ label: 'Help', submenu: [
   {label: "User Guide"}, 
   {label: "About"}, 
   {label: "Open Dev Tools", accelerator: 'CmdOrCtrl+Shift+I', click: () => {
      win.webContents.openDevTools({ mode: 'detach' });
   }}] 
}));
Menu.setApplicationMenu(menu);

  win.on('closed', () => {
    win = null
  })
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (win === null) {
    createWindow()
  }
})

