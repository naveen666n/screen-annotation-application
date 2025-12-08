import { contextBridge, ipcRenderer } from 'electron';

// Expose minimal API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  toggleClickThrough: (enabled: boolean) => ipcRenderer.send('toggle-click-through', enabled),
  setMouseOverToolbar: (isOver: boolean) => ipcRenderer.send('mouse-over-toolbar', isOver),
  saveScreenshot: (dataUrl: string) => ipcRenderer.invoke('save-screenshot', dataUrl)
});
