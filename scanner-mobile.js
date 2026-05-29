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
    Scanner._updateUI();
    UI.Page.show('pgScan');
    Scanner._start();
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

    // Jika sudah punya camera ID dari sesi sebelumnya, langsung pakai — kamera nyala instan
    if (Scanner._preferredCamId) {
      h5.start(Scanner._preferredCamId, cfg, Scanner._onSuccess, () => {})
        .then(() => STATE.isScannerRunning = true)
        .catch(() => {
          // Kalau ID lama gagal (misalnya cabut kamera), reset dan coba ulang
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
        Scanner._preferredCamId = camId; // simpan untuk sesi berikutnya
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
    // Pastikan semua track kamera dimatikan
    try {
      const videos = document.querySelectorAll('#reader video');
      videos.forEach(v => { if (v.srcObject) { v.srcObject.getTracks().forEach(t => t.stop()); v.srcObject = null; } });
    } catch(e) {}
    document.getElementById('reader').innerHTML = '';
    document.getElementById('camErr').style.display = 'none';
  },

  _onSuccess(text) {
    // Abaikan scan selama freeze berlangsung
    if (Scanner._paused) return;

    // Freeze 300ms — cegah baca barcode yang sama berulang
    Scanner._paused = true;
    setTimeout(() => { Scanner._paused = false; }, 300);

    Scanner.addItem(text);
    Scanner.beep();
  },

  addItem(awb) {
    awb = awb.trim();
    if (!awb) return;
    if (STATE.scanItems.includes(awb)) { UI.Toast.error('AWB sudah ada'); return; }
    STATE.scanItems.unshift(awb);
    Scanner._updateUI();
    UI.Toast.success('✓ ' + awb);
  },

  removeItem(i) {
    STATE.scanItems.splice(i, 1);
    Scanner._updateUI();
  },

  clearAll() {
    if (!confirm('Hapus semua list scan?')) return;
    STATE.scanItems = [];
    Scanner._updateUI();
  },

  _updateUI() {
    document.getElementById('scanCount').innerText  = STATE.scanItems.length;
    document.getElementById('btnSaveScan').disabled = !STATE.scanItems.length;
    document.getElementById('scanList').innerHTML = STATE.scanItems.length
      ? STATE.scanItems.map((awb, i) =>
          `<div class="scan-item"><span>${escH(awb)}</span><span class="scan-item-del" onclick="Scanner.removeItem(${i})">🗑</span></div>`
        ).join('')
      : '<div class="scan-empty">Belum ada AWB di-scan</div>';
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
      if (!STATE.obScanMap[STATE.obActiveTuj]) STATE.obScanMap[STATE.obActiveTuj] = [];
      STATE.scanItems.forEach(awb => {
        if (!STATE.obScanMap[STATE.obActiveTuj].includes(awb))
          STATE.obScanMap[STATE.obActiveTuj].push(awb);
      });
      STATE.scanItems = [];
      await Scanner._stop();
      CreatePage.renderObTabs();
      CreatePage.renderObScanList();
      UI.Toast.success('AWB ditambahkan ke ' + STATE.obActiveTuj);
      UI.Page.show('pgCreate');
      return;
    }

    if (STATE.scanContext === 'create-ib') {
      if (!STATE.ibScanMap[STATE.ibActiveTuj]) STATE.ibScanMap[STATE.ibActiveTuj] = [];
      STATE.scanItems.forEach(awb => {
        if (!STATE.ibScanMap[STATE.ibActiveTuj].includes(awb))
          STATE.ibScanMap[STATE.ibActiveTuj].push(awb);
      });
      STATE.scanItems = [];
      await Scanner._stop();
      CreatePage.renderIbTabs();
      CreatePage.renderIbScanList();
      UI.Toast.success('AWB ditambahkan ke ' + STATE.ibActiveTuj);
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
