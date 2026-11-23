# Mobile application

Flutter application for the JRadio Universal Broadcast Encoder.

## Current implementation

- Selectable Microphone and Line-in test modes using native Android/iOS audio capture and OS-exposed input devices.
- On Android tablets that expose a 3.5 mm headset microphone as a recording input, Line-in test mode can select that wired headset input. It is a mono microphone-level workaround, not a true stereo line input.
- Line-in test mode disables automatic gain, echo cancellation and noise suppression where the platform supports those effects, preserving a continuous mixer feed.
- AAC-LC stereo stream at 44.1 kHz with selectable 64–320 kbps bitrate.
- Direct Icecast source connection, including Icecast-compatible AzuraCast source endpoints.
- Source authentication, connection status and automatic reconnect with exponential backoff.
- Android foreground service with persistent broadcast notification and a Stop action.
- Responsive phone/tablet layout.
- An in-app WebView workspace that opens web-based radio automation websites without leaving the encoder, with address navigation, back/forward and reload controls.
- The browser workspace is currently a UI/navigation milestone only: its WebView audio is not yet routed into the broadcast encoder. The live source remains the selected microphone or external input until the dedicated browser-audio bridge is implemented and tested.

## Important limits

This is an initial mobile broadcast path, not feature parity with the desktop encoder.

- The mobile source currently sends one selected input at a time. For an initial no-USB test, a tablet's 3.5 mm combined headset socket may expose a wired headset microphone input. Select the Wired headset device if Android lists it after connection. This is microphone-level and normally mono; it is not true stereo line-in. To feed a mixer output into it, use a compatible CTIA TRRS mic-input adapter/cable with suitable attenuation. Do not connect a speaker/amp output directly, and start with the mixer output very low to avoid overloading the mic input. Some tablets expose only headphone output or do not enumerate the headset microphone as a selectable input; in that case this route cannot work on that device. Proper stereo line-in will later require a suitable audio interface. Line-in test mode disables voice-processing effects where supported. Multi-channel mixing, browser/app audio capture, SHOUTcast v1/v2 and Android playback capture are not implemented yet. USB/Bluetooth device availability and routing vary by device and still require hardware testing.
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
