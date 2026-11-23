import 'package:flutter/services.dart';

/// Android MediaProjection playback-capture bridge.
///
/// Only Android 10+ media/game/unknown playback that permits capture is available.
class AndroidPlaybackCapture {
  static const MethodChannel _methods = MethodChannel('jradio/automation_capture');
  static const EventChannel _events = EventChannel('jradio/automation_capture_events');

  static Stream<dynamic> get events => _events.receiveBroadcastStream();

  static Future<void> start() async {
    await _methods.invokeMethod<bool>('start');
  }

  static Future<void> stop() async {
    await _methods.invokeMethod<void>('stop');
  }
}
