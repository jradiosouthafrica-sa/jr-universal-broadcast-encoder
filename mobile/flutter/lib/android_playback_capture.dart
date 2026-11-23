import 'dart:typed_data';

import 'package:flutter/services.dart';

/// Android MediaProjection playback-capture bridge.
///
/// Only Android 10+ media/game/unknown playback that permits capture is available.
class AndroidPlaybackCapture {
  static const MethodChannel _methods = MethodChannel('jradio/automation_capture');
  static const EventChannel _events = EventChannel('jradio/automation_capture_events');

  static Stream<List<int>> get audioStream => _events.receiveBroadcastStream().map((event) {
        if (event is Uint8List) return event.toList(growable: false);
        if (event is List<int>) return List<int>.unmodifiable(event);
        throw StateError('Unexpected automation audio event.');
      });

  static Future<void> start() async {
    await _methods.invokeMethod<bool>('start');
  }

  static Future<void> stop() async {
    await _methods.invokeMethod<void>('stop');
  }
}
