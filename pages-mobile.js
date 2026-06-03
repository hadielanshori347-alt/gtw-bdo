// ════════════════════════════════════════════
// HOME PAGE — Dashboard 2x2 Grid
// ════════════════════════════════════════════
const HomePage = {

const HomePage = {

render() {
  const el = document.getElementById('homeList');
  el.innerHTML = `
    <div class="app-grid">

      <div class="app-icon-wrap" onclick="HomePage.openScanMenu()">
        <div class="app-icon app-icon-scan">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </div>
        <div class="app-icon-label">Scan AWB</div>
      </div>

      <div class="app-icon-wrap" onclick="switchNav('search')">
        <div class="app-icon app-icon-search">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>
        <div class="app-icon-label">Cari AWB</div>
      </div>

      <div class="app-icon-wrap" onclick="HomePage.openDataList('semua')">
        <div class="app-icon app-icon-semua">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"/>
            <line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/>
            <line x1="3" y1="12" x2="3.01" y2="12"/>
            <line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
        </div>
        <div class="app-icon-label">Semua</div>
      </div>
        <div class="app-icon-badge" id="dashSemuaBadge" style="display:none"></div>

      <div class="app-icon-wrap" onclick="typeof QrMobile !== 'undefined' && QrMobile.open()">
        <div class="app-icon app-icon-qr">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.8"/>
            <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.8"/>
            <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.8"/>
            <path d="M14 14h2v2h-2zM18 14h3M14 18h3M18 18v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="app-icon-label">QR Table</div>
      </div>

    </div>`;

  HomePage.updateStats();
},

updateStats() {
  const now = new Date();
  const today = new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const all   = [...STATE.obData, ...STATE.hvsData, ...STATE.ibData];
  let filtered = STATE.globalIncharge ? all.filter(d => d.incharge === STATE.globalIncharge) : [...all];

  const mode = STATE.homeMode || 'harian';
  if (mode === 'harian') {
    filtered = filtered.filter(d => (d.created_date || '').slice(0, 10) === today);
  }

  const totalAwb = filtered.reduce((s, x) => s + (+x.total_awb || 0), 0);
  document.getElementById('statAwb').innerText     = totalAwb;
  document.getElementById('statSelesai').innerText = filtered.filter(x => x.status === 'SELESAI').length;
  document.getElementById('statProses').innerText  = filtered.filter(x => x.status !== 'SELESAI').length;

  // Sync tombol switch
  document.getElementById('homeSwitchHarian')?.classList.toggle('active', mode === 'harian');
  document.getElementById('homeSwitchSemua')?.classList.toggle('active', mode === 'semua');
},

switchHomeMode(mode) {
  STATE.homeMode = mode;
  HomePage.updateStats();
},

switchTab(t) {
  STATE.currentTab = t;
  ['ob','hvs','ib'].forEach(x => {
    document.getElementById('sbn' + x.charAt(0).toUpperCase() + x.slice(1))
      ?.classList.toggle('active', x === t);
  });
},

  // ── Scan Menu — pilih OB / HVS / IB ──
  openScanMenu() {
  if (!STATE.globalIncharge) { UI.Toast.error('Pilih Incharge dulu'); IcModal.open(); return; }
  CreatePage.open();
},
  
  selectScanType(t) {
    document.getElementById('scanMenuModal').classList.remove('open');
    STATE.createType = t;
    CreatePage.open();
    setTimeout(() => CreatePage.selectType(t), 80);
  },

  switchDataMode(mode) {
    STATE.dataListMode = mode;
    document.getElementById('dlSwitchHarian')?.classList.toggle('active', mode === 'harian');
    document.getElementById('dlSwitchSemua')?.classList.toggle('active', mode === 'semua');
    HomePage._renderDataList();
  },

  openDataList(mode) {
    STATE.dataListMode = mode;
    STATE.dataListTab  = STATE.currentTab || 'ob';
    document.getElementById('dlSwitchHarian')?.classList.toggle('active', mode === 'harian');
    document.getElementById('dlSwitchSemua')?.classList.toggle('active', mode === 'semua');
    HomePage._renderDataList();
    document.getElementById('dataListModal').classList.add('open');
  },

  _renderDataList() {
    const mode  = STATE.dataListMode;
    const tab   = STATE.dataListTab;
    const now = new Date();
    const today = new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const arr = tab === 'ob' ? STATE.obData : tab === 'hvs' ? STATE.hvsData : STATE.ibData;
    let data  = STATE.globalIncharge ? arr.filter(d => d.incharge === STATE.globalIncharge) : [...arr];

    if (mode === 'harian') {
      data = data.filter(d => (d.created_date || '').slice(0, 10) === today);
    }

    ['ob','hvs','ib'].forEach(x => {
      document.getElementById('dlTab' + x.toUpperCase())
        ?.classList.toggle('active', x === tab);
    });

    document.getElementById('dataListTitle').innerText =
      mode === 'harian' ? 'Data Harian' : 'Semua Data';

    // Update stats modal
    const totalAwb = data.reduce((s, x) => s + (+x.total_awb || 0), 0);
    document.getElementById('dlStatAwb').innerText     = totalAwb;
    document.getElementById('dlStatSelesai').innerText = data.filter(x => x.status === 'SELESAI').length;
    document.getElementById('dlStatProses').innerText  = data.filter(x => x.status !== 'SELESAI').length;

    const el = document.getElementById('dataListBody');
    if (!data.length) {
      el.innerHTML = `<div class="scan-empty" style="padding:32px">
        ${mode === 'harian' ? 'Tidak ada data hari ini' : 'Tidak ada data'}
      </div>`;
      return;
    }

    el.innerHTML = data.map(d => {
      const isProses = d.status !== 'SELESAI';
      const badge    = isProses
        ? '<span class="badge badge-proses">● On Proses</span>'
        : '<span class="badge badge-selesai">✓ Selesai</span>';
      const tujLabel = (d.from ? `Dari: ${d.from} → ` : '') + d.tujuan;
      const svcBadge = tab === 'hvs'
        ? `<span class="badge badge-purple">${escH(d.service)}</span>`
        : `<span class="badge badge-blue">${escH(d.service)}</span>`;

      return `<div class="card" onclick="HomePage._openDetail('${tab}','${escQ(d.no_track)}')">
        <div class="card-inner">
          <div class="card-top">
            <div class="card-no">${escH(d.no_track)}</div>
            ${badge}
          </div>
          <div class="card-sub">${svcBadge} ${escH(tujLabel)}</div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px">
            <span class="badge badge-awb">${d.total_awb} AWB</span>
            <span style="font-size:11px;color:var(--text3)">${escH(d.created_date)}</span>
          </div>
          ${isProses ? `<div style="margin-top:10px"><button class="btn-selesai" onclick="event.stopPropagation();HomePage.quickSelesai('${tab}','${escQ(d.no_track)}')">✓ Selesai</button></div>` : ''}
        </div>
      </div>`;
    }).join('');
  },

  _openDetail(type, noTrack) {
    document.getElementById('dataListModal').classList.remove('open');
    setTimeout(() => DetailPage.open(type, noTrack), 180);
  },

  switchDataListTab(t) {
    STATE.dataListTab = t;
    STATE.currentTab  = t;
    ['ob','hvs','ib'].forEach(x => {
      document.getElementById('dlTab' + x.toUpperCase())
        ?.classList.toggle('active', x === t);
    });
    HomePage._renderDataList();
  },

  async quickSelesai(type, noTrack) {
    if (!confirm('Tandai ' + noTrack + ' sebagai SELESAI?')) return;
    UI.Loading.show('Mengubah status...');
    const action = type === 'ob' ? 'updateObStatus' : type === 'hvs' ? 'updateHvsStatus' : 'updateIbStatus';
    try {
      const res = await API.post(action, { noTrack, newStatus: 'SELESAI' });
      UI.Loading.hide();
      if (res.success) {
        const arr  = type === 'ob' ? STATE.obData : type === 'hvs' ? STATE.hvsData : STATE.ibData;
        const item = arr.find(d => d.no_track === noTrack);
        if (item) item.status = 'SELESAI';
        HomePage._renderDataList();
        HomePage.updateStats();
        UI.Toast.success('Status → SELESAI');
      } else UI.Toast.error('Gagal: ' + (res.error || ''));
    } catch(e) { UI.Loading.hide(); UI.Toast.error('Error: ' + e.message); }
  }
};
// ════════════════════════════════════════════
// CREATE PAGE
// ════════════════════════════════════════════
const CreatePage = {
  open() {
    STATE.createType = '';
    CreatePage._resetObForm();
    CreatePage._resetIbForm();
    document.getElementById('formObHvs').style.display  = 'none';
    document.getElementById('formIb').style.display     = 'none';
    document.getElementById('createActions').style.display = 'none';
    ['tcOb','tcHvs','tcIb'].forEach(id => document.getElementById(id).className = 'type-card');
    CreatePage._updateWarn();
    UI.Page.show('pgCreate');
    UI.Sidebar.close();
  },

  close() {
    Scanner._stop?.();
    UI.Page.show('pgHome');
  },

  _updateWarn() {
    const has = !!STATE.globalIncharge;
    document.getElementById('createWarnBar').style.display = has ? 'none' : '';
    document.getElementById('createInfoBar').style.display = has ? '' : 'none';
    if (has) document.getElementById('createIcDisplay').innerText = STATE.globalIncharge;
  },

  selectType(t) {
    if (!STATE.globalIncharge) { UI.Toast.error('Pilih Incharge dulu'); return; }
    STATE.createType = t;
    ['ob','hvs','ib'].forEach(x => {
      document.getElementById('tc' + x.charAt(0).toUpperCase() + x.slice(1)).className = 'type-card' + (x === t ? ' sel-' + x : '');
    });
    document.getElementById('formObHvs').style.display     = (t === 'ob' || t === 'hvs') ? '' : 'none';
    document.getElementById('formIb').style.display        = (t === 'ib') ? '' : 'none';
    document.getElementById('createActions').style.display = 'flex';

    // Render form state tanpa auto-buka scanner
    if (t === 'ob' || t === 'hvs') {
      CreatePage._checkObForm();
      CreatePage.renderObTabs();
      CreatePage.renderObScanList();
    } else {
      CreatePage._checkIbReady();
      CreatePage.renderIbTabs();
      CreatePage.renderIbScanList();
    }
    CreatePage._checkForm();
  },

  // ── OB/HVS Logic ──
  onSvcSelect(v) {
    const has = !!v;
    UI.Scb.setDisabled('scbTuj', !has);
    if (!has) { UI.Scb.reset('scbTuj'); STATE.obScanMap = {}; STATE.obActiveTuj = ''; }
    CreatePage.renderObTabs();
    CreatePage.renderObScanList();
    CreatePage._checkForm();
  },

  onTujSelect(v) {
    if (v && !STATE.obScanMap[v]) STATE.obScanMap[v] = [];
    STATE.obActiveTuj = v;
    CreatePage.renderObTabs();
    CreatePage.renderObScanList();
    CreatePage._checkForm();
  },

  renderObTabs() {
    const keys = Object.keys(STATE.obScanMap);
    document.getElementById('obTabs').innerHTML = keys.map(t =>
      `<div class="scan-tab${t === STATE.obActiveTuj ? ' active' : ''}" onclick="CreatePage.switchObTuj('${escQ(t)}')">
        ${escH(t)} <span class="cnt">${STATE.obScanMap[t].length}</span>
        <span class="rm" onclick="event.stopPropagation();CreatePage.removeObTuj('${escQ(t)}')">✕</span>
      </div>`
    ).join('');
    CreatePage._updateObTotal();
  },

  switchObTuj(t) {
    STATE.obActiveTuj = t;
    CreatePage.renderObTabs();
    CreatePage.renderObScanList();
  },

  removeObTuj(t) {
    delete STATE.obScanMap[t];
    const k = Object.keys(STATE.obScanMap);
    STATE.obActiveTuj = k.length ? k[0] : '';
    CreatePage.renderObTabs();
    CreatePage.renderObScanList();
    CreatePage._checkForm();
  },

  renderObScanList() {
    const el = document.getElementById('obScanList');
    if (!STATE.obActiveTuj || !STATE.obScanMap[STATE.obActiveTuj]) {
      el.innerHTML = '<div class="scan-empty">Pilih tujuan dulu</div>';
      return;
    }
    const arr = STATE.obScanMap[STATE.obActiveTuj];
    el.innerHTML = arr.length
      ? arr.map((awb, i) => `<div class="scan-item"><span>${escH(awb)}</span><span class="scan-item-del" onclick="CreatePage.removeObAwb(${i})">🗑</span></div>`).join('')
      : `<div class="scan-empty">Belum ada AWB untuk <b>${escH(STATE.obActiveTuj)}</b></div>`;
  },

  removeObAwb(i) {
    STATE.obScanMap[STATE.obActiveTuj].splice(i, 1);
    CreatePage.renderObTabs();
    CreatePage.renderObScanList();
  },

  _updateObTotal() {
    const t = Object.values(STATE.obScanMap).reduce((s, a) => s + a.length, 0);
    document.getElementById('obTotalLabel').innerText = t + ' AWB total';
  },

  _checkObForm() {
    const hasSvc = !!UI.Scb.getValue('scbSvc');
    const hasTuj = Object.keys(STATE.obScanMap).length > 0;
    document.getElementById('btnSave').disabled = !(STATE.globalIncharge && hasSvc && hasTuj);
  },

  // ── IB Logic — multi-tujuan (mirip OB) ──
  onIbSvcSelect(v) {
    const has = !!v;
    UI.Scb.setDisabled('scbIbFrom', !has);
    UI.Scb.setDisabled('scbIbTuj',  !has);
    if (!has) {
      UI.Scb.reset('scbIbFrom');
      UI.Scb.reset('scbIbTuj');
      STATE.ibScanMap   = {};
      STATE.ibActiveTuj = '';
    }
    CreatePage.renderIbTabs();
    CreatePage.renderIbScanList();
    CreatePage._checkIbReady();
    CreatePage._checkForm();
  },

  onIbFromSelect(v) {
    const hasSvcFrom = !!(UI.Scb.getValue('scbIbSvc') && v);
    UI.Scb.setDisabled('scbIbTuj', !hasSvcFrom);
    if (!hasSvcFrom) { UI.Scb.reset('scbIbTuj'); }
    CreatePage._checkIbReady();
    CreatePage._checkForm();
  },

  onIbTujSelect(v) {
    if (v && !STATE.ibScanMap[v]) STATE.ibScanMap[v] = [];
    STATE.ibActiveTuj = v;
    CreatePage.renderIbTabs();
    CreatePage.renderIbScanList();
    // Enable tombol tambah tujuan lain & rescan
    const hasSvcFrom = !!(UI.Scb.getValue('scbIbSvc') && UI.Scb.getValue('scbIbFrom'));
    if (document.getElementById('btnAddIbTuj')) document.getElementById('btnAddIbTuj').disabled = !hasSvcFrom;
    if (document.getElementById('btnIbRescan')) document.getElementById('btnIbRescan').disabled = !v;
    CreatePage._checkForm();
  },

  renderIbTabs() {
    const keys = Object.keys(STATE.ibScanMap);
    document.getElementById('ibTabs').innerHTML = keys.map(t =>
      `<div class="scan-tab${t === STATE.ibActiveTuj ? ' active' : ''}" onclick="CreatePage.switchIbTuj('${escQ(t)}')">
        ${escH(t)} <span class="cnt">${STATE.ibScanMap[t].length}</span>
        <span class="rm" onclick="event.stopPropagation();CreatePage.removeIbTuj('${escQ(t)}')">✕</span>
      </div>`
    ).join('');
    CreatePage._updateIbTotal();
  },

  switchIbTuj(t) {
    STATE.ibActiveTuj = t;
    CreatePage.renderIbTabs();
    CreatePage.renderIbScanList();
  },

  removeIbTuj(t) {
    delete STATE.ibScanMap[t];
    const k = Object.keys(STATE.ibScanMap);
    STATE.ibActiveTuj = k.length ? k[0] : '';
    // Sync scbIbTuj combobox ke tujuan aktif
    UI.Scb.setValue('scbIbTuj', STATE.ibActiveTuj);
    CreatePage.renderIbTabs();
    CreatePage.renderIbScanList();
    CreatePage._checkForm();
  },

  renderIbScanList() {
    const el = document.getElementById('ibScanList');
    if (!STATE.ibActiveTuj || !STATE.ibScanMap[STATE.ibActiveTuj]) {
      el.innerHTML = '<div class="scan-empty">Pilih tujuan dulu</div>';
      CreatePage._updateIbTotal();
      return;
    }
    const arr = STATE.ibScanMap[STATE.ibActiveTuj];
    el.innerHTML = arr.length
      ? arr.map((awb, i) =>
          `<div class="scan-item"><span>${escH(awb)}</span><span class="scan-item-del" onclick="CreatePage.removeIbAwb(${i})">🗑</span></div>`
        ).join('')
      : `<div class="scan-empty">Belum ada AWB untuk <b>${escH(STATE.ibActiveTuj)}</b></div>`;
    CreatePage._updateIbTotal();
  },

  removeIbAwb(i) {
    STATE.ibScanMap[STATE.ibActiveTuj].splice(i, 1);
    CreatePage.renderIbTabs();
    CreatePage.renderIbScanList();
  },

  _updateIbTotal() {
    const t = Object.values(STATE.ibScanMap).reduce((s, a) => s + a.length, 0);
    document.getElementById('ibTotalLabel').innerText = t + ' AWB total';
  },

  // ── Add Tujuan IB Modal ──
  openAddIbTujModal() {
    const hasSvcFrom = !!(UI.Scb.getValue('scbIbSvc') && UI.Scb.getValue('scbIbFrom'));
    if (!hasSvcFrom) { UI.Toast.error('Pilih SERVICE & FROM dulu'); return; }
    document.getElementById('inpNewIbTuj').value = '';
    const ic  = STATE.globalIncharge;
    const ib  = (STATE.masterData.ibData || {})[ic] || {};
    UI.Scb.setOptions('scbNewIbTuj', ib.tujuans || []);
    UI.Modal.open('ibTujModal');
    setTimeout(() => document.getElementById('inpNewIbTuj').focus(), 200);
  },

  // ── Dipanggil dari Scanner — buka modal tambah tujuan IB ──
  openAddIbTujFromScanner() {
    CreatePage.openAddIbTujModal();
  },

  closeIbTujModal() { UI.Modal.close('ibTujModal'); },

  confirmAddIbTuj() {
    const tuj = document.getElementById('inpNewIbTuj').value.trim();
    if (!tuj) { UI.Toast.error('Masukkan tujuan'); return; }
    CreatePage.closeIbTujModal();
    if (!STATE.ibScanMap[tuj]) STATE.ibScanMap[tuj] = [];
    STATE.ibActiveTuj = tuj;
    UI.Scb.setValue('scbIbTuj', tuj);
    CreatePage.renderIbTabs();
    CreatePage.renderIbScanList();
    CreatePage._checkForm();
    // Refresh combobox di scanner jika scanner sedang aktif
    if (STATE.currentPage === 'pgScan') Scanner.refreshTujCombobox();
  },

  _checkIbReady() {
  const hasSvc  = !!UI.Scb.getValue('scbIbSvc');
  const hasFrom = !!UI.Scb.getValue('scbIbFrom');
  if (document.getElementById('btnAddIbTuj')) document.getElementById('btnAddIbTuj').disabled = !(hasSvc && hasFrom);
},

  _checkForm() {
    if (STATE.createType === 'ob' || STATE.createType === 'hvs') CreatePage._checkObForm();
    else if (STATE.createType === 'ib') {
      const hasTuj = Object.keys(STATE.ibScanMap).length > 0;
      const ok = !!(STATE.globalIncharge && UI.Scb.getValue('scbIbSvc') && UI.Scb.getValue('scbIbFrom') && hasTuj);
      document.getElementById('btnSave').disabled = !ok;
    }
  },

  // ── Add Tujuan Modal ──
  openAddTujModal() {
    if (!UI.Scb.getValue('scbSvc')) { UI.Toast.error('Pilih SERVICE dulu'); return; }
    document.getElementById('inpNewTuj').value = '';
    const opts = (STATE.masterData.obData || {})[STATE.globalIncharge] || {};
    UI.Scb.setOptions('scbNewTuj', opts.tujuans || []);
    UI.Modal.open('tujModal');
    setTimeout(() => document.getElementById('inpNewTuj').focus(), 200);
  },

  // ── Dipanggil dari Scanner — buka modal tambah tujuan OB ──
  openAddTujFromScanner() {
    CreatePage.openAddTujModal();
  },

  closeTujModal() { UI.Modal.close('tujModal'); },

  confirmAddTuj() {
    const tuj = document.getElementById('inpNewTuj').value.trim();
    if (!tuj) { UI.Toast.error('Masukkan tujuan'); return; }
    CreatePage.closeTujModal();
    if (!STATE.obScanMap[tuj]) STATE.obScanMap[tuj] = [];
    STATE.obActiveTuj = tuj;
    UI.Scb.setValue('scbTuj', tuj);
    CreatePage.renderObTabs();
    CreatePage.renderObScanList();
    CreatePage._checkForm();
    // Refresh combobox di scanner jika scanner sedang aktif
    if (STATE.currentPage === 'pgScan') Scanner.refreshTujCombobox();
  },

  // Scan OB dari detail (rescan)
  rescanOb() {
    const svc = UI.Scb.getValue('scbSvc');
    if (!svc || !STATE.obActiveTuj) { UI.Toast.error('Pilih service & tujuan dulu'); return; }
    STATE.scanContext = 'create-ob';
    STATE.scanItems   = [];
    Scanner.open('create-ob', 'Scan OB', STATE.obActiveTuj);
  },

  // Scan IB dari detail (rescan)
  rescanIb() {
    const svc  = UI.Scb.getValue('scbIbSvc');
    const from = UI.Scb.getValue('scbIbFrom');
    if (!svc || !from || !STATE.ibActiveTuj) { UI.Toast.error('Pilih service, from & tujuan dulu'); return; }
    STATE.scanContext = 'create-ib';
    STATE.scanItems   = [];
    Scanner.open('create-ib', 'Scan IB', STATE.ibActiveTuj);
  },

  // ── Save — buat tracking dulu, lalu buka scanner ──
  async doSave() {
    if (STATE.createType === 'ob' || STATE.createType === 'hvs') await CreatePage._saveObHvs();
    else await CreatePage._saveIb();
  },

  async _saveObHvs() {
    const service = UI.Scb.getValue('scbSvc');
    if (!STATE.globalIncharge || !service) return;
    const keys = Object.keys(STATE.obScanMap);
    if (!keys.length) { UI.Toast.error('Tambahkan minimal 1 tujuan'); return; }

    UI.Loading.show('Menyimpan...');
    const action = STATE.createType === 'ob' ? 'saveOb' : 'saveHvs';
    try {
      const results = await Promise.all(keys.map(tuj =>
        API.post(action, { incharge: STATE.globalIncharge, service, tujuan: tuj, awbList: [] })
      ));
      UI.Loading.hide();
      const errs = results.filter(r => r.error);
      if (errs.length) { UI.Toast.error('Error: ' + errs[0].error); return; }
      UI.Toast.success(`✅ ${results.length} NO TRACK dibuat`);

      STATE.currentNoTrack    = results[0].noTrack || '';
      STATE.currentSvc        = service;
      STATE.currentTuj        = keys[0];
      STATE.currentDetailType = STATE.createType;
      STATE.currentDetailItem = null;

      // Simpan semua track yang dibuat
      STATE.createdTracks = results.map((r, i) => ({
        noTrack: r.noTrack || '',
        tujuan:  keys[i]  || ''
      }));

      // ── FIX: Pre-populate detailScanMap dengan noTrack dari createdTracks
      // agar scanner mode detail tahu ke noTrack mana tiap tujuan di-assign
      STATE.detailScanMap = {};
      STATE.createdTracks.forEach(t => {
        STATE.detailScanMap[t.noTrack] = [];
      });

      // Reload list di background
      const listAct = STATE.createType === 'ob' ? 'getObList' : 'getHvsList';
      API.get(listAct).then(r => {
        if (STATE.createType === 'ob') STATE.obData = r.list || [];
        else STATE.hvsData = r.list || [];
        DataLoader.loadScanAwbs();
      }).catch(() => {});

      // Buka scanner mode detail — flow sama seperti OB
      STATE.scanContext = 'detail';
      STATE.scanItems   = [];
      Scanner.open('detail', STATE.currentNoTrack, '');

    } catch(e) { UI.Loading.hide(); UI.Toast.error('Error: ' + e.message); }
  },

  async _saveIb() {
    const service = UI.Scb.getValue('scbIbSvc');
    const from    = UI.Scb.getValue('scbIbFrom');
    if (!STATE.globalIncharge || !service || !from) { UI.Toast.error('Lengkapi SERVICE & FROM'); return; }
    const keys = Object.keys(STATE.ibScanMap);
    if (!keys.length) { UI.Toast.error('Tambahkan minimal 1 tujuan'); return; }

    UI.Loading.show('Menyimpan...');
    try {
      const results = await Promise.all(keys.map(tujuan =>
        API.post('saveIb', { incharge: STATE.globalIncharge, service, from, tujuan, awbList: [] })
      ));
      UI.Loading.hide();
      const errs = results.filter(r => r.error);
      if (errs.length) { UI.Toast.error('Error: ' + errs[0].error); return; }
      UI.Toast.success(`✅ ${results.length} NO TRACK IB dibuat`);

      STATE.currentNoTrack    = results[0].noTrack || '';
      STATE.currentSvc        = service;
      STATE.currentTuj        = keys[0];
      STATE.currentDetailType = 'ib';
      STATE.currentDetailItem = null;

      // Simpan semua track yang dibuat
      STATE.createdTracks = results.map((r, i) => ({
        noTrack: r.noTrack || '',
        tujuan:  keys[i]  || ''
      }));

      // ── FIX: Pre-populate detailScanMap dengan noTrack dari createdTracks
      // agar scanner mode detail tahu ke noTrack mana tiap tujuan di-assign
      STATE.detailScanMap = {};
      STATE.createdTracks.forEach(t => {
        STATE.detailScanMap[t.noTrack] = [];
      });

      // Reload list di background
      API.get('getIbList').then(r => { STATE.ibData = r.list || []; DataLoader.loadScanAwbs(); }).catch(() => {});

      // Buka scanner mode detail — flow sama seperti OB
      STATE.scanContext = 'detail';
      STATE.scanItems   = [];
      Scanner.open('detail', STATE.currentNoTrack, '');

    } catch(e) { UI.Loading.hide(); UI.Toast.error('Error: ' + e.message); }
  },

  _resetObForm() {
    STATE.obScanMap  = {};
    STATE.obActiveTuj = '';
    UI.Scb.reset('scbSvc'); UI.Scb.reset('scbTuj');
    UI.Scb.setDisabled('scbTuj', true);
    document.getElementById('obTabs').innerHTML = '';
    CreatePage.renderObScanList();
    CreatePage._updateObTotal();
  },

  _resetIbForm() {
    STATE.ibScanMap   = {};
    STATE.ibActiveTuj = '';
    STATE.ibScanned   = [];
    UI.Scb.reset('scbIbSvc'); UI.Scb.reset('scbIbFrom'); UI.Scb.reset('scbIbTuj');
    UI.Scb.setDisabled('scbIbFrom', true);
    UI.Scb.setDisabled('scbIbTuj',  true);
    if (document.getElementById('ibTabs')) document.getElementById('ibTabs').innerHTML = '';
    CreatePage.renderIbScanList();
    CreatePage._updateIbTotal();
  }
};

// ════════════════════════════════════════════
// DETAIL PAGE
// ════════════════════════════════════════════
const DetailPage = {
  open(type, noTrack) {
    const arr  = type === 'ob' ? STATE.obData : type === 'hvs' ? STATE.hvsData : STATE.ibData;
    const item = arr.find(d => d.no_track === noTrack);
    if (!item) { UI.Toast.error('Data tidak ditemukan'); return; }
    STATE.currentDetailItem = item;
    STATE.currentDetailType = type;
    STATE.currentNoTrack    = noTrack;
    STATE.currentSvc        = item.service;
    STATE.currentTuj        = item.tujuan;
    // Reset createdTracks saat buka detail dari list (bukan dari create)
    STATE.createdTracks     = [];
    DetailPage._render(item, type);
    UI.Page.show('pgDetail');
    DetailPage._loadAwbList(noTrack, type);
  },

  _render(item, type) {
    document.getElementById('detailTitle').innerText = item.no_track;
    const isSelesai = item.status === 'SELESAI';
    const pb = document.getElementById('detailPhotoBox');
    // Kumpulkan semua URL foto (support multi-kolom: foto_url, foto_url2, foto_url3, dst)
    const fotoUrls = DetailPage._collectFotoUrls(item);
    if (fotoUrls.length > 0) {
      pb.innerHTML = DetailPage._renderSlider(fotoUrls);
      pb.style.cursor = 'pointer';
      pb.onclick = () => FotoFull.open(fotoUrls, 0);
    } else {
      pb.innerHTML = `<div class="no-img">📷<br>${isSelesai ? 'Tidak ada foto' : 'Klik untuk tambah foto'}</div>`;
      pb.style.cursor = 'pointer';
      pb.onclick = () => DetailPage.tambahFoto();
    }
    document.getElementById('roBbar').classList.toggle('hidden', !isSelesai);

    const fields = type === 'ib'
      ? [['NO TRACK',item.no_track],['INCHARGE',item.incharge],['SERVICE',item.service],['FROM',item.from||'—'],['TUJUAN',item.tujuan],['CREATED DATE',item.created_date],['STATUS',item.status],['TOTAL AWB',item.total_awb]]
      : [['NO TRACK',item.no_track],['INCHARGE',item.incharge],['SERVICE',item.service],['TUJUAN',item.tujuan],['CREATED DATE',item.created_date],['STATUS',item.status],['TOTAL AWB',item.total_awb]];

    document.getElementById('detailFields').innerHTML = fields.map(([label, val]) => {
      let cls = '', display = val;
      if (label === 'STATUS') {
        display = item.status === 'SELESAI'
          ? '<span style="color:var(--green);font-weight:700">✓ SELESAI</span>'
          : '<span style="color:var(--orange);font-weight:700">● ON PROSES</span>';
        cls = ' mono';
      }
      if (label === 'NO TRACK') cls = ' mono';
      return `<div class="detail-field"><div class="d-label">${escH(label)}</div><div class="d-value${cls}">${display}</div></div>`;
    }).join('');

    let footer = '<button class="btn btn-outline" style="flex:1" onclick="DetailPage.tambahFoto()">📷 Tambah Foto</button>';
    if (!isSelesai) footer += '<button class="btn btn-success" style="flex:1" onclick="Scanner.open(\'detail\',\'' + item.no_track + '\',\'\')">+ Tambah AWB</button>';
    document.getElementById('detailFooter').innerHTML = footer;
    DetailPage._buildMenu(item, type, isSelesai);
  },

  _buildMenu(item, type, isSelesai) {
    let html = '';
    if (!isSelesai) {
      html += `<div class="dd-item" onclick="UI.Menu.close();Scanner.open('detail','${escQ(item.no_track)}','')">📷 Tambah AWB</div>`;
      html += `<div class="dd-item" onclick="UI.Menu.close();DetailPage.tambahFoto()">🖼️ Tambah Foto</div>`;
      html += `<div class="dd-item" onclick="UI.Menu.close();DetailPage.markSelesai()">✓ Tandai Selesai</div>`;
      html += `<div class="dd-item danger" onclick="UI.Menu.close();DetailPage.deleteItem()">🗑 Hapus</div>`;
    }
    html += `<div class="dd-item" onclick="UI.Menu.close();DetailPage.openAwbModal()">📋 View List AWB</div>`;
    document.getElementById('ddMenu').innerHTML = html;
  },

  close() { UI.Menu.close(); UI.Page.show('pgHome'); HomePage.render(); HomePage.updateStats(); },

  // ── Tambah Foto — reload dulu dari server agar photoStartIndex akurat ──
  async tambahFoto() {
    if (!STATE.currentDetailItem) return;
    UI.Loading.show('Memeriksa foto...');
    try {
      const act = STATE.currentDetailType === 'ob' ? 'getObList'
                : STATE.currentDetailType === 'hvs' ? 'getHvsList' : 'getIbList';
      const r = await API.get(act);
      const list = r.list || [];
      const fresh = list.find(d => d.no_track === STATE.currentNoTrack);
      if (fresh) {
        STATE.currentDetailItem = fresh;
        // update state array juga
        const arr = STATE.currentDetailType === 'ob' ? STATE.obData
                  : STATE.currentDetailType === 'hvs' ? STATE.hvsData : STATE.ibData;
        const idx = arr.findIndex(d => d.no_track === STATE.currentNoTrack);
        if (idx !== -1) arr[idx] = fresh;
      }
    } catch(e) { /* gagal reload, pakai state lokal */ }
    UI.Loading.hide();
    // Hitung index foto berikutnya dari data fresh
    STATE.photoStartIndex = DetailPage._collectFotoUrls(STATE.currentDetailItem).length;
    Photo.go();
  },

  // Kumpulkan semua URL foto dari item
  _collectFotoUrls(item) {
    if (!item) return [];
    const urls = [];
    const add = u => { if (u && typeof u === 'string' && u.trim() && !urls.includes(u.trim())) urls.push(u.trim()); };

    // Kolom utama
    add(item.foto_url);

    // Variant dengan underscore: foto_url_2 … foto_url_9
    for (let i = 2; i <= 9; i++) add(item['foto_url_' + i]);

    // Variant tanpa underscore: foto_url2 … foto_url9
    for (let i = 2; i <= 9; i++) add(item['foto_url' + i]);

    // Array foto_urls dari multi-upload sesi (state lokal)
    if (item.foto_urls && Array.isArray(item.foto_urls)) {
      item.foto_urls.forEach(u => add(u));
    }

    return urls;
  },

  // Render slider foto — swipe kiri/kanan untuk pindah foto
  _renderSlider(urls) {
    if (urls.length === 1) {
      return `<div class="foto-slider">
        <img class="foto-slide active" src="${DetailPage._thumb(urls[0])}"
          onclick="FotoFull.open(${JSON.stringify(urls)},0)"
          style="cursor:pointer"
          onerror="this.src='';this.alt='Foto gagal dimuat'">
      </div>`;
    }
    const dots  = urls.map((_, i) => `<span class="foto-dot${i===0?' active':''}" onclick="DetailPage._slideTo(${i})"></span>`).join('');
    const imgs  = urls.map((u, i) =>
      `<img class="foto-slide${i===0?' active':''}" src="${DetailPage._thumb(u)}" data-idx="${i}"
        onclick="FotoFull.open(${JSON.stringify(urls)},${i})"
        onerror="this.src='';this.alt='Foto ${i+1} gagal dimuat'">`
    ).join('');
    return `
      <div class="foto-slider" id="fotoSlider"
        ontouchstart="DetailPage._touchStart(event)"
        ontouchend="DetailPage._touchEnd(event)">
        ${imgs}
        <div class="foto-counter" id="fotoCounter">1 / ${urls.length}</div>
      </div>
      <div class="foto-dots" id="fotoDots">${dots}</div>`;
  },

  _slideIdx: 0,
  _touchX: 0,

  _touchStart(e) { DetailPage._touchX = e.touches[0].clientX; },
  _touchEnd(e) {
    const dx = e.changedTouches[0].clientX - DetailPage._touchX;
    if (Math.abs(dx) < 40) return;
    const slides = document.querySelectorAll('#fotoSlider .foto-slide');
    if (!slides.length) return;
    const n = slides.length;
    if (dx < 0) DetailPage._slideTo((DetailPage._slideIdx + 1) % n);
    else         DetailPage._slideTo((DetailPage._slideIdx - 1 + n) % n);
  },

  _slideTo(idx) {
    const slides = document.querySelectorAll('#fotoSlider .foto-slide');
    const dots   = document.querySelectorAll('#fotoDots .foto-dot');
    const counter = document.getElementById('fotoCounter');
    slides.forEach((s, i) => s.classList.toggle('active', i === idx));
    dots.forEach((d, i)   => d.classList.toggle('active', i === idx));
    if (counter) counter.innerText = `${idx + 1} / ${slides.length}`;
    DetailPage._slideIdx = idx;
  },

  photoClick() { /* deprecated — diganti tambahFoto() */ },

  async onFileChange(e) {
    const file = e.target.files[0];
    if (!file || !STATE.currentDetailItem) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      UI.Loading.show('Upload foto...');
      try {
        const res = await API.uploadFoto(STATE.currentDetailItem.no_track, STATE.currentDetailType.toUpperCase(), ev.target.result.split(',')[1]);
        UI.Loading.hide();
        if (res.success && res.url) {
          STATE.currentDetailItem.foto_url = res.url;
          DetailPage._render(STATE.currentDetailItem, STATE.currentDetailType);
          UI.Toast.success('Foto diperbarui');
        } else UI.Toast.error('Gagal: ' + (res.error || ''));
      } catch(e) { UI.Loading.hide(); UI.Toast.error('Error: ' + e.message); }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  },

  _loadAwbList(noTrack, type) {
    document.getElementById('awbListBox').innerHTML = '<div class="scan-empty">Memuat...</div>';
    document.getElementById('awbCount').innerText = '...';
    API.get('getAwbList', { noTrack, type: type.toUpperCase() }).then(res => {
      const list = res.list || [];
      document.getElementById('awbCount').innerText = list.length;
      document.getElementById('awbListBox').innerHTML = list.length
        ? list.map(r => `<div class="awb-row">${r.awb || r}${r.tujuan ? `<span style="font-size:11px;color:var(--text3);margin-left:auto">${escH(r.tujuan)}</span>` : ''}</div>`).join('')
        : '<div class="scan-empty">Belum ada AWB</div>';
    }).catch(() => {});
  },

  reloadData() {
    if (!STATE.currentDetailItem) return;
    DetailPage._loadAwbList(STATE.currentNoTrack, STATE.currentDetailType);
    const act = STATE.currentDetailType === 'ob' ? 'getObList' : STATE.currentDetailType === 'hvs' ? 'getHvsList' : 'getIbList';
    API.get(act).then(r => {
      const list = r.list || [];
      if (STATE.currentDetailType === 'ob') STATE.obData = list;
      else if (STATE.currentDetailType === 'hvs') STATE.hvsData = list;
      else STATE.ibData = list;
      const item = list.find(d => d.no_track === STATE.currentNoTrack);
      if (item) { STATE.currentDetailItem = item; DetailPage._render(item, STATE.currentDetailType); DetailPage._slideIdx = 0; }
    }).catch(() => {});
  },

  async markSelesai() {
    if (!STATE.currentDetailItem) return;
    const noTrack = STATE.currentDetailItem.no_track;
    if (!confirm('Tandai ' + noTrack + ' sebagai SELESAI?')) return;
    UI.Loading.show('Mengubah status...');
    const action = STATE.currentDetailType === 'ob' ? 'updateObStatus' : STATE.currentDetailType === 'hvs' ? 'updateHvsStatus' : 'updateIbStatus';
    try {
      const res = await API.post(action, { noTrack, newStatus: 'SELESAI' });
      UI.Loading.hide();
      if (res.success) {
        STATE.currentDetailItem.status = 'SELESAI';
        const arr  = STATE.currentDetailType === 'ob' ? STATE.obData : STATE.currentDetailType === 'hvs' ? STATE.hvsData : STATE.ibData;
        const item = arr.find(d => d.no_track === noTrack);
        if (item) item.status = 'SELESAI';
        DetailPage._render(STATE.currentDetailItem, STATE.currentDetailType);
        HomePage.render(); HomePage.updateStats();
        UI.Toast.success('Status → SELESAI');
      } else UI.Toast.error('Gagal: ' + (res.error || ''));
    } catch(e) { UI.Loading.hide(); UI.Toast.error('Error: ' + e.message); }
  },

  async deleteItem() {
    if (!STATE.currentDetailItem || STATE.currentDetailItem.status === 'SELESAI') {
      UI.Toast.error('Data SELESAI tidak dapat dihapus'); return;
    }
    const noTrack = STATE.currentDetailItem.no_track;
    if (!confirm('Hapus ' + noTrack + '? Semua AWB terkait juga akan dihapus.')) return;
    UI.Loading.show('Menghapus...');
    const action = STATE.currentDetailType === 'ob' ? 'deleteOb' : STATE.currentDetailType === 'hvs' ? 'deleteHvs' : 'deleteIb';
    try {
      const res = await API.post(action, { noTrack });
      UI.Loading.hide();
      if (res.success) {
        if (STATE.currentDetailType === 'ob') STATE.obData = STATE.obData.filter(d => d.no_track !== noTrack);
        else if (STATE.currentDetailType === 'hvs') STATE.hvsData = STATE.hvsData.filter(d => d.no_track !== noTrack);
        else STATE.ibData = STATE.ibData.filter(d => d.no_track !== noTrack);
        HomePage.render(); HomePage.updateStats(); DataLoader.loadScanAwbs();
        UI.Toast.success('Data dihapus'); DetailPage.close();
      } else UI.Toast.error('Gagal: ' + (res.error || ''));
    } catch(e) { UI.Loading.hide(); UI.Toast.error('Error: ' + e.message); }
  },

  _thumb(url) {
    if (!url) return '';
    if (url.includes('thumbnail')) return url;
    const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1000` : url;
  },

  async openAwbModal() {
    UI.Loading.show('Memuat list AWB...');
    try {
      const res  = await API.get('getAwbList', { noTrack: STATE.currentDetailItem.no_track, type: STATE.currentDetailType.toUpperCase() });
      UI.Loading.hide();
      const list = res.list || [];
      document.getElementById('awbModalCount').innerText = list.length;
      document.getElementById('awbModalList').innerHTML = list.length
        ? list.map(r => `<div class="awb-row">${r.awb || r}${r.tujuan ? `<span style="font-size:11px;color:var(--text3);margin-left:auto">${escH(r.tujuan)}</span>` : ''}</div>`).join('')
        : '<div class="scan-empty">Belum ada AWB</div>';
      UI.Modal.open('awbModal');
    } catch(e) { UI.Loading.hide(); UI.Toast.error('Gagal memuat AWB'); }
  }
};

// ════════════════════════════════════════════
// SEARCH PAGE
// ════════════════════════════════════════════
const SearchPage = {
  _timer: null,

  search(q) {
    q = (q || '').trim();
    const result = document.getElementById('searchResult');
    if (!q) { result.innerHTML = '<div class="search-empty">Ketik nomor AWB untuk mencari</div>'; return; }

    const ql = q.toLowerCase();
    const local = STATE.allScanAwbs.filter(item => (item.awb || '').toLowerCase().includes(ql));
    if (local.length) { SearchPage._render(local, q); return; }

    result.innerHTML = '<div class="search-empty" style="padding:24px">Mencari di server...</div>';
    clearTimeout(SearchPage._timer);
    SearchPage._timer = setTimeout(async () => {
      try {
        const res  = await API.get('searchAwb', { q });
        const list = res.list || [];
        if (list.length) SearchPage._render(list, q);
        else result.innerHTML = `<div class="search-result-hdr">Tidak ada hasil untuk "${escH(q)}"</div>`;
      } catch(e) { result.innerHTML = '<div class="search-empty">Error saat mencari</div>'; }
    }, 400);
  },

  _render(results, q) {
    const esc = escRx(escH(q));
    let html = `<div class="search-result-hdr">${results.length} hasil ditemukan</div>`;
    html += results.map(r => {
      const typeKey = (r.type || 'ob').toLowerCase();
      const icon    = typeKey === 'ob' ? '🚛' : typeKey === 'hvs' ? '📦' : '📥';
      const hl      = escH(r.awb || '').replace(new RegExp(`(${esc})`, 'gi'), '<mark>$1</mark>');
      return `<div class="search-item" onclick="DetailPage.open('${typeKey}','${escQ(r.noTrack || r.no_track || '')}')">
        <div class="search-item-icon si-${typeKey}">${icon}</div>
        <div class="search-item-main">
          <div class="search-item-awb">${hl}</div>
          <div class="search-item-meta">${escH(r.incharge||'—')} • ${escH(r.service||'—')} → ${escH(r.tujuan||'—')}${r.from ? ` • FROM: ${escH(r.from)}` : ''} • ${r.date||''}</div>
          <div style="margin-top:3px;font-size:11px;color:var(--blue2);font-family:var(--mono)">${r.noTrack || r.no_track || ''}</div>
        </div>
      </div>`;
    }).join('');
    document.getElementById('searchResult').innerHTML = html;
  },

  clear() {
    document.getElementById('searchMainInp').value = '';
    SearchPage.search('');
  }
};

// ════════════════════════════════════════════
// INCHARGE MODAL
// ════════════════════════════════════════════
const IcModal = {
  open() {
    document.getElementById('icSearch').value = '';
    IcModal.render();
    UI.Modal.open('icModal');
  },
  close() { UI.Modal.close('icModal'); },
  render() {
    const q = document.getElementById('icSearch').value.toLowerCase();
    const filtered = STATE.allIncharges.filter(v => v.toLowerCase().includes(q));
    document.getElementById('icList').innerHTML = filtered.map(v => {
      const sel = v === STATE.globalIncharge;
      return `<div style="padding:13px 10px;border-bottom:1px solid var(--bg);cursor:pointer;font-size:15px;color:${sel?'var(--blue2)':'var(--text)'}" onclick="IcModal.select('${escQ(v)}')">${sel ? '✓ ' : ''}${escH(v)}</div>`;
    }).join('') || '<div style="padding:14px;color:var(--text3);font-size:13px">Tidak ada</div>';
  },
  select(v) {
    STATE.globalIncharge = v;
    document.getElementById('icName').innerText = v || 'Pilih Incharge';
    document.getElementById('icDot').className  = 'ic-dot' + (v ? ' on' : '');
    IcModal.close();
    DataLoader._buildCbOptions();
    HomePage.render(); HomePage.updateStats();
    // Update sidebar incharge label
    document.getElementById('sidebarIcName').innerText = v || '—';
    CreatePage._updateWarn();
  }
};
