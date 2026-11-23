const { app, BrowserWindow, ipcMain, safeStorage } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");

const PROFILE_FILE = "server-profile.enc";
const MAX_PROFILE_BYTES = 16 * 1024;

function isProfile(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const stringFields = ["name", "type", "host", "port", "codec", "bitrateKbps", "sourcePassword"];
  if (!stringFields.every((key) => typeof value[key] === "string" && value[key].length <= 2048)) return false;
  for (const key of ["mountPoint", "sourceUsername", "streamId"]) {
    if (value[key] !== undefined && (typeof value[key] !== "string" || value[key].length > 2048)) return false;
  }
  return ["icecast", "shoutcast-v1", "shoutcast-v2", "azuracast"].includes(value.type);
}

function registerProfileStorage() {
  ipcMain.handle("profile:save", async (_event, profile) => {
    if (!isProfile(profile)) return { ok: false, error: "Invalid profile data." };
    if (!safeStorage.isEncryptionAvailable()) {
      return { ok: false, error: "Secure credential storage is unavailable on this device. No profile was saved." };
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
    if (!safeStorage.isEncryptionAvailable()) {
      return { ok: false, error: "Secure credential storage is unavailable on this device." };
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
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
