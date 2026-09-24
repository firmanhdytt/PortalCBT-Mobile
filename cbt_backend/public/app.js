// Global JWT Fetch Interceptor
const _originalFetch = window.fetch;
window.fetch = function(url, options = {}) {
  const token = localStorage.getItem("cbt_token");
  options = options || {};
  options.headers = options.headers || {};
  if (token) {
    if (options.headers instanceof Headers) {
      if (!options.headers.has('Authorization')) {
        options.headers.set('Authorization', 'Bearer ' + token);
      }
    } else if (Array.isArray(options.headers)) {
      options.headers.push(['Authorization', 'Bearer ' + token]);
    } else {
      if (!options.headers['Authorization']) {
        options.headers['Authorization'] = 'Bearer ' + token;
      }
    }
  }
  return _originalFetch(url, options).then(res => {
    if (res.status === 401 && typeof url === 'string' && !url.includes('/login') && !url.includes('/register')) {
      handleLogout();
    }
    return res;
  });
};

let currentUser = null;
let currentProfil = null;
let editingSoalId = null;

// State untuk Ujian Siswa
let studentUjianList = [];
let activeSiswaUjian = null;
let studentQuestions = [];
let studentCurrentIndex = 0;
let studentAnswers = {}; // { soal_id: { pilihan_jawaban_id, teks_jawaban_essay, is_ragu } }
let studentTimer = null;
let studentSyncTimer = null;
let studentSecondsRemaining = 0;

// ==========================================
// KENDALI UTAMA LAYAR & TABS (SPA LOGIC)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("cbt_token");
  const logged = localStorage.getItem("cbt_user");
  const prof = localStorage.getItem("cbt_profil");
  if (logged && token) {
    currentUser = JSON.parse(logged);
    currentProfil = prof ? JSON.parse(prof) : null;
    showAppLayout();
  } else {
    showLoginLayout();
  }
});


function showLoginLayout() {
  document.getElementById("login-screen").style.display = "flex";
  document.getElementById("app-container").style.display = "none";
  document.getElementById("siswa-container").style.display = "none";
}

function quickFillLogin(u, p) {
  document.getElementById("login-username").value = u;
  document.getElementById("login-password").value = p;
  showToast(`Autofill akun ${u.toUpperCase()} berhasil!`);
}

function toggleWebPasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === "password") {
    input.type = "text";
    btn.innerText = "🙈";
  } else {
    input.type = "password";
    btn.innerText = "👁️";
  }
}

function getGreetingTime() {
  const hour = new Date().getHours();
  if (hour < 11) return "Selamat Pagi";
  if (hour < 15) return "Selamat Siang";
  if (hour < 18) return "Selamat Sore";
  return "Selamat Malam";
}

function handleLogin() {
  const usernameInput = document.getElementById("login-username").value.trim();
  const passwordInput = document.getElementById("login-password").value.trim();
  const btn = document.getElementById("btn-login-submit");

  if (!usernameInput || !passwordInput) {
    showToast("Harap masukkan Username dan Password!");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span>MEMPROSES...</span> ⌛`;
  }

  fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: usernameInput, password: passwordInput })
  })
  .then(res => {
    if (!res.ok) throw new Error("Username atau Password salah!");
    return res.json();
  })
  .then(res => {
    currentUser = res.user;
    currentProfil = res.profil;
    if (res.token) localStorage.setItem("cbt_token", res.token);
    if (res.refresh_token) localStorage.setItem("cbt_refresh_token", res.refresh_token);
    localStorage.setItem("cbt_user", JSON.stringify(currentUser));
    localStorage.setItem("cbt_profil", JSON.stringify(currentProfil));
    
    showToast(`Login sukses! Selamat datang, ${currentProfil ? currentProfil.nama : currentUser.username}`);
    showAppLayout();
  })
  .catch(err => {
    showToast(err.message);
  })
  .finally(() => {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span>MASUK KE SISTEM</span> ➔`;
    }
  });
}

function handleLogout() {
  const refreshToken = localStorage.getItem("cbt_refresh_token");
  if (refreshToken) {
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    }).catch(() => {});
  }
  localStorage.removeItem("cbt_token");
  localStorage.removeItem("cbt_refresh_token");
  localStorage.removeItem("cbt_user");
  localStorage.removeItem("cbt_profil");
  currentUser = null;
  currentProfil = null;

  
  // Matikan timer pengerjaan jika ada
  clearInterval(studentTimer);
  clearInterval(studentSyncTimer);

  showLoginLayout();
}

function showAppLayout() {
  document.getElementById("login-screen").style.display = "none";

  if (currentUser.role === 'siswa') {
    // Tampilkan Khusus Modul Siswa, Sembunyikan Admin/Guru
    document.getElementById("app-container").style.display = "none";
    document.getElementById("siswa-container").style.display = "flex";
    siswaInit();
  } else {
    // Tampilkan Khusus Modul Admin/Guru, Sembunyikan Siswa
    document.getElementById("app-container").style.display = "flex";
    document.getElementById("siswa-container").style.display = "none";

    document.getElementById("user-display-name").innerText = currentProfil ? currentProfil.nama : currentUser.username;
    document.getElementById("user-display-sub").innerText = currentUser.role === 'admin' ? 'Administrator' : `NIP. ${currentProfil ? currentProfil.nip : '-'}`;
    document.getElementById("role-badge").innerText = currentUser.role.toUpperCase() + " PANEL";

    const menuGuru = document.querySelectorAll(".menu-guru");
    const menuAdmin = document.querySelectorAll(".menu-admin");

    if (currentUser.role === 'admin') {
      menuGuru.forEach(el => el.style.display = "none");
      menuAdmin.forEach(el => el.style.display = "block");
      showPage('db-admin');
    } else {
      menuGuru.forEach(el => el.style.display = "block");
      menuAdmin.forEach(el => el.style.display = "none");
      showPage('db-guru');
    }
  }
}

// Side-bar Toggle Mobile-Friendly
function toggleSidebar(open) {
  const sidebar = document.getElementById("app-sidebar");
  const overlay = document.getElementById("mobile-overlay");
  if (open) {
    sidebar.classList.add("open");
    overlay.style.display = "block";
  } else {
    sidebar.classList.remove("open");
    overlay.style.display = "none";
  }
}

function showPage(pageId) {
  const pages = document.querySelectorAll(".page-view");
  pages.forEach(p => p.classList.remove("active"));

  document.getElementById(`page-${pageId}`).classList.add("active");

  const menuItems = document.querySelectorAll(".menu-item");
  menuItems.forEach(item => item.classList.remove("active"));

  const targetMenuItem = document.getElementById(`menu-${pageId}`);
  if (targetMenuItem) targetMenuItem.classList.add("active");

  // Tutup sidebar otomatis di mobile setelah klik menu
  toggleSidebar(false);

  // Load Data
  if (pageId === 'db-guru') loadDashboardGuru();
  if (pageId === 'soal') loadBankSoalPage();
  if (pageId === 'ujian') loadUjianPage();
  if (pageId === 'monitoring') loadMonitoringPage();
  if (pageId === 'grading') loadGradingPage();
  if (pageId === 'db-admin') loadDashboardAdmin();
  if (pageId === 'master-siswa') loadMasterSiswaPage();
  if (pageId === 'master-kelas') loadMasterKelasPage();
  if (pageId === 'master-mapel') loadMasterMapelPage();
}

// ==========================================
// C. DEDICATED STUDENT PORTAL LOGIC (SISWA)
// ==========================================
function siswaInit() {
  document.getElementById("siswa-name-display").innerText = currentProfil.nama;
  document.getElementById("siswa-nis-display").innerText = `NIS: ${currentProfil.nis} | Kelas: ${currentProfil.nama_kelas}`;
  siswaSwitchPage('dashboard');
  siswaLoadUjian();
}

function siswaSwitchPage(page) {
  document.getElementById("siswa-page-dashboard").style.display = page === 'dashboard' ? 'block' : 'none';
  document.getElementById("siswa-page-exam").style.display = page === 'exam' ? 'flex' : 'none';
  document.getElementById("siswa-page-score").style.display = page === 'score' ? 'block' : 'none';
}

function siswaLoadUjian() {
  fetch(`/api/siswa/ujian/${currentProfil.kelas_id}?siswa_id=${currentProfil.id}`)
    .then(res => res.json())
    .then(list => {
      studentUjianList = list;
      const container = document.getElementById("siswa-ujian-list");
      container.innerHTML = "";

      if (list.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding: 20px; color:var(--text-light); font-size:13px;">Tidak ada ujian aktif saat ini.</p>`;
        return;
      }

      list.forEach(u => {
        container.innerHTML += `
          <div class="siswa-card">
            <div class="siswa-card-title">${u.nama_ujian}</div>
            <div class="siswa-card-meta">
              <span>⏱ ${u.durasi_menit} Menit</span>
              <span>📝 PG & Essay</span>
            </div>
            <button class="btn btn-primary btn-block" onclick="siswaOpenTokenModal(${u.id}, '${u.nama_ujian}')">Mulai Ujian</button>
          </div>
        `;
      });
    });
}

let activeUjianIdForToken = null;
function siswaOpenTokenModal(ujianId, namaUjian) {
  activeUjianIdForToken = ujianId;
  document.getElementById("siswa-token-title").innerText = namaUjian;
  document.getElementById("siswa-token-input").value = "";
  openModal('siswa-token-modal');
}

function siswaVerifyToken() {
  const tokenVal = document.getElementById("siswa-token-input").value.trim().toUpperCase();
  if (!tokenVal) {
    showToast("Masukkan token ujian!");
    return;
  }

  fetch('/api/siswa/ujian/verifikasi-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ujian_id: activeUjianIdForToken, token: tokenVal })
  })
  .then(res => {
    if (!res.ok) throw new Error("Token ujian salah!");
    return res.json();
  })
  .then(res => {
    activeSiswaUjian = res.ujian;
    closeModal('siswa-token-modal');
    siswaStartExam();
  })
  .catch(err => {
    showToast(err.message);
  });
}

function siswaStartExam() {
  siswaSwitchPage('exam');
  document.getElementById("siswa-soal-no-display").innerText = "Memuat soal...";
  
  fetch(`/api/siswa/ujian/soal/${activeSiswaUjian.id}`)
    .then(res => res.json())
    .then(list => {
      studentQuestions = list;
      studentCurrentIndex = 0;
      studentAnswers = {};

      studentQuestions.forEach(q => {
        studentAnswers[q.id] = { pilihan_jawaban_id: null, teks_jawaban_essay: '', is_ragu: false };
      });

      siswaRenderQuestion();
      siswaStartTimer(activeSiswaUjian.durasi_menit);
      siswaStartAutoSync();
    });
}

function siswaStartTimer(minutes) {
  clearInterval(studentTimer);
  studentSecondsRemaining = minutes * 60;

  studentTimer = setInterval(() => {
    studentSecondsRemaining--;
    if (studentSecondsRemaining <= 0) {
      clearInterval(studentTimer);
      showToast("Waktu ujian habis! Menyimpan jawaban...");
      siswaSubmitFinalForce();
      return;
    }

    const min = Math.floor(studentSecondsRemaining / 60);
    const sec = studentSecondsRemaining % 60;
    document.getElementById("siswa-timer-display").innerText = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }, 1000);
}

function siswaStartAutoSync() {
  clearInterval(studentSyncTimer);
  studentSyncTimer = setInterval(() => {
    siswaSyncAnswers();
  }, 10000);
}

function siswaSyncAnswers() {
  const list = Object.keys(studentAnswers).map(soalId => ({
    soal_id: soalId,
    pilihan_jawaban_id: studentAnswers[soalId].pilihan_jawaban_id,
    teks_jawaban_essay: studentAnswers[soalId].teks_jawaban_essay,
    is_ragu: studentAnswers[soalId].is_ragu
  }));

  fetch('/api/siswa/ujian/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      siswa_id: currentProfil.id,
      ujian_id: activeSiswaUjian.id,
      jawaban_list: list
    })
  });
}

function siswaRenderQuestion() {
  if (studentQuestions.length === 0) return;
  const q = studentQuestions[studentCurrentIndex];

  document.getElementById("siswa-soal-no-display").innerText = `Soal ${studentCurrentIndex + 1} dari ${studentQuestions.length}`;
  document.getElementById("siswa-teks-soal").innerText = q.teks_soal;

  const area = document.getElementById("siswa-answer-area");
  area.innerHTML = "";

  if (q.jenis_soal === 'PG') {
    let html = `<div class="siswa-options-list">`;
    q.pilihan.forEach(opt => {
      const isSelected = studentAnswers[q.id].pilihan_jawaban_id === opt.id;
      html += `
        <div class="siswa-option-item ${isSelected ? 'selected' : ''}" onclick="siswaSelectOption(${q.id}, ${opt.id})">
          <div class="siswa-option-label">${opt.label}</div>
          <div>${opt.teks_pilihan}</div>
        </div>
      `;
    });
    html += `</div>`;
    area.innerHTML = html;
  } else {
    area.innerHTML = `
      <textarea class="siswa-textarea" placeholder="Tulis jawaban essay Anda di sini..." oninput="siswaEssayInput(${q.id}, this.value)">${studentAnswers[q.id].teks_jawaban_essay || ''}</textarea>
    `;
  }

  document.getElementById("siswa-check-ragu").checked = studentAnswers[q.id].is_ragu;
  document.getElementById("siswa-btn-prev").disabled = studentCurrentIndex === 0;
  document.getElementById("siswa-btn-next").innerText = studentCurrentIndex === studentQuestions.length - 1 ? "Selesai" : "Lanjut";
}

function siswaSelectOption(soalId, opsiId) {
  studentAnswers[soalId].pilihan_jawaban_id = opsiId;
  siswaRenderQuestion();
  siswaSyncAnswers();
}

function siswaEssayInput(soalId, value) {
  studentAnswers[soalId].teks_jawaban_essay = value;
}

function siswaToggleRagu(checked) {
  const q = studentQuestions[studentCurrentIndex];
  studentAnswers[q.id].is_ragu = checked;
  siswaSyncAnswers();
}

function siswaNext() {
  if (studentCurrentIndex < studentQuestions.length - 1) {
    studentCurrentIndex++;
    siswaRenderQuestion();
  } else {
    siswaConfirmFinish();
  }
}

function siswaPrev() {
  if (studentCurrentIndex > 0) {
    studentCurrentIndex--;
    siswaRenderQuestion();
  }
}

function siswaConfirmFinish() {
  openModal('siswa-finish-modal');
}

function siswaSubmitFinalForce() {
  siswaSubmitFinal();
}

function siswaSubmitFinal() {
  closeModal('siswa-finish-modal');
  clearInterval(studentTimer);
  clearInterval(studentSyncTimer);

  // Sync terakhir kali
  const list = Object.keys(studentAnswers).map(soalId => ({
    soal_id: soalId,
    pilihan_jawaban_id: studentAnswers[soalId].pilihan_jawaban_id,
    teks_jawaban_essay: studentAnswers[soalId].teks_jawaban_essay,
    is_ragu: studentAnswers[soalId].is_ragu
  }));

  fetch('/api/siswa/ujian/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      siswa_id: currentProfil.id,
      ujian_id: activeSiswaUjian.id,
      jawaban_list: list
    })
  })
  .then(() => {
    return fetch('/api/siswa/ujian/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siswa_id: currentProfil.id, ujian_id: activeSiswaUjian.id })
    });
  })
  .then(res => res.json())
  .then(res => {
    siswaSwitchPage('score');
    document.getElementById("siswa-benar-cnt").innerText = res.hasil.jumlah_benar;
    document.getElementById("siswa-salah-cnt").innerText = res.hasil.jumlah_salah;
    document.getElementById("siswa-total-score").innerText = res.hasil.nilai_akhir + " Poin";
  })
  .catch(() => {
    showToast("Gagal menyimpan ke server!");
  });
}

function siswaOpenGrid(open) {
  if (open) {
    openModal('siswa-grid-modal');
    const container = document.getElementById("siswa-num-grid-container");
    container.innerHTML = "";
    
    studentQuestions.forEach((q, idx) => {
      const isCurrent = idx === studentCurrentIndex;
      const ans = studentAnswers[q.id];
      let classList = "siswa-num-btn";
      if (isCurrent) classList += " current";
      else if (ans.is_ragu) classList += " doubtful";
      else if (ans.pilihan_jawaban_id || ans.teks_jawaban_essay.trim() !== "") classList += " answered";

      container.innerHTML += `
        <div class="${classList}" onclick="siswaJumpTo(${idx})">${idx + 1}</div>
      `;
    });
  } else {
    closeModal('siswa-grid-modal');
  }
}

function siswaJumpTo(idx) {
  studentCurrentIndex = idx;
  siswaRenderQuestion();
  closeModal('siswa-grid-modal');
}

function siswaGoHome() {
  siswaInit();
}

// ==========================================
// D. GURU & ADMIN BUSINESS LOGIC
// ==========================================

function loadDashboardGuru() {
  const greetingEl = document.getElementById("guru-greeting-title");
  if (greetingEl) {
    greetingEl.innerText = `${getGreetingTime()}, ${currentProfil ? currentProfil.nama : 'Guru'}! 👋`;
  }

  fetch('/api/guru/ujian')
    .then(res => res.json())
    .then(list => {
      const tbody = document.getElementById("guru-dashboard-table-body");
      tbody.innerHTML = "";
      
      const activeToday = list.filter(u => u.is_aktif);
      document.getElementById("guru-stat-ujian").innerText = activeToday.length;

      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Belum ada sesi ujian aktif.</td></tr>`;
        return;
      }

      list.forEach(u => {
        const actionHtml = !u.is_aktif
          ? `<button class="btn btn-danger" onclick="deleteUjian(${u.id})" style="padding: 4px 8px; font-size:12px; display:inline-flex; align-items:center; gap:4px;">
               <span style="font-size:12px;">🗑️</span> Hapus
             </button>`
          : '-';
        tbody.innerHTML += `
          <tr>
            <td><strong>${u.nama_ujian}</strong></td>
            <td>
              <div>${u.nama_kelas}</div>
              <div style="font-size:11px; color:var(--text-light); margin-top:2px;">Progres: ${u.selesai_siswa} / ${u.total_siswa} Selesai</div>
            </td>
            <td><span class="badge badge-info">${u.token}</span></td>
            <td>${u.durasi_menit} Menit</td>
            <td>${u.is_aktif ? '<span class="badge badge-success">Aktif</span>' : '<span class="badge badge-danger">Mati</span>'}</td>
            <td>${actionHtml}</td>
          </tr>
        `;
      });
    });

  fetch('/api/guru/bank-soal')
    .then(res => res.json())
    .then(list => {
      document.getElementById("guru-stat-bank").innerText = list.length;
    });
}

function deleteUjian(id) {
  if (confirm("Apakah Anda yakin ingin menghapus sesi ujian ini secara permanen?")) {
    fetch(`/api/guru/ujian/${id}`, { method: 'DELETE' })
      .then(res => {
        if (!res.ok) throw new Error("Gagal menghapus sesi ujian!");
        return res.json();
      })
      .then(() => {
        showToast("Sesi ujian berhasil dihapus!");
        loadDashboardGuru();
      })
      .catch(err => {
        showToast(err.message);
      });
  }
}

function loadBankSoalPage() {
  fetch('/api/guru/bank-soal')
    .then(res => res.json())
    .then(list => {
      const select = document.getElementById("select-bank-soal");
      select.innerHTML = '<option value="">-- Pilih Paket Soal --</option>';
      list.forEach(b => {
        select.innerHTML += `<option value="${b.id}">${b.judul}</option>`;
      });
    });
}

function loadQuestionsForBankSoal(bankId) {
  if (!bankId) {
    document.getElementById("question-table-body").innerHTML = `<tr><td colspan="5" style="text-align: center;">Pilih paket soal terlebih dahulu.</td></tr>`;
    return;
  }

  fetch(`/api/guru/soal/${bankId}`)
    .then(res => res.json())
    .then(list => {
      const tbody = document.getElementById("question-table-body");
      tbody.innerHTML = "";
      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Belum ada butir soal.</td></tr>`;
        return;
      }

      list.forEach((s, idx) => {
        tbody.innerHTML += `
          <tr>
            <td>${idx + 1}</td>
            <td><span class="badge badge-info">${s.jenis_soal}</span></td>
            <td>
              <div><strong>${s.teks_soal}</strong></div>
              ${s.jenis_soal === 'PG' ? `
                <div style="font-size:12px; margin-top:5px; color:var(--text-light)">
                  Opsi: ${s.pilihan.map(o => `${o.label}. ${o.teks_pilihan} ${o.is_kunci ? '<b>(Kunci)</b>' : ''}`).join(' | ')}
                </div>
              ` : ''}
            </td>
            <td>${s.bobot}</td>
            <td>
              <button class="btn btn-secondary" onclick="openEditQuestionModal(${s.id})" style="padding: 4px 8px; font-size:12px; margin-right:5px;">Edit</button>
              <button class="btn btn-danger" onclick="deleteQuestion(${s.id}, ${bankId})" style="padding: 4px 8px; font-size:12px;">Hapus</button>
            </td>
          </tr>
        `;
      });
    });
}

function openCreateBankSoalModal() {
  fetch('/api/admin/mapel')
    .then(res => res.json())
    .then(list => {
      const select = document.getElementById("modal-bank-mapel");
      select.innerHTML = "";
      list.forEach(m => {
        select.innerHTML += `<option value="${m.id}">${m.nama_mapel}</option>`;
      });
      openModal('create-bank-modal');
    });
}

function handleCreateBankSoal() {
  const judul = document.getElementById("modal-bank-judul").value.trim();
  const mapel_id = document.getElementById("modal-bank-mapel").value;

  if (!judul) {
    showToast("Judul wajib diisi!");
    return;
  }

  fetch('/api/guru/bank-soal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ judul, mapel_id, guru_id: currentProfil ? currentProfil.id : 1 })
  })
  .then(res => res.json())
  .then(() => {
    showToast("Paket soal berhasil dibuat!");
    closeModal('create-bank-modal');
    loadBankSoalPage();
  });
}

function updateCorrectOptionHighlight() {
  const selectedElement = document.querySelector('input[name="kunci-jawaban"]:checked');
  const selected = selectedElement ? selectedElement.value : 'A';
  ['A', 'B', 'C', 'D', 'E'].forEach(l => {
    const row = document.getElementById(`row-${l}`);
    if (row) {
      if (l === selected) {
        row.classList.add("correct");
      } else {
        row.classList.remove("correct");
      }
    }
  });
}

function openCreateQuestionModal() {
  const bankId = document.getElementById("select-bank-soal").value;
  if (!bankId) {
    showToast("Silakan pilih Paket Soal terlebih dahulu!");
    return;
  }

  editingSoalId = null;
  const modalTitle = document.querySelector('#create-question-modal h3');
  if (modalTitle) modalTitle.innerText = "Tambah Butir Soal Baru";

  // Reset form inputs
  document.getElementById("modal-soal-teks").value = "";
  document.getElementById("modal-soal-jenis").value = "PG";
  document.getElementById("modal-soal-bobot").value = "10";
  toggleOptionEditor("PG");

  // Reset choices
  ['A', 'B', 'C', 'D', 'E'].forEach(l => {
    document.getElementById(`opsi-${l}`).value = "";
  });

  // Reset Kunci Jawaban radio
  const radio = document.querySelector('input[name="kunci-jawaban"][value="A"]');
  if (radio) radio.checked = true;
  updateCorrectOptionHighlight();

  openModal('create-question-modal');
}

function openEditQuestionModal(soalId) {
  editingSoalId = soalId;
  const modalTitle = document.querySelector('#create-question-modal h3');
  if (modalTitle) modalTitle.innerText = "Edit Butir Soal";

  fetch(`/api/guru/soal/detail/${soalId}`)
    .then(res => {
      if (!res.ok) throw new Error("Gagal memuat detail soal!");
      return res.json();
    })
    .then(s => {
      document.getElementById("modal-soal-teks").value = s.teks_soal;
      document.getElementById("modal-soal-jenis").value = s.jenis_soal;
      document.getElementById("modal-soal-bobot").value = s.bobot;
      toggleOptionEditor(s.jenis_soal);

      if (s.jenis_soal === 'PG') {
        // Reset choices first
        ['A', 'B', 'C', 'D', 'E'].forEach(l => {
          document.getElementById(`opsi-${l}`).value = "";
        });

        // Set choices and correct key
        let correctLabel = 'A';
        s.pilihan.forEach(o => {
          const input = document.getElementById(`opsi-${o.label}`);
          if (input) input.value = o.teks_pilihan;
          if (o.is_kunci) correctLabel = o.label;
        });

        const radio = document.querySelector(`input[name="kunci-jawaban"][value="${correctLabel}"]`);
        if (radio) radio.checked = true;
        updateCorrectOptionHighlight();
      }

      openModal('create-question-modal');
    })
    .catch(err => {
      showToast(err.message);
    });
}

function toggleOptionEditor(jenis) {
  const editor = document.getElementById("pg-options-editor");
  editor.style.display = jenis === 'PG' ? "block" : "none";
}

function handleCreateQuestion() {
  const bankId = document.getElementById("select-bank-soal").value;
  const jenis = document.getElementById("modal-soal-jenis").value;
  const bobot = document.getElementById("modal-soal-bobot").value;
  const teks = document.getElementById("modal-soal-teks").value.trim();

  if (!teks) {
    showToast("Teks soal tidak boleh kosong!");
    return;
  }

  const payload = {
    bank_soal_id: bankId,
    jenis_soal: jenis,
    teks_soal: teks,
    bobot: bobot,
    opsi_list: []
  };

  if (jenis === 'PG') {
    const radioKunci = document.querySelector('input[name="kunci-jawaban"]:checked').value;
    ['A', 'B', 'C', 'D', 'E'].forEach(l => {
      const val = document.getElementById(`opsi-${l}`).value.trim();
      payload.opsi_list.push({
        label: l,
        teks_pilihan: val || `Opsi ${l}`,
        is_kunci: l === radioKunci
      });
    });
  }

  const url = editingSoalId ? `/api/guru/soal/${editingSoalId}` : '/api/guru/soal';
  const method = editingSoalId ? 'PUT' : 'POST';

  fetch(url, {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(() => {
    showToast(editingSoalId ? "Soal berhasil diperbarui!" : "Soal berhasil ditambahkan!");
    closeModal('create-question-modal');
    loadQuestionsForBankSoal(bankId);
    
    editingSoalId = null;
    document.getElementById("modal-soal-teks").value = "";
    ['A', 'B', 'C', 'D', 'E'].forEach(l => document.getElementById(`opsi-${l}`).value = "");
  });
}

function deleteQuestion(id, bankId) {
  if (confirm("Apakah yakin ingin menghapus soal ini?")) {
    fetch(`/api/guru/soal/${id}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(() => {
        showToast("Soal dihapus!");
        loadQuestionsForBankSoal(bankId);
      });
  }
}

function loadUjianPage() {
  fetch('/api/guru/bank-soal').then(res => res.json()).then(list => {
    const select = document.getElementById("ujian-bank-soal");
    select.innerHTML = "";
    list.forEach(b => select.innerHTML += `<option value="${b.id}">${b.judul}</option>`);
  });

  fetch('/api/admin/kelas').then(res => res.json()).then(list => {
    const select = document.getElementById("ujian-kelas");
    select.innerHTML = "";
    list.forEach(k => select.innerHTML += `<option value="${k.id}">${k.nama_kelas}</option>`);
  });

  loadExamsTable();
}

function loadExamsTable() {
  fetch('/api/guru/ujian')
    .then(res => res.json())
    .then(list => {
      const tbody = document.getElementById("exam-list-table-body");
      tbody.innerHTML = "";
      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Belum ada sesi ujian terjadwal.</td></tr>`;
        return;
      }

      list.forEach(u => {
        tbody.innerHTML += `
          <tr>
            <td><strong>${u.nama_ujian}</strong></td>
            <td>${u.judul_bank_soal}</td>
            <td>
              <div>${u.nama_kelas}</div>
              <div style="font-size:11px; color:var(--text-light); margin-top:2px;">Progres: ${u.selesai_siswa} / ${u.total_siswa} Selesai</div>
            </td>
            <td><span class="badge badge-info">${u.token}</span></td>
            <td>${u.durasi_menit} Menit</td>
            <td>
              <button class="btn ${u.is_aktif ? 'btn-success' : 'btn-secondary'}" onclick="toggleUjian(${u.id})" style="padding: 4px 8px; font-size:12px;">
                ${u.is_aktif ? 'Aktif' : 'Mati'}
              </button>
            </td>
            <td>
              <button class="btn btn-primary" onclick="goToMonitoring(${u.id})" style="padding: 4px 8px; font-size:12px;">Monitor</button>
            </td>
          </tr>
        `;
      });
    });
}

function handleCreateUjian() {
  const nama = document.getElementById("ujian-nama").value.trim();
  const bankId = document.getElementById("ujian-bank-soal").value;
  const kelasId = document.getElementById("ujian-kelas").value;
  const durasi = document.getElementById("ujian-durasi").value;
  const token = document.getElementById("ujian-token").value.trim().toUpperCase();

  if (!nama) {
    showToast("Nama Ujian wajib diisi!");
    return;
  }

  if (!bankId || !kelasId) {
    showToast("Harap pilih Paket Soal dan Kelas!");
    return;
  }

  fetch('/api/guru/ujian', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama_ujian: nama, bank_soal_id: bankId, kelas_id: kelasId, token, durasi_menit: durasi })
  })
  .then(res => res.json())
  .then(() => {
    showToast("Sesi ujian berhasil dirilis!");
    document.getElementById("ujian-nama").value = "";
    document.getElementById("ujian-token").value = "";
    loadExamsTable();
  });
}

function toggleUjian(id) {
  fetch(`/api/guru/ujian/toggle/${id}`, { method: 'POST' })
    .then(res => res.json())
    .then(() => {
      showToast("Status ujian berhasil diubah!");
      loadExamsTable();
    });
}

function goToMonitoring(id) {
  showPage('monitoring');
  document.getElementById("monitor-select-ujian").value = id;
  loadMonitoringData(id);
}

function loadMonitoringPage() {
  fetch('/api/guru/ujian')
    .then(res => res.json())
    .then(list => {
      const select = document.getElementById("monitor-select-ujian");
      select.innerHTML = '<option value="">-- Pilih Ujian untuk Dipantau --</option>';
      list.forEach(u => select.innerHTML += `<option value="${u.id}">${u.nama_ujian} (${u.nama_kelas})</option>`);
    });
}

function loadMonitoringData(id) {
  if (!id) {
    document.getElementById("monitoring-card-box").style.display = "none";
    return;
  }

  fetch(`/api/guru/monitoring/${id}`)
    .then(res => res.json())
    .then(res => {
      document.getElementById("monitoring-card-box").style.display = "block";
      document.getElementById("mon-ujian-name").innerText = res.nama_ujian;
      document.getElementById("mon-token-display").innerText = "Token: " + res.token;

      const container = document.getElementById("monitoring-grid-container");
      container.innerHTML = "";

      if (res.siswa.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 20px;">Tidak ada data siswa terdaftar.</div>`;
        return;
      }

      res.siswa.forEach(s => {
        const pct = s.total_soal > 0 ? Math.round((s.soal_terjawab / s.total_soal) * 100) : 0;
        let badgeClass = 'badge-secondary';
        if (s.status === 'Selesai') badgeClass = 'badge-success';
        if (s.status === 'Sedang Mengerjakan') badgeClass = 'badge-warning';

        container.innerHTML += `
          <div class="student-monitor-card">
            <div class="monitor-student-header">
              <div>
                <h4>${s.nama}</h4>
                <span>NIS: ${s.nis}</span>
              </div>
              <span class="badge ${badgeClass}">${s.status}</span>
            </div>
            <div>
              <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px;">
                <span>Progres</span>
                <strong>${s.soal_terjawab} / ${s.total_soal} (${pct}%)</strong>
              </div>
              <div class="progress-bar-container">
                <div class="progress-bar-fill" style="width: ${pct}%"></div>
              </div>
            </div>
          </div>
        `;
      });
    });
}

function loadGradingPage() {
  fetch('/api/guru/ujian')
    .then(res => res.json())
    .then(list => {
      const select = document.getElementById("grading-select-ujian");
      select.innerHTML = '<option value="">-- Pilih Sesi Ujian --</option>';
      list.forEach(u => select.innerHTML += `<option value="${u.id}">${u.nama_ujian} (${u.nama_kelas})</option>`);
    });
}

function loadEssayAnswers(ujianId) {
  if (!ujianId) {
    document.getElementById("essay-list-container").innerHTML = `<p style="text-align: center; color: var(--text-light); padding:20px;">Silakan pilih sesi ujian.</p>`;
    return;
  }

  fetch(`/api/guru/nilai-essay/list/${ujianId}`)
    .then(res => res.json())
    .then(list => {
      const container = document.getElementById("essay-list-container");
      container.innerHTML = "";

      if (list.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-light); padding:20px;">Tidak ada jawaban essay.</p>`;
        return;
      }

      list.forEach(j => {
        container.innerHTML += `
          <div class="grading-box">
            <div style="font-size:12px; color:var(--text-light); margin-bottom:10px;">
              <strong>Siswa:</strong> ${j.siswa_nama} | <strong>Bobot Maksimal:</strong> ${j.soal_bobot} Poin
            </div>
            <div style="margin-bottom:10px; font-size:13.5px;">
              <strong>Pertanyaan:</strong><br> ${j.soal_teks}
            </div>
            <div class="essay-student-ans">
              <strong>Jawaban Siswa:</strong><br> ${j.jawaban_teks || '<i>(Tidak dijawab)</i>'}
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              <input type="number" id="grade-input-${j.jawaban_id}" class="form-control" style="width:70px; text-align:center;" min="0" max="${j.soal_bobot}" value="${j.nilai_manual}">
              <button class="btn btn-primary" onclick="submitGrade(${j.jawaban_id}, ${ujianId})">Simpan Nilai</button>
            </div>
          </div>
        `;
      });
    });
}

function submitGrade(jawabanId, ujianId) {
  const val = document.getElementById(`grade-input-${jawabanId}`).value;
  if (val === "") return;

  fetch('/api/guru/nilai-essay/grade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jawaban_id: jawabanId, nilai: val })
  })
  .then(res => res.json())
  .then(() => {
    showToast("Nilai berhasil disimpan!");
    loadEssayAnswers(ujianId);
  });
}

// ADMIN LOGIC
function loadDashboardAdmin() {
  fetch('/api/admin/siswa').then(res => res.json()).then(l => document.getElementById("admin-stat-siswa").innerText = l.length);
  fetch('/api/admin/kelas').then(res => res.json()).then(l => document.getElementById("admin-stat-kelas").innerText = l.length);
}

function loadMasterSiswaPage() {
  fetch('/api/admin/kelas')
    .then(res => res.json())
    .then(list => {
      const select = document.getElementById("siswa-kelas");
      select.innerHTML = "";
      list.forEach(k => select.innerHTML += `<option value="${k.id}">${k.nama_kelas}</option>`);
    });
  loadStudentsTable();
}

function loadStudentsTable() {
  fetch('/api/admin/siswa')
    .then(res => res.json())
    .then(list => {
      const tbody = document.getElementById("student-list-table-body");
      tbody.innerHTML = "";
      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Belum ada data siswa.</td></tr>`;
        return;
      }
      list.forEach(s => {
        tbody.innerHTML += `
          <tr>
            <td><strong>${s.nis}</strong></td>
            <td>${s.nama}</td>
            <td>${s.nama_kelas}</td>
            <td>
              <button class="btn btn-danger" onclick="deleteSiswa(${s.id})" style="padding: 4px 8px; font-size:12px;">Hapus</button>
            </td>
          </tr>
        `;
      });
    });
}

function handleAddSiswa() {
  const nis = document.getElementById("siswa-nis").value.trim();
  const nama = document.getElementById("siswa-nama").value.trim();
  const kelas_id = document.getElementById("siswa-kelas").value;
  const password = document.getElementById("siswa-password").value.trim();

  if (!nis || !nama) return;

  fetch('/api/admin/siswa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nis, nama, kelas_id, password })
  })
  .then(res => res.json())
  .then(() => {
    showToast("Siswa berhasil didaftarkan!");
    document.getElementById("siswa-nis").value = "";
    document.getElementById("siswa-nama").value = "";
    document.getElementById("siswa-password").value = "";
    loadStudentsTable();
  });
}

function deleteSiswa(id) {
  if (confirm("Hapus siswa ini?")) {
    fetch(`/api/admin/siswa/${id}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(() => {
        showToast("Siswa dihapus!");
        loadStudentsTable();
      });
  }
}

function loadMasterKelasPage() {
  fetch('/api/admin/kelas')
    .then(res => res.json())
    .then(list => {
      const tbody = document.getElementById("class-list-table-body");
      tbody.innerHTML = "";
      list.forEach(k => {
        tbody.innerHTML += `<tr><td>${k.id}</td><td><strong>${k.nama_kelas}</strong></td></tr>`;
      });
    });
}

function handleAddKelas() {
  const nama = document.getElementById("kelas-nama").value.trim();
  if (!nama) return;

  fetch('/api/admin/kelas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama_kelas: nama })
  })
  .then(res => res.json())
  .then(() => {
    showToast("Kelas berhasil dibuat!");
    document.getElementById("kelas-nama").value = "";
    loadMasterKelasPage();
  });
}

function loadMasterMapelPage() {
  fetch('/api/admin/mapel')
    .then(res => res.json())
    .then(list => {
      const tbody = document.getElementById("mapel-list-table-body");
      tbody.innerHTML = "";
      list.forEach(m => {
        tbody.innerHTML += `<tr><td><span class="badge badge-info">${m.kode_mapel}</span></td><td><strong>${m.nama_mapel}</strong></td></tr>`;
      });
    });
}

function handleAddMapel() {
  const kode = document.getElementById("mapel-kode").value.trim().toUpperCase();
  const nama = document.getElementById("mapel-nama").value.trim();

  if (!kode || !nama) return;

  fetch('/api/admin/mapel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kode_mapel: kode, nama_mapel: nama })
  })
  .then(res => res.json())
  .then(() => {
    showToast("Mapel disimpan!");
    document.getElementById("mapel-kode").value = "";
    document.getElementById("mapel-nama").value = "";
    loadMasterMapelPage();
  });
}

// ==========================================
// TOAST & MODAL WINDOW HELPERS
// ==========================================
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.innerText = msg;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

function openModal(id) {
  document.getElementById(id).style.display = "block";
}

function closeModal(id) {
  document.getElementById(id).style.display = "none";
}
