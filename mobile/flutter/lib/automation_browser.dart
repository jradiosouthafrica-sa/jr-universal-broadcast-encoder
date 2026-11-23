import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// An in-app browser for operating web-based radio automation systems.
///
/// This screen intentionally keeps the automation website inside the encoder.
/// Audio routing from WebView playback into the broadcast encoder is a separate
/// native audio milestone and must not be implied by the browser being visible.
class AutomationBrowserPage extends StatefulWidget {
  const AutomationBrowserPage({
    super.key,
    required this.onStartBroadcast,
    required this.onStopBroadcast,
  });

  final Future<bool> Function() onStartBroadcast;
  final Future<void> Function() onStopBroadcast;

  @override
  State<AutomationBrowserPage> createState() => _AutomationBrowserPageState();
}

class _AutomationBrowserPageState extends State<AutomationBrowserPage> {
  final TextEditingController _addressController = TextEditingController();
  late final WebViewController _webController;
  bool _loading = false;
  bool _broadcastRequestStarted = false;
  bool _broadcastBusy = false;
  String? _error;
  String _currentAddress = '';

  static const List<String> _quickStarts = [
    'https://www.azuracast.com/',
  ];

  @override
  void initState() {
    super.initState();
    _webController = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF101820))
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (url) {
            if (!mounted) return;
            setState(() {
              _loading = true;
              _error = null;
              _currentAddress = url;
              _addressController.text = url;
            });
          },
          onPageFinished: (url) {
            if (!mounted) return;
            setState(() {
              _loading = false;
              _currentAddress = url;
              _addressController.text = url;
            });
          },
          onWebResourceError: (error) {
            if (!mounted || error.isForMainFrame == false) return;
            setState(() {
              _loading = false;
              _error = error.description;
            });
          },
        ),
      );
  }

  @override
  void dispose() {
    _addressController.dispose();
    super.dispose();
  }

  Uri? _normaliseAddress(String raw) {
    final value = raw.trim();
    if (value.isEmpty) return null;
    final candidate = value.contains('://') ? value : 'https://$value';
    final uri = Uri.tryParse(candidate);
    if (uri == null ||
        !uri.hasAuthority ||
        uri.host.isEmpty ||
        !const {'http', 'https'}.contains(uri.scheme)) {
      return null;
    }
    return uri;
  }

  Future<void> _startBroadcastFromBrowser() async {
    if (_broadcastBusy || _broadcastRequestStarted) return;
    setState(() => _broadcastBusy = true);
    final started = await widget.onStartBroadcast();
    if (!mounted) return;
    setState(() {
      _broadcastBusy = false;
      _broadcastRequestStarted = started;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(started
            ? 'Broadcast started. Keep the automation playing in this browser.'
            : 'Broadcast did not start. Return to the encoder settings and check the error.'),
      ),
    );
  }

  Future<void> _stopBroadcastFromBrowser() async {
    if (_broadcastBusy) return;
    setState(() => _broadcastBusy = true);
    await widget.onStopBroadcast();
    if (!mounted) return;
    setState(() {
      _broadcastBusy = false;
      _broadcastRequestStarted = false;
    });
  }

  Future<void> _openAddress([String? address]) async {
    final uri = _normaliseAddress(address ?? _addressController.text);
    if (uri == null) {
      setState(() => _error = 'Enter a valid website address beginning with https:// or http://.');
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _loading = true;
      _error = null;
    });
    await _webController.loadRequest(uri);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Radio Automation'),
        actions: [
          IconButton(
            tooltip: 'Back',
            onPressed: () => _webController.goBack(),
            icon: const Icon(Icons.arrow_back),
          ),
          IconButton(
            tooltip: 'Forward',
            onPressed: () => _webController.goForward(),
            icon: const Icon(Icons.arrow_forward),
          ),
          IconButton(
            tooltip: 'Reload',
            onPressed: () => _webController.reload(),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _addressController,
                    keyboardType: TextInputType.url,
                    textInputAction: TextInputAction.go,
                    onSubmitted: _openAddress,
                    decoration: const InputDecoration(
                      hintText: 'Enter radio automation website',
                      prefixIcon: Icon(Icons.language),
                      isDense: true,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  tooltip: 'Open website',
                  onPressed: _openAddress,
                  icon: const Icon(Icons.open_in_browser),
                ),
              ],
            ),
          ),
          if (_loading) const LinearProgressIndicator(minHeight: 2),
          if (_error != null)
            MaterialBanner(
              content: Text('Website could not be loaded: $_error'),
              leading: const Icon(Icons.warning_amber),
              actions: [
                TextButton(
                  onPressed: () => _openAddress(_currentAddress),
                  child: const Text('RETRY'),
                ),
                TextButton(
                  onPressed: () => setState(() => _error = null),
                  child: const Text('DISMISS'),
                ),
              ],
            ),
          Expanded(
            child: _currentAddress.isEmpty
                ? _WelcomePanel(onOpen: _openAddress)
                : WebViewWidget(controller: _webController),
          ),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(12, 9, 12, 10),
            color: const Color(0xFF192832),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    _broadcastRequestStarted
                        ? 'BROADCAST REQUESTED — KEEP PROGRAMME PLAYING'
                        : 'AUTOMATION BROWSER',
                    style: const TextStyle(
                      color: Color(0xFF90A6AF),
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: .7,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: _broadcastBusy
                      ? null
                      : _broadcastRequestStarted
                          ? _stopBroadcastFromBrowser
                          : _startBroadcastFromBrowser,
                  child: _broadcastBusy
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(_broadcastRequestStarted ? 'STOP' : 'GO LIVE'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _WelcomePanel extends StatelessWidget {
  const _WelcomePanel({required this.onOpen});

  final ValueChanged<String> onOpen;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircleAvatar(
              radius: 38,
              backgroundColor: Color(0xFF29414B),
              child: Icon(Icons.radio, size: 38, color: Color(0xFFF2A33A)),
            ),
            const SizedBox(height: 18),
            const Text(
              'Open your radio automation',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 8),
            const Text(
              'Enter the address of a web-based radio automation system. It will open here inside JRadio Universal Broadcast Encoder.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xFFAAC0C8), height: 1.45),
            ),
            const SizedBox(height: 20),
            ..._AutomationBrowserPageState._quickStarts.map(
              (url) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: OutlinedButton.icon(
                  onPressed: () => onOpen(url),
                  icon: const Icon(Icons.public),
                  label: const Text('Open AzuraCast website'),
                ),
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Sign in to your own automation service after it opens. Do not save station passwords on shared devices.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xFF82949C), fontSize: 11, height: 1.4),
            ),
          ],
        ),
      ),
    );
  }
}
