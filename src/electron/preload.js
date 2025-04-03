const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('value', {
  sendInput: (text) => ipcRenderer.send('submit-input', text)
})