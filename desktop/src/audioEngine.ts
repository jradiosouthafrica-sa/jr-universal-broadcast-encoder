export type AudioSourceId = "microphone" | "desktop" | "device";

export interface AudioInputDevice { deviceId: string; label: string; groupId: string; }

export async function listAudioInputDevices(): Promise<AudioInputDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) throw new Error("Audio device discovery is not supported in this runtime.");
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(device => device.kind === "audioinput").map((device, index) => ({ deviceId: device.deviceId, label: device.label || "Audio input " + (index + 1), groupId: device.groupId }));
}

type SourceNodes = {
  stream?: MediaStream;
  source?: AudioNode;
  gain: GainNode;
  analyser: AnalyserNode;
  volume: number;
  muted: boolean;
  nextStartTime: number;
  pendingBytes: Uint8Array;
};

export class BroadcastAudioEngine {
  private context: AudioContext | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private masterGain: GainNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  private sources = new Map<AudioSourceId, SourceNodes>();
  private masterMuted = false;
  private masterVolume = 1;

  async start(): Promise<void> {
    if (this.context && this.context.state !== "closed") {
      if (this.context.state === "suspended") await this.context.resume();
      return;
    }
    this.context = new AudioContext();
    await this.context.resume();
    this.destination = this.context.createMediaStreamDestination();
    this.masterGain = this.context.createGain();
    this.masterAnalyser = this.context.createAnalyser();
    this.masterAnalyser.fftSize = 1024;
    this.masterGain.gain.value = this.masterVolume;
    this.masterGain.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.destination);
  }

  async addMicrophone(): Promise<void> {
    await this.start();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this.attachSource("microphone", stream);
  }

  async addAudioDevice(deviceId: string): Promise<void> {
    if (!deviceId) throw new Error("Select an audio input device first.");
    await this.start();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
    this.attachSource("device", stream);
  }

  async addDesktopAudio(): Promise<void> {
    await this.start();
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    stream.getVideoTracks().forEach(track => track.stop());
    if (stream.getAudioTracks().length === 0) {
      stream.getTracks().forEach(track => track.stop());
      throw new Error("No desktop audio was shared. Choose a tab/window or screen with audio sharing enabled.");
    }
    this.attachSource("desktop", stream);
  }

  async addPcmSource(id: AudioSourceId): Promise<void> {
    await this.start();
    if (!this.context || !this.masterGain) throw new Error("Audio engine is not ready.");
    this.stopSource(id);
    const gain = this.context.createGain();
    const analyser = this.context.createAnalyser();
    analyser.fftSize = 1024;
    gain.connect(analyser);
    analyser.connect(this.masterGain);
    this.sources.set(id, { gain, analyser, volume: 1, muted: false, nextStartTime: 0, pendingBytes: new Uint8Array(0) });
  }

  addPcmChunk(id: AudioSourceId, bytes: Uint8Array): void {
    const item = this.sources.get(id);
    if (!item || !this.context || !bytes.length) return;
    // FFmpeg emits signed 16-bit little-endian stereo PCM at 48 kHz.
    const combined = new Uint8Array(item.pendingBytes.length + bytes.length);
    combined.set(item.pendingBytes);
    combined.set(bytes, item.pendingBytes.length);
    const usableLength = combined.length - (combined.length % 4);
    item.pendingBytes = combined.slice(usableLength);
    if (!usableLength) return;
    const frames = usableLength / 4;
    const audioBuffer = this.context.createBuffer(2, frames, 48000);
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    const view = new DataView(combined.buffer, combined.byteOffset, usableLength);
    for (let frame = 0; frame < frames; frame++) {
      left[frame] = view.getInt16(frame * 4, true) / 32768;
      right[frame] = view.getInt16(frame * 4 + 2, true) / 32768;
    }
    const node = this.context.createBufferSource();
    node.buffer = audioBuffer;
    node.connect(item.gain);
    const startAt = Math.max(this.context.currentTime + 0.025, item.nextStartTime);
    node.start(startAt);
    item.nextStartTime = startAt + audioBuffer.duration;
    node.onended = () => node.disconnect();
  }

  private attachSource(id: AudioSourceId, stream: MediaStream): void {
    if (!this.context || !this.masterGain) {
      stream.getTracks().forEach(track => track.stop());
      throw new Error("Audio engine is not ready.");
    }
    this.stopSource(id);
    const source = this.context.createMediaStreamSource(stream);
    const gain = this.context.createGain();
    const analyser = this.context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(gain);
    gain.connect(analyser);
    analyser.connect(this.masterGain);
    this.sources.set(id, { stream, source, gain, analyser, volume: 1, muted: false, nextStartTime: 0, pendingBytes: new Uint8Array(0) });
    stream.getAudioTracks().forEach(track => {
      track.addEventListener("ended", () => {
        if (this.sources.get(id)?.stream === stream) this.stopSource(id);
      }, { once: true });
    });
  }

  setSourceVolume(id: AudioSourceId, value: number): void {
    const source = this.sources.get(id);
    if (source && this.context) { source.volume = Math.max(0, Math.min(1, value)); source.gain.gain.setTargetAtTime(source.muted ? 0 : source.volume, this.context.currentTime, 0.015); }
  }

  setSourceMuted(id: AudioSourceId, muted: boolean): void {
    const source = this.sources.get(id);
    if (source && this.context) { source.muted = muted; source.gain.gain.setTargetAtTime(muted ? 0 : source.volume, this.context.currentTime, 0.015); }
  }

  setMasterVolume(value: number): void {
    this.masterVolume = Math.max(0, Math.min(1, value));
    this.applyMasterGain();
  }

  setMasterMuted(muted: boolean): void {
    this.masterMuted = muted;
    this.applyMasterGain();
  }

  private applyMasterGain(): void {
    if (this.masterGain && this.context) this.masterGain.gain.setTargetAtTime(this.masterMuted ? 0 : this.masterVolume, this.context.currentTime, 0.015);
  }

  getBroadcastStream(): MediaStream {
    if (!this.destination) throw new Error("Start the audio engine and add an audio source first.");
    return this.destination.stream;
  }

  private readLevel(analyser: AnalyserNode | null): number {
    if (!analyser) return 0;
    const samples = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) sum += sample * sample;
    return Math.min(1, Math.sqrt(sum / samples.length) * 3);
  }

  getSourceLevel(id: AudioSourceId): number { return this.readLevel(this.sources.get(id)?.analyser ?? null); }
  getMasterLevel(): number { return this.readLevel(this.masterAnalyser); }
  isSourceActive(id: AudioSourceId): boolean { return this.sources.has(id); }

  stopSource(id: AudioSourceId): void {
    const item = this.sources.get(id);
    if (!item) return;
    item.source?.disconnect();
    item.gain.disconnect();
    item.analyser.disconnect();
    item.stream?.getTracks().forEach(track => track.stop());
    this.sources.delete(id);
  }

  async stop(): Promise<void> {
    (["microphone", "desktop", "device"] as const).forEach(id => this.stopSource(id));
    this.destination?.stream.getTracks().forEach(track => track.stop());
    this.masterGain?.disconnect();
    this.masterAnalyser?.disconnect();
    const context = this.context;
    this.context = null;
    this.destination = null;
    this.masterGain = null;
    this.masterAnalyser = null;
    if (context && context.state !== "closed") await context.close();
  }
}
