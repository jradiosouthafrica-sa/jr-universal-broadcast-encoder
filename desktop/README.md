# Desktop application shell

## Requirements

- Node.js 20 or later
- npm

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

The current Electron window and React interface are a foundation only. Browser integration, installed-app audio capture, mixer, encoder and streaming output are not implemented yet.

Electron security defaults are enabled: renderer Node integration is disabled, context isolation is enabled, and the preload file exposes no privileged API.
