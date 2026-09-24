import 'dart:convert';
import 'dart:typed_data';

/// Pure Dart AES-CTR (Counter Mode) & HMAC-SHA256 Encryption Service.
/// Provides offline local storage confidentiality and tamper resistance
/// without requiring external native dependencies or C-bindings.
class EncryptionService {
  static const String _defaultSalt = 'CBT_SECURE_OFFLINE_SALT_2026';

  /// Derives a 256-bit AES key from a passphrase and optional salt using SHA-256.
  static Uint8List deriveKey(String passphrase, [String salt = _defaultSalt]) {
    final input = utf8.encode('$passphrase:$salt');
    return sha256(Uint8List.fromList(input));
  }

  /// Encrypts plaintext using AES-128-CTR with dynamic 16-byte IV and HMAC integrity tag.
  /// Output format: "enc:v1:<base64(iv + ciphertext + hmac)>"
  static String encrypt(String plaintext, String secretKey) {
    if (plaintext.isEmpty) return '';

    final key = deriveKey(secretKey);
    final key128 = key.sublist(0, 16);
    final hmacKey = key.sublist(16, 32);

    // Generate pseudo-random IV based on timestamp and payload length
    final iv = _generateIv(plaintext.length);
    final plainBytes = Uint8List.fromList(utf8.encode(plaintext));

    final cipherBytes = _aesCtrCrypt(plainBytes, key128, iv);

    // Compute HMAC-SHA256 over (iv + cipherBytes)
    final toSign = Uint8List(iv.length + cipherBytes.length);
    toSign.setRange(0, iv.length, iv);
    toSign.setRange(iv.length, toSign.length, cipherBytes);
    final tag = hmacSha256(toSign, hmacKey);

    // Combined: [16 bytes IV] + [N bytes Ciphertext] + [32 bytes HMAC Tag]
    final combined = Uint8List(iv.length + cipherBytes.length + tag.length);
    combined.setRange(0, iv.length, iv);
    combined.setRange(iv.length, iv.length + cipherBytes.length, cipherBytes);
    combined.setRange(iv.length + cipherBytes.length, combined.length, tag);

    return 'enc:v1:${base64.encode(combined)}';
  }

  /// Decrypts ciphertext and verifies HMAC integrity.
  /// Throws FormatException if payload was tampered with or corrupted.
  static String decrypt(String encryptedText, String secretKey) {
    if (encryptedText.isEmpty) return '';
    if (!encryptedText.startsWith('enc:v1:')) {
      // If not encrypted or legacy plaintext, return as is
      return encryptedText;
    }

    final rawB64 = encryptedText.substring('enc:v1:'.length);
    final combined = base64.decode(rawB64);

    if (combined.length < 16 + 32) {
      throw const FormatException('Invalid ciphertext length');
    }

    final iv = combined.sublist(0, 16);
    final tag = combined.sublist(combined.length - 32);
    final cipherBytes = combined.sublist(16, combined.length - 32);

    final key = deriveKey(secretKey);
    final key128 = key.sublist(0, 16);
    final hmacKey = key.sublist(16, 32);

    // Verify HMAC-SHA256
    final toSign = Uint8List(iv.length + cipherBytes.length);
    toSign.setRange(0, iv.length, iv);
    toSign.setRange(iv.length, toSign.length, cipherBytes);
    final expectedTag = hmacSha256(toSign, hmacKey);

    if (!_constantTimeEquals(tag, expectedTag)) {
      throw const FormatException('Data integrity check failed: Tampered or invalid ciphertext!');
    }

    final decryptedBytes = _aesCtrCrypt(cipherBytes, key128, iv);
    return utf8.decode(decryptedBytes);
  }

  /// Generates a tamper-evident checksum for an offline student answer.
  static String computeAnswerChecksum({
    required int siswaId,
    required int ujianId,
    required int soalId,
    int? pilihanId,
    String? essay,
    required String timestamp,
    required String secretKey,
  }) {
    final payload = '$siswaId|$ujianId|$soalId|${pilihanId ?? 0}|${essay ?? ''}|$timestamp';
    final key = deriveKey(secretKey);
    final tag = hmacSha256(Uint8List.fromList(utf8.encode(payload)), key);
    return base64.encode(tag);
  }

  /// Verifies tamper-evident checksum of an answer.
  static bool verifyAnswerChecksum({
    required int siswaId,
    required int ujianId,
    required int soalId,
    int? pilihanId,
    String? essay,
    required String timestamp,
    required String checksum,
    required String secretKey,
  }) {
    final expected = computeAnswerChecksum(
      siswaId: siswaId,
      ujianId: ujianId,
      soalId: soalId,
      pilihanId: pilihanId,
      essay: essay,
      timestamp: timestamp,
      secretKey: secretKey,
    );
    return expected == checksum;
  }

  // ---------------------------------------------------------------------------
  // AES-CTR Core Implementation (Rijndael cipher with 128-bit key)
  // ---------------------------------------------------------------------------

  static Uint8List _generateIv(int seed) {
    final now = DateTime.now().microsecondsSinceEpoch;
    final iv = Uint8List(16);
    final byteData = ByteData.sublistView(iv);
    byteData.setInt64(0, now);
    byteData.setInt64(8, now ^ (seed * 31));
    return iv;
  }

  static Uint8List _aesCtrCrypt(Uint8List input, Uint8List key128, Uint8List iv) {
    final w = _aesKeyExpansion(key128);
    final output = Uint8List(input.length);
    final counter = Uint8List.fromList(iv);
    final block = Uint8List(16);

    for (int i = 0; i < input.length; i += 16) {
      _aesEncryptBlock(counter, block, w);

      final chunkLen = (i + 16 <= input.length) ? 16 : input.length - i;
      for (int j = 0; j < chunkLen; j++) {
        output[i + j] = input[i + j] ^ block[j];
      }

      // Increment 128-bit big-endian counter
      for (int k = 15; k >= 0; k--) {
        counter[k]++;
        if (counter[k] != 0) break;
      }
    }
    return output;
  }

  static final Uint8List _sbox = Uint8List.fromList([
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5e, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
  ]);

  static final Uint32List _rcon = Uint32List.fromList([
    0x00000000, 0x01000000, 0x02000000, 0x04000000, 0x08000000,
    0x10000000, 0x20000000, 0x40000000, 0x80000000, 0x1B000000, 0x36000000
  ]);

  static Uint32List _aesKeyExpansion(Uint8List key) {
    const int nk = 4;
    const int nr = 10;
    final w = Uint32List(4 * (nr + 1));

    for (int i = 0; i < nk; i++) {
      w[i] = (key[4 * i] << 24) |
          (key[4 * i + 1] << 16) |
          (key[4 * i + 2] << 8) |
          key[4 * i + 3];
    }

    for (int i = nk; i < 4 * (nr + 1); i++) {
      int temp = w[i - 1];
      if (i % nk == 0) {
        // RotWord & SubWord & Rcon
        final rot = ((temp << 8) & 0xFFFFFF00) | ((temp >> 24) & 0xFF);
        final sub = (_sbox[(rot >> 24) & 0xFF] << 24) |
            (_sbox[(rot >> 16) & 0xFF] << 16) |
            (_sbox[(rot >> 8) & 0xFF] << 8) |
            _sbox[rot & 0xFF];
        temp = sub ^ _rcon[i ~/ nk];
      }
      w[i] = w[i - nk] ^ temp;
    }
    return w;
  }

  static void _aesEncryptBlock(Uint8List input, Uint8List output, Uint32List w) {
    final state = Uint8List(16);
    state.setRange(0, 16, input);

    // AddRoundKey 0
    _addRoundKey(state, w, 0);

    for (int round = 1; round < 10; round++) {
      _subBytes(state);
      _shiftRows(state);
      _mixColumns(state);
      _addRoundKey(state, w, round);
    }

    _subBytes(state);
    _shiftRows(state);
    _addRoundKey(state, w, 10);

    output.setRange(0, 16, state);
  }

  static void _addRoundKey(Uint8List state, Uint32List w, int round) {
    for (int c = 0; c < 4; c++) {
      final word = w[round * 4 + c];
      state[c * 4] ^= (word >> 24) & 0xFF;
      state[c * 4 + 1] ^= (word >> 16) & 0xFF;
      state[c * 4 + 2] ^= (word >> 8) & 0xFF;
      state[c * 4 + 3] ^= word & 0xFF;
    }
  }

  static void _subBytes(Uint8List state) {
    for (int i = 0; i < 16; i++) {
      state[i] = _sbox[state[i]];
    }
  }

  static void _shiftRows(Uint8List s) {
    int t;
    // Row 1: shift left 1
    t = s[1]; s[1] = s[5]; s[5] = s[9]; s[9] = s[13]; s[13] = t;
    // Row 2: shift left 2
    t = s[2]; s[2] = s[10]; s[10] = t;
    t = s[6]; s[6] = s[14]; s[14] = t;
    // Row 3: shift left 3 (shift right 1)
    t = s[15]; s[15] = s[11]; s[11] = s[7]; s[7] = s[3]; s[3] = t;
  }

  static int _xtime(int b) => ((b << 1) ^ (((b >> 7) & 1) * 0x1B)) & 0xFF;

  static void _mixColumns(Uint8List s) {
    for (int c = 0; c < 4; c++) {
      final i = c * 4;
      final a0 = s[i], a1 = s[i + 1], a2 = s[i + 2], a3 = s[i + 3];
      final t = a0 ^ a1 ^ a2 ^ a3;
      s[i] = a0 ^ _xtime(a0 ^ a1) ^ t;
      s[i + 1] = a1 ^ _xtime(a1 ^ a2) ^ t;
      s[i + 2] = a2 ^ _xtime(a2 ^ a3) ^ t;
      s[i + 3] = a3 ^ _xtime(a3 ^ a0) ^ t;
    }
  }

  // ---------------------------------------------------------------------------
  // SHA-256 & HMAC-SHA256 Implementation (FIPS 180-4 standard)
  // ---------------------------------------------------------------------------

  static Uint8List sha256(Uint8List data) {
    final k = Uint32List.fromList([
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ]);

    int h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    int h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

    final bitLen = data.length * 8;
    final padLen = (data.length % 64 < 56) ? (56 - data.length % 64) : (120 - data.length % 64);
    final padded = Uint8List(data.length + padLen + 8);
    padded.setRange(0, data.length, data);
    padded[data.length] = 0x80;

    final bd = ByteData.sublistView(padded);
    bd.setUint64(padded.length - 8, bitLen, Endian.big);

    final w = Uint32List(64);

    for (int i = 0; i < padded.length; i += 64) {
      for (int t = 0; t < 16; t++) {
        w[t] = bd.getUint32(i + t * 4, Endian.big);
      }
      for (int t = 16; t < 64; t++) {
        final s0 = _rotr32(w[t - 15], 7) ^ _rotr32(w[t - 15], 18) ^ (w[t - 15] >> 3);
        final s1 = _rotr32(w[t - 2], 17) ^ _rotr32(w[t - 2], 19) ^ (w[t - 2] >> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) & 0xFFFFFFFF;
      }

      int a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

      for (int t = 0; t < 64; t++) {
        final s1 = _rotr32(e, 6) ^ _rotr32(e, 11) ^ _rotr32(e, 25);
        final ch = (e & f) ^ (~e & g);
        final t1 = (h + s1 + ch + k[t] + w[t]) & 0xFFFFFFFF;
        final s0 = _rotr32(a, 2) ^ _rotr32(a, 13) ^ _rotr32(a, 22);
        final maj = (a & b) ^ (a & c) ^ (b & c);
        final t2 = (s0 + maj) & 0xFFFFFFFF;

        h = g; g = f; f = e; e = (d + t1) & 0xFFFFFFFF;
        d = c; c = b; b = a; a = (t1 + t2) & 0xFFFFFFFF;
      }

      h0 = (h0 + a) & 0xFFFFFFFF;
      h1 = (h1 + b) & 0xFFFFFFFF;
      h2 = (h2 + c) & 0xFFFFFFFF;
      h3 = (h3 + d) & 0xFFFFFFFF;
      h4 = (h4 + e) & 0xFFFFFFFF;
      h5 = (h5 + f) & 0xFFFFFFFF;
      h6 = (h6 + g) & 0xFFFFFFFF;
      h7 = (h7 + h) & 0xFFFFFFFF;
    }

    final out = Uint8List(32);
    final outBd = ByteData.sublistView(out);
    outBd.setUint32(0, h0, Endian.big);
    outBd.setUint32(4, h1, Endian.big);
    outBd.setUint32(8, h2, Endian.big);
    outBd.setUint32(12, h3, Endian.big);
    outBd.setUint32(16, h4, Endian.big);
    outBd.setUint32(20, h5, Endian.big);
    outBd.setUint32(24, h6, Endian.big);
    outBd.setUint32(28, h7, Endian.big);
    return out;
  }

  static Uint8List hmacSha256(Uint8List data, Uint8List key) {
    Uint8List k = key;
    if (k.length > 64) {
      k = sha256(k);
    }
    final kPad = Uint8List(64);
    kPad.setRange(0, k.length, k);

    final iPad = Uint8List(64);
    final oPad = Uint8List(64);
    for (int i = 0; i < 64; i++) {
      iPad[i] = kPad[i] ^ 0x36;
      oPad[i] = kPad[i] ^ 0x5c;
    }

    final inner = Uint8List(64 + data.length);
    inner.setRange(0, 64, iPad);
    inner.setRange(64, inner.length, data);
    final innerHash = sha256(inner);

    final outer = Uint8List(64 + 32);
    outer.setRange(0, 64, oPad);
    outer.setRange(64, outer.length, innerHash);
    return sha256(outer);
  }

  static int _rotr32(int x, int n) => ((x >> n) | (x << (32 - n))) & 0xFFFFFFFF;

  static bool _constantTimeEquals(Uint8List a, Uint8List b) {
    if (a.length != b.length) return false;
    int diff = 0;
    for (int i = 0; i < a.length; i++) {
      diff |= a[i] ^ b[i];
    }
    return diff == 0;
  }
}
