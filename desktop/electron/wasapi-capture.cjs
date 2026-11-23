const { spawn } = require("node:child_process");

class WasapiCapture {
  constructor() {
    this.process = null;
  }

  start(onPcm, onState) {
    if (process.platform !== "win32") {
      throw new Error("Native WASAPI capture is available only in the Windows desktop build.");
    }
    if (this.process) throw new Error("WASAPI capture is already running.");
    const args = [
      "-hide_banner",
      "-loglevel", "warning",
      "-f", "wasapi",
      "-loopback", "1",
      "-i", "default",
      "-ac", "2",
      "-ar", "48000",
      "-acodec", "pcm_s16le",
      "-f", "s16le",
      "pipe:1"
    ];
    const child = spawn("ffmpeg", args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    this.process = child;
    let stderr = "";
    child.stdout.on("data", chunk => {
      if (this.process === child && chunk.length) onPcm(new Uint8Array(chunk));
    });
    child.stderr.on("data", chunk => {
      stderr = (stderr + chunk.toString()).slice(-8000);
    });
    child.once("error", error => {
      if (this.process === child) this.process = null;
      onState({ state: "error", message: error.code === "ENOENT"
        ? "FFmpeg was not found. Install a Windows FFmpeg build with WASAPI input support and add it to PATH."
        : "WASAPI capture could not start: " + error.message });
    });
    child.once("close", (code, signal) => {
      if (this.process === child) this.process = null;
      if (code !== 0 && code !== null) {
        const detail = stderr.trim().split("\n").slice(-3).join(" ");
        onState({ state: "error", message: "WASAPI capture stopped (FFmpeg exit " + code + "). " + (detail || "Check that this FFmpeg build supports WASAPI loopback.") });
      } else {
        onState({ state: "stopped", message: "WASAPI system-audio capture stopped." });
      }
    });
    return { ok: true, message: "Starting Windows WASAPI system-audio loopback…" };
  }

  stop() {
    const child = this.process;
    if (!child) return;
    this.process = null;
    child.stdout?.removeAllListeners("data");
    child.kill();
  }
}

module.exports = { WasapiCapture };
