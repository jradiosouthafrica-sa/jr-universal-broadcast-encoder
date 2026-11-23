# SHOUTcast support

SHOUTcast is a required first-class output option in JRadio Universal Broadcast Encoder, alongside Icecast and AzuraCast-compatible live-source connections.

## User experience

When creating a station profile, the user selects the server family and, for SHOUTcast, the supported server version/mode. The form must show only fields relevant to that mode and explain where the station administrator can obtain them.

Common fields include:

- Server hostname or IP address
- Source port
- Source password (stored securely, never displayed in logs)
- Audio format and bitrate supported by the server
- SHOUTcast v2 stream ID / stream selection where required by the server

Do not label an Icecast mount-point field as a universal SHOUTcast field. Exact connection and authentication requirements vary by SHOUTcast server version and source-client compatibility.

## Adapter requirements

- Implement SHOUTcast behind the shared broadcast-output interface.
- Treat v1 and v2 as distinct modes until interoperability tests prove a shared implementation is correct.
- Validate credentials and server response before reporting the stream as live.
- Surface authentication failures, rejected formats, connection timeouts and server disconnects.
- Reconnect with bounded backoff and provide a clear manual stop control.
- Keep passwords out of exported profiles, logs, crash reports and diagnostics.
- Test against real SHOUTcast server versions and document the exact versions and source protocol validated.

## Acceptance tests

1. Connect to a test SHOUTcast v1 server using valid source credentials.
2. Confirm the server receives and relays the encoded programme audio.
3. Confirm invalid credentials produce a clear authentication error.
4. Confirm disconnect and stop controls close the source connection.
5. Repeat the tests for SHOUTcast v2, including stream ID selection.
6. Verify reconnect behaviour after a temporary network interruption.

A SHOUTcast option must not be marked implemented merely because a server type appears in the UI. It is complete only after the relevant source connection and audio relay tests pass.
