// ════════════════════════════════════════════
// CONFIG — GTW BDO Mobile v3.0
// ════════════════════════════════════════════

const CONFIG = {
  GAS_URL: "https://script.google.com/macros/s/AKfycbyx1C0PFBJCo458FQY0op6acd1ZHQsaSi_yQ32ZVuIcV4UKIdRKvjoHQ_7TGJX5GN7Blw/exec",
  DRIVE_FOLDER_ID: "1v95v5hZ9jvfudYUCIO3qP8XdOCH9dqgu",
  SUPABASE_URL: "https://twhtgiexupzwbycemdee.supabase.co",
  SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3aHRnaWV4dXB6d2J5Y2VtZGVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDE1NzQsImV4cCI6MjA5NTM3NzU3NH0.A-j3mbhZUbs8trZLRmYAWG0NP_UY3Jh2u8FyZ5_IOnw",
  TOAST_DURATION: 2500,
  SCAN_DEBOUNCE: 80,
};

// ════════════════════════════════════════════
// STATE — Global application state
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
  ibScanMap: {},      // { tujuan: [awb, ...] } — multi-tujuan IB
  ibActiveTuj: '',    // tujuan aktif di tab IB
  ibScanned: [],      // legacy — tidak dipakai lagi

  // Scanner state
  html5QrCode: null,
  isScannerRunning: false,
  flashOn: false,
  scanItems: [],
  scanContext: 'detail', // 'detail' | 'create-ob' | 'create-ib'

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
