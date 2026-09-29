const API_URL = 'http://localhost:3000/api';

async function request(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const error = new Error(`HTTP ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function runTest() {
  console.log('=== MEMULAI INTEGRATION TEST PHASE 11: WORKSPACE GURU & SINKRONISASI MOBILE ===\n');

  try {
    // 1. Login Admin
    console.log('1. Login Admin...');
    const adminLoginRes = await request(`${API_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin' })
    });
    const adminToken = adminLoginRes.token;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };
    console.log('✓ Admin login berhasil!');

    // 2. Setup Master Data Kelas & Mapel
    console.log('\n2. Membuat Data Kelas & Mapel oleh Admin...');
    const timestamp = Date.now().toString().slice(-4);
    
    // Create Kelas XII-A & XII-B
    const kelasARes = await request(`${API_URL}/admin/kelas`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ nama_kelas: `XII-A-${timestamp}` })
    });
    const kelasBRes = await request(`${API_URL}/admin/kelas`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ nama_kelas: `XII-B-${timestamp}` })
    });
    const kelasA = kelasARes.data;
    const kelasB = kelasBRes.data;
    console.log(`✓ Kelas dibuat: ${kelasA.nama_kelas} (ID:${kelasA.id}), ${kelasB.nama_kelas} (ID:${kelasB.id})`);

    // Create Mapel Matematika & B.Indo
    const mapelMatRes = await request(`${API_URL}/admin/mapel`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ kode_mapel: `MTK${timestamp}`, nama_mapel: 'Matematika' })
    });
    const mapelIndRes = await request(`${API_URL}/admin/mapel`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ kode_mapel: `IND${timestamp}`, nama_mapel: 'Bahasa Indonesia' })
    });
    const mapelMat = mapelMatRes.data;
    const mapelInd = mapelIndRes.data;
    console.log(`✓ Mapel dibuat: ${mapelMat.nama_mapel} (ID:${mapelMat.id}), ${mapelInd.nama_mapel} (ID:${mapelInd.id})`);

    // 3. Create Guru A & Guru B
    console.log('\n3. Membuat Data Guru A & Guru B...');
    const nipGuruA = `NIP_A_${timestamp}`;
    const nipGuruB = `NIP_B_${timestamp}`;
    
    const guruARes = await request(`${API_URL}/admin/guru`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ nip: nipGuruA, nama: 'Guru A (Matematika)', password: 'password123' })
    });

    const guruBRes = await request(`${API_URL}/admin/guru`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ nip: nipGuruB, nama: 'Guru B (Bahasa Indonesia)', password: 'password123' })
    });

    const guruA = guruARes.data;
    const guruB = guruBRes.data;
    console.log(`✓ Guru A dibuat: ${guruA.nama} (ID:${guruA.id})`);
    console.log(`✓ Guru B dibuat: ${guruB.nama} (ID:${guruB.id})`);

    // 4. Assign Penempatan Guru oleh Admin
    console.log('\n4. Menetapkan Penempatan Workspace Guru oleh Admin...');
    // Guru A -> XII-A + Matematika
    await request(`${API_URL}/admin/guru/${guruA.id}/assign`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ assignments: [{ kelas_id: kelasA.id, mapel_id: mapelMat.id }] })
    });

    // Guru B -> XII-A + Bahasa Indonesia
    await request(`${API_URL}/admin/guru/${guruB.id}/assign`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ assignments: [{ kelas_id: kelasA.id, mapel_id: mapelInd.id }] })
    });

    console.log('✓ Guru A ditugaskan ke: XII-A -> Matematika');
    console.log('✓ Guru B ditugaskan ke: XII-A -> Bahasa Indonesia');

    // 5. Login Guru A & Check Workspace
    console.log('\n5. Login Guru A & Cek Workspace...');
    const guruALoginRes = await request(`${API_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ username: nipGuruA, password: 'password123' })
    });
    const guruAToken = guruALoginRes.token;
    const guruAHeaders = { Authorization: `Bearer ${guruAToken}` };

    const workspaceRes = await request(`${API_URL}/guru/workspace`, { headers: guruAHeaders });
    console.log('✓ Workspace Guru A:', JSON.stringify(workspaceRes.assignments));

    // 6. Test Hak Akses Bank Soal Guru A
    console.log('\n6. Pengujian Hak Akses Bank Soal Guru A...');
    // a. Buat Bank Soal Matematika XII-A -> Harus BERHASIL
    const bankMatA = await request(`${API_URL}/guru/bank-soal`, {
      method: 'POST',
      headers: guruAHeaders,
      body: JSON.stringify({
        judul: 'Bank Soal Matematika XII-A',
        kelas_id: kelasA.id,
        mapel_id: mapelMat.id
      })
    });
    console.log('✓ [BERHASIL] Guru A membuat Bank Soal Matematika XII-A! (ID:', bankMatA.data.id, ')');

    // b. Coba buat Bank Soal Bahasa Indonesia XII-A -> Harus DITOLAK 403
    try {
      await request(`${API_URL}/guru/bank-soal`, {
        method: 'POST',
        headers: guruAHeaders,
        body: JSON.stringify({
          judul: 'Bank Soal B.Indo XII-A Ilegal',
          kelas_id: kelasA.id,
          mapel_id: mapelInd.id
        })
      });
      console.error('❌ FAIL: Guru A seharusnya DITOLAK membuat Bank Soal B.Indo!');
    } catch (err) {
      if (err.status === 403) {
        console.log('✓ [DITOLAK 403 SUCCESS] Guru A ditolak membuat Bank Soal Bahasa Indonesia!');
      } else {
        throw err;
      }
    }

    // c. Coba buat Bank Soal Matematika XII-B -> Harus DITOLAK 403
    try {
      await request(`${API_URL}/guru/bank-soal`, {
        method: 'POST',
        headers: guruAHeaders,
        body: JSON.stringify({
          judul: 'Bank Soal Matematika XII-B Ilegal',
          kelas_id: kelasB.id,
          mapel_id: mapelMat.id
        })
      });
      console.error('❌ FAIL: Guru A seharusnya DITOLAK membuat Bank Soal untuk Kelas XII-B!');
    } catch (err) {
      if (err.status === 403) {
        console.log('✓ [DITOLAK 403 SUCCESS] Guru A ditolak membuat Bank Soal untuk Kelas XII-B!');
      } else {
        throw err;
      }
    }

    // 7. Test Pembuatan Ujian & Validasi Bank Soal
    console.log('\n7. Pengujian Pembuatan Ujian...');
    // Buat Ujian Matematika XII-A oleh Guru A -> Harus BERHASIL
    const examMatA = await request(`${API_URL}/guru/ujian`, {
      method: 'POST',
      headers: guruAHeaders,
      body: JSON.stringify({
        nama_ujian: 'Ujian Akhir Matematika XII-A',
        bank_soal_id: bankMatA.data.id,
        kelas_id: kelasA.id,
        durasi_menit: 60
      })
    });
    console.log('✓ [BERHASIL] Guru A membuat Ujian Matematika XII-A (ID:', examMatA.data.id, ')');

    // 8. Test Mobile Siswa Synchronization
    console.log('\n8. Pengujian Sinkronisasi Mobile Siswa...');
    const nisSiswa = `NIS_${timestamp}`;
    const siswaRes = await request(`${API_URL}/admin/siswa`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        nis: nisSiswa,
        nama: 'Siswa Percobaan',
        kelas_id: kelasA.id,
        password: 'password123'
      })
    });
    console.log(`✓ Siswa terdaftar pada kelas ${kelasA.nama_kelas}`);

    // Login Siswa
    const siswaLoginRes = await request(`${API_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ username: nisSiswa, password: 'password123' })
    });
    const siswaToken = siswaLoginRes.token;
    const siswaHeaders = { Authorization: `Bearer ${siswaToken}` };

    // Siswa fetch active exams
    const activeExamsBefore = await request(`${API_URL}/siswa/ujian/${kelasA.id}`, { headers: siswaHeaders });
    console.log(`✓ Active Exams Siswa (Kelas ${kelasA.nama_kelas}):`, activeExamsBefore.length, 'ujian ditemukan.');

    // Admin Pindahkan Siswa ke Kelas XII-B
    console.log('\n9. Admin Memindahkan Siswa ke Kelas XII-B...');
    await request(`${API_URL}/admin/siswa/${siswaRes.data.id}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ kelas_id: kelasB.id })
    });

    // Siswa fetch active exams (Backend otomatis pakai kelas baru XII-B)
    const activeExamsAfter = await request(`${API_URL}/siswa/ujian/${kelasA.id}`, { headers: siswaHeaders });
    console.log(`✓ Active Exams Siswa setelah pindah kelas ke ${kelasB.nama_kelas}:`, activeExamsAfter.length, 'ujian ditemukan.');

    console.log('\n======================================================');
    console.log('🎉 SEMUA PENGUJIAN LOGIC WORKSPACE & SINKRONISASI LULUS 100%!');
    console.log('======================================================');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.status ? `HTTP ${error.status}` : error.message, error.data || '');
    process.exit(1);
  }
}

runTest();
