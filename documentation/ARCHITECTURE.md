# Architecture

## Product boundary

JRadio Universal Broadcast Encoder is a standalone broadcaster application. It does not replace or modify the station's AzuraCast installation. It produces one encoded programme stream and sends it to a configured streaming server.

## High-level data flow

```text
Web browser audio ─┐
Desktop app audio ─┤
Microphone input ──┼─> Source capture ─> Channel mixer ─> Master processing
External input ───┘                                  │
                                                     v
                                           Encoder / format adapter
                                                     │
                                                     v
                                      Icecast / SHOUTcast / AzuraCast
```

Each source should have independent gain, mute state, signal metering and error reporting. The mixer must continue to handle available sources if another source is unavailable.

## Desktop

**Current direction:** Electron + React + TypeScript for the desktop shell, with a native audio engine behind a stable interface.

Capture backends are platform-specific:

- Windows: WASAPI loopback; investigate per-application capture support and version requirements.
- macOS: CoreAudio-based capture, respecting system permissions and supported capture APIs.
- Linux: PipeWire first, with PulseAudio compatibility where practical.

The app should distinguish the integrated browser from separately installed applications. Websites may run in an embedded browser. Installed applications normally launch in their own windows; the encoder captures their audio only when the operating system/backend supports it.

## Mobile

**Current direction:** Flutter UI with native platform integrations.

### Android

- Microphone capture through supported Android audio APIs.
- Playback capture only for eligible apps/streams and with the required user permission and capture policy.
- Foreground service for an ongoing broadcast, with a persistent notification and visible stop control.
- Handle microphone restrictions, audio focus, Bluetooth/USB routing and battery-management behaviour.
- Do not claim that every app's audio can be captured.

### iOS / iPadOS

- Microphone and supported external audio input.
- Background operation only through supported audio-session modes and Apple's platform rules.
- No promise of unrestricted capture of arbitrary third-party app audio.
- Browser audio capture must be validated against actual iOS capabilities; do not assume desktop-style loopback exists.

## Shared contracts

The UI and audio engine should communicate through explicit, versioned interfaces.

Core concepts:

- `StationProfile`: server type, host, port, mount/stream path, codec, bitrate and saved connection settings.
- `AudioSource`: stable ID, source kind, display name, availability, gain, mute and meter state.
- `MixerState`: channel states, master gain, master mute and output meter.
- `BroadcastState`: stopped, connecting, live, reconnecting or error.
- `AudioDevice`: input/output device identity, capabilities and current selection.

Credentials must be stored using platform secure storage where available. Never write passwords or tokens to logs, diagnostics, screenshots or committed configuration.

## Broadcast output

Implement protocol adapters behind one output interface. Begin with Icecast-compatible source streaming, then verify AzuraCast and supported Shoutcast configurations against real servers. Codec and container support depends on the selected encoder build and the server's accepted source format.

Connection handling must include bounded reconnect backoff, clear state transitions, user-visible errors and an immediate stop action.

## Audio quality and safety

- Use a consistent internal sample format and sample rate where possible.
- Prevent clipping with visible peak meters and configurable master headroom.
- Avoid hidden automatic gain changes; make processing explicit and controllable.
- Handle device removal, sample-rate changes and source termination without crashing the whole app.
- Keep capture, mixing, encoding and network output independently testable.

## Proposed repository layout

```text
desktop/          Electron desktop shell
mobile/           Flutter app and native platform projects
audio-engine/     Capture, mixer, device and processing interfaces
encoder/          Codec and encoding integration
broadcast/        Streaming protocols and connection lifecycle
shared/           Shared configuration and data contracts
documentation/    Architecture, decisions, setup and testing notes
tests/            Cross-module and integration tests
```

This layout is a target structure, not a claim that all modules have been implemented.
