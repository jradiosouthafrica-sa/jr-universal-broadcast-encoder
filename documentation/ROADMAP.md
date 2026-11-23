# Development Roadmap

Each milestone must have a demonstrable result and a recorded test outcome before the next milestone is treated as complete.

## 0. Repository foundation

- [x] Create public repository.
- [x] Add project overview and platform constraints.
- [x] Define initial architecture and milestones.
- [ ] Add dependency and license policy.
- [ ] Add contribution and security reporting guidance.

## 1. Desktop foundation

**Target:** Windows prototype first.

- [ ] Establish Electron + React + TypeScript project.
- [ ] Create accessible, responsive JRadio-branded studio shell.
- [ ] Add integrated browser view with URL navigation and safe controls.
- [ ] Add installed-application launcher concept.
- [ ] Define IPC boundaries; keep privileged operations out of renderer code.
- [ ] Add lint, type-check and automated test commands.

**Acceptance:** App launches locally, browser navigation works, and no audio/broadcast feature is represented as functional until implemented.

## 2. Audio device and capture prototype

- [x] Add renderer-level enumeration and selection of OS audio input devices, including exposed soundcards and virtual cable endpoints (prototype; native backend validation remains open).
- [x] Refresh the renderer device list on OS-reported audio input changes and warn when a selected input disappears (prototype).
- [x] Add an initial Windows WASAPI system-output loopback adapter through FFmpeg PCM capture and route its PCM into the desktop mixer (implementation prototype; hardware validation remains open).
- [ ] Replace/augment the FFmpeg-based Windows loopback prototype with a dedicated native WASAPI backend; support selecting individual playback endpoints and capturing physical audio inputs natively.
- [ ] Implement CoreAudio/PipeWire loopback backends and validate virtual device routing on each OS.
- [ ] Validate browser/system capture.
- [ ] Investigate per-application capture and document OS/version limits.
- [ ] Add capture permission and device error handling.

**Acceptance:** A test signal can be captured reliably, monitored and stopped without leaks or app crashes.

## 3. Mixer

- [ ] Independent source channels and gain controls.
- [ ] Mute and solo behaviour.
- [ ] Channel and master peak meters.
- [ ] Microphone plus programme mixing.
- [ ] Device removal and source failure handling.
- [ ] Automated audio-path tests.

**Acceptance:** Two independent test sources and a microphone can be mixed with predictable gain and no unintended clipping.

## 4. Encoder and streaming output

- [ ] Select and audit encoder dependencies and codec licensing.
- [ ] Implement MP3 output first if the selected build permits redistribution.
- [ ] Add configurable bitrate and sample-rate profiles.
- [ ] Implement Icecast source connection and disconnect.
- [ ] Implement SHOUTcast v1 source connection and validate authentication/streaming.
- [ ] Implement SHOUTcast v2 source connection, including stream ID selection, and validate against a real server.
- [ ] Add AzuraCast live-source setup guidance and verify supported configurations.
- [ ] Validate Icecast and SHOUTcast adapters against test servers.
- [x] Add an Icecast auto-reconnect prototype with exponential backoff, connection-state reporting and a bounded encoded-audio buffer (implementation only; real-server interruption tests remain open).
- [ ] Validate automatic reconnect, health state and secure credential storage against real Icecast and SHOUTcast servers.

**Acceptance:** A controlled test stream is received and decoded by a compatible server/client; stop reliably terminates transmission.

## 5. Android

- [x] Create Flutter application shell and responsive phone/tablet broadcast console (prototype).
- [x] Implement a microphone-to-AAC-LC stream and direct Icecast source connection (implementation prototype; device/server validation open).
- [ ] Add selectable external input capture and multiple-source mixing.
- [ ] Implement eligible Android playback capture with clear limitations.
- [x] Add Android foreground-service integration and persistent notification Stop control (manifest integration and device validation remain open).
- [ ] Test screen lock, app switching, audio focus and battery behaviour on physical Android devices.
- [ ] Test USB/Bluetooth routing on supported devices.

**Acceptance:** A supported source remains on-air during screen lock and app switching with a visible notification and working stop control.

## 6. iOS / iPadOS

- [x] Create Flutter iOS-compatible shell and microphone-to-AAC streaming path (implementation prototype).
- [ ] Add and validate iOS audio-session/background-mode configuration on a physical device.
- [ ] Implement supported external inputs.
- [x] Document unsupported third-party app/browser capture cases.
- [ ] Test interruptions, route changes and background transitions on physical iPhone/iPad devices.

**Acceptance:** Supported input can broadcast in permitted background scenarios; unsupported capture requests are clearly explained.

## 7. macOS and Linux

- [ ] Implement and test CoreAudio capture.
- [ ] Implement and test PipeWire capture.
- [ ] Add PulseAudio compatibility where practical.
- [ ] Package and document each supported environment.

## 8. Release readiness

- [ ] Automated unit, integration and platform tests.
- [ ] Security review for credentials, IPC and network handling.
- [ ] Dependency and license audit.
- [ ] Installers and release artifacts for supported platforms.
- [ ] User guide, troubleshooting and known-limitations documentation.
- [ ] Publish source and release notes.

## Working rule

Do not mark a checkbox complete based only on code being written. Record the platform, OS version, device/backend and test evidence. Never report a feature as working until it has been run and verified.
