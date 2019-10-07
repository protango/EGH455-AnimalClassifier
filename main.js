const { app, BrowserWindow } = require('electron')
const fs = require('fs')
var rimraf = require("rimraf");

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
  })

  win.loadFile('views/index.html')

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

