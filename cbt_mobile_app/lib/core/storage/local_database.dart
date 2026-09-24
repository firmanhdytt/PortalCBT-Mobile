import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class LocalDatabase {
  static Database? _database;

  static Future<Database> get instance async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  static Future<Database> _initDatabase() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, 'cbt_local.db');

    return await openDatabase(
      path,
      version: 2,
      onCreate: (db, version) async {
        // 1. Siswa
        await db.execute('''
          CREATE TABLE siswa (
            id INTEGER PRIMARY KEY,
            nis TEXT UNIQUE NOT NULL,
            nama TEXT NOT NULL,
            kelas_id INTEGER NOT NULL,
            nama_kelas TEXT NOT NULL
          )
        ''');

        // 2. Ujian
        await db.execute('''
          CREATE TABLE ujian (
            id INTEGER PRIMARY KEY,
            nama_ujian TEXT NOT NULL,
            durasi_menit INTEGER NOT NULL,
            token TEXT NOT NULL,
            status TEXT DEFAULT 'not_started',
            waktu_mulai TEXT,
            sisa_detik INTEGER,
            is_submitted INTEGER DEFAULT 0
          )
        ''');

        // 3. Soal
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

        // 4. Pilihan Jawaban
        await db.execute('''
          CREATE TABLE pilihan_jawaban (
            id INTEGER PRIMARY KEY,
            soal_id INTEGER NOT NULL,
            teks_pilihan TEXT NOT NULL,
            label TEXT NOT NULL
          )
        ''');

        // 5. Jawaban Peserta
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
            sync_status TEXT DEFAULT 'pending',
            retry_count INTEGER DEFAULT 0,
            checksum TEXT
          )
        ''');
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        if (oldVersion < 2) {
          // Add Phase 5 columns if upgrading from v1
          try {
            await db.execute('ALTER TABLE ujian ADD COLUMN waktu_mulai TEXT');
            await db.execute('ALTER TABLE ujian ADD COLUMN sisa_detik INTEGER');
            await db.execute('ALTER TABLE ujian ADD COLUMN is_submitted INTEGER DEFAULT 0');
          } catch (_) {}

          try {
            await db.execute('ALTER TABLE jawaban_peserta ADD COLUMN retry_count INTEGER DEFAULT 0');
            await db.execute('ALTER TABLE jawaban_peserta ADD COLUMN checksum TEXT');
          } catch (_) {}
        }
      },
    );
  }

  static Future<void> close() async {
    if (_database != null) {
      await _database!.close();
      _database = null;
    }
  }
}
