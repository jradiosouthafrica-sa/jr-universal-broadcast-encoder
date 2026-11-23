const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("jradio", Object.freeze({
  saveProfile: (profile) => ipcRenderer.invoke("profile:save", profile),
  loadProfile: () => ipcRenderer.invoke("profile:load")
}));
