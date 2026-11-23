const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("jradio", Object.freeze({
  saveProfile: (profile) => ipcRenderer.invoke("profile:save", profile),
  loadProfile: () => ipcRenderer.invoke("profile:load"),
  startBroadcast: (profile) => ipcRenderer.invoke("broadcast:start", profile),
  sendAudioChunk: (chunk) => ipcRenderer.send("broadcast:chunk", chunk),
  stopBroadcast: () => ipcRenderer.invoke("broadcast:stop"),
  startWasapiCapture: () => ipcRenderer.invoke("wasapi:start"),
  stopWasapiCapture: () => ipcRenderer.invoke("wasapi:stop"),
  onWasapiPcm: (callback) => {
    const listener = (_event, chunk) => callback(new Uint8Array(chunk));
    ipcRenderer.on("wasapi:pcm", listener);
    return () => ipcRenderer.removeListener("wasapi:pcm", listener);
  },
  onWasapiState: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("wasapi:state", listener);
    return () => ipcRenderer.removeListener("wasapi:state", listener);
  },
  onBroadcastState: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("broadcast:state", listener);
    return () => ipcRenderer.removeListener("broadcast:state", listener);
  }
}));
