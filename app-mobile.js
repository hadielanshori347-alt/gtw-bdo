// ════════════════════════════════════════════
// APP.JS — Init & global glue
// ════════════════════════════════════════════

// ── Nav ──
function switchNav(tab) {
  ['home','search'].forEach(t => {
    document.getElementById('sbn' + t.charAt(0).toUpperCase() + t.slice(1))?.classList.toggle('active', t === tab);
  });
  if (tab === 'home') {
    UI.Page.show('pgHome');
  } else {
    UI.Page.show('pgSearch');
    setTimeout(() => document.getElementById('searchMainInp').focus(), 200);
  }
  UI.Sidebar.close();
}

// ── Reload ──
async function reloadAll() {
  UI.Loading.show('Memuat ulang...');
  try {
    await DataLoader.reloadAll();
    HomePage.render();
    HomePage.updateStats();
    UI.Loading.hide();
    UI.Toast.success('Data diperbarui');
  } catch(e) {
    UI.Loading.hide();
    UI.Toast.error('Gagal: ' + e.message);
  }
}

// ── Patch CreatePage untuk tombol rescan ──
CreatePage.rescanOb = function() {
  if (!STATE.obActiveTuj) { UI.Toast.error('Pilih tujuan dulu'); return; }
  Scanner.open('create-ob', 'Scan AWB', STATE.obActiveTuj);
};
CreatePage.rescanIb = function() {
  const tuj = UI.Scb.getValue('scbIbTuj');
  Scanner.open('create-ib', 'Scan AWB IB', tuj || 'IB');
};

// Patch selectType agar tombol rescan aktif setelah tujuan dipilih
const _origOnTujSelect = CreatePage.onTujSelect.bind(CreatePage);
CreatePage.onTujSelect = function(v) {
  _origOnTujSelect(v);
  const hasTuj = !!v;
  if (document.getElementById('btnAddTuj'))   document.getElementById('btnAddTuj').disabled   = !UI.Scb.getValue('scbSvc');
  if (document.getElementById('btnObRescan')) document.getElementById('btnObRescan').disabled = !hasTuj;
};

const _origOnIbSvcSelect = CreatePage.onIbSvcSelect.bind(CreatePage);
CreatePage.onIbSvcSelect = function(v) {
  _origOnIbSvcSelect(v);
};

// Update IB rescan button when FROM+TUJ filled
const _origCheckIbReady = CreatePage._checkIbReady.bind(CreatePage);
CreatePage._checkIbReady = function() {
  const ready = !!(UI.Scb.getValue('scbIbSvc') && UI.Scb.getValue('scbIbFrom') && UI.Scb.getValue('scbIbTuj'));
  if (document.getElementById('btnIbRescan')) document.getElementById('btnIbRescan').disabled = !ready;
  if (ready) setTimeout(() => Scanner.open('create-ib', 'Scan AWB IB', UI.Scb.getValue('scbIbTuj')), 200);
};

// ── Scanner for detail ──
// Override Scanner.open to handle 'detail' context (no label)
const _origScannerOpen = Scanner.open.bind(Scanner);
Scanner.open = function(context, title, ctxLabel) {
  if (context === 'detail') {
    STATE.scanContext = 'detail';
    STATE.scanItems = [];
    document.getElementById('scanTitle').innerText = title || STATE.currentNoTrack;
    document.getElementById('scanCtxBar').style.display = 'none';
    Scanner._updateUI();
    UI.Page.show('pgScan');
    Scanner._start();
    return;
  }
  _origScannerOpen(context, title, ctxLabel);
};

// Allow Scanner._stop to be called even when not running
Scanner._stop = Scanner._stop || function() {};

// ── INIT ──
window.addEventListener('DOMContentLoaded', async function() {
  // Prewarm camera
  navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then(s => s.getTracks().forEach(t => t.stop()))
    .catch(() => {});

  // Init all scbs
  UI.Scb.init('scbSvc',    'inpSvc',    'dropSvc',    [], v => {
    CreatePage.onSvcSelect(v);
    // enable tuj scb
    UI.Scb.setDisabled('scbTuj', !v);
    if (document.getElementById('btnAddTuj')) document.getElementById('btnAddTuj').disabled = !v;
  }, true);

  UI.Scb.init('scbTuj',    'inpTuj',    'dropTuj',    [], v => {
    CreatePage.onTujSelect(v);
  }, true);

  UI.Scb.init('scbIbSvc',  'inpIbSvc',  'dropIbSvc',  [], v => {
    CreatePage.onIbSvcSelect(v);
  }, true);

  UI.Scb.init('scbIbFrom', 'inpIbFrom', 'dropIbFrom', [], () => {
    CreatePage._checkIbReady();
    CreatePage._checkForm();
  }, true);

  UI.Scb.init('scbIbTuj',  'inpIbTuj',  'dropIbTuj',  [], v => {
    CreatePage._checkIbReady();
    CreatePage._checkForm();
  }, true);

  UI.Scb.init('scbNewTuj', 'inpNewTuj', 'dropNewTuj', [], () => {}, false);

  // Close modals when clicking overlay
  document.querySelectorAll('.modal-ov').forEach(el => {
    el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); });
  });

  // Load master data (blocking — needed for dropdowns)
  UI.Loading.show('Memuat master data...');
  try {
    await DataLoader.loadMaster();
  } catch(e) {
    UI.Toast.error('Gagal koneksi: ' + e.message);
  }
  UI.Loading.hide();

  // Load list data in background (non-blocking)
  DataLoader.loadLists()
    .then(() => {
      HomePage.render();
      HomePage.updateStats();
      DataLoader.loadScanAwbs();
    })
    .catch(e => UI.Toast.error('Gagal memuat list: ' + e.message));
});

// ── PWA Service Worker ──
if ('serviceWorker' in navigator) {
  const SW = `const CACHE='gtw-bdo-v3';self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/'))));});self.addEventListener('fetch',e=>{e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));});`;
  const blob = new Blob([SW], { type: 'application/javascript' });
  navigator.serviceWorker.register(URL.createObjectURL(blob)).catch(() => {});
}
