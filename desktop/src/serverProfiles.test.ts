import { describe, expect, it } from "vitest";
import { ServerProfile, validateServerProfile } from "./serverProfiles";

const validProfile: ServerProfile = {
  name: "Test station", type: "icecast", host: "stream.example.org",
  port: "8000", codec: "mp3", bitrateKbps: "128", mountPoint: "/live",
  sourceUsername: "source", sourcePassword: "not-a-real-password", streamId: "1"
};

describe("validateServerProfile", () => {
  it("accepts a valid Icecast profile", () => {
    expect(validateServerProfile(validProfile).valid).toBe(true);
  });
  it("rejects a port outside the TCP port range", () => {
    expect(validateServerProfile({ ...validProfile, port: "70000" }).errors)
      .toContain("Server port must be a number from 1 to 65535.");
  });
  it("requires an Icecast mount point beginning with a slash", () => {
    expect(validateServerProfile({ ...validProfile, mountPoint: "live" }).errors)
      .toContain("Icecast mount point must begin with /.");
  });
  it("requires a positive numeric SHOUTcast v2 stream ID", () => {
    expect(validateServerProfile({ ...validProfile, type: "shoutcast-v2", streamId: "zero" }).errors)
      .toContain("SHOUTcast v2 stream ID must be a positive number.");
  });
  it("does not require an Icecast mount point for SHOUTcast v1", () => {
    expect(validateServerProfile({ ...validProfile, type: "shoutcast-v1", mountPoint: undefined }).valid).toBe(true);
  });
  it("requires a source password", () => {
    expect(validateServerProfile({ ...validProfile, sourcePassword: "" }).errors)
      .toContain("Source password is required.");
  });
});
