# JRadio Universal Broadcast Encoder

A free, open-source, cross-platform broadcast encoder for radio stations.

The goal is to let a broadcaster combine supported audio sources—websites, desktop applications, microphone and external audio devices—then encode and send one programme feed to Icecast, SHOUTcast, AzuraCast and compatible streaming servers.

## Project status

**Stage:** Desktop prototype — microphone/desktop capture, mixing and first Icecast output path are committed. Mobile prototype — microphone-to-AAC-LC streaming to Icecast-compatible servers, reconnect logic and Android foreground-notification integration are committed. Neither desktop nor mobile live output has yet been verified against a real station server or physical-device background tests. SHOUTcast adapters, mobile multi-source mixing, eligible Android playback capture, and integrated browser capture remain in development. Platform support will be added and verified in stages; do not treat the roadmap as a claim that every platform already supports every capture mode.

## Planned platforms

- Windows, macOS and Linux desktop
- Android
- iOS and iPadOS

## Planned capabilities

- Open websites in an integrated browser and launch installed desktop applications.
- Capture supported browser, system, application and external-device audio sources, including selectable soundcards and virtual audio cable inputs (desktop prototype added).
- Mix independent sources with channel faders, mute controls, meters and a master output. (Desktop microphone and OS-selected desktop audio prototype implemented.)
- Mix microphone input with programme audio.
- Encode supported formats and bitrates. (Initial FFmpeg-backed Icecast output path implemented; requires FFmpeg on PATH.)
- Broadcast to Icecast, SHOUTcast (including supported v1/v2 source configurations), AzuraCast and compatible servers.
- Save station profiles, monitor connection health and reconnect after interruptions.
- Support background broadcasting on mobile where the operating system permits it. (Android foreground-service prototype added; iOS and physical-device behaviour still require validation.)

## Important platform limits

Audio capture is governed by each operating system and by the source application's capture policy. Android playback capture works only for eligible apps and audio streams. iOS does not provide unrestricted capture of arbitrary audio from other apps. Desktop system and per-application capture also varies by OS version, permissions and audio backend.

The desktop prototype includes a selectable OS audio-input channel for physical soundcards, USB/line inputs and installed virtual loopback cable devices. A virtual cable driver must be installed separately and configured as the source application's playback destination. The application will explain unavailable capture modes instead of promising unrestricted system-wide capture.

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
