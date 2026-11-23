# Mobile application

Flutter application for the JRadio Universal Broadcast Encoder.

## Current implementation

- Selectable Microphone and External Line-in modes, using the native Android/iOS audio recorder and OS-exposed input devices (including compatible USB audio interfaces on supported Android devices).
- Line-in mode disables automatic gain, echo cancellation and noise suppression where the platform supports those effects, preserving a continuous mixer feed.
- AAC-LC stereo stream at 44.1 kHz with selectable 64–320 kbps bitrate.
- Direct Icecast source connection, including Icecast-compatible AzuraCast source endpoints.
- Source authentication, connection status and automatic reconnect with exponential backoff.
- Android foreground service with persistent broadcast notification and a Stop action.
- Responsive phone/tablet layout.

## Important limits

This is an initial mobile broadcast path, not feature parity with the desktop encoder.

- The mobile source currently sends one selected input at a time. External Line-in mode requires a genuine line-level input on a compatible USB audio interface/sound card; connect the mixer to that interface and select it in the app. A common USB-C headphone adapter may provide output only, and a phone's built-in mic socket is not converted into line-in by software. Set the mixer/interface output level conservatively and raise it until the broadcast is clear without distortion. Line-in mode disables voice-processing effects where supported; hardware/interface gain controls the actual input level. Multi-channel mixing, browser/app audio capture, SHOUTcast v1/v2 and Android playback capture are not implemented yet. USB/Bluetooth device availability and routing vary by device and still require hardware testing.
- Android playback capture is restricted to apps and audio streams that allow it. It requires a separate MediaProjection-based implementation and user consent.
- iOS does not permit unrestricted capture of other apps' audio. Background microphone operation depends on the approved audio background mode and must be verified on a physical iPhone/iPad.
- The current Icecast socket uses plain TCP. TLS/HTTPS source connections, metadata updates and a persistent replay buffer are not implemented.
- Reconnect resumes the live feed after a connection returns; audio produced while disconnected is dropped rather than replayed.
- Do not treat a successful local build as proof of a live station connection. Test with a real Icecast/AzuraCast source account.

## Requirements

- Flutter 3.24+ / Dart 3.5+ (use a current stable Flutter release where possible)
- Android Studio and Android SDK for Android builds
- macOS with Xcode for iOS builds

## Android setup

Generate the Android platform project from this directory:

```bash
flutter create --platforms=android .
```

In `android/app/src/main/AndroidManifest.xml`, add these permissions above the `<application>` element:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
```

Inside `<application>`, add the foreground service declaration:

```xml
<service
    android:name="com.pravera.flutter_foreground_task.service.ForegroundService"
    android:foregroundServiceType="microphone"
    android:exported="false" />
```

Keep the generated Flutter activity and other manifest entries. Do not replace the whole manifest with only these snippets. Android 14+ requires the microphone foreground-service type and permission. Start the broadcast while the app is visible and microphone permission is granted.

## iOS setup

In `ios/Runner/Info.plist`, add a clear microphone-use explanation:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>JRadio Encoder uses the microphone to broadcast your live radio programme.</string>
```

To request continued microphone audio while backgrounded, enable the Audio background mode in the Runner target's Signing & Capabilities and ensure `UIBackgroundModes` contains `audio` in Info.plist. iOS may still suspend or interrupt operation under system conditions; verify on a physical device.

## Install and run

From `mobile/flutter`:

```bash
flutter pub get
flutter analyze
flutter test
flutter run
```

The first broadcast test should use a test Icecast mount and a temporary source password. Never commit real server passwords to this repository.
