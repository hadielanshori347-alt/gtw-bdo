// ════════════════════════════════════════════
// PHOTO — Camera capture & upload
// ════════════════════════════════════════════

const Photo = {
  go() {
    STATE.capturedDataUrl = null;
    STATE.gpsCoords = null;

    const preview   = document.getElementById('photoPreview');
    const video     = document.getElementById('photoVideo');
    const barAmbil  = document.getElementById('barAmbil');
    const barResult = document.getElementById('barResult');
    const barAfter  = document.getElementById('barAfterSave');

    preview.style.display  = 'none';
    video.style.display    = 'block';
    barAmbil.classList.remove('hidden');
    barResult.classList.add('hidden');
    barAfter.classList.add('hidden');
    document.getElementById('gpsBar').innerText = '📍 Mendapatkan lokasi...';

    UI.Page.show('pgPhoto');
    Photo._startCamera();
    Photo._getGps();
  },

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

      // Reverse geocode (non-blocking)
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
        .then(s => { STATE.photoStream = s; document.getElementById('photoVideo').srcObject = s; })
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

  ambil() {
    const video  = document.getElementById('photoVideo');
    const canvas = document.getElementById('photoCanvas');
    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Watermark
    const now = new Date();
    const pad = n => n < 10 ? '0' + n : n;
    const waktu = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const lines = [waktu, `Service: ${STATE.currentSvc}`, `Tujuan: ${STATE.currentTuj}`, `Lokasi: ${STATE.gpsCoords || '—'}`];
    const fs    = Math.max(14, Math.floor(canvas.width / 40));
    const lh    = fs + 8, p = 12;
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

    document.getElementById('photoPreview').src = STATE.capturedDataUrl;
    document.getElementById('photoPreview').style.display = 'block';
    document.getElementById('photoVideo').style.display   = 'none';
    document.getElementById('barAmbil').classList.add('hidden');
    document.getElementById('barResult').classList.remove('hidden');
  },

  ulangi() {
    STATE.capturedDataUrl = null;
    document.getElementById('photoPreview').style.display = 'none';
    document.getElementById('photoVideo').style.display   = 'block';
    document.getElementById('barAmbil').classList.remove('hidden');
    document.getElementById('barResult').classList.add('hidden');
  },

  async simpan() {
    if (!STATE.capturedDataUrl) return;
    UI.Loading.show('Upload foto...');
    try {
      const type = (STATE.currentDetailType || STATE.createType || 'ob').toUpperCase();
      const b64  = STATE.capturedDataUrl.split(',')[1];
      const res  = await API.uploadFoto(STATE.currentNoTrack, type, b64);
      UI.Loading.hide();
      if (res.success && res.url) {
        if (STATE.currentDetailItem) STATE.currentDetailItem.foto_url = res.url;
        const arr = STATE.currentDetailType === 'ob' ? STATE.obData : STATE.currentDetailType === 'hvs' ? STATE.hvsData : STATE.ibData;
        const item = arr.find(d => d.no_track === STATE.currentNoTrack);
        if (item) item.foto_url = res.url;
        UI.Toast.success('Foto berhasil diupload');
        // Tampilkan tombol Tambah Foto setelah simpan
        document.getElementById('barResult').classList.add('hidden');
        document.getElementById('barAfterSave').classList.remove('hidden');
      } else {
        UI.Toast.error('Gagal upload: ' + (res.error || ''));
      }
    } catch(e) {
      UI.Loading.hide();
      UI.Toast.error('Error: ' + e.message);
    }
  },

  tambahFoto() {
    // Reset state dan buka kamera lagi untuk foto tambahan
    STATE.capturedDataUrl = null;
    document.getElementById('photoPreview').style.display = 'none';
    document.getElementById('photoVideo').style.display   = 'block';
    document.getElementById('barAmbil').classList.remove('hidden');
    document.getElementById('barResult').classList.add('hidden');
    document.getElementById('barAfterSave').classList.add('hidden');
    Photo._startCamera();
  },

  selesai() {
    Photo._afterPhoto();
  },

  skip() { Photo._stopStream(); Photo._afterPhoto(); },
  close() { Photo._stopStream(); Photo._afterPhoto(); },

  _afterPhoto() {
    Photo._stopStream();
    HomePage.render(); HomePage.updateStats();
    if (STATE.currentDetailItem && STATE.scanContext === 'detail') {
      UI.Page.show('pgDetail');
      DetailPage.reloadData();
    } else {
      UI.Page.show('pgHome');
    }
  }
};
