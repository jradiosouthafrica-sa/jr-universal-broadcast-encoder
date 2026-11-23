# Flutter mobile shell

This directory contains the initial Flutter UI source for the JRadio Universal Broadcast Encoder.

## Requirements

- Flutter SDK compatible with the Dart constraint in `pubspec.yaml`
- Android Studio / Android SDK for Android builds
- Xcode on macOS for iOS builds

## Generate native platform folders

From this directory, run:

```bash
flutter create --platforms=android,ios .
```

Then fetch dependencies and run:

```bash
flutter pub get
flutter run
```

The checked-in app is an interface shell only. It does not yet capture audio, run a foreground service, encode audio or connect to a streaming server.

Android playback capture is restricted to eligible apps and streams. iOS does not allow unrestricted capture of arbitrary third-party application audio. These limits must be reflected in the final product behaviour.
