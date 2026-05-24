/* ============================================================
   GTW BDO - forms.js v4.5
   CHANGES dari v4.4:
   - Photo gallery di detail modal (slide/swipe seperti mobile)
     * Navigasi panah kiri/kanan
     * Thumbnail strip
     * Counter foto (1/3, dll)
     * Tombol buka foto penuh
     * Support multi foto (foto_url, foto_url_2, foto_url_3, dst)
   - Detail modal: AWB staging list (antrian) sebelum disimpan
     * Setiap AWB punya icon hapus
     * Tombol "Simpan AWB" untuk commit ke server
   - Duplikat AWB: playBeepError (nada turun/error)
   - Scan biasa duplikat: playBeepError
   - Save OB/HVS/IB: optimistic update - UI update duluan,
     server sync di background (terasa instant)
   - buildAllScanAwbs: debounced 400ms, tidak blocking UI
   ============================================================ */

// --- BEEP SOUNDS ---
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
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.setValueAtTime(340, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.28);
  } catch(e) {}
}

// --- MULTI TUJUAN (OB / HVS) ---
function initObTujuan(tuj) {
  if (!obScanMap[tuj]) obScanMap[tuj] = [];
  obActiveTuj = tuj;
  document.getElementById('obScanInput').disabled = false;
  renderObTabs(); renderObScanList();
}
function initHvsTujuan(tuj) {
  if (!hvsScanMap[tuj]) hvsScanMap[tuj] = [];
  hvsActiveTuj = tuj;
  document.getElementById('hvsScanInput').disabled = false;
  renderHvsTabs(); renderHvsScanList();
}
function initIbTujuan(tuj) {
  if (!ibScanMap[tuj]) ibScanMap[tuj] = [];
  ibActiveTuj = tuj;
  document.getElementById('ibScanInput').disabled = false;
  renderIbTabs(); renderIbScanList();
}

function addMultiTujuan(type) {
  var svcId = type === 'ib' ? 'ibService' : (type === 'ob' ? 'obService' : 'hvsService');
  var hasService = document.getElementById(svcId).value;
  if (!hasService) { toast('Pilih service dahulu', 'error'); return; }
  if (type === 'ib') {
    var hasFrom = document.getElementById('ibFrom').value;
    if (!hasFrom) { toast('Pilih FROM dahulu', 'error'); return; }
  }
  pendingTujuanType = type;
  document.getElementById('newTujuanInput').value = '';
  if (cbRegistry['newTujuanCb']) {
    cbRegistry['newTujuanCb'].options = cbOptions[type].tujuan || [];
    cbRegistry['newTujuanCb'].value = '';
    renderCbOptions('newTujuanCb', '');
  }
  openModal('tujuanModal');
  setTimeout(function() {
    document.getElementById('newTujuanInput').focus();
    openCb2('newTujuanCb');
  }, 120);
}

function confirmAddTujuan() {
  var tuj = document.getElementById('newTujuanInput').value.trim();
  if (!tuj) { toast('Masukkan tujuan', 'error'); return; }
  closeModal('tujuanModal');
  if (pendingTujuanType === 'ob') {
    initObTujuan(tuj);
    document.getElementById('obTujuan').value = tuj;
    if (cbRegistry['obTujuanCb']) cbRegistry['obTujuanCb'].value = tuj;
    checkObForm();
  } else if (pendingTujuanType === 'hvs') {
    initHvsTujuan(tuj);
    document.getElementById('hvsTujuan').value = tuj;
    if (cbRegistry['hvsTujuanCb']) cbRegistry['hvsTujuanCb'].value = tuj;
    checkHvsForm();
  } else if (pendingTujuanType === 'ib') {
    initIbTujuan(tuj);
    checkIbForm();
  }
}

function renderObTabs() {
  var keys = Object.keys(obScanMap);
  document.getElementById('obTujuanTabs').innerHTML = keys.map(function(t) {
    return '<span class="scan-tujuan-tab' + (t === obActiveTuj ? ' active' : '') +
      '" onclick="switchObTuj(\'' + escQ(t) + '\')">' + escH(t) +
      ' <span class="cnt">' + obScanMap[t].length + '</span>' +
      '<span class="rm-tuj material-icons-round" onclick="event.stopPropagation();removeObTuj(\'' + escQ(t) + '\')">cancel</span></span>';
  }).join('');
  updateObTotalLabel();
}
function switchObTuj(t) { obActiveTuj = t; renderObTabs(); renderObScanList(); }
function removeObTuj(t) {
  delete obScanMap[t];
  var k = Object.keys(obScanMap);
  obActiveTuj = k.length ? k[0] : '';
  if (!obActiveTuj) document.getElementById('obScanInput').disabled = true;
  renderObTabs(); renderObScanList(); checkObForm();
}
function renderObScanList() {
  var list = document.getElementById('obScanList');
  if (!obActiveTuj || !obScanMap[obActiveTuj]) {
    list.innerHTML = '<div class="scan-empty">Pilih atau tambah tujuan</div>'; return;
  }
  var arr = obScanMap[obActiveTuj];
  list.innerHTML = arr.length
    ? arr.map(function(awb, i) {
        return '<div class="scan-item">' +
          '<span class="scan-item-awb">' + escH(awb) + '</span>' +
          '<span class="scan-item-tuj">' + escH(obActiveTuj) + '</span>' +
          '<span class="material-icons-round scan-item-del" onclick="removeObAwb(' + i + ')">delete</span>' +
        '</div>';
      }).join('')
    : '<div class="scan-empty">Belum ada AWB untuk tujuan <strong>' + escH(obActiveTuj) + '</strong></div>';
}
function removeObAwb(i) { obScanMap[obActiveTuj].splice(i, 1); renderObTabs(); renderObScanList(); }
function updateObTotalLabel() {
  document.getElementById('obTotalScanLabel').innerText =
    Object.values(obScanMap).reduce(function(s, a) { return s + a.length; }, 0) + ' AWB total';
}

function renderHvsTabs() {
  var keys = Object.keys(hvsScanMap);
  document.getElementById('hvsTujuanTabs').innerHTML = keys.map(function(t) {
    return '<span class="scan-tujuan-tab' + (t === hvsActiveTuj ? ' active' : '') +
      '" onclick="switchHvsTuj(\'' + escQ(t) + '\')">' + escH(t) +
      ' <span class="cnt">' + hvsScanMap[t].length + '</span>' +
      '<span class="rm-tuj material-icons-round" onclick="event.stopPropagation();removeHvsTuj(\'' + escQ(t) + '\')">cancel</span></span>';
  }).join('');
  updateHvsTotalLabel();
}
function switchHvsTuj(t) { hvsActiveTuj = t; renderHvsTabs(); renderHvsScanList(); }
function removeHvsTuj(t) {
  delete hvsScanMap[t];
  var k = Object.keys(hvsScanMap);
  hvsActiveTuj = k.length ? k[0] : '';
  if (!hvsActiveTuj) document.getElementById('hvsScanInput').disabled = true;
  renderHvsTabs(); renderHvsScanList(); checkHvsForm();
}
function renderHvsScanList() {
  var list = document.getElementById('hvsScanList');
  if (!hvsActiveTuj || !hvsScanMap[hvsActiveTuj]) {
    list.innerHTML = '<div class="scan-empty">Pilih atau tambah tujuan</div>'; return;
  }
  var arr = hvsScanMap[hvsActiveTuj];
  list.innerHTML = arr.length
    ? arr.map(function(awb, i) {
        return '<div class="scan-item">' +
          '<span class="scan-item-awb">' + escH(awb) + '</span>' +
          '<span class="scan-item-tuj">' + escH(hvsActiveTuj) + '</span>' +
          '<span class="material-icons-round scan-item-del" onclick="removeHvsAwb(' + i + ')">delete</span>' +
        '</div>';
      }).join('')
    : '<div class="scan-empty">Belum ada AWB untuk tujuan <strong>' + escH(hvsActiveTuj) + '</strong></div>';
}
function removeHvsAwb(i) { hvsScanMap[hvsActiveTuj].splice(i, 1); renderHvsTabs(); renderHvsScanList(); }
function updateHvsTotalLabel() {
  document.getElementById('hvsTotalScanLabel').innerText =
    Object.values(hvsScanMap).reduce(function(s, a) { return s + a.length; }, 0) + ' AWB total';
}

function renderIbTabs() {
  var keys = Object.keys(ibScanMap);
  document.getElementById('ibTujuanTabs').innerHTML = keys.map(function(t) {
    return '<span class="scan-tujuan-tab' + (t === ibActiveTuj ? ' active' : '') +
      '" onclick="switchIbTuj(\'' + escQ(t) + '\')">' + escH(t) +
      ' <span class="cnt">' + ibScanMap[t].length + '</span>' +
      '<span class="rm-tuj material-icons-round" onclick="event.stopPropagation();removeIbTuj(\'' + escQ(t) + '\')">cancel</span></span>';
  }).join('');
  updateIbTotalLabel();
}
function switchIbTuj(t) { ibActiveTuj = t; renderIbTabs(); renderIbScanList(); }
function removeIbTuj(t) {
  delete ibScanMap[t];
  var k = Object.keys(ibScanMap);
  ibActiveTuj = k.length ? k[0] : '';
  if (!ibActiveTuj) document.getElementById('ibScanInput').disabled = true;
  renderIbTabs(); renderIbScanList(); checkIbForm();
}
function renderIbScanList() {
  var list = document.getElementById('ibScanList');
  if (!ibActiveTuj || !ibScanMap[ibActiveTuj]) {
    list.innerHTML = '<div class="scan-empty">Pilih atau tambah tujuan</div>';
    updateIbTotalLabel(); return;
  }
  var arr = ibScanMap[ibActiveTuj];
  list.innerHTML = arr.length
    ? arr.map(function(awb, i) {
        return '<div class="scan-item">' +
          '<span class="scan-item-awb">' + escH(awb) + '</span>' +
          '<span class="scan-item-tuj">' + escH(ibActiveTuj) + '</span>' +
          '<span class="material-icons-round scan-item-del" onclick="removeIbAwb(' + i + ')">delete</span>' +
        '</div>';
      }).join('')
    : '<div class="scan-empty">Belum ada AWB untuk tujuan <strong>' + escH(ibActiveTuj) + '</strong></div>';
  updateIbTotalLabel();
}
function removeIbAwb(i) { ibScanMap[ibActiveTuj].splice(i, 1); renderIbTabs(); renderIbScanList(); }
function updateIbTotalLabel() {
  document.getElementById('ibTotalScanLabel').innerText =
    Object.values(ibScanMap).reduce(function(s, a) { return s + a.length; }, 0) + ' AWB total';
}

// --- SCAN INPUT ---
function handleScan(e, type) {
  if (e.key !== 'Enter') return;
  var input = document.getElementById(type + 'ScanInput');
  var val = input.value.trim();
  if (!val) return;

  var svcEl = document.getElementById(type + 'Service');
  if (!svcEl || !svcEl.value) {
    playBeepError(); toast('Pilih SERVICE dulu', 'error'); input.value = ''; return;
  }

  if (type === 'ob') {
    if (!obActiveTuj) { playBeepError(); toast('Pilih tujuan dahulu', 'error'); return; }
    if (!obScanMap[obActiveTuj]) obScanMap[obActiveTuj] = [];
    if (obScanMap[obActiveTuj].indexOf(val) !== -1) {
      playBeepError(); toast('AWB sudah ada', 'error'); input.value = ''; return;
    }
    obScanMap[obActiveTuj].unshift(val); playBeep();
    renderObTabs(); renderObScanList();

  } else if (type === 'hvs') {
    if (!hvsActiveTuj) { playBeepError(); toast('Pilih tujuan dahulu', 'error'); return; }
    if (!hvsScanMap[hvsActiveTuj]) hvsScanMap[hvsActiveTuj] = [];
    if (hvsScanMap[hvsActiveTuj].indexOf(val) !== -1) {
      playBeepError(); toast('AWB sudah ada', 'error'); input.value = ''; return;
    }
    hvsScanMap[hvsActiveTuj].unshift(val); playBeep();
    renderHvsTabs(); renderHvsScanList();

  } else {
    var from = document.getElementById('ibFrom').value;
    if (!from) {
      playBeepError(); toast('Isi FROM dulu', 'error'); input.value = ''; return;
    }
    if (!ibActiveTuj) { playBeepError(); toast('Pilih tujuan dahulu', 'error'); return; }
    if (!ibScanMap[ibActiveTuj]) ibScanMap[ibActiveTuj] = [];
    if (ibScanMap[ibActiveTuj].indexOf(val) !== -1) {
      playBeepError(); toast('AWB sudah ada', 'error'); input.value = ''; return;
    }
    ibScanMap[ibActiveTuj].unshift(val); playBeep();
    renderIbTabs(); renderIbScanList();
  }
  input.value = '';
}

// --- SAVE OB - OPTIMISTIC UPDATE ---
function saveOb() {
  var service = document.getElementById('obService').value;
  if (!globalIncharge || !service) return;
  var tujuanKeys = Object.keys(obScanMap);
  if (!tujuanKeys.length) { toast('Tambahkan minimal 1 tujuan', 'error'); return; }

  var btn = document.getElementById('btnSaveOb');
  btn.disabled = true;
  btn.innerHTML = '<span class="material-icons-round" style="animation:spin .6s linear infinite;font-size:15px">sync</span> Menyimpan...';

  var now = _nowDisplayStr();
  var optimisticItems = [];

  tujuanKeys.forEach(function(tuj) {
    var fakeId = 'OB_' + service.substring(0,3).toUpperCase() + '_' + tuj.substring(0,8).toUpperCase() + '_SAVING';
    var item = {
      no_track    : fakeId,
      incharge    : globalIncharge,
      service     : service,
      tujuan      : tuj,
      created_date: now,
      status      : 'ON PROSES',
      total_awb   : (obScanMap[tuj] || []).length,
      foto_url    : '',
      _saving     : true
    };
    optimisticItems.push(item);
    obData.unshift(item);
  });
  renderObTable(); updateObStats();
  toast('... Menyimpan ' + tujuanKeys.length + ' tujuan...', '');

  var savedMap = {};
  tujuanKeys.forEach(function(t) { savedMap[t] = (obScanMap[t] || []).slice(); });
  resetObForm();

  Promise.all(tujuanKeys.map(function(tuj) {
    return gasPost('saveOb', {
      incharge: globalIncharge,
      service : service,
      tujuan  : tuj,
      awbList : savedMap[tuj] || []
    });
  })).then(function(results) {
    var errors = results.filter(function(r) { return r.error; });
    optimisticItems.forEach(function(opt) {
      var idx = obData.indexOf(opt);
      if (idx !== -1) obData.splice(idx, 1);
    });
    if (errors.length) {
      toast('Ada error: ' + errors[0].error, 'error');
      renderObTable(); updateObStats();
      return;
    }
    toast(results.length + ' NO TRACK dibuat', 'success');
    _mfLoaded = false; _obibData = null;
    gasGet('getObList').then(function(r) {
      obData = r.list || [];
      renderObTable(); updateObStats();
    }).catch(function() {});
    _debouncedBuildAllScanAwbs();
  }).catch(function(e) {
    optimisticItems.forEach(function(opt) {
      var idx = obData.indexOf(opt);
      if (idx !== -1) obData.splice(idx, 1);
    });
    toast('Error: ' + e.message, 'error');
    renderObTable(); updateObStats();
  });
}

function resetObForm() {
  document.getElementById('obService').value = '';
  document.getElementById('obTujuan').value = '';
  if (cbRegistry['obServiceCb']) cbRegistry['obServiceCb'].value = '';
  if (cbRegistry['obTujuanCb'])  cbRegistry['obTujuanCb'].value = '';
  setCbDisabled('obTujuanCb', true);
  obScanMap = {}; obActiveTuj = '';
  document.getElementById('obTujuanTabs').innerHTML = '';
  document.getElementById('obScanList').innerHTML = '<div class="scan-empty">Pilih service dan tujuan terlebih dahulu</div>';
  document.getElementById('obTotalScanLabel').innerText = '0 AWB total';
  document.getElementById('obScanInput').disabled = true;
  if (document.getElementById('obAddTujBtn')) document.getElementById('obAddTujBtn').disabled = true;
  document.getElementById('obServiceHint').style.display = '';
  checkObForm();
  document.getElementById('obFormBody').classList.remove('open');
  document.getElementById('obFormIcon').innerText = 'expand_more';
}

// --- SAVE HVS - OPTIMISTIC UPDATE ---
function saveHvs() {
  var service = document.getElementById('hvsService').value;
  if (!globalIncharge || !service) return;
  var tujuanKeys = Object.keys(hvsScanMap);
  if (!tujuanKeys.length) { toast('Tambahkan minimal 1 tujuan', 'error'); return; }

  var btn = document.getElementById('btnSaveHvs');
  btn.disabled = true;
  btn.innerHTML = '<span class="material-icons-round" style="animation:spin .6s linear infinite;font-size:15px">sync</span> Menyimpan...';

  var now = _nowDisplayStr();
  var optimisticItems = [];

  tujuanKeys.forEach(function(tuj) {
    var item = {
      no_track    : 'HVS_' + service.substring(0,3).toUpperCase() + '_' + tuj.substring(0,8).toUpperCase() + '_SAVING',
      incharge    : globalIncharge,
      service     : service,
      tujuan      : tuj,
      created_date: now,
      status      : 'ON PROSES',
      total_awb   : (hvsScanMap[tuj] || []).length,
      foto_url    : '',
      _saving     : true
    };
    optimisticItems.push(item);
    hvsData.unshift(item);
  });
  renderHvsTable(); updateHvsStats();
  toast('... Menyimpan ' + tujuanKeys.length + ' tujuan...', '');

  var savedMap = {};
  tujuanKeys.forEach(function(t) { savedMap[t] = (hvsScanMap[t] || []).slice(); });
  resetHvsForm();

  Promise.all(tujuanKeys.map(function(tuj) {
    return gasPost('saveHvs', {
      incharge: globalIncharge,
      service : service,
      tujuan  : tuj,
      awbList : savedMap[tuj] || []
    });
  })).then(function(results) {
    var errors = results.filter(function(r) { return r.error; });
    optimisticItems.forEach(function(opt) {
      var idx = hvsData.indexOf(opt);
      if (idx !== -1) hvsData.splice(idx, 1);
    });
    if (errors.length) {
      toast('Ada error: ' + errors[0].error, 'error');
      renderHvsTable(); updateHvsStats();
      return;
    }
    toast(results.length + ' NO TRACK dibuat', 'success');
    _mfLoaded = false; _obibData = null;
    gasGet('getHvsList').then(function(r) {
      hvsData = r.list || [];
      renderHvsTable(); updateHvsStats();
    }).catch(function() {});
    _debouncedBuildAllScanAwbs();
  }).catch(function(e) {
    optimisticItems.forEach(function(opt) {
      var idx = hvsData.indexOf(opt);
      if (idx !== -1) hvsData.splice(idx, 1);
    });
    toast('Error: ' + e.message, 'error');
    renderHvsTable(); updateHvsStats();
  });
}

function resetHvsForm() {
  document.getElementById('hvsService').value = '';
  document.getElementById('hvsTujuan').value = '';
  if (cbRegistry['hvsServiceCb']) cbRegistry['hvsServiceCb'].value = '';
  if (cbRegistry['hvsTujuanCb'])  cbRegistry['hvsTujuanCb'].value = '';
  setCbDisabled('hvsTujuanCb', true);
  hvsScanMap = {}; hvsActiveTuj = '';
  document.getElementById('hvsTujuanTabs').innerHTML = '';
  document.getElementById('hvsScanList').innerHTML = '<div class="scan-empty">Pilih service dan tujuan terlebih dahulu</div>';
  document.getElementById('hvsTotalScanLabel').innerText = '0 AWB total';
  document.getElementById('hvsScanInput').disabled = true;
  if (document.getElementById('hvsAddTujBtn')) document.getElementById('hvsAddTujBtn').disabled = true;
  document.getElementById('hvsServiceHint').style.display = '';
  checkHvsForm();
  document.getElementById('hvsFormBody').classList.remove('open');
  document.getElementById('hvsFormIcon').innerText = 'expand_more';
}

// --- SAVE IB - OPTIMISTIC UPDATE (MULTI TUJUAN) ---
function saveIb() {
  var service = document.getElementById('ibService').value;
  var from    = document.getElementById('ibFrom').value;
  if (!globalIncharge || !service || !from) {
    toast('Lengkapi SERVICE dan FROM', 'error'); return;
  }
  var tujuanKeys = Object.keys(ibScanMap);
  if (!tujuanKeys.length) { toast('Tambahkan minimal 1 tujuan', 'error'); return; }

  var btn = document.getElementById('btnSaveIb');
  btn.disabled = true;
  btn.innerHTML = '<span class="material-icons-round" style="animation:spin .6s linear infinite;font-size:15px">sync</span> Menyimpan...';

  var now = _nowDisplayStr();
  var optimisticItems = [];

  tujuanKeys.forEach(function(tuj) {
    var item = {
      no_track    : 'IB_' + service.substring(0,3).toUpperCase() + '_' + tuj.substring(0,8).toUpperCase() + '_SAVING',
      incharge    : globalIncharge,
      service     : service,
      from        : from,
      tujuan      : tuj,
      created_date: now,
      status      : 'ON PROSES',
      total_awb   : (ibScanMap[tuj] || []).length,
      foto_url    : '',
      _saving     : true
    };
    optimisticItems.push(item);
    ibData.unshift(item);
  });
  renderIbTable(); updateIbStats();
  toast('... Menyimpan ' + tujuanKeys.length + ' tujuan...', '');

  var savedMap = {};
  tujuanKeys.forEach(function(t) { savedMap[t] = (ibScanMap[t] || []).slice(); });
  resetIbForm();

  Promise.all(tujuanKeys.map(function(tuj) {
    return gasPost('saveIb', {
      incharge: globalIncharge,
      service : service,
      from    : from,
      tujuan  : tuj,
      awbList : savedMap[tuj] || []
    });
  })).then(function(results) {
    var errors = results.filter(function(r) { return r.error; });
    optimisticItems.forEach(function(opt) {
      var idx = ibData.indexOf(opt);
      if (idx !== -1) ibData.splice(idx, 1);
    });
    if (errors.length) {
      toast('Ada error: ' + errors[0].error, 'error');
      renderIbTable(); updateIbStats();
      return;
    }
    toast(results.length + ' NO TRACK IB dibuat', 'success');
    _obibData = null;
    gasGet('getIbList').then(function(r) {
      ibData = r.list || [];
      renderIbTable(); updateIbStats();
    }).catch(function() {});
    _debouncedBuildAllScanAwbs();
  }).catch(function(e) {
    optimisticItems.forEach(function(opt) {
      var idx = ibData.indexOf(opt);
      if (idx !== -1) ibData.splice(idx, 1);
    });
    toast('Error: ' + e.message, 'error');
    renderIbTable(); updateIbStats();
  });
}

function resetIbForm() {
  ['ibService', 'ibFrom'].forEach(function(id) {
    document.getElementById(id).value = '';
    if (cbRegistry[id + 'Cb']) cbRegistry[id + 'Cb'].value = '';
  });
  setCbDisabled('ibFromCb', true);
  document.getElementById('ibScanInput').disabled = true;
  document.getElementById('ibScanInput').placeholder = 'Pilih service & FROM dulu...';
  if (document.getElementById('ibAddTujBtn')) document.getElementById('ibAddTujBtn').disabled = true;
  document.getElementById('ibServiceHint').style.display = '';
  var multiInfo = document.getElementById('ibMultiTujInfo');
  if (multiInfo) multiInfo.style.display = 'none';
  var hint = document.getElementById('ibScanHint');
  if (hint) hint.style.display = 'none';
  ibScanMap = {}; ibActiveTuj = '';
  document.getElementById('ibTujuanTabs').innerHTML = '';
  document.getElementById('ibScanList').innerHTML = '<div class="scan-empty">Pilih service dan FROM terlebih dahulu</div>';
  document.getElementById('ibTotalScanLabel').innerText = '0 AWB total';
  checkIbForm();
  document.getElementById('ibFormBody').classList.remove('open');
  document.getElementById('ibFormIcon').innerText = 'expand_more';
}

// --- TABLE RENDER ---
function statusBadge(s) {
  return (s === 'SELESAI' || s === 'selesai')
    ? '<span class="badge badge-selesai">&#10003; Selesai</span>'
    : '<span class="badge badge-proses">* On Proses</span>';
}
function fotoThumb(url) {
  if (!url) return '<span style="font-size:11px;color:var(--gray4)">-</span>';
  return '<a href="' + url + '" target="_blank">' +
    '<img src="' + url + '" style="width:42px;height:34px;object-fit:cover;border-radius:4px;border:1px solid var(--gray3)">' +
    '</a>';
}

function actionsBtns(type, noTrack, status, isSaving) {
  if (isSaving) {
    return '<div style="display:flex;gap:3px;align-items:center;color:var(--gray5);font-size:11px">' +
      '<span class="material-icons-round" style="font-size:14px;animation:spin .6s linear infinite">sync</span> saving...</div>';
  }
  var isSelesai = (status === 'SELESAI');
  var selesaiBtn = !isSelesai
    ? '<button class="action-btn" title="Tandai Selesai" onclick="markSelesai(\'' + type + '\',\'' + escQ(noTrack) + '\')">' +
        '<span class="material-icons-round" style="color:var(--green)">check_circle</span></button>'
    : '';
  var delBtn = '<button class="action-btn danger" title="' + (isSelesai ? 'Data SELESAI tidak dapat dihapus' : 'Hapus') + '" ' +
    (isSelesai ? 'disabled' : 'onclick="confirmDelete(\'' + type + '\',\'' + escQ(noTrack) + '\')"') +
    '><span class="material-icons-round">delete</span></button>';
  return '<div style="display:flex;gap:3px">' + selesaiBtn + delBtn + '</div>';
}

function renderObTable(filter) {
  var data = filteredData(obData);
  if (filter) {
    var v = filter.toLowerCase();
    data = data.filter(function(d) {
      return (d.no_track + d.incharge + d.service + d.tujuan + d.status).toLowerCase().indexOf(v) !== -1;
    });
  }
  document.getElementById('obTableCount').innerText = data.length + ' record';
  var tbody = document.getElementById('obTbody');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><span class="material-icons-round">inbox</span>Tidak ada data</div></td></tr>';
    return;
  }
  tbody.innerHTML = data.map(function(d, i) {
    var saving = !!d._saving;
    var rowStyle = saving ? ' style="opacity:.6"' : '';
    return '<tr' + rowStyle + '>' +
      '<td style="color:var(--gray5);font-size:11px">' + (i + 1) + '</td>' +
      '<td class="mono">' +
        (saving
          ? '<span style="color:var(--gray4)">' + escH(d.no_track) + '</span>'
          : '<span style="color:var(--blue2);cursor:pointer" onclick="openDetailModal(\'ob\',\'' + escQ(d.no_track) + '\')">' + escH(d.no_track) + '</span>'
        ) +
      '</td>' +
      '<td>' + escH(d.incharge) + '</td>' +
      '<td><span class="badge badge-blue">' + escH(d.service) + '</span></td>' +
      '<td>' + escH(d.tujuan) + '</td>' +
      '<td style="font-size:11px;color:var(--gray6)">' + escH(d.created_date) + '</td>' +
      '<td style="text-align:center;font-weight:700;font-family:var(--mono)">' + d.total_awb + '</td>' +
      '<td>' + statusBadge(d.status) + '</td>' +
      '<td>' + fotoThumb(d.foto_url) + '</td>' +
      '<td>' + actionsBtns('ob', d.no_track, d.status, saving) + '</td>' +
    '</tr>';
  }).join('');
}

function renderHvsTable(filter) {
  var data = filteredData(hvsData);
  if (filter) {
    var v = filter.toLowerCase();
    data = data.filter(function(d) {
      return (d.no_track + d.incharge + d.service + d.tujuan + d.status).toLowerCase().indexOf(v) !== -1;
    });
  }
  document.getElementById('hvsTableCount').innerText = data.length + ' record';
  var tbody = document.getElementById('hvsTbody');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><span class="material-icons-round">inbox</span>Tidak ada data</div></td></tr>';
    return;
  }
  tbody.innerHTML = data.map(function(d, i) {
    var saving = !!d._saving;
    var rowStyle = saving ? ' style="opacity:.6"' : '';
    return '<tr' + rowStyle + '>' +
      '<td style="color:var(--gray5);font-size:11px">' + (i + 1) + '</td>' +
      '<td class="mono">' +
        (saving
          ? '<span style="color:var(--gray4)">' + escH(d.no_track) + '</span>'
          : '<span style="color:var(--blue2);cursor:pointer" onclick="openDetailModal(\'hvs\',\'' + escQ(d.no_track) + '\')">' + escH(d.no_track) + '</span>'
        ) +
      '</td>' +
      '<td>' + escH(d.incharge) + '</td>' +
      '<td><span class="badge badge-purple">' + escH(d.service) + '</span></td>' +
      '<td>' + escH(d.tujuan) + '</td>' +
      '<td style="font-size:11px;color:var(--gray6)">' + escH(d.created_date) + '</td>' +
      '<td style="text-align:center;font-weight:700;font-family:var(--mono)">' + d.total_awb + '</td>' +
      '<td>' + statusBadge(d.status) + '</td>' +
      '<td>' + fotoThumb(d.foto_url) + '</td>' +
      '<td>' + actionsBtns('hvs', d.no_track, d.status, saving) + '</td>' +
    '</tr>';
  }).join('');
}

function renderIbTable(filter) {
  var data = filteredData(ibData);
  if (filter) {
    var v = filter.toLowerCase();
    data = data.filter(function(d) {
      return (d.no_track + d.incharge + d.service + d.tujuan + (d.from || '') + d.status).toLowerCase().indexOf(v) !== -1;
    });
  }
  document.getElementById('ibTableCount').innerText = data.length + ' record';
  var tbody = document.getElementById('ibTbody');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="11"><div class="empty-state"><span class="material-icons-round">inbox</span>Tidak ada data</div></td></tr>';
    return;
  }
  tbody.innerHTML = data.map(function(d, i) {
    var saving = !!d._saving;
    var rowStyle = saving ? ' style="opacity:.6"' : '';
    return '<tr' + rowStyle + '>' +
      '<td style="color:var(--gray5);font-size:11px">' + (i + 1) + '</td>' +
      '<td class="mono">' +
        (saving
          ? '<span style="color:var(--gray4)">' + escH(d.no_track) + '</span>'
          : '<span style="color:var(--blue2);cursor:pointer" onclick="openDetailModal(\'ib\',\'' + escQ(d.no_track) + '\')">' + escH(d.no_track) + '</span>'
        ) +
      '</td>' +
      '<td>' + escH(d.incharge) + '</td>' +
      '<td><span class="badge badge-blue">' + escH(d.service) + '</span></td>' +
      '<td>' + escH(d.from || '-') + '</td>' +
      '<td>' + escH(d.tujuan) + '</td>' +
      '<td style="font-size:11px;color:var(--gray6)">' + escH(d.created_date) + '</td>' +
      '<td style="text-align:center;font-weight:700;font-family:var(--mono)">' + d.total_awb + '</td>' +
      '<td>' + statusBadge(d.status) + '</td>' +
      '<td>' + fotoThumb(d.foto_url) + '</td>' +
      '<td>' + actionsBtns('ib', d.no_track, d.status, saving) + '</td>' +
    '</tr>';
  }).join('');
}

function filterObTable()  { renderObTable(document.getElementById('obSearch').value || ''); }
function filterHvsTable() { renderHvsTable(document.getElementById('hvsSearch').value || ''); }
function filterIbTable()  { renderIbTable(document.getElementById('ibSearch').value || ''); }

// --- MARK SELESAI & DELETE ---
function markSelesai(type, noTrack) {
  var action = type === 'ob' ? 'updateObStatus' : type === 'hvs' ? 'updateHvsStatus' : 'updateIbStatus';
  if (!confirm('Tandai ' + noTrack + ' sebagai SELESAI?')) return;

  var arr = type === 'ob' ? obData : type === 'hvs' ? hvsData : ibData;
  var item = arr.find(function(d) { return d.no_track === noTrack; });
  if (item) item.status = 'SELESAI';
  if (type === 'ob') { renderObTable(); updateObStats(); }
  else if (type === 'hvs') { renderHvsTable(); updateHvsStats(); }
  else { renderIbTable(); updateIbStats(); }
  closeModal('detailModal');
  toast('Status diubah ke SELESAI', 'success');

  gasPost(action, { noTrack: noTrack, newStatus: 'SELESAI' }).then(function(res) {
    if (!res.success) {
      if (item) item.status = 'ON PROSES';
      if (type === 'ob') { renderObTable(); updateObStats(); }
      else if (type === 'hvs') { renderHvsTable(); updateHvsStats(); }
      else { renderIbTable(); updateIbStats(); }
      toast('Gagal update status: ' + (res.error || ''), 'error');
    }
  }).catch(function(e) {
    if (item) item.status = 'ON PROSES';
    if (type === 'ob') { renderObTable(); updateObStats(); }
    else if (type === 'hvs') { renderHvsTable(); updateHvsStats(); }
    else { renderIbTable(); updateIbStats(); }
    toast('Error: ' + e.message, 'error');
  });
}

function confirmDelete(type, noTrack) {
  var arr = type === 'ob' ? obData : type === 'hvs' ? hvsData : ibData;
  var item = arr.find(function(d) { return d.no_track === noTrack; });
  if (item && item.status === 'SELESAI') {
    toast('Data yang sudah SELESAI tidak dapat dihapus', 'error'); return;
  }

  document.getElementById('confirmTitle').innerText = 'Hapus Data';
  document.getElementById('confirmMsg').innerText = 'Hapus ' + noTrack + '? Semua AWB terkait juga akan dihapus.';
  var action = type === 'ob' ? 'deleteOb' : type === 'hvs' ? 'deleteHvs' : 'deleteIb';

  document.getElementById('confirmBtn').onclick = function() {
    closeModal('confirmModal');
    closeModal('detailModal');

    var arr2 = type === 'ob' ? obData : type === 'hvs' ? hvsData : ibData;
    var idx = arr2.findIndex(function(d) { return d.no_track === noTrack; });
    var removed = idx !== -1 ? arr2.splice(idx, 1)[0] : null;
    if (type === 'ob') { renderObTable(); updateObStats(); }
    else if (type === 'hvs') { renderHvsTable(); updateHvsStats(); }
    else { renderIbTable(); updateIbStats(); }
    toast('Data dihapus', 'success');
    _mfLoaded = false; _obibData = null;
    _debouncedBuildAllScanAwbs();

    gasPost(action, { noTrack: noTrack }).then(function(res) {
      if (!res.success) {
        if (removed) {
          arr2.splice(idx === -1 ? 0 : idx, 0, removed);
          if (type === 'ob') { renderObTable(); updateObStats(); }
          else if (type === 'hvs') { renderHvsTable(); updateHvsStats(); }
          else { renderIbTable(); updateIbStats(); }
        }
        toast('Gagal hapus: ' + (res.error || ''), 'error');
      }
    }).catch(function(e) {
      if (removed) {
        arr2.splice(idx === -1 ? 0 : idx, 0, removed);
        if (type === 'ob') { renderObTable(); updateObStats(); }
        else if (type === 'hvs') { renderHvsTable(); updateHvsStats(); }
        else { renderIbTable(); updateIbStats(); }
      }
      toast('Error: ' + e.message, 'error');
    });
  };
  openModal('confirmModal');
}

// ============================================================
// PHOTO GALLERY — Detail Modal
// ============================================================
var _galUrls = [];
var _galIdx  = 0;
var _galTouchStartX = 0;

// Kumpulkan semua URL foto dari item
function _collectFotoUrls(item) {
  var urls = [];
  if (item.foto_url) urls.push(item.foto_url);
  for (var fi = 2; fi <= 10; fi++) {
    var fk = 'foto_url_' + fi;
    if (item[fk]) urls.push(item[fk]);
    else break;
  }
  return urls;
}

// Render gallery ke #detailPhotoBox
function _renderDetailGallery(urls) {
  _galUrls = urls || [];
  _galIdx  = 0;
  var pb = document.getElementById('detailPhotoBox');
  pb.onclick = null;
  pb.style.cursor = 'default';
  pb.innerHTML = _buildGalleryHtml();
  _bindGallerySwipe();
}

// Bangun HTML gallery lengkap
function _buildGalleryHtml() {
  var urls = _galUrls;
  var idx  = _galIdx;
  var n    = urls.length;

  if (!n) {
    return '<span class="no-img"><span class="material-icons-round">photo_camera</span>Belum ada foto</span>';
  }

  // Gambar utama
  var mainImg =
    '<img src="' + escH(urls[idx]) + '" ' +
    'style="width:100%;height:100%;object-fit:contain;display:block;" ' +
    'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
    '<span class="no-img" style="display:none"><span class="material-icons-round">broken_image</span>Foto gagal dimuat</span>';

  // Tombol navigasi
  var prevBtn = n > 1
    ? '<button class="gal-nav gal-prev" onclick="_galMove(-1)" title="Foto sebelumnya">' +
      '<span class="material-icons-round">chevron_left</span></button>'
    : '';
  var nextBtn = n > 1
    ? '<button class="gal-nav gal-next" onclick="_galMove(1)" title="Foto berikutnya">' +
      '<span class="material-icons-round">chevron_right</span></button>'
    : '';

  // Counter "1 / 3"
  var counter = n > 1
    ? '<div class="gal-counter">' + (idx + 1) + ' / ' + n + '</div>'
    : '';

  // Tombol buka penuh
  var openBtn =
    '<a class="gal-open-btn" href="' + escH(urls[idx]) + '" target="_blank" title="Buka foto penuh">' +
    '<span class="material-icons-round">open_in_new</span></a>';

  // Area gambar utama
  var mainArea =
    '<div class="gal-main" id="_galMainArea">' +
      mainImg + prevBtn + nextBtn + counter + openBtn +
    '</div>';

  // Thumbnail strip (hanya kalau > 1 foto)
  var thumbs = '';
  if (n > 1) {
    thumbs = '<div class="gal-thumbs">' +
      urls.map(function(u, i) {
        var activeClass = i === idx ? ' active' : '';
        return '<div class="gal-thumb' + activeClass + '" onclick="_galJump(' + i + ')" title="Foto ' + (i + 1) + '">' +
          '<img src="' + escH(u) + '" ' +
          'onerror="this.parentElement.classList.add(\'err\');this.style.display=\'none\'">' +
        '</div>';
      }).join('') +
    '</div>';
  }

  return mainArea + thumbs;
}

// Navigasi prev/next
function _galMove(dir) {
  var n = _galUrls.length;
  if (n <= 1) return;
  _galIdx = (_galIdx + dir + n) % n;
  _updateGallery();
}

// Lompat ke indeks tertentu (klik thumbnail)
function _galJump(i) {
  if (i === _galIdx) return;
  _galIdx = i;
  _updateGallery();
}

// Update HTML gallery tanpa re-render seluruh modal
function _updateGallery() {
  var pb = document.getElementById('detailPhotoBox');
  if (!pb) return;
  pb.innerHTML = _buildGalleryHtml();
  _bindGallerySwipe();
}

// Touch swipe support
function _bindGallerySwipe() {
  var area = document.getElementById('_galMainArea');
  if (!area || _galUrls.length <= 1) return;
  area.addEventListener('touchstart', function(e) {
    _galTouchStartX = e.changedTouches[0].screenX;
  }, { passive: true });
  area.addEventListener('touchend', function(e) {
    var dx = e.changedTouches[0].screenX - _galTouchStartX;
    if (Math.abs(dx) > 40) _galMove(dx < 0 ? 1 : -1);
  }, { passive: true });
}

// Keyboard arrow support saat modal terbuka
document.addEventListener('keydown', function(e) {
  var modal = document.getElementById('detailModal');
  if (!modal || !modal.classList.contains('open')) return;
  if (_galUrls.length <= 1) return;
  if (e.key === 'ArrowLeft')  { e.preventDefault(); _galMove(-1); }
  if (e.key === 'ArrowRight') { e.preventDefault(); _galMove(1); }
});

// ============================================================
// DETAIL MODAL
// ============================================================
var _detailStagingAwbs  = [];
var _detailExistingAwbs = [];

function openDetailModal(type, noTrack) {
  var data = type === 'ob' ? obData : type === 'hvs' ? hvsData : ibData;
  var item = data.find(function(d) { return d.no_track === noTrack; });
  if (!item) {
    var allData = obData.concat(hvsData).concat(ibData);
    item = allData.find(function(d) { return d.no_track === noTrack; });
    if (!item) { toast('Data tidak ditemukan', 'error'); return; }
    if (noTrack.indexOf('OB_') === 0)  type = 'ob';
    else if (noTrack.indexOf('HVS_') === 0) type = 'hvs';
    else if (noTrack.indexOf('IB_') === 0)  type = 'ib';
  }

  _detailStagingAwbs  = [];
  _detailExistingAwbs = [];

  currentDetailItem = item;
  currentDetailType = type;
  document.getElementById('detailModalTitle').innerText = noTrack;

  // ── Photo Gallery ──
  var fotoUrls = _collectFotoUrls(item);
  _renderDetailGallery(fotoUrls);

  // ── Info fields ──
  var fields = type === 'ib'
    ? [['NO TRACK', item.no_track], ['INCHARGE', item.incharge], ['SERVICE', item.service],
       ['FROM', item.from || '-'], ['TUJUAN', item.tujuan], ['DATE', item.created_date],
       ['STATUS', item.status], ['TOTAL AWB', item.total_awb]]
    : [['NO TRACK', item.no_track], ['INCHARGE', item.incharge], ['SERVICE', item.service],
       ['TUJUAN', item.tujuan], ['DATE', item.created_date], ['STATUS', item.status], ['TOTAL AWB', item.total_awb]];

  document.getElementById('detailGrid').innerHTML = fields.map(function(f) {
    return '<div class="d-field"><div class="d-label">' + escH(f[0]) + '</div><div class="d-value">' + escH(String(f[1])) + '</div></div>';
  }).join('');

  var readonlyEl = document.getElementById('detailReadonlyBar');
  var isSelesai  = item.status === 'SELESAI';
  if (readonlyEl) readonlyEl.style.display = isSelesai ? '' : 'none';

  // ── AWB List ──
  document.getElementById('detailAwbList').innerHTML =
    '<div class="awb-row" style="color:var(--gray5)">Memuat AWB...</div>';
  document.getElementById('awbCount').innerText = '...';

  gasGet('getAwbList', { noTrack: noTrack, type: type.toUpperCase() }).then(function(res) {
    var list = res.list || [];
    _detailExistingAwbs = list.map(function(r) { return r.awb || r; });
    document.getElementById('awbCount').innerText = list.length;
    document.getElementById('detailAwbList').innerHTML = !list.length
      ? '<div class="awb-row" style="color:var(--gray5)">Belum ada AWB</div>'
      : list.map(function(r) {
          return '<div class="awb-row">' +
            '<span>' + escH(r.awb || r) + '</span>' +
            (r.tujuan ? '<span style="color:var(--gray5);font-size:11px">' + escH(r.tujuan) + '</span>' : '') +
          '</div>';
        }).join('');
  }).catch(function() {});

  // ── Tambah AWB Section ──
  var addAwbEl = document.getElementById('detailAddAwbSection');
  if (addAwbEl) {
    if (isSelesai) {
      addAwbEl.style.display = 'none';
    } else {
      addAwbEl.style.display = '';
      addAwbEl.innerHTML =
        '<div style="font-size:10px;font-weight:700;color:var(--gray5);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">TAMBAH AWB</div>' +
        '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">' +
          '<input class="scan-inp" id="detailAddAwbInput" placeholder="Scan / ketik AWB lalu Enter..." autocomplete="off" ' +
            'onkeydown="handleDetailAddAwb(event)" style="flex:1">' +
        '</div>' +
        '<div style="font-size:11px;color:var(--gray5);margin-bottom:8px">' +
          '<span class="material-icons-round" style="font-size:12px;vertical-align:middle">info</span> ' +
          'Enter untuk antre, lalu klik <strong>Simpan AWB</strong>' +
        '</div>' +
        '<div style="font-size:10px;font-weight:700;color:var(--blue2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">' +
          'ANTREAN TAMBAH (<span id="detailStagingCount">0</span>)' +
        '</div>' +
        '<div class="staging-list" id="detailStagingList">' +
          '<div class="staging-empty"><span class="material-icons-round">inbox</span>Belum ada AWB ditambahkan</div>' +
        '</div>' +
        '<div style="margin-top:8px;display:flex;justify-content:flex-end">' +
          '<button class="btn btn-success btn-sm" id="btnSaveDetailAwb" disabled onclick="saveDetailStagingAwbs()">' +
            '<span class="material-icons-round">save</span> Simpan AWB' +
          '</button>' +
        '</div>';

      setTimeout(function() {
        var inp = document.getElementById('detailAddAwbInput');
        if (inp) inp.focus();
      }, 150);
    }
  }

  // ── Footer ──
  var footer = '<button class="btn btn-outline btn-sm" onclick="closeModal(\'detailModal\')">Tutup</button>';
  if (!isSelesai) {
    footer += '<button class="btn btn-success btn-sm" onclick="markSelesai(\'' + type + '\',\'' + escQ(noTrack) + '\')">' +
      '<span class="material-icons-round">check_circle</span> Selesai</button>';
    footer += '<button class="btn btn-danger btn-sm" onclick="confirmDelete(\'' + type + '\',\'' + escQ(noTrack) + '\')">' +
      '<span class="material-icons-round">delete</span></button>';
  }
  document.getElementById('detailModalFooter').innerHTML = footer;
  openModal('detailModal');
}

// --- STAGING AWB: render ---
function _renderDetailStaging() {
  var container = document.getElementById('detailStagingList');
  var countEl   = document.getElementById('detailStagingCount');
  var saveBtn   = document.getElementById('btnSaveDetailAwb');
  if (!container) return;
  if (countEl) countEl.innerText = _detailStagingAwbs.length;
  if (saveBtn) saveBtn.disabled = _detailStagingAwbs.length === 0;

  if (!_detailStagingAwbs.length) {
    container.innerHTML = '<div class="staging-empty"><span class="material-icons-round">inbox</span>Belum ada AWB ditambahkan</div>';
    return;
  }
  container.innerHTML = _detailStagingAwbs.map(function(awb, i) {
    return '<div class="staging-item">' +
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

// --- TAMBAH AWB KE STAGING ---
function handleDetailAddAwb(e) {
  if (e.key !== 'Enter') return;
  var input = document.getElementById('detailAddAwbInput');
  var val = input.value.trim();
  if (!val || !currentDetailItem) return;

  if (_detailStagingAwbs.indexOf(val) !== -1) {
    playBeepError();
    toast('AWB sudah ada di antrean', 'error');
    input.value = '';
    return;
  }
  if (_detailExistingAwbs.indexOf(val) !== -1) {
    playBeepError();
    toast('AWB sudah ada di list ini', 'error');
    input.value = '';
    return;
  }

  _detailStagingAwbs.unshift(val);
  playBeep();
  input.value = '';
  _renderDetailStaging();
}

// --- SIMPAN STAGING KE SERVER ---
function saveDetailStagingAwbs() {
  if (!_detailStagingAwbs.length || !currentDetailItem) return;

  var btn = document.getElementById('btnSaveDetailAwb');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-round" style="animation:spin .6s linear infinite;font-size:15px">sync</span> Menyimpan...';
  }

  var toSave = _detailStagingAwbs.slice();

  gasPost('addAwbToTrack', {
    noTrack : currentDetailItem.no_track,
    type    : currentDetailType.toUpperCase(),
    awbList : toSave
  }).then(function(res) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-icons-round">save</span> Simpan AWB';
    }
    if (res.success) {
      var added = toSave.length;
      _detailExistingAwbs = _detailExistingAwbs.concat(toSave);
      _detailStagingAwbs  = [];
      _renderDetailStaging();
      toast(added + ' AWB disimpan', 'success');

      gasGet('getAwbList', {
        noTrack: currentDetailItem.no_track,
        type   : currentDetailType.toUpperCase()
      }).then(function(r) {
        var list = r.list || [];
        document.getElementById('awbCount').innerText = list.length;
        currentDetailItem.total_awb = list.length;
        document.getElementById('detailAwbList').innerHTML = !list.length
          ? '<div class="awb-row" style="color:var(--gray5)">Belum ada AWB</div>'
          : list.map(function(rr) {
              return '<div class="awb-row">' +
                '<span>' + escH(rr.awb || rr) + '</span>' +
                (rr.tujuan ? '<span style="color:var(--gray5);font-size:11px">' + escH(rr.tujuan) + '</span>' : '') +
              '</div>';
            }).join('');
        var arr = currentDetailType === 'ob' ? obData : currentDetailType === 'hvs' ? hvsData : ibData;
        var itm = arr.find(function(d) { return d.no_track === currentDetailItem.no_track; });
        if (itm) itm.total_awb = list.length;
        if (currentDetailType === 'ob') renderObTable();
        else if (currentDetailType === 'hvs') renderHvsTable();
        else renderIbTable();
        _debouncedBuildAllScanAwbs();
      });
    } else {
      toast('Gagal: ' + (res.error || ''), 'error');
    }
  }).catch(function(ex) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-icons-round">save</span> Simpan AWB';
    }
    toast('Error: ' + ex.message, 'error');
  });
}

// --- buildAllScanAwbs DEBOUNCED ---
var _bawTimer = null;
function buildAllScanAwbs() {
  _debouncedBuildAllScanAwbs();
}
function _debouncedBuildAllScanAwbs() {
  clearTimeout(_bawTimer);
  _bawTimer = setTimeout(function() {
    gasGet('getAllScanAwbs').then(function(r) {
      if (r && r.list) allScanAwbs = r.list;
    }).catch(function() {});
  }, 500);
}

// --- HELPER: timestamp display ---
function _nowDisplayStr() {
  var d = new Date();
  var pad = function(n) { return String(n).padStart(2, '0'); };
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

// --- CSS: staging list & gallery inject sekali ---
(function injectFormsCSS() {
  if (document.getElementById('_formsCSSv45')) return;
  var style = document.createElement('style');
  style.id = '_formsCSSv45';
  style.textContent = [
    /* ── Staging list ── */
    '.staging-list{background:var(--blue-light);border:1.5px solid var(--blue-mid);border-radius:8px;',
    'min-height:42px;max-height:160px;overflow-y:auto}',

    '.staging-item{display:flex;align-items:center;gap:8px;padding:7px 10px;',
    'border-bottom:1px solid var(--blue-mid);font-size:12px;',
    'animation:_stagingIn .13s ease}',
    '.staging-item:last-child{border-bottom:none}',

    '.staging-item-icon{font-size:14px;color:var(--blue);flex-shrink:0}',
    '.staging-item-awb{flex:1;font-family:var(--mono);font-weight:600;color:var(--gray8);',
    'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',

    '.staging-item-del{font-size:16px;color:var(--red);cursor:pointer;',
    'padding:2px;border-radius:4px;flex-shrink:0;transition:.13s}',
    '.staging-item-del:hover{background:var(--red-light)}',

    '.staging-empty{padding:10px;text-align:center;color:var(--blue2);',
    'font-size:12px;opacity:.55;display:flex;align-items:center;',
    'justify-content:center;gap:5px}',
    '.staging-empty .material-icons-round{font-size:15px}',

    '@keyframes _stagingIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}',

    /* ── Gallery ── */
    /* gal-main sudah ada di main.css; tambah ini supaya photo-box jadi container gallery */
    '#detailPhotoBox{display:flex;flex-direction:column;gap:6px;',
    'background:transparent;border-radius:9px;overflow:visible;',
    'min-height:auto;cursor:default}',

    /* animasi fade saat ganti foto */
    '.gal-main img{animation:_galFadeIn .18s ease}',
    '@keyframes _galFadeIn{from{opacity:0}to{opacity:1}}'
  ].join('');
  document.head.appendChild(style);
})();
