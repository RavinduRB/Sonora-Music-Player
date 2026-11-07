const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sonora', {
  minimize: () => ipcRenderer.send('sonora:minimize'),
  close: () => ipcRenderer.send('sonora:close'),
  getYoutubeMetadata: (url) => ipcRenderer.invoke('sonora:youtube-metadata', url),
  loadLibrary: () => ipcRenderer.invoke('sonora:load-library'),
  persistLibrary: (library) => ipcRenderer.invoke('sonora:persist-library', library),
  removeLibrarySong: (songId) => ipcRenderer.invoke('sonora:remove-library-song', songId),
  saveLibrary: (library) => ipcRenderer.invoke('sonora:save-library', library),
  setAlwaysOnTop: (enabled) => ipcRenderer.send('sonora:always-on-top', enabled),
  setWidgetRect: (rect) => ipcRenderer.send('sonora:widget-rect', rect),
  onTheme: (callback) => ipcRenderer.on('sonora:theme', (_event, theme) => callback(theme)),
  loadSettings: () => ipcRenderer.invoke('sonora:load-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('sonora:save-settings', settings),
  resize: (height) => ipcRenderer.send('sonora:resize', height)
});
