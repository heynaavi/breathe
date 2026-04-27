const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridge', {
  endExperience: () => ipcRenderer.send('end-experience'),
  getSoundFiles: () => ipcRenderer.invoke('get-sound-files'),
  getStats: () => ipcRenderer.invoke('get-stats'),
  sendFeedback: (data) => ipcRenderer.send('send-feedback', data),
  getTrayBounds: () => ipcRenderer.invoke('get-tray-bounds'),
  endOnboarding: () => ipcRenderer.send('end-onboarding'),
});
