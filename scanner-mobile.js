// ════════════════════════════════════════════
// SCANNER — QR/Barcode scanner with sound
// ════════════════════════════════════════════

const Scanner = {
  // Beep sound menggunakan Web Audio API
  _beepCtx: null,

  // Freeze flag — true selama 300ms setelah scan berhasil
  _paused: false,

  // Cache camera ID agar kamera langsung nyala tanpa getCameras() lagi
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

    // Tutup semua SCB dropdown yang mungkin masih terbuka dari halaman sebelumnya
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

    // Render combobox tujuan di scanner (untuk mode create-ob / create-ib / detail)
    Scanner._renderTujCombobox();

    // Render tab tujuan jika context create-ob atau create-ib (TETAP dipertahankan)
    Scanner._renderTujTabs();

    Scanner._updateUI();
    UI.Page.show('pgScan');
    Scanner._start();
  },

  // ══════════════════════════════════════════
  // COMBOBOX TUJUAN DI SCANNER
  // ══════════════════════════════════════════

  _renderTujCombobox() {
    const wrap = document.getElementById('scanTujComboWrap');
    if (!wrap) return;

    const isOb     = STATE.scanContext === 'create-ob';
    const isIb     = STATE.scanContext === 'create-ib';
    const isDetail = STATE.scanContext === 'detail';

    // Untuk mode detail — tampilkan info tracking + tujuan (read-only)
    if (isDetail) {
      wrap.style.display = 'block';
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

    // Render combobox dropdown tujuan
    const optionsHtml = keys.map(t => {
      const cnt   = (map[t] || []).length;
      const isSel = t === active;
      return `<div class="scan-combo-opt${isSel ? ' active' : ''}" onclick="Scanner._selectTujFromCombo('${escQ(t)}')">
        <span class="scan-combo-opt-name">${escH(t)}</span>
        <span class="scan-combo-opt-cnt">${cnt} AWB${STATE.scanItems.length > 0 && isSel ? ' +' + STATE.scanItems.length : ''}</span>
        ${isSel ? '<span class="scan-combo-opt-check">✓</span>' : ''}
      </div>`;
    }).join('');

    wrap.innerHTML = `
      <div class="scan-combo-label">Pilih Tujuan${svc ? ` <span class="scan-combo-svc-tag">${escH(svc)}</span>` : ''}</div>
      <div class="scan-combo-box" id="scanComboBox">
        <div class="scan-combo-current" onclick="Scanner._toggleComboDropdown()">
          <span class="scan-combo-current-name">${escH(active || 'Pilih tujuan...')}</span>
          <span class="scan-combo-current-meta">
            ${active ? `${(map[active] || []).length + STATE.scanItems.length} AWB` : ''}
          </span>
          <span class="scan-combo-chevron" id="scanComboChevron">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </span>
        </div>
        <div class="scan-combo-drop" id="scanComboDrop" style="display:none">
          ${optionsHtml}
          <div class="scan-combo-opt-add" onclick="Scanner._addTujFromCombo()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            + Tambah Tujuan Lain
          </div>
        </div>
      </div>
      ${active ? `<div class="scan-combo-hint">AWB scan masuk ke <b>${escH(active)}</b></div>` : ''}`;
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
    // Flush scan items saat ini ke tujuan lama sebelum pindah
    Scanner._flushToActive();

    const isOb = STATE.scanContext === 'create-ob';
    if (isOb) {
      STATE.obActiveTuj = tuj;
      if (!STATE.obScanMap[tuj]) STATE.obScanMap[tuj] = [];
    } else {
      STATE.ibActiveTuj = tuj;
      if (!STATE.ibScanMap[tuj]) STATE.ibScanMap[tuj] = [];
    }

    // Reset scanItems untuk tujuan baru
    STATE.scanItems = [];

    // Tutup dropdown
    const drop    = document.getElementById('scanComboDrop');
    const chevron = document.getElementById('scanComboChevron');
    if (drop)    drop.style.display = 'none';
    if (chevron) chevron.style.transform = '';

    // Re-render combobox + tabs + list
    Scanner._renderTujCombobox();
    Scanner._renderTujTabs();
    Scanner._updateUI();

    // Sync ke CreatePage tabs juga
    if (isOb) { CreatePage.renderObTabs(); CreatePage.renderObScanList(); }
    else       { CreatePage.renderIbTabs(); CreatePage.renderIbScanList(); }

    UI.Toast.success('Scan ke: ' + tuj);
  },

  _addTujFromCombo() {
    // Tutup dropdown dulu
    const drop = document.getElementById('scanComboDrop');
    if (drop) drop.style.display = 'none';

    // Buka modal tambah tujuan
    if (STATE.scanContext === 'create-ob') {
      CreatePage.openAddTujModal();
    } else {
      CreatePage.openAddIbTujModal();
    }
  },

  // ── Panggil ini setelah tambah tujuan dari modal agar combobox scanner ikut update ──
  refreshTujCombobox() {
    Scanner._renderTujCombobox();
    Scanner._renderTujTabs();
    Scanner._updateUI();
  },

  // ── Render tab tujuan di atas scan list (DIPERTAHANKAN) ──
  _renderTujTabs() {
    const wrap = document.getElementById('scanTujTabsWrap');
    if (!wrap) return;

    const isOb = STATE.scanContext === 'create-ob';
    const isIb = STATE.scanContext === 'create-ib';

    if (!isOb && !isIb) {
      wrap.style.display = 'none';
      return;
    }

    const map    = isOb ? STATE.obScanMap : STATE.ibScanMap;
    const active = isOb ? STATE.obActiveTuj : STATE.ibActiveTuj;
    const keys   = Object.keys(map || {});

    // Sembunyikan wrap tabs jika sudah ada combobox di atas (agar tidak duplikat)
    // Tetap tampilkan jika tidak ada combobox
    const hasCombo = !!document.getElementById('scanTujComboWrap');
    if (hasCombo) {
      wrap.style.display = 'none';
      return;
    }

    wrap.style.display = 'block';

    if (!keys.length) {
      wrap.innerHTML = `
        <div style="font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:10px;font-family:var(--font-head)">Tujuan Scan</div>
        <div class="scan-empty" style="padding:10px 0;font-size:12px">Belum ada tujuan</div>
        ${Scanner._addTujBtn(isOb)}
      `;
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
      <div style="font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:7px;font-family:var(--font-head)">
        Scan ke Tujuan
      </div>
      <div class="scan-tuj-tabs" style="margin-bottom:8px">${tabs}</div>
      ${active ? `<div style="font-size:11px;color:var(--text3);margin-bottom:10px;letter-spacing:.2px">
        Aktif: <span style="color:var(--gold2);font-weight:700">${escH(active)}</span>
        — AWB scan masuk ke tujuan ini
      </div>` : ''}
      ${Scanner._addTujBtn(isOb)}
    `;
  },

  // ── Helper tombol + Tujuan Lain di dalam scanner ──
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

  // ── Switch tujuan aktif tanpa menutup scanner ──
  _switchTuj(tuj) {
    // Simpan scan saat ini ke tujuan lama sebelum pindah
    Scanner._flushToActive();

    const isOb = STATE.scanContext === 'create-ob';
    if (isOb) {
      STATE.obActiveTuj = tuj;
      if (!STATE.obScanMap[tuj]) STATE.obScanMap[tuj] = [];
    } else {
      STATE.ibActiveTuj = tuj;
      if (!STATE.ibScanMap[tuj]) STATE.ibScanMap[tuj] = [];
    }

    // Reset scan items untuk tujuan baru (scan items sebelumnya sudah di-flush)
    STATE.scanItems = [];

    Scanner._renderTujCombobox();
    Scanner._renderTujTabs();
    Scanner._updateUI();
    UI.Toast.success('Scan ke: ' + tuj);
  },

  // ── Flush scanItems ke map tujuan aktif ──
  _flushToActive() {
    if (!STATE.scanItems.length) return;
    const isOb    = STATE.scanContext === 'create-ob';
    const map     = isOb ? STATE.obScanMap : STATE.ibScanMap;
    const active  = isOb ? STATE.obActiveTuj : STATE.ibActiveTuj;
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

  // ── Selesai scan create — flush lalu kembali ke pgCreate ──
  _doneCreate() {
    // Flush sisa scan items yang belum disimpan
    if (STATE.scanItems.length) {
      Scanner._flushToActive();
    }

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
        const back = cams.find(c => /back|rear|env/i.test(c.label));
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
      videos.forEach(v => { if (v.srcObject) { v.srcObject.getTracks().forEach(t => t.stop()); v.srcObject = null; } });
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

    // Untuk mode create, cek duplikat dengan yang sudah ada di map tujuan ini
    const isOb = STATE.scanContext === 'create-ob';
    const isIb = STATE.scanContext === 'create-ib';
    if (isOb || isIb) {
      const map    = isOb ? STATE.obScanMap : STATE.ibScanMap;
      const active = isOb ? STATE.obActiveTuj : STATE.ibActiveTuj;
      if (active && map[active] && map[active].includes(awb)) {
        UI.Toast.error('AWB sudah ada di ' + active); return;
      }
    }

    STATE.scanItems.unshift(awb);
    Scanner._renderTujCombobox(); // update counter di combobox
    Scanner._renderTujTabs();     // update counter di tab (jika ada)
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

    document.getElementById('scanCount').innerText  = STATE.scanItems.length;

    const btnSave = document.getElementById('btnSaveScan');
    const btnDone = document.getElementById('btnDoneCreate');

    // Tombol simpan AWB — aktif jika ada item
    btnSave.disabled = !STATE.scanItems.length;

    // Label tombol simpan
    if (isCreate && active) {
      btnSave.innerText = `Simpan ke "${active}"`;
    } else if (STATE.scanContext === 'detail') {
      btnSave.innerText = 'Simpan & Foto';
    } else {
      btnSave.innerText = 'Simpan & Foto';
    }

    // Tombol "Selesai — Lanjut ke Simpan" hanya di mode create
    if (btnDone) {
      btnDone.style.display = isCreate ? 'block' : 'none';
    }

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

  // ── Simpan hasil scan sesuai context ──
  async saveAndNext() {
    if (!STATE.scanItems.length) return;

    if (STATE.scanContext === 'create-ob') {
      const active = STATE.obActiveTuj;
      if (!active) { UI.Toast.error('Pilih tujuan dulu'); return; }
      if (!STATE.obScanMap[active]) STATE.obScanMap[active] = [];
      STATE.scanItems.forEach(awb => {
        if (!STATE.obScanMap[active].includes(awb)) STATE.obScanMap[active].push(awb);
      });
      STATE.scanItems = [];
      // Update UI tanpa keluar dari scanner — kamera tetap jalan
      Scanner._renderTujCombobox();
      Scanner._renderTujTabs();
      Scanner._updateUI();
      CreatePage.renderObTabs();
      CreatePage.renderObScanList();
      UI.Toast.success(`✓ AWB disimpan ke "${active}"`);
      return; // ← TETAP di scanner
    }

    if (STATE.scanContext === 'create-ib') {
      const active = STATE.ibActiveTuj;
      if (!active) { UI.Toast.error('Pilih tujuan dulu'); return; }
      if (!STATE.ibScanMap[active]) STATE.ibScanMap[active] = [];
      STATE.scanItems.forEach(awb => {
        if (!STATE.ibScanMap[active].includes(awb)) STATE.ibScanMap[active].push(awb);
      });
      STATE.scanItems = [];
      // Update UI tanpa keluar dari scanner — kamera tetap jalan
      Scanner._renderTujCombobox();
      Scanner._renderTujTabs();
      Scanner._updateUI();
      CreatePage.renderIbTabs();
      CreatePage.renderIbScanList();
      UI.Toast.success(`✓ AWB disimpan ke "${active}"`);
      return; // ← TETAP di scanner
    }

    // Context: detail — simpan ke server lalu keluar
    UI.Loading.show('Menyimpan AWB...');
    try {
      const res = await API.post('addAwbToTrack', {
        noTrack: STATE.currentNoTrack,
        type: STATE.currentDetailType.toUpperCase(),
        awbList: [...STATE.scanItems]
      });
      UI.Loading.hide();
      if (res.error) { UI.Toast.error('Gagal: ' + res.error); return; }
      UI.Toast.success(`✅ ${res.added} AWB disimpan`);
      STATE.scanItems = [];
      Scanner._stop();
      DetailPage.reloadData();
      UI.Page.show('pgDetail');
    } catch(e) {
      UI.Loading.hide();
      UI.Toast.error('Error: ' + e.message);
    }
  }
};
