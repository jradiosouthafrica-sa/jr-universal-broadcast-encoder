import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:record/record.dart';

import 'broadcast_service.dart';

void main() {
  FlutterForegroundTask.initCommunicationPort();
  runApp(const JRadioEncoderApp());
}

class JRadioEncoderApp extends StatelessWidget {
  const JRadioEncoderApp({super.key});

  @override
  Widget build(BuildContext context) {
    const accent = Color(0xFFF2A33A);
    return MaterialApp(
      title: 'JRadio Universal Broadcast Encoder',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF101820),
        colorScheme: ColorScheme.fromSeed(
          seedColor: accent,
          brightness: Brightness.dark,
          surface: const Color(0xFF192832),
        ),
        useMaterial3: true,
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFF101D25),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFF344B56)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFF344B56)),
          ),
        ),
      ),
      home: const StudioHome(),
    );
  }
}

class StudioHome extends StatefulWidget {
  const StudioHome({super.key});

  @override
  State<StudioHome> createState() => _StudioHomeState();
}

class _StudioHomeState extends State<StudioHome> {
  final _host = TextEditingController();
  final _port = TextEditingController(text: '8000');
  final _mount = TextEditingController(text: '/live');
  final _username = TextEditingController(text: 'source');
  final _password = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  MobileBroadcastService? _service;
  final AudioRecorder _deviceProbe = AudioRecorder();
  List<InputDevice> _inputDevices = [];
  String _selectedInputId = '';
  MobileInputMode _inputMode = MobileInputMode.microphone;
  String _status = 'off';
  String _statusMessage = 'Set your station connection details to begin.';
  int _bitrate = 128;
  bool _hidePassword = true;
  bool _busy = false;

  bool get _onAir => _status == 'live';
  bool get _working => _status == 'connecting' || _status == 'reconnecting';

  @override
  void initState() {
    super.initState();
    FlutterForegroundTask.addTaskDataCallback(_onTaskData);
    unawaited(_refreshInputDevices());
  }

  Future<void> _refreshInputDevices() async {
    try {
      final devices = await _deviceProbe.listInputDevices();
      if (!mounted) return;
      setState(() {
        _inputDevices = devices;
        if (_selectedInputId.isNotEmpty &&
            !devices.any((device) => device.id == _selectedInputId)) {
          _selectedInputId = '';
        }
      });
    } catch (error) {
      _setStatus('warning', 'Could not list audio inputs: $error');
    }
  }

  void _onTaskData(Object data) {
    if (data == 'stop') unawaited(_stopBroadcast());
  }

  void _setStatus(String status, String message) {
    if (!mounted) return;
    setState(() {
      _status = status;
      _statusMessage = message;
    });
  }

  Future<void> _startBroadcast() async {
    if (!_formKey.currentState!.validate() || _busy) return;
    setState(() => _busy = true);
    InputDevice? selectedInput;
    for (final device in _inputDevices) {
      if (device.id == _selectedInputId) selectedInput = device;
    }
    final profile = MobileIcecastProfile(
      host: _host.text.trim(),
      port: int.parse(_port.text.trim()),
      mountPoint: _mount.text.trim(),
      username: _username.text.trim(),
      password: _password.text,
      bitrateKbps: _bitrate,
      inputDevice: selectedInput,
      inputMode: _inputMode,
    );

    final service = MobileBroadcastService(
      onStatus: (status, message) => _setStatus(status, message),
    );
    _service = service;
    try {
      await service.start(profile);
    } catch (error) {
      await service.dispose();
      _service = null;
      _setStatus('error', error.toString().replaceFirst('Bad state: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _stopBroadcast() async {
    final service = _service;
    if (service == null) {
      _setStatus('stopped', 'Broadcast is stopped.');
      return;
    }
    setState(() => _busy = true);
    await service.dispose();
    _service = null;
    _setStatus('stopped', 'Broadcast stopped.');
    if (mounted) setState(() => _busy = false);
  }

  @override
  void dispose() {
    FlutterForegroundTask.removeTaskDataCallback(_onTaskData);
    unawaited(_service?.dispose());
    _host.dispose();
    _port.dispose();
    _mount.dispose();
    _username.dispose();
    _password.dispose();
    unawaited(_deviceProbe.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final statusColor = _onAir
        ? const Color(0xFF35D39A)
        : _working
            ? const Color(0xFFF2A33A)
            : const Color(0xFF82949C);

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 18,
        title: const Row(
          children: [
            CircleAvatar(
              radius: 17,
              backgroundColor: Color(0xFFF2A33A),
              foregroundColor: Color(0xFF101820),
              child: Text('JR', style: TextStyle(fontWeight: FontWeight.w900)),
            ),
            SizedBox(width: 11),
            Expanded(
              child: Text(
                'JRadio Encoder',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17),
              ),
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 14),
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
                decoration: BoxDecoration(
                  color: statusColor.withAlpha(33),
                  borderRadius: BorderRadius.circular(30),
                  border: Border.all(color: statusColor.withAlpha(115)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.circle, size: 8, color: statusColor),
                    const SizedBox(width: 6),
                    Text(
                      _onAir ? 'ON AIR' : _working ? 'CONNECTING' : 'OFF AIR',
                      style: TextStyle(
                        color: statusColor,
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        letterSpacing: .8,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 34),
          children: [
            const Text(
              'MOBILE BROADCAST CONTROL',
              style: TextStyle(
                color: Color(0xFF90A6AF),
                fontSize: 10,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.8,
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Take your station\nwith you.',
              style: TextStyle(fontSize: 33, height: 1.08, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 10),
            const Text(
              'Capture a microphone or external mixer line-in and send live AAC audio directly to an Icecast-compatible station server.',
              style: TextStyle(color: Color(0xFFAAC0C8), height: 1.5),
            ),
            const SizedBox(height: 22),
            _sectionTitle('AUDIO INPUT'),
            const SizedBox(height: 10),
            SegmentedButton<MobileInputMode>(
              segments: const [
                ButtonSegment(
                  value: MobileInputMode.microphone,
                  icon: Icon(Icons.mic),
                  label: Text('Microphone'),
                ),
                ButtonSegment(
                  value: MobileInputMode.lineIn,
                  icon: Icon(Icons.cable),
                  label: Text('Line-in'),
                ),
              ],
              selected: {_inputMode},
              onSelectionChanged: (_onAir || _working)
                  ? null
                  : (selection) {
                      setState(() => _inputMode = selection.first);
                      if (selection.first == MobileInputMode.lineIn) {
                        unawaited(_refreshInputDevices());
                      }
                    },
            ),
            const SizedBox(height: 10),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CircleAvatar(
                      backgroundColor: const Color(0xFF29414B),
                      child: Icon(
                        _inputMode == MobileInputMode.lineIn ? Icons.cable : Icons.mic,
                        color: const Color(0xFFF2A33A),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        _inputMode == MobileInputMode.lineIn
                            ? '3.5 mm headset-mic test: connect the mixer output through a compatible TRRS headset-mic adapter/cable with attenuation. Select Wired headset if Android lists it. This is a mono microphone input, not true stereo line-in; raw audio is used and voice processing is disabled.'
                            : 'Microphone: use the phone microphone, a USB microphone or another supported input. Select the connected input below.',
                        style: const TextStyle(color: Color(0xFFAAC0C8), height: 1.4),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    key: ValueKey(_selectedInputId),
                    initialValue: _selectedInputId,
                    decoration: InputDecoration(
                      labelText: _inputMode == MobileInputMode.lineIn ? 'Wired / external input' : 'Microphone device',
                      helperText: _inputMode == MobileInputMode.lineIn
                          ? 'After plugging in, choose Wired headset if Android lists it'
                          : 'Choose a connected microphone or default input',
                    ),
                    items: [
                      const DropdownMenuItem(
                        value: '',
                        child: Text('Default device'),
                      ),
                      ..._inputDevices.map(
                        (device) => DropdownMenuItem(
                          value: device.id,
                          child: Text(device.label, overflow: TextOverflow.ellipsis),
                        ),
                      ),
                    ],
                    onChanged: (_onAir || _working)
                        ? null
                        : (value) => setState(() => _selectedInputId = value ?? ''),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filledTonal(
                  tooltip: 'Refresh audio inputs',
                  onPressed: (_onAir || _working) ? null : _refreshInputDevices,
                  icon: const Icon(Icons.refresh),
                ),
              ],
            ),
            const SizedBox(height: 20),
            _sectionTitle('STATION CONNECTION'),
            Form(
              key: _formKey,
              child: Column(
                children: [
                  _field(_host, 'Server host', hint: 'radio.example.com'),
                  const SizedBox(height: 11),
                  Row(
                    children: [
                      Expanded(child: _field(_port, 'Port', keyboard: TextInputType.number)),
                      const SizedBox(width: 10),
                      Expanded(child: _field(_mount, 'Mount point', hint: '/live')),
                    ],
                  ),
                  const SizedBox(height: 11),
                  _field(_username, 'Source username'),
                  const SizedBox(height: 11),
                  TextFormField(
                    controller: _password,
                    obscureText: _hidePassword,
                    enabled: !_onAir && !_working,
                    decoration: InputDecoration(
                      labelText: 'Source password',
                      suffixIcon: IconButton(
                        onPressed: () => setState(() => _hidePassword = !_hidePassword),
                        icon: Icon(_hidePassword ? Icons.visibility : Icons.visibility_off),
                      ),
                    ),
                    validator: (value) => (value == null || value.isEmpty)
                        ? 'Enter your source password'
                        : null,
                  ),
                  const SizedBox(height: 15),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(15),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Audio bitrate', style: TextStyle(fontWeight: FontWeight.w700)),
                              Text('$_bitrate kbps', style: const TextStyle(color: Color(0xFFF2A33A), fontWeight: FontWeight.w900)),
                            ],
                          ),
                          Slider(
                            value: _bitrate.toDouble(),
                            min: 64,
                            max: 320,
                            divisions: 8,
                            onChanged: (_onAir || _working)
                                ? null
                                : (value) => setState(() => _bitrate = value.round()),
                          ),
                          const Text(
                            'AAC-LC · 44.1 kHz · Stereo',
                            style: TextStyle(color: Color(0xFF90A6AF), fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(17),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _sectionTitle('BROADCAST STATUS'),
                    const SizedBox(height: 10),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          _onAir ? Icons.radio_button_checked : _working ? Icons.sync : Icons.info_outline,
                          color: statusColor,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _statusMessage,
                            style: const TextStyle(height: 1.4, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: (_busy || _onAir || _working) ? null : _startBroadcast,
                        icon: _busy
                            ? const SizedBox(width: 17, height: 17, child: CircularProgressIndicator(strokeWidth: 2))
                            : const Icon(Icons.radio),
                        label: const Text('START BROADCAST'),
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFFF2A33A),
                          foregroundColor: const Color(0xFF101820),
                          padding: const EdgeInsets.symmetric(vertical: 16),
                        ),
                      ),
                    ),
                    const SizedBox(height: 9),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: (_busy || _service == null) ? null : _stopBroadcast,
                        icon: const Icon(Icons.stop_circle_outlined),
                        label: const Text('STOP BROADCAST'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFFFF8585),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 17),
            const _Notice(
              icon: Icons.info_outline,
              text: 'The 3.5 mm test uses the tablet's headset microphone contact when Android exposes it as an input. It is normally mono microphone-level audio, not true stereo line-in. Use a compatible CTIA TRRS adapter/cable with attenuation between the mixer output and headset-mic input; never connect a speaker/amp output directly. If Wired headset does not appear in the input list, this tablet/adapter is not exposing the socket as a recording input. True stereo line-in will require suitable external audio hardware later. This build sends one selected input at a time; multi-input mixing, SHOUTcast v1/v2, browser/app audio capture and Android playback capture are not implemented yet.',
            ),
            const SizedBox(height: 12),
            const _Notice(
              icon: Icons.phonelink_lock,
              text: 'Android uses a foreground notification while broadcasting. iOS background operation depends on Apple audio-session rules and must be verified on a real device. Neither platform allows unrestricted capture of every other app’s audio.',
            ),
            const SizedBox(height: 22),
            const Center(
              child: Text(
                'Free and open-source · Mobile development build',
                style: TextStyle(color: Color(0xFF718791), fontSize: 11),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(String title) => Text(
        title,
        style: const TextStyle(
          color: Color(0xFFF2A33A),
          fontSize: 10,
          fontWeight: FontWeight.w900,
          letterSpacing: 1.5,
        ),
      );

  Widget _field(
    TextEditingController controller,
    String label, {
    String? hint,
    TextInputType? keyboard,
  }) {
    return TextFormField(
      controller: controller,
      enabled: !_onAir && !_working,
      keyboardType: keyboard,
      decoration: InputDecoration(labelText: label, hintText: hint),
      validator: (value) {
        if (value == null || value.trim().isEmpty) return 'Required';
        if (label == 'Port') {
          final port = int.tryParse(value);
          if (port == null || port < 1 || port > 65535) return 'Invalid port';
        }
        if (label == 'Mount point' && !value.startsWith('/')) {
          return 'Must start with /';
        }
        return null;
      },
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
          color: const Color(0xFF172630),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF344B56)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: const Color(0xFFF2A33A), size: 18),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                text,
                style: const TextStyle(color: Color(0xFFAAC0C8), fontSize: 11, height: 1.45),
              ),
            ),
          ],
        ),
      );
}
