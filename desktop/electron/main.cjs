const { app, BrowserWindow, ipcMain, safeStorage } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { IcecastBroadcast } = require("./icecast-broadcast.cjs");
const broadcast = new IcecastBroadcast();

const PROFILE_FILE = "server-profile.enc";
const MAX_PROFILE_BYTES = 16 * 1024;

function isProfile(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const stringFields = ["name", "type", "host", "port", "codec", "bitrateKbps", "sourcePassword"];
  if (!stringFields.every((key) => typeof value[key] === "string" && value[key].length <= 2048)) return false;
  for (const key of ["mountPoint", "sourceUsername", "streamId"]) {
    if (value[key] !== undefined && (typeof value[key] !== "string" || value[key].length > 2048)) return false;
  }
  if (!["icecast", "shoutcast-v1", "shoutcast-v2", "azuracast"].includes(value.type)) return false;
  if (!["mp3", "aac", "ogg", "opus"].includes(value.codec)) return false;
  if (!/^\\d+$/.test(value.port) || Number(value.port) < 1 || Number(value.port) > 65535) return false;
  if (!/^\\d+$/.test(value.bitrateKbps) || Number(value.bitrateKbps) < 1 || Number(value.bitrateKbps) > 1000) return false;
  if (!value.name.trim() || !value.host.trim() || !value.sourcePassword) return false;
  if (value.type === "icecast" && (!value.mountPoint || !value.mountPoint.trim().startsWith("/"))) return false;
  if (value.type === "shoutcast-v2" && (!value.streamId || !/^\\d+$/.test(value.streamId) || Number(value.streamId) < 1)) return false;
  return true;
}

function registerProfileStorage() {
  ipcMain.handle("profile:save", async (_event, profile) => {
    if (!isProfile(profile)) return { ok: false, error: "Invalid profile data." };
    const storageBackend = safeStorage.getSelectedStorageBackend?.();
    if (!safeStorage.isEncryptionAvailable() || storageBackend === "basic_text") {
      return { ok: false, error: "A secure operating-system credential store is unavailable. No profile was saved." };
    }
    const serialized = JSON.stringify(profile);
    if (Buffer.byteLength(serialized, "utf8") > MAX_PROFILE_BYTES) {
      return { ok: false, error: "Profile is too large to save." };
    }
    try {
      const encrypted = safeStorage.encryptString(serialized);
      const target = path.join(app.getPath("userData"), PROFILE_FILE);
      const temporary = target + ".tmp";
      await fs.writeFile(temporary, encrypted, { mode: 0o600 });
      await fs.rename(temporary, target);
      return { ok: true };
    } catch {
      return { ok: false, error: "The encrypted profile could not be saved." };
    }
  });

  ipcMain.handle("profile:load", async () => {
    const storageBackend = safeStorage.getSelectedStorageBackend?.();
    if (!safeStorage.isEncryptionAvailable() || storageBackend === "basic_text") {
      return { ok: false, error: "A secure operating-system credential store is unavailable." };
    }
    try {
      const encrypted = await fs.readFile(path.join(app.getPath("userData"), PROFILE_FILE));
      const decoded = safeStorage.decryptString(encrypted);
      const profile = JSON.parse(decoded);
      if (!isProfile(profile)) return { ok: false, error: "The saved profile is invalid." };
      return { ok: true, profile };
    } catch (error) {
      if (error && error.code === "ENOENT") return { ok: true, profile: null };
      return { ok: false, error: "The saved profile could not be opened on this device." };
    }
  });
}

function registerBroadcastHandlers() {
  ipcMain.handle("broadcast:start", async (event, profile) => {
    try { return await broadcast.start(profile, event.sender.id); }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Could not start broadcast." }; }
  });
  ipcMain.on("broadcast:chunk", (event, chunk) => {
    if (!(chunk instanceof Uint8Array) || chunk.byteLength > 1024 * 1024) return;
    broadcast.write(event.sender.id, Buffer.from(chunk));
  });
  ipcMain.handle("broadcast:stop", event => { broadcast.stop(event.sender.id); return { ok: true }; });
}
function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: "#101820",
    title: "JRadio Universal Broadcast Encoder",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (app.isPackaged) {
    window.loadFile(path.join(__dirname, "../dist/index.html"));
  } else {
    window.loadURL("http://127.0.0.1:5173");
  }
}

app.whenReady().then(() => {
  registerProfileStorage();
  registerBroadcastHandlers();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => broadcast.stop());

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
