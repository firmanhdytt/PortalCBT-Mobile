import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class DbHelper {
  static Database? _database;

  static Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  static Future<Database> _initDatabase() async {
    String path = join(await getDatabasesPath(), 'cbt_local.db');
    return await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE siswa (
            id INTEGER PRIMARY KEY,
            nis TEXT UNIQUE NOT NULL,
            nama TEXT NOT NULL,
            kelas_id INTEGER NOT NULL,
            nama_kelas TEXT NOT NULL
          )
        ''');

        await db.execute('''
          CREATE TABLE ujian (
            id INTEGER PRIMARY KEY,
            nama_ujian TEXT NOT NULL,
            durasi_menit INTEGER NOT NULL,
            token TEXT NOT NULL,
            status TEXT DEFAULT 'not_started'
          )
        ''');

        await db.execute('''
          CREATE TABLE soal (
            id INTEGER PRIMARY KEY,
            ujian_id INTEGER NOT NULL,
            jenis_soal TEXT NOT NULL,
            teks_soal TEXT NOT NULL,
            gambar_url TEXT,
            gambar_lokal TEXT,
            bobot REAL DEFAULT 1.0,
            nomor_urut INTEGER NOT NULL
          )
        ''');

        await db.execute('''
          CREATE TABLE pilihan_jawaban (
            id INTEGER PRIMARY KEY,
            soal_id INTEGER NOT NULL,
            teks_pilihan TEXT NOT NULL,
            label TEXT NOT NULL
          )
        ''');

        await db.execute('''
          CREATE TABLE jawaban_peserta (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            siswa_id INTEGER NOT NULL,
            ujian_id INTEGER NOT NULL,
            soal_id INTEGER NOT NULL,
            pilihan_jawaban_id INTEGER,
            teks_jawaban_essay TEXT,
            is_ragu INTEGER DEFAULT 0,
            waktu_dijawab TEXT NOT NULL,
            sync_status TEXT DEFAULT 'pending'
          )
        ''');
      },
    );
  }

  // Profil Siswa
  static Future<void> saveSiswa(Map<String, dynamic> data) async {
    final db = await database;
    await db.insert('siswa', {
      'id': data['id'],
      'nis': data['nis'],
      'nama': data['nama'],
      'kelas_id': data['kelas_id'],
      'nama_kelas': data['nama_kelas'],
    }, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  static Future<Map<String, dynamic>?> getSiswa() async {
    final db = await database;
    final res = await db.query('siswa', limit: 1);
    return res.isNotEmpty ? res.first : null;
  }

  static Future<void> clearAll() async {
    final db = await database;
    await db.delete('siswa');
    await db.delete('ujian');
    await db.delete('soal');
    await db.delete('pilihan_jawaban');
    await db.delete('jawaban_peserta');
  }

  // Ujian & Soal Caching
  static Future<void> saveUjian(Map<String, dynamic> u) async {
    final db = await database;
    await db.insert('ujian', {
      'id': u['id'],
      'nama_ujian': u['nama_ujian'],
      'durasi_menit': u['durasi_menit'],
      'token': u['token'],
      'status': 'ongoing',
    }, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  static Future<void> saveSoalList(List<dynamic> soalList, int ujianId) async {
    final db = await database;
    for (var s in soalList) {
      await db.insert('soal', {
        'id': s['id'],
        'ujian_id': ujianId,
        'jenis_soal': s['jenis_soal'],
        'teks_soal': s['teks_soal'],
        'gambar_url': s['gambar_url'] ?? '',
        'bobot': s['bobot'],
        'nomor_urut': s['nomor_urut'],
      }, conflictAlgorithm: ConflictAlgorithm.replace);

      if (s['pilihan'] != null) {
        for (var o in s['pilihan']) {
          await db.insert('pilihan_jawaban', {
            'id': o['id'],
            'soal_id': s['id'],
            'teks_pilihan': o['teks_pilihan'],
            'label': o['label'],
          }, conflictAlgorithm: ConflictAlgorithm.replace);
        }
      }
    }
  }

  static Future<List<Map<String, dynamic>>> getSoalList(int ujianId) async {
    final db = await database;
    final res = await db.query('soal', where: 'ujian_id = ?', whereArgs: [ujianId], orderBy: 'nomor_urut');
    
    List<Map<String, dynamic>> completeList = [];
    for (var s in res) {
      var map = Map<String, dynamic>.from(s);
      final opsi = await db.query('pilihan_jawaban', where: 'soal_id = ?', whereArgs: [s['id']]);
      map['pilihan'] = opsi;
      completeList.add(map);
    }
    return completeList;
  }

  // Jawaban Peserta
  static Future<void> saveJawabanLokal({
    required int siswaId,
    required int ujianId,
    required int soalId,
    int? pilihanId,
    String? essayText,
    bool isRagu = false,
  }) async {
    final db = await database;
    
    // Cek apakah data sudah ada
    final existing = await db.query('jawaban_peserta', 
      where: 'siswa_id = ? AND ujian_id = ? AND soal_id = ?',
      whereArgs: [siswaId, ujianId, soalId]
    );

    final fields = {
      'siswa_id': siswaId,
      'ujian_id': ujianId,
      'soal_id': soalId,
      'pilihan_jawaban_id': pilihanId,
      'teks_jawaban_essay': essayText ?? '',
      'is_ragu': isRagu ? 1 : 0,
      'waktu_dijawab': DateTime.now().toIso8601String(),
      'sync_status': 'pending',
    };

    if (existing.isNotEmpty) {
      await db.update('jawaban_peserta', fields, 
        where: 'id = ?', 
        whereArgs: [existing.first['id']]
      );
    } else {
      await db.insert('jawaban_peserta', fields);
    }
  }

  static Future<Map<String, dynamic>?> getJawabanSingle(int soalId) async {
    final db = await database;
    final res = await db.query('jawaban_peserta', where: 'soal_id = ?', whereArgs: [soalId], limit: 1);
    return res.isNotEmpty ? res.first : null;
  }

  static Future<List<Map<String, dynamic>>> getUnsyncedJawaban() async {
    final db = await database;
    return await db.query('jawaban_peserta', where: 'sync_status = ?', whereArgs: ['pending']);
  }

  static Future<void> markAsSynced(List<Map<String, dynamic>> items) async {
    final db = await database;
    for (var item in items) {
      final id = item['id'];
      final timestamp = item['waktu_dijawab'];
      if (id != null && timestamp != null) {
        await db.update(
          'jawaban_peserta',
          {'sync_status': 'synced'},
          where: 'id = ? AND waktu_dijawab = ?',
          whereArgs: [id, timestamp],
        );
      }
    }
  }

  static Future<Map<int, String>> getJawabanStatusMap(int ujianId) async {
    final db = await database;
    final list = await db.query('jawaban_peserta', where: 'ujian_id = ?', whereArgs: [ujianId]);
    Map<int, String> statusMap = {};
    for (var j in list) {
      int soalId = j['soal_id'] as int;
      int isRagu = (j['is_ragu'] ?? 0) as int;
      int? pilihanId = j['pilihan_jawaban_id'] as int?;
      String essay = (j['teks_jawaban_essay'] ?? '').toString().trim();

      if (isRagu == 1) {
        statusMap[soalId] = 'doubtful';
      } else if (pilihanId != null || essay.isNotEmpty) {
        statusMap[soalId] = 'answered';
      } else {
        statusMap[soalId] = 'unanswered';
      }
    }
    return statusMap;
  }
}
