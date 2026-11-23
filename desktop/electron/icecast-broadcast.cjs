const { spawn } = require("node:child_process");
const net = require("node:net");

const contentTypes = { mp3: "audio/mpeg", aac: "audio/aac", ogg: "audio/ogg", opus: "audio/ogg" };
const ffmpegFormats = {
  mp3: ["-c:a", "libmp3lame", "-f", "mp3"],
  aac: ["-c:a", "aac", "-f", "adts"],
  ogg: ["-c:a", "libvorbis", "-f", "ogg"],
  opus: ["-c:a", "libopus", "-f", "ogg"]
};
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 15000, 30000];
const MAX_PENDING_BYTES = 16 * 1024 * 1024;

class IcecastBroadcast {
  constructor() {
    this.child = null;
    this.socket = null;
    this.senderId = null;
    this.profile = null;
    this.stopping = false;
    this.retryTimer = null;
    this.retryAttempt = 0;
    this.pending = [];
    this.pendingBytes = 0;
    this.connecting = false;
    this.sessionId = 0;
  }

  async start(profile, senderId) {
    if (this.child || this.socket) throw new Error("A broadcast session is already running.");
    if (!profile || profile.type !== "icecast") {
      throw new Error("The current live transport supports Icecast profiles. SHOUTcast and AzuraCast adapters are still being implemented.");
    }
    if (typeof profile.host !== "string" || !profile.host.trim() || profile.host.length > 253 || /[\\r\\n\\s]/.test(profile.host) ||
        typeof profile.port !== "string" || !/^\\d+$/.test(profile.port) || Number(profile.port) < 1 || Number(profile.port) > 65535 ||
        typeof profile.mountPoint !== "string" || !profile.mountPoint.startsWith("/") || /[\\r\\n\\s]/.test(profile.mountPoint) ||
        typeof profile.sourcePassword !== "string" || !profile.sourcePassword || profile.sourcePassword.length > 2048 ||
        !ffmpegFormats[profile.codec] || !/^\\d{1,3}$/.test(profile.bitrateKbps) || Number(profile.bitrateKbps) < 32 || Number(profile.bitrateKbps) > 320) {
      throw new Error("The Icecast profile is incomplete or invalid.");
    }

    const args = ["-hide_banner", "-loglevel", "error", "-f", "webm", "-i", "pipe:0", "-vn",
      "-ar", "44100", "-ac", "2", "-b:a", `${profile.bitrateKbps}k`, ...ffmpegFormats[profile.codec]];
    const child = spawn("ffmpeg", args, { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    this.child = child;
    this.senderId = senderId;
    this.profile = { ...profile };
    this.stopping = false;
    this.retryAttempt = 0;
    this.pending = [];
    this.pendingBytes = 0;
    const sessionId = ++this.sessionId;

    child.stdout.on("data", chunk => this.sendEncoded(chunk, sessionId));
    child.stderr.on("data", data => {
      const message = String(data).trim();
      if (message && !this.stopping) this.notify("warning", "FFmpeg: " + message.slice(0, 300));
    });
    child.once("error", error => {
      if (sessionId !== this.sessionId || this.stopping) return;
      this.fail(error.code === "ENOENT"
        ? "FFmpeg was not found. Install FFmpeg and make sure it is available on PATH."
        : "The audio encoder process failed: " + error.message);
    });
    child.once("close", code => {
      if (sessionId !== this.sessionId || this.stopping) return;
      this.fail(`Audio encoder stopped unexpectedly (exit code ${code}).`);
    });

    this.notify("connecting", "Broadcast encoder started. Connecting to Icecast; automatic reconnect is enabled.");
    this.connect(sessionId);
    return { ok: true, message: "Broadcast encoder started. Automatic reconnect is enabled." };
  }

  sendEncoded(chunk, sessionId) {
    if (this.stopping || sessionId !== this.sessionId) return;
    if (this.socket && !this.socket.destroyed && this.socket.__icecastAccepted) {
      this.socket.write(chunk);
      return;
    }
    if (this.pendingBytes + chunk.length > MAX_PENDING_BYTES) {
      this.fail("The server has been unreachable for too long. The reconnect audio buffer is full, so the broadcast was stopped to avoid silently losing programme audio.");
      return;
    }
    this.pending.push(Buffer.from(chunk));
    this.pendingBytes += chunk.length;
  }

  connect(sessionId) {
    if (this.stopping || sessionId !== this.sessionId || this.connecting || this.socket) return;
    this.connecting = true;
    const profile = this.profile;
    const socket = net.createConnection({ host: profile.host, port: Number(profile.port) });
    this.socket = socket;
    let accepted = false;
    let settled = false;
    const finishAttempt = () => { if (!settled) { settled = true; this.connecting = false; } };

    socket.setTimeout(10000);
    socket.once("connect", () => {
      const username = profile.sourceUsername || "source";
      const auth = Buffer.from(username + ":" + profile.sourcePassword).toString("base64");
      socket.write([
        `SOURCE ${profile.mountPoint} HTTP/1.0`,
        `Authorization: Basic ${auth}`,
        `Content-Type: ${contentTypes[profile.codec]}`,
        `Ice-Name: ${String(profile.name).replace(/[\\r\\n]/g, " ")}`,
        "Ice-Public: 0",
        "",
        ""
      ].join("\r\n"));
    });
    socket.once("data", data => {
      if (this.stopping || sessionId !== this.sessionId) return;
      const response = data.toString("latin1");
      if (!/^HTTP\\/1\\.[01] 200\\b/.test(response)) {
        const status = response.split("\\r\\n", 1)[0] || "Unknown server response";
        this.notify("reconnecting", "Icecast did not accept the source connection (" + status + "). Retrying automatically.");
        finishAttempt();
        socket.destroy();
        return;
      }
      accepted = true;
      socket.__icecastAccepted = true;
      finishAttempt();
      this.retryAttempt = 0;
      this.notify("live", "Connected to Icecast. Sending the encoded programme audio.");
      const backlog = this.pending;
      this.pending = [];
      this.pendingBytes = 0;
      for (const chunk of backlog) {
        if (socket.destroyed) break;
        socket.write(chunk);
      }
    });
    socket.on("timeout", () => {
      if (!accepted) {
        this.notify("reconnecting", "Icecast connection timed out. Retrying automatically.");
        socket.destroy();
      }
    });
    socket.on("error", error => {
      if (this.stopping || sessionId !== this.sessionId) return;
      if (!accepted) this.notify("reconnecting", "Could not reach Icecast (" + error.message + "). Retrying automatically.");
      finishAttempt();
    });
    socket.on("close", () => {
      finishAttempt();
      if (this.socket === socket) this.socket = null;
      if (this.stopping || sessionId !== this.sessionId) return;
      if (accepted) this.notify("reconnecting", "Icecast connection was lost. Programme audio is being buffered while the encoder reconnects.");
      this.scheduleReconnect(sessionId);
    });
  }

  scheduleReconnect(sessionId) {
    if (this.stopping || sessionId !== this.sessionId || this.retryTimer) return;
    const delay = RETRY_DELAYS_MS[Math.min(this.retryAttempt, RETRY_DELAYS_MS.length - 1)];
    this.retryAttempt += 1;
    this.notify("reconnecting", `Reconnecting to Icecast in ${Math.ceil(delay / 1000)} second(s). Retry ${this.retryAttempt}.`);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect(sessionId);
    }, delay);
  }

  write(senderId, chunk) {
    if (!this.child || this.senderId !== senderId || !Buffer.isBuffer(chunk) || chunk.length > 1024 * 1024) return false;
    return this.child.stdin.write(chunk);
  }

  fail(message) {
    if (this.stopping) return;
    this.notify("error", message);
    this.stop();
  }

  stop(senderId) {
    if (senderId !== undefined && this.senderId !== null && senderId !== this.senderId) return;
    this.stopping = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    if (this.socket) this.socket.destroy();
    if (this.child) {
      this.child.stdin.end();
      this.child.kill();
    }
    this.child = null;
    this.socket = null;
    this.senderId = null;
    this.profile = null;
    this.connecting = false;
    this.pending = [];
    this.pendingBytes = 0;
    this.notify("stopped", "Broadcast stopped.");
  }

  notify(state, message) {
    const { BrowserWindow } = require("electron");
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send("broadcast:state", { state, message });
  }
}

module.exports = { IcecastBroadcast };
