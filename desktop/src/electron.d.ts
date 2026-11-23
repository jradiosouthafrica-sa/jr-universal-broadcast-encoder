import type { ServerProfile } from "./serverProfiles";

declare global {
  interface Window {
    jradio?: {
      saveProfile(profile: ServerProfile): Promise<{ ok: boolean; error?: string }>;
      loadProfile(): Promise<{ ok: boolean; profile?: ServerProfile | null; error?: string }>;
      startBroadcast(profile: ServerProfile): Promise<{ ok: boolean; error?: string }>;
      sendAudioChunk(chunk: Uint8Array): void;
      stopBroadcast(): Promise<{ ok: boolean; error?: string }>;
      onBroadcastState(callback: (event: { state: string; message: string }) => void): () => void;
    };
  }
}

export {};
