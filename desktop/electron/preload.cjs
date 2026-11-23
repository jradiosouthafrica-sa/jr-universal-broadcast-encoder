const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("jradio", Object.freeze({
  saveProfile: (profile) => ipcRenderer.invoke("profile:save", profile),
  loadProfile: () => ipcRenderer.invoke("profile:load"),
  startBroadcast: (profile) => ipcRenderer.invoke("broadcast:start", profile),
  sendAudioChunk: (chunk) => ipcRenderer.send("broadcast:chunk", chunk),
  stopBroadcast: () => ipcRenderer.invoke("broadcast:stop"),
  onBroadcastState: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("broadcast:state", listener);
    return () => ipcRenderer.removeListener("broadcast:state", listener);
  }
}));
