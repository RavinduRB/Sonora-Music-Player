const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('sonora', {
  minimize: () => ipcRenderer.send('sonora:minimize'),
  close: () => ipcRenderer.send('sonora:close'),
  getYoutubeMetadata: (url) => ipcRenderer.invoke('sonora:youtube-metadata', url),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  loadLibrary: () => ipcRenderer.invoke('sonora:load-library'),
  persistLibrary: (library) => ipcRenderer.invoke('sonora:persist-library', library),
  addLocalSongs: (songs) => ipcRenderer.invoke('sonora:add-local-songs', songs),
  updateLibrarySong: (update) => ipcRenderer.invoke('sonora:update-library-song', update),
  importLibraryFile: (filePath) => ipcRenderer.invoke('sonora:import-library-file', filePath),
  addYoutubeSong: (song) => ipcRenderer.invoke('sonora:add-youtube-song', song),
  updateYoutubeMetadata: (metadata) => ipcRenderer.invoke('sonora:update-youtube-metadata', metadata),
  removeLibrarySong: (songId) => ipcRenderer.invoke('sonora:remove-library-song', songId),
  saveLibrary: () => ipcRenderer.invoke('sonora:save-library'),
  setAlwaysOnTop: (enabled) => ipcRenderer.send('sonora:always-on-top', enabled),
  setWidgetRect: (rect) => ipcRenderer.send('sonora:widget-rect', rect),
  onTheme: (callback) => ipcRenderer.on('sonora:theme', (_event, theme) => callback(theme)),
  loadSettings: () => ipcRenderer.invoke('sonora:load-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('sonora:save-settings', settings),
  resize: (height) => ipcRenderer.send('sonora:resize', height)
});
