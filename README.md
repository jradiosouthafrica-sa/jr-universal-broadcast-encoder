# JRadio Universal Broadcast Encoder

A free, open-source, cross-platform broadcast encoder for radio stations.

The goal is to let a broadcaster combine supported audio sources—websites, desktop applications, microphone and external audio devices—then encode and send one programme feed to Icecast, SHOUTcast, AzuraCast and compatible streaming servers.

## Project status

**Stage:** Foundation

This repository is the start of the project. Audio capture, mixing, encoding and live streaming are not implemented yet. Platform support will be added and verified in stages; do not treat the roadmap as a claim that every platform already supports every capture mode.

## Planned platforms

- Windows, macOS and Linux desktop
- Android
- iOS and iPadOS

## Planned capabilities

- Open websites in an integrated browser and launch installed desktop applications.
- Capture supported browser, system, application and external-device audio sources.
- Mix independent sources with channel faders, mute controls, meters and a master output.
- Mix microphone input with programme audio.
- Encode supported formats and bitrates.
- Broadcast to Icecast, SHOUTcast (including supported v1/v2 source configurations), AzuraCast and compatible servers.
- Save station profiles, monitor connection health and reconnect after interruptions.
- Support background broadcasting on mobile where the operating system permits it.

## Important platform limits

Audio capture is governed by each operating system and by the source application's capture policy. Android playback capture works only for eligible apps and audio streams. iOS does not provide unrestricted capture of arbitrary audio from other apps. Desktop system and per-application capture also varies by OS version, permissions and audio backend.

The application will explain unavailable capture modes instead of promising unrestricted system-wide capture.

## Architecture direction

- **Desktop UI:** Electron with React and TypeScript.
- **Mobile UI:** Flutter with native Android and iOS audio integrations.
- **Audio engine:** A separately testable native audio layer; Rust is the current candidate.
- **Broadcasting:** A modular output layer with separate Icecast and SHOUTcast adapters, plus an AzuraCast-compatible configuration path.
- **Shared models:** Station profiles, source configuration and stream settings.

Technology choices remain subject to prototype testing and dependency-license review.

## Development principles

1. Build and verify one milestone at a time.
2. Keep this project independent from existing JRadio broadcast infrastructure.
3. Prefer free and open-source dependencies; do not require a paid AI API.
4. Never commit stream passwords, API keys or private credentials.
5. Make broadcast start and stop explicit and provide a clear stop control.
6. Document platform limitations and test results honestly.

## Initial milestones

1. Repository foundation and architecture.
2. Desktop application shell and integrated browser.
3. Audio-device discovery and desktop capture prototype.
4. Mixer, metering and microphone integration.
5. Encoder with Icecast and SHOUTcast output adapters, plus AzuraCast compatibility.
6. Android capture and foreground/background broadcasting.
7. iOS implementation within Apple platform capabilities.
8. macOS/Linux validation, packaging and release preparation.

See [Architecture](documentation/ARCHITECTURE.md) and [Roadmap](documentation/ROADMAP.md).

## License

The intended project license is **GPL-3.0-or-later**, subject to a review of all bundled libraries, codecs, native components and distribution obligations before a license file is added.
