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

- [ ] Enumerate microphone and available audio devices.
- [ ] Implement one supported desktop loopback backend.
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
- [ ] Add reconnect, health state and secure credential storage.

**Acceptance:** A controlled test stream is received and decoded by a compatible server/client; stop reliably terminates transmission.

## 5. Android

- [ ] Create Flutter application shell.
- [ ] Implement microphone and external input capture.
- [ ] Implement eligible Android playback capture with clear limitations.
- [ ] Add foreground broadcast service and persistent notification controls.
- [ ] Test screen lock, app switching, audio focus and battery behaviour.
- [ ] Test USB/Bluetooth routing on supported devices.

**Acceptance:** A supported source remains on-air during screen lock and app switching with a visible notification and working stop control.

## 6. iOS / iPadOS

- [ ] Create Flutter iOS shell and native audio-session integration.
- [ ] Implement microphone and supported external inputs.
- [ ] Validate background broadcast under Apple's permitted audio-session behaviour.
- [ ] Document unsupported third-party app/browser capture cases.
- [ ] Test interruptions, route changes and background transitions.

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
