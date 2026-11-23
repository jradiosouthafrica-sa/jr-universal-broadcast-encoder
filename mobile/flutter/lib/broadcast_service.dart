import 'dart:async';
import 'dart:convert';
import 'dart:collection';
import 'dart:io';

import 'android_playback_capture.dart';

import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:record/record.dart';

enum MobileInputMode { microphone, lineIn, automation }

class MobileIcecastProfile {
  const MobileIcecastProfile({
    required this.host,
    required this.port,
    required this.mountPoint,
    required this.username,
    required this.password,
    this.bitrateKbps = 128,
    this.inputDevice,
    this.inputMode = MobileInputMode.microphone,
  });

  final String host;
  final int port;
  final String mountPoint;
  final String username;
  final String password;
  final int bitrateKbps;
  final InputDevice? inputDevice;
  final MobileInputMode inputMode;

  String? validate() {
    if (host.trim().isEmpty) return 'Enter the Icecast server host.';
    if (port < 1 || port > 65535) return 'Port must be between 1 and 65535.';
    if (!mountPoint.startsWith('/')) return 'Mount point must start with /.';
    if (username.trim().isEmpty) return 'Enter the source username.';
    if (password.isEmpty) return 'Enter the source password.';
    if (bitrateKbps < 32 || bitrateKbps > 320) {
      return 'Bitrate must be between 32 and 320 kbps.';
    }
    return null;
  }
}

typedef BroadcastStatusCallback = void Function(String status, String message);

class MobileBroadcastService {
  MobileBroadcastService({required this.onStatus});

  final BroadcastStatusCallback onStatus;
  final AudioRecorder _recorder = AudioRecorder();

  StreamSubscription<dynamic>? _audioSubscription;
  StreamSubscription<List<int>>? _socketSubscription;
  Socket? _socket;
  bool _active = false;
  int _retryAttempt = 0;
  int droppedChunks = 0;
  bool _automationCaptureActive = false;
  final Queue<List<int>> _pendingAudio = Queue<List<int>>();
  int _pendingAudioBytes = 0;
  static const int _maxPendingAudioBytes = 512 * 1024;

  bool get isActive => _active;

  Future<List<InputDevice>> listInputDevices() => _recorder.listInputDevices();

  Future<void> start(MobileIcecastProfile profile) async {
    if (_active) return;
    final validation = profile.validate();
    if (validation != null) throw StateError(validation);

    if (!await _recorder.hasPermission()) {
      throw StateError('Microphone permission was not granted.');
    }

    _active = true;
    _retryAttempt = 0;
    droppedChunks = 0;

    try {
      if (profile.inputMode == MobileInputMode.automation) {
        // Listen before requesting projection permission so the first encoded
        // programme frames are not missed when Android starts the capture service.
        _audioSubscription = AndroidPlaybackCapture.events.listen(
          _handleAutomationEvent,
          onError: (Object error) {
            onStatus('warning', 'Automation audio capture error: $error');
          },
        );
        await AndroidPlaybackCapture.start();
        _automationCaptureActive = true;
      } else {
        await _startForegroundService();
        final audio = await _recorder.startStream(
          RecordConfig(
            encoder: AudioEncoder.aacLc,
            bitRate: profile.bitrateKbps * 1000,
            sampleRate: 44100,
            numChannels: 2,
            device: profile.inputDevice,
            // Keep a mixer feed raw; voice processing can pump or gate music.
            autoGain: profile.inputMode == MobileInputMode.microphone,
            echoCancel: profile.inputMode == MobileInputMode.microphone,
            noiseSuppress: profile.inputMode == MobileInputMode.microphone,
          ),
        );
        _audioSubscription = audio.listen(
          _sendAudioChunk,
          onError: (Object error) {
            onStatus('warning', 'Audio input stream error: $error');
          },
        );
      }
      onStatus('connecting', 'Connecting to ${profile.host}:${profile.port}');
      unawaited(_connectionLoop(profile));
    } catch (_) {
      _active = false;
      await _audioSubscription?.cancel();
      _audioSubscription = null;
      if (profile.inputMode == MobileInputMode.automation) {
        try { await AndroidPlaybackCapture.stop(); } catch (_) {}
        _automationCaptureActive = false;
      } else {
        await _recorder.stop();
        await FlutterForegroundTask.stopService();
      }
      rethrow;
    }
  }

  void _handleAutomationEvent(dynamic event) {
    if (event is List<int>) {
      _sendAudioChunk(event);
      return;
    }
    if (event is Map) {
      onStatus(
        event['status']?.toString() ?? 'info',
        event['message']?.toString() ?? 'Automation capture status changed.',
      );
    }
  }

  void _sendAudioChunk(List<int> chunk) {
    if (!_active) return;
    final socket = _socket;
    if (socket == null) {
      final copy = List<int>.of(chunk, growable: false);
      while (_pendingAudio.isNotEmpty &&
          _pendingAudioBytes + copy.length > _maxPendingAudioBytes) {
        _pendingAudioBytes -= _pendingAudio.removeFirst().length;
        droppedChunks++;
      }
      if (copy.length <= _maxPendingAudioBytes) {
        _pendingAudio.addLast(copy);
        _pendingAudioBytes += copy.length;
      } else {
        droppedChunks++;
      }
      return;
    }
    try {
      socket.add(chunk);
    } catch (_) {
      droppedChunks++;
    }
  }

  void _flushPendingAudio(Socket socket) {
    while (_pendingAudio.isNotEmpty && identical(_socket, socket)) {
      final chunk = _pendingAudio.removeFirst();
      _pendingAudioBytes -= chunk.length;
      try {
        socket.add(chunk);
      } catch (_) {
        droppedChunks++;
        break;
      }
    }
  }

  Future<void> _connectionLoop(MobileIcecastProfile profile) async {
    const retrySeconds = <int>[1, 2, 4, 8, 15, 30];

    while (_active) {
      Socket? socket;
      StreamSubscription<List<int>>? subscription;
      try {
        socket = await Socket.connect(
          profile.host.trim(),
          profile.port,
          timeout: const Duration(seconds: 10),
        );
        final connectedSocket = socket;
        final handshake = Completer<void>();
        final response = StringBuffer();

        subscription = connectedSocket.listen(
          (data) {
            if (handshake.isCompleted) return;
            response.write(latin1.decode(data, allowInvalid: true));
            final text = response.toString();
            if (!text.contains('\r\n\r\n')) return;
            final statusLine = text.split('\r\n').first;
            if (statusLine.contains(' 200 ')) {
              handshake.complete();
            } else {
              handshake.completeError(
                StateError('Icecast rejected the source: $statusLine'),
              );
            }
          },
          onError: (Object error, StackTrace stack) {
            if (!handshake.isCompleted) handshake.completeError(error, stack);
          },
          onDone: () {
            if (!handshake.isCompleted) {
              handshake.completeError(StateError('Server closed the connection.'));
            }
            if (identical(_socket, connectedSocket)) _socket = null;
          },
          cancelOnError: false,
        );

        final credentials = base64.encode(
          utf8.encode('${profile.username}:${profile.password}'),
        );
        connectedSocket.write(
          'SOURCE ${profile.mountPoint} HTTP/1.0\r\n'
          'Authorization: Basic $credentials\r\n'
          'Content-Type: audio/aac\r\n'
          'User-Agent: JRadio-Universal-Broadcast-Encoder/0.2\r\n'
          'ice-bitrate: ${profile.bitrateKbps}\r\n'
          '\r\n',
        );

        await handshake.future.timeout(const Duration(seconds: 10));
        if (!_active) break;
        _socket = connectedSocket;
        _socketSubscription = subscription;
        _flushPendingAudio(connectedSocket);
        _retryAttempt = 0;
        onStatus('live', 'Connected to Icecast. ${profile.inputMode == MobileInputMode.automation ? 'Automation playback' : profile.inputMode == MobileInputMode.lineIn ? 'External line-in' : 'Microphone'} audio is being sent.');
        await connectedSocket.done;
      } catch (error) {
        if (_active) {
          onStatus('reconnecting', 'Connection interrupted: $error');
        }
      } finally {
        if (identical(_socket, socket)) _socket = null;
        if (identical(_socketSubscription, subscription)) {
          _socketSubscription = null;
        }
        await subscription?.cancel();
        socket?.destroy();
      }

      if (!_active) break;
      onStatus('reconnecting', 'Trying to reconnect to the station…');
      final seconds = retrySeconds[
        _retryAttempt.clamp(0, retrySeconds.length - 1).toInt()
      ];
      _retryAttempt++;
      await Future<void>.delayed(Duration(seconds: seconds));
    }
  }

  Future<void> _startForegroundService() async {
    if (!Platform.isAndroid) return;

    FlutterForegroundTask.init(
      androidNotificationOptions: AndroidNotificationOptions(
        channelId: 'jradio_broadcast',
        channelName: 'JRadio live broadcast',
        channelDescription: 'Keeps your radio broadcast active.',
        onlyAlertOnce: true,
      ),
      iosNotificationOptions: const IOSNotificationOptions(
        showNotification: false,
        playSound: false,
      ),
      foregroundTaskOptions: ForegroundTaskOptions(
        eventAction: ForegroundTaskEventAction.repeat(15000),
        autoRunOnBoot: false,
        allowWakeLock: true,
        allowWifiLock: true,
      ),
    );

    final notificationPermission = await FlutterForegroundTask.checkNotificationPermission();
    if (notificationPermission != NotificationPermission.granted) {
      await FlutterForegroundTask.requestNotificationPermission();
    }

    await FlutterForegroundTask.startService(
      serviceId: 731,
      notificationTitle: 'JRadio is broadcasting',
      notificationText: 'Live audio connection active',
      notificationButtons: const [
        NotificationButton(id: 'stop', text: 'STOP'),
      ],
      callback: mobileBroadcastTaskCallback,
    );
  }

  Future<void> stop() async {
    _active = false;
    await _audioSubscription?.cancel();
    _audioSubscription = null;
    await _socketSubscription?.cancel();
    _socketSubscription = null;
    _socket?.destroy();
    _socket = null;
    if (_automationCaptureActive) {
      try {
        await AndroidPlaybackCapture.stop();
      } catch (_) {
        // Android may already have stopped the projection session.
      }
      _automationCaptureActive = false;
    } else {
      try {
        await _recorder.stop();
      } catch (_) {
        // The recorder may already have stopped after a platform interruption.
      }
      if (Platform.isAndroid) {
        await FlutterForegroundTask.stopService();
      }
    }
    _pendingAudio.clear();
    _pendingAudioBytes = 0;
    onStatus('stopped', 'Broadcast stopped.');
  }

  Future<void> dispose() async {
    await stop();
    await _recorder.dispose();
  }
}

@pragma('vm:entry-point')
void mobileBroadcastTaskCallback() {
  FlutterForegroundTask.setTaskHandler(MobileBroadcastTaskHandler());
}

class MobileBroadcastTaskHandler extends TaskHandler {
  @override
  Future<void> onStart(DateTime timestamp, TaskStarter starter) async {}

  @override
  void onRepeatEvent(DateTime timestamp) {
    unawaited(FlutterForegroundTask.updateService(
      notificationTitle: 'JRadio is broadcasting',
      notificationText: 'Your live broadcast is running',
    ));
  }

  @override
  void onNotificationButtonPressed(String id) {
    if (id == 'stop') FlutterForegroundTask.sendDataToMain('stop');
  }

  @override
  Future<void> onDestroy(DateTime timestamp) async {}
}
