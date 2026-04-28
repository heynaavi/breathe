const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridge', {
  endExperience: () => ipcRenderer.send('end-experience'),
  getSoundFiles: () => ipcRenderer.invoke('get-sound-files'),
  getStats: () => ipcRenderer.invoke('get-stats'),
  getPrefs: () => ipcRenderer.invoke('get-prefs'),
  setPrefs: (prefs) => ipcRenderer.send('set-prefs', prefs),
  sendFeedback: (data) => ipcRenderer.send('send-feedback', data),
  getTrayBounds: () => ipcRenderer.invoke('get-tray-bounds'),
  endOnboarding: () => ipcRenderer.send('end-onboarding'),
  getGongPath: () => ipcRenderer.invoke('get-gong-path'),
});
