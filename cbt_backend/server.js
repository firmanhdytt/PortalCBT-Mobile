const express = require('express');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 1. API AUTENTIKASI
// ==========================================
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username dan Password wajib diisi!' });
  }

  const user = db.query('users', u => u.username === username && u.password === password)[0];
  if (!user) {
    return res.status(401).json({ message: 'Username atau Password salah!' });
  }

  // Cari profil berdasarkan role
  let profil = null;
  if (user.role === 'siswa') {
    profil = db.query('siswa', s => s.user_id === user.id)[0];
  } else if (user.role === 'guru') {
    profil = db.query('guru', g => g.user_id === user.id)[0];
  }

  res.json({
    user: { id: user.id, username: user.username, role: user.role },
    profil: profil
  });
});

// ==========================================
// 2. API KHUSUS SISWA (MOBILE & SIMULATOR)
// ==========================================

function getUjianStatusAndStats(u) {
  const totalSiswa = db.query('siswa', s => s.kelas_id === u.kelas_id).length;
  const selesaiSiswa = db.query('hasil_ujian', h => h.ujian_id === u.id).length;
  
  let isAktif = u.is_aktif;
  const sudahSelesaiWaktu = u.waktu_selesai ? (new Date() > new Date(u.waktu_selesai)) : false;
  const semuaSiswaSelesai = totalSiswa > 0 && selesaiSiswa >= totalSiswa;
  
  if (isAktif && (sudahSelesaiWaktu || semuaSiswaSelesai)) {
    db.update('ujian', u.id, { is_aktif: false });
    isAktif = false;
  }
  
  return {
    is_aktif: isAktif,
    total_siswa: totalSiswa,
    selesai_siswa: selesaiSiswa
  };
}

// Mendapatkan daftar ujian aktif siswa berdasarkan kelas_id (filter yang belum dikerjakan)
app.get('/api/siswa/ujian/:kelasId', (req, res) => {
  const kelasId = parseInt(req.params.kelasId);
  const siswaId = parseInt(req.query.siswa_id);
  
  // Dapatkan seluruh ujian untuk kelas ini
  let ujianList = db.query('ujian', u => u.kelas_id === kelasId);
  
  // Periksa & update status keaktifan otomatis
  ujianList = ujianList.map(u => {
    const stats = getUjianStatusAndStats(u);
    return { ...u, is_aktif: stats.is_aktif };
  });

  // Filter hanya yang masih aktif
  let activeUjian = ujianList.filter(u => u.is_aktif);
  
  if (!isNaN(siswaId)) {
    activeUjian = activeUjian.filter(u => {
      const sudahSelesai = db.query('hasil_ujian', h => h.siswa_id === siswaId && h.ujian_id === u.id).length > 0;
      return !sudahSelesai;
    });
  }
  
  res.json(activeUjian);
});

// Memverifikasi token ujian untuk masuk ruangan ujian
app.post('/api/siswa/ujian/verifikasi-token', (req, res) => {
  const { ujian_id, token } = req.body;
  const ujian = db.getById('ujian', ujian_id);
  if (!ujian) {
    return res.status(404).json({ message: 'Sesi ujian tidak ditemukan!' });
  }
  const cleanInputToken = token ? token.toString().trim().toUpperCase() : '';
  const cleanUjianToken = ujian.token ? ujian.token.toString().trim().toUpperCase() : '';
  if (cleanUjianToken !== cleanInputToken) {
    return res.status(400).json({ message: 'Token ujian salah!' });
  }
  res.json({ message: 'Token valid! Anda diizinkan masuk.', ujian });
});

// Mendapatkan daftar soal + pilihan jawaban berdasarkan ujian_id (Soal Diacak)
app.get('/api/siswa/ujian/soal/:ujianId', (req, res) => {
  const ujianId = parseInt(req.params.ujianId);
  const ujian = db.getById('ujian', ujianId);
  if (!ujian) {
    return res.status(404).json({ message: 'Sesi ujian tidak ditemukan!' });
  }

  // Dapatkan soal dari bank soal yang dikaitkan
  const soalList = db.query('soal', s => s.bank_soal_id === ujian.bank_soal_id);
  
  // Dapatkan pilihan jawaban untuk masing-masing soal
  const responseList = soalList.map(s => {
    const opsi = db.query('pilihan_jawaban', o => o.soal_id === s.id);
    return {
      id: s.id,
      jenis_soal: s.jenis_soal,
      teks_soal: s.teks_soal,
      gambar_url: s.gambar_url,
      bobot: s.bobot,
      pilihan: opsi.map(o => ({ id: o.id, label: o.label, teks_pilihan: o.teks_pilihan }))
    };
  });

  // Acak urutan soal
  const shuffled = responseList.sort(() => Math.random() - 0.5);
  
  // Berikan nomor urut baru setelah diacak
  const randomizedList = shuffled.map((s, idx) => ({
    ...s,
    nomor_urut: idx + 1
  }));

  res.json(randomizedList);
});

// Menyinkronkan/menyimpan lembar jawaban secara real-time (auto-save)
app.post('/api/siswa/ujian/sync', (req, res) => {
  const { siswa_id, ujian_id, jawaban_list } = req.body;
  if (!siswa_id || !ujian_id || !Array.isArray(jawaban_list)) {
    return res.status(400).json({ message: 'Data kiriman tidak lengkap!' });
  }

  jawaban_list.forEach(j => {
    // Cek apakah jawaban untuk soal ini sudah pernah disimpan
    const existing = db.query('jawaban_peserta', jp => 
      jp.siswa_id === parseInt(siswa_id) && 
      jp.ujian_id === parseInt(ujian_id) && 
      jp.soal_id === parseInt(j.soal_id)
    )[0];

    const fields = {
      siswa_id: parseInt(siswa_id),
      ujian_id: parseInt(ujian_id),
      soal_id: parseInt(j.soal_id),
      pilihan_jawaban_id: j.pilihan_jawaban_id ? parseInt(j.pilihan_jawaban_id) : null,
      teks_jawaban_essay: j.teks_jawaban_essay || '',
      is_ragu: j.is_ragu ? 1 : 0,
      waktu_dijawab: new Date().toISOString()
    };

    if (existing) {
      db.update('jawaban_peserta', existing.id, fields);
    } else {
      db.insert('jawaban_peserta', fields);
    }
  });

  res.json({ message: 'Jawaban disinkronkan ke server!' });
});

// Siswa menekan Selesai Ujian -> Kalkulasi otomatis PG & Essay jika ada
app.post('/api/siswa/ujian/submit', (req, res) => {
  const { siswa_id, ujian_id } = req.body;
  
  const ujian = db.getById('ujian', ujian_id);
  if (!ujian) {
    return res.status(404).json({ message: 'Sesi ujian tidak ditemukan!' });
  }

  // Ambil semua jawaban siswa untuk ujian ini
  const jawabanSiswa = db.query('jawaban_peserta', jp => 
    jp.siswa_id === parseInt(siswa_id) && jp.ujian_id === parseInt(ujian_id)
  );

  // Ambil data soal
  const soalList = db.query('soal', s => s.bank_soal_id === ujian.bank_soal_id);

  let benar = 0;
  let salah = 0;
  let nilaiPG = 0;
  let totalNilai = 0;

  soalList.forEach(s => {
    if (s.jenis_soal === 'PG') {
      const jawaban = jawabanSiswa.find(j => j.soal_id === s.id);
      if (jawaban && jawaban.pilihan_jawaban_id) {
        const kunci = db.query('pilihan_jawaban', o => o.soal_id === s.id && o.is_kunci)[0];
        if (kunci && kunci.id === jawaban.pilihan_jawaban_id) {
          benar++;
          nilaiPG += s.bobot;
        } else {
          salah++;
        }
      } else {
        salah++; // Tidak dijawab
      }
    }
  });

  totalNilai = nilaiPG;
  // Pertahankan nilai essay yang telah dinilai guru jika ada
  soalList.forEach(s => {
    if (s.jenis_soal === 'ESSAY') {
      const j = jawabanSiswa.find(jw => jw.soal_id === s.id);
      if (j && j.nilai_manual) {
        totalNilai += parseFloat(j.nilai_manual || 0);
      }
    }
  });

  // Cek apakah hasil sudah ada, jika ada ditimpa
  const existingHasil = db.query('hasil_ujian', h => 
    h.siswa_id === parseInt(siswa_id) && h.ujian_id === parseInt(ujian_id)
  )[0];

  const hasilFields = {
    siswa_id: parseInt(siswa_id),
    ujian_id: parseInt(ujian_id),
    jumlah_benar: benar,
    jumlah_salah: salah,
    nilai_akhir: totalNilai,
    waktu_selesai: new Date().toISOString()
  };

  if (existingHasil) {
    db.update('hasil_ujian', existingHasil.id, hasilFields);
  } else {
    db.insert('hasil_ujian', hasilFields);
  }

  res.json({ message: 'Ujian berhasil disimpan! Nilai PG otomatis dihitung.', hasil: hasilFields });
});

// Mendapatkan riwayat hasil ujian siswa
app.get('/api/siswa/hasil/:siswaId', (req, res) => {
  const siswaId = parseInt(req.params.siswaId);
  const hasil = db.query('hasil_ujian', h => h.siswa_id === siswaId);
  
  const hasilDetailed = hasil.map(h => {
    const ujian = db.getById('ujian', h.ujian_id);
    return {
      ...h,
      nama_ujian: ujian ? ujian.nama_ujian : 'Ujian Terhapus'
    };
  });
  
  res.json(hasilDetailed);
});

// ==========================================
// 3. API KHUSUS GURU & ADMIN (MANAJEMEN & MONITORING)
// ==========================================

// BANK SOAL CRUD
app.get('/api/guru/bank-soal', (req, res) => {
  res.json(db.getAll('bank_soal'));
});

app.post('/api/guru/bank-soal', (req, res) => {
  const { judul, mapel_id, guru_id } = req.body;
  const newBank = db.insert('bank_soal', {
    mapel_id: parseInt(mapel_id || 1),
    guru_id: parseInt(guru_id || 1),
    judul
  });
  res.json({ message: 'Bank soal berhasil dibuat!', data: newBank });
});

// SOAL CRUD
app.get('/api/guru/soal/:bankSoalId', (req, res) => {
  const bankSoalId = parseInt(req.params.bankSoalId);
  const soalList = db.query('soal', s => s.bank_soal_id === bankSoalId);
  
  const soalDetailed = soalList.map(s => {
    const opsi = db.query('pilihan_jawaban', o => o.soal_id === s.id);
    return { ...s, pilihan: opsi };
  });
  res.json(soalDetailed);
});

app.post('/api/guru/soal', (req, res) => {
  const { bank_soal_id, jenis_soal, teks_soal, bobot, opsi_list } = req.body;
  
  const recordSoal = db.insert('soal', {
    bank_soal_id: parseInt(bank_soal_id),
    jenis_soal,
    teks_soal,
    gambar_url: '',
    bobot: parseFloat(bobot || 1.0),
    nomor_urut: db.query('soal', s => s.bank_soal_id === parseInt(bank_soal_id)).length + 1
  });

  if (jenis_soal === 'PG' && Array.isArray(opsi_list)) {
    opsi_list.forEach(o => {
      db.insert('pilihan_jawaban', {
        soal_id: recordSoal.id,
        teks_pilihan: o.teks_pilihan,
        label: o.label,
        is_kunci: o.is_kunci === true
      });
    });
  }

  res.json({ message: 'Soal berhasil ditambahkan!', data: recordSoal });
});

app.delete('/api/guru/soal/:id', (req, res) => {
  const id = parseInt(req.params.id);
  db.delete('soal', id);
  // Hapus opsi yang berhubungan
  const opsi = db.query('pilihan_jawaban', o => o.soal_id === id);
  opsi.forEach(o => db.delete('pilihan_jawaban', o.id));
  res.json({ message: 'Soal berhasil dihapus!' });
});

app.get('/api/guru/soal/detail/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const soal = db.getById('soal', id);
  if (soal) {
    const opsi = db.query('pilihan_jawaban', o => o.soal_id === id);
    res.json({ ...soal, pilihan: opsi });
  } else {
    res.status(404).json({ message: 'Soal tidak ditemukan!' });
  }
});

app.put('/api/guru/soal/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { jenis_soal, teks_soal, bobot, opsi_list } = req.body;
  
  const updatedSoal = db.update('soal', id, {
    jenis_soal,
    teks_soal,
    bobot: parseFloat(bobot || 1.0)
  });

  if (!updatedSoal) {
    return res.status(404).json({ message: 'Soal tidak ditemukan!' });
  }

  // Hapus opsi lama
  const oldOpsi = db.query('pilihan_jawaban', o => o.soal_id === id);
  oldOpsi.forEach(o => db.delete('pilihan_jawaban', o.id));

  // Simpan opsi baru jika PG
  if (jenis_soal === 'PG' && Array.isArray(opsi_list)) {
    opsi_list.forEach(o => {
      db.insert('pilihan_jawaban', {
        soal_id: id,
        teks_pilihan: o.teks_pilihan,
        label: o.label,
        is_kunci: o.is_kunci === true
      });
    });
  }

  res.json({ message: 'Soal berhasil diperbarui!', data: updatedSoal });
});

// UJIAN & JADWAL CRUD
app.get('/api/guru/ujian', (req, res) => {
  const ujianList = db.getAll('ujian');
  const details = ujianList.map(u => {
    const kelas = db.getById('kelas', u.kelas_id);
    const bank = db.getById('bank_soal', u.bank_soal_id);
    const stats = getUjianStatusAndStats(u);
    return {
      ...u,
      is_aktif: stats.is_aktif,
      total_siswa: stats.total_siswa,
      selesai_siswa: stats.selesai_siswa,
      nama_kelas: kelas ? kelas.nama_kelas : 'Semua Kelas',
      judul_bank_soal: bank ? bank.judul : 'Belum Dipilih'
    };
  });
  res.json(details);
});

app.post('/api/guru/ujian', (req, res) => {
  const { nama_ujian, bank_soal_id, kelas_id, token, durasi_menit } = req.body;
  const newUjian = db.insert('ujian', {
    nama_ujian,
    bank_soal_id: parseInt(bank_soal_id),
    kelas_id: parseInt(kelas_id),
    token: token || Math.random().toString(36).substring(2, 8).toUpperCase(),
    durasi_menit: parseInt(durasi_menit || 60),
    waktu_mulai: new Date().toISOString(),
    waktu_selesai: new Date(Date.now() + 24*60*60*1000).toISOString(),
    is_aktif: true
  });
  res.json({ message: 'Jadwal ujian berhasil dibuat!', data: newUjian });
});

app.post('/api/guru/ujian/toggle/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const ujian = db.getById('ujian', id);
  if (ujian) {
    const updated = db.update('ujian', id, { is_aktif: !ujian.is_aktif });
    res.json({ message: 'Status ujian berhasil diubah!', data: updated });
  } else {
    res.status(404).json({ message: 'Ujian tidak ditemukan!' });
  }
});

app.delete('/api/guru/ujian/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const ujian = db.getById('ujian', id);
  if (ujian) {
    db.delete('ujian', id);
    res.json({ message: 'Ujian berhasil dihapus!' });
  } else {
    res.status(404).json({ message: 'Ujian tidak ditemukan!' });
  }
});

// MONITORING REAL-TIME
app.get('/api/guru/monitoring/:ujianId', (req, res) => {
  const ujianId = parseInt(req.params.ujianId);
  const ujian = db.getById('ujian', ujianId);
  if (!ujian) return res.status(404).json({ message: 'Ujian tidak ditemukan!' });

  const totalSoal = db.query('soal', s => s.bank_soal_id === ujian.bank_soal_id).length;
  
  // Ambil seluruh siswa di kelas target ujian
  const daftarSiswa = db.query('siswa', s => s.kelas_id === ujian.kelas_id);
  
  const monitoringData = daftarSiswa.map(s => {
    // Hitung soal yang sudah dijawab di database
    const jawaban = db.query('jawaban_peserta', jp => 
      jp.siswa_id === s.id && jp.ujian_id === ujianId
    );
    
    // Cek apakah siswa sudah mengumpulkan lembar jawaban
    const hasil = db.query('hasil_ujian', h => 
      h.siswa_id === s.id && h.ujian_id === ujianId
    )[0];

    let status = 'Belum Mulai';
    if (hasil) {
      status = 'Selesai';
    } else if (jawaban.length > 0) {
      status = 'Sedang Mengerjakan';
    }

    return {
      id: s.id,
      nis: s.nis,
      nama: s.nama,
      soal_terjawab: jawaban.length,
      total_soal: totalSoal,
      status: status,
      waktu_update: jawaban.length > 0 ? jawaban[jawaban.length - 1].waktu_dijawab : '-'
    };
  });

  res.json({
    nama_ujian: ujian.nama_ujian,
    token: ujian.token,
    siswa: monitoringData
  });
});

// PENILAIAN ESSAY MANUAL OLEH GURU
app.get('/api/guru/nilai-essay/list/:ujianId', (req, res) => {
  const ujianId = parseInt(req.params.ujianId);
  
  // Cari semua jawaban bertipe essay
  const jawabanSiswa = db.query('jawaban_peserta', jp => jp.ujian_id === ujianId);
  const detailedEssay = [];

  jawabanSiswa.forEach(j => {
    const soal = db.getById('soal', j.soal_id);
    if (soal && soal.jenis_soal === 'ESSAY') {
      const siswa = db.getById('siswa', j.siswa_id);
      detailedEssay.push({
        jawaban_id: j.id,
        siswa_nama: siswa ? siswa.nama : 'Siswa Hilang',
        siswa_id: j.siswa_id,
        soal_teks: soal.teks_soal,
        soal_bobot: soal.bobot,
        jawaban_teks: j.teks_jawaban_essay,
        nilai_manual: j.nilai_manual || 0
      });
    }
  });

  res.json(detailedEssay);
});

app.post('/api/guru/nilai-essay/grade', (req, res) => {
  const { jawaban_id, nilai } = req.body;
  const jp = db.getById('jawaban_peserta', jawaban_id);
  if (!jp) return res.status(404).json({ message: 'Jawaban tidak ditemukan!' });

  db.update('jawaban_peserta', jp.id, { nilai_manual: parseFloat(nilai || 0) });

  // Update total nilai akhir di hasil_ujian
  const hasil = db.query('hasil_ujian', h => h.siswa_id === jp.siswa_id && h.ujian_id === jp.ujian_id)[0];
  if (hasil) {
    // Hitung ulang semua nilai: PG benar + Essay manual
    const semuaJawaban = db.query('jawaban_peserta', j => j.siswa_id === jp.siswa_id && j.ujian_id === jp.ujian_id);
    const ujian = db.getById('ujian', jp.ujian_id);
    if (ujian) {
      const soalList = db.query('soal', s => s.bank_soal_id === ujian.bank_soal_id);

      let nilaiBaru = 0;
      soalList.forEach(s => {
        const j = semuaJawaban.find(jw => jw.soal_id === s.id);
        if (j) {
          if (s.jenis_soal === 'PG' && j.pilihan_jawaban_id) {
            const kunci = db.query('pilihan_jawaban', o => o.soal_id === s.id && o.is_kunci)[0];
            if (kunci && kunci.id === j.pilihan_jawaban_id) {
              nilaiBaru += s.bobot;
            }
          } else if (s.jenis_soal === 'ESSAY') {
            nilaiBaru += (j.nilai_manual || 0);
          }
        }
      });

      db.update('hasil_ujian', hasil.id, { nilai_akhir: nilaiBaru });
    }
  }

  res.json({ message: 'Nilai essay berhasil disimpan!' });
});

// REKAPITULASI HASIL UJIAN UNTUK EKSPOR
app.get('/api/guru/rekap-nilai/:ujianId', (req, res) => {
  const ujianId = parseInt(req.params.ujianId);
  const hasilList = db.query('hasil_ujian', h => h.ujian_id === ujianId);
  
  const rekap = hasilList.map(h => {
    const siswa = db.getById('siswa', h.siswa_id);
    return {
      nis: siswa ? siswa.nis : '-',
      nama: siswa ? siswa.nama : 'Siswa Terhapus',
      nama_kelas: siswa ? siswa.nama_kelas : '-',
      jumlah_benar: h.jumlah_benar,
      jumlah_salah: h.jumlah_salah,
      nilai_akhir: h.nilai_akhir,
      waktu_selesai: h.waktu_selesai
    };
  });
  
  res.json(rekap);
});

// DATA MASTER (ADMIN)
app.get('/api/admin/siswa', (req, res) => {
  res.json(db.getAll('siswa'));
});

app.post('/api/admin/siswa', (req, res) => {
  const { nis, nama, kelas_id, password } = req.body;
  if (!nis || !nama || !kelas_id) {
    return res.status(400).json({ message: 'NIS, Nama, dan Kelas wajib diisi!' });
  }

  const existingUser = db.query('users', u => u.username === nis)[0];
  if (existingUser) {
    return res.status(400).json({ message: 'Siswa dengan NIS tersebut sudah terdaftar!' });
  }

  const kelas = db.getById('kelas', kelas_id);
  
  // Buat User Akun Siswa dulu
  const user = db.insert('users', { username: nis, password: password || nis, role: 'siswa' });
  
  const newSiswa = db.insert('siswa', {
    user_id: user.id,
    nis,
    nama,
    kelas_id: parseInt(kelas_id),
    nama_kelas: kelas ? kelas.nama_kelas : '-'
  });
  
  res.json({ message: 'Siswa berhasil ditambahkan!', data: newSiswa });
});

app.delete('/api/admin/siswa/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const s = db.getById('siswa', id);
  if (s) {
    db.delete('users', s.user_id);
    db.delete('siswa', id);
  }
  res.json({ message: 'Siswa berhasil dihapus!' });
});

app.get('/api/admin/kelas', (req, res) => {
  res.json(db.getAll('kelas'));
});

app.post('/api/admin/kelas', (req, res) => {
  const { nama_kelas } = req.body;
  const newKelas = db.insert('kelas', { nama_kelas });
  res.json({ message: 'Kelas berhasil dibuat!', data: newKelas });
});

app.get('/api/admin/mapel', (req, res) => {
  res.json(db.getAll('mata_pelajaran'));
});

app.post('/api/admin/mapel', (req, res) => {
  const { kode_mapel, nama_mapel } = req.body;
  const newMapel = db.insert('mata_pelajaran', { kode_mapel, nama_mapel });
  res.json({ message: 'Mata pelajaran berhasil ditambahkan!', data: newMapel });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`SERVER CBT BERJALAN PADA URL: http://localhost:${PORT}`);
  console.log(`Database tersimpan di: ${path.join(__dirname, 'cbt_db.json')}`);
  console.log(`====================================================`);
});
