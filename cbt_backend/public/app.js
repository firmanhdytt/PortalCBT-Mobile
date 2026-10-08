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

// State Cache untuk Admin & Guru Tables
let stateGuruList = [];
let stateSiswaList = [];
let stateKelasList = [];
let stateMapelList = [];
let stateUjianList = [];
let stateBankSoalList = [];
let stateQuestionsList = [];
let stateGradingList = [];
let stateRekapList = [];
let stateRekapCertMap = {};

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
  try {
    applyInitialTheme();
    const token = localStorage.getItem("cbt_token");
    const logged = localStorage.getItem("cbt_user");
    const prof = localStorage.getItem("cbt_profil");
    if (logged && token && logged !== "undefined") {
      currentUser = JSON.parse(logged);
      currentProfil = (prof && prof !== "undefined") ? JSON.parse(prof) : null;
      if (currentUser && currentUser.role) {
        showAppLayout();
        return;
      }
    }
  } catch (err) {
    console.error("Error restoring session:", err);
  }
  localStorage.removeItem("cbt_token");
  localStorage.removeItem("cbt_user");
  localStorage.removeItem("cbt_profil");
  showLoginLayout();
});


function showLoginLayout() {
  document.querySelectorAll(".modal").forEach(m => m.style.display = "none");
  const overlay = document.getElementById("mobile-overlay");
  if (overlay) overlay.style.display = "none";

  const loginScreen = document.getElementById("login-screen");
  if (loginScreen) {
    loginScreen.style.display = "flex";
    loginScreen.style.zIndex = "1000";
  }
  const appContainer = document.getElementById("app-container");
  if (appContainer) appContainer.style.display = "none";
  const siswaContainer = document.getElementById("siswa-container");
  if (siswaContainer) siswaContainer.style.display = "none";
}

function handleLoginSubmit(event) {
  if (event) event.preventDefault();
  handleLogin();
}

function quickFillLogin(u, p, autoSubmit = true) {
  const uInput = document.getElementById("login-username");
  const pInput = document.getElementById("login-password");
  if (uInput) uInput.value = u;
  if (pInput) pInput.value = p;
  showToast(`🔑 Autofill ${u.toUpperCase()} siap...`);
  if (autoSubmit) {
    handleLogin();
  } else if (pInput) {
    pInput.focus();
  }
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
  const uEl = document.getElementById("login-username");
  const pEl = document.getElementById("login-password");
  const usernameInput = uEl ? uEl.value.trim() : "";
  const passwordInput = pEl ? pEl.value.trim() : "";
  const btn = document.getElementById("btn-login-submit");

  if (!usernameInput || !passwordInput) {
    showToast("⚠️ Harap masukkan Username dan Password!");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span>MEMPROSES MASUK...</span> ⌛`;
  }

  fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: usernameInput, password: passwordInput })
  })
  .then(res => {
    if (!res.ok) {
      return res.json().then(e => { throw new Error(e.message || "Username atau Password salah!"); });
    }
    return res.json();
  })
  .then(res => {
    currentUser = res.user;
    currentProfil = res.profil;
    if (res.token) localStorage.setItem("cbt_token", res.token);
    if (res.refresh_token) localStorage.setItem("cbt_refresh_token", res.refresh_token);
    localStorage.setItem("cbt_user", JSON.stringify(currentUser));
    localStorage.setItem("cbt_profil", JSON.stringify(currentProfil));
    
    showToast(`✓ Login sukses! Selamat datang, ${currentProfil ? currentProfil.nama : currentUser.username}`);
    showAppLayout();
  })
  .catch(err => {
    showToast("❌ " + err.message);
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
  stopNotificationPolling();

  showLoginLayout();
}

function showAppLayout() {
  document.getElementById("login-screen").style.display = "none";

  // Muat dan terapkan preferensi tampilan & jalankan polling notifikasi
  initUserPreferences();
  startNotificationPolling();

  // Muat dan render profil & avatar terbaru
  fetchAndRenderUserProfile();

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
  if (pageId === 'workspace-guru') loadWorkspaceGuruPage();
  if (pageId === 'soal') loadBankSoalPage();
  if (pageId === 'ujian') loadUjianPage();
  if (pageId === 'monitoring') loadMonitoringPage();
  if (pageId === 'grading') loadGradingPage();
  if (pageId === 'rekap') loadRekapPage();
  if (pageId === 'db-admin') loadDashboardAdmin();
  if (pageId === 'master-guru') loadMasterGuruPage();
  if (pageId === 'master-siswa') loadMasterSiswaPage();
  if (pageId === 'master-kelas') loadMasterKelasPage();
  if (pageId === 'master-mapel') loadMasterMapelPage();
}

// ==========================================
// C. DEDICATED STUDENT PORTAL LOGIC (SISWA)
// ==========================================
function siswaInit() {
  const nama = (currentProfil && currentProfil.nama) ? currentProfil.nama : ((currentUser && currentUser.username) ? currentUser.username : 'Siswa');
  const nis = (currentProfil && currentProfil.nis) ? currentProfil.nis : '-';
  const kelas = (currentProfil && currentProfil.nama_kelas) ? currentProfil.nama_kelas : '-';

  if (document.getElementById("siswa-name-display")) {
    document.getElementById("siswa-name-display").innerText = nama;
  }
  if (document.getElementById("siswa-nis-display")) {
    document.getElementById("siswa-nis-display").innerText = `NIS: ${nis} | Kelas: ${kelas}`;
  }

  fetchAndRenderUserProfile();
  siswaSwitchPage('dashboard');
  if (currentProfil && currentProfil.kelas_id) {
    siswaLoadUjian();
  }
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

  applyExamFontScale(currentFontScale);
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
    document.getElementById("siswa-benar-cnt").innerText = res.hasil.jumlah_benar ?? 0;
    document.getElementById("siswa-salah-cnt").innerText = res.hasil.jumlah_salah ?? 0;
    const elPg = document.getElementById("siswa-nilai-pg");
    if (elPg) elPg.innerText = (res.hasil.nilai_pg ?? res.hasil.nilai_akhir) + " Poin";
    const elEssay = document.getElementById("siswa-nilai-essay");
    if (elEssay) elEssay.innerText = (res.hasil.nilai_essay !== null && res.hasil.nilai_essay !== undefined ? res.hasil.nilai_essay : 0) + " Poin";
    document.getElementById("siswa-total-score").innerText = res.hasil.nilai_akhir + " Poin";
    const statusEl = document.getElementById("siswa-status-badge");
    if (statusEl && res.hasil.status_kelulusan) {
      statusEl.innerText = res.hasil.status_kelulusan;
      statusEl.className = 'badge ' + (res.hasil.status_kelulusan === 'LULUS' ? 'badge-success' : (res.hasil.status_kelulusan === 'REMIDI' ? 'badge-danger' : 'badge-warning'));
    }
    const certBox = document.getElementById("siswa-cert-action-box");
    if (certBox) {
      if (res.hasil.status_kelulusan === 'LULUS') {
        certBox.style.display = 'block';
        window.latestFinishedUjianId = activeSiswaUjian ? activeSiswaUjian.id : null;
      } else {
        certBox.style.display = 'none';
      }
    }
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
      if (!select) return;
      select.innerHTML = '<option value="">-- Pilih Paket Soal --</option>';
      if (Array.isArray(list)) {
        list.forEach(b => {
          const kName = b.nama_kelas || '';
          const mName = b.nama_mapel || '';
          const info = (kName || mName) ? ` (${kName}${kName && mName ? ' - ' : ''}${mName})` : '';
          select.innerHTML += `<option value="${b.id}">${b.judul}${info}</option>`;
        });
      }
    });
}

function loadQuestionsForBankSoal(bankId) {
  if (!bankId) {
    stateQuestionsList = [];
    renderQuestionsTable([]);
    return;
  }

  fetch(`/api/guru/soal/${bankId}`)
    .then(res => res.json())
    .then(list => {
      stateQuestionsList = list || [];
      filterBankSoalQuestions();
    });
}

function filterBankSoalQuestions() {
  const q = (document.getElementById("filter-soal-search")?.value || "").toLowerCase().trim();
  const jenis = (document.getElementById("filter-soal-jenis")?.value || "").toUpperCase().trim();

  const filtered = stateQuestionsList.filter(s => {
    const matchQ = !q || (s.teks_soal || "").toLowerCase().includes(q);
    const matchJenis = !jenis || (s.jenis_soal || "").toUpperCase() === jenis;
    return matchQ && matchJenis;
  });

  renderQuestionsTable(filtered);
}

function renderQuestionsTable(list) {
  const tbody = document.getElementById("question-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding:20px; color:var(--text-light);">Tidak ada butir soal yang cocok.</td></tr>`;
    return;
  }

  list.forEach((s, idx) => {
    const bankId = document.getElementById("select-bank-soal")?.value;
    tbody.innerHTML += `
      <tr>
        <td>${idx + 1}</td>
        <td><span class="badge ${s.jenis_soal === 'PG' ? 'badge-primary' : 'badge-info'}">${s.jenis_soal}</span></td>
        <td>
          <div><strong>${s.teks_soal}</strong></div>
          ${s.jenis_soal === 'PG' && s.pilihan ? `
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
}

let teacherWorkspaceAssignments = [];

function openCreateBankSoalModal() {
  const kSelect = document.getElementById("modal-bank-kelas");
  const mSelect = document.getElementById("modal-bank-mapel");
  if (kSelect) kSelect.innerHTML = '<option value="">Memuat...</option>';
  if (mSelect) mSelect.innerHTML = '<option value="">Memuat...</option>';

  fetch('/api/guru/workspace')
    .then(r => r.json())
    .then(res => {
      if (!kSelect || !mSelect) return;
      kSelect.innerHTML = '<option value="">-- Pilih Kelas Target --</option>';
      mSelect.innerHTML = '<option value="">-- Pilih Mata Pelajaran --</option>';

      if (res.is_admin) {
        kSelect.onchange = null;
        (res.kelas || []).forEach(k => {
          kSelect.innerHTML += `<option value="${k.id}">${k.nama_kelas}</option>`;
        });
        (res.mapel || []).forEach(m => {
          mSelect.innerHTML += `<option value="${m.id}">${m.nama_mapel}</option>`;
        });
      } else if (res.assignments) {
        teacherWorkspaceAssignments = res.assignments || [];
        const uniqueKelas = [];
        const kelasMap = new Set();

        teacherWorkspaceAssignments.forEach(a => {
          if (a.kelas_id && !kelasMap.has(a.kelas_id)) {
            kelasMap.add(a.kelas_id);
            uniqueKelas.push({ id: a.kelas_id, nama_kelas: a.nama_kelas });
          }
        });

        uniqueKelas.forEach(k => {
          kSelect.innerHTML += `<option value="${k.id}">${k.nama_kelas}</option>`;
        });

        kSelect.onchange = updateBankSoalMapelOptions;
        updateBankSoalMapelOptions();
      }
      openModal('create-bank-modal');
    })
    .catch(() => {
      Promise.all([
        fetch('/api/admin/kelas').then(r => r.json()),
        fetch('/api/admin/mapel').then(r => r.json())
      ]).then(([kelasList, mapelList]) => {
        if (kSelect) {
          kSelect.innerHTML = '<option value="">-- Pilih Kelas Target --</option>';
          (kelasList || []).forEach(k => {
            kSelect.innerHTML += `<option value="${k.id}">${k.nama_kelas}</option>`;
          });
        }
        if (mSelect) {
          mSelect.innerHTML = '<option value="">-- Pilih Mata Pelajaran --</option>';
          (mapelList || []).forEach(m => {
            mSelect.innerHTML += `<option value="${m.id}">${m.nama_mapel}</option>`;
          });
        }
        openModal('create-bank-modal');
      });
    });
}

function updateBankSoalMapelOptions() {
  const kSelect = document.getElementById("modal-bank-kelas");
  const mSelect = document.getElementById("modal-bank-mapel");
  if (!kSelect || !mSelect) return;

  const selectedKelasId = kSelect.value;
  mSelect.innerHTML = '<option value="">-- Pilih Mata Pelajaran --</option>';

  if (!selectedKelasId) return;

  const filteredMapels = teacherWorkspaceAssignments.filter(a => String(a.kelas_id) === String(selectedKelasId));
  const addedMapelIds = new Set();
  filteredMapels.forEach(a => {
    if (a.mapel_id && !addedMapelIds.has(a.mapel_id)) {
      addedMapelIds.add(a.mapel_id);
      mSelect.innerHTML += `<option value="${a.mapel_id}">${a.nama_mapel}</option>`;
    }
  });

  if (addedMapelIds.size === 1) {
    mSelect.value = Array.from(addedMapelIds)[0];
  }
}

function handleCreateBankSoal() {
  const judul = document.getElementById("modal-bank-judul").value.trim();
  const kelas_id = document.getElementById("modal-bank-kelas") ? document.getElementById("modal-bank-kelas").value : '';
  const mapel_id = document.getElementById("modal-bank-mapel") ? document.getElementById("modal-bank-mapel").value : '';

  if (!judul) {
    showToast("Judul wajib diisi!", "danger");
    return;
  }
  if (!kelas_id) {
    showToast("Kelas wajib dipilih!", "danger");
    return;
  }
  if (!mapel_id) {
    showToast("Mata Pelajaran wajib dipilih!", "danger");
    return;
  }

  fetch('/api/guru/bank-soal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      judul,
      kelas_id: parseInt(kelas_id),
      mapel_id: parseInt(mapel_id),
      guru_id: currentProfil ? currentProfil.id : 1
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error || data.statusCode >= 400 || (data.message && !data.id)) {
      showToast(data.message || "Gagal membuat paket soal!", "danger");
      return;
    }
    showToast("Paket soal berhasil dibuat!", "success");
    closeModal('create-bank-modal');
    loadBankSoalPage();
  })
  .catch(err => {
    showToast("Terjadi kesalahan koneksi!", "danger");
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

function syncUjianTargetClass() {
  const bankSelect = document.getElementById("ujian-bank-soal");
  const kelasSelect = document.getElementById("ujian-kelas");
  const syncBadge = document.getElementById("ujian-target-sync-badge");

  if (!bankSelect || !kelasSelect) return;
  const selectedOpt = bankSelect.options[bankSelect.selectedIndex];
  if (!selectedOpt) return;

  const targetKelasId = selectedOpt.getAttribute("data-kelas-id");
  const targetKelasNama = selectedOpt.getAttribute("data-kelas-nama");
  const targetMapelNama = selectedOpt.getAttribute("data-mapel-nama");

  if (targetKelasId && targetKelasId !== "null" && targetKelasId !== "undefined" && targetKelasId !== "") {
    kelasSelect.value = targetKelasId;
    if (syncBadge) {
      syncBadge.className = "badge badge-success";
      syncBadge.innerHTML = `🎯 Tersambung Otomatis: Kelas ${targetKelasNama || ''} (${targetMapelNama || ''})`;
      syncBadge.style.display = "inline-block";
    }
  } else {
    if (syncBadge) {
      syncBadge.className = "badge badge-warning";
      syncBadge.innerHTML = `⚠️ Pilih Kelas Sasaran Manual`;
      syncBadge.style.display = "inline-block";
    }
  }
}

function loadUjianPage() {
  fetch('/api/guru/bank-soal').then(res => res.json()).then(list => {
    stateBankSoalList = list || [];
    const select = document.getElementById("ujian-bank-soal");
    if (select) {
      select.innerHTML = "";
      if (!list || list.length === 0) {
        select.innerHTML = `<option value="">-- Belum Ada Bank Soal --</option>`;
      } else {
        list.forEach(b => {
          select.innerHTML += `<option value="${b.id}" data-kelas-id="${b.kelas_id || ''}" data-kelas-nama="${b.nama_kelas || '-'}" data-mapel-nama="${b.nama_mapel || '-'}">${b.judul} — [${b.nama_kelas || 'Semua Kelas'} | ${b.nama_mapel || 'Mapel'}]</option>`;
        });
      }
      select.onchange = syncUjianTargetClass;
    }
    syncUjianTargetClass();
  });

  fetch('/api/admin/kelas').then(res => res.json()).then(list => {
    stateKelasList = list || [];
    const select = document.getElementById("ujian-kelas");
    if (select) {
      select.innerHTML = "";
      list.forEach(k => select.innerHTML += `<option value="${k.id}">${k.nama_kelas}</option>`);
    }
    syncUjianTargetClass();
  });

  loadExamsTable();
}

function loadExamsTable() {
  fetch('/api/guru/ujian')
    .then(res => res.json())
    .then(list => {
      stateUjianList = list || [];
      filterUjianTable();
    });
}

function filterUjianTable() {
  const q = (document.getElementById("filter-ujian-search")?.value || "").toLowerCase().trim();
  const st = (document.getElementById("filter-ujian-status")?.value || "").toLowerCase().trim();

  const filtered = stateUjianList.filter(u => {
    const matchQ = !q || (u.nama_ujian || "").toLowerCase().includes(q) || (u.judul_bank_soal || "").toLowerCase().includes(q) || (u.nama_kelas || "").toLowerCase().includes(q) || (u.token || "").toLowerCase().includes(q);
    const isAktif = u.is_aktif ? "aktif" : "nonaktif";
    const matchSt = !st || isAktif === st;
    return matchQ && matchSt;
  });

  renderUjianTable(filtered);
}

function renderUjianTable(list) {
  const tbody = document.getElementById("exam-list-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-light);">Tidak ada sesi ujian yang cocok.</td></tr>`;
    return;
  }

  list.forEach(u => {
    tbody.innerHTML += `
      <tr>
        <td><strong>${u.nama_ujian}</strong></td>
        <td>${u.judul_bank_soal || '-'}</td>
        <td>
          <span class="badge badge-info">${u.nama_kelas || '-'}</span>
          <div style="font-size:11px; color:var(--text-light); margin-top:2px;">Progres: ${u.selesai_siswa || 0} / ${u.total_siswa || 0} Selesai</div>
        </td>
        <td><span class="badge badge-warning" style="font-family:monospace; letter-spacing:1px;">${u.token}</span></td>
        <td>${u.durasi_menit} Menit</td>
        <td>
          <button class="btn ${u.is_aktif ? 'btn-success' : 'btn-secondary'}" onclick="toggleUjian(${u.id})" style="padding: 4px 8px; font-size:12px;">
            ${u.is_aktif ? '✓ Aktif' : '⏸️ Nonaktif'}
          </button>
        </td>
        <td style="text-align:center;">
          <button class="btn btn-primary" onclick="goToMonitoring(${u.id})" style="padding: 4px 8px; font-size:12px;">📡 Monitor</button>
        </td>
      </tr>
    `;
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
        if (s.is_locked || s.status === 'Terkunci (Anti-Cheat)') badgeClass = 'badge-danger';

        const strikeBadge = (s.strikes && s.strikes > 0)
          ? `<span style="display:inline-block; margin-top:4px; padding:2px 6px; font-size:10px; border-radius:4px; background:#fee2e2; color:#b91c1c; font-weight:bold;">🚨 ${s.strikes} Pelanggaran</span>`
          : '';

        let unlockActionBtn = '';
        if (s.pending_unlock_id) {
          unlockActionBtn = `
            <div style="margin-top:8px; padding:6px; background:#fef3c7; border-radius:6px; font-size:11px;">
              <strong>Permintaan Buka Kunci:</strong><br>
              <em>"${s.pending_unlock_reason || 'Meminta pembukaan kunci ujian'}"</em>
              <div style="margin-top:4px;">
                <button class="btn btn-warning" onclick="handleTeacherUnlock(${s.pending_unlock_id}, ${id})" style="padding:3px 8px; font-size:11px; cursor:pointer;">🔓 Setujui & Buka</button>
              </div>
            </div>
          `;
        } else if (s.is_locked) {
          unlockActionBtn = `
            <div style="margin-top:8px;">
              <button class="btn btn-secondary" onclick="handleTeacherManualUnlock(${id}, ${s.id})" style="padding:3px 8px; font-size:11px; cursor:pointer;">🔓 Buka Kunci Manual</button>
            </div>
          `;
        }

        container.innerHTML += `
          <div class="student-monitor-card" style="${s.is_locked ? 'border: 2px solid #ef4444;' : ''}">
            <div class="monitor-student-header">
              <div>
                <h4>${s.nama}</h4>
                <span>NIS: ${s.nis}</span>
                ${strikeBadge}
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
              ${unlockActionBtn}
            </div>
          </div>
        `;
      });
    });
}

function handleTeacherUnlock(requestId, ujianId) {
  fetch(`/api/guru/proctoring/unlock/${requestId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'APPROVE' })
  })
  .then(res => res.json())
  .then(res => {
    showToast(res.message || 'Ujian berhasil dibuka kuncinya!');
    loadMonitoringData(ujianId);
  })
  .catch(err => showToast(err.message));
}

function handleTeacherManualUnlock(ujianId, siswaId) {
  fetch('/api/guru/proctoring/reset-violations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ujian_id: ujianId, siswa_id: siswaId })
  })
  .then(res => res.json())
  .then(res => {
    showToast(res.message || 'Status ujian dibuka kembali!');
    loadMonitoringData(ujianId);
  })
  .catch(err => showToast(err.message));
}

function loadGradingPage() {
  fetch('/api/guru/ujian')
    .then(res => res.json())
    .then(list => {
      const select = document.getElementById("grading-select-ujian");
      select.innerHTML = '<option value="">-- Pilih Sesi Ujian --</option>';
      list.forEach(u => select.innerHTML += `<option value="${u.id}">${u.nama_ujian} (${u.nama_kelas})</option>`);
      document.getElementById("essay-list-container").innerHTML = `<p style="text-align: center; color: var(--text-light); padding:20px;">Silakan pilih sesi ujian untuk memulai koreksi essay.</p>`;
      const bar = document.getElementById("grading-stats-bar");
      if (bar) bar.style.display = "none";
    })
    .catch(err => showToast("Gagal memuat daftar ujian: " + err.message));
}

function loadEssayAnswers(ujianId) {
  if (!ujianId) {
    stateGradingList = [];
    document.getElementById("essay-list-container").innerHTML = `<p style="text-align: center; color: var(--text-light); padding:20px;">Silakan pilih sesi ujian.</p>`;
    const bar = document.getElementById("grading-stats-bar");
    if (bar) bar.style.display = "none";
    return;
  }

  const container = document.getElementById("essay-list-container");
  container.innerHTML = `<p style="text-align:center; padding:20px; color:var(--text-light);">Memuat jawaban essay siswa...</p>`;

  fetch(`/api/guru/nilai-essay/list/${ujianId}`)
    .then(res => res.json())
    .then(list => {
      stateGradingList = list || [];
      filterGradingItems();
    })
    .catch(err => {
      container.innerHTML = `<p style="color:var(--danger); text-align:center; padding:20px;">Gagal memuat jawaban essay: ${err.message}</p>`;
    });
}

function filterGradingItems() {
  const q = (document.getElementById("filter-grading-search")?.value || "").toLowerCase().trim();
  const st = (document.getElementById("filter-grading-status")?.value || "").toLowerCase().trim();

  const filtered = stateGradingList.filter(j => {
    const matchQ = !q || (j.siswa_nama || "").toLowerCase().includes(q) || (j.nis || "").toLowerCase().includes(q) || (j.soal_teks || "").toLowerCase().includes(q);
    const isGraded = j.nilai_manual !== null && j.nilai_manual !== undefined;
    const statusStr = isGraded ? "completed" : "pending";
    const matchSt = !st || statusStr === st;
    return matchQ && matchSt;
  });

  renderGradingItems(filtered);
}

function renderGradingItems(list) {
  const container = document.getElementById("essay-list-container");
  if (!container) return;
  container.innerHTML = "";

  const total = stateGradingList.length;
  const completed = stateGradingList.filter(j => j.nilai_manual !== null && j.nilai_manual !== undefined).length;
  const pending = total - completed;

  const totalEl = document.getElementById("grading-stat-total");
  const pendingEl = document.getElementById("grading-stat-pending");
  const compEl = document.getElementById("grading-stat-completed");
  const bar = document.getElementById("grading-stats-bar");

  if (total > 0) {
    if (totalEl) totalEl.innerText = total;
    if (pendingEl) pendingEl.innerText = pending;
    if (compEl) compEl.innerText = completed;
    if (bar) bar.style.display = "grid";
  } else {
    if (bar) bar.style.display = "none";
  }

  if (!list || list.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text-light); padding:25px;">Tidak ada jawaban essay yang cocok.</p>`;
    return;
  }

  const ujianId = document.getElementById("grading-select-ujian")?.value;

  list.forEach((j, idx) => {
    const isGraded = j.nilai_manual !== null && j.nilai_manual !== undefined;
    const statusBadge = isGraded
      ? `<span class="badge badge-success">✓ Sudah Dinilai (${j.nilai_manual} / ${j.soal_bobot} Poin)</span>`
      : `<span class="badge badge-warning">⏳ Belum Dinilai</span>`;

    container.innerHTML += `
      <div class="grading-box" style="background:#FFFFFF; border: 1.5px solid ${isGraded ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}; margin-bottom: 20px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; border-bottom:1px solid #E2E8F0; padding-bottom:8px;">
          <div>
            <strong style="font-size:14px; color:var(--text);">${idx + 1}. ${j.siswa_nama}</strong>
            <span style="font-size:12px; color:var(--text-light); margin-left:8px;">(NIS: ${j.nis || '-'})</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="badge badge-info">Bobot Maks: ${j.soal_bobot}</span>
            ${statusBadge}
          </div>
        </div>
        
        <div style="margin-bottom:12px; font-size:13.5px; line-height:1.5;">
          <strong style="color:var(--text);">Pertanyaan:</strong><br>
          <div style="margin-top:4px; padding:8px 12px; background:#F8FAFC; border-radius:6px; border:1px solid #E2E8F0;">
            ${j.soal_teks}
          </div>
        </div>

        <div style="margin-bottom:14px;">
          <strong style="color:var(--text); font-size:13.5px;">Jawaban Siswa:</strong>
          <div class="essay-student-ans" style="margin-top:4px; font-style:normal; white-space:pre-wrap; background:#F1F5F9; border-left:4px solid var(--primary); padding:10px 14px;">
            ${j.jawaban_teks ? j.jawaban_teks : '<i style="color:var(--text-light);">(Siswa tidak memberikan jawaban)</i>'}
          </div>
        </div>

        <div style="display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end; background:#F8FAFC; padding:12px; border-radius:8px; border:1px solid #E2E8F0;">
          <div style="width:130px;">
            <label style="display:block; font-size:11px; font-weight:700; margin-bottom:4px; color:#475569;">NILAI (0 - ${j.soal_bobot})</label>
            <input type="number" id="grade-input-${j.jawaban_id}" class="form-control" style="text-align:center; font-weight:700; font-size:15px;" min="0" max="${j.soal_bobot}" step="0.5" value="${j.nilai_manual !== null && j.nilai_manual !== undefined ? j.nilai_manual : ''}" placeholder="0">
          </div>
          <div style="flex:1; min-width:200px;">
            <label style="display:block; font-size:11px; font-weight:700; margin-bottom:4px; color:#475569;">CATATAN / FEEDBACK GURU (OPSIONAL)</label>
            <input type="text" id="grade-note-${j.jawaban_id}" class="form-control" value="${j.catatan_guru ? j.catatan_guru.replace(/"/g, '&quot;') : ''}" placeholder="Catatan evaluasi untuk siswa...">
          </div>
          <div>
            <button class="btn btn-primary" onclick="submitGrade(${j.jawaban_id}, ${ujianId}, ${j.soal_bobot})" style="padding:10px 18px; font-weight:600;">
              💾 Simpan Nilai
            </button>
          </div>
        </div>
      </div>
    `;
  });
}
    .catch(err => {
      container.innerHTML = `<p style="color:var(--danger); text-align:center; padding:20px;">Gagal memuat jawaban essay: ${err.message}</p>`;
    });
}

function submitGrade(jawabanId, ujianId, maxBobot) {
  const inputEl = document.getElementById(`grade-input-${jawabanId}`);
  const noteEl = document.getElementById(`grade-note-${jawabanId}`);
  const val = inputEl ? inputEl.value.trim() : '';
  const note = noteEl ? noteEl.value.trim() : '';

  if (val === "" || isNaN(val)) {
    showToast("Harap masukkan nilai angka yang valid!");
    if (inputEl) inputEl.focus();
    return;
  }

  const numVal = parseFloat(val);
  if (numVal < 0 || numVal > maxBobot) {
    showToast(`Nilai harus di antara 0 dan ${maxBobot}!`);
    if (inputEl) inputEl.focus();
    return;
  }

  fetch('/api/guru/nilai-essay/grade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jawaban_id: jawabanId,
      nilai: numVal,
      catatan_guru: note
    })
  })
  .then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.message || "Gagal menyimpan nilai"); });
    return res.json();
  })
  .then(res => {
    showToast(res.message || "Nilai essay berhasil disimpan!");
    loadEssayAnswers(ujianId);
  })
  .catch(err => {
    showToast("Error: " + err.message);
  });
}

// REKAP & ANALISIS PAGE
function loadRekapPage() {
  fetch('/api/guru/ujian')
    .then(res => res.json())
    .then(list => {
      const select = document.getElementById("rekap-select-ujian");
      select.innerHTML = '<option value="">-- Pilih Sesi Ujian --</option>';
      list.forEach(u => select.innerHTML += `<option value="${u.id}">${u.nama_ujian} (${u.nama_kelas})</option>`);
      
      const cards = document.getElementById("rekap-summary-cards");
      if (cards) cards.style.display = "none";
      const kkmEl = document.getElementById("rekap-kkm-info");
      if (kkmEl) kkmEl.innerText = "KKM: -";
      document.getElementById("rekap-table-body").innerHTML = `<tr><td colspan="9" style="text-align:center; padding:25px; color:var(--text-light);">Silakan pilih sesi ujian untuk melihat rekapitulasi nilai.</td></tr>`;
    })
    .catch(err => showToast("Gagal memuat ujian: " + err.message));
}

function loadRekapNilai(ujianId) {
  if (!ujianId) {
    stateRekapList = [];
    stateRekapCertMap = {};
    const cards = document.getElementById("rekap-summary-cards");
    if (cards) cards.style.display = "none";
    document.getElementById("rekap-table-body").innerHTML = `<tr><td colspan="10" style="text-align:center; padding:25px; color:var(--text-light);">Silakan pilih sesi ujian untuk melihat rekapitulasi nilai.</td></tr>`;
    return;
  }

  const tbody = document.getElementById("rekap-table-body");
  tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:25px; color:var(--text-light);">Memuat rekapitulasi nilai...</td></tr>`;

  // 1. Fetch Class Aggregate Analytics
  fetch(`/api/guru/analisis-kelas/${ujianId}`)
    .then(res => res.json())
    .then(analytics => {
      const cards = document.getElementById("rekap-summary-cards");
      if (analytics && analytics.total_peserta > 0) {
        document.getElementById("rekap-stat-mean").innerText = analytics.mean ?? '-';
        document.getElementById("rekap-stat-highest").innerText = analytics.highest ?? '-';
        document.getElementById("rekap-stat-lowest").innerText = analytics.lowest ?? '-';
        document.getElementById("rekap-stat-passing").innerText = (analytics.passing_rate ?? 0) + '%';
        if (cards) cards.style.display = "grid";
      } else {
        if (cards) cards.style.display = "none";
      }
    })
    .catch(() => {
      const cards = document.getElementById("rekap-summary-cards");
      if (cards) cards.style.display = "none";
    });

  // 2. Fetch Student Recap Table and Certificates simultaneously
  Promise.all([
    fetch(`/api/guru/rekap-nilai/${ujianId}`).then(res => res.json()),
    fetch(`/api/guru/sertifikat/ujian/${ujianId}`).then(res => res.json()).catch(() => ({ data: [] }))
  ])
    .then(([list, certRes]) => {
      stateRekapList = list || [];
      const certs = (certRes && certRes.data) || [];
      stateRekapCertMap = {};
      certs.forEach(c => {
        stateRekapCertMap[c.siswa_id] = c;
      });

      if (list && list.length > 0) {
        const kkm = list[0].kkm ?? 75;
        const kkmEl = document.getElementById("rekap-kkm-info");
        if (kkmEl) kkmEl.innerText = `KKM: ${kkm}`;
      }

      filterRekapTable();
    })
    .catch(err => {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:25px; color:var(--danger);">Gagal memuat rekap: ${err.message}</td></tr>`;
    });
}

function filterRekapTable() {
  const q = (document.getElementById("filter-rekap-search")?.value || "").toLowerCase().trim();
  const st = (document.getElementById("filter-rekap-status")?.value || "").toUpperCase().trim();

  const filtered = stateRekapList.filter(r => {
    const matchQ = !q || (r.nis || "").toLowerCase().includes(q) || (r.nama_siswa || "").toLowerCase().includes(q) || (r.nama_kelas || "").toLowerCase().includes(q);
    const matchSt = !st || (r.status_kelulusan || "").toUpperCase() === st;
    return matchQ && matchSt;
  });

  renderRekapTable(filtered);
}

function renderRekapTable(list) {
  const tbody = document.getElementById("rekap-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:25px; color:var(--text-light);">Tidak ada peserta yang cocok.</td></tr>`;
    return;
  }

  list.forEach((r, idx) => {
    let statusBadge = '<span class="badge badge-warning">PENDING</span>';
    if (r.status_kelulusan === 'LULUS') {
      statusBadge = '<span class="badge badge-success">✓ LULUS</span>';
    } else if (r.status_kelulusan === 'REMIDI') {
      statusBadge = '<span class="badge badge-danger">✗ REMIDI</span>';
    }

    let certAction = `<span style="color:var(--text-light); font-size:12px;">-</span>`;
    if (r.status_kelulusan === 'LULUS') {
      const existingCert = stateRekapCertMap[r.siswa_id];
      if (existingCert) {
        certAction = `
          <button class="btn btn-secondary" onclick="openPrintCert('${existingCert.certificate_number}')" style="font-size:11px; padding:3px 8px; font-weight:600;">
            📜 Cetak
          </button>
        `;
      } else {
        certAction = `
          <button class="btn btn-primary" onclick="issueSingleCert(${r.ujian_id}, ${r.siswa_id})" style="font-size:11px; padding:3px 8px; font-weight:600;">
            📜 Terbitkan
          </button>
        `;
      }
    }

    tbody.innerHTML += `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${r.nis}</strong></td>
        <td>${r.nama_siswa}</td>
        <td>${r.nama_kelas}</td>
        <td>
          <span style="color:var(--success); font-weight:700;">${r.jumlah_benar} Benar</span> / 
          <span style="color:var(--danger); font-weight:700;">${r.jumlah_salah} Salah</span>
        </td>
        <td>${r.nilai_pg !== null && r.nilai_pg !== undefined ? r.nilai_pg : '-'}</td>
        <td>${r.nilai_essay !== null && r.nilai_essay !== undefined ? r.nilai_essay : '<i style="color:var(--text-light);">-</i>'}</td>
        <td><strong style="color:var(--primary); font-size:15px;">${r.nilai_akhir}</strong></td>
        <td>${statusBadge}</td>
        <td style="text-align:center;">${certAction}</td>
      </tr>
    `;
  });
}

function exportRecapCSV() {
  const ujianId = document.getElementById("rekap-select-ujian").value;
  if (!ujianId) {
    showToast("Silakan pilih sesi ujian terlebih dahulu untuk mengekspor rekap!");
    return;
  }

  showToast("Menyiapkan berkas CSV...");
  fetch(`/api/guru/rekap-nilai/${ujianId}/export?format=csv`)
    .then(res => {
      if (!res.ok) throw new Error("Gagal mengunduh berkas rekapitulasi.");
      return res.blob();
    })
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rekap_nilai_ujian_${ujianId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast("Unduhan berkas CSV berhasil!");
    })
    .catch(err => {
      showToast("Gagal ekspor CSV: " + err.message);
    });
}

function openItemAnalysisModal() {
  const ujianId = document.getElementById("rekap-select-ujian").value;
  if (!ujianId) {
    showToast("Pilih sesi ujian terlebih dahulu untuk melihat analisis butir soal!");
    return;
  }

  openModal('item-analysis-modal');
  const tbody = document.getElementById("item-analysis-table-body");
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:25px; color:var(--text-light);">Menganalisis data psikometrik butir soal...</td></tr>`;

  fetch(`/api/guru/analisis-soal/${ujianId}`)
    .then(res => res.json())
    .then(items => {
      tbody.innerHTML = "";
      if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:25px; color:var(--text-light);">Belum ada data respons siswa untuk dianalisis.</td></tr>`;
        return;
      }

      items.forEach((it, idx) => {
        // Kesukaran badge
        let pBadge = '-';
        if (it.tingkat_kesukaran) {
          const k = it.tingkat_kesukaran.kategori;
          const bg = k === 'Mudah' ? 'badge-success' : (k === 'Sedang' ? 'badge-info' : 'badge-danger');
          pBadge = `<strong>${it.tingkat_kesukaran.index}</strong> <span class="badge ${bg}">${k}</span>`;
        }

        // Pembeda badge
        let dBadge = '-';
        if (it.daya_pembeda) {
          const k = it.daya_pembeda.kategori;
          const bg = k === 'Sangat Baik' ? 'badge-success' : (k === 'Baik' ? 'badge-info' : (k === 'Cukup' ? 'badge-warning' : 'badge-danger'));
          dBadge = `<strong>${it.daya_pembeda.index}</strong> <span class="badge ${bg}">${k}</span>`;
        }

        // Distractor pills
        let distractorHtml = '';
        if (it.distractor_efficiency && it.distractor_efficiency.length > 0) {
          distractorHtml = '<div style="display:flex; gap:4px; flex-wrap:wrap;">';
          it.distractor_efficiency.forEach(opt => {
            const isKey = opt.is_kunci;
            const borderCol = isKey ? '#10B981' : '#CBD5E1';
            const bgCol = isKey ? 'rgba(16, 185, 129, 0.1)' : '#F8FAFC';
            distractorHtml += `
              <span style="font-size:11px; padding:2px 6px; border:1px solid ${borderCol}; background:${bgCol}; border-radius:4px;" title="${opt.teks_pilihan}">
                <strong>${opt.label}${isKey ? '★' : ''}</strong>: ${opt.count} (${opt.percentage}%)
              </span>
            `;
          });
          distractorHtml += '</div>';
        } else {
          distractorHtml = '<i style="color:var(--text-light); font-size:12px;">Essay / Belum ada data</i>';
        }

        // Status Butir / Rekomendasi
        let recBadge = '<span class="badge badge-info">-</span>';
        if (it.rekomendasi) {
          const bg = it.rekomendasi === 'Diterima' ? 'badge-success' : (it.rekomendasi === 'Direvisi' ? 'badge-warning' : 'badge-danger');
          recBadge = `<span class="badge ${bg}">${it.rekomendasi}</span>`;
        }

        tbody.innerHTML += `
          <tr>
            <td>${idx + 1}</td>
            <td><span class="badge ${it.jenis_soal === 'PG' ? 'badge-primary' : 'badge-info'}">${it.jenis_soal}</span></td>
            <td style="max-width:240px; font-size:12.5px;">${it.teks_soal}</td>
            <td>${pBadge}</td>
            <td>${dBadge}</td>
            <td>${distractorHtml}</td>
            <td>${recBadge}</td>
          </tr>
        `;
      });
    })
    .catch(err => {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:25px; color:var(--danger);">Gagal memuat analisis butir soal: ${err.message}</td></tr>`;
    });
}

// ADMIN LOGIC & DASHBOARD OVERVIEW
function loadDashboardAdmin() {
  Promise.all([
    fetch('/api/admin/siswa').then(r => r.json()).catch(() => []),
    fetch('/api/admin/guru').then(r => r.json()).catch(() => []),
    fetch('/api/admin/kelas').then(r => r.json()).catch(() => []),
    fetch('/api/admin/mapel').then(r => r.json()).catch(() => [])
  ]).then(([siswaList, guruList, kelasList, mapelList]) => {
    document.getElementById("admin-stat-siswa").innerText = (siswaList || []).length;
    document.getElementById("admin-stat-guru").innerText = (guruList || []).length;
    document.getElementById("admin-stat-kelas").innerText = (kelasList || []).length;
    document.getElementById("admin-stat-mapel").innerText = (mapelList || []).length;

    // Render Overview Kelas Body
    const kelasBody = document.getElementById("admin-dashboard-kelas-body");
    if (kelasBody) {
      kelasBody.innerHTML = "";
      if (!kelasList || kelasList.length === 0) {
        kelasBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:15px; color:var(--text-light);">Belum ada kelas terdaftar.</td></tr>`;
      } else {
        kelasList.forEach(k => {
          kelasBody.innerHTML += `
            <tr>
              <td><strong>${k.nama_kelas}</strong></td>
              <td><span class="badge badge-info">${k.total_siswa || 0} Siswa</span></td>
              <td>${k.total_mapel || 0} Mapel</td>
              <td>${k.total_guru || 0} Guru</td>
              <td style="text-align:center;">
                <button class="btn btn-secondary" style="font-size:11px; padding:3px 8px;" onclick="openDetailKelasModal(${k.id})">👁️ Detail</button>
              </td>
            </tr>
          `;
        });
      }
    }

    // Render Overview Guru Body
    const guruBody = document.getElementById("admin-dashboard-guru-body");
    if (guruBody) {
      guruBody.innerHTML = "";
      if (!guruList || guruList.length === 0) {
        guruBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:15px; color:var(--text-light);">Belum ada guru terdaftar.</td></tr>`;
      } else {
        guruList.forEach(g => {
          let penempatanHtml = `<i style="color:var(--text-light); font-size:12px;">Belum ditugaskan</i>`;
          if (g.assignments && g.assignments.length > 0) {
            penempatanHtml = g.assignments.map(a => `<span class="badge badge-info" style="margin:2px; font-size:10.5px;">${a.nama_kelas} - ${a.nama_mapel}</span>`).join(' ');
          }
          guruBody.innerHTML += `
            <tr>
              <td><strong>${g.nip}</strong></td>
              <td>${g.nama}</td>
              <td>${penempatanHtml}</td>
              <td style="text-align:center;">
                <button class="btn btn-secondary" style="font-size:11px; padding:3px 8px;" onclick="openDetailGuruModal(${g.id})">👁️ Detail</button>
              </td>
            </tr>
          `;
        });
      }
    }
  });
}

function loadMasterSiswaPage() {
  fetch('/api/admin/kelas')
    .then(res => res.json())
    .then(list => {
      const select = document.getElementById("siswa-kelas");
      if (select) {
        select.innerHTML = "";
        (list || []).forEach(k => select.innerHTML += `<option value="${k.id}">${k.nama_kelas}</option>`);
      }
      const filterSelect = document.getElementById("filter-siswa-kelas");
      if (filterSelect) {
        filterSelect.innerHTML = `<option value="">Semua Kelas</option>`;
        (list || []).forEach(k => filterSelect.innerHTML += `<option value="${k.nama_kelas}">${k.nama_kelas}</option>`);
      }
    });
  loadStudentsTable();
}

function loadStudentsTable() {
  fetch('/api/admin/siswa')
    .then(res => res.json())
    .then(list => {
      stateSiswaList = list || [];
      filterMasterSiswaTable();
    });
}

function filterMasterSiswaTable() {
  const q = (document.getElementById("filter-siswa-search")?.value || "").toLowerCase().trim();
  const kelas = (document.getElementById("filter-siswa-kelas")?.value || "").toLowerCase().trim();

  const filtered = stateSiswaList.filter(s => {
    const matchQ = !q || (s.nis || "").toLowerCase().includes(q) || (s.nama || "").toLowerCase().includes(q);
    const matchKelas = !kelas || (s.nama_kelas || "").toLowerCase().includes(kelas);
    return matchQ && matchKelas;
  });

  renderStudentsTable(filtered);
}

function renderStudentsTable(list) {
  const tbody = document.getElementById("student-list-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-light);">Tidak ada data siswa yang cocok.</td></tr>`;
    return;
  }
  list.forEach(s => {
    tbody.innerHTML += `
      <tr>
        <td>${s.id}</td>
        <td><strong>${s.nis}</strong></td>
        <td>${s.nama}</td>
        <td><span class="badge badge-info">${s.nama_kelas || '-'}</span></td>
        <td><span class="badge badge-success">Aktif</span></td>
        <td style="text-align:center;">
          <button class="btn btn-secondary" onclick="openDetailSiswaModal(${s.id})" style="padding: 3px 7px; font-size:11.5px;">👁️ Detail</button>
          <button class="btn btn-secondary" onclick="printSingleStudentCard(${s.id})" style="padding: 3px 7px; font-size:11.5px;">🪪 Kartu</button>
          <button class="btn btn-danger" onclick="deleteSiswa(${s.id})" style="padding: 3px 7px; font-size:11.5px;">🗑️ Hapus</button>
        </td>
      </tr>
    `;
  });
}

function handleAddSiswa() {
  const nis = document.getElementById("siswa-nis").value.trim();
  const nama = document.getElementById("siswa-nama").value.trim();
  const kelas_id = document.getElementById("siswa-kelas").value;
  const password = document.getElementById("siswa-password").value.trim();

  if (!nis || !nama) {
    showToast("NIS dan Nama Siswa wajib diisi!");
    return;
  }

  fetch('/api/admin/siswa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nis, nama, kelas_id, password })
  })
  .then(res => res.json())
  .then(res => {
    showToast("✓ " + (res.message || "Siswa berhasil didaftarkan!"));
    document.getElementById("siswa-nis").value = "";
    document.getElementById("siswa-nama").value = "";
    document.getElementById("siswa-password").value = "";
    loadStudentsTable();
  });
}

function deleteSiswa(id) {
  if (confirm("Apakah Anda yakin ingin menghapus siswa ini beserta akunnya?")) {
    fetch(`/api/admin/siswa/${id}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(res => {
        showToast("✓ " + (res.message || "Siswa berhasil dihapus!"));
        loadStudentsTable();
      });
  }
}

function loadMasterKelasPage() {
  fetch('/api/admin/kelas')
    .then(res => res.json())
    .then(list => {
      stateKelasList = list || [];
      filterMasterKelasTable();
    });
}

function filterMasterKelasTable() {
  const q = (document.getElementById("filter-kelas-search")?.value || "").toLowerCase().trim();
  const filtered = stateKelasList.filter(k => !q || (k.nama_kelas || "").toLowerCase().includes(q));
  renderMasterKelasTable(filtered);
}

function renderMasterKelasTable(list) {
  const tbody = document.getElementById("class-list-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-light);">Tidak ada data kelas yang cocok.</td></tr>`;
    return;
  }
  list.forEach(k => {
    tbody.innerHTML += `
      <tr>
        <td>${k.id}</td>
        <td><strong>${k.nama_kelas}</strong></td>
        <td><span class="badge badge-info">${k.total_siswa || 0} Siswa</span></td>
        <td style="text-align:center;">
          <button class="btn btn-secondary" onclick="openDetailKelasModal(${k.id})" style="font-size:11.5px; padding:3px 7px;">
            👁️ Detail Kelas
          </button>
          <button class="btn btn-secondary" onclick="printClassCards(${k.id})" style="font-size:11.5px; padding:3px 7px;">
            🪪 Kartu Kelas
          </button>
          <button class="btn btn-danger" onclick="deleteKelas(${k.id})" style="font-size:11.5px; padding:3px 7px;">
            🗑️ Hapus
          </button>
        </td>
      </tr>
    `;
  });
}

function handleAddKelas() {
  const nama = document.getElementById("kelas-nama").value.trim();
  if (!nama) {
    showToast("Nama kelas wajib diisi!");
    return;
  }

  fetch('/api/admin/kelas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama_kelas: nama })
  })
  .then(res => res.json())
  .then(res => {
    showToast("✓ " + (res.message || "Kelas berhasil dibuat!"));
    document.getElementById("kelas-nama").value = "";
    loadMasterKelasPage();
  });
}

function deleteKelas(id) {
  if (confirm("Apakah Anda yakin ingin menghapus kelas ini?")) {
    fetch(`/api/admin/kelas/${id}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(res => {
        showToast("✓ " + (res.message || "Kelas berhasil dihapus!"));
        loadMasterKelasPage();
      });
  }
}

function loadMasterMapelPage() {
  fetch('/api/admin/mapel')
    .then(res => res.json())
    .then(list => {
      stateMapelList = list || [];
      filterMasterMapelTable();
    });
}

function filterMasterMapelTable() {
  const q = (document.getElementById("filter-mapel-search")?.value || "").toLowerCase().trim();
  const filtered = stateMapelList.filter(m => !q || (m.kode_mapel || "").toLowerCase().includes(q) || (m.nama_mapel || "").toLowerCase().includes(q));
  renderMasterMapelTable(filtered);
}

function renderMasterMapelTable(list) {
  const tbody = document.getElementById("mapel-list-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-light);">Tidak ada data mata pelajaran yang cocok.</td></tr>`;
    return;
  }
  list.forEach(m => {
    tbody.innerHTML += `
      <tr>
        <td>${m.id}</td>
        <td><span class="badge badge-info">${m.kode_mapel}</span></td>
        <td><strong>${m.nama_mapel}</strong></td>
        <td style="text-align:center;">
          <button class="btn btn-secondary" onclick="openDetailMapelModal(${m.id})" style="font-size:11.5px; padding:3px 7px;">
            👁️ Detail
          </button>
          <button class="btn btn-danger" onclick="deleteMapel(${m.id})" style="font-size:11.5px; padding:3px 7px;">
            🗑️ Hapus
          </button>
        </td>
      </tr>
    `;
  });
}

function handleAddMapel() {
  const kode = document.getElementById("mapel-kode").value.trim().toUpperCase();
  const nama = document.getElementById("mapel-nama").value.trim();

  if (!kode || !nama) {
    showToast("Kode dan Nama Mapel wajib diisi!");
    return;
  }

  fetch('/api/admin/mapel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kode_mapel: kode, nama_mapel: nama })
  })
  .then(res => res.json())
  .then(res => {
    showToast("✓ " + (res.message || "Mapel berhasil disimpan!"));
    document.getElementById("mapel-kode").value = "";
    document.getElementById("mapel-nama").value = "";
    loadMasterMapelPage();
  });
}

function deleteMapel(id) {
  if (confirm("Apakah Anda yakin ingin menghapus mata pelajaran ini?")) {
    fetch(`/api/admin/mapel/${id}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(res => {
        showToast("✓ " + (res.message || "Mata pelajaran berhasil dihapus!"));
        loadMasterMapelPage();
      });
  }
}

// ==========================================
// DETAIL MODAL LOGIC FOR GURU, SISWA, KELAS, MAPEL
// ==========================================

function openDetailKelasModal(kelasId) {
  fetch(`/api/admin/kelas/${kelasId}`)
    .then(res => res.json())
    .then(k => {
      document.getElementById("detail-kelas-title").innerText = `🏫 Detail Kelas: ${k.nama_kelas}`;
      
      const badgesContainer = document.getElementById("detail-kelas-header-badges");
      badgesContainer.innerHTML = `
        <span class="badge badge-info">Tingkat: ${k.tingkat || 'XII'}</span>
        <span class="badge badge-info">Jurusan: ${k.jurusan || 'Umum'}</span>
        <span class="badge badge-info">Tahun Ajaran: ${k.tahun_ajaran || '2025/2026'}</span>
        <span class="badge badge-success">Status: ${k.status || 'aktif'}</span>
        <span class="badge badge-primary">Total Siswa: ${k.total_siswa || 0}</span>
      `;

      document.getElementById("detail-kelas-cnt-siswa").innerText = (k.siswa_list || []).length;
      document.getElementById("detail-kelas-cnt-guru").innerText = (k.penempatan_guru || []).length;
      document.getElementById("detail-kelas-cnt-mapel").innerText = (k.mapel_list || []).length;

      // Render Tab Siswa
      const siswaBody = document.getElementById("detail-kelas-siswa-body");
      siswaBody.innerHTML = "";
      if (!k.siswa_list || k.siswa_list.length === 0) {
        siswaBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:15px; color:var(--text-light);">Belum ada siswa di kelas ini.</td></tr>`;
      } else {
        k.siswa_list.forEach((s, idx) => {
          siswaBody.innerHTML += `
            <tr>
              <td>${idx + 1}</td>
              <td><strong>${s.nis}</strong></td>
              <td>${s.nama}</td>
              <td>${s.email || '-'}</td>
              <td><span class="badge badge-success">${s.status}</span></td>
            </tr>
          `;
        });
      }

      // Render Tab Guru
      const guruBody = document.getElementById("detail-kelas-guru-body");
      guruBody.innerHTML = "";
      if (!k.penempatan_guru || k.penempatan_guru.length === 0) {
        guruBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:15px; color:var(--text-light);">Belum ada guru pengampu di kelas ini.</td></tr>`;
      } else {
        k.penempatan_guru.forEach((g, idx) => {
          guruBody.innerHTML += `
            <tr>
              <td>${idx + 1}</td>
              <td><strong>${g.nip}</strong></td>
              <td>${g.nama_guru}</td>
              <td><span class="badge badge-info">${g.nama_mapel} (${g.kode_mapel})</span></td>
            </tr>
          `;
        });
      }

      // Render Tab Mapel
      const mapelBody = document.getElementById("detail-kelas-mapel-body");
      mapelBody.innerHTML = "";
      if (!k.mapel_list || k.mapel_list.length === 0) {
        mapelBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:15px; color:var(--text-light);">Belum ada mata pelajaran terdaftar.</td></tr>`;
      } else {
        k.mapel_list.forEach((m, idx) => {
          mapelBody.innerHTML += `
            <tr>
              <td>${idx + 1}</td>
              <td><span class="badge badge-info">${m.kode_mapel}</span></td>
              <td><strong>${m.nama_mapel}</strong></td>
            </tr>
          `;
        });
      }

      switchDetailKelasTab('siswa');
      openModal('modal-detail-kelas');
    })
    .catch(err => showToast("Gagal memuat detail kelas: " + err.message));
}

function switchDetailKelasTab(tab) {
  document.getElementById("detail-kelas-tab-siswa").style.display = tab === 'siswa' ? 'block' : 'none';
  document.getElementById("detail-kelas-tab-guru").style.display = tab === 'guru' ? 'block' : 'none';
  document.getElementById("detail-kelas-tab-mapel").style.display = tab === 'mapel' ? 'block' : 'none';

  document.getElementById("tab-kelas-siswa-btn").style.background = tab === 'siswa' ? 'var(--primary)' : 'transparent';
  document.getElementById("tab-kelas-siswa-btn").style.color = tab === 'siswa' ? 'white' : 'var(--text)';

  document.getElementById("tab-kelas-guru-btn").style.background = tab === 'guru' ? 'var(--primary)' : 'transparent';
  document.getElementById("tab-kelas-guru-btn").style.color = tab === 'guru' ? 'white' : 'var(--text)';

  document.getElementById("tab-kelas-mapel-btn").style.background = tab === 'mapel' ? 'var(--primary)' : 'transparent';
  document.getElementById("tab-kelas-mapel-btn").style.color = tab === 'mapel' ? 'white' : 'var(--text)';
}

function openDetailGuruModal(guruId) {
  fetch(`/api/admin/guru/${guruId}`)
    .then(res => res.json())
    .then(g => {
      document.getElementById("detail-guru-title").innerText = `👨‍🏫 Detail Profil Guru: ${g.nama}`;

      const infoBox = document.getElementById("detail-guru-info-box");
      infoBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <h4 style="margin:0 0 4px 0; font-size:16px; color:var(--text);">${g.nama}</h4>
            <span style="font-size:13px; color:var(--text-light);">NIP: <strong>${g.nip}</strong> | Username: <strong>${g.username || g.nip}</strong></span>
            <div style="font-size:12px; color:var(--text-light); margin-top:4px;">Email: ${g.email || '-'}</div>
          </div>
          <span class="badge badge-success" style="font-size:12px; padding:4px 10px;">${g.status || 'aktif'}</span>
        </div>
      `;

      const assignBox = document.getElementById("detail-guru-assignments-box");
      if (!g.assignments || g.assignments.length === 0) {
        assignBox.innerHTML = `<i style="color:var(--text-light); font-size:13px;">Belum ada penempatan kelas & mata pelajaran.</i>`;
      } else {
        assignBox.innerHTML = g.assignments.map(a => `
          <div style="display:inline-flex; align-items:center; gap:6px; background:white; border:1px solid var(--border); padding:6px 12px; border-radius:8px; margin:4px;">
            <strong style="color:var(--primary); font-size:13px;">${a.nama_kelas}</strong>
            <span style="color:var(--text-light);">➔</span>
            <span style="font-size:13px;">${a.nama_mapel} (${a.kode_mapel})</span>
          </div>
        `).join('');
      }

      const soalBody = document.getElementById("detail-guru-soal-body");
      soalBody.innerHTML = "";
      const bankList = g.bank_soal_list || [];
      if (bankList.length === 0) {
        soalBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:15px; color:var(--text-light);">Belum ada bank soal atau ujian yang dibuat.</td></tr>`;
      } else {
        bankList.forEach(b => {
          soalBody.innerHTML += `
            <tr>
              <td><strong>${b.judul}</strong></td>
              <td>${b.nama_kelas || '-'}</td>
              <td>${b.nama_mapel || '-'}</td>
              <td><span class="badge badge-info">${b.total_soal || 0} Soal</span></td>
            </tr>
          `;
        });
      }

      openModal('modal-detail-guru');
    })
    .catch(err => showToast("Gagal memuat detail guru: " + err.message));
}

function openDetailSiswaModal(siswaId) {
  fetch(`/api/admin/siswa/${siswaId}`)
    .then(res => res.json())
    .then(s => {
      document.getElementById("detail-siswa-title").innerText = `👨‍🎓 Detail Profil Siswa: ${s.nama}`;

      const infoBox = document.getElementById("detail-siswa-info-box");
      infoBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <h4 style="margin:0 0 4px 0; font-size:16px; color:var(--text);">${s.nama}</h4>
            <span style="font-size:13px; color:var(--text-light);">NIS: <strong>${s.nis}</strong> | Kelas: <strong style="color:var(--primary);">${s.nama_kelas || '-'}</strong></span>
            <div style="font-size:12px; color:var(--text-light); margin-top:4px;">Email: ${s.email || '-'}</div>
          </div>
          <span class="badge badge-success" style="font-size:12px; padding:4px 10px;">${s.status || 'aktif'}</span>
        </div>
      `;

      const hasilBody = document.getElementById("detail-siswa-hasil-body");
      hasilBody.innerHTML = "";
      const list = s.hasil_ujian_list || [];
      if (list.length === 0) {
        hasilBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:15px; color:var(--text-light);">Belum ada riwayat ujian yang diikuti.</td></tr>`;
      } else {
        list.forEach(h => {
          let badge = '<span class="badge badge-warning">PENDING</span>';
          if (h.status_kelulusan === 'LULUS') badge = '<span class="badge badge-success">✓ LULUS</span>';
          if (h.status_kelulusan === 'REMIDI') badge = '<span class="badge badge-danger">✗ REMIDI</span>';

          hasilBody.innerHTML += `
            <tr>
              <td><strong>${h.nama_ujian}</strong></td>
              <td>${h.nilai_pg ?? '-'}</td>
              <td>${h.nilai_essay ?? '-'}</td>
              <td><strong style="color:var(--primary);">${h.nilai_akhir}</strong></td>
              <td>${badge}</td>
            </tr>
          `;
        });
      }

      openModal('modal-detail-siswa');
    })
    .catch(err => showToast("Gagal memuat detail siswa: " + err.message));
}

function openDetailMapelModal(mapelId) {
  fetch(`/api/admin/mapel/${mapelId}`)
    .then(res => res.json())
    .then(m => {
      document.getElementById("detail-mapel-title").innerText = `📖 Detail Mapel: ${m.nama_mapel}`;

      const infoBox = document.getElementById("detail-mapel-info-box");
      infoBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <h4 style="margin:0 0 4px 0; font-size:16px; color:var(--text);">${m.nama_mapel}</h4>
            <span style="font-size:13px; color:var(--text-light);">Kode Mapel: <strong>${m.kode_mapel}</strong></span>
          </div>
          <span class="badge badge-success" style="font-size:12px; padding:4px 10px;">${m.status || 'aktif'}</span>
        </div>
      `;

      const guruBody = document.getElementById("detail-mapel-guru-body");
      guruBody.innerHTML = "";
      const list = m.guru_list || [];
      if (list.length === 0) {
        guruBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:15px; color:var(--text-light);">Belum ada kelas/guru yang menggunakan mapel ini.</td></tr>`;
      } else {
        list.forEach(g => {
          guruBody.innerHTML += `
            <tr>
              <td><strong style="color:var(--primary);">${g.nama_kelas}</strong></td>
              <td>${g.nama}</td>
              <td>${g.nip}</td>
            </tr>
          `;
        });
      }

      openModal('modal-detail-mapel');
    })
    .catch(err => showToast("Gagal memuat detail mapel: " + err.message));
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

// ==========================================
// PHASE 8: KARTU PESERTA & SERTIFIKAT DIGITAL
// ==========================================

/**
 * Guru / Admin: Terbitkan sertifikat kelulusan untuk 1 siswa
 */
function issueSingleCert(ujianId, siswaId) {
  showToast("Menerbitkan sertifikat digital...");
  fetch('/api/guru/sertifikat/issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ujian_id: ujianId, siswa_id: siswaId })
  })
    .then(res => res.json())
    .then(json => {
      if (json.status === 'success') {
        showToast("Sertifikat berhasil diterbitkan!");
        loadRekapNilai(ujianId);
      } else {
        showToast("Gagal: " + (json.message || "Terjadi kesalahan"));
      }
    })
    .catch(err => showToast("Error: " + err.message));
}

/**
 * Guru / Admin: Terbitkan sertifikat kelulusan massal untuk semua siswa yang LULUS
 */
function issueAllPassedCertificates() {
  const ujianId = document.getElementById("rekap-select-ujian").value;
  if (!ujianId) {
    showToast("Silakan pilih sesi ujian terlebih dahulu!");
    return;
  }

  showToast("Menerbitkan sertifikat massal untuk seluruh peserta lulus...");
  fetch('/api/guru/sertifikat/issue-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ujian_id: ujianId })
  })
    .then(res => res.json())
    .then(json => {
      if (json.status === 'success') {
        showToast(json.message || "Penerbitan sertifikat selesai!");
        loadRekapNilai(ujianId);
      } else {
        showToast("Gagal: " + (json.message || "Terjadi kesalahan"));
      }
    })
    .catch(err => showToast("Error: " + err.message));
}

/**
 * Buka layout cetak sertifikat di tab baru
 */
function openPrintCert(certNumber) {
  if (!certNumber) return;
  window.open(`/sertifikat/print/${encodeURIComponent(certNumber)}`, '_blank');
}

/**
 * Cetak kartu ujian 1 siswa (Admin / Guru)
 */
function printSingleStudentCard(siswaId) {
  if (!siswaId) return;
  window.open(`/kartu-ujian/print/${siswaId}`, '_blank');
}

/**
 * Cetak massal kartu ujian sekelas (Admin / Guru)
 */
function printClassCards(kelasId) {
  if (!kelasId) return;
  window.open(`/api/guru/kartu-ujian/kelas/${kelasId}/print`, '_blank');
}

/**
 * Siswa: Buka modal pratinjau kartu tanda peserta ujian
 */
function openStudentCardModal() {
  openModal('modal-student-card');
  const preview = document.getElementById("student-card-preview-content");
  preview.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-light);"><div class="spinner" style="margin:0 auto 10px auto;"></div>Memuat data kartu ujian...</div>`;

  fetch('/api/siswa/kartu-ujian')
    .then(res => res.json())
    .then(json => {
      if (json.status !== 'success' || !json.data) {
        throw new Error(json.message || "Gagal memuat data kartu");
      }
      const c = json.data;
      const examItems = c.jadwal_ujian && c.jadwal_ujian.length > 0
        ? c.jadwal_ujian.map(ex => `
            <li style="margin-bottom:4px; font-size:12px;">
              <strong>${ex.nama_mapel}</strong> - ${ex.nama_ujian} (${ex.durasi_menit} mnt)
            </li>
          `).join('')
        : `<li style="font-size:12px; color:var(--text-light); font-style:italic;">Tidak ada ujian terjadwal</li>`;

      preview.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1.5px solid var(--border); padding-bottom:10px; margin-bottom:12px;">
          <div>
            <h4 style="font-size:14px; font-weight:800; color:var(--primary);">KARTU TANDA PESERTA CBT</h4>
            <div style="font-family:monospace; font-weight:700; color:#1e3a8a; font-size:13px;">${c.no_peserta}</div>
          </div>
          <span class="badge badge-info" style="font-size:10px;">${c.tahun_ajaran}</span>
        </div>

        <div style="display:flex; gap:14px; align-items:center;">
          <div style="text-align:center;">
            <img src="${c.qr_data_url}" alt="QR Code" style="width:100px; height:100px; border-radius:8px; border:1px solid var(--border); display:block;">
            <span style="font-size:9px; font-weight:700; color:var(--text-light); margin-top:3px; display:block;">SCAN VALIDASI</span>
          </div>
          <div style="flex:1; font-size:13px; line-height:1.5;">
            <div><span style="color:var(--text-light); display:inline-block; width:80px;">Nama</span>: <strong>${c.nama}</strong></div>
            <div><span style="color:var(--text-light); display:inline-block; width:80px;">NIS</span>: <code>${c.nis}</code></div>
            <div><span style="color:var(--text-light); display:inline-block; width:80px;">Kelas</span>: ${c.kelas}</div>
            <div><span style="color:var(--text-light); display:inline-block; width:80px;">Ruang/Sesi</span>: ${c.ruang} / ${c.sesi}</div>
          </div>
        </div>

        <div style="margin-top:14px; padding-top:10px; border-top:1px dashed var(--border);">
          <strong style="font-size:12px; color:#1e3a8a;">Daftar Ujian Terdaftar:</strong>
          <ul style="padding-left:18px; margin-top:4px;">
            ${examItems}
          </ul>
        </div>
      `;
    })
    .catch(err => {
      preview.innerHTML = `<div style="text-align:center; padding:20px; color:var(--danger);">Gagal memuat kartu: ${err.message}</div>`;
    });
}

/**
 * Siswa: Cetak kartu ujian siswa yang sedang aktif
 */
function printMyCard() {
  window.open('/api/siswa/kartu-ujian/print', '_blank');
}

/**
 * Siswa: Buka daftar sertifikat kelulusan siswa
 */
function openStudentCertificatesModal() {
  openModal('modal-student-certs');
  const tbody = document.getElementById("student-certs-table-body");
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px;">Memuat sertifikat kelulusan...</td></tr>`;

  fetch('/api/siswa/sertifikat')
    .then(res => res.json())
    .then(json => {
      const list = json.data || [];
      tbody.innerHTML = "";
      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:25px; color:var(--text-light);">Belum ada sertifikat kelulusan yang diterbitkan. Tingkatkan nilai ujian Anda untuk meraih sertifikat!</td></tr>`;
        return;
      }

      list.forEach(c => {
        const dateStr = new Date(c.issued_at).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
        tbody.innerHTML += `
          <tr>
            <td><code style="font-size:12px; color:var(--primary); font-weight:700;">${c.certificate_number}</code></td>
            <td><strong>${c.nama_mapel}</strong><br><span style="font-size:11px; color:var(--text-light);">${c.nama_ujian}</span></td>
            <td><strong style="color:var(--success); font-size:14px;">${c.nilai_akhir}</strong> <span style="font-size:11px; color:var(--text-light);">(KKM ${c.kkm})</span></td>
            <td>${dateStr}</td>
            <td style="text-align:center; white-space:nowrap;">
              <button class="btn btn-secondary" onclick="openPrintCert('${c.certificate_number}')" style="font-size:11px; padding:3px 8px; margin-right:4px;">
                🖨️ Cetak
              </button>
              <a href="${c.verify_url}" target="_blank" class="btn btn-primary" style="font-size:11px; padding:3px 8px; text-decoration:none;">
                🔍 Verifikasi
              </a>
            </td>
          </tr>
        `;
      });
    })
    .catch(err => {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--danger);">Gagal memuat sertifikat: ${err.message}</td></tr>`;
    });
}

/**
 * Siswa: Cetak sertifikat terbaru setelah menyelesaikan ujian dengan status LULUS
 */
function openStudentLatestCert() {
  showToast("Menyiapkan sertifikat kelulusan...");
  fetch('/api/siswa/sertifikat')
    .then(res => res.json())
    .then(json => {
      const list = json.data || [];
      if (list.length > 0) {
        // Ambil yang paling baru
        const latest = list[0];
        openPrintCert(latest.certificate_number);
      } else {
        showToast("Sertifikat belum diterbitkan oleh guru/panitia.");
      }
    })
    .catch(err => showToast("Error: " + err.message));
}

// ==========================================
// PHASE 9: PROFILE & AVATAR MANAGEMENT
// ==========================================

let userProfileData = null;

function renderAvatarElement(containerId, initialId, avatarUrl, fallbackInitial) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (avatarUrl) {
    container.innerHTML = `<img src="${avatarUrl}?t=${Date.now()}" style="width:100%; height:100%; object-fit:cover; border-radius:50%; display:block;" alt="Avatar">`;
  } else {
    container.innerHTML = `<span id="${initialId}">${fallbackInitial || 'U'}</span>`;
  }
}

function fetchAndRenderUserProfile() {
  fetch('/api/profile')
    .then(res => {
      if (!res.ok) throw new Error("Gagal mengambil data profil");
      return res.json();
    })
    .then(json => {
      if (json.status === 'success' && json.data) {
        userProfileData = json.data;
        const initial = json.data.fallback_initial || 'U';
        const avatar = json.data.avatar;

        // 1. Sidebar avatar (Admin & Guru)
        renderAvatarElement('sidebar-avatar-container', 'sidebar-avatar-initial', avatar, initial);

        // 2. Student dashboard avatar
        renderAvatarElement('siswa-avatar-container', 'siswa-avatar-initial', avatar, initial);

        // 3. Name & Sub text updates
        if (document.getElementById("user-display-name")) {
          document.getElementById("user-display-name").innerText = json.data.nama || json.data.username;
        }
        if (document.getElementById("siswa-name-display") && json.data.role === 'siswa') {
          document.getElementById("siswa-name-display").innerText = json.data.nama || json.data.username;
        }
      }
    })
    .catch(err => {
      console.warn("Notice: Gagal memuat profil pengguna:", err.message);
    });
}

function openUserProfileModal() {
  openModal('modal-user-profile');
  switchProfileTab('info');

  fetch('/api/profile')
    .then(res => res.json())
    .then(json => {
      if (json.status === 'success' && json.data) {
        userProfileData = json.data;
        const p = json.data;

        // Render avatar preview
        renderAvatarElement('profile-modal-avatar-preview', 'profile-modal-avatar-initial', p.avatar, p.fallback_initial);

        // Details header
        document.getElementById('profile-modal-display-name').innerText = p.nama || p.username;
        document.getElementById('profile-modal-display-role').innerText = (p.role || 'user').toUpperCase();

        // Form Info inputs
        document.getElementById('profile-input-nama').value = p.nama || '';
        document.getElementById('profile-input-email').value = p.email || '';

        const extraGroup = document.getElementById('profile-group-nisnip');
        const extraLabel = document.getElementById('profile-label-extra');
        const extraInput = document.getElementById('profile-input-extra');

        if (p.role === 'siswa') {
          extraGroup.style.display = 'block';
          extraLabel.innerText = 'Nomor Induk Siswa (NIS) & Kelas';
          extraInput.value = `${p.nis || '-'} (Kelas: ${p.nama_kelas || '-'})`;
        } else if (p.role === 'guru') {
          extraGroup.style.display = 'block';
          extraLabel.innerText = 'Nomor Induk Pegawai (NIP)';
          extraInput.value = p.nip || '-';
        } else {
          extraGroup.style.display = 'block';
          extraLabel.innerText = 'Role';
          extraInput.value = 'Super Administrator';
        }

        // Show/hide delete button depending on whether avatar exists
        const btnDelete = document.getElementById('btn-delete-avatar');
        if (btnDelete) {
          btnDelete.style.display = p.avatar ? 'inline-block' : 'none';
        }
      }
    })
    .catch(err => {
      showToast('Gagal memuat profil: ' + err.message);
    });
}

function switchProfileTab(tabName) {
  const tabInfo = document.getElementById('profile-tab-info');
  const tabPwd = document.getElementById('profile-tab-password');
  const btnInfo = document.getElementById('tab-btn-info');
  const btnPwd = document.getElementById('tab-btn-password');

  if (tabName === 'info') {
    tabInfo.style.display = 'block';
    tabPwd.style.display = 'none';
    btnInfo.style.background = 'var(--primary)';
    btnInfo.style.color = 'white';
    btnPwd.style.background = 'transparent';
    btnPwd.style.color = 'var(--text)';
  } else {
    tabInfo.style.display = 'none';
    tabPwd.style.display = 'block';
    btnPwd.style.background = 'var(--primary)';
    btnPwd.style.color = 'white';
    btnInfo.style.background = 'transparent';
    btnInfo.style.color = 'var(--text)';
  }
}

function handleAvatarFileSelect(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  // Client-side early validation: max 2MB
  const maxBytes = 2 * 1024 * 1024;
  if (file.size > maxBytes) {
    showToast(`Ukuran berkas terlalu besar (${(file.size / (1024 * 1024)).toFixed(2)} MB). Maksimal 2 MB!`);
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64Data = e.target.result;
    showToast('Mengunggah foto profil...');

    fetch('/api/profile/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_data: base64Data })
    })
      .then(res => res.json())
      .then(json => {
        if (json.status === 'success') {
          showToast(json.message || 'Foto profil berhasil diperbarui!');
          fetchAndRenderUserProfile();
          // Update preview in modal
          renderAvatarElement('profile-modal-avatar-preview', 'profile-modal-avatar-initial', json.data.avatar, json.data.fallback_initial);
          const btnDelete = document.getElementById('btn-delete-avatar');
          if (btnDelete) btnDelete.style.display = 'inline-block';
        } else {
          showToast('Gagal mengunggah: ' + (json.message || 'Format tidak didukung'));
        }
      })
      .catch(err => {
        showToast('Error upload avatar: ' + err.message);
      })
      .finally(() => {
        event.target.value = '';
      });
  };
  reader.readAsDataURL(file);
}

function handleDeleteAvatar() {
  if (!confirm('Apakah Anda yakin ingin menghapus foto profil dan kembali menggunakan inisial?')) return;

  showToast('Menghapus foto profil...');
  fetch('/api/profile/avatar', {
    method: 'DELETE'
  })
    .then(res => res.json())
    .then(json => {
      if (json.status === 'success') {
        showToast(json.message || 'Foto profil dihapus');
        fetchAndRenderUserProfile();
        renderAvatarElement('profile-modal-avatar-preview', 'profile-modal-avatar-initial', null, json.data ? json.data.fallback_initial : 'U');
        const btnDelete = document.getElementById('btn-delete-avatar');
        if (btnDelete) btnDelete.style.display = 'none';
      } else {
        showToast('Gagal: ' + (json.message || 'Terjadi kesalahan'));
      }
    })
    .catch(err => {
      showToast('Error: ' + err.message);
    });
}

function handleSaveProfile(event) {
  event.preventDefault();
  const nama = document.getElementById('profile-input-nama').value.trim();
  const email = document.getElementById('profile-input-email').value.trim();

  if (!nama) {
    showToast('Nama lengkap tidak boleh kosong!');
    return;
  }

  const btn = document.getElementById('btn-save-profile');
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Menyimpan...';
  }

  fetch('/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama, email })
  })
    .then(res => res.json())
    .then(json => {
      if (json.status === 'success') {
        showToast('Profil berhasil disimpan!');
        fetchAndRenderUserProfile();
        closeModal('modal-user-profile');
      } else {
        showToast('Gagal memperbarui profil: ' + (json.message || 'Error validasi'));
      }
    })
    .catch(err => {
      showToast('Error: ' + err.message);
    })
    .finally(() => {
      if (btn) {
        btn.disabled = false;
        btn.innerText = 'Simpan Perubahan';
      }
    });
}

function handleChangePassword(event) {
  event.preventDefault();
  const currentPassword = document.getElementById('profile-input-current-pwd').value;
  const newPassword = document.getElementById('profile-input-new-pwd').value;
  const confirmPassword = document.getElementById('profile-input-confirm-pwd').value;

  if (!currentPassword || !newPassword) {
    showToast('Harap lengkapi semua kolom kata sandi!');
    return;
  }

  if (newPassword.length < 6) {
    showToast('Kata sandi baru minimal harus 6 karakter!');
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast('Konfirmasi kata sandi tidak cocok!');
    return;
  }

  const btn = document.getElementById('btn-change-pwd');
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Memproses...';
  }

  fetch('/api/profile/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword
    })
  })
    .then(res => res.json())
    .then(json => {
      if (json.status === 'success') {
        showToast(json.message || 'Kata sandi berhasil diubah!');
        document.getElementById('profile-input-current-pwd').value = '';
        document.getElementById('profile-input-new-pwd').value = '';
        document.getElementById('profile-input-confirm-pwd').value = '';
        closeModal('modal-user-profile');
      } else {
        showToast('Gagal: ' + (json.message || 'Password lama salah'));
      }
    })
    .catch(err => {
      showToast('Error: ' + err.message);
    })
    .finally(() => {
      if (btn) {
        btn.disabled = false;
        btn.innerText = 'Ubah Password';
      }
    });
}

// ==============================================================
// PHASE 10: THEME SYSTEM, ACCESSIBILITY & NOTIFICATION ENGINE
// ==============================================================

let currentTheme = localStorage.getItem('cbt_theme') || 'system';
let currentFontScale = localStorage.getItem('cbt_font_scale') || 'normal';
let isHighContrast = localStorage.getItem('cbt_high_contrast') === 'true';
let notificationPollTimer = null;
let currentNotifications = [];

function applyInitialTheme() {
  applyTheme(currentTheme, isHighContrast);
  applyExamFontScale(currentFontScale);
}

function resolveSystemTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Listen to OS theme changes if set to system
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (currentTheme === 'system') {
      applyTheme('system', isHighContrast);
    }
  });
}

function applyTheme(theme, contrast) {
  const actualTheme = theme === 'system' ? resolveSystemTheme() : theme;
  document.documentElement.setAttribute('data-theme', actualTheme);
  document.documentElement.setAttribute('data-contrast', contrast ? 'high' : 'normal');

  // Update dropdown selects if they exist
  const appSelect = document.getElementById('app-theme-select');
  if (appSelect) appSelect.value = theme;

  const siswaSelect = document.getElementById('siswa-theme-select');
  if (siswaSelect) siswaSelect.value = theme;

  // Update contrast buttons
  const btnContrastApp = document.getElementById('btn-high-contrast-app');
  if (btnContrastApp) {
    btnContrastApp.style.borderColor = contrast ? 'var(--primary)' : 'var(--border)';
    btnContrastApp.style.backgroundColor = contrast ? 'rgba(37,99,235,0.15)' : '';
  }

  const btnContrastSiswa = document.getElementById('btn-high-contrast-siswa');
  if (btnContrastSiswa) {
    btnContrastSiswa.style.borderColor = contrast ? 'var(--primary)' : 'var(--border)';
    btnContrastSiswa.style.backgroundColor = contrast ? 'rgba(37,99,235,0.15)' : '';
  }
}

function setUserTheme(theme) {
  if (!['light', 'dark', 'system'].includes(theme)) return;
  currentTheme = theme;
  localStorage.setItem('cbt_theme', theme);
  applyTheme(currentTheme, isHighContrast);

  // Sync to server if logged in
  const token = localStorage.getItem('cbt_token');
  if (token) {
    fetch('/api/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: theme })
    }).catch(() => {});
  }
}

function toggleHighContrast() {
  isHighContrast = !isHighContrast;
  localStorage.setItem('cbt_high_contrast', isHighContrast.toString());
  applyTheme(currentTheme, isHighContrast);
  showToast(isHighContrast ? 'Mode Kontras Tinggi diaktifkan' : 'Mode Kontras Normal diaktifkan');

  // Sync to server if logged in
  const token = localStorage.getItem('cbt_token');
  if (token) {
    fetch('/api/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ high_contrast: isHighContrast ? 1 : 0 })
    }).catch(() => {});
  }
}

function initUserPreferences() {
  const token = localStorage.getItem('cbt_token');
  if (!token) {
    applyInitialTheme();
    return;
  }

  fetch('/api/preferences')
    .then(res => res.json())
    .then(json => {
      if (json.status === 'success' && json.data) {
        const pref = json.data;
        if (pref.theme) {
          currentTheme = pref.theme;
          localStorage.setItem('cbt_theme', currentTheme);
        }
        if (pref.font_scale) {
          currentFontScale = pref.font_scale;
          localStorage.setItem('cbt_font_scale', currentFontScale);
        }
        if (pref.high_contrast !== undefined) {
          isHighContrast = Boolean(pref.high_contrast);
          localStorage.setItem('cbt_high_contrast', isHighContrast.toString());
        }
        applyTheme(currentTheme, isHighContrast);
        applyExamFontScale(currentFontScale);
      }
    })
    .catch(() => {
      applyInitialTheme();
    });
}

// --------------------------------------------------------------
// EXAM ACCESSIBILITY & TEXT ZOOM
// --------------------------------------------------------------

const SCALE_LEVELS = ['normal', 'medium', 'large'];

function applyExamFontScale(scale) {
  if (!SCALE_LEVELS.includes(scale)) scale = 'normal';
  currentFontScale = scale;
  localStorage.setItem('cbt_font_scale', scale);

  const examPage = document.getElementById('siswa-page-exam');
  if (examPage) {
    examPage.classList.remove('font-scale-normal', 'font-scale-medium', 'font-scale-large');
    examPage.classList.add(`font-scale-${scale}`);
  }
}

function changeExamFontSize(delta) {
  let idx = SCALE_LEVELS.indexOf(currentFontScale);
  if (idx === -1) idx = 0;

  idx += delta;
  if (idx < 0) idx = 0;
  if (idx >= SCALE_LEVELS.length) idx = SCALE_LEVELS.length - 1;

  const newScale = SCALE_LEVELS[idx];
  applyExamFontScale(newScale);

  const token = localStorage.getItem('cbt_token');
  if (token) {
    fetch('/api/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ font_scale: newScale })
    }).catch(() => {});
  }
}

function resetExamFontSize() {
  applyExamFontScale('normal');
  const token = localStorage.getItem('cbt_token');
  if (token) {
    fetch('/api/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ font_scale: 'normal' })
    }).catch(() => {});
  }
}

// --------------------------------------------------------------
// IN-APP NOTIFICATION ENGINE
// --------------------------------------------------------------

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Baru saja';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} jam lalu`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} hari lalu`;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function getNotificationIcon(type) {
  switch (type) {
    case 'success': return '✅';
    case 'warning': return '⚠️';
    case 'danger': return '🚨';
    case 'info':
    default:
      return '🔔';
  }
}

function fetchNotifications() {
  const token = localStorage.getItem('cbt_token');
  if (!token) return;

  Promise.all([
    fetch('/api/notifications?limit=25').then(r => r.json()).catch(() => null),
    fetch('/api/notifications/unread-count').then(r => r.json()).catch(() => null)
  ]).then(([listRes, unreadRes]) => {
    if (listRes && listRes.status === 'success') {
      currentNotifications = listRes.data || [];
      renderNotifications();
    }
    if (unreadRes && unreadRes.status === 'success') {
      const count = unreadRes.data?.unread_count || 0;
      updateNotificationBadges(count);
    }
  });
}

function updateNotificationBadges(count) {
  const appBadge = document.getElementById('app-notif-badge');
  const siswaBadge = document.getElementById('siswa-notif-badge');

  const text = count > 9 ? '9+' : `${count}`;
  const display = count > 0 ? 'inline-block' : 'none';

  if (appBadge) {
    appBadge.innerText = text;
    appBadge.style.display = display;
  }
  if (siswaBadge) {
    siswaBadge.innerText = text;
    siswaBadge.style.display = display;
  }
}

function renderNotifications() {
  const appList = document.getElementById('app-notif-list');
  const siswaList = document.getElementById('siswa-notif-list');

  const html = currentNotifications.length === 0
    ? `<div style="text-align:center; padding:20px; font-size:12px; color:var(--text-light);">Tidak ada notifikasi</div>`
    : currentNotifications.map(n => `
        <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="markNotificationAsRead(${n.id})">
          <div class="notif-item-title">
            <span>${getNotificationIcon(n.type)} ${n.title}</span>
            <span class="notif-item-time">${formatRelativeTime(n.created_at)}</span>
          </div>
          <div class="notif-item-msg">${n.message}</div>
        </div>
      `).join('');

  if (appList) appList.innerHTML = html;
  if (siswaList) siswaList.innerHTML = html;
}

function toggleNotificationDropdown(prefix) {
  const targetId = `${prefix}-notif-dropdown`;
  const otherId = prefix === 'app' ? 'siswa-notif-dropdown' : 'app-notif-dropdown';

  const otherEl = document.getElementById(otherId);
  if (otherEl) otherEl.style.display = 'none';

  const el = document.getElementById(targetId);
  if (el) {
    const isShowing = el.style.display === 'block';
    el.style.display = isShowing ? 'none' : 'block';
    if (!isShowing) {
      fetchNotifications();
    }
  }
}

function markNotificationAsRead(id) {
  fetch(`/api/notifications/${id}/read`, { method: 'PUT' })
    .then(r => r.json())
    .then(json => {
      if (json.status === 'success') {
        const item = currentNotifications.find(n => n.id === id);
        if (item) item.is_read = 1;
        renderNotifications();
        // Update unread count
        fetch('/api/notifications/unread-count')
          .then(r => r.json())
          .then(res => {
            if (res.status === 'success') {
              updateNotificationBadges(res.data?.unread_count || 0);
            }
          });
      }
    })
    .catch(() => {});
}

function markAllNotificationsAsRead() {
  fetch('/api/notifications/read-all', { method: 'PUT' })
    .then(r => r.json())
    .then(json => {
      if (json.status === 'success') {
        currentNotifications.forEach(n => n.is_read = 1);
        renderNotifications();
        updateNotificationBadges(0);
        showToast('Semua notifikasi telah ditandai dibaca.');
      }
    })
    .catch(() => {});
}

function startNotificationPolling() {
  fetchNotifications();
  if (!notificationPollTimer) {
    notificationPollTimer = setInterval(fetchNotifications, 30000);
  }
}

function stopNotificationPolling() {
  if (notificationPollTimer) {
    clearInterval(notificationPollTimer);
    notificationPollTimer = null;
  }
}

// Close dropdowns on outside click
document.addEventListener('click', (e) => {
  if (!e.target.closest('.notif-dropdown-menu') && !e.target.closest('button[title*="Notifikasi"]') && !e.target.closest('button[title*="Pemberitahuan"]')) {
    const appDrop = document.getElementById('app-notif-dropdown');
    const siswaDrop = document.getElementById('siswa-notif-dropdown');
    if (appDrop) appDrop.style.display = 'none';
    if (siswaDrop) siswaDrop.style.display = 'none';
  }
});

// ==========================================
// MASTER GURU & PENEMPATAN WORKSPACE LOGIC
// ==========================================

let currentGuruAssignments = [];
let activeAssignGuruId = null;

function loadMasterGuruPage() {
  fetch('/api/admin/kelas').then(r => r.json()).then(kelasList => {
    const sel = document.getElementById("filter-guru-kelas");
    if (sel) {
      sel.innerHTML = `<option value="">Semua Kelas Penempatan</option>`;
      (kelasList || []).forEach(k => sel.innerHTML += `<option value="${k.nama_kelas}">${k.nama_kelas}</option>`);
    }
  }).catch(() => {});

  fetch('/api/admin/guru')
    .then(res => res.json())
    .then(data => {
      stateGuruList = data || [];
      filterMasterGuruTable();
    })
    .catch(err => {
      showToast("Gagal memuat data guru: " + err.message);
    });
}

function filterMasterGuruTable() {
  const q = (document.getElementById("filter-guru-search")?.value || "").toLowerCase().trim();
  const kelas = (document.getElementById("filter-guru-kelas")?.value || "").toLowerCase().trim();

  const filtered = stateGuruList.filter(g => {
    const matchQ = !q || (g.nip || "").toLowerCase().includes(q) || (g.nama || "").toLowerCase().includes(q) || (g.email || "").toLowerCase().includes(q);
    let matchKelas = true;
    if (kelas) {
      matchKelas = g.assignments && g.assignments.some(a => (a.nama_kelas || "").toLowerCase().includes(kelas));
    }
    return matchQ && matchKelas;
  });

  renderMasterGuruTable(filtered);
}

function renderMasterGuruTable(data) {
  const tbody = document.getElementById("guru-list-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-light);">Tidak ada data guru yang cocok.</td></tr>`;
    return;
  }

  data.forEach(g => {
    let penempatanHtml = `<span style="font-size:12px; color:var(--text-light); font-style:italic;">Belum ditugaskan</span>`;
    if (g.assignments && g.assignments.length > 0) {
      penempatanHtml = g.assignments.map(a => 
        `<span class="badge badge-info" style="margin:2px; display:inline-block;">${a.nama_kelas} ➔ ${a.nama_mapel}</span>`
      ).join(' ');
    }

    tbody.innerHTML += `
      <tr>
        <td>${g.id}</td>
        <td><strong>${g.nip}</strong></td>
        <td>${g.nama}</td>
        <td>${g.email || '-'}</td>
        <td>${penempatanHtml}</td>
        <td style="text-align:center;">
          <button class="btn btn-secondary" style="padding:4px 8px; font-size:12px;" onclick="openDetailGuruModal(${g.id})">👁️ Detail</button>
          <button class="btn btn-secondary" style="padding:4px 8px; font-size:12px;" onclick="openAssignGuruModal(${g.id}, '${g.nama}')">🎯 Penempatan</button>
          <button class="btn btn-danger" style="padding:4px 8px; font-size:12px;" onclick="handleDeleteGuru(${g.id})">🗑️ Hapus</button>
        </td>
      </tr>
    `;
  });
}

function handleAddGuru() {
  const nip = document.getElementById("guru-nip").value.trim();
  const nama = document.getElementById("guru-nama").value.trim();
  const email = document.getElementById("guru-email").value.trim();
  const password = document.getElementById("guru-password").value.trim();

  if (!nip || !nama) {
    showToast("NIP dan Nama Guru wajib diisi!");
    return;
  }

  fetch('/api/admin/guru', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nip, nama, email, password })
  })
  .then(res => res.json())
  .then(res => {
    if (res.message) {
      showToast("✓ " + res.message);
      document.getElementById("guru-nip").value = "";
      document.getElementById("guru-nama").value = "";
      document.getElementById("guru-email").value = "";
      document.getElementById("guru-password").value = "";
      loadMasterGuruPage();
    } else {
      showToast(res.message || "Gagal menambahkan guru!");
    }
  })
  .catch(err => showToast("Error: " + err.message));
}

function openAssignGuruModal(guruId, guruNama) {
  activeAssignGuruId = guruId;
  document.getElementById("assign-guru-id").value = guruId;
  document.getElementById("assign-guru-subtitle").innerText = `Penempatan Kelas & Mapel untuk: ${guruNama}`;

  Promise.all([
    fetch(`/api/admin/guru/${guruId}`).then(r => r.json()),
    fetch('/api/admin/kelas').then(r => r.json()),
    fetch('/api/admin/mapel').then(r => r.json())
  ]).then(([guruRes, kelasList, mapelList]) => {
    const guru = guruRes;
    currentGuruAssignments = (guru && guru.assignments) ? guru.assignments.map(a => ({ kelas_id: a.kelas_id, mapel_id: a.mapel_id, nama_kelas: a.nama_kelas, nama_mapel: a.nama_mapel })) : [];

    // Populate Selects
    const kelasSelect = document.getElementById("assign-select-kelas");
    const mapelSelect = document.getElementById("assign-select-mapel");
    kelasSelect.innerHTML = (kelasList || []).map(k => `<option value="${k.id}">${k.nama_kelas}</option>`).join('');
    mapelSelect.innerHTML = (mapelList || []).map(m => `<option value="${m.id}">${m.nama_mapel} (${m.kode_mapel})</option>`).join('');

    renderAssignTable();
    openModal('modal-assign-guru');
  });
}

function renderAssignTable() {
  const tbody = document.getElementById("assign-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (currentGuruAssignments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:15px; color:var(--text-light);">Belum ada penempatan</td></tr>`;
    return;
  }

  currentGuruAssignments.forEach((a, index) => {
    tbody.innerHTML += `
      <tr>
        <td><strong>${a.nama_kelas}</strong></td>
        <td>${a.nama_mapel}</td>
        <td style="text-align:center;">
          <button class="btn btn-danger" style="padding:2px 8px; font-size:11px;" onclick="removeAssignmentRow(${index})">✕</button>
        </td>
      </tr>
    `;
  });
}

function addAssignmentRow() {
  const kelasSelect = document.getElementById("assign-select-kelas");
  const mapelSelect = document.getElementById("assign-select-mapel");

  if (!kelasSelect.value || !mapelSelect.value) return;

  const kelas_id = parseInt(kelasSelect.value);
  const mapel_id = parseInt(mapelSelect.value);
  const nama_kelas = kelasSelect.options[kelasSelect.selectedIndex].text;
  const nama_mapel = mapelSelect.options[mapelSelect.selectedIndex].text;

  const exists = currentGuruAssignments.some(a => a.kelas_id === kelas_id && a.mapel_id === mapel_id);
  if (exists) {
    showToast("Penempatan ini sudah ada di daftar!");
    return;
  }

  currentGuruAssignments.push({ kelas_id, mapel_id, nama_kelas, nama_mapel });
  renderAssignTable();
}

function removeAssignmentRow(index) {
  currentGuruAssignments.splice(index, 1);
  renderAssignTable();
}

function handleSaveGuruAssignments() {
  if (!activeAssignGuruId) return;

  fetch(`/api/admin/guru/${activeAssignGuruId}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignments: currentGuruAssignments })
  })
  .then(res => res.json())
  .then(res => {
    showToast("✓ " + (res.message || "Penempatan berhasil disimpan!"));
    closeModal('modal-assign-guru');
    loadMasterGuruPage();
  })
  .catch(err => showToast("Error: " + err.message));
}

function handleDeleteGuru(guruId) {
  if (!confirm("Apakah Anda yakin ingin menghapus data guru ini beserta akunnya?")) return;

  fetch(`/api/admin/guru/${guruId}`, { method: 'DELETE' })
    .then(res => res.json())
    .then(res => {
      showToast("✓ " + (res.message || "Guru berhasil dihapus!"));
      loadMasterGuruPage();
    })
    .catch(err => showToast("Error: " + err.message));
}

function loadWorkspaceGuruPage() {
  fetch('/api/guru/workspace')
    .then(res => res.json())
    .then(data => {
      const container = document.getElementById("guru-workspace-cards-container");
      if (!container) return;
      container.innerHTML = "";

      const assignments = data.assignments || [];
      if (assignments.length === 0) {
        container.innerHTML = `<p style="color:var(--text-light); text-align:center; grid-column:1/-1; padding:30px;">Anda belum ditugaskan di kelas/mata pelajaran manapun oleh Administrator.</p>`;
        return;
      }

      assignments.forEach(a => {
        container.innerHTML += `
          <div class="stat-card" style="border-left:4px solid var(--primary); background:white;">
            <span style="font-size:11px; text-transform:uppercase; color:var(--primary); font-weight:700;">KELAS & MAPEL</span>
            <h3 style="font-size:18px; margin:4px 0;">${a.nama_kelas}</h3>
            <p style="font-size:13.5px; color:var(--text-light); margin-bottom:12px;">📖 ${a.nama_mapel} (${a.kode_mapel})</p>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-secondary" style="flex:1; font-size:11px; padding:6px;" onclick="showPage('soal')">📝 Bank Soal</button>
              <button class="btn btn-primary" style="flex:1; font-size:11px; padding:6px;" onclick="showPage('ujian')">🚀 Rilis Ujian</button>
            </div>
          </div>
        `;
      });
    })
    .catch(err => showToast("Gagal memuat workspace: " + err.message));
}


