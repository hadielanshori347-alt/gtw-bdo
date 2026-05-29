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

    // Render tab tujuan jika context create-ob atau create-ib
    Scanner._renderTujTabs();

    Scanner._updateUI();
    UI.Page.show('pgScan');
    Scanner._start();
  },

  // ── Render tab tujuan di atas scan list ──
  _renderTujTabs() {
    const wrap = document.getElementById('scanTujTabsWrap');
    if (!wrap) return;

    const isOb = STATE.scanContext === 'create-ob';
    const isIb = STATE.scanContext === 'create-ib';

    if (!isOb && !isIb) {
      wrap.style.display = 'none';
      return;
    }

    const map     = isOb ? STATE.obScanMap : STATE.ibScanMap;
    const active  = isOb ? STATE.obActiveTuj : STATE.ibActiveTuj;
    const keys    = Object.keys(map || {});

    if (!keys.length) {
      wrap.style.display = 'none';
      return;
    }

    wrap.style.display = 'block';

    const tabs = keys.map(t => {
      const cnt    = (map[t] || []).length + (t === active ? STATE.scanItems.length : 0);
      const isSel  = t === active;
      return `<div class="scan-tuj-tab${isSel ? ' active' : ''}" onclick="Scanner._switchTuj('${escQ(t)}')">
        <span>${escH(t)}</span>
        <span class="scan-tuj-cnt">${cnt}</span>
      </div>`;
    }).join('');

    wrap.innerHTML = `
      <div style="font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:7px;font-family:var(--font-head)">
        Scan ke Tujuan
      </div>
      <div class="scan-tuj-tabs">${tabs}</div>
      ${active ? `<div style="font-size:11px;color:var(--text3);margin-top:6px;letter-spacing:.2px">
        Aktif: <span style="color:var(--gold2);font-weight:700">${escH(active)}</span>
        — AWB scan masuk ke tujuan ini
      </div>` : ''}
    `;
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
    Scanner._renderTujTabs(); // update counter di tab
    Scanner._updateUI();
    UI.Toast.success('✓ ' + awb);
  },

  removeItem(i) {
    STATE.scanItems.splice(i, 1);
    Scanner._renderTujTabs();
    Scanner._updateUI();
  },

  clearAll() {
    if (!confirm('Hapus semua list scan?')) return;
    STATE.scanItems = [];
    Scanner._renderTujTabs();
    Scanner._updateUI();
  },

  _updateUI() {
    const isOb   = STATE.scanContext === 'create-ob';
    const isIb   = STATE.scanContext === 'create-ib';
    const active = isOb ? STATE.obActiveTuj : isIb ? STATE.ibActiveTuj : null;

    document.getElementById('scanCount').innerText  = STATE.scanItems.length;
    document.getElementById('btnSaveScan').disabled = !STATE.scanItems.length;

    // Label tombol simpan
    const btn = document.getElementById('btnSaveScan');
    if ((isOb || isIb) && active) {
      btn.innerText = `Simpan ke "${active}"`;
    } else if (STATE.scanContext === 'detail') {
      btn.innerText = 'Simpan & Foto';
    } else {
      btn.innerText = 'Simpan & Foto';
    }

    document.getElementById('scanList').innerHTML = STATE.scanItems.length
      ? STATE.scanItems.map((awb, i) =>
          `<div class="scan-item"><span>${escH(awb)}</span><span class="scan-item-del" onclick="Scanner.removeItem(${i})">🗑</span></div>`
        ).join('')
      : `<div class="scan-empty">${(isOb || isIb) && active ? `Scan AWB untuk <b>${escH(active)}</b>` : 'Belum ada AWB di-scan'}</div>`;
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
      await Scanner._stop();
      CreatePage.renderObTabs();
      CreatePage.renderObScanList();
      UI.Toast.success('AWB disimpan ke ' + active);
      UI.Page.show('pgCreate');
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
      await Scanner._stop();
      CreatePage.renderIbTabs();
      CreatePage.renderIbScanList();
      UI.Toast.success('AWB disimpan ke ' + active);
      UI.Page.show('pgCreate');
      return;
    }

    // Context: detail — simpan ke server
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
