# Desktop application

## Requirements

- Node.js 20 or later
- npm
- FFmpeg installed and available as `ffmpeg` on the system PATH for live Icecast output; Windows WASAPI loopback additionally requires a build with WASAPI input support

## Run in development

```bash
cd desktop
npm install
npm run dev
```

## Build renderer

```bash
npm run build
```

## Current audio and broadcast prototype

- Microphone capture through the browser media-device API.
- Selectable audio input devices, including physical soundcards, USB interfaces, line inputs and installed virtual audio cable/loopback devices exposed by the operating system.
- Automatically refresh the device list when the operating system reports that an audio input was connected or removed; warn if the selected device disappears.
- Route another application's playback output to a virtual cable, then select that cable as the encoder input channel. The virtual cable driver is installed separately; the app does not create one.
- Desktop/system audio capture through the OS sharing picker, where supported.
- Windows-only native system-output loopback prototype using FFmpeg's WASAPI input (`-loopback 1`), converted to 48 kHz stereo signed 16-bit PCM and mixed into the desktop channel.
- Independent microphone, desktop and selected-device channel gain/mute controls, meters and a master mix.
- A mixed audio stream is passed to Electron's main process.
- The first live output adapter supports Icecast source connections. FFmpeg converts the app's WebM/Opus capture stream to the selected MP3, AAC, Ogg Vorbis or Ogg Opus output format.
- Icecast connection loss triggers automatic reconnect attempts with exponential backoff (1, 2, 4, 8, 15, then 30 seconds, repeating). The FFmpeg encoder and mixer remain active; encoded audio is buffered up to 16 MiB while disconnected and the broadcast stops with a clear error if that safety limit is reached.
- The source password is sent from the desktop main process to the Icecast server; it is not placed in a URL or logged by the application.

### Known limitations

- Install FFmpeg separately and ensure the `ffmpeg` executable is on PATH. A bundled FFmpeg distribution and its codec/build licensing still need review.
- Only Icecast has a live source adapter at this stage. SHOUTcast v1/v2 and AzuraCast adapters are not yet implemented.
- This prototype uses a plain TCP Icecast source connection; TLS output, metadata updates and production-grade network buffering are not yet implemented. Automatic reconnect is an implementation prototype and still needs testing against a real Icecast server, including server restart and network interruption.
- Windows WASAPI system loopback has not yet been verified on physical Windows hardware and depends on the installed FFmpeg build. It captures the default Windows playback endpoint; choosing individual playback endpoints and native physical-input capture are future work. Selectable-device input uses audio input devices exposed by the OS. A virtual cable must be installed and configured separately (for example VB-CABLE on Windows). The app cannot create or guarantee a virtual device. Device labels may require microphone permission before enumeration. Device hot-plug detection uses the renderer media-device change event; native backend hot-plug handling remains future work. Desktop sharing remains subject to OS support and application capture policy.
- A successful profile validation does not prove that the station server accepts the credentials or selected codec. Test against a real Icecast server before relying on it for a programme.

Electron security defaults are enabled: renderer Node integration is disabled, context isolation is enabled, and privileged operations are exposed only through a narrow preload bridge.
