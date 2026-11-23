import 'package:flutter/material.dart';

void main() {
  runApp(const JRadioEncoderApp());
}

class JRadioEncoderApp extends StatelessWidget {
  const JRadioEncoderApp({super.key});

  @override
  Widget build(BuildContext context) {
    const background = Color(0xFF101820);
    const accent = Color(0xFFF2A33A);

    return MaterialApp(
      title: 'JRadio Universal Broadcast Encoder',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: background,
        colorScheme: ColorScheme.fromSeed(
          seedColor: accent,
          brightness: Brightness.dark,
          surface: const Color(0xFF192832),
        ),
        useMaterial3: true,
      ),
      home: const StudioHome(),
    );
  }
}

class StudioHome extends StatelessWidget {
  const StudioHome({super.key});

  static const sources = <({String title, String subtitle, IconData icon})>[
    (
      title: 'Microphone',
      subtitle: 'Permission and input setup not implemented',
      icon: Icons.mic_none,
    ),
    (
      title: 'Device audio',
      subtitle: 'Capture availability depends on Android and source app',
      icon: Icons.graphic_eq,
    ),
    (
      title: 'External input',
      subtitle: 'USB and Bluetooth routing not implemented',
      icon: Icons.usb,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 20,
        title: const Row(
          children: [
            CircleAvatar(
              backgroundColor: Color(0xFFF2A33A),
              foregroundColor: Color(0xFF101820),
              child: Text('JR', style: TextStyle(fontWeight: FontWeight.w900)),
            ),
            SizedBox(width: 12),
            Expanded(
              child: Text(
                'JRadio Encoder',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
        actions: const [
          Padding(
            padding: EdgeInsets.only(right: 16),
            child: Center(
              child: Chip(
                avatar: Icon(Icons.circle, size: 9, color: Color(0xFFE6A23C)),
                label: Text('OFF AIR'),
              ),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
          children: [
            const Text(
              'BROADCAST CONTROL ROOM',
              style: TextStyle(
                color: Color(0xFF90A6AF),
                fontSize: 10,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.8,
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Your sound.\nYour station.',
              style: TextStyle(
                fontSize: 34,
                height: 1.08,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Bring supported audio sources together and send one programme feed to your radio server.',
              style: TextStyle(color: Color(0xFFAAC0C8), height: 1.5),
            ),
            const SizedBox(height: 28),
            const Text(
              'AUDIO INPUTS',
              style: TextStyle(
                color: Color(0xFFF2A33A),
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.5,
              ),
            ),
            const SizedBox(height: 12),
            for (final source in sources)
              Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: ListTile(
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 8,
                  ),
                  leading: CircleAvatar(
                    backgroundColor: const Color(0xFF29414B),
                    child: Icon(source.icon, color: const Color(0xFFF2A33A)),
                  ),
                  title: Text(
                    source.title,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  subtitle: Text(source.subtitle),
                  trailing: const Text(
                    'IDLE',
                    style: TextStyle(
                      color: Color(0xFF90A6AF),
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'BROADCAST OUTPUT',
                      style: TextStyle(
                        color: Color(0xFF90A6AF),
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.5,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Streaming setup is not available yet.',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'The mobile interface is a foundation only. Audio capture, background service, encoder and server connection will be implemented and tested in later milestones.',
                      style: TextStyle(
                        color: Color(0xFFAAC0C8),
                        height: 1.45,
                      ),
                    ),
                    const SizedBox(height: 18),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: null,
                        icon: const Icon(Icons.radio),
                        label: const Text('START BROADCAST'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Center(
              child: Text(
                'Free and open-source · Development build',
                style: TextStyle(color: Color(0xFF718791), fontSize: 11),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
