const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onWindowStateChanged: (cb) => ipcRenderer.on('window-state-changed', (_e, v) => cb(v)),

  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (s) => ipcRenderer.invoke('save-settings', s),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  downloadFile: (p) => ipcRenderer.invoke('download-file', p),
  cancelDownload: () => ipcRenderer.invoke('cancel-download'),
  onDownloadProgress: (cb) => ipcRenderer.on('download-progress', (_e, data) => cb(data)),

  getFavorites: () => ipcRenderer.invoke('get-favorites'),
  addFavorite: (r) => ipcRenderer.invoke('add-favorite', r),
  removeFavorite: (r) => ipcRenderer.invoke('remove-favorite', r),
  isFavorite: (r) => ipcRenderer.invoke('is-favorite', r),

  getNotificationPrefs: () => ipcRenderer.invoke('get-notification-prefs'),
  setNotificationPref: (r, e) => ipcRenderer.invoke('set-notification-pref', r, e),

  getDownloads: () => ipcRenderer.invoke('get-downloads'),
  getDownloadedRepos: () => ipcRenderer.invoke('get-downloaded-repos'),
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  getDownloadHistory: (fullName) => ipcRenderer.invoke('get-download-history', fullName),
  deleteDownloadHistoryEntry: (fullName, index) => ipcRenderer.invoke('delete-download-history-entry', fullName, index),
  dismissUpdate: (fullName) => ipcRenderer.invoke('dismiss-update', fullName),
  getMirrorLatencies: (mirrors) => ipcRenderer.invoke('get-mirror-latencies', mirrors),

  getAuthToken: () => ipcRenderer.invoke('get-auth-token'),
  saveAuthToken: (t) => ipcRenderer.invoke('save-auth-token', t),
  clearAuth: () => ipcRenderer.invoke('clear-auth'),
  getUserInfo: () => ipcRenderer.invoke('get-user-info'),
  startOAuthDevice: (clientId) => ipcRenderer.invoke('start-oauth-device', clientId),
  pollOAuthToken: (clientId, code) => ipcRenderer.invoke('poll-oauth-token', clientId, code),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  openGithubUrl: (url) => ipcRenderer.invoke('open-github-url', url),
  clearAppCache: () => ipcRenderer.invoke('clear-app-cache'),
})
