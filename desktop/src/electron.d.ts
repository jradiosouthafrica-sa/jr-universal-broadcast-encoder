import type { ServerProfile } from "./serverProfiles";

declare global {
  interface Window {
    jradio?: {
      saveProfile(profile: ServerProfile): Promise<{ ok: boolean; error?: string }>;
      loadProfile(): Promise<{ ok: boolean; profile?: ServerProfile | null; error?: string }>;
    };
  }
}

export {};
