const { contextBridge, ipcRenderer } = require('electron/renderer')
const { main } = require('../../newScript')

contextBridge.exposeInMainWorld('value', {
  sendInput: (text) => ipcRenderer.send('submit-input', text),
})

contextBridge.exposeInMainWorld('search', {
  matchingArticles: async (search) => main(search)
})

