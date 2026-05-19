/* ============================================================
   GTW BDO — forms.js PATCH v4.4
   CHANGES:
   1. Detail modal: AWB staging list (belum langsung save)
      - Input → masuk staging list dulu
      - Setiap AWB ada icon hapus
      - Ada tombol "Simpan AWB" untuk commit ke server
   2. Duplikat AWB → playBeepError (nada rendah/error)
   3. Performance: optimasi render & loading
   ============================================================ */

// ─── BEEP SOUNDS ───
function playBeep() {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046, ctx.currentTime);
    gain.gain.setValueAtTime(0.6, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.18);
  } catch(e) {}
}

function playBeepError() {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    // Dua nada pendek turun — sinyal error
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.setValueAtTime(360, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.28);
  } catch(e) {}
}

// ─── STAGING AWB (untuk detail modal) ───
var _detailStagingAwbs = [];   // AWB yang belum disimpan
var _detailExistingAwbs = [];  // AWB yang sudah ada di server (untuk cek duplikat)

function _renderDetailStaging() {
  var container = document.getElementById('detailStagingList');
  if (!container) return;

  var countEl = document.getElementById('detailStagingCount');
  if (countEl) countEl.innerText = _detailStagingAwbs.length;

  var saveBtn = document.getElementById('btnSaveDetailAwb');
  if (saveBtn) saveBtn.disabled = _detailStagingAwbs.length === 0;

  if (!_detailStagingAwbs.length) {
    container.innerHTML = '<div class="staging-empty"><span class="material-icons-round">inbox</span>Belum ada AWB ditambahkan</div>';
    return;
  }

  container.innerHTML = _detailStagingAwbs.map(function(awb, i) {
    return '<div class="staging-item" id="staging-item-' + i + '">' +
      '<span class="material-icons-round staging-item-icon">qr_code</span>' +
      '<span class="staging-item-awb">' + escH(awb) + '</span>' +
      '<span class="material-icons-round staging-item-del" onclick="removeDetailStaging(' + i + ')">delete</span>' +
    '</div>';
  }).join('');
}

function removeDetailStaging(i) {
  _detailStagingAwbs.splice(i, 1);
  _renderDetailStaging();
}

function handleDetailAddAwb(e) {
  if (e.key !== 'Enter') return;
  var input = document.getElementById('detailAddAwbInput');
  var val = input.value.trim();
  if (!val || !currentDetailItem) return;

  // Cek duplikat di staging
  if (_detailStagingAwbs.indexOf(val) !== -1) {
    playBeepError();
    toast('AWB sudah ada di daftar tambah', 'error');
    input.value = '';
    return;
  }

  // Cek duplikat di existing (sudah tersimpan)
  if (_detailExistingAwbs.indexOf(val) !== -1) {
    playBeepError();
    toast('AWB sudah ada di list ini', 'error');
    input.value = '';
    return;
  }

  // Masuk staging
  _detailStagingAwbs.unshift(val);
  playBeep();
  input.value = '';
  _renderDetailStaging();
}

function saveDetailStagingAwbs() {
  if (!_detailStagingAwbs.length || !currentDetailItem) return;

  var btn = document.getElementById('btnSaveDetailAwb');
  var originalText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-round" style="animation:spin .6s linear infinite">sync</span> Menyimpan...';
  }

  gasPost('addAwbToTrack', {
    noTrack : currentDetailItem.no_track,
    type    : currentDetailType.toUpperCase(),
    awbList : _detailStagingAwbs.slice()
  }).then(function(res) {
    if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
    if (res.success) {
      var added = _detailStagingAwbs.length;
      _detailExistingAwbs = _detailExistingAwbs.concat(_detailStagingAwbs);
      _detailStagingAwbs = [];
      _renderDetailStaging();
      toast('✅ ' + added + ' AWB berhasil disimpan', 'success');

      // Reload AWB list
      gasGet('getAwbList', { noTrack: currentDetailItem.no_track, type: currentDetailType.toUpperCase() }).then(function(r) {
        var list = r.list || [];
        document.getElementById('awbCount').innerText = list.length;
        currentDetailItem.total_awb = list.length;
        document.getElementById('detailAwbList').innerHTML = !list.length
          ? '<div class="awb-row" style="color:var(--gray5)">Belum ada AWB</div>'
          : list.map(function(rr) {
              return '<div class="awb-row"><span>' + escH(rr.awb || rr) + '</span>' +
                (rr.tujuan ? '<span style="color:var(--gray5);font-size:11px">' + escH(rr.tujuan) + '</span>' : '') + '</div>';
            }).join('');
        // Sync array utama
        var arr = currentDetailType === 'ob' ? obData : currentDetailType === 'hvs' ? hvsData : ibData;
        var itm = arr.find(function(d) { return d.no_track === currentDetailItem.no_track; });
        if (itm) itm.total_awb = list.length;
        if (currentDetailType === 'ob') renderObTable();
        else if (currentDetailType === 'hvs') renderHvsTable();
        else renderIbTable();
        buildAllScanAwbs();
      });
    } else {
      if (btn) btn.disabled = false;
      toast('Gagal: ' + (res.error || ''), 'error');
    }
  }).catch(function(ex) {
    if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
    toast('Error: ' + ex.message, 'error');
  });
}

// ─── PATCH openDetailModal: inject staging UI + reset staging state ───
var _origOpenDetailModal = window.openDetailModal;

window.openDetailModal = function(type, noTrack) {
  // Reset staging setiap buka modal
  _detailStagingAwbs = [];
  _detailExistingAwbs = [];

  // Panggil original
  _origOpenDetailModal(type, noTrack);

  // Setelah modal terbuka, patch section tambah AWB
  var addSection = document.getElementById('detailAddAwbSection');
  if (!addSection) return;

  // Inject HTML baru (staging list + tombol simpan)
  var isSelesai = currentDetailItem && currentDetailItem.status === 'SELESAI';
  if (!isSelesai) {
    addSection.innerHTML =
      '<div style="font-size:10px;font-weight:700;color:var(--gray5);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">' +
        'TAMBAH AWB' +
      '</div>' +
      '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">' +
        '<input class="scan-inp" id="detailAddAwbInput" placeholder="Scan / ketik AWB lalu Enter..." autocomplete="off" ' +
          'onkeydown="handleDetailAddAwb(event)" style="flex:1">' +
      '</div>' +
      '<div style="font-size:11px;color:var(--gray5);margin-bottom:8px">' +
        '<span class="material-icons-round" style="font-size:12px;vertical-align:middle">info</span> ' +
        'Tekan Enter untuk menambah ke daftar, lalu klik <strong>Simpan AWB</strong>' +
      '</div>' +
      // Staging list
      '<div style="font-size:10px;font-weight:700;color:var(--blue);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">' +
        'DAFTAR TAMBAH (<span id="detailStagingCount">0</span>)' +
      '</div>' +
      '<div class="staging-list" id="detailStagingList">' +
        '<div class="staging-empty"><span class="material-icons-round">inbox</span>Belum ada AWB ditambahkan</div>' +
      '</div>' +
      '<div style="margin-top:8px;display:flex;justify-content:flex-end">' +
        '<button class="btn btn-success btn-sm" id="btnSaveDetailAwb" disabled onclick="saveDetailStagingAwbs()">' +
          '<span class="material-icons-round">save</span> Simpan AWB' +
        '</button>' +
      '</div>';

    // Focus input
    setTimeout(function() {
      var inp = document.getElementById('detailAddAwbInput');
      if (inp) inp.focus();
    }, 120);
  }

  // Kumpulkan existing AWBs setelah list dimuat
  // Kita listen dengan observer sementara atau tunggu load selesai
  gasGet('getAwbList', { noTrack: noTrack, type: type.toUpperCase() }).then(function(res) {
    _detailExistingAwbs = (res.list || []).map(function(r) { return r.awb || r; });
  }).catch(function() {});
};

// ─── PERFORMANCE: Fast scan input (OB / HVS / IB) ───
// Override handleScan agar lebih responsif — hapus delay tidak perlu
var _origHandleScan = window.handleScan;
window.handleScan = function(e, type) {
  if (e.key !== 'Enter') return;
  var input = document.getElementById(type + 'ScanInput');
  var val = input.value.trim();
  if (!val) return;

  var svcEl = document.getElementById(type + 'Service');
  if (!svcEl || !svcEl.value) { playBeepError(); toast('Pilih SERVICE dulu', 'error'); input.value = ''; return; }

  if (type === 'ob') {
    if (!obActiveTuj) { playBeepError(); toast('Pilih tujuan dahulu', 'error'); return; }
    if (!obScanMap[obActiveTuj]) obScanMap[obActiveTuj] = [];
    if (obScanMap[obActiveTuj].indexOf(val) !== -1) { playBeepError(); toast('AWB sudah ada', 'error'); input.value = ''; return; }
    obScanMap[obActiveTuj].unshift(val); playBeep();
    renderObTabs(); renderObScanList();
  } else if (type === 'hvs') {
    if (!hvsActiveTuj) { playBeepError(); toast('Pilih tujuan dahulu', 'error'); return; }
    if (!hvsScanMap[hvsActiveTuj]) hvsScanMap[hvsActiveTuj] = [];
    if (hvsScanMap[hvsActiveTuj].indexOf(val) !== -1) { playBeepError(); toast('AWB sudah ada', 'error'); input.value = ''; return; }
    hvsScanMap[hvsActiveTuj].unshift(val); playBeep();
    renderHvsTabs(); renderHvsScanList();
  } else {
    var from = document.getElementById('ibFrom').value;
    var tuj = document.getElementById('ibTujuan').value;
    if (!from || !tuj) { playBeepError(); toast('Isi FROM & TUJUAN dulu', 'error'); input.value = ''; return; }
    if (ibScanned.indexOf(val) !== -1) { playBeepError(); toast('AWB sudah ada', 'error'); input.value = ''; return; }
    ibScanned.unshift(val); playBeep();
    renderIbScanList();
  }
  input.value = '';
};

// ─── PERFORMANCE: Debounce reloadAll & buildAllScanAwbs ───
// buildAllScanAwbs tidak perlu tunggu — fire-and-forget, tidak blocking UI
var _bawTimer = null;
var _origBuildAllScanAwbs = window.buildAllScanAwbs;
window.buildAllScanAwbs = function() {
  clearTimeout(_bawTimer);
  _bawTimer = setTimeout(function() {
    gasGet('getAllScanAwbs').then(function(r) {
      if (r && r.list) allScanAwbs = r.list;
    }).catch(function() {});
  }, 400);
};

/* ─── CSS INJECTION: Staging list styles ─── */
(function() {
  var style = document.createElement('style');
  style.textContent = [
    '.staging-list{background:var(--blue-light);border:1.5px solid var(--blue-mid);border-radius:8px;min-height:44px;max-height:160px;overflow-y:auto}',
    '.staging-item{display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid var(--blue-mid);font-size:12px}',
    '.staging-item:last-child{border-bottom:none}',
    '.staging-item-icon{font-size:14px;color:var(--blue);flex-shrink:0}',
    '.staging-item-awb{flex:1;font-family:var(--mono);font-weight:600;color:var(--gray8)}',
    '.staging-item-del{font-size:16px;color:var(--red);cursor:pointer;padding:2px;border-radius:4px;flex-shrink:0;transition:.15s}',
    '.staging-item-del:hover{background:var(--red-light)}',
    '.staging-empty{padding:12px;text-align:center;color:var(--blue2);font-size:12px;opacity:.6;display:flex;align-items:center;justify-content:center;gap:6px}',
    '.staging-empty .material-icons-round{font-size:15px}',
    // Animasi add item
    '@keyframes slideInStaging{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}',
    '.staging-item{animation:slideInStaging .15s ease}'
  ].join('\n');
  document.head.appendChild(style);
})();
