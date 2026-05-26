// ════════════════════════════════════════════
// CONFIG — GTW BDO Mobile v3.0
// ════════════════════════════════════════════

const CONFIG = {
  GAS_URL: "https://script.google.com/macros/s/AKfycbxhIfBB2qq7A-mSVSEJMhfMZhL-xaeI715rUgM8tPPHq8VM7a7UKOf-T8UhCMN1CE10hQ/exec",
  DRIVE_FOLDER_ID: "1v95v5hZ9jvfudYUCIO3qP8XdOCH9dqgu",
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
