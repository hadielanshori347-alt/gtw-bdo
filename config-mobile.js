// ════════════════════════════════════════════
// CONFIG — GTW BDO Mobile v3.0
// ════════════════════════════════════════════

const CONFIG = {
  GAS_URL: "https://script.google.com/macros/s/AKfycbyx6oIwpEDP-HBU5zIXyqoCpOU877Zqb6woJrrjb7cFRdb23Iyjfjy0ncGkcci0QZJ-lQ/exec",
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
  ibScanned: [],

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
