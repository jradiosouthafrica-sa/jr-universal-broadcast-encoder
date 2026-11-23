import 'package:flutter_test/flutter_test.dart';
import 'package:jr_universal_broadcast_encoder/broadcast_service.dart';

void main() {
  group('MobileIcecastProfile validation', () {
    test('accepts a valid Icecast source profile', () {
      const profile = MobileIcecastProfile(
        host: 'radio.example.com',
        port: 8000,
        mountPoint: '/live',
        username: 'source',
        password: 'test-password',
        bitrateKbps: 128,
      );

      expect(profile.validate(), isNull);
    });

    test('requires a slash-prefixed mount point', () {
      const profile = MobileIcecastProfile(
        host: 'radio.example.com',
        port: 8000,
        mountPoint: 'live',
        username: 'source',
        password: 'test-password',
      );

      expect(profile.validate(), contains('Mount point'));
    });

    test('rejects an invalid port', () {
      const profile = MobileIcecastProfile(
        host: 'radio.example.com',
        port: 70000,
        mountPoint: '/live',
        username: 'source',
        password: 'test-password',
      );

      expect(profile.validate(), contains('Port'));
    });

    test('requires a source password', () {
      const profile = MobileIcecastProfile(
        host: 'radio.example.com',
        port: 8000,
        mountPoint: '/live',
        username: 'source',
        password: '',
      );

      expect(profile.validate(), contains('password'));
    });
  });
}
