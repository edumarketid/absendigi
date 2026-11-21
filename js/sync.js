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
    const { data: allAttendanceData } = await supabaseClient.from('absensi_harian').select('*');
    const { data: tlData } = await supabaseClient.from('tindak_lanjut').select('*');

    const { data: timeData } = await supabaseClient.from('pengaturan_waktu').select('*');
    if (timeData && Array.isArray(timeData) && timeData.length > 0) {
      const timeObj = {};
      timeData.forEach(t => {
        const k = t.kunci_waktu || t.KUNCI_WAKTU;
        const v = t.nilai || t.NILAI;
        if (k) timeObj[k] = v;
      });
      applyTimeSettingsFromCloud(timeObj);
    }

    const { data: configData } = await supabaseClient.from('pengaturan').select('*');
    if (configData && Array.isArray(configData) && configData.length > 0) {
      const cfgMap = {};
      configData.forEach(c => {
        const k = c.kunci || c.KUNCI;
        const v = c.nilai || c.NILAI;
        if (k) cfgMap[k] = v;
      });

      const schoolName = cfgMap.SCHOOL_NAME || localStorage.getItem("SCHOOL_NAME") || "";
      const academicYear = cfgMap.ACADEMIC_YEAR || localStorage.getItem("ACADEMIC_YEAR") || "2026/2027";
      const principalName = cfgMap.PRINCIPAL_NAME || localStorage.getItem("PRINCIPAL_NAME") || "";
      const principalNip = cfgMap.PRINCIPAL_NIP || localStorage.getItem("PRINCIPAL_NIP") || "";

      if (schoolName) {
        localStorage.setItem("SCHOOL_NAME", schoolName);
        localStorage.setItem("ACADEMIC_YEAR", academicYear);
        localStorage.setItem("PRINCIPAL_NAME", principalName);
        localStorage.setItem("PRINCIPAL_NIP", principalNip);

        const headerEl = document.getElementById("app-header-school-name");
        const nameInput = document.getElementById("input-school-name");
        const yearInput = document.getElementById("input-academic-year");
        const prinNameInput = document.getElementById("input-principal-name");
        const prinNipInput = document.getElementById("input-principal-nip");

        if (headerEl) headerEl.innerText = `${schoolName} (${academicYear})`;
        if (nameInput) nameInput.value = schoolName;
        if (yearInput) yearInput.value = academicYear;
        if (prinNameInput) prinNameInput.value = principalName;
        if (prinNipInput) prinNipInput.value = principalNip;
      }
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

    if (allAttendanceData && Array.isArray(allAttendanceData)) {
      const normalizedHistory = allAttendanceData.map(a => {
        const tgl = formatCleanDateLocal(a.TANGGAL || a.tanggal);
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

      fetchedAttendanceHistory = normalizedHistory;
      fetchedTodayAttendance = normalizedHistory.filter(r => r.tanggal === targetDateStr);
    } else {
      fetchedAttendanceHistory = [];
      fetchedTodayAttendance = [];
    }

    if (tlData && Array.isArray(tlData)) {
      const cloudTLStore = {};
      tlData.forEach(row => {
        const idS = String(row.ID_SISWA || row.id_siswa || "").trim();
        if (idS) {
          cloudTLStore[idS] = {
            tanggal: row.TANGGAL || row.tanggal || "",
            catatan: row.CATATAN || row.catatan || "",
            kategori: row.KATEGORI || row.kategori || ""
          };
        }
      });
      localStorage.setItem("TL_STATUS_STORE", JSON.stringify(cloudTLStore));
    }

    updateMonitoringDashboard();
    renderDashboardView();

  } catch (e) {
    console.error("Gagal memuat data dari Server:", e);
    loadLocalHistoryToMemory();
  }
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
  const infoEl = document.getElementById("sync-info-text");
  if (queueData.length === 0) {
    if (infoEl) infoEl.innerText = "Antrean kosong (semua data tersimpan).";
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
        if (infoEl) infoEl.innerText = "Berhasil terkirim ke Server!";
      };
    } else {
      console.error("Server Error:", error);
      alert("Gagal mengirim ke Server: " + error.message);
      if (infoEl) infoEl.innerText = "Gagal sinkron. Cek RLS / Koneksi.";
    }
  } catch (e) {
    console.error("Gagal sinkron ke Server:", e);
    alert("Terjadi kesalahan saat pengiriman data.");
  }
}