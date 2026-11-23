export type ServerType = "icecast" | "shoutcast-v1" | "shoutcast-v2" | "azuracast";
export type AudioCodec = "mp3" | "aac" | "ogg" | "opus";

export interface ServerProfile {
  name: string;
  type: ServerType;
  host: string;
  port: string;
  codec: AudioCodec;
  bitrateKbps: string;
  mountPoint?: string;
  sourceUsername?: string;
  sourcePassword: string;
  streamId?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const validCodecs: AudioCodec[] = ["mp3", "aac", "ogg", "opus"];

export function validateServerProfile(profile: ServerProfile): ValidationResult {
  const errors: string[] = [];
  const required = (value: string | undefined, label: string) => {
    if (!value?.trim()) errors.push(`${label} is required.`);
  };

  required(profile.name, "Profile name");
  required(profile.host, "Server host");
  required(profile.port, "Server port");
  required(profile.sourcePassword, "Source password");

  const port = Number(profile.port);
  if (profile.port.trim() && (!Number.isInteger(port) || port < 1 || port > 65535)) {
    errors.push("Server port must be a number from 1 to 65535.");
  }
  if (!validCodecs.includes(profile.codec)) errors.push("Choose a supported audio codec.");

  if (profile.type === "icecast") {
    required(profile.mountPoint, "Icecast mount point");
    if (profile.mountPoint?.trim() && !profile.mountPoint.trim().startsWith("/")) {
      errors.push("Icecast mount point must begin with /.");
    }
  }

  if (profile.type === "shoutcast-v2") {
    required(profile.streamId, "SHOUTcast v2 stream ID");
    if (profile.streamId?.trim() && (!/^\d+$/.test(profile.streamId.trim()) || Number(profile.streamId) < 1)) {
      errors.push("SHOUTcast v2 stream ID must be a positive number.");
    }
  }

  return { valid: errors.length === 0, errors };
}

export const serverTypeLabels: Record<ServerType, string> = {
  icecast: "Icecast",
  "shoutcast-v1": "SHOUTcast v1",
  "shoutcast-v2": "SHOUTcast v2",
  azuracast: "AzuraCast (live DJ source)"
};
