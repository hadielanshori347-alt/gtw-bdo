/* ============================================================
   GTW BDO — forms.js v4.2
   Multi-tujuan scan, save, table render, mark selesai, delete
   ============================================================ */

// ─── MULTI TUJUAN (OB / HVS) ───
function initObTujuan(tuj) { if (!obScanMap[tuj]) obScanMap[tuj] = []; obActiveTuj = tuj; document.getElementById('obScanInput').disabled = false; renderObTabs(); renderObScanList(); }
function initHvsTujuan(tuj) { if (!hvsScanMap[tuj]) hvsScanMap[tuj] = []; hvsActiveTuj = tuj; document.getElementById('hvsScanInput').disabled = false; renderHvsTabs(); renderHvsScanList(); }

function addMultiTujuan(type) {
  var hasService = (type === 'ob' ? document.getElementById('obService') : document.getElementById('hvsService')).value;
  if (!hasService) { toast('Pilih service dahulu', 'error'); return; }
  pendingTujuanType = type;
  document.getElementById('newTujuanInput').value = '';
  if (cbRegistry['newTujuanCb']) { cbRegistry['newTujuanCb'].options = cbOptions[type].tujuan || []; cbRegistry['newTujuanCb'].value = ''; renderCbOptions('newTujuanCb', ''); }
  openModal('tujuanModal');
  setTimeout(function() { document.getElementById('newTujuanInput').focus(); openCb2('newTujuanCb'); }, 120);
}

function confirmAddTujuan() {
  var tuj = document.getElementById('newTujuanInput').value.trim();
  if (!tuj) { toast('Masukkan tujuan', 'error'); return; }
  closeModal('tujuanModal');
  if (pendingTujuanType === 'ob') { initObTujuan(tuj); document.getElementById('obTujuan').value = tuj; if (cbRegistry['obTujuanCb']) cbRegistry['obTujuanCb'].value = tuj; checkObForm(); }
  else if (pendingTujuanType === 'hvs') { initHvsTujuan(tuj); document.getElementById('hvsTujuan').value = tuj; if (cbRegistry['hvsTujuanCb']) cbRegistry['hvsTujuanCb'].value = tuj; checkHvsForm(); }
}

function renderObTabs() {
  var keys = Object.keys(obScanMap);
  document.getElementById('obTujuanTabs').innerHTML = keys.map(function(t) {
    return '<span class="scan-tujuan-tab' + (t === obActiveTuj ? ' active' : '') + '" onclick="switchObTuj(\'' + escQ(t) + '\')">' + t + ' <span class="cnt">' + obScanMap[t].length + '</span><span class="rm-tuj material-icons-round" onclick="event.stopPropagation();removeObTuj(\'' + escQ(t) + '\')">cancel</span></span>';
  }).join('');
  updateObTotalLabel();
}
function switchObTuj(t) { obActiveTuj = t; renderObTabs(); renderObScanList(); }
function removeObTuj(t) { delete obScanMap[t]; var k = Object.keys(obScanMap); obActiveTuj = k.length ? k[0] : ''; if (!obActiveTuj) document.getElementById('obScanInput').disabled = true; renderObTabs(); renderObScanList(); checkObForm(); }
function renderObScanList() { var list = document.getElementById('obScanList'); if (!obActiveTuj || !obScanMap[obActiveTuj]) { list.innerHTML = '<div class="scan-empty">Pilih atau tambah tujuan</div>'; return; } var arr = obScanMap[obActiveTuj]; list.innerHTML = arr.length ? arr.map(function(awb, i) { return '<div class="scan-item"><span class="scan-item-awb">' + awb + '</span><span class="scan-item-tuj">' + obActiveTuj + '</span><span class="material-icons-round scan-item-del" onclick="removeObAwb(' + i + ')">delete</span></div>'; }).join('') : '<div class="scan-empty">Belum ada AWB untuk tujuan <strong>' + obActiveTuj + '</strong></div>'; }
function removeObAwb(i) { obScanMap[obActiveTuj].splice(i, 1); renderObTabs(); renderObScanList(); }
function updateObTotalLabel() { document.getElementById('obTotalScanLabel').innerText = Object.values(obScanMap).reduce(function(s, a) { return s + a.length; }, 0) + ' AWB total'; }

function renderHvsTabs() {
  var keys = Object.keys(hvsScanMap);
  document.getElementById('hvsTujuanTabs').innerHTML = keys.map(function(t) {
    return '<span class="scan-tujuan-tab' + (t === hvsActiveTuj ? ' active' : '') + '" onclick="switchHvsTuj(\'' + escQ(t) + '\')">' + t + ' <span class="cnt">' + hvsScanMap[t].length + '</span><span class="rm-tuj material-icons-round" onclick="event.stopPropagation();removeHvsTuj(\'' + escQ(t) + '\')">cancel</span></span>';
  }).join('');
  updateHvsTotalLabel();
}
function switchHvsTuj(t) { hvsActiveTuj = t; renderHvsTabs(); renderHvsScanList(); }
function removeHvsTuj(t) { delete hvsScanMap[t]; var k = Object.keys(hvsScanMap); hvsActiveTuj = k.length ? k[0] : ''; if (!hvsActiveTuj) document.getElementById('hvsScanInput').disabled = true; renderHvsTabs(); renderHvsScanList(); checkHvsForm(); }
function renderHvsScanList() { var list = document.getElementById('hvsScanList'); if (!hvsActiveTuj || !hvsScanMap[hvsActiveTuj]) { list.innerHTML = '<div class="scan-empty">Pilih atau tambah tujuan</div>'; return; } var arr = hvsScanMap[hvsActiveTuj]; list.innerHTML = arr.length ? arr.map(function(awb, i) { return '<div class="scan-item"><span class="scan-item-awb">' + awb + '</span><span class="scan-item-tuj">' + hvsActiveTuj + '</span><span class="material-icons-round scan-item-del" onclick="removeHvsAwb(' + i + ')">delete</span></div>'; }).join('') : '<div class="scan-empty">Belum ada AWB untuk tujuan <strong>' + hvsActiveTuj + '</strong></div>'; }
function removeHvsAwb(i) { hvsScanMap[hvsActiveTuj].splice(i, 1); renderHvsTabs(); renderHvsScanList(); }
function updateHvsTotalLabel() { document.getElementById('hvsTotalScanLabel').innerText = Object.values(hvsScanMap).reduce(function(s, a) { return s + a.length; }, 0) + ' AWB total'; }

function renderIbScanList() { var list = document.getElementById('ibScanList'); var total = ibScanned.length; document.getElementById('ibTotalScanLabel').innerText = total + ' AWB total'; list.innerHTML = !total ? '<div class="scan-empty">Belum ada AWB di-scan</div>' : ibScanned.map(function(awb, i) { return '<div class="scan-item"><span class="scan-item-awb">' + awb + '</span><span class="material-icons-round scan-item-del" onclick="ibScanned.splice(' + i + ',1);renderIbScanList()">delete</span></div>'; }).join(''); }

// ─── SCAN INPUT ───
function handleScan(e, type) {
  if (e.key !== 'Enter') return;
  var input = document.getElementById(type + 'ScanInput');
  var val = input.value.trim(); if (!val) return;
  var svcEl = document.getElementById(type + 'Service');
  if (!svcEl || !svcEl.value) { toast('Pilih SERVICE dulu', 'error'); input.value = ''; return; }
  if (type === 'ob') {
    if (!obActiveTuj) { toast('Pilih tujuan dahulu', 'error'); return; }
    if (!obScanMap[obActiveTuj]) obScanMap[obActiveTuj] = [];
    if (obScanMap[obActiveTuj].indexOf(val) === -1) obScanMap[obActiveTuj].unshift(val);
    else { toast('AWB sudah ada', 'error'); input.value = ''; return; }
    renderObTabs(); renderObScanList();
  } else if (type === 'hvs') {
    if (!hvsActiveTuj) { toast('Pilih tujuan dahulu', 'error'); return; }
    if (!hvsScanMap[hvsActiveTuj]) hvsScanMap[hvsActiveTuj] = [];
    if (hvsScanMap[hvsActiveTuj].indexOf(val) === -1) hvsScanMap[hvsActiveTuj].unshift(val);
    else { toast('AWB sudah ada', 'error'); input.value = ''; return; }
    renderHvsTabs(); renderHvsScanList();
  } else {
    var from = document.getElementById('ibFrom').value;
    var tuj = document.getElementById('ibTujuan').value;
    if (!from || !tuj) { toast('Isi FROM & TUJUAN dulu', 'error'); input.value = ''; return; }
    if (ibScanned.indexOf(val) === -1) ibScanned.unshift(val);
    else { toast('AWB sudah ada', 'error'); input.value = ''; return; }
    renderIbScanList();
  }
  input.value = '';
}

// ─── SAVE ───
function saveOb() {
  var service = document.getElementById('obService').value;
  if (!globalIncharge || !service) return;
  var tujuanKeys = Object.keys(obScanMap);
  if (!tujuanKeys.length) { toast('Tambahkan minimal 1 tujuan', 'error'); return; }
  showLoading('Menyimpan...');
  Promise.all(tujuanKeys.map(function(tuj) { return gasPost('saveOb', { incharge: globalIncharge, service: service, tujuan: tuj, awbList: obScanMap[tuj] || [] }); }))
    .then(function(results) {
      hideLoading();
      var errors = results.filter(function(r) { return r.error; });
      if (errors.length) { toast('Ada error: ' + errors[0].error, 'error'); return; }
      toast('✅ ' + results.length + ' NO TRACK dibuat', 'success');
      resetObForm(); _mfLoaded = false; _obibData = null; buildAllScanAwbs();
      gasGet('getObList').then(function(r) { obData = r.list || []; renderObTable(); updateObStats(); }).catch(function() { });
    }).catch(function(e) { hideLoading(); toast('Error: ' + e.message, 'error'); });
}

function resetObForm() {
  document.getElementById('obService').value = ''; document.getElementById('obTujuan').value = '';
  if (cbRegistry['obServiceCb']) cbRegistry['obServiceCb'].value = '';
  if (cbRegistry['obTujuanCb']) cbRegistry['obTujuanCb'].value = '';
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

function saveHvs() {
  var service = document.getElementById('hvsService').value;
  if (!globalIncharge || !service) return;
  var tujuanKeys = Object.keys(hvsScanMap);
  if (!tujuanKeys.length) { toast('Tambahkan minimal 1 tujuan', 'error'); return; }
  showLoading('Menyimpan...');
  Promise.all(tujuanKeys.map(function(tuj) { return gasPost('saveHvs', { incharge: globalIncharge, service: service, tujuan: tuj, awbList: hvsScanMap[tuj] || [] }); }))
    .then(function(results) {
      hideLoading();
      var errors = results.filter(function(r) { return r.error; });
      if (errors.length) { toast('Ada error: ' + errors[0].error, 'error'); return; }
      toast('✅ ' + results.length + ' NO TRACK dibuat', 'success');
      resetHvsForm(); _mfLoaded = false; _obibData = null; buildAllScanAwbs();
      gasGet('getHvsList').then(function(r) { hvsData = r.list || []; renderHvsTable(); updateHvsStats(); }).catch(function() { });
    }).catch(function(e) { hideLoading(); toast('Error: ' + e.message, 'error'); });
}

function resetHvsForm() {
  document.getElementById('hvsService').value = ''; document.getElementById('hvsTujuan').value = '';
  if (cbRegistry['hvsServiceCb']) cbRegistry['hvsServiceCb'].value = '';
  if (cbRegistry['hvsTujuanCb']) cbRegistry['hvsTujuanCb'].value = '';
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

function saveIb() {
  var service = document.getElementById('ibService').value;
  var from = document.getElementById('ibFrom').value;
  var tujuan = document.getElementById('ibTujuan').value;
  if (!globalIncharge || !service || !from || !tujuan) { toast('Lengkapi semua field', 'error'); return; }
  showLoading('Menyimpan...');
  gasPost('saveIb', { incharge: globalIncharge, service: service, from: from, tujuan: tujuan, awbList: ibScanned.slice() })
    .then(function(res) {
      hideLoading();
      if (res.error) { toast('Gagal: ' + res.error, 'error'); return; }
      toast('✅ IB disimpan! NO TRACK: ' + res.noTrack, 'success');
      resetIbForm(); _obibData = null; buildAllScanAwbs();
      gasGet('getIbList').then(function(r) { ibData = r.list || []; renderIbTable(); updateIbStats(); }).catch(function() { });
    }).catch(function(e) { hideLoading(); toast('Error: ' + e.message, 'error'); });
}

function resetIbForm() {
  ['ibService', 'ibFrom', 'ibTujuan'].forEach(function(id) { document.getElementById(id).value = ''; if (cbRegistry[id + 'Cb']) cbRegistry[id + 'Cb'].value = ''; });
  setCbDisabled('ibFromCb', true); setCbDisabled('ibTujuanCb', true);
  document.getElementById('ibScanInput').disabled = true;
  document.getElementById('ibScanInput').placeholder = 'Isi FROM & TUJUAN dulu...';
  document.getElementById('ibServiceHint').style.display = '';
  var hint = document.getElementById('ibScanHint'); if (hint) hint.style.display = 'none';
  ibScanned = []; renderIbScanList(); checkIbForm();
  document.getElementById('ibFormBody').classList.remove('open');
  document.getElementById('ibFormIcon').innerText = 'expand_more';
}

// ─── TABLE RENDER ───
function statusBadge(s) { return (s === 'SELESAI' || s === 'selesai') ? '<span class="badge badge-selesai">✓ Selesai</span>' : '<span class="badge badge-proses">● On Proses</span>'; }
function fotoThumb(url) {
  if (!url) return '<span style="font-size:11px;color:var(--gray4)">—</span>';
  return '<a href="' + url + '" target="_blank"><img src="' + url + '" style="width:42px;height:34px;object-fit:cover;border-radius:4px;border:1px solid var(--gray3)"></a>';
}

// Actions column: Selesai button is disabled if status is already SELESAI; Edit/Delete disabled if SELESAI
function actionsBtns(type, noTrack, status) {
  var isSelesai = (status === 'SELESAI');
  var selesaiBtn = !isSelesai
    ? '<button class="action-btn" title="Tandai Selesai" onclick="markSelesai(\'' + type + '\',\'' + escQ(noTrack) + '\')"><span class="material-icons-round" style="color:var(--green)">check_circle</span></button>'
    : '';
  var delBtn = '<button class="action-btn danger" title="' + (isSelesai ? 'Data SELESAI tidak dapat dihapus' : 'Hapus') + '" ' + (isSelesai ? 'disabled' : 'onclick="confirmDelete(\'' + type + '\',\'' + escQ(noTrack) + '\')"') + '><span class="material-icons-round">delete</span></button>';
  return '<div style="display:flex;gap:3px">' + selesaiBtn + delBtn + '</div>';
}

function renderObTable(filter) {
  var data = filteredData(obData);
  if (filter) { var v = filter.toLowerCase(); data = data.filter(function(d) { return (d.no_track + d.incharge + d.service + d.tujuan + d.status).toLowerCase().indexOf(v) !== -1; }); }
  document.getElementById('obTableCount').innerText = data.length + ' record';
  var tbody = document.getElementById('obTbody');
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><span class="material-icons-round">inbox</span>Tidak ada data</div></td></tr>'; return; }
  tbody.innerHTML = data.map(function(d, i) {
    return '<tr><td style="color:var(--gray5);font-size:11px">' + (i + 1) + '</td><td class="mono"><span style="color:var(--blue2);cursor:pointer" onclick="openDetailModal(\'ob\',\'' + escQ(d.no_track) + '\')">' + d.no_track + '</span></td><td>' + d.incharge + '</td><td><span class="badge badge-blue">' + d.service + '</span></td><td>' + d.tujuan + '</td><td style="font-size:11px;color:var(--gray6)">' + d.created_date + '</td><td style="text-align:center;font-weight:700;font-family:var(--mono)">' + d.total_awb + '</td><td>' + statusBadge(d.status) + '</td><td>' + fotoThumb(d.foto_url) + '</td><td>' + actionsBtns('ob', d.no_track, d.status) + '</td></tr>';
  }).join('');
}

function renderHvsTable(filter) {
  var data = filteredData(hvsData);
  if (filter) { var v = filter.toLowerCase(); data = data.filter(function(d) { return (d.no_track + d.incharge + d.service + d.tujuan + d.status).toLowerCase().indexOf(v) !== -1; }); }
  document.getElementById('hvsTableCount').innerText = data.length + ' record';
  var tbody = document.getElementById('hvsTbody');
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><span class="material-icons-round">inbox</span>Tidak ada data</div></td></tr>'; return; }
  tbody.innerHTML = data.map(function(d, i) {
    return '<tr><td style="color:var(--gray5);font-size:11px">' + (i + 1) + '</td><td class="mono"><span style="color:var(--blue2);cursor:pointer" onclick="openDetailModal(\'hvs\',\'' + escQ(d.no_track) + '\')">' + d.no_track + '</span></td><td>' + d.incharge + '</td><td><span class="badge badge-purple">' + d.service + '</span></td><td>' + d.tujuan + '</td><td style="font-size:11px;color:var(--gray6)">' + d.created_date + '</td><td style="text-align:center;font-weight:700;font-family:var(--mono)">' + d.total_awb + '</td><td>' + statusBadge(d.status) + '</td><td>' + fotoThumb(d.foto_url) + '</td><td>' + actionsBtns('hvs', d.no_track, d.status) + '</td></tr>';
  }).join('');
}

function renderIbTable(filter) {
  var data = filteredData(ibData);
  if (filter) { var v = filter.toLowerCase(); data = data.filter(function(d) { return (d.no_track + d.incharge + d.service + d.tujuan + (d.from || '') + d.status).toLowerCase().indexOf(v) !== -1; }); }
  document.getElementById('ibTableCount').innerText = data.length + ' record';
  var tbody = document.getElementById('ibTbody');
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="11"><div class="empty-state"><span class="material-icons-round">inbox</span>Tidak ada data</div></td></tr>'; return; }
  tbody.innerHTML = data.map(function(d, i) {
    return '<tr><td style="color:var(--gray5);font-size:11px">' + (i + 1) + '</td><td class="mono"><span style="color:var(--blue2);cursor:pointer" onclick="openDetailModal(\'ib\',\'' + escQ(d.no_track) + '\')">' + d.no_track + '</span></td><td>' + d.incharge + '</td><td><span class="badge badge-blue">' + d.service + '</span></td><td>' + (d.from || '—') + '</td><td>' + d.tujuan + '</td><td style="font-size:11px;color:var(--gray6)">' + d.created_date + '</td><td style="text-align:center;font-weight:700;font-family:var(--mono)">' + d.total_awb + '</td><td>' + statusBadge(d.status) + '</td><td>' + fotoThumb(d.foto_url) + '</td><td>' + actionsBtns('ib', d.no_track, d.status) + '</td></tr>';
  }).join('');
}

function filterObTable() { renderObTable(document.getElementById('obSearch').value || ''); }
function filterHvsTable() { renderHvsTable(document.getElementById('hvsSearch').value || ''); }
function filterIbTable() { renderIbTable(document.getElementById('ibSearch').value || ''); }

// ─── MARK SELESAI & DELETE ───
function markSelesai(type, noTrack) {
  var action = type === 'ob' ? 'updateObStatus' : type === 'hvs' ? 'updateHvsStatus' : 'updateIbStatus';
  if (!confirm('Tandai ' + noTrack + ' sebagai SELESAI?')) return;
  showLoading('Mengubah status...');
  gasPost(action, { noTrack: noTrack, newStatus: 'SELESAI' }).then(function(res) {
    hideLoading();
    if (res.success) {
      var arr = type === 'ob' ? obData : type === 'hvs' ? hvsData : ibData;
      var item = arr.find(function(d) { return d.no_track === noTrack; });
      if (item) item.status = 'SELESAI';
      if (type === 'ob') { renderObTable(); updateObStats(); }
      else if (type === 'hvs') { renderHvsTable(); updateHvsStats(); }
      else { renderIbTable(); updateIbStats(); }
      toast('Status diubah ke SELESAI', 'success');
      closeModal('detailModal');
    } else toast('Gagal: ' + (res.error || ''), 'error');
  }).catch(function(e) { hideLoading(); toast('Error: ' + e.message, 'error'); });
}

function confirmDelete(type, noTrack) {
  // Cek jika status SELESAI — tidak boleh dihapus
  var arr = type === 'ob' ? obData : type === 'hvs' ? hvsData : ibData;
  var item = arr.find(function(d) { return d.no_track === noTrack; });
  if (item && item.status === 'SELESAI') { toast('Data yang sudah SELESAI tidak dapat dihapus', 'error'); return; }

  document.getElementById('confirmTitle').innerText = 'Hapus Data';
  document.getElementById('confirmMsg').innerText = 'Hapus ' + noTrack + '? Semua AWB terkait juga akan dihapus.';
  var action = type === 'ob' ? 'deleteOb' : type === 'hvs' ? 'deleteHvs' : 'deleteIb';
  document.getElementById('confirmBtn').onclick = function() {
    closeModal('confirmModal'); closeModal('detailModal');
    showLoading('Menghapus...');
    gasPost(action, { noTrack: noTrack }).then(function(res) {
      hideLoading();
      if (res.success) {
        if (type === 'ob') { obData = obData.filter(function(d) { return d.no_track !== noTrack; }); renderObTable(); updateObStats(); }
        else if (type === 'hvs') { hvsData = hvsData.filter(function(d) { return d.no_track !== noTrack; }); renderHvsTable(); updateHvsStats(); }
        else { ibData = ibData.filter(function(d) { return d.no_track !== noTrack; }); renderIbTable(); updateIbStats(); }
        _mfLoaded = false; _obibData = null; buildAllScanAwbs();
        toast('Data dihapus', 'success');
      } else toast('Gagal: ' + (res.error || ''), 'error');
    }).catch(function(e) { hideLoading(); toast('Error: ' + e.message, 'error'); });
  };
  openModal('confirmModal');
}

// ─── DETAIL MODAL ───
function openDetailModal(type, noTrack) {
  var data = type === 'ob' ? obData : type === 'hvs' ? hvsData : ibData;
  var item = data.find(function(d) { return d.no_track === noTrack; });
  if (!item) {
    var allData = obData.concat(hvsData).concat(ibData);
    item = allData.find(function(d) { return d.no_track === noTrack; });
    if (!item) { toast('Data tidak ditemukan', 'error'); return; }
    if (noTrack.indexOf('OB_') === 0) type = 'ob';
    else if (noTrack.indexOf('HVS_') === 0) type = 'hvs';
    else if (noTrack.indexOf('IB_') === 0) type = 'ib';
  }
  currentDetailItem = item; currentDetailType = type;
  document.getElementById('detailModalTitle').innerText = noTrack;

  var isSelesai = item.status === 'SELESAI';
  var pb = document.getElementById('detailPhotoBox');

  // Photo box — if selesai, no click to change; if not selesai, allow click to upload
  if (item.foto_url) {
    pb.innerHTML = '<img src="' + item.foto_url + '" onerror="this.parentElement.innerHTML=\'<span class=no-img><span class=material-icons-round>broken_image</span>Foto gagal dimuat</span>\'">' +
      (!isSelesai ? '<div class="photo-overlay"><span class="material-icons-round">photo_camera</span></div>' : '');
    if (!isSelesai) pb.onclick = function() { document.getElementById('fotoInput').click(); };
    else pb.onclick = null;
    pb.style.cursor = isSelesai ? 'default' : 'pointer';
  } else {
    pb.innerHTML = '<span class="no-img"><span class="material-icons-round">photo_camera</span>' + (isSelesai ? 'Tidak ada foto' : 'Klik untuk tambah foto') + '</span>';
    if (!isSelesai) pb.onclick = function() { document.getElementById('fotoInput').click(); };
    else pb.onclick = null;
    pb.style.cursor = isSelesai ? 'default' : 'pointer';
  }

  var fields = type === 'ib'
    ? [['NO TRACK', item.no_track], ['INCHARGE', item.incharge], ['SERVICE', item.service], ['FROM', item.from || '—'], ['TUJUAN', item.tujuan], ['DATE', item.created_date], ['STATUS', item.status], ['TOTAL AWB', item.total_awb]]
    : [['NO TRACK', item.no_track], ['INCHARGE', item.incharge], ['SERVICE', item.service], ['TUJUAN', item.tujuan], ['DATE', item.created_date], ['STATUS', item.status], ['TOTAL AWB', item.total_awb]];
  document.getElementById('detailGrid').innerHTML = fields.map(function(f) { return '<div class="d-field"><div class="d-label">' + f[0] + '</div><div class="d-value">' + f[1] + '</div></div>'; }).join('');

  // Foto button — hide if selesai
  var fotoRowEl = document.getElementById('detailFotoRow');
  if (fotoRowEl) fotoRowEl.style.display = isSelesai ? 'none' : '';

  // Readonly notice if selesai
  var readonlyEl = document.getElementById('detailReadonlyBar');
  if (readonlyEl) readonlyEl.style.display = isSelesai ? '' : 'none';

  document.getElementById('detailAwbList').innerHTML = '<div class="awb-row" style="color:var(--gray5)">Memuat AWB...</div>';
  document.getElementById('awbCount').innerText = '...';
  gasGet('getAwbList', { noTrack: noTrack, type: type.toUpperCase() }).then(function(res) {
    var list = res.list || [];
    document.getElementById('awbCount').innerText = list.length;
    document.getElementById('detailAwbList').innerHTML = !list.length
      ? '<div class="awb-row" style="color:var(--gray5)">Belum ada AWB</div>'
      : list.map(function(r) { return '<div class="awb-row"><span>' + (r.awb || r) + '</span>' + (r.tujuan ? '<span style="color:var(--gray5);font-size:11px">' + r.tujuan + '</span>' : '') + '</div>'; }).join('');
  }).catch(function() { });

  var footer = '<button class="btn btn-outline btn-sm" onclick="closeModal(\'detailModal\')">Tutup</button>';
  if (!isSelesai) {
    footer += '<button class="btn btn-success btn-sm" onclick="markSelesai(\'' + type + '\',\'' + escQ(noTrack) + '\')"><span class="material-icons-round">check_circle</span> Selesai</button>';
    footer += '<button class="btn btn-danger btn-sm" onclick="confirmDelete(\'' + type + '\',\'' + escQ(noTrack) + '\')"><span class="material-icons-round">delete</span></button>';
  }
  document.getElementById('detailModalFooter').innerHTML = footer;
  openModal('detailModal');
}

// ─── FOTO ───
function onFotoChange(e) {
  var file = e.target.files[0];
  if (!file || !currentDetailItem) return;
  if (currentDetailItem.status === 'SELESAI') { toast('Data SELESAI tidak dapat diubah', 'error'); return; }
  var reader = new FileReader();
  reader.onload = function(ev) {
    var b64 = ev.target.result.split(',')[1];
    showLoading('Mengupload foto...');
    gasPost('updateFoto', { noTrack: currentDetailItem.no_track, type: currentDetailType.toUpperCase(), base64Data: b64 })
      .then(function(res) {
        hideLoading();
        if (res.success && res.url) {
          var pb = document.getElementById('detailPhotoBox');
          pb.innerHTML = '<img src="' + res.url + '"><div class="photo-overlay"><span class="material-icons-round">photo_camera</span></div>';
          currentDetailItem.foto_url = res.url;
          toast('Foto berhasil diperbarui', 'success');
          var arr = currentDetailType === 'ob' ? obData : currentDetailType === 'hvs' ? hvsData : ibData;
          var item = arr.find(function(d) { return d.no_track === currentDetailItem.no_track; });
          if (item) item.foto_url = res.url;
          if (currentDetailType === 'ob') renderObTable();
          else if (currentDetailType === 'hvs') renderHvsTable();
          else renderIbTable();
        } else toast('Gagal upload: ' + (res.error || ''), 'error');
      }).catch(function(e) { hideLoading(); toast('Error: ' + e.message, 'error'); });
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}