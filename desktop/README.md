# Desktop application

## Requirements

- Node.js 20 or later
- npm
- FFmpeg installed and available as `ffmpeg` on the system PATH for live Icecast output

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
- Desktop/system audio capture through the OS sharing picker, where supported.
- Independent microphone and desktop channel gain/mute controls, meters and a master mix.
- A mixed audio stream is passed to Electron's main process.
- The first live output adapter supports Icecast source connections. FFmpeg converts the app's WebM/Opus capture stream to the selected MP3, AAC, Ogg Vorbis or Ogg Opus output format.
- The source password is sent from the desktop main process to the Icecast server; it is not placed in a URL or logged by the application.

### Known limitations

- Install FFmpeg separately and ensure the `ffmpeg` executable is on PATH. A bundled FFmpeg distribution and its codec/build licensing still need review.
- Only Icecast has a live source adapter at this stage. SHOUTcast v1/v2 and AzuraCast adapters are not yet implemented.
- This prototype uses a plain TCP Icecast source connection; TLS output, reconnect/backoff, metadata updates and production-grade network buffering are not yet implemented.
- Desktop audio capture depends on OS support and the source application's capture policy. Browser and external line/USB inputs are not separate source channels yet.
- A successful profile validation does not prove that the station server accepts the credentials or selected codec. Test against a real Icecast server before relying on it for a programme.

Electron security defaults are enabled: renderer Node integration is disabled, context isolation is enabled, and privileged operations are exposed only through a narrow preload bridge.
