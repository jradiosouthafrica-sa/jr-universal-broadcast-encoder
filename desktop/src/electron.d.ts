import type { ServerProfile } from "./serverProfiles";

declare global {
  interface Window {
    jradio?: {
      saveProfile(profile: ServerProfile): Promise<{ ok: boolean; error?: string }>;
      loadProfile(): Promise<{ ok: boolean; profile?: ServerProfile | null; error?: string }>;
      startBroadcast(profile: ServerProfile): Promise<{ ok: boolean; error?: string }>;
      sendAudioChunk(chunk: Uint8Array): void;
      stopBroadcast(): Promise<{ ok: boolean; error?: string }>;
      startWasapiCapture(): Promise<{ ok: boolean; message?: string; error?: string }>;
      stopWasapiCapture(): Promise<{ ok: boolean; error?: string }>;
      onWasapiPcm(callback: (chunk: Uint8Array) => void): () => void;
      onWasapiState(callback: (event: { state: string; message: string }) => void): () => void;
      onBroadcastState(callback: (event: { state: string; message: string }) => void): () => void;
    };
  }
}

export {};
