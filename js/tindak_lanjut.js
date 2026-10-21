// ==========================================
// FILE: tindak_lanjut.js
// Pengelolaan Khusus Logika Tindak Lanjut Kedisiplinan Siswa
// ==========================================

let currentTLTab = "pending";

function switchTLTab(tabName) {
  currentTLTab = tabName;
  const btnPending = document.getElementById("tl-tab-btn-pending");
  const btnDone = document.getElementById("tl-tab-btn-done");

  if (tabName === "pending") {
    if (btnPending) btnPending.className = "flex-1 py-1.5 rounded-lg bg-white text-rose-700 shadow-sm transition";
    if (btnDone) btnDone.className = "flex-1 py-1.5 rounded-lg text-gray-600 transition";
  } else {
    if (btnDone) btnDone.className = "flex-1 py-1.5 rounded-lg bg-white text-emerald-700 shadow-sm transition";
    if (btnPending) btnPending.className = "flex-1 py-1.5 rounded-lg text-gray-600 transition";
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

async function renderTindakLanjutView() {
  const container = document.getElementById('tindak-lanjut-list-container');
  const classFilterEl = document.getElementById('tl-filter-class');
  const selectedClassFilter = classFilterEl ? classFilterEl.value : "ALL";

  if (!container) return;
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

    // Deteksi Akumulasi Alpa (Termasuk variasi penulisan)
    let totalAlpa = 0;
    stdRecords.forEach(r => {
      const stAkhir = String(r.status_akhir || r.status_presensi || "").trim().toUpperCase();
      if (stAkhir === "ALPA" || stAkhir === "ALPHA" || stAkhir === "A") totalAlpa++;
    });

    // Deteksi Terlambat Berturut-turut
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

    // Deteksi Bolos Berturut-turut
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

  const pBadge = document.getElementById("tl-count-pending");
  const dBadge = document.getElementById("tl-count-done");
  if (pBadge) pBadge.innerText = pendingItems.length;
  if (dBadge) dBadge.innerText = doneItems.length;

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
            <button onclick="openTLActionModal('${std.id_siswa}', '${std.nama}', '${item.categoryText}')" class="px-3 py-1.5