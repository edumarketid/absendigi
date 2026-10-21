// SUPABASE CLIENT INITIALIZATION (Pusat Kendali via localStorage)
const DEFAULT_SUPABASE_URL = "https://nbwpnhshhpfqtmbwewgk.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5id3BuaHNoaHBmcXRtYndld2drIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MTQ1ODUsImV4cCI6MjEwNzk5MDU4NX0.2Ah6o8svWPMDEI1O3zOxytNyqBIjED7GXTxowNm1Ai4";

if (!localStorage.getItem("SUPABASE_URL")) {
  localStorage.setItem("SUPABASE_URL", DEFAULT_SUPABASE_URL);
}
if (!localStorage.getItem("SUPABASE_ANON_KEY")) {
  localStorage.setItem("SUPABASE_ANON_KEY", DEFAULT_SUPABASE_ANON_KEY);
}

const SUPABASE_URL = localStorage.getItem("SUPABASE_URL");
const SUPABASE_ANON_KEY = localStorage.getItem("SUPABASE_ANON_KEY");
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State Global Aplikasi
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