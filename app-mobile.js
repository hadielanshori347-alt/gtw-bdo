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
    if (!STATE.ibActiveTuj) { UI.Toast.error('Pilih tujuan IB dulu'); return; }
    Scanner.open('create-ib', 'Scan AWB IB', STATE.ibActiveTuj);
  };
  
  // Patch selectType agar tombol rescan aktif setelah tujuan dipilih
  const _origOnTujSelect = CreatePage.onTujSelect.bind(CreatePage);
  CreatePage.onTujSelect = function(v) {
    _origOnTujSelect(v);
    const hasTuj = !!v;
    if (document.getElementById('btnAddTuj'))   document.getElementById('btnAddTuj').disabled   = !UI.Scb.getValue('scbSvc');
    if (document.getElementById('btnObRescan')) document.getElementById('btnObRescan').disabled = !hasTuj;
  };
  
  // Update IB rescan button — dihandle langsung di pages-mobile.js (onIbTujSelect)
  
  // ── Scanner for detail ──
  // Override Scanner.open to handle 'detail' context (no label)
  const _origScannerOpen = Scanner.open.bind(Scanner);
  Scanner.open = function(context, title, ctxLabel) {
    if (context === 'detail') {
      STATE.scanContext = 'detail';
      STATE.scanItems = [];
      document.getElementById('scanTitle').innerText = title || STATE.currentNoTrack;
      document.getElementById('scanCtxBar').style.display = 'none';
      Scanner._renderTujCombobox();
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
    }, false);
  
    UI.Scb.init('scbIbSvc',  'inpIbSvc',  'dropIbSvc',  [], v => {
      CreatePage.onIbSvcSelect(v);
    }, false);
  
    UI.Scb.init('scbIbFrom', 'inpIbFrom', 'dropIbFrom', [], v => {
      CreatePage.onIbFromSelect(v);
    }, true);
  
    UI.Scb.init('scbIbTuj',  'inpIbTuj',  'dropIbTuj',  [], v => {
      CreatePage.onIbTujSelect(v);
    }, false);
  
    UI.Scb.init('scbNewTuj',   'inpNewTuj',   'dropNewTuj',   [], () => {}, false);
    UI.Scb.init('scbNewIbTuj', 'inpNewIbTuj', 'dropNewIbTuj', [], () => {}, false);
  
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
  
  const _origPageShow = UI.Page.show.bind(UI.Page);
  UI.Page.show = function(id) {
    _origPageShow(id);
    if (id !== 'pgHome') {
      history.pushState({ page: id }, '', '');
    }
  };
  
  // Intercept tombol back Android
  window.addEventListener('popstate', function() {
    const cur = STATE.currentPage;
  
    // 1. Sidebar terbuka → tutup sidebar
    if (STATE.sidebarOpen) {
      UI.Sidebar.close();
      history.pushState({}, '', '');
      return;
    }
  
    // 2. Modal terbuka → tutup modal
    const modals = ['icModal','tujModal','ibTujModal','awbModal','scanMenuModal','dataListModal'];
    for (const m of modals) {
      const el = document.getElementById(m);
      if (el && el.classList.contains('open')) {
        UI.Modal.close(m);
        history.pushState({}, '', '');
        return;
      }
    }
  
    // 3. Foto fullscreen → tutup
    const fotoFull = document.getElementById('fotoFullModal');
    if (fotoFull && fotoFull.classList.contains('open')) {
      FotoFull.close();
      history.pushState({}, '', '');
      return;
    }
  
    // 4. Dropdown menu → tutup
    const dd = document.getElementById('ddMenu');
    if (dd && dd.classList.contains('open')) {
      UI.Menu.close();
      history.pushState({}, '', '');
      return;
    }
  
    // 5. Navigasi antar halaman
    if (cur === 'pgScan')   { Scanner.close();    history.pushState({}, '', ''); return; }
    if (cur === 'pgPhoto')  { Photo.close();      history.pushState({}, '', ''); return; }
    if (cur === 'pgDetail') { DetailPage.close(); history.pushState({}, '', ''); return; }
    if (cur === 'pgCreate') { CreatePage.close(); history.pushState({}, '', ''); return; }
    if (cur === 'pgSearch') { switchNav('home');  history.pushState({}, '', ''); return; }
  
    // 6. Sudah di Home → konfirmasi keluar
    if (cur === 'pgHome') {
      if (confirm('Keluar dari aplikasi?')) {
        history.back();
      } else {
        history.pushState({}, '', '');
      }
    }
  });
  
  // Push state awal agar ada entry di history
  history.pushState({}, '', '');
  
  // ── PWA Service Worker ──
  if ('serviceWorker' in navigator) {
    const SW = `const CACHE='gtw-bdo-v3';self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/'))));});self.addEventListener('fetch',e=>{e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));});`;
    const blob = new Blob([SW], { type: 'application/javascript' });
    navigator.serviceWorker.register(URL.createObjectURL(blob)).catch(() => {});
  }
