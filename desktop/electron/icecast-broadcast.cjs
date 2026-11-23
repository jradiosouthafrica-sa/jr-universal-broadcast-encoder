const { spawn } = require("node:child_process");
const net = require("node:net");

const contentTypes = { mp3: "audio/mpeg", aac: "audio/aac", ogg: "audio/ogg", opus: "audio/ogg" };
const ffmpegFormats = {
  mp3: ["-c:a", "libmp3lame", "-f", "mp3"],
  aac: ["-c:a", "aac", "-f", "adts"],
  ogg: ["-c:a", "libvorbis", "-f", "ogg"],
  opus: ["-c:a", "libopus", "-f", "ogg"]
};

class IcecastBroadcast {
  constructor() {
    this.child = null;
    this.socket = null;
    this.senderId = null;
    this.stopping = false;
  }

  async start(profile, senderId) {
    if (this.child || this.socket) throw new Error("A broadcast session is already running.");
    if (!profile || profile.type !== "icecast") {
      throw new Error("The first live transport supports Icecast profiles. SHOUTcast and AzuraCast adapters are still being implemented.");
    }
    if (!profile.host || !/^\d+$/.test(profile.port) || Number(profile.port) < 1 || Number(profile.port) > 65535 ||
        !profile.mountPoint || !profile.mountPoint.startsWith("/") || !profile.sourcePassword) {
      throw new Error("The Icecast profile is incomplete or invalid.");
    }
    const args = ["-hide_banner", "-loglevel", "error", "-f", "webm", "-i", "pipe:0", "-vn",
      "-ar", "44100", "-ac", "2", "-b:a", `${profile.bitrateKbps}k`, ...ffmpegFormats[profile.codec]];
    if (!ffmpegFormats[profile.codec]) throw new Error("This audio codec is not supported by the current FFmpeg output configuration.");
    const child = spawn("ffmpeg", args, { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    const socket = net.createConnection({ host: profile.host, port: Number(profile.port) });
    this.child = child;
    this.socket = socket;
    this.senderId = senderId;
    this.stopping = false;

    const cleanup = () => {
      if (this.child === child) this.child = null;
      if (this.socket === socket) this.socket = null;
      this.senderId = null;
    };
    child.on("error", error => {
      if (!this.stopping) this.notify("error", error.message.includes("ENOENT") ? "FFmpeg was not found. Install FFmpeg and make sure it is available on PATH." : "The audio encoder process failed.");
      socket.destroy();
      cleanup();
    });
    child.stderr.on("data", data => {
      const message = String(data).trim();
      if (message && !this.stopping) this.notify("error", "FFmpeg: " + message.slice(0, 300));
    });
    child.on("close", code => {
      if (!this.stopping && code !== 0) this.notify("error", `Audio encoder stopped (exit code ${code}).`);
      if (this.socket === socket) socket.destroy();
      cleanup();
    });
    socket.on("error", error => {
      if (!this.stopping) this.notify("error", "Streaming connection failed: " + error.message);
      child.kill();
      cleanup();
    });

    await new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => finish(new Error("Timed out waiting for the Icecast server.")), 10000);
      const finish = error => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        error ? reject(error) : resolve();
      };
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
        const response = data.toString("latin1");
        if (!/^HTTP\/1\.[01] 200\b/.test(response)) {
          const status = response.split("\r\n", 1)[0] || "Unknown server response";
          finish(new Error("Icecast rejected the source connection: " + status));
          socket.destroy();
          child.kill();
          cleanup();
          return;
        }
        child.stdout.pipe(socket, { end: false });
        finish();
      });
      socket.once("error", error => finish(new Error("Could not connect to Icecast: " + error.message)));
    }).catch(error => {
      this.stopping = true;
      child.kill();
      socket.destroy();
      cleanup();
      throw error;
    });
    this.notify("live", "Connected to Icecast. Sending the encoded programme audio.");
    return { ok: true };
  }

  write(senderId, chunk) {
    if (!this.child || this.senderId !== senderId || !Buffer.isBuffer(chunk) || chunk.length > 1024 * 1024) return false;
    return this.child.stdin.write(chunk);
  }

  stop(senderId) {
    if (this.senderId !== null && senderId !== this.senderId) return;
    this.stopping = true;
    if (this.child) {
      this.child.stdin.end();
      this.child.kill();
    }
    if (this.socket) this.socket.destroy();
    this.child = null;
    this.socket = null;
    this.senderId = null;
  }

  notify(state, message) {
    const { BrowserWindow } = require("electron");
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send("broadcast:state", { state, message });
  }
}

module.exports = { IcecastBroadcast };
