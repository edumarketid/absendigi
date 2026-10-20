// SUPABASE CLIENT INITIALIZATION (Pusat Kendali via localStorage)
const DEFAULT_SUPABASE_URL = "https://nbwpnhshhpfqtmbwewgk.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5id3BuaHNoaHBmcXRtYndld2drIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MTQ1ODUsImV4cCI6MjEwNzk5MDU4NX0.2Ah6o8svWPMDEI1O3zOxytNyqBIjED7GXTxowNm1Ai4";

// Simpan kunci bawaan ke localStorage jika belum pernah diset
if (!localStorage.getItem("SUPABASE_URL")) {
  localStorage.setItem("SUPABASE_URL", DEFAULT_SUPABASE_URL);
}
if (!localStorage.getItem("SUPABASE_ANON_KEY")) {
  localStorage.setItem("SUPABASE_ANON_KEY", DEFAULT_SUPABASE_ANON_KEY);
}

const SUPABASE_URL = localStorage.getItem("SUPABASE_URL");
const SUPABASE_ANON_KEY = localStorage.getItem("SUPABASE_ANON_KEY");
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let html5QrCode = null, isCameraActive = false, db = null, cachedStudents = [];
let fetchedTodayAttendance = [], fetchedAttendanceHistory = [], fetchedTindakLanjutHistory = [], fetchedHariLiburList = [];
let parsedBatchStudents = [];
let currentScanSession = "PAGI", myPieChart = null, myBarChart = null;
let isManualTimeMode = false;
let customScanDateOverride = null;
let customScanTimeOverride = null;
let currentUserRole = "PETUGAS"; 
let isProcessingScan = false;
let currentTLTab = "pending"; 
let activeCameraFacingMode = "environment";

const DAYS_LIST = [
  { key: "sun", label: "Minggu (Ekstrakurikuler)" },
  { key: "mon", label: "Senin" },
  { key: "tue", label: "Selasa" },
  { key: "wed", label: "Rabu" },
  { key: "thu", label: "Kamis" },
  { key: "fri", label: "Jumat" },
  { key: "sat", label: "Sabtu" }
];

const DEFAULT_TIME_CONFIGS = {
  sun: { active: false, pStart: "06:00", pLimit: "07:25", sStart: "12:00", sLimit: "13:45" },
  mon: { active: true,  pStart: "06:00", pLimit: "07:25", sStart: "12:00", sLimit: "13:45" },
  tue: { active: true,  pStart: "06:00", pLimit: "07:25", sStart: "12:00", sLimit: "13:45" },
  wed: { active: true,  pStart: "06:00", pLimit: "07:25", sStart: "12:00", sLimit: "13:45" },
  thu: { active: true,  pStart: "06:00", pLimit: "07:25", sStart: "12:00", sLimit: "13:45" },
  fri: { active: true,  pStart: "06:00", pLimit: "07:25", sStart: "10:00", sLimit: "11:45" },
  sat: { active: true,  pStart: "06:00", pLimit: "07:25", sStart: "12:00", sLimit: "13:45" }
};

function playBeepSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); 
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15); 
  } catch(e) {}
}

function padZeroTime(timeStr) {
  if (!timeStr || typeof timeStr !== "string" || timeStr.trim() === "" || timeStr === "undefined" || timeStr === "null") return "00:00";
  var clean = timeStr.trim();
  var match = clean.match(/\d{1,2}:\d{2}/);
  if (match) {
    var parts = match[0].split(":");
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    if (isNaN(h) || h > 23 || h < 0) h = 0;
    if (isNaN(m) || m > 59 || m < 0) m = 0;
    var hStr = h < 10 ? "0" + h : "" + h;
    var mStr = m < 10 ? "0" + m : "" + m;
    return hStr + ":" + mStr;
  }
  return "00:00";
}

function parseBool(val, defaultVal = false) {
  if (val === null || val === undefined || val === "") return defaultVal;
  if (typeof val === "boolean") return val;
  const str = String(val).trim().toLowerCase();
  if (str === "true") return true;
  if (str === "false") return false;
  return defaultVal;
}

function formatCleanDateLocal(val) {
  if (!val) return "";
  const str = String(val).trim();
  const match = str.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : str;
}

function bukaHalamanLaporan() { window.open("./laporan.html", "_blank"); }
function bukaHalamanCetakQR() { window.open("./kartuqrcode.html", "_blank"); }

function showLoginModal() { document.getElementById("login-modal").classList.remove("hidden"); }
function hideLoginModal() { document.getElementById("login-modal").classList.add("hidden"); }

function handleRoleBadgeClick() {
  if (currentUserRole === "ADMIN") {
    if (confirm("Keluar dari Mode Admin dan kembali menjadi Petugas?")) {
      switchToPetugasRole();
    }
  } else {
    showLoginModal();
  }
}

function switchToPetugasRole() {
  currentUserRole = "PETUGAS";
  localStorage.setItem("USER_ROLE", "PETUGAS");
  updateRoleUI();
  alert("Kembali ke mode Petugas.");
}

async function processAdminLogin() {
  const pass = document.getElementById("admin-pass-input").value;
  if (!pass) return alert("Masukkan password admin!");

  try {
    const { data, error } = await supabaseClient
      .from('pengaturan')
      .select('nilai')
      .eq('kunci', 'ADMIN_PASSWORD')
      .maybeSingle();

    const storedPassword = data ? data.nilai : "123456";

    if (pass === storedPassword) {
      currentUserRole = "ADMIN";
      localStorage.setItem("USER_ROLE", "ADMIN");
      document.getElementById("admin-pass-input").value = "";
      updateRoleUI();
      hideLoginModal();
      alert("Login Admin Berhasil!");
    } else {
      alert("Password Salah!");
    }
  } catch (e) {
    alert("Gagal memverifikasi password admin!");
  }
}

function updateRoleUI() {
  const badge = document.getElementById("app-role-badge");
  const statusText = document.getElementById("menu-role-status-text");

  if (currentUserRole === "ADMIN") {
    badge.innerText = "ADMIN (LOGOUT)";
    badge.className = "text-[10px] font-bold text-emerald-300 bg-emerald-950/60 px-1.5 py-0.2 rounded-md border border-emerald-500/30 cursor-pointer select-none";
    if (statusText) {
      statusText.innerText = "MODE ADMIN";
      statusText.className = "text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800";
    }
  } else {
    badge.innerText = "PETUGAS";
    badge.className = "text-[10px] font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.2 rounded-md border border-amber-500/30 cursor-pointer select-none";
    if (statusText) {
      statusText.innerText = "MODE PETUGAS";
      statusText.className = "text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800";
    }
  }
  renderMenuModalGrid();
}

function renderMenuModalGrid() {
  const grid = document.getElementById("menu-grid-box");
  if (!grid) return;
  const isAdmin = (currentUserRole === "ADMIN");

  const items = [
    { label: "Ibadah Siswa", icon: "fa-mosque", color: "emerald", action: "window.open('https://mengaji.smknegeri1wakatobi.sch.id', '_blank')", adminOnly: false },
        { label: "Absensi Guru", icon: "fa-chalkboard-user", color: "blue", action: "window.open('https://s.id/AbsensiGuruSMKN1Wakatobi', '_blank')", adminOnly: false },
    { label: "Unggah Kolektif", icon: "fa-file-excel", color: "emerald", action: "toggleView('upload-batch')", adminOnly: true },
    { label: "Tambah Siswa", icon: "fa-user-plus", color: "teal", action: "toggleAddStudentModal()", adminOnly: true },
    { label: "Edit Data Siswa", icon: "fa-user-pen", color: "indigo", action: "toggleView('edit-students')", adminOnly: true },
    { label: "Atur Hari Libur", icon: "fa-calendar-day", color: "amber", action: "toggleView('hari-libur')", adminOnly: true },
    { label: "Tindak Lanjut", icon: "fa-user-shield", color: "rose", action: "toggleView('tindak-lanjut')", adminOnly: true },
    { label: "Pindah/Naik Kelas", icon: "fa-graduation-cap", color: "purple", action: "toggleView('promotion')", adminOnly: true },
    { label: "Laporan Rekap", icon: "fa-file-invoice", color: "blue", action: "bukaHalamanLaporan()", adminOnly: true },
    { label: "Cetak QR Code", icon: "fa-print", color: "indigo", action: "bukaHalamanCetakQR()", adminOnly: true },
    { label: "Tentang Aplikasi", icon: "fa-circle-info", color: "teal", action: "toggleView('about')", adminOnly: false },
    { label: "Pengaturan", icon: "fa-gear", color: "purple", action: "toggleView('settings')", adminOnly: true }
  ];

  let htmlContent = items.map(item => {
    const isDisabled = item.adminOnly && !isAdmin;
    if (isDisabled) {
      return `
        <div onclick="alert('Menu khusus Admin! Silakan login admin terlebih dahulu.')" class="p-3 bg-gray-100 border border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-1.5 opacity-50 cursor-not-allowed">
          <i class="fa-solid ${item.icon} text-xl text-gray-400"></i>
          <span class="text-xs font-bold text-gray-500">${item.label}</span>
        </div>
      `;
    } else {
      return `
        <button onclick="toggleMenuModal(); ${item.action};" class="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-1.5 hover:bg-${item.color}-50 transition">
          <i class="fa-solid ${item.icon} text-xl text-${item.color}-600"></i>
          <span class="text-xs font-bold text-gray-800">${item.label}</span>
        </button>
      `;
    }
  }).join('');

  grid.innerHTML = htmlContent;
}

function initDatabase() {
  return new Promise((resolve) => {
    const req = indexedDB.open("AbsensiQR_DB", 3);
    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains("students")) database.createObjectStore("students", { keyPath: "id_siswa" });
      if (!database.objectStoreNames.contains("attendance_queue")) database.createObjectStore("attendance_queue", { keyPath: "queue_id" });
      if (!database.objectStoreNames.contains("attendance_history")) database.createObjectStore("attendance_history", { keyPath: "queue_id" });
    };
    req.onsuccess = (e) => { 
      db = e.target.result; 
      updateQueueCountUI(); 
      loadLocalHistoryToMemory();
      resolve(db); 
    };
  });
}

function getTodayTimeConfig(dateObj) {
  const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const dayKey = dayKeys[dateObj.getDay()];
  const def = DEFAULT_TIME_CONFIGS[dayKey];

  const rawActive = localStorage.getItem(`DAY_ACTIVE_${dayKey}`);
  const active = parseBool(rawActive, def.active);
  
  const rawPStart = localStorage.getItem(`TIME_${dayKey}_PAGI_START`);
  const rawPLimit = localStorage.getItem(`TIME_${dayKey}_PAGI_LIMIT`);
  const rawSStart = localStorage.getItem(`TIME_${dayKey}_SIANG_START`);
  const rawSLimit = localStorage.getItem(`TIME_${dayKey}_SIANG_LIMIT`);

  const pStart = padZeroTime(rawPStart && rawPStart.includes(":") ? rawPStart : def.pStart);
  const pLimit = padZeroTime(rawPLimit && rawPLimit.includes(":") ? rawPLimit : def.pLimit);
  const sStart = padZeroTime(rawSStart && rawSStart.includes(":") ? rawSStart : def.sStart);
  const sLimit = padZeroTime(rawSLimit && rawSLimit.includes(":") ? rawSLimit : def.sLimit);

  return { dayKey, active, pStart, pLimit, sStart, sLimit };
}

function autoDetectOrSyncSessionMode(timeStr, targetDateObj) {
  if (!targetDateObj) targetDateObj = new Date();
  const timeClean = padZeroTime(timeStr);
  const config = getTodayTimeConfig(targetDateObj);
  const textEl = document.getElementById("session-mode-text");
  const iconEl = document.getElementById("session-icon");

  if (!config.active) {
    if (textEl) textEl.innerText = "Hari Libur";
    if (iconEl) iconEl.className = "fa-solid fa-umbrella-beach text-amber-400 text-xs";
    currentScanSession = "PAGI";
    return;
  }

  if (timeClean < config.pStart) {
    if (textEl) textEl.innerText = "Belum Mulai";
    if (iconEl) iconEl.className = "fa-solid fa-hourglass-start text-amber-400 text-xs";
    currentScanSession = "PAGI";
  } else if (timeClean >= config.pStart && timeClean <= config.pLimit) {
    if (textEl) textEl.innerText = "Mode Pagi";
    if (iconEl) iconEl.className = "fa-solid fa-sun text-amber-400 text-xs";
    currentScanSession = "PAGI";
  } else if (timeClean > config.pLimit && timeClean < config.sStart) {
    if (textEl) textEl.innerText = "Terlambat";
    if (iconEl) iconEl.className = "fa-solid fa-triangle-exclamation text-amber-400 text-xs";
    currentScanSession = "PAGI";
  } else if (timeClean >= config.sStart && timeClean <= config.sLimit) {
    if (textEl) textEl.innerText = "Mode Siang";
    if (iconEl) iconEl.className = "fa-solid fa-cloud-sun text-blue-400 text-xs";
    currentScanSession = "SIANG";
  } else {
    if (textEl) textEl.innerText = "Selesai";
    if (iconEl) iconEl.className = "fa-solid fa-circle-check text-emerald-400 text-xs";
    currentScanSession = "SIANG";
  }
}

function toggleTimeModeSetting() {
  if (!isManualTimeMode) {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    const nowTimeStr = padZeroTime(d.toTimeString().split(' ')[0].substring(0, 5));
    
    const inputDate = prompt("Mode Manual: Tanggal Scan (YYYY-MM-DD):", todayStr);
    if (!inputDate || !inputDate.trim()) return;
    const inputTime = prompt("Mode Manual: Jam Scan (HH:MM):", nowTimeStr);
    if (!inputTime || !inputTime.trim()) return;

    isManualTimeMode = true;
    customScanDateOverride = formatCleanDateLocal(inputDate.trim());
    customScanTimeOverride = padZeroTime(inputTime.trim());
  } else {
    isManualTimeMode = false;
    customScanDateOverride = null;
    customScanTimeOverride = null;
  }
  
  updateTimeModeIndicator();
  refreshRealtimeSessionUI();
}

function updateTimeModeIndicator() {
  const indicator = document.getElementById("scan-mode-indicator");
  if (isManualTimeMode && customScanDateOverride && customScanTimeOverride) {
    indicator.innerText = `MANUAL (${customScanDateOverride} ${customScanTimeOverride})`;
  } else {
    indicator.innerText = "Mode Waktu: AUTO (Realtime)";
  }
}

function refreshRealtimeSessionUI() {
  let activeDateObj = new Date();
  let activeTimeStr = padZeroTime(activeDateObj.toTimeString().split(' ')[0].substring(0, 5));

  if (isManualTimeMode && customScanDateOverride && customScanTimeOverride) {
    activeDateObj = new Date(customScanDateOverride + "T00:00:00");
    activeTimeStr = customScanTimeOverride;
  }

  autoDetectOrSyncSessionMode(activeTimeStr, activeDateObj);
}

function downloadCSVTemplate() {
  const csvHeader = "ID_SISWA,NISN,NAMA_SISWA,KELAS,TTL\nS101,0081234567,Ahmad Fauzi,X TKR 1,\"Jakarta, 12 Desember 2012\"\nS102,0087654321,Siti Rahma,X TKR 1,\"Makassar, 15 Februari 2012\"\nS103,0089988776,Budi Santoso,X TKR 2,\"Wakatobi, 20 Maret 2012\"";
  const blob = new Blob([csvHeader], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", "Template_Data_Siswa.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function parseCSVLine(line) {
  const pattern = new RegExp(
    '\\s*("([^"]*(?:""[^"]*)*)"|([^,;]+)|)\\s*(?:[,;]|$)',
    'g'
  );
  const values = [];
  let match;
  while ((match = pattern.exec(line)) !== null) {
    if (match.index === pattern.lastIndex) {
      pattern.lastIndex++;
    }
    let value = match[2] !== undefined ? match[2].replace(/""/g, '"') : match[3];
    if (value !== undefined) {
      values.push(value.trim());
    }
  }
  return values;
}

function previewCSVFile() {
  const fileInput = document.getElementById('input-csv-file');
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    const lines = text.split(/\r\n|\n/);
    parsedBatchStudents = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const cols = parseCSVLine(lines[i]);

      if (cols.length >= 3 && cols[0]) {
        parsedBatchStudents.push({
          id_siswa: cols[0],
          nisn: cols[1] || "-",
          nama: cols[2] || "",
          kelas: cols[3] || "Umum",
          ttl: cols[4] || "-",
          active: true
        });
      }
    }

    const previewContainer = document.getElementById('csv-preview-container');
    const previewCount = document.getElementById('csv-preview-count');
    const previewBox = document.getElementById('csv-preview-table-box');

    if (parsedBatchStudents.length > 0) {
      previewCount.innerText = `${parsedBatchStudents.length} Siswa Terbaca`;
      previewBox.innerHTML = parsedBatchStudents.map((s, idx) => `
        <div class="p-1.5 bg-white rounded-lg border border-gray-100 flex flex-col gap-0.5">
          <div class="flex items-center justify-between">
            <b>${idx + 1}. ${s.nama}</b> 
            <span class="text-[9px] font-extrabold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded">${s.kelas}</span>
          </div>
          <div class="text-[9px] text-gray-500 flex justify-between">
            <span>ID: ${s.id_siswa} | NISN: ${s.nisn}</span>
            <span class="font-bold text-gray-700">TTL: ${s.ttl}</span>
          </div>
        </div>
      `).join('');
      previewContainer.classList.remove('hidden');
    } else {
      alert("File CSV tidak berisi data yang valid.");
      previewContainer.classList.add('hidden');
    }
  };
  reader.readAsText(file);
}

async function processBatchUploadSiswa() {
  if (parsedBatchStudents.length === 0) return alert("Belum ada data siswa yang terbaca.");

  const btn = document.getElementById('btn-process-upload-batch');
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan ${parsedBatchStudents.length} Siswa...`;

  const tx = db.transaction("students", "readwrite");
  const store = tx.objectStore("students");
  parsedBatchStudents.forEach(s => store.put(s));

  tx.oncomplete = async () => {
    loadStudentsView();
    populateClassDropdowns();

    if (navigator.onLine) {
      try {
        const mappedForSupabase = parsedBatchStudents.map(s => ({
          ID_SISWA: s.id_siswa,
          NISN: s.nisn,
          NAMA_SISWA: s.nama,
          KELAS: s.kelas,
          TTL: s.ttl,
          STATUS: s.active ? 'Aktif' : 'Non-Aktif',
          QR_CODE_KEY: s.id_siswa
        }));

        const { error } = await supabaseClient.from('siswa').upsert(mappedForSupabase);
        if (!error) {
          alert("Data siswa kolektif berhasil disimpan ke Server!");
        } else {
          alert("Gagal memperbarui Server: " + error.message);
        }
      } catch (e) {
        alert("Data tersimpan di HP secara offline.");
      }
    } else {
      alert("Data siswa tersimpan secara lokal offline di HP.");
    }

    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Simpan Data Siswa ke System`;
    document.getElementById('input-csv-file').value = "";
    document.getElementById('csv-preview-container').classList.add('hidden');
    parsedBatchStudents = [];
    toggleView('students');
  };
}

async function renderTimeSettingsSummary() {
  const container = document.getElementById("saved-time-summary-box");
  if (!container) return;

  let html = "";
  DAYS_LIST.forEach(day => {
    const def = DEFAULT_TIME_CONFIGS[day.key];
    const rawActive = localStorage.getItem(`DAY_ACTIVE_${day.key}`);
    const active = parseBool(rawActive, def.active);
    
    const rawPStart = localStorage.getItem(`TIME_${day.key}_PAGI_START`);
    const rawPLimit = localStorage.getItem(`TIME_${day.key}_PAGI_LIMIT`);
    const rawSStart = localStorage.getItem(`TIME_${day.key}_SIANG_START`);
    const rawSLimit = localStorage.getItem(`TIME_${day.key}_SIANG_LIMIT`);

    const pStart = padZeroTime(rawPStart && rawPStart.includes(":") ? rawPStart : def.pStart);
    const pLimit = padZeroTime(rawPLimit && rawPLimit.includes(":") ? rawPLimit : def.pLimit);
    const sStart = padZeroTime(rawSStart && rawSStart.includes(":") ? rawSStart : def.sStart);
    const sLimit = padZeroTime(rawSLimit && rawSLimit.includes(":") ? rawSLimit : def.sLimit);

    html += `
      <div class="p-2 bg-slate-50 border border-gray-100 rounded-xl flex items-center justify-between text-[10px]">
        <div>
          <span class="font-bold text-gray-900">${day.label}</span>
          ${active ? 
            `<p class="text-gray-500">Pagi: <b class="text-emerald-700">${pStart} -${pLimit}</b> | Siang: <b class="text-blue-700">${sStart} -${sLimit}</b></p>` : 
            `<p class="text-rose-500 font-semibold">Status: Libur / Non-Aktif</p>`
          }
        </div>
        <span class="px-2 py-0.5 rounded-md font-bold text-[9px] ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}">
          ${active ? 'Aktif' : 'Libur'}
        </span>
      </div>
    `;
  });
  container.innerHTML = html;
}

function renderDaysConfigForm() {
  const container = document.getElementById("days-config-container");
  if (!container) return;
  let html = "";
  DAYS_LIST.forEach(day => {
    const def = DEFAULT_TIME_CONFIGS[day.key];
    const rawActive = localStorage.getItem(`DAY_ACTIVE_${day.key}`);
    const active = parseBool(rawActive, def.active);
    
    const rawPStart = localStorage.getItem(`TIME_${day.key}_PAGI_START`);
    const rawPLimit = localStorage.getItem(`TIME_${day.key}_PAGI_LIMIT`);
    const rawSStart = localStorage.getItem(`TIME_${day.key}_SIANG_START`);
    const rawSLimit = localStorage.getItem(`TIME_${day.key}_SIANG_LIMIT`);

    const pStart = padZeroTime(rawPStart && rawPStart.includes(":") ? rawPStart : def.pStart);
    const pLimit = padZeroTime(rawPLimit && rawPLimit.includes(":") ? rawPLimit : def.pLimit);
    const sStart = padZeroTime(rawSStart && rawSStart.includes(":") ? rawSStart : def.sStart);
    const sLimit = padZeroTime(rawSLimit && rawSLimit.includes(":") ? rawSLimit : def.sLimit);

    html += `
      <div class="p-3 bg-slate-50 border border-gray-200 rounded-xl space-y-2">
        <div class="flex items-center justify-between border-b border-gray-200 pb-1.5">
          <span class="font-bold text-xs ${day.key === 'sun' ? 'text-amber-700' : 'text-gray-800'}">${day.label}</span>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" id="toggle-${day.key}" ${active ? 'checked' : ''} class="sr-only peer" onchange="toggleDayActiveUI('${day.key}')">
            <div class="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            <span id="label-status-${day.key}" class="ml-2 text-[10px] font-bold ${active ? 'text-blue-600' : 'text-gray-400'}">${active ? 'Aktif' : 'Libur'}</span>
          </label>
        </div>
        <div id="inputs-box-${day.key}" class="grid grid-cols-2 gap-2 ${active ? '' : 'opacity-40 pointer-events-none'}">
          <div><label class="block text-[9px] font-semibold text-gray-600 mb-0.5">Mulai Pagi</label><input type="time" id="pagi-start-${day.key}" value="${pStart}" class="w-full px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-800"></div>
          <div><label class="block text-[9px] font-semibold text-gray-600 mb-0.5">Toleransi Pagi</label><input type="time" id="pagi-limit-${day.key}" value="${pLimit}" class="w-full px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-800"></div>
          <div><label class="block text-[9px] font-semibold text-gray-600 mb-0.5">Mulai Siang</label><input type="time" id="siang-start-${day.key}" value="${sStart}" class="w-full px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-800"></div>
          <div><label class="block text-[9px] font-semibold text-gray-600 mb-0.5">Batas Siang</label><input type="time" id="siang-limit-${day.key}" value="${sLimit}" class="w-full px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-800"></div>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
  renderTimeSettingsSummary();
}

function setAllDaysActiveState(status) {
  DAYS_LIST.forEach(day => {
    const toggleEl = document.getElementById(`toggle-${day.key}`);
    if (toggleEl) {
      toggleEl.checked = status;
      toggleDayActiveUI(day.key);
    }
  });
}

function toggleDayActiveUI(dayKey) {
  const isChecked = document.getElementById(`toggle-${dayKey}`).checked;
  const inputsBox = document.getElementById(`inputs-box-${dayKey}`);
  const labelStatus = document.getElementById(`label-status-${dayKey}`);
  
  localStorage.setItem(`DAY_ACTIVE_${dayKey}`, String(isChecked));

  if (isChecked) {
    inputsBox.classList.remove('opacity-40', 'pointer-events-none');
    labelStatus.innerText = "Aktif";
    labelStatus.className = "ml-2 text-[10px] font-bold text-blue-600";
  } else {
    inputsBox.classList.add('opacity-40', 'pointer-events-none');
    labelStatus.innerText = "Libur";
    labelStatus.className = "ml-2 text-[10px] font-bold text-gray-400";
  }
  renderTimeSettingsSummary();
  refreshRealtimeSessionUI();
}

async function saveDaysTimeSettings() {
  const timeSettingsToSave = {};
  DAYS_LIST.forEach(day => {
    const def = DEFAULT_TIME_CONFIGS[day.key];
    const active = document.getElementById(`toggle-${day.key}`).checked;
    const pStart = padZeroTime(document.getElementById(`pagi-start-${day.key}`).value || def.pStart);
    const pLimit = padZeroTime(document.getElementById(`pagi-limit-${day.key}`).value || def.pLimit);
    const sStart = padZeroTime(document.getElementById(`siang-start-${day.key}`).value || def.sStart);
    const sLimit = padZeroTime(document.getElementById(`siang-limit-${day.key}`).value || def.sLimit);

    localStorage.setItem(`DAY_ACTIVE_${day.key}`, String(active));
    localStorage.setItem(`TIME_${day.key}_PAGI_START`, pStart);
    localStorage.setItem(`TIME_${day.key}_PAGI_LIMIT`, pLimit);
    localStorage.setItem(`TIME_${day.key}_SIANG_START`, sStart);
    localStorage.setItem(`TIME_${day.key}_SIANG_LIMIT`, sLimit);

    timeSettingsToSave[`DAY_ACTIVE_${day.key}`] = String(active);
    timeSettingsToSave[`TIME_${day.key}_PAGI_START`] = pStart;
    timeSettingsToSave[`TIME_${day.key}_PAGI_LIMIT`] = pLimit;
    timeSettingsToSave[`TIME_${day.key}_SIANG_START`] = sStart;
    timeSettingsToSave[`TIME_${day.key}_SIANG_LIMIT`] = sLimit;
  });
  renderTimeSettingsSummary();
  refreshRealtimeSessionUI();

  if (navigator.onLine) {
    try {
      const settingsArray = Object.keys(timeSettingsToSave).map(k => ({
        kunci_waktu: k,
        nilai: timeSettingsToSave[k]
      }));
      await supabaseClient.from('pengaturan_waktu').upsert(settingsArray);
      alert("Pengaturan jam tersimpan di Server!");
    } catch (e) { alert("Pengaturan tersimpan lokal."); }
  } else alert("Perangkat offline. Tersimpan di HP ini.");
}

function applyTimeSettingsFromCloud(timeObj) {
  for (let key in timeObj) {
    if (timeObj.hasOwnProperty(key) && timeObj[key] !== "") {
      const valStr = String(timeObj[key]).trim();
      if (valStr.toLowerCase() === "true" || valStr.toLowerCase() === "false") {
        localStorage.setItem(key, valStr.toLowerCase());
      } else if (valStr.includes(":")) {
        localStorage.setItem(key, padZeroTime(valStr));
      } else {
        localStorage.setItem(key, valStr);
      }
    }
  }
  renderDaysConfigForm();
  refreshRealtimeSessionUI();
}

async function autoDownloadMasterStudents(targetDateStr) {
  if (!navigator.onLine) {
    loadLocalHistoryToMemory();
    return;
  }

  if (!targetDateStr) {
    const d = new Date();
    const realToday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const monDate = document.getElementById("monitoring-date-filter") ? document.getElementById("monitoring-date-filter").value : "";
    const dashDate = document.getElementById("dashboard-date-filter") ? document.getElementById("dashboard-date-filter").value : "";
    targetDateStr = formatCleanDateLocal(monDate || dashDate || realToday);
  } else {
    targetDateStr = formatCleanDateLocal(targetDateStr);
  }

  try {
    const { data: studentsData } = await supabaseClient.from('siswa').select('*');
    const { data: attendanceData } = await supabaseClient
      .from('absensi_harian')
      .select('*')
      .eq('TANGGAL', targetDateStr);

    const { data: timeData } = await supabaseClient.from('pengaturan_waktu').select('*');
    if (timeData && Array.isArray(timeData)) {
      const timeObj = {};
      timeData.forEach(t => {
        const k = t.kunci_waktu || t.KUNCI_WAKTU;
        const v = t.nilai || t.NILAI;
        if (k) timeObj[k] = v;
      });
      applyTimeSettingsFromCloud(timeObj);
    }

    const { data: configData } = await supabaseClient.from('pengaturan').select('*');
    if (configData && Array.isArray(configData)) {
      const cfgMap = {};
      configData.forEach(c => {
        const k = c.kunci || c.KUNCI;
        const v = c.nilai || c.NILAI;
        if (k) cfgMap[k] = v;
      });
      const schoolName = cfgMap.SCHOOL_NAME || "SMK Negeri 1 Wakatobi";
      const academicYear = cfgMap.ACADEMIC_YEAR || "2025/2026";
      localStorage.setItem("SCHOOL_NAME", schoolName);
      localStorage.setItem("ACADEMIC_YEAR", academicYear);
      document.getElementById("app-header-school-name").innerText = `${schoolName} (${academicYear})`;
    }

    if (studentsData && Array.isArray(studentsData)) {
      const normalizedStudents = studentsData.map(s => {
        const id = s.ID_SISWA || s.id_siswa;
        const nisnVal = s.NISN || s.nisn || "-";
        const namaVal = s.NAMA_SISWA || s.nama || s.nama_siswa || "";
        const kelasVal = s.KELAS || s.kelas || "";
        const ttlVal = s.TTL || s.ttl || "-";
        const statusVal = s.STATUS || s.status;
        let activeBool = true;

        if (statusVal !== undefined && statusVal !== null) {
          activeBool = (statusVal === 'Aktif' || statusVal === true || String(statusVal).toLowerCase() === 'true');
        } else if (s.active !== undefined) {
          activeBool = parseBool(s.active, true);
        }

        return {
          id_siswa: String(id).trim(),
          nisn: String(nisnVal).trim(),
          nama: String(namaVal).trim(),
          kelas: String(kelasVal).trim(),
          ttl: String(ttlVal).trim(),
          active: activeBool
        };
      }).filter(s => s.id_siswa);

      if (db) {
        const tx = db.transaction("students", "readwrite");
        const store = tx.objectStore("students");
        store.clear();
        normalizedStudents.forEach(s => store.put(s));
        tx.oncomplete = () => {
          loadStudentsView();
        };
      }
    }

    if (attendanceData && Array.isArray(attendanceData)) {
      fetchedTodayAttendance = attendanceData.map(a => {
        const tgl = formatCleanDateLocal(a.TANGGAL || a.tanggal || targetDateStr);
        const idS = a.ID_SISWA || a.id_siswa;
        const logId = a.LOG_ID || a.log_id || `${tgl}_${idS}`;
        const stAkhir = a.STATUS_AKHIR || a.status_akhir || a.STATUS_PRESENSI || a.status_presensi || "HADIR";

        return {
          queue_id: String(logId),
          tanggal: tgl,
          id_siswa: String(idS).trim(),
          nama: a.NAMA_SISWA || a.nama || "",
          kelas: a.KELAS || a.kelas || "",
          jam_pagi: a.JAM_PAGI || a.jam_pagi || "",
          status_pagi: a.STATUS_PAGI || a.status_pagi || "",
          jam_siang: a.JAM_SIANG || a.jam_siang || "",
          status_siang: a.STATUS_SIANG || a.status_siang || "",
          status_akhir: String(stAkhir).toUpperCase(),
          status_presensi: String(stAkhir).toUpperCase()
        };
      });
    } else {
      fetchedTodayAttendance = [];
    }

    updateMonitoringDashboard();
    renderDashboardView();

  } catch (e) {
    console.error("Gagal memuat data dari Server:", e);
    loadLocalHistoryToMemory();
  }
}

function loadLocalHistoryToMemory() {
  if (localStorage.getItem("CACHE_TINDAK_LANJUT")) {
    fetchedTindakLanjutHistory = JSON.parse(localStorage.getItem("CACHE_TINDAK_LANJUT"));
  }
  if (localStorage.getItem("CACHE_HARI_LIBUR")) {
    fetchedHariLiburList = JSON.parse(localStorage.getItem("CACHE_HARI_LIBUR"));
  }
  if (db) {
    const tx = db.transaction("attendance_history", "readonly");
    tx.objectStore("attendance_history").getAll().onsuccess = (e) => {
      fetchedAttendanceHistory = e.target.result || [];
      updateMonitoringDashboard();
      renderDashboardView();
    };
  }
}

function populateClassDropdowns() {
  const classes = [...new Set(cachedStudents.map(s => s.kelas))].filter(Boolean).sort();
  const optionsHtml = '<option value="ALL">Semua Kelas</option>' + classes.map(c => `<option value="${c}">${c}</option>`).join('');
  const optionsNoAllHtml = classes.map(c => `<option value="${c}">${c}</option>`).join('');

  const stdFilter = document.getElementById('filter-class-select');
  const monFilter = document.getElementById('monitoring-class-filter');
  const promFilter = document.getElementById('promote-from-class');
  const dashFilter = document.getElementById('dash-filter-class');
  const tlFilter = document.getElementById('tl-filter-class');

  if (stdFilter) stdFilter.innerHTML = optionsHtml;
  if (monFilter) monFilter.innerHTML = optionsHtml;
  if (dashFilter) dashFilter.innerHTML = optionsHtml;
  if (tlFilter) tlFilter.innerHTML = optionsHtml;
  if (promFilter) promFilter.innerHTML = optionsNoAllHtml;
}

async function loadStudentsView() {
  if (!db) await initDatabase();
  const tx = db.transaction("students", "readonly");
  tx.objectStore("students").getAll().onsuccess = (e) => {
    cachedStudents = e.target.result || [];
    filterStudentsList();
    renderClassSummaryBadges();
    
    const monFilter = document.getElementById('monitoring-class-filter');
    if (monFilter && monFilter.options.length <= 1) {
      populateClassDropdowns();
    }
  };
}

function renderClassSummaryBadges() {
  const badgeContainer = document.getElementById("class-summary-badges");
  if (!badgeContainer) return;
  const classes = [...new Set(cachedStudents.map(s => s.kelas))].filter(Boolean).sort();
  
  badgeContainer.innerHTML = classes.map(cls => {
    const count = cachedStudents.filter(s => s.kelas === cls && (s.active === undefined || s.active === true)).length;
    return `
      <button onclick="document.getElementById('filter-class-select').value='${cls}'; filterStudentsList();" class="flex-shrink-0 px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700 shadow-sm hover:border-blue-400">
        ${cls}: <span class="text-blue-600 font-extrabold">${count}</span>
      </button>
    `;
  }).join('');
}

function filterStudentsList() {
  const q = document.getElementById('search-student-input').value.toLowerCase();
  const cls = document.getElementById('filter-class-select').value;
  const activeStudents = cachedStudents.filter(s => s.active === undefined || s.active === true);
  document.getElementById('std-count-total').innerText = activeStudents.length;
  
  const filtered = activeStudents.filter(s => {
    const matchQ = s.nama.toLowerCase().includes(q) || s.id_siswa.toLowerCase().includes(q) || (s.nisn && s.nisn.includes(q));
    const matchC = cls === "ALL" || s.kelas === cls;
    return matchQ && matchC;
  });
  document.getElementById('std-count-filtered').innerText = filtered.length;
  const container = document.getElementById('students-list-container');
  container.innerHTML = filtered.map(s => `
    <div class="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
      <div><h4 class="font-bold text-xs text-gray-900">${s.nama}</h4><p class="text-[10px] text-gray-500">ID: ${s.id_siswa} | NISN: ${s.nisn || '-'}</p></div>
      <span class="px-2 py-1 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-lg">${s.kelas}</span>
    </div>
  `).join('');
}

function generateNextStudentId() {
  if (!cachedStudents || cachedStudents.length === 0) return "S101";
  let maxNum = 0, prefix = "S";
  cachedStudents.forEach(s => {
    if (s.id_siswa) {
      const cleanId = String(s.id_siswa).trim();
      const match = cleanId.match(/^([a-zA-Z]+)(\d+)$/);
      if (match) {
        prefix = match[1]; 
        const num = parseInt(match[2], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      } else {
        const numOnly = parseInt(cleanId.replace(/\D/g, ''), 10);
        if (!isNaN(numOnly) && numOnly > maxNum) maxNum = numOnly;
      }
    }
  });
  return maxNum === 0 ? "S101" : prefix + (maxNum + 1);
}

function toggleView(viewName) {
  const views = ['scanner', 'success', 'students', 'monitoring', 'dashboard', 'about', 'tindak-lanjut', 'hari-libur', 'settings', 'promotion', 'edit-students', 'upload-batch'];
  views.forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.classList.add('hidden');
  });
  const targetView = document.getElementById('view-' + viewName);
  if (targetView) targetView.classList.remove('hidden');

  if (viewName === 'students') loadStudentsView();
  if (viewName === 'monitoring') onMonitoringDateChange();
  if (viewName === 'dashboard') renderDashboardView();
  if (viewName === 'tindak-lanjut') renderTindakLanjutView();
  if (viewName === 'hari-libur') renderHariLiburView();
  if (viewName === 'settings') renderDaysConfigForm();
  if (viewName === 'about') updateAboutStorageMetrics();
  if (viewName === 'scanner') refreshRealtimeSessionUI();
  if (viewName === 'edit-students') renderEditStudentsList();
}

function toggleMenuModal() { 
  renderMenuModalGrid();
  document.getElementById('menu-modal').classList.toggle('hidden'); 
}

function toggleAddStudentModal() { 
  const modal = document.getElementById('add-student-modal');
  const isHidden = modal.classList.contains('hidden');
  
  if (isHidden) {
    const autoId = generateNextStudentId();
    document.getElementById('new-std-id').value = autoId;
    document.getElementById('new-std-nisn').value = "";
    document.getElementById('new-std-nama').value = "";
    document.getElementById('new-std-kelas').value = "";
    document.getElementById('new-std-ttl').value = "";
  }
  modal.classList.toggle('hidden'); 
}

function renderEditStudentsList() {
  const container = document.getElementById("edit-students-list-container");
  const q = document.getElementById("edit-std-search").value.toLowerCase();
  
  const filtered = cachedStudents.filter(s => 
    s.nama.toLowerCase().includes(q) || 
    s.id_siswa.toLowerCase().includes(q) || 
    (s.nisn && s.nisn.includes(q))
  );

  if (filtered.length === 0) {
    container.innerHTML = `<div class="text-xs text-gray-400 text-center py-4">Siswa tidak ditemukan.</div>`;
    return;
  }

  container.innerHTML = filtered.map(s => {
    const isActive = (s.active === undefined || s.active === true);
    return `
      <div class="bg-white p-3 rounded-2xl border ${isActive ? 'border-gray-200' : 'border-rose-200 bg-rose-50/20'} shadow-sm flex items-center justify-between">
        <div class="min-w-0 flex-1">
          <div class="flex items-center space-x-1.5">
            <h4 class="font-bold text-xs text-gray-900 truncate">${s.nama}</h4>
            <span class="px-1.5 py-0.2 rounded text-[8px] font-extrabold ${isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
              ${isActive ? 'Aktif' : 'Non-Aktif'}
            </span>
          </div>
          <p class="text-[10px] text-gray-500">ID: ${s.id_siswa} | NISN: ${s.nisn || '-'} | Kelas: <b>${s.kelas}</b></p>
        </div>
        <button onclick="openEditStudentModal('${s.id_siswa}')" class="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl text-xs font-bold hover:bg-blue-100">
          <i class="fa-solid fa-pen"></i> Edit
        </button>
      </div>
    `;
  }).join('');
}

function openEditStudentModal(idSiswa) {
  const std = cachedStudents.find(s => s.id_siswa === idSiswa);
  if (!std) return;

  document.getElementById('edit-modal-id-siswa').value = std.id_siswa;
  document.getElementById('edit-modal-nama').value = std.nama || "";
  document.getElementById('edit-modal-nisn').value = std.nisn || "";
  document.getElementById('edit-modal-kelas').value = std.kelas || "";
  document.getElementById('edit-modal-ttl').value = std.ttl || "";
  document.getElementById('edit-modal-status-toggle').checked = (std.active === undefined || std.active === true);

  document.getElementById('edit-student-modal').classList.remove('hidden');
}

function closeEditStudentModal() {
  document.getElementById('edit-student-modal').classList.add('hidden');
}

async function saveEditStudentDetails() {
  const idSiswa = document.getElementById('edit-modal-id-siswa').value;
  const nama = document.getElementById('edit-modal-nama').value.trim();
  const nisn = document.getElementById('edit-modal-nisn').value.trim();
  const kelas = document.getElementById('edit-modal-kelas').value.trim();
  const ttl = document.getElementById('edit-modal-ttl').value.trim();
  const isActive = document.getElementById('edit-modal-status-toggle').checked;
  const btnSave = document.getElementById('btn-save-edit-student');

  if (!nama || !kelas) return alert("Nama dan Kelas wajib diisi!");

  const std = cachedStudents.find(s => s.id_siswa === idSiswa);
  if (std) {
    std.nama = nama;
    std.nisn = nisn;
    std.kelas = kelas;
    std.ttl = ttl;
    std.active = isActive;

    btnSave.disabled = true;
    btnSave.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan Perubahan...`;

    const tx = db.transaction("students", "readwrite");
    tx.objectStore("students").put(std);
    
    tx.oncomplete = async () => {
      renderEditStudentsList();
      loadStudentsView();
      populateClassDropdowns();

      if (navigator.onLine) {
        try {
          const { error } = await supabaseClient
            .from('siswa')
            .upsert({
              ID_SISWA: std.id_siswa,
              NAMA_SISWA: std.nama,
              NISN: std.nisn,
              KELAS: std.kelas,
              TTL: std.ttl,
              STATUS: std.active ? 'Aktif' : 'Non-Aktif',
              QR_CODE_KEY: std.id_siswa
            });

          if (!error) {
            alert("Perubahan data siswa berhasil disimpan ke Server!");
          } else {
            alert("Gagal memperbarui Server: " + error.message);
          }
        } catch (e) {
          alert("Data tersimpan lokal.");
        }
      } else {
        alert("Data siswa tersimpan di HP secara offline.");
      }

      btnSave.disabled = false;
      btnSave.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Simpan Perubahan`;
      closeEditStudentModal();
    };
  }
}

async function renderDashboardView() {
  // 1. Pastikan data siswa di memori sudah dimuat
  if (!cachedStudents || cachedStudents.length === 0) {
    if (typeof loadStudentsView === 'function') {
      await loadStudentsView();
    }
  }

  // 2. Handling elemen tanggal dengan aman
  const dateInputEl = document.getElementById('dashboard-date-filter');
  const d = new Date();
  const realTodayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  
  let rawDateVal = dateInputEl ? dateInputEl.value : realTodayStr;
  const targetDate = formatCleanDateLocal(rawDateVal) || realTodayStr;

  if (dateInputEl) {
    dateInputEl.value = targetDate;
  }

  // 3. Ambil data dari IndexedDB & variabel lokal
  const queueRecords = await getAllQueueFromDB();
  const localHist = await getAllLocalHistoryFromDB();

  const rawRecords = [...fetchedTodayAttendance, ...fetchedAttendanceHistory, ...localHist, ...queueRecords]
    .filter(r => formatCleanDateLocal(r.tanggal) === targetDate);

  const activeStudents = cachedStudents.filter(s => s.active === undefined || s.active === true);

  let totalStd = activeStudents.length;
  let countHadir = 0, countTerlambat = 0, countAlpa = 0, countIzin = 0, countSakit = 0, countKegiatan = 0, countBolos = 0;

  activeStudents.forEach(std => {
    const rec = rawRecords.find(r => String(r.id_siswa).trim().toUpperCase() === String(std.id_siswa).trim().toUpperCase());

    if (!rec) {
      countAlpa++;
    } else {
      const stAkhir = String(rec.status_akhir || rec.status_presensi || "ALPA").trim().toUpperCase();
      const stPagi = String(rec.status_pagi || "").trim().toUpperCase();

      if (stAkhir === "HADIR" || stPagi === "HADIR") countHadir++;
      else if (stAkhir === "ALPA") countAlpa++;
      else if (stAkhir === "BOLOS") countBolos++;
      else if (stAkhir === "IZIN") countIzin++;
      else if (stAkhir === "SAKIT") countSakit++;
      else if (stAkhir === "KEGIATAN") countKegiatan++;

      if (stPagi === "TERLAMBAT" || stAkhir === "TERLAMBAT") {
        countTerlambat++;
        countHadir++; // Terlambat tetap masuk hitungan hadir
      }
    }
  });

  const pctHadir = totalStd > 0 ? Math.round((countHadir / totalStd) * 100) : 0;

  // 4. Update UI dengan Pengecekan Aman (Pencegahan Crash jika ID tidak ditemukan)
  const setElText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  };

  setElText('dash-pct-total', `${pctHadir}%`);
  setElText('dash-pct-sub', `${countHadir} dari ${totalStd} Siswa Hadir`);
  setElText('dash-count-hadir', countHadir);
  setElText('dash-count-terlambat', countTerlambat);
  setElText('dash-count-alpa', countAlpa);
  setElText('dash-count-bolos', countBolos);
  setElText('dash-count-izinsakit', countIzin + countSakit);
  setElText('dash-count-kegiatan', countKegiatan);

  // 5. Jalankan fungsi ringkasan kelas & tabel
  if (typeof renderDashboardClassSummary === 'function') renderDashboardClassSummary(rawRecords);
  if (typeof renderDashboardStudentTable === 'function') renderDashboardStudentTable();
}

function renderDashboardClassSummary(rawRecords) {
  const container = document.getElementById('dashboard-class-summary');
  const activeStudents = cachedStudents.filter(s => s.active === undefined || s.active === true);
  const classes = [...new Set(activeStudents.map(s => s.kelas))].filter(Boolean).sort();

  if (classes.length === 0) {
    container.innerHTML = `<div class="text-[10px] text-gray-400 text-center py-2">Belum ada data kelas.</div>`;
    return;
  }

  container.innerHTML = classes.map(cls => {
    const stds = activeStudents.filter(s => s.kelas === cls);
    let hadirVal = 0;
    stds.forEach(std => {
      const rec = rawRecords.find(r => String(r.id_siswa).trim().toUpperCase() === String(std.id_siswa).trim().toUpperCase());
      if (rec) {
        const st = String(rec.status_akhir || rec.status_presensi || "HADIR").toUpperCase();
        if (st === "HADIR") hadirVal++;
      }
    });
    const pct = stds.length > 0 ? Math.round((hadirVal / stds.length) * 100) : 0;
    return `
      <div class="p-2 bg-slate-50 border border-gray-100 rounded-xl flex items-center justify-between text-xs">
        <div>
          <span class="font-bold text-gray-800">${cls}</span>
          <p class="text-[10px] text-gray-500">${hadirVal} dari ${stds.length} siswa hadir</p>
        </div>
        <span class="font-black text-xs ${pct >= 85 ? 'text-emerald-600' : 'text-amber-600'}">${pct}%</span>
      </div>
    `;
  }).join('');
}

async function renderDashboardStudentTable() {
  const d = new Date();
  const realTodayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const targetDate = formatCleanDateLocal(document.getElementById('dashboard-date-filter').value) || realTodayStr;
  const selectedClass = document.getElementById('dash-filter-class').value;
  const selectedStatus = document.getElementById('dash-filter-status').value;
  const searchQ = document.getElementById('dash-search-student').value.toLowerCase();

  const queueRecords = await getAllQueueFromDB();
  const localHist = await getAllLocalHistoryFromDB();
  const rawRecords = [...fetchedTodayAttendance, ...fetchedAttendanceHistory, ...localHist, ...queueRecords].filter(r => formatCleanDateLocal(r.tanggal) === targetDate);

  const container = document.getElementById('dash-student-table-container');
  const activeStudents = cachedStudents.filter(s => s.active === undefined || s.active === true);

  const filtered = activeStudents.filter(std => {
    const matchClass = (selectedClass === "ALL" || std.kelas === selectedClass);
    const matchQ = std.nama.toLowerCase().includes(searchQ) || std.id_siswa.toLowerCase().includes(searchQ);
    
    const rec = rawRecords.find(r => String(r.id_siswa).trim().toUpperCase() === String(std.id_siswa).trim().toUpperCase());
    const status = rec ? String(rec.status_akhir || rec.status_presensi || "HADIR").toUpperCase() : "ALPA";
    const matchStatus = (selectedStatus === "ALL" || status === selectedStatus);

    return matchClass && matchQ && matchStatus;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="text-xs text-gray-400 text-center py-3">Tidak ada siswa yang sesuai filter.</div>`;
    return;
  }

  container.innerHTML = filtered.map(std => {
    const rec = rawRecords.find(r => String(r.id_siswa).trim().toUpperCase() === String(std.id_siswa).trim().toUpperCase());
    const status = rec ? String(rec.status_akhir || rec.status_presensi || "HADIR").toUpperCase() : "ALPA";
    const jamScan = rec ? (rec.jam_pagi || rec.jam_siang || rec.jam || "-") : "-";

    let badgeStyle = "bg-gray-100 text-gray-700";
    if (status === "HADIR") badgeStyle = "bg-emerald-100 text-emerald-800";
    else if (status === "TERLAMBAT") badgeStyle = "bg-amber-100 text-amber-800";
    else if (status === "ALPA") badgeStyle = "bg-red-100 text-red-800";
    else if (status === "BOLOS") badgeStyle = "bg-rose-100 text-rose-800";
    else if (status === "IZIN" || status === "SAKIT") badgeStyle = "bg-indigo-100 text-indigo-800";
    else if (status === "KEGIATAN") badgeStyle = "bg-purple-100 text-purple-800";

    return `
      <div onclick="showStudentDetailModal('${std.id_siswa}')" class="p-2.5 bg-slate-50 border border-gray-100 rounded-xl flex items-center justify-between cursor-pointer hover:bg-slate-100 transition">
        <div>
          <h5 class="font-bold text-xs text-gray-900">${std.nama}</h5>
          <p class="text-[10px] text-gray-500">${std.kelas} | Jam: ${jamScan}</p>
        </div>
        <span class="text-[9px] font-extrabold px-2 py-0.5 rounded-md ${badgeStyle}">${status}</span>
      </div>
    `;
  }).join('');
}

function showStudentDetailModal(idSiswa) {
  const std = cachedStudents.find(s => s.id_siswa === idSiswa);
  if (!std) return;

  document.getElementById('modal-std-name').innerText = std.nama;
  document.getElementById('modal-std-sub').innerText = `Kelas: ${std.kelas} | ID: ${std.id_siswa} | NISN: ${std.nisn || '-'}`;

  const d = new Date();
  const realTodayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const targetDate = formatCleanDateLocal(document.getElementById('dashboard-date-filter').value) || realTodayStr;
  const rec = [...fetchedTodayAttendance, ...fetchedAttendanceHistory].find(r => String(r.id_siswa).trim().toUpperCase() === String(idSiswa).trim().toUpperCase() && formatCleanDateLocal(r.tanggal) === targetDate);

  const contentEl = document.getElementById('modal-std-status-content');
  if (rec) {
    contentEl.innerHTML = `
      <p>Tanggal: <b>${rec.tanggal}</b></p>
      <p>Jam Pagi: <b>${rec.jam_pagi || '-'}</b> | Jam Siang: <b>${rec.jam_siang || '-'}</b></p>
      <p>Status Pagi: <b>${rec.status_pagi || '-'}</b> | Status Siang: <b>${rec.status_siang || '-'}</b></p>
      <p>Status Akhir Presensi: <b class="text-blue-700">${rec.status_akhir || rec.status_presensi || 'HADIR'}</b></p>
    `;
  } else {
    contentEl.innerHTML = `<p class="text-rose-600 font-bold">Belum Melakukan Absensi / Tanpa Keterangan (Alpa)</p>`;
  }

  document.getElementById('student-detail-modal').classList.remove('hidden');
}

function closeStudentDetailModal() {
  document.getElementById('student-detail-modal').classList.add('hidden');
}

function onMonitoringDateChange() {
  const d = new Date();
  const realTodayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const targetDate = formatCleanDateLocal(document.getElementById('monitoring-date-filter').value) || realTodayStr;
  updateMonitoringDashboard();
  if (navigator.onLine) autoDownloadMasterStudents(targetDate);
}

async function updateMonitoringDashboard() {
  const d = new Date();
  const realTodayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const targetDate = formatCleanDateLocal(document.getElementById('monitoring-date-filter').value) || realTodayStr;
  const selectedClass = document.getElementById('monitoring-class-filter').value;
  const selectedSessionFilter = document.getElementById('monitoring-session-filter').value;
  const selectedStatusFilter = document.getElementById('monitoring-status-filter').value || "ALL";
  
  const queueRecords = await getAllQueueFromDB();
  const localHist = await getAllLocalHistoryFromDB();
  
  let rawRecords = [...fetchedTodayAttendance, ...fetchedAttendanceHistory, ...localHist, ...queueRecords].filter(r => formatCleanDateLocal(r.tanggal) === targetDate);

  const activeStudents = cachedStudents.filter(s => s.active === undefined || s.active === true);
  const classStudents = activeStudents.filter(s => selectedClass === "ALL" || s.kelas === selectedClass);
  let hadir = 0, terlambat = 0, alpa = 0, sakit = 0, izin = 0, kegiatan = 0;
  const filteredActionStudents = [];

  const dateObj = new Date(targetDate + "T00:00:00");
  const timeConfig = getTodayTimeConfig(dateObj);
  const now = new Date();
  const todayFormatted = realTodayStr;
  const nowStr = padZeroTime(now.toTimeString().split(' ')[0]);
  
  const isPastSiangLimit = (targetDate < todayFormatted) || (targetDate === todayFormatted && nowStr >= (timeConfig.sLimit + ":01"));

  classStudents.forEach(std => {
    const stdRec = rawRecords.find(r => 
      String(r.id_siswa).trim().toUpperCase() === String(std.id_siswa).trim().toUpperCase() &&
      formatCleanDateLocal(r.tanggal) === targetDate
    );

    var targetStatus = "";
    if (stdRec) {
      if (selectedSessionFilter === "PAGI") {
        targetStatus = String(stdRec.status_pagi || stdRec.status_presensi || stdRec.status_akhir || "").toUpperCase();
      } else if (selectedSessionFilter === "SIANG") {
        targetStatus = String(stdRec.status_siang || stdRec.status_presensi || stdRec.status_akhir || "").toUpperCase();
      }
    }

    let evalStatus = targetStatus;
    if (!targetStatus || targetStatus === "") {
      evalStatus = isPastSiangLimit ? "ALPA" : "BELUM";
    }

    if (evalStatus === "HADIR") hadir++;
    else if (evalStatus === "TERLAMBAT") terlambat++;
    else if (evalStatus === "ALPA") alpa++;
    else if (evalStatus === "SAKIT") sakit++;
    else if (evalStatus === "IZIN") izin++;
    else if (evalStatus === "KEGIATAN") kegiatan++;

    let matchStatus = false;
    if (selectedStatusFilter === "ALL") {
      matchStatus = true; 
    } else {
      matchStatus = (evalStatus === selectedStatusFilter);
    }

    if (matchStatus) {
      filteredActionStudents.push({
        student: std,
        status: targetStatus || (isPastSiangLimit ? "ALPA" : "BELUM"),
        isAbsented: !!targetStatus
      });
    }
  });

  document.getElementById('stat-hadir').innerText = hadir + terlambat;
  document.getElementById('stat-terlambat').innerText = terlambat;
  document.getElementById('stat-alpa').innerText = alpa;
  document.getElementById('stat-sakit').innerText = sakit;
  document.getElementById('stat-izin').innerText = izin;
  document.getElementById('stat-kegiatan').innerText = kegiatan;

  renderPieChart(hadir, terlambat, alpa, sakit, izin, kegiatan, classStudents.length);
  renderClassBarChartHorizontal(rawRecords, selectedSessionFilter);
  renderMonitoringActionListFiltered(targetDate, filteredActionStudents, isPastSiangLimit, selectedSessionFilter, selectedStatusFilter);
}

function renderClassBarChartHorizontal(attendanceRecords, selectedSessionFilter) {
  const container = document.getElementById('classBarChartContainer');
  const ctx = document.getElementById('classBarChart').getContext('2d');
  if (myBarChart) myBarChart.destroy();

  const activeStudents = cachedStudents.filter(s => s.active === undefined || s.active === true);
  const classes = [...new Set(activeStudents.map(s => s.kelas))].filter(Boolean).sort();
  const labels = [];
  const percentages = [];

  classes.forEach(cls => {
    const studentsInCls = activeStudents.filter(s => s.kelas === cls);
    let countHadirVal = 0;
    
    studentsInCls.forEach(std => {
      const stdRec = attendanceRecords.find(r => 
        String(r.id_siswa).trim().toUpperCase() === String(std.id_siswa).trim().toUpperCase()
      );

      if (stdRec) {
        var st = "";
        if (selectedSessionFilter === "PAGI") {
          st = String(stdRec.status_pagi || stdRec.status_presensi || stdRec.status_akhir || "").toUpperCase();
        } else if (selectedSessionFilter === "SIANG") {
          st = String(stdRec.status_siang || stdRec.status_presensi || stdRec.status_akhir || "").toUpperCase();
        }
        
        if (st === "HADIR" || st === "TERLAMBAT") countHadirVal++;
      }
    });
    
    const pct = studentsInCls.length > 0 ? Math.round((countHadirVal / studentsInCls.length) * 100) : 0;
    labels.push(cls);
    percentages.push(pct);
  });

  const dynamicHeight = Math.max(160, classes.length * 28);
  container.style.height = `${dynamicHeight}px`;

  myBarChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '% Kehadiran',
        data: percentages,
        backgroundColor: '#0b3c5d',
        borderRadius: 6,
        barThickness: 14
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } },
        y: { ticks: { font: { size: 10, weight: 'bold' } } }
      },
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const idx = elements[0].index;
          const selectedCls = labels[idx];
          document.getElementById('monitoring-class-filter').value = selectedCls;
          updateMonitoringDashboard();
        }
      }
    }
  });
}

function handleActionBtnClick(idSiswa, status) {
  const d = new Date();
  const realTodayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const targetDate = formatCleanDateLocal(document.getElementById('monitoring-date-filter').value) || realTodayStr;
  setManualPresensiAction(idSiswa, status, targetDate);
}

function renderMonitoringActionListFiltered(targetDate, studentItems, isPastLimit, selectedSessionFilter, selectedStatusFilter) {
  const container = document.getElementById('monitoring-student-action-list');
  const badgeEl = document.getElementById('monitoring-count-badge');
  const headerTitleEl = document.getElementById('monitoring-action-header-title');

  headerTitleEl.innerText = "Daftar Siswa & Aksi Presensi";
  badgeEl.innerText = `${studentItems.length} Siswa Filtered`;
  badgeEl.className = "text-[10px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200";

  if (studentItems.length === 0) {
    container.innerHTML = `<div class="bg-gray-50 border border-gray-200 p-4 rounded-xl text-center text-xs text-gray-500 font-bold"><i class="fa-solid fa-circle-info"></i> Tidak ada siswa yang sesuai kriteria filter.</div>`;
    return;
  }

  container.innerHTML = studentItems.map(item => {
    const std = item.student;
    const st = item.status;
    
    let badgeStyle = "bg-gray-100 text-gray-700";
    if (st === "HADIR") badgeStyle = "bg-emerald-100 text-emerald-800";
    else if (st === "TERLAMBAT") badgeStyle = "bg-amber-100 text-amber-800";
    else if (st === "ALPA") badgeStyle = "bg-red-100 text-red-800";
    else if (st === "IZIN" || st === "SAKIT") badgeStyle = "bg-indigo-100 text-indigo-800";
    else if (st === "KEGIATAN") badgeStyle = "bg-purple-100 text-purple-800";
    else if (st === "BELUM") badgeStyle = "bg-amber-50 text-amber-700 border border-amber-200";

    return `
      <div id="action-item-${std.id_siswa}" class="p-2.5 bg-slate-50 border border-gray-200 rounded-xl space-y-1.5 transition-all duration-300">
        <div class="flex items-center justify-between">
          <div class="min-w-0 flex-1">
            <h5 class="font-bold text-xs text-gray-900 truncate">${std.nama}</h5>
            <p class="text-[10px] text-gray-500">${std.kelas} | ID: ${std.id_siswa}</p>
          </div>
          <span class="text-[9px] font-extrabold px-2 py-0.5 rounded-full ${badgeStyle}">
            ${st}
          </span>
        </div>
        <div class="grid grid-cols-5 gap-1 pt-1">
          <button onclick="handleActionBtnClick('${std.id_siswa}', 'HADIR')" class="py-1 bg-emerald-600 text-white font-bold text-[9px] rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition">Hadir</button>
          <button onclick="handleActionBtnClick('${std.id_siswa}', 'IZIN')" class="py-1 bg-indigo-600 text-white font-bold text-[9px] rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition">Izin</button>
          <button onclick="handleActionBtnClick('${std.id_siswa}', 'SAKIT')" class="py-1 bg-blue-600 text-white font-bold text-[9px] rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition">Sakit</button>
          <button onclick="handleActionBtnClick('${std.id_siswa}', 'KEGIATAN')" class="py-1 bg-purple-600 text-white font-bold text-[9px] rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition">Keg.</button>
          <button onclick="handleActionBtnClick('${std.id_siswa}', 'ALPA')" class="py-1 bg-rose-600 text-white font-bold text-[9px] rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition flex items-center justify-center gap-0.5" title="Koreksi ke Alpa">
            <i class="fa-solid fa-rotate-left text-[8px]"></i> Alpa
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function setManualPresensiAction(idSiswa, status, targetDate) {
  const student = cachedStudents.find(s => s.id_siswa === idSiswa);
  if (!student) return;

  const selectedSessionFilter = document.getElementById('monitoring-session-filter').value || "PAGI";
  const cleanTargetDate = formatCleanDateLocal(targetDate);
  const timeStr = padZeroTime((isManualTimeMode && customScanTimeOverride) ? customScanTimeOverride : new Date().toTimeString().split(' ')[0].substring(0, 5));
  const queueId = `${cleanTargetDate}_${idSiswa}`;

  let existing = fetchedTodayAttendance.find(r => 
    String(r.id_siswa).trim().toUpperCase() === String(idSiswa).trim().toUpperCase() && 
    formatCleanDateLocal(r.tanggal) === cleanTargetDate
  );

  let jamPagi = existing ? (existing.jam_pagi || "") : "";
  let statusPagi = existing ? (existing.status_pagi || "") : "";
  let jamSiang = existing ? (existing.jam_siang || "") : "";
  let statusSiang = existing ? (existing.status_siang || "") : "";

  if (selectedSessionFilter === "PAGI") {
    jamPagi = timeStr;
    statusPagi = status;
  } else {
    jamSiang = timeStr;
    statusSiang = status;
  }

  const statusAkhir = status;

  const record = {
    queue_id: queueId,
    tanggal: cleanTargetDate,
    jam: timeStr,
    id_siswa: idSiswa,
    nama: student.nama,
    kelas: student.kelas,
    sesi: selectedSessionFilter,
    status_presensi: statusAkhir,
    status_pagi: statusPagi,
    jam_pagi: jamPagi,
    status_siang: statusSiang,
    jam_siang: jamSiang,
    status_akhir: statusAkhir,
    timestamp: Date.now()
  };

  await saveToAttendanceQueue(record);
  await saveToLocalHistoryDB(record);
  
  fetchedTodayAttendance = fetchedTodayAttendance.filter(r => !(
    String(r.id_siswa).trim().toUpperCase() === String(idSiswa).trim().toUpperCase() && 
    formatCleanDateLocal(r.tanggal) === cleanTargetDate
  ));
  fetchedTodayAttendance.push(record);

  setTimeout(() => {
    updateMonitoringDashboard();
    renderDashboardView();
  }, 150);

  if (navigator.onLine) syncQueueToGAS();
}

function renderPieChart(hadir, terlambat, alpa, sakit, izin, kegiatan, totalStudentsCount) {
  const ctx = document.getElementById('attendancePieChart').getContext('2d');
  if (myPieChart) myPieChart.destroy();

  const totalHadirVal = hadir + terlambat;
  const effectiveTotal = totalStudentsCount || (hadir + terlambat + alpa + sakit + izin + kegiatan);
  const percentVal = effectiveTotal > 0 ? Math.round((totalHadirVal / effectiveTotal) * 100) : 0;
  
  document.getElementById('chart-center-percent').innerText = `${percentVal}%`;

  myPieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Hadir', 'Terlambat', 'Alpa', 'Sakit', 'Izin', 'Kegiatan'],
      datasets: [{ data: [hadir, terlambat, alpa, sakit, izin, kegiatan], backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#6366f1', '#a855f7'] }]
    },
    options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false } } }
  });
}

function switchTLTab(tabName) {
  currentTLTab = tabName;
  const btnPending = document.getElementById("tl-tab-btn-pending");
  const btnDone = document.getElementById("tl-tab-btn-done");

  if (tabName === "pending") {
    btnPending.className = "flex-1 py-1.5 rounded-lg bg-white text-rose-700 shadow-sm transition";
    btnDone.className = "flex-1 py-1.5 rounded-lg text-gray-600 transition";
  } else {
    btnDone.className = "flex-1 py-1.5 rounded-lg bg-white text-emerald-700 shadow-sm transition";
    btnPending.className = "flex-1 py-1.5 rounded-lg text-gray-600 transition";
  }
  renderTindakLanjutView();
}

function getLocalTLStatusList() {
  try { return JSON.parse(localStorage.getItem("TL_STATUS_STORE") || "{}"); } catch(e) { return {}; }
}

function saveLocalTLStatus(idSiswa, dataObj) {
  const store = getLocalTLStatusList();
  store[idSiswa] = dataObj;
  localStorage.setItem("TL_STATUS_STORE", JSON.stringify(store));
}

function removeLocalTLStatus(idSiswa) {
  const store = getLocalTLStatusList();
  delete store[idSiswa];
  localStorage.setItem("TL_STATUS_STORE", JSON.stringify(store));
}

async function sendTLClassSummaryWA() {
  const selectedClass = document.getElementById("tl-filter-class").value;
  const schoolName = localStorage.getItem("SCHOOL_NAME") || "Sekolah";

  if (selectedClass === "ALL") {
    return alert("Pilih kelas tertentu terlebih dahulu pada filter kelas!");
  }

  const allHistory = [...fetchedTodayAttendance, ...fetchedAttendanceHistory, ...(await getAllLocalHistoryFromDB())];
  const tlStore = getLocalTLStatusList();
  const activeStudents = cachedStudents.filter(s => (s.active === undefined || s.active === true) && s.kelas === selectedClass);

  if (activeStudents.length === 0) return alert(`Tidak ada siswa di kelas ${selectedClass}.`);

  const detectedStudents = [];

  activeStudents.forEach(std => {
    const idS = String(std.id_siswa).trim().toUpperCase();
    const stdRecords = allHistory.filter(r => String(r.id_siswa).trim().toUpperCase() === idS);
    stdRecords.sort((a,b) => String(a.tanggal).localeCompare(String(b.tanggal)));

    let totalAlpa = 0;
    stdRecords.forEach(r => {
      const stAkhir = String(r.status_akhir || r.status_presensi || "").trim().toUpperCase();
      if (stAkhir === "ALPA") totalAlpa++;
    });

    let maxSeqTerlambat = 0, currentSeqTerlambat = 0;
    stdRecords.forEach(r => {
      const stPagi = String(r.status_pagi || "").trim().toUpperCase();
      if (stPagi === "TERLAMBAT") {
        currentSeqTerlambat++;
        if (currentSeqTerlambat > maxSeqTerlambat) maxSeqTerlambat = currentSeqTerlambat;
      } else if (stPagi === "HADIR") {
        currentSeqTerlambat = 0;
      }
    });

    let maxSeqBolos = 0, currentSeqBolos = 0;
    stdRecords.forEach(r => {
      const stAkhir = String(r.status_akhir || r.status_presensi || "").trim().toUpperCase();
      if (stAkhir === "BOLOS") {
        currentSeqBolos++;
        if (currentSeqBolos > maxSeqBolos) maxSeqBolos = currentSeqBolos;
      } else if (stAkhir !== "") {
        currentSeqBolos = 0;
      }
    });

    const categories = [];
    if (totalAlpa >= 3) categories.push(`Akumulasi ${totalAlpa}x Alpa`);
    if (maxSeqTerlambat >= 3) categories.push(`3x Terlambat Berturut-turut`);
    if (maxSeqBolos >= 3) categories.push(`3x Bolos Berturut-turut`);

    if (categories.length > 0) {
      const isDone = !!tlStore[std.id_siswa];
      detectedStudents.push({ nama: std.nama, kategori: categories.join(", "), status: isDone ? "Sudah Ditindak" : "Perlu Penanganan" });
    }
  });

  if (detectedStudents.length === 0) return alert(`Selamat! Tidak ada siswa di kelas ${selectedClass} yang terdeteksi melanggar.`);

  let message = `Yth. Bapak/Ibu Wali Kelas *${selectedClass}*,\n\nBerikut daftar rekap tindak lanjut kedisiplinan siswa di kelas Anda:\n\n`;
  detectedStudents.forEach((item, index) => {
    message += `${index + 1}. *${item.nama}*\n   - Catatan: ${item.kategori}\n   - Status: ${item.status}\n\n`;
  });
  message += `Mohon untuk dapat dilakukan pembinaan atau koordinasi dengan orang tua siswa terkait. Terima kasih.\n\n_Salam Kedisiplinan ${schoolName}_`;

  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
}

async function renderTindakLanjutView() {
  const container = document.getElementById('tindak-lanjut-list-container');
  const selectedClassFilter = document.getElementById('tl-filter-class').value;

  container.innerHTML = `<div class="text-center py-6 text-xs text-gray-400 font-bold"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Menganalisis riwayat absensi siswa...</div>`;

  const allHistory = [...fetchedTodayAttendance, ...fetchedAttendanceHistory, ...(await getAllLocalHistoryFromDB())];
  const tlStore = getLocalTLStatusList();

  const activeStudents = cachedStudents.filter(s => s.active === undefined || s.active === true);
  const filteredByClassStudents = activeStudents.filter(s => selectedClassFilter === "ALL" || s.kelas === selectedClassFilter);

  const detectedList = [];

  filteredByClassStudents.forEach(std => {
    const idS = String(std.id_siswa).trim().toUpperCase();
    const stdRecords = allHistory.filter(r => String(r.id_siswa).trim().toUpperCase() === idS);
    stdRecords.sort((a,b) => String(a.tanggal).localeCompare(String(b.tanggal)));

    let totalAlpa = 0;
    stdRecords.forEach(r => {
      const stAkhir = String(r.status_akhir || r.status_presensi || "").trim().toUpperCase();
      if (stAkhir === "ALPA") totalAlpa++;
    });

    let maxSeqTerlambat = 0, currentSeqTerlambat = 0;
    stdRecords.forEach(r => {
      const stPagi = String(r.status_pagi || "").trim().toUpperCase();
      if (stPagi === "TERLAMBAT") {
        currentSeqTerlambat++;
        if (currentSeqTerlambat > maxSeqTerlambat) maxSeqTerlambat = currentSeqTerlambat;
      } else if (stPagi === "HADIR") {
        currentSeqTerlambat = 0;
      }
    });

    let maxSeqBolos = 0, currentSeqBolos = 0;
    stdRecords.forEach(r => {
      const stAkhir = String(r.status_akhir || r.status_presensi || "").trim().toUpperCase();
      if (stAkhir === "BOLOS") {
        currentSeqBolos++;
        if (currentSeqBolos > maxSeqBolos) maxSeqBolos = currentSeqBolos;
      } else if (stAkhir !== "") {
        currentSeqBolos = 0;
      }
    });

    const categories = [];
    if (totalAlpa >= 3) categories.push(`Akumulasi ${totalAlpa}x Alpa`);
    if (maxSeqTerlambat >= 3) categories.push(`3x Terlambat Berturut-turut`);
    if (maxSeqBolos >= 3) categories.push(`3x Bolos Berturut-turut`);

    if (categories.length > 0) {
      detectedList.push({
        student: std,
        categories: categories,
        categoryText: categories.join(", "),
        isDone: !!tlStore[std.id_siswa],
        savedInfo: tlStore[std.id_siswa] || null
      });
    }
  });

  const pendingItems = detectedList.filter(item => !item.isDone);
  const doneItems = detectedList.filter(item => item.isDone);

  document.getElementById("tl-count-pending").innerText = pendingItems.length;
  document.getElementById("tl-count-done").innerText = doneItems.length;

  const activeItems = (currentTLTab === "pending") ? pendingItems : doneItems;

  if (activeItems.length === 0) {
    container.innerHTML = `
      <div class="bg-white p-6 rounded-2xl border border-gray-200 text-center text-xs text-gray-500 space-y-1">
        <i class="fa-solid fa-circle-check text-2xl ${currentTLTab === 'pending' ? 'text-emerald-500' : 'text-gray-300'}"></i>
        <p class="font-bold text-gray-700">${currentTLTab === 'pending' ? 'Tidak Ada Siswa Perlu Penanganan' : 'Belum Ada Siswa Selesai Ditindak'}</p>
        <p class="text-[10px] text-gray-400">${currentTLTab === 'pending' ? 'Seluruh siswa aman dari kriteria pelanggaran.' : 'Siswa yang sudah ditindaklanjuti akan muncul di sini.'}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = activeItems.map(item => {
    const std = item.student;
    const isDone = item.isDone;
    const info = item.savedInfo;

    return `
      <div class="bg-white p-3.5 rounded-2xl border ${isDone ? 'border-emerald-200 bg-emerald-50/20' : 'border-rose-200 shadow-sm'} space-y-2">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h4 class="font-bold text-xs text-gray-900">${std.nama}</h4>
            <p class="text-[10px] text-gray-500">Kelas: <b>${std.kelas}</b> | ID: ${std.id_siswa}</p>
          </div>
          <span class="text-[9px] font-extrabold px-2 py-0.5 rounded-md ${isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
            ${isDone ? 'Sudah Ditindak' : 'Perlu Penanganan'}
          </span>
        </div>

        <div class="p-2 rounded-xl text-xs font-semibold ${isDone ? 'bg-emerald-50 text-emerald-900 border border-emerald-100' : 'bg-rose-50 text-rose-900 border border-rose-100'}">
          <i class="fa-solid fa-triangle-exclamation text-[10px] mr-1"></i> Pelanggaran: ${item.categoryText}
        </div>

        ${isDone ? `
          <div class="bg-gray-50 p-2 rounded-xl text-[11px] text-gray-700 border border-gray-200 space-y-0.5">
            <p><b>Catatan Tindakan:</b> ${info.catatan || '-'}</p>
            <p class="text-[9px] text-gray-400">Ditangani tgl: ${info.tanggal}</p>
          </div>
        ` : ''}

        <div class="pt-1 flex justify-end items-center gap-2 border-t border-gray-100">
          ${!isDone ? `
            <button onclick="openTLActionModal('${std.id_siswa}', '${std.nama}', '${item.categoryText}')" class="px-3 py-1.5 bg-rose-600 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-rose-700 active:scale-95 transition flex items-center gap-1.5">
              <i class="fa-solid fa-user-shield"></i> Tindak Lanjut
            </button>
          ` : `
            <button onclick="reopenTLStatus('${std.id_siswa}')" class="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[10px] rounded-lg hover:bg-amber-100 transition flex items-center gap-1">
              <i class="fa-solid fa-arrow-rotate-left"></i> Buka Kembali
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');
}

function openTLActionModal(idSiswa, nama, kategoriText) {
  document.getElementById('tl-modal-id-siswa').value = idSiswa;
  document.getElementById('tl-modal-nama').value = nama;
  document.getElementById('tl-modal-kategori-text').value = kategoriText;
  document.getElementById('tl-modal-catatan').value = "";
  document.getElementById('tl-action-modal').classList.remove('hidden');
}

function closeTLActionModal() {
  document.getElementById('tl-action-modal').classList.add('hidden');
}

function confirmSaveTLAction() {
  const idSiswa = document.getElementById('tl-modal-id-siswa').value;
  const catatan = document.getElementById('tl-modal-catatan').value.trim();
  const kategoriText = document.getElementById('tl-modal-kategori-text').value;

  if (!catatan) return alert("Isi catatan penanganan terlebih dahulu!");

  const d = new Date();
  const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  saveLocalTLStatus(idSiswa, {
    tanggal: todayStr,
    catatan: catatan,
    kategori: kategoriText
  });

  closeTLActionModal();
  renderTindakLanjutView();
}

function reopenTLStatus(idSiswa) {
  if (confirm("Yakin ingin membatalkan status penanganan dan mengembalikan ke daftar 'Perlu Penanganan'?")) {
    removeLocalTLStatus(idSiswa);
    renderTindakLanjutView();
  }
}

function renderHariLiburView() {
  const container = document.getElementById("hari-libur-list-container");
  container.innerHTML = fetchedHariLiburList.map(item => `
    <div class="bg-white p-3 rounded-xl border border-gray-200 flex items-center justify-between text-xs">
      <div><span class="font-bold text-blue-900 block">${item.tanggal || item.TANGGAL}</span><span>${item.keterangan || item.KETERANGAN_LIBUR}</span></div>
    </div>
  `).join('');
}

async function saveHariLiburNew() {
  const tgl = document.getElementById("input-libur-tanggal").value;
  const ket = document.getElementById("input-libur-ket").value.trim();
  if (!tgl || !ket) return alert("Tanggal & Keterangan wajib diisi!");
  
  const newItem = { TANGGAL: formatCleanDateLocal(tgl), KETERANGAN_LIBUR: ket };
  fetchedHariLiburList.push(newItem);
  localStorage.setItem("CACHE_HARI_LIBUR", JSON.stringify(fetchedHariLiburList));
  renderHariLiburView();

  if (navigator.onLine) {
    await supabaseClient.from('hari_libur').upsert([newItem]);
  }
}

async function saveSchoolSettings() {
  const schoolName = document.getElementById("input-school-name").value.trim();
  const academicYear = document.getElementById("input-academic-year").value.trim();
  const principalName = document.getElementById("input-principal-name").value.trim();
  const principalNip = document.getElementById("input-principal-nip").value.trim();
  if (!schoolName) return alert("Nama sekolah wajib diisi!");

  localStorage.setItem("SCHOOL_NAME", schoolName);
  localStorage.setItem("ACADEMIC_YEAR", academicYear);
  localStorage.setItem("PRINCIPAL_NAME", principalName);
  localStorage.setItem("PRINCIPAL_NIP", principalNip);
  document.getElementById("app-header-school-name").innerText = `${schoolName} (${academicYear})`;

  if (navigator.onLine) {
    const schoolSettingsArray = [
      { kunci: 'SCHOOL_NAME', nilai: schoolName },
      { kunci: 'ACADEMIC_YEAR', nilai: academicYear },
      { kunci: 'PRINCIPAL_NAME', nilai: principalName },
      { kunci: 'PRINCIPAL_NIP', nilai: principalNip }
    ];
    await supabaseClient.from('pengaturan').upsert(schoolSettingsArray);
  }
  alert("Identitas sekolah tersimpan!");
}

async function executeMassPromotion() {
  const fromCls = document.getElementById("promote-from-class").value;
  const toCls = document.getElementById("promote-to-class").value.trim();
  if (!fromCls || !toCls) return alert("Pilih kelas asal dan isi nama kelas baru!");

  const targetStudents = cachedStudents.filter(s => s.kelas === fromCls);
  if (targetStudents.length === 0) return alert("Tidak ada siswa di kelas tersebut!");

  if (!confirm(`Yakin memindahkan ${targetStudents.length} siswa dari ${fromCls} ke ${toCls}?`)) return;

  const tx = db.transaction("students", "readwrite");
  const store = tx.objectStore("students");
  targetStudents.forEach(s => {
    s.kelas = toCls;
    store.put(s);
  });

  tx.oncomplete = () => {
    loadStudentsView();
    alert("Kenaikan kelas lokal berhasil diterapkan!");
  };

  if (navigator.onLine) {
    const updatesData = targetStudents.map(s => ({
      ID_SISWA: s.id_siswa,
      KELAS: toCls,
      NAMA_SISWA: s.nama
    }));
    await supabaseClient.from('siswa').upsert(updatesData);
    autoDownloadMasterStudents();
  }
}

async function updateAboutStorageMetrics() {
  let localKB = (JSON.stringify(localStorage).length / 1024).toFixed(1);
  document.getElementById("about-local-size").innerText = `${localKB} KB`;

  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    const usageMB = ((estimate.usage || 0) / (1024 * 1024)).toFixed(2);
    document.getElementById("about-cache-size").innerText = `${usageMB} MB`;
  } else {
    document.getElementById("about-cache-size").innerText = "12.4 MB";
  }
}

function clearAppCacheOnly() {
  if ('caches' in window) {
    caches.keys().then(keys => {
      Promise.all(keys.map(key => caches.delete(key))).then(() => {
        alert("Cache file aplikasi berhasil dibersihkan!");
        window.location.reload();
      });
    });
  } else {
    alert("Cache berhasil dibersihkan!");
    window.location.reload();
  }
}

function forceCheckAppUpdate() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let registration of registrations) {
        registration.update();
      }
    });
  }
  alert("Aplikasi telah menyegarkan file sistem terbaru!");
  window.location.reload();
}

async function saveNewStudentToDB() {
  const idSiswa = document.getElementById('new-std-id').value.trim();
  const nisn = document.getElementById('new-std-nisn').value.trim();
  const nama = document.getElementById('new-std-nama').value.trim();
  const kelas = document.getElementById('new-std-kelas').value.trim();
  const ttl = document.getElementById('new-std-ttl').value.trim();
  
  if (!idSiswa || !nama || !kelas) return alert("ID, Nama, dan Kelas Wajib diisi!");

  const newStudentLocal = { id_siswa: idSiswa, nisn: nisn || "-", nama: nama, kelas: kelas, ttl: ttl || "-", active: true };
  const tx = db.transaction("students", "readwrite");
  tx.objectStore("students").put(newStudentLocal);
  tx.oncomplete = async () => {
    alert("Siswa baru berhasil disimpan!");
    toggleAddStudentModal();
    loadStudentsView();
  };

  if (navigator.onLine) {
    const newStudentSupabase = {
      ID_SISWA: idSiswa,
      NISN: nisn || "-",
      NAMA_SISWA: nama,
      KELAS: kelas,
      TTL: ttl || "-",
      STATUS: "Aktif",
      QR_CODE_KEY: idSiswa
    };
    await supabaseClient.from('siswa').insert([newStudentSupabase]);
  }
}

function toggleScanSessionMode() {
  currentScanSession = currentScanSession === "PAGI" ? "SIANG" : "PAGI";
  refreshRealtimeSessionUI();
}

function changeCameraFacing(facingMode) {
  activeCameraFacingMode = facingMode;
  const btnBack = document.getElementById("cam-facing-back");
  const btnFront = document.getElementById("cam-facing-front");

  if (facingMode === "environment") {
    btnBack.className = "px-2 py-0.5 text-[9px] font-extrabold rounded-full bg-blue-500 text-white shadow transition";
    btnFront.className = "px-2 py-0.5 text-[9px] font-extrabold rounded-full text-gray-300 hover:text-white transition";
  } else {
    btnFront.className = "px-2 py-0.5 text-[9px] font-extrabold rounded-full bg-blue-500 text-white shadow transition";
    btnBack.className = "px-2 py-0.5 text-[9px] font-extrabold rounded-full text-gray-300 hover:text-white transition";
  }

  if (isCameraActive) {
    stopCamera().then(() => {
      initScanner();
    });
  }
}

async function initScanner() {
  if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");
  document.getElementById('camera-off-placeholder').classList.add('hidden');
  document.getElementById('scan-frame-box').classList.remove('hidden');
  isProcessingScan = false;
  if (!isCameraActive) {
    try {
      await html5QrCode.start({ facingMode: activeCameraFacingMode }, { fps: 15, qrbox: 250 }, onScanSuccess);
      isCameraActive = true;
      document.getElementById('btn-camera-text').innerText = "Matikan Kamera";
    } catch (err) {
      console.error("Gagal memulai kamera:", err);
    }
  }
}

async function stopCamera() {
  if (html5QrCode && isCameraActive) {
    try {
      await html5QrCode.stop();
    } catch(e) {}
  }
  isCameraActive = false;
  document.getElementById('btn-camera-text').innerText = "Nyalakan Kamera";
  document.getElementById('camera-off-placeholder').classList.remove('hidden');
  document.getElementById('scan-frame-box').classList.add('hidden');
}

function toggleCameraState() { isCameraActive ? stopCamera() : initScanner(); }

async function nextScanAndAutoStartCamera() {
  isProcessingScan = false;
  toggleView('scanner');
  if (!isCameraActive) {
    await initScanner();
  }
}

async function onScanSuccess(text) {
  if (isProcessingScan) return; 
  isProcessingScan = true;

  playBeepSound();

  let nowDateObj = new Date();
  const year = nowDateObj.getFullYear();
  const month = String(nowDateObj.getMonth() + 1).padStart(2, '0');
  const day = String(nowDateObj.getDate()).padStart(2, '0');
  let dateStr = `${year}-${month}-${day}`;
  let timeStr = padZeroTime(nowDateObj.toTimeString().split(' ')[0].substring(0, 5));

  if (isManualTimeMode && customScanDateOverride && customScanTimeOverride) {
    dateStr = customScanDateOverride;
    timeStr = customScanTimeOverride;
    nowDateObj = new Date(dateStr + "T00:00:00");
  }

  const timeConfig = getTodayTimeConfig(nowDateObj);

  if (!timeConfig.active) {
    alert(`Presensi Ditolak! Hari ${timeConfig.dayKey.toUpperCase()} diatur sebagai Hari Libur / Non-Aktif.`);
    setTimeout(() => { isProcessingScan = false; }, 1500);
    return;
  }

  autoDetectOrSyncSessionMode(timeStr, nowDateObj);

  let computedStatus = "HADIR";

  if (currentScanSession === "PAGI") {
    if (timeStr < timeConfig.pStart) {
      alert(`Presensi Pagi Ditolak! Belum memasuki jam mulai pagi (${timeConfig.pStart}).`);
      setTimeout(() => { isProcessingScan = false; }, 1500);
      return;
    } else if (timeStr > timeConfig.pLimit) {
      computedStatus = "TERLAMBAT";
    }
  } else if (currentScanSession === "SIANG") {
    if (timeStr < timeConfig.sStart) {
      alert(`Presensi Siang Ditolak! Belum memasuki jam mulai siang (${timeConfig.sStart}).`);
      setTimeout(() => { isProcessingScan = false; }, 1500);
      return;
    } else if (timeStr > timeConfig.sLimit) {
      alert(`Presensi Siang Ditolak! Jam scan (${timeStr}) telah melewati batas waktu siang (${timeConfig.sLimit}).`);
      setTimeout(() => { isProcessingScan = false; }, 1500);
      return;
    }
  }

  const tx = db.transaction("students", "readonly");
  tx.objectStore("students").get(text.trim()).onsuccess = async (e) => {
    const student = e.target.result;
    if (student) {

      if (student.active !== undefined && student.active === false) {
        alert(`Presensi Gagal! Siswa (${student.nama}) berstatus NON-AKTIF.`);
        setTimeout(() => { isProcessingScan = false; }, 1500);
        return;
      }

      const queueId = `${dateStr}_${student.id_siswa}`;

      let existing = fetchedTodayAttendance.find(r => 
        String(r.id_siswa).trim().toUpperCase() === String(student.id_siswa).trim().toUpperCase() && 
        formatCleanDateLocal(r.tanggal) === dateStr
      );

      let jamPagi = existing ? (existing.jam_pagi || "") : "";
      let statusPagi = existing ? (existing.status_pagi || "") : "";
      let jamSiang = existing ? (existing.jam_siang || "") : "";
      let statusSiang = existing ? (existing.status_siang || "") : "";

      if (currentScanSession === "PAGI") {
        jamPagi = timeStr;
        statusPagi = computedStatus;
      } else if (currentScanSession === "SIANG") {
        jamSiang = timeStr;
        statusSiang = computedStatus;
      }

      let statusAkhir = computedStatus;
      if (existing && existing.status_pagi && currentScanSession === "SIANG") {
        statusAkhir = existing.status_pagi;
      }

      const record = {
        queue_id: queueId,
        tanggal: dateStr, 
        jam: timeStr, 
        id_siswa: student.id_siswa,
        nama: student.nama, 
        kelas: student.kelas, 
        sesi: currentScanSession,
        status_presensi: statusAkhir, 
        status_pagi: statusPagi,
        jam_pagi: jamPagi,
        status_siang: statusSiang,
        jam_siang: jamSiang,
        status_akhir: statusAkhir,
        timestamp: Date.now()
      };
      
      await saveToAttendanceQueue(record);
      await saveToLocalHistoryDB(record);

      fetchedTodayAttendance = fetchedTodayAttendance.filter(r => !(
        String(r.id_siswa).trim().toUpperCase() === String(student.id_siswa).trim().toUpperCase() && 
        formatCleanDateLocal(r.tanggal) === dateStr
      ));
      fetchedTodayAttendance.push(record);

      if (navigator.onLine) syncQueueToGAS();

      document.getElementById('res-nama').innerText = student.nama;
      document.getElementById('res-nisn').innerText = student.nisn || "-";
      document.getElementById('res-kelas').innerText = student.kelas;
      document.getElementById('res-jam-scan').innerText = timeStr;
      
      const statusCardBox = document.getElementById('status-card-box');
      const badgeBox = document.getElementById('res-badge-box');
      const statusText = document.getElementById('res-presensi-status');
      statusText.innerText = computedStatus;

      if (computedStatus === "TERLAMBAT") {
        statusCardBox.className = "bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center shadow-sm space-y-2";
        badgeBox.className = "text-amber-600 font-extrabold text-xl";
      } else {
        statusCardBox.className = "bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center shadow-sm space-y-2";
        badgeBox.className = "text-emerald-600 font-extrabold text-xl";
      }
      
      toggleView('success');

      setTimeout(async () => {
        await nextScanAndAutoStartCamera();
      }, 1800);

    } else {
      alert("Siswa tidak ditemukan!");
      setTimeout(() => { isProcessingScan = false; }, 1500);
    }
  };
}

function saveToAttendanceQueue(record) {
  return new Promise((resolve) => {
    const tx = db.transaction("attendance_queue", "readwrite");
    tx.objectStore("attendance_queue").put(record);
    tx.oncomplete = () => { updateQueueCountUI(); resolve(); };
  });
}

function saveToLocalHistoryDB(record) {
  return new Promise((resolve) => {
    if (!db) return resolve();
    const tx = db.transaction("attendance_history", "readwrite");
    tx.objectStore("attendance_history").put(record);
    tx.oncomplete = () => resolve();
  });
}

function getAllQueueFromDB() {
  return new Promise((resolve) => {
    if (!db) return resolve([]);
    const tx = db.transaction("attendance_queue", "readonly");
    tx.objectStore("attendance_queue").getAll().onsuccess = (e) => resolve(e.target.result || []);
  });
}

function getAllLocalHistoryFromDB() {
  return new Promise((resolve) => {
    if (!db) return resolve([]);
    const tx = db.transaction("attendance_history", "readonly");
    tx.objectStore("attendance_history").getAll().onsuccess = (e) => resolve(e.target.result || []);
  });
}

function updateQueueCountUI() {
  getAllQueueFromDB().then(recs => { document.getElementById('queue-count').innerText = recs.length; });
}

async function triggerManualSync() {
  if (!navigator.onLine) {
    alert("Perangkat sedang Offline. Pastikan koneksi internet terhubung untuk mengirim antrean!");
    return;
  }
  
  const btnSync = document.getElementById("btn-manual-sync");
  const originalHTML = btnSync.innerHTML;
  
  btnSync.disabled = true;
  btnSync.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-[10px]"></i><span>Mengirim...</span>`;
  
  await syncQueueToGAS();
  
  btnSync.disabled = false;
  btnSync.innerHTML = originalHTML;
}

async function syncQueueToGAS() {
  const queueData = await getAllQueueFromDB();
  if (queueData.length === 0) {
    document.getElementById("sync-info-text").innerText = "Antrean kosong (semua data tersimpan).";
    return;
  }

  try {
    const payload = queueData.map(q => ({
      LOG_ID: `${q.tanggal}-${q.id_siswa}`,
      TANGGAL: q.tanggal,
      ID_SISWA: q.id_siswa,
      NAMA_SISWA: q.nama,
      KELAS: q.kelas,
      JAM_PAGI: q.jam_pagi || (q.sesi === "PAGI" ? q.jam : null),
      STATUS_PAGI: q.status_pagi || (q.sesi === "PAGI" ? q.status_presensi : null),
      JAM_SIANG: q.jam_siang || (q.sesi === "SIANG" ? q.jam : null),
      STATUS_SIANG: q.status_siang || (q.sesi === "SIANG" ? q.status_presensi : null),
      STATUS_AKHIR: q.status_akhir || q.status_presensi
    }));

    const { error } = await supabaseClient.from('absensi_harian').upsert(payload, { onConflict: 'LOG_ID' });

    if (!error) {
      const tx = db.transaction("attendance_queue", "readwrite");
      const store = tx.objectStore("attendance_queue");
      queueData.forEach(q => store.delete(q.queue_id));
      
      tx.oncomplete = () => {
        updateQueueCountUI();
        document.getElementById("sync-info-text").innerText = "Berhasil terkirim ke Server!";
      };
    } else {
      console.error("Server Error:", error);
      alert("Gagal mengirim ke Server: " + error.message);
      document.getElementById("sync-info-text").innerText = "Gagal sinkron. Cek RLS / Koneksi.";
    }
  } catch (e) {
    console.error("Gagal sinkron ke Server:", e);
    alert("Terjadi kesalahan saat pengiriman data.");
  }
}

setInterval(() => {
  const isOnline = navigator.onLine;
  document.getElementById('status-dot').className = `w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-400' : 'bg-amber-400'} inline-block`;
  document.getElementById('status-text').innerText = isOnline ? 'Online' : 'Offline';

  refreshRealtimeSessionUI();
}, 1000);

window.addEventListener('online', () => {
  syncQueueToGAS();
  autoDownloadMasterStudents();
});

window.onload = async () => {
  const storedRole = localStorage.getItem("USER_ROLE");
  if (storedRole) currentUserRole = storedRole;
  updateRoleUI();

  const localSchoolName = localStorage.getItem("SCHOOL_NAME");
  const localAcadYear = localStorage.getItem("ACADEMIC_YEAR") || "2025/2026";
  if (localSchoolName) {
    document.getElementById("app-header-school-name").innerText = `${localSchoolName} (${localAcadYear})`;
    document.getElementById("input-school-name").value = localSchoolName;
    document.getElementById("input-academic-year").value = localAcadYear;
  }
  
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const todayRealStr = `${year}-${month}-${day}`;

  document.getElementById("monitoring-date-filter").value = todayRealStr;
  document.getElementById("dashboard-date-filter").value = todayRealStr;

  await initDatabase();
  await loadStudentsView();
  populateClassDropdowns();
  renderDaysConfigForm();
  
  if (navigator.onLine) {
    autoDownloadMasterStudents(todayRealStr);
  } else {
    loadLocalHistoryToMemory();
  }
  
  refreshRealtimeSessionUI();
};
