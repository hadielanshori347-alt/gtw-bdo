// ════════════════════════════════════════════
// CONFIG — GTW BDO Mobile v4.0 (Supabase)
// ════════════════════════════════════════════

const CONFIG = {
  // ── Ganti dua baris ini dengan kredensial Supabase kamu ──
  SUPABASE_URL: "https://mcsdhgzojydgytunixne.supabase.co",   // ← Project URL
  SUPABASE_KEY: "sb_publishable_I8tKjAoQ49RvG7uNIRZbaw_Z9knWECc",                 // ← anon public key

  TOAST_DURATION: 2500,
  SCAN_DEBOUNCE: 80,
};

// ════════════════════════════════════════════
// STATE — Global application state
// (tidak ada perubahan dari versi GAS)
// ════════════════════════════════════════════
const STATE = {
  masterData: {},
  obData: [], hvsData: [], ibData: [],
  globalIncharge: '',
  allIncharges: [],
  allScanAwbs: [],

  // Create form state
  createType: '',
  obScanMap: {},
  obActiveTuj: '',
  ibScanMap: {},
  ibActiveTuj: '',
  ibScanned: [],

  // Scanner state
  html5QrCode: null,
  isScannerRunning: false,
  flashOn: false,
  scanItems: [],
  scanContext: 'detail',

  // Detail state
  currentDetailItem: null,
  currentDetailType: '',
  currentNoTrack: '',
  currentSvc: '',
  currentTuj: '',

  // Photo state
  photoStream: null,
  capturedDataUrl: null,
  gpsCoords: null,

  // UI state
  sidebarOpen: false,
  currentTab: 'ob',
  currentPage: 'home',
  scbReg: {},
};
