# Architecture

## Product boundary

JRadio Universal Broadcast Encoder is a standalone broadcaster application. It does not replace or modify the station's AzuraCast installation. It produces one encoded programme stream and sends it to a configured streaming server.

## High-level data flow

```text
Web browser audio ─┐
Desktop app audio ─┤
Microphone input ──┼─> Source capture ─> Channel mixer ─> Master processing
External input ───┘                                  │

Desktop device routing includes selectable OS audio-input endpoints. A physical soundcard, USB/line input or virtual loopback cable appears as a source when the OS exposes it as an audio input. Virtual cable drivers are installed and configured outside this application; route an application's playback output to the cable, then select its recording/input endpoint in the encoder.
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

- Windows: enumerate selectable WASAPI/WDM audio input endpoints, including soundcards and virtual cable recording endpoints; add native WASAPI loopback and investigate per-application capture support and version requirements.
- macOS: enumerate CoreAudio input devices and support virtual loopback drivers such as BlackHole where installed, respecting system permissions and supported capture APIs.
- Linux: enumerate PipeWire input nodes, including virtual sinks/monitor sources; provide PulseAudio compatibility where practical.

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

- `StationProfile`: server family and version, host, port, mount or stream ID, source username where required, secret reference, codec, bitrate and saved connection settings. The secret itself must never be stored in plain-text profile exports.
- `AudioSource`: stable ID, source kind, display name, availability, gain, mute and meter state.
- `MixerState`: channel states, master gain, master mute and output meter.
- `BroadcastState`: stopped, connecting, live, reconnecting or error.
- `AudioDevice`: input/output device identity, capabilities and current selection.

Credentials must be stored using platform secure storage where available. Never write passwords or tokens to logs, diagnostics, screenshots or committed configuration.

## Broadcast output

Implement protocol adapters behind one output interface, not one generic form with assumed-identical fields. Provide distinct Icecast and SHOUTcast adapters, and an AzuraCast setup path that targets the station's configured compatible source protocol.

### Icecast

Support host, source port, mount point, source username when required by the server, source password, codec and bitrate. Validate mount syntax and server response.

### SHOUTcast

Support SHOUTcast v1 and v2 as distinct configuration modes where validated. Provide host, source port, source password and the v2 stream ID/stream selection fields required by the selected server and source client. Do not assume Icecast mount-point semantics apply to SHOUTcast. Confirm exact authentication and stream-selection behaviour against real SHOUTcast server versions before marking an adapter complete.

### AzuraCast

Provide a guided profile for an AzuraCast station's configured live-DJ/source connection. Use the connection type and credentials supplied by the station's AzuraCast configuration; do not assume every AzuraCast installation uses the same host, port, mount or protocol.

Codec and container support depends on the selected encoder build and the server's accepted source format. Each adapter must report authentication, connection and stream errors clearly.

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
