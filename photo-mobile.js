// ════════════════════════════════════════════
// PHOTO — Camera capture & upload (multi-foto)
//
// FLOW:
//   go() → kamera aktif → [📷 Ambil Foto]
//   → preview → [↺ Ulangi] atau [➕ Tambah Foto]
//   → kamera aktif lagi, bar antrian muncul di bawah
//   → bisa ambil foto ke-2, dst
//   → bar antrian: "📸 N foto" + [✅ Simpan Semua & Selesai]
//   → upload semua → tiap foto index berbeda → balik home/detail
// ════════════════════════════════════════════

const Photo = {

  // ── Buka halaman foto, reset semua state ──
  go() {
    STATE.capturedDataUrl = null;
    STATE.gpsCoords       = null;
    STATE.photoQueue      = [];

    Photo._showCameraBar();
    Photo._updateQueueBar();
    UI.Page.show('pgPhoto');
    Photo._startCamera();
    Photo._getGps();
  },

  // ── Tampilkan bar kamera (hanya tombol Ambil Foto) ──
  _showCameraBar() {
    document.getElementById('photoPreview').style.display = 'none';
    document.getElementById('photoVideo').style.display   = 'block';
    document.getElementById('barAmbil').classList.remove('hidden');
    document.getElementById('barResult').classList.add('hidden');
    document.getElementById('gpsBar').innerText = STATE.gpsCoords
      ? '📍 ' + STATE.gpsCoords
      : '📍 Mendapatkan lokasi...';
  },

  // ── Tampilkan bar preview (Ulangi + Tambah Foto) ──
  _showPreviewBar() {
    document.getElementById('photoVideo').style.display   = 'none';
    document.getElementById('photoPreview').style.display = 'block';
    document.getElementById('barAmbil').classList.add('hidden');
    document.getElementById('barResult').classList.remove('hidden');
  },

  // ── Update bar antrian bawah ──
  _updateQueueBar() {
    const n   = (STATE.photoQueue || []).length;
    const bar = document.getElementById('barAfterSave');
    const btn = document.getElementById('btnSimpanSemua');
    const lbl = document.getElementById('queueLabel');
    if (lbl) lbl.innerText = n > 0 ? `📸 ${n} foto di antrian` : '';
    if (btn) btn.disabled  = n === 0;
    // Tampil jika ada antrian (bisa berdampingan dengan bar lain)
    if (bar) bar.classList.toggle('hidden', n === 0);
  },

  // ── GPS ──
  _getGps() {
    if (!navigator.geolocation) {
      STATE.gpsCoords = 'GPS tidak tersedia';
      document.getElementById('gpsBar').innerText = '📍 GPS tidak tersedia';
      return;
    }
    navigator.geolocation.getCurrentPosition(pos => {
      const lat = pos.coords.latitude, lon = pos.coords.longitude;
      STATE.gpsCoords = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
      document.getElementById('gpsBar').innerText = '📍 ' + STATE.gpsCoords;
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=id`)
        .then(r => r.json())
        .then(geo => {
          const a = geo.address || {};
          const parts = [a.road, a.suburb || a.village, a.city || a.town].filter(Boolean);
          if (parts.length) {
            STATE.gpsCoords = parts.join(', ');
            document.getElementById('gpsBar').innerText = '📍 ' + STATE.gpsCoords;
          }
        }).catch(() => {});
    }, () => {
      STATE.gpsCoords = 'Lokasi tidak tersedia';
      document.getElementById('gpsBar').innerText = '📍 Lokasi tidak tersedia';
    }, { enableHighAccuracy: true, timeout: 6000 });
  },

  // ── Start kamera ──
  _startCamera() {
    const tries = [
      { video: { facingMode: { exact: 'environment' }, width: { ideal: 1280 } }, audio: false },
      { video: { facingMode: 'environment' }, audio: false },
      { video: { facingMode: 'user' }, audio: false },
      { video: true, audio: false }
    ];
    const next = i => {
      if (i >= tries.length) return;
      navigator.mediaDevices.getUserMedia(tries[i])
        .then(s => {
          STATE.photoStream = s;
          document.getElementById('photoVideo').srcObject = s;
        })
        .catch(() => next(i + 1));
    };
    next(0);
  },

  _stopStream() {
    if (STATE.photoStream) {
      STATE.photoStream.getTracks().forEach(t => t.stop());
      STATE.photoStream = null;
    }
  },

  // ── Ambil Foto → tampilkan preview ──
  ambil() {
    const video  = document.getElementById('photoVideo');
    const canvas = document.getElementById('photoCanvas');
    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Watermark
    const now   = new Date();
    const pad   = n => n < 10 ? '0' + n : n;
    const waktu = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const lines = [
      waktu,
      `Service: ${STATE.currentSvc}`,
      `Tujuan: ${STATE.currentTuj}`,
      `Lokasi: ${STATE.gpsCoords || '—'}`
    ];
    const fs = Math.max(14, Math.floor(canvas.width / 40));
    const lh = fs + 8, p = 12;
    ctx.font = `bold ${fs}px Arial`;
    let maxW = 0;
    lines.forEach(l => { const w = ctx.measureText(l).width; if (w > maxW) maxW = w; });
    maxW += p * 2;
    const bh = lines.length * lh + p;
    const bx = canvas.width - maxW - 10, by = canvas.height - bh - 10;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(bx, by, maxW, bh);
    ctx.fillStyle = '#fff'; ctx.font = `bold ${fs}px Arial`;
    lines.forEach((line, i) => ctx.fillText(line, bx + p, by + p + (i + 1) * lh - 4));

    // Compress
    const tmp = document.createElement('canvas');
    const w2  = Math.min(canvas.width, 1280);
    const h2  = Math.round(canvas.height * w2 / canvas.width);
    tmp.width = w2; tmp.height = h2;
    tmp.getContext('2d').drawImage(canvas, 0, 0, w2, h2);
    STATE.capturedDataUrl = tmp.toDataURL('image/jpeg', 0.72);

    // Tampilkan preview, ganti bar
    document.getElementById('photoPreview').src = STATE.capturedDataUrl;
    Photo._showPreviewBar();
    Photo._updateQueueBar(); // antrian bar tetap tampil jika sudah ada foto sebelumnya
  },

  // ── Ulangi — kembali ke kamera, foto ini dibuang ──
  ulangi() {
    STATE.capturedDataUrl = null;
    Photo._showCameraBar();
    Photo._updateQueueBar();
  },

  // ── Tambah ke Antrian — masuk queue, kamera aktif lagi ──
  tambahKeAntrian() {
    if (!STATE.capturedDataUrl) return;
    const b64 = STATE.capturedDataUrl.split(',')[1];
    STATE.photoQueue.push(b64);
    STATE.capturedDataUrl = null;
    UI.Toast.success(`✓ Foto ${STATE.photoQueue.length} ditambahkan`);
    // Balik ke kamera untuk foto berikutnya
    Photo._showCameraBar();
    Photo._updateQueueBar();
    // Stream masih aktif, langsung bisa ambil lagi
  },

  // ── Simpan Semua — upload antrian → tiap foto kolom berbeda → balik ──
  async simpanSemua() {
    if (!STATE.photoQueue || !STATE.photoQueue.length) return;

    // Kalau masih ada foto di preview yang belum masuk antrian, masukkan dulu
    if (STATE.capturedDataUrl) {
      const b64 = STATE.capturedDataUrl.split(',')[1];
      STATE.photoQueue.push(b64);
      STATE.capturedDataUrl = null;
    }

    const total = STATE.photoQueue.length;
    UI.Loading.show(`Upload foto 1/${total}...`);
    Photo._stopStream();

    try {
      const type = (STATE.currentDetailType || STATE.createType || 'ob').toUpperCase();
      const urls = [];

      for (let i = 0; i < STATE.photoQueue.length; i++) {
        document.getElementById('gloading-txt').innerText = `Upload foto ${i + 1}/${total}...`;
        const colIndex = (STATE.photoStartIndex || 0) + i;
        const res = await API.uploadFoto(STATE.currentNoTrack, type, STATE.photoQueue[i], colIndex);
        if (res.success && res.url) {
          urls.push(res.url);
        } else {
          UI.Toast.error(`Foto ${i + 1} gagal: ` + (res.error || ''));
        }
      }

      UI.Loading.hide();

      if (urls.length) {
        try {
          const act = (STATE.currentDetailType || STATE.createType || 'ob') === 'ob' ? 'getObList'
                    : (STATE.currentDetailType || STATE.createType) === 'hvs' ? 'getHvsList' : 'getIbList';
          const r = await API.get(act);
          const list = r.list || [];
          const fresh = list.find(d => d.no_track === STATE.currentNoTrack);
          if (fresh) {
            const arr = type === 'OB' ? STATE.obData : type === 'HVS' ? STATE.hvsData : STATE.ibData;
            const idx = arr.findIndex(d => d.no_track === STATE.currentNoTrack);
            if (idx !== -1) arr[idx] = fresh;
            if (STATE.currentDetailItem) STATE.currentDetailItem = fresh;
            fresh.foto_urls = urls;
            if (STATE.currentDetailItem) STATE.currentDetailItem.foto_urls = urls;
          }
        } catch(e) {
          const baseIdx = STATE.photoStartIndex || 0;
          const arr = type === 'OB' ? STATE.obData : type === 'HVS' ? STATE.hvsData : STATE.ibData;
          const item = arr.find(d => d.no_track === STATE.currentNoTrack);
          urls.forEach((url, i) => {
            const colIdx = baseIdx + i;
            const fn = colIdx === 0 ? 'foto_url' : 'foto_url_' + (colIdx + 1);
            if (item) item[fn] = url;
            if (STATE.currentDetailItem) STATE.currentDetailItem[fn] = url;
          });
        }

        UI.Toast.success(`✅ ${urls.length} foto berhasil diupload`);
      }

      STATE.photoQueue = [];
      Photo._afterPhoto();

    } catch(e) {
      UI.Loading.hide();
      UI.Toast.error('Error: ' + e.message);
    }
  },

  // ── Skip / Close tanpa simpan ──
  skip()  { Photo._stopStream(); Photo._afterPhoto(); },
  close() { Photo._stopStream(); Photo._afterPhoto(); },

  // ── Setelah selesai — balik ke home atau detail ──
  _afterPhoto() {
    Photo._stopStream();
    STATE.photoQueue      = [];
    STATE.capturedDataUrl = null;
    HomePage.render();
    HomePage.updateStats();
    if (STATE.currentDetailItem && STATE.scanContext === 'detail') {
      UI.Page.show('pgDetail');
      DetailPage.reloadData();
    } else {
      UI.Page.show('pgHome');
    }
  }
};
