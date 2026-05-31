// ════════════════════════════════════════════
// SCANNER — QR/Barcode scanner with sound
// ════════════════════════════════════════════

const Scanner = {
  _beepCtx: null,
  _paused: false,
  _preferredCamId: null,

  beep() {
    try {
      if (!Scanner._beepCtx) Scanner._beepCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = Scanner._beepCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(1800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch(e) {}
    if (navigator.vibrate) navigator.vibrate(60);
  },

  open(context, title, ctxLabel = '') {
    STATE.scanContext = context;
    STATE.scanItems = [];
    // Reset detailScanMap setiap kali scanner dibuka baru
    STATE.detailScanMap = {};

    Object.keys(STATE.scbReg || {}).forEach(cbId => UI.Scb._close(cbId));

    document.getElementById('scanTitle').innerText = title;
    const ctxBar      = document.getElementById('scanCtxBar');
    const ctxLabel_el = document.getElementById('scanCtxLabel');
    if (ctxLabel) {
      ctxBar.style.display = 'flex';
      ctxLabel_el.innerText = ctxLabel;
    } else {
      ctxBar.style.display = 'none';
    }

    Scanner._renderTujCombobox();
    Scanner._renderTujTabs();
    Scanner._updateUI();
    UI.Page.show('pgScan');
    Scanner._start();
  },

  // ══════════════════════════════════════════
  // TAB TUJUAN DI SCANNER (TAB HORIZONTAL)
  // ══════════════════════════════════════════

  _renderTujCombobox() {
    const wrap = document.getElementById('scanTujComboWrap');
    if (!wrap) return;

    const isOb     = STATE.scanContext === 'create-ob';
    const isIb     = STATE.scanContext === 'create-ib';
    const isDetail = STATE.scanContext === 'detail';

    // ── Context DETAIL ──
    if (isDetail) {
      const tracks = STATE.createdTracks || [];
      wrap.style.display = 'block';

      if (!tracks.length) {
        // Single track — info bar sederhana
        wrap.innerHTML = `
          <div class="scan-combo-label">Tujuan Aktif</div>
          <div class="scan-combo-info">
            <span class="scan-combo-track">${escH(STATE.currentNoTrack || '—')}</span>
            <span class="scan-combo-arrow">→</span>
            <span class="scan-combo-tuj">${escH(STATE.currentTuj || '—')}</span>
            ${STATE.currentSvc ? `<span class="scan-combo-svc">${escH(STATE.currentSvc)}</span>` : ''}
          </div>`;
        return;
      }

      // Multi-track — tab horizontal, tampilkan counter termasuk yang di detailScanMap
      const svc = STATE.currentSvc || '';
      const tabsHtml = tracks.map(t => {
        const isActive = t.noTrack === STATE.currentNoTrack;
        // Hitung AWB: kalau aktif pakai scanItems, kalau tidak pakai detailScanMap
        const cnt = isActive
          ? STATE.scanItems.length
          : ((STATE.detailScanMap || {})[t.noTrack] || []).length;
        return `<div class="scan-tuj-tab${isActive ? ' active' : ''}"
          onclick="Scanner._selectDetailTrack('${escQ(t.noTrack)}','${escQ(t.tujuan)}')">
          <span>${escH(t.tujuan)}</span>
          ${cnt > 0 ? `<span class="scan-tuj-cnt">${cnt}</span>` : ''}
        </div>`;
      }).join('');

      // Hitung total semua AWB belum disimpan
      const totalPending = STATE.scanItems.length +
        Object.values(STATE.detailScanMap || {}).reduce((s, a) => s + a.length, 0);

      wrap.innerHTML = `
        <div class="scan-combo-label" style="margin-bottom:8px">
          Pilih Tujuan${svc ? ` <span class="scan-combo-svc-tag">${escH(svc)}</span>` : ''}
          ${totalPending > 0 ? `<span style="background:var(--orange-l);color:var(--orange);border:1px solid rgba(245,158,11,.25);border-radius:20px;padding:2px 8px;font-size:9px;font-weight:700;margin-left:4px">${totalPending} belum disimpan</span>` : ''}
        </div>
        <div class="scan-tuj-tabs" style="margin-bottom:6px">${tabsHtml}</div>
        <div style="font-size:11px;color:var(--text3)">
          AWB scan masuk ke <b style="color:var(--gold2)">${escH(STATE.currentTuj || '—')}</b>
        </div>`;
      return;
    }

    if (!isOb && !isIb) {
      wrap.style.display = 'none';
      return;
    }

    const map    = isOb ? STATE.obScanMap : STATE.ibScanMap;
    const active = isOb ? STATE.obActiveTuj : STATE.ibActiveTuj;
    const keys   = Object.keys(map || {});
    const svc    = isOb ? UI.Scb.getValue('scbSvc') : UI.Scb.getValue('scbIbSvc');

    wrap.style.display = 'block';

    if (!keys.length) {
      wrap.innerHTML = `
        <div class="scan-combo-label">Tujuan Scan</div>
        <div class="scan-combo-empty">Belum ada tujuan — tambah dari tombol di bawah</div>`;
      return;
    }

    // Tab horizontal
    const tabsHtml = keys.map(t => {
      const cnt      = (map[t] || []).length + (t === active ? STATE.scanItems.length : 0);
      const isActive = t === active;
      return `<div class="scan-tuj-tab${isActive ? ' active' : ''}"
        onclick="Scanner._selectTujFromCombo('${escQ(t)}')">
        <span>${escH(t)}</span>
        <span class="scan-tuj-cnt">${cnt}</span>
      </div>`;
    }).join('');

    wrap.innerHTML = `
      <div class="scan-combo-label" style="margin-bottom:8px">
        Pilih Tujuan${svc ? ` <span class="scan-combo-svc-tag">${escH(svc)}</span>` : ''}
      </div>
      <div class="scan-tuj-tabs" style="flex-wrap:wrap;gap:8px;margin-bottom:6px">${tabsHtml}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px">
        ${active ? `<div style="font-size:11px;color:var(--text3)">AWB scan masuk ke <b style="color:var(--gold2)">${escH(active)}</b></div>` : '<div></div>'}
        <button style="
          display:inline-flex;align-items:center;gap:5px;
          background:rgba(255,255,255,.07);color:#e8e8e8;
          padding:5px 12px;border-radius:8px;
          font-size:10px;font-weight:700;
          cursor:pointer;white-space:nowrap;
          border:1px solid rgba(255,255,255,.18);
          text-transform:uppercase;letter-spacing:.3px;
          font-family:var(--font-head);"
          onclick="${isOb ? 'CreatePage.openAddTujFromScanner()' : 'CreatePage.openAddIbTujFromScanner()'}">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          + Tujuan
        </button>
      </div>`;
  },

  _toggleComboDropdown() {
    const drop    = document.getElementById('scanComboDrop');
    const chevron = document.getElementById('scanComboChevron');
    if (!drop) return;
    const isOpen = drop.style.display !== 'none';
    drop.style.display = isOpen ? 'none' : 'block';
    if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
  },

  _selectTujFromCombo(tuj) {
    Scanner._flushToActive();

    const isOb = STATE.scanContext === 'create-ob';
    if (isOb) {
      STATE.obActiveTuj = tuj;
      if (!STATE.obScanMap[tuj]) STATE.obScanMap[tuj] = [];
    } else {
      STATE.ibActiveTuj = tuj;
      if (!STATE.ibScanMap[tuj]) STATE.ibScanMap[tuj] = [];
    }

    STATE.scanItems = [];

    const drop    = document.getElementById('scanComboDrop');
    const chevron = document.getElementById('scanComboChevron');
    if (drop)    drop.style.display = 'none';
    if (chevron) chevron.style.transform = '';

    Scanner._renderTujCombobox();
    Scanner._renderTujTabs();
    Scanner._updateUI();

    if (isOb) { CreatePage.renderObTabs(); CreatePage.renderObScanList(); }
    else       { CreatePage.renderIbTabs(); CreatePage.renderIbScanList(); }

    UI.Toast.success('Scan ke: ' + tuj);
  },

  _addTujFromCombo() {
    const drop = document.getElementById('scanComboDrop');
    if (drop) drop.style.display = 'none';
    if (STATE.scanContext === 'create-ob') CreatePage.openAddTujModal();
    else CreatePage.openAddIbTujModal();
  },

  // ── Pilih tujuan/track di mode detail — TANPA confirm, AWB disimpan sementara ──
  _selectDetailTrack(noTrack, tujuan) {
    // Flush AWB aktif ke detailScanMap (bukan dibuang)
    if (STATE.scanItems.length) {
      if (!STATE.detailScanMap) STATE.detailScanMap = {};
      if (!STATE.detailScanMap[STATE.currentNoTrack]) STATE.detailScanMap[STATE.currentNoTrack] = [];
      STATE.scanItems.forEach(awb => {
        if (!STATE.detailScanMap[STATE.currentNoTrack].includes(awb))
          STATE.detailScanMap[STATE.currentNoTrack].push(awb);
      });
      STATE.scanItems = [];
    }

    // Ganti tracking aktif
    STATE.currentNoTrack = noTrack;
    STATE.currentTuj     = tujuan;

    // Restore AWB yang sudah pernah di-scan ke tujuan ini (jika ada)
    if (STATE.detailScanMap?.[noTrack]?.length) {
      STATE.scanItems = [...STATE.detailScanMap[noTrack]];
      delete STATE.detailScanMap[noTrack];
    } else {
      STATE.scanItems = [];
    }

    Scanner._renderTujCombobox();
    Scanner._updateUI();

    UI.Toast.success('Scan ke: ' + tujuan);
  },

  refreshTujCombobox() {
    Scanner._renderTujCombobox();
    Scanner._renderTujTabs();
    Scanner._updateUI();
  },

  // ── Render tab tujuan (DIPERTAHANKAN) ──
  _renderTujTabs() {
    const wrap = document.getElementById('scanTujTabsWrap');
    if (!wrap) return;

    const isOb = STATE.scanContext === 'create-ob';
    const isIb = STATE.scanContext === 'create-ib';

    if (!isOb && !isIb) { wrap.style.display = 'none'; return; }

    const hasCombo = !!document.getElementById('scanTujComboWrap');
    if (hasCombo) { wrap.style.display = 'none'; return; }

    const map    = isOb ? STATE.obScanMap : STATE.ibScanMap;
    const active = isOb ? STATE.obActiveTuj : STATE.ibActiveTuj;
    const keys   = Object.keys(map || {});

    wrap.style.display = 'block';

    if (!keys.length) {
      wrap.innerHTML = `
        <div style="font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:10px;font-family:var(--font-head)">Tujuan Scan</div>
        <div class="scan-empty" style="padding:10px 0;font-size:12px">Belum ada tujuan</div>
        ${Scanner._addTujBtn(isOb)}`;
      return;
    }

    const tabs = keys.map(t => {
      const cnt   = (map[t] || []).length + (t === active ? STATE.scanItems.length : 0);
      const isSel = t === active;
      return `<div class="scan-tuj-tab${isSel ? ' active' : ''}" onclick="Scanner._switchTuj('${escQ(t)}')">
        <span>${escH(t)}</span>
        <span class="scan-tuj-cnt">${cnt}</span>
      </div>`;
    }).join('');

    wrap.innerHTML = `
      <div style="font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:7px;font-family:var(--font-head)">Scan ke Tujuan</div>
      <div class="scan-tuj-tabs" style="margin-bottom:8px">${tabs}</div>
      ${active ? `<div style="font-size:11px;color:var(--text3);margin-bottom:10px;letter-spacing:.2px">
        Aktif: <span style="color:var(--gold2);font-weight:700">${escH(active)}</span> — AWB scan masuk ke tujuan ini
      </div>` : ''}
      ${Scanner._addTujBtn(isOb)}`;
  },

  _addTujBtn(isOb) {
    const fn = isOb ? 'CreatePage.openAddTujFromScanner()' : 'CreatePage.openAddIbTujFromScanner()';
    return `<button
      style="display:inline-flex;align-items:center;gap:6px;
             background:rgba(255,255,255,.07);color:#e8e8e8;
             padding:7px 14px;border-radius:8px;
             font-size:11px;font-weight:700;
             cursor:pointer;white-space:nowrap;
             border:1px solid rgba(255,255,255,.18);
             text-transform:uppercase;letter-spacing:.3px;
             font-family:var(--font-head);"
      onclick="${fn}">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      + Tujuan Lain
    </button>`;
  },

  _switchTuj(tuj) {
    Scanner._flushToActive();

    const isOb = STATE.scanContext === 'create-ob';
    if (isOb) {
      STATE.obActiveTuj = tuj;
      if (!STATE.obScanMap[tuj]) STATE.obScanMap[tuj] = [];
    } else {
      STATE.ibActiveTuj = tuj;
      if (!STATE.ibScanMap[tuj]) STATE.ibScanMap[tuj] = [];
    }

    STATE.scanItems = [];

    Scanner._renderTujCombobox();
    Scanner._renderTujTabs();
    Scanner._updateUI();
    UI.Toast.success('Scan ke: ' + tuj);
  },

  _flushToActive() {
    if (!STATE.scanItems.length) return;
    const isOb   = STATE.scanContext === 'create-ob';
    const map    = isOb ? STATE.obScanMap : STATE.ibScanMap;
    const active = isOb ? STATE.obActiveTuj : STATE.ibActiveTuj;
    if (!active) return;
    if (!map[active]) map[active] = [];
    STATE.scanItems.forEach(awb => {
      if (!map[active].includes(awb)) map[active].push(awb);
    });
    STATE.scanItems = [];
  },

  async close() {
    await Scanner._stop();
    if (STATE.scanContext === 'detail') UI.Page.show('pgDetail');
    else UI.Page.show('pgCreate');
  },

  _doneCreate() {
    if (STATE.scanItems.length) Scanner._flushToActive();
    Scanner._stop().then(() => {
      if (STATE.scanContext === 'create-ob') {
        CreatePage.renderObTabs();
        CreatePage.renderObScanList();
      } else {
        CreatePage.renderIbTabs();
        CreatePage.renderIbScanList();
      }
      UI.Page.show('pgCreate');
    });
  },

  _start() {
    document.getElementById('reader').innerHTML = '';
    document.getElementById('camErr').style.display = 'none';
    Scanner._paused = false;
    const h5 = new Html5Qrcode("reader");
    STATE.html5QrCode = h5;
    const cfg = { fps: 15, qrbox: { width: 250, height: 190 }, aspectRatio: 1.4 };

    if (Scanner._preferredCamId) {
      h5.start(Scanner._preferredCamId, cfg, Scanner._onSuccess, () => {})
        .then(() => STATE.isScannerRunning = true)
        .catch(() => {
          Scanner._preferredCamId = null;
          Scanner._startViaEnumerate(h5, cfg);
        });
      return;
    }
    Scanner._startViaEnumerate(h5, cfg);
  },

  _startViaEnumerate(h5, cfg) {
    Html5Qrcode.getCameras()
      .then(cams => {
        if (!cams?.length) return Scanner._startFacing('environment');
        const back  = cams.find(c => /back|rear|env/i.test(c.label));
        const camId = back ? back.id : cams[cams.length - 1].id;
        Scanner._preferredCamId = camId;
        h5.start(camId, cfg, Scanner._onSuccess, () => {})
          .then(() => STATE.isScannerRunning = true)
          .catch(() => Scanner._startFacing('environment'));
      })
      .catch(() => Scanner._startFacing('environment'));
  },

  _startFacing(mode) {
    const cfg = { fps: 15, qrbox: { width: 250, height: 190 } };
    STATE.html5QrCode.start({ facingMode: mode }, cfg, Scanner._onSuccess, () => {})
      .then(() => STATE.isScannerRunning = true)
      .catch(() => {
        if (mode === 'environment') Scanner._startFacing('user');
        else document.getElementById('camErr').style.display = 'block';
      });
  },

  async _stop() {
    Scanner._paused = false;
    if (STATE.html5QrCode && STATE.isScannerRunning) {
      try { await STATE.html5QrCode.stop(); } catch(e) {}
    }
    STATE.isScannerRunning = false;
    STATE.html5QrCode = null;
    try {
      const videos = document.querySelectorAll('#reader video');
      videos.forEach(v => {
        if (v.srcObject) { v.srcObject.getTracks().forEach(t => t.stop()); v.srcObject = null; }
      });
    } catch(e) {}
    document.getElementById('reader').innerHTML = '';
    document.getElementById('camErr').style.display = 'none';
  },

  _onSuccess(text) {
    if (Scanner._paused) return;
    Scanner._paused = true;
    setTimeout(() => { Scanner._paused = false; }, 300);
    Scanner.addItem(text);
    Scanner.beep();
  },

  addItem(awb) {
    awb = awb.trim();
    if (!awb) return;
    if (STATE.scanItems.includes(awb)) { UI.Toast.error('AWB sudah ada'); return; }

    const isOb = STATE.scanContext === 'create-ob';
    const isIb = STATE.scanContext === 'create-ib';
    if (isOb || isIb) {
      const map    = isOb ? STATE.obScanMap : STATE.ibScanMap;
      const active = isOb ? STATE.obActiveTuj : STATE.ibActiveTuj;
      if (active && map[active] && map[active].includes(awb)) {
        UI.Toast.error('AWB sudah ada di ' + active); return;
      }
    }

    // Cek duplikat di detailScanMap (mode detail multi-tujuan)
    if (STATE.scanContext === 'detail' && STATE.detailScanMap) {
      for (const [, awbs] of Object.entries(STATE.detailScanMap)) {
        if (awbs.includes(awb)) { UI.Toast.error('AWB sudah ada di tujuan lain'); return; }
      }
    }

    STATE.scanItems.unshift(awb);
    Scanner._renderTujCombobox();
    Scanner._renderTujTabs();
    Scanner._updateUI();
    UI.Toast.success('✓ ' + awb);
  },

  removeItem(i) {
    STATE.scanItems.splice(i, 1);
    Scanner._renderTujCombobox();
    Scanner._renderTujTabs();
    Scanner._updateUI();
  },

  clearAll() {
    if (!confirm('Hapus semua list scan?')) return;
    STATE.scanItems = [];
    Scanner._renderTujCombobox();
    Scanner._renderTujTabs();
    Scanner._updateUI();
  },

  _updateUI() {
    const isOb     = STATE.scanContext === 'create-ob';
    const isIb     = STATE.scanContext === 'create-ib';
    const isCreate = isOb || isIb;
    const active   = isOb ? STATE.obActiveTuj : isIb ? STATE.ibActiveTuj : null;

    document.getElementById('scanCount').innerText = STATE.scanItems.length;

    const btnSave = document.getElementById('btnSaveScan');
    const btnDone = document.getElementById('btnDoneCreate');

    // Untuk detail: aktifkan tombol jika ada scanItems ATAU ada di detailScanMap
    const totalPending = STATE.scanItems.length +
      Object.values(STATE.detailScanMap || {}).reduce((s, a) => s + a.length, 0);

    if (STATE.scanContext === 'detail') {
      btnSave.disabled = totalPending === 0;
      btnSave.innerText = totalPending > 0
        ? `Simpan Semua (${totalPending} AWB) & Foto`
        : 'Simpan & Foto';
    } else {
      btnSave.disabled = !STATE.scanItems.length;
      btnSave.innerText = isCreate && active ? `Simpan ke "${active}"` : 'Simpan & Foto';
    }

    if (btnDone) btnDone.style.display = isCreate ? 'block' : 'none';

    document.getElementById('scanList').innerHTML = STATE.scanItems.length
      ? STATE.scanItems.map((awb, i) =>
          `<div class="scan-item"><span>${escH(awb)}</span><span class="scan-item-del" onclick="Scanner.removeItem(${i})">🗑</span></div>`
        ).join('')
      : `<div class="scan-empty">${isCreate && active ? `Scan AWB untuk <b>${escH(active)}</b>` : 'Belum ada AWB di-scan'}</div>`;
  },

  toggleFlash() {
    if (!STATE.html5QrCode) return;
    STATE.flashOn = !STATE.flashOn;
    STATE.html5QrCode.applyVideoConstraints({ advanced: [{ torch: STATE.flashOn }] }).catch(() => {});
    document.getElementById('torchBtn').innerText = STATE.flashOn ? '💡' : '🔦';
  },

  handleManual(e) {
    if (e.key !== 'Enter') return;
    const inp = document.getElementById('scanManualInp');
    if (inp.value.trim()) { Scanner.addItem(inp.value); inp.value = ''; }
  },

  async saveAndNext() {
    if (!STATE.scanItems.length &&
        !Object.values(STATE.detailScanMap || {}).some(a => a.length)) return;

    if (STATE.scanContext === 'create-ob') {
      const active = STATE.obActiveTuj;
      if (!active) { UI.Toast.error('Pilih tujuan dulu'); return; }
      if (!STATE.obScanMap[active]) STATE.obScanMap[active] = [];
      STATE.scanItems.forEach(awb => {
        if (!STATE.obScanMap[active].includes(awb)) STATE.obScanMap[active].push(awb);
      });
      STATE.scanItems = [];
      Scanner._renderTujCombobox();
      Scanner._renderTujTabs();
      Scanner._updateUI();
      CreatePage.renderObTabs();
      CreatePage.renderObScanList();
      UI.Toast.success(`✓ AWB disimpan ke "${active}"`);
      return;
    }

    if (STATE.scanContext === 'create-ib') {
      const active = STATE.ibActiveTuj;
      if (!active) { UI.Toast.error('Pilih tujuan dulu'); return; }
      if (!STATE.ibScanMap[active]) STATE.ibScanMap[active] = [];
      STATE.scanItems.forEach(awb => {
        if (!STATE.ibScanMap[active].includes(awb)) STATE.ibScanMap[active].push(awb);
      });
      STATE.scanItems = [];
      Scanner._renderTujCombobox();
      Scanner._renderTujTabs();
      Scanner._updateUI();
      CreatePage.renderIbTabs();
      CreatePage.renderIbScanList();
      UI.Toast.success(`✓ AWB disimpan ke "${active}"`);
      return;
    }

    // ── Context: detail — kumpulkan SEMUA AWB dari semua tujuan lalu kirim parallel ──
    UI.Loading.show('Menyimpan AWB...');
    try {
      // Gabungkan detailScanMap + scanItems aktif
      const allMap = { ...(STATE.detailScanMap || {}) };
      if (STATE.scanItems.length && STATE.currentNoTrack) {
        if (!allMap[STATE.currentNoTrack]) allMap[STATE.currentNoTrack] = [];
        STATE.scanItems.forEach(awb => {
          if (!allMap[STATE.currentNoTrack].includes(awb)) allMap[STATE.currentNoTrack].push(awb);
        });
      }

      const entries = Object.entries(allMap).filter(([, awbs]) => awbs.length);
      if (!entries.length) { UI.Loading.hide(); UI.Toast.error('Tidak ada AWB'); return; }

      // Kirim parallel untuk semua noTrack
      const results = await Promise.all(entries.map(([nt, awbs]) =>
        API.post('addAwbToTrack', {
          noTrack: nt,
          type: STATE.currentDetailType.toUpperCase(),
          awbList: awbs
        })
      ));

      UI.Loading.hide();
      const errs = results.filter(r => r.error);
      if (errs.length) { UI.Toast.error('Gagal: ' + errs[0].error); return; }

      const total = results.reduce((s, r) => s + (r.added || 0), 0);
      UI.Toast.success(`✅ ${total} AWB disimpan`);

      // Reset semua
      STATE.scanItems     = [];
      STATE.detailScanMap = {};

      Scanner._renderTujCombobox();
      Scanner._updateUI();

      // Reload data di background (non-blocking)
      DetailPage.reloadData();

      // Hitung index foto berikutnya lalu langsung ke halaman foto
      STATE.photoStartIndex = 0;
      try {
        var _item = STATE.currentDetailItem;
        if (_item) STATE.photoStartIndex = DetailPage._collectFotoUrls(_item).length;
      } catch(e2) {}

      await Scanner._stop();
      Photo.go();

    } catch(e) {
