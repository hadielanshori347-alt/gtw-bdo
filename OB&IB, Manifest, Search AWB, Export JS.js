/* ============================================================
   GTW BDO — views.js v4.2
   OB&IB combined view, Manifest, Search AWB, Export, Init
   ============================================================ */

// ─── INIT & RELOAD ───
window.onload = function() { initAllCbs(); reloadAll(); };

function reloadAll() {
  showLoading('Memuat data...');
  gasGet('getMasterData').then(function(d) {
    if (d.error) throw new Error(d.error);
    masterData = d; obData = d.obList || []; hvsData = d.hvsList || []; ibData = d.ibList || [];
    populateGlobalIncharge(); buildCbOptions();
    renderObTable(); renderHvsTable(); renderIbTable();
    updateObStats(); updateHvsStats(); updateIbStats();
    _mfLoaded = false; _obibData = null;
    return gasGet('getAllScanAwbs');
  }).then(function(r) {
    if (r && r.list) allScanAwbs = r.list;
    return gasGet('getOBIB');
  }).then(function(r) {
    _obibData = r;
    hideLoading();
  }).catch(function(e) { hideLoading(); toast('❌ ' + e.message, 'error'); });
}

function buildAllScanAwbs() {
  gasGet('getAllScanAwbs').then(function(r) { if (r && r.list) allScanAwbs = r.list; }).catch(function() { });
}

function reloadObib() {
  showLoading('Refresh OB & IB...');
  gasGet('getOBIB').then(function(r) { _obibData = r; hideLoading(); renderObibPage(); }).catch(function(e) { hideLoading(); toast('Error: ' + e.message, 'error'); });
}

// ─── OB&IB PAGE ───
// Layout: 4 baris header (Incharge → Kota → Service → Tipe)
// OUTBOUND/OUTBOUND_HVS: AWB per baris dari dataRows
// INBOUND_HVS: section blocks dari ibSections
// DATE: mirror tanggal dari kolom sebelumnya (collapsed rowspan di baris pertama)
function renderObibPage() {
  var wrap = document.getElementById('obibTableWrap');
  if (!_obibData) { wrap.innerHTML = '<div class="empty-state"><span class="material-icons-round">table_view</span>Memuat data...</div>'; return; }
  if (_obibData.error) { wrap.innerHTML = '<div class="empty-state"><span class="material-icons-round">error</span>' + escH(_obibData.error) + '</div>'; return; }

  var colDefs = _obibData.colDefs || [];
  var dataRows = _obibData.dataRows || [];
  var ibSections = _obibData.ibSections || [];
  var headerR1 = _obibData.headerR1 || [];
  var headerR2 = _obibData.headerR2 || [];
  var headerR3 = _obibData.headerR3 || [];
  var headerR4 = _obibData.headerR4 || [];
  var filter = (document.getElementById('obibSearch').value || '').toLowerCase().trim();

  if (!colDefs.length) { wrap.innerHTML = '<div class="empty-state"><span class="material-icons-round">table_view</span>Tidak ada kolom di sheet OB&IB</div>'; return; }

  var nCols = colDefs.length;

  // Build merged header row
  function buildMergedHeaderRow(hArr, cellClass) {
    var cells = []; var i = 0;
    while (i < nCols) {
      var val = hArr[i] || ''; var span = 1;
      while (i + span < nCols && !(hArr[i + span] || '').trim()) span++;
      cells.push({ val: val, span: span }); i += span;
    }
    return '<tr><th class="obib-rn"></th>' +
      cells.map(function(c) { return '<th colspan="' + c.span + '" class="' + cellClass + '">' + escH(c.val) + '</th>'; }).join('') +
    '</tr>';
  }

  // Tipe kolom → CSS class
  function typeClass(t) {
    t = (t || '').toUpperCase();
    if (t === 'OUTBOUND') return 'outbound';
    if (t === 'OUTBOUND_HVS') return 'outbound-hvs';
    if (t === 'INBOUND_HVS') return 'inbound-hvs';
    if (t === 'DATE') return 'date';
    return '';
  }
  var hdr4Html = '<tr><th class="obib-rn">#</th>' +
    colDefs.map(function(c) { return '<th class="obib-hdr-type ' + typeClass(c.colType) + '">' + escH(c.colType || '—') + '</th>'; }).join('') +
  '</tr>';

  // ibSections lookup: service|tujuan → sections[]
  var ibMap = {};
  ibSections.forEach(function(sec) {
    var k = (sec.service || '').toUpperCase() + '|' + (sec.tujuan || '').toUpperCase();
    if (!ibMap[k]) ibMap[k] = [];
    ibMap[k].push(sec);
  });

  // Build INBOUND_HVS cell HTML
  function buildIbCellHtml(colDef, filterQ) {
    var k = (colDef.r3 || '').toUpperCase() + '|' + (colDef.r2 || '').toUpperCase();
    var secs = ibMap[k] || [];
    if (filterQ) {
      secs = secs.filter(function(sec) {
        return (sec.tujuan + sec.from + sec.service + sec.no_track).toLowerCase().indexOf(filterQ) !== -1
          || (sec.awbs || []).some(function(a) { return (a.awb || '').toLowerCase().indexOf(filterQ) !== -1; });
      });
    }
    if (!secs.length) return '<span class="obib-ib-empty">—</span>';
    return secs.map(function(sec) {
      var label = (sec.tujuan || '') + (sec.from ? '_(' + sec.from + ')' : '');
      var awbs = sec.awbs || [];
      var awbHtml = awbs.length
        ? awbs.map(function(a) { return '<span>' + escH(a.awb || a) + '</span>'; }).join('')
        : '<span style="color:var(--gray4);font-style:italic">— kosong —</span>';
      return '<div class="obib-ib-section">' +
        '<div class="obib-ib-label">' + escH(label) + '</div>' +
        '<div class="obib-ib-awb">' + awbHtml + '</div>' +
      '</div>';
    }).join('');
  }

  // Filter dataRows
  var filteredRows = dataRows;
  if (filter) {
    filteredRows = dataRows.filter(function(row) { return row.some(function(cell) { return (cell || '').toLowerCase().indexOf(filter) !== -1; }); });
  }

  var maxRows = Math.max(filteredRows.length, 1);

  // Build tbody
  var tbodyHtml = '';
  if (maxRows === 1 && filteredRows.length === 0) {
    tbodyHtml += '<tr><td class="obib-rn">1</td>';
    colDefs.forEach(function(c) {
      if (c.colType === 'INBOUND_HVS') tbodyHtml += '<td class="obib-cell-ib">' + buildIbCellHtml(c, filter) + '</td>';
      else tbodyHtml += '<td class="obib-cell-empty"></td>';
    });
    tbodyHtml += '</tr>';
  } else if (filteredRows.length) {
    filteredRows.forEach(function(row, ri) {
      tbodyHtml += '<tr><td class="obib-rn">' + (ri + 1) + '</td>';
      colDefs.forEach(function(c, ci) {
        var val = row[ci] || '';
        var ct = (c.colType || '').toUpperCase();
        if (ct === 'INBOUND_HVS') {
          if (ri === 0) tbodyHtml += '<td class="obib-cell-ib" rowspan="' + filteredRows.length + '">' + buildIbCellHtml(c, filter) + '</td>';
          // baris berikutnya tidak perlu td (rowspan)
        } else if (ct === 'DATE') {
          tbodyHtml += '<td class="obib-cell-date">' + escH(val) + '</td>';
        } else if (val) {
          tbodyHtml += '<td class="obib-cell-awb">' + escH(val) + '</td>';
        } else {
          tbodyHtml += '<td class="obib-cell-empty"></td>';
        }
      });
      tbodyHtml += '</tr>';
    });
  } else {
    tbodyHtml = '<tr><td class="obib-rn">—</td>';
    colDefs.forEach(function(c) {
      if (c.colType === 'INBOUND_HVS') tbodyHtml += '<td class="obib-cell-ib">' + buildIbCellHtml(c, filter) + '</td>';
      else tbodyHtml += '<td class="obib-cell-empty"></td>';
    });
    tbodyHtml += '</tr>';
  }

  var html = '<table class="obib-table">' +
    '<thead>' +
      buildMergedHeaderRow(headerR1, 'obib-hdr-incharge') +
      buildMergedHeaderRow(headerR2, 'obib-hdr-kota') +
      buildMergedHeaderRow(headerR3, 'obib-hdr-service') +
      hdr4Html +
    '</thead>' +
    '<tbody>' + tbodyHtml + '</tbody>' +
  '</table>';
  wrap.innerHTML = html;
}

function filterObib() { renderObibPage(); }

// ─── MANIFEST ───
function loadManifestPage() {
  if (_mfLoaded) { renderManifestSheet(); return; }
  showLoading('Memuat manifest...');
  gasGet('getManifestData').then(function(res) {
    hideLoading();
    if (res.error) { toast('Error manifest: ' + res.error, 'error'); return; }
    _mfData = res; _mfLoaded = true; _mfSelRow = -1; _mfSelCol = -1;
    renderManifestSheet(); setupMfKeyboard();
  }).catch(function(e) { hideLoading(); toast('Error: ' + e.message, 'error'); });
}

function reloadManifest() {
  _mfLoaded = false; _mfData = null; _mfSelRow = -1; _mfSelCol = -1;
  showLoading('Refresh manifest...');
  gasGet('getManifestData').then(function(res) {
    hideLoading();
    if (res.error) { toast('Error: ' + res.error, 'error'); return; }
    _mfData = res; _mfLoaded = true; renderManifestSheet(); setupMfKeyboard();
  }).catch(function(e) { hideLoading(); toast('Error: ' + e.message, 'error'); });
}

function filterManifest() { _mfFilter = document.getElementById('manifestSearch').value || ''; if (_mfLoaded) renderManifestSheet(); }

function renderManifestSheet() {
  if (!_mfData) { document.getElementById('mfSheetOuter').innerHTML = '<div style="padding:40px;text-align:center;color:var(--gray5)"><span class="material-icons-round" style="font-size:40px;color:var(--gray4);display:block;margin-bottom:8px">grid_on</span>Klik Manifest di sidebar</div>'; return; }
  var hRows = _mfData.headerRows || []; var colDefs = _mfData.colDefs || []; var awbRows = _mfData.awbRows || []; var totalCols = _mfData.totalCols || 0;
  var fq = _mfFilter.toLowerCase().trim();
  var filteredAwbRows = awbRows;
  if (fq) { filteredAwbRows = awbRows.filter(function(row) { return row.some(function(cell) { return (cell || '').toLowerCase().indexOf(fq) !== -1; }); }); }
  _mfFilteredRows = filteredAwbRows;
  var incSet = {}; colDefs.forEach(function(c) { if (c.incharge) incSet[c.incharge] = true; });
  var tujCols = colDefs.filter(function(c) { return !c.isDate && c.tujuan; });
  var totalAwb = tujCols.reduce(function(s, c) { var cnt = awbRows.filter(function(r) { return r[c.colIdx] && r[c.colIdx].trim(); }).length; return s + cnt; }, 0);
  document.getElementById('mfTotalCols').innerText = tujCols.length;
  document.getElementById('mfTotalAwb').innerText = totalAwb;
  document.getElementById('mfTotalInc').innerText = Object.keys(incSet).length;
  var nCols = totalCols;
  function buildSpannedRow(hArr, cellClass) {
    var cells = []; var i = 0;
    while (i < nCols) {
      var val = hArr[i] || '';
      if (!val) { cells.push({ val: '', span: 1 }); i++; continue; }
      var span = 1;
      while (i + span < nCols && (!hArr[i + span] || hArr[i + span] === '')) span++;
      cells.push({ val: val, span: span }); i += span;
    }
    return '<tr><th class="mf-rn" style="z-index:5">#</th>' + cells.map(function(c) { return '<th colspan="' + c.span + '" class="' + cellClass + '">' + escH(c.val) + '</th>'; }).join('') + '</tr>';
  }
  var row0Html = buildSpannedRow(hRows[0] || [], 'mf-hdr-incharge');
  var row1Html = buildSpannedRow(hRows[1] || [], 'mf-hdr-service');
  var row2Html = '<tr><th class="mf-rn">—</th>' + colDefs.map(function(c) { if (c.isDate) return '<th class="mf-hdr-date">DATE</th>'; return '<th class="mf-hdr-tujuan">' + escH(c.tujuan) + '</th>'; }).join('') + '</tr>';
  var dataHtml = filteredAwbRows.length ? filteredAwbRows.map(function(row, ri) {
    return '<tr class="mf-data-row" data-ri="' + ri + '"><td class="mf-rn">' + (ri + 1) + '</td>' + colDefs.map(function(c, ci) {
      var val = row[c.colIdx] || ''; var isSel = (_mfSelRow === ri && _mfSelCol === ci);
      if (c.isDate) return '<td class="mf-cell-date' + (isSel ? ' mf-cell-selected' : '') + '" data-ci="' + ci + '" data-ri="' + ri + '" onclick="mfSelectCell(' + ri + ',' + ci + ')">' + escH(val) + '</td>';
      if (!val) return '<td class="mf-cell-empty' + (isSel ? ' mf-cell-selected' : '') + '" data-ci="' + ci + '" data-ri="' + ri + '" onclick="mfSelectCell(' + ri + ',' + ci + ')"></td>';
      return '<td class="mf-cell-awb' + (isSel ? ' mf-cell-selected' : '') + '" data-ci="' + ci + '" data-ri="' + ri + '" onclick="mfSelectCell(' + ri + ',' + ci + ')" title="' + escH(val) + '">' + escH(val) + '</td>';
    }).join('') + '</tr>';
  }).join('') : '<tr><td class="mf-rn" style="color:var(--gray5)">—</td><td colspan="' + (nCols || 1) + '" style="text-align:center;padding:20px;color:var(--gray5);font-size:12px">Tidak ada data AWB</td></tr>';
  var tableHtml = '<table class="mf-table"><thead>' + row0Html + row1Html + row2Html + '</thead><tbody>' + dataHtml + '</tbody></table>';
  document.getElementById('mfSheetOuter').innerHTML = tableHtml;
  updateMfActiveCellLabel();
}

function mfSelectCell(ri, ci) {
  _mfSelRow = ri; _mfSelCol = ci;
  document.querySelectorAll('.mf-cell-selected').forEach(function(el) { el.classList.remove('mf-cell-selected'); });
  var target = document.querySelector('[data-ri="' + ri + '"][data-ci="' + ci + '"]');
  if (target) { target.classList.add('mf-cell-selected'); target.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  updateMfActiveCellLabel();
  document.getElementById('mfSheetOuter').focus();
}

function updateMfActiveCellLabel() {
  var el = document.getElementById('mfActiveCell'); if (!el) return;
  if (_mfSelRow < 0 || _mfSelCol < 0 || !_mfData) { el.innerText = '—'; return; }
  var row = _mfFilteredRows[_mfSelRow]; var colDefs = _mfData.colDefs || []; var c = colDefs[_mfSelCol];
  if (!row || !c) { el.innerText = '—'; return; }
  el.innerText = (row[c.colIdx] || '(kosong)');
}

function setupMfKeyboard() {
  var outer = document.getElementById('mfSheetOuter');
  if (!outer || outer._kbSetup) return;
  outer._kbSetup = true;
  outer.addEventListener('keydown', function(e) {
    if (!_mfData) return;
    var colDefs = _mfData.colDefs || []; var nRows = _mfFilteredRows.length; var nCols = colDefs.length;
    if (!nRows || !nCols) return;
    if (_mfSelRow < 0) { _mfSelRow = 0; _mfSelCol = 0; }
    var moved = false;
    if (e.key === 'ArrowDown') { e.preventDefault(); _mfSelRow = Math.min(_mfSelRow + 1, nRows - 1); moved = true; }
    else if (e.key === 'ArrowUp') { e.preventDefault(); _mfSelRow = Math.max(_mfSelRow - 1, 0); moved = true; }
    else if (e.key === 'ArrowRight') { e.preventDefault(); _mfSelCol = Math.min(_mfSelCol + 1, nCols - 1); moved = true; }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); _mfSelCol = Math.max(_mfSelCol - 1, 0); moved = true; }
    else if (e.key === 'Tab') { e.preventDefault(); _mfSelCol = (_mfSelCol + 1) % nCols; if (_mfSelCol === 0) _mfSelRow = Math.min(_mfSelRow + 1, nRows - 1); moved = true; }
    else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); copyMfCell(); return; }
    if (moved) {
      document.querySelectorAll('.mf-cell-selected').forEach(function(el) { el.classList.remove('mf-cell-selected'); });
      var target = document.querySelector('[data-ri="' + _mfSelRow + '"][data-ci="' + _mfSelCol + '"]');
      if (target) { target.classList.add('mf-cell-selected'); target.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
      updateMfActiveCellLabel();
    }
  });
}

function copyMfCell() {
  if (_mfSelRow < 0 || _mfSelCol < 0 || !_mfData) return;
  var row = _mfFilteredRows[_mfSelRow]; var colDefs = _mfData.colDefs || []; var c = colDefs[_mfSelCol];
  if (!row || !c) return;
  var val = row[c.colIdx] || '';
  if (!val) { toast('Sel kosong', 'error'); return; }
  navigator.clipboard.writeText(val).then(function() { showCopyFlash(val); }).catch(function() {
    var ta = document.createElement('textarea'); ta.value = val; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); showCopyFlash(val); } catch(ex) { toast('Gagal copy', 'error'); }
    document.body.removeChild(ta);
  });
}

function showCopyFlash(val) {
  var el = document.getElementById('copyFlash'); el.innerText = '✓ Copied: ' + val; el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(function() { el.classList.remove('show'); }, 1200);
}

// ─── SEARCH AWB ───
function handleSidebarSearch(e) {
  var input = document.getElementById('sidebarSearchInput'); var val = input.value.trim();
  if (e.key === 'Enter' && val) { switchPage('search'); document.getElementById('searchAwbMainInput').value = val; doSearchAwb(val); input.value = ''; }
}

function doSearchAwb(q) {
  q = (q || '').trim();
  var hdr = document.getElementById('searchAwbResult').querySelector('.search-awb-result-hdr');
  var body = document.getElementById('searchAwbResultBody');
  if (!q) { hdr.innerHTML = '<span class="material-icons-round">info</span> Masukkan nomor AWB untuk mencari'; body.innerHTML = '<div class="search-awb-empty"><span class="material-icons-round">search</span>Ketik nomor AWB di atas untuk mencari di semua data</div>'; return; }
  var ql = q.toLowerCase();
  var results = allScanAwbs.filter(function(item) { return (item.awb || '').toLowerCase().indexOf(ql) !== -1; });
  hdr.innerHTML = '<span class="material-icons-round">' + (results.length ? 'check_circle' : 'search_off') + '</span> ' + (results.length ? results.length + ' hasil ditemukan untuk "' + escH(q) + '"' : 'Tidak ada hasil untuk "' + escH(q) + '"');
  if (!results.length) { body.innerHTML = '<div class="search-awb-empty"><span class="material-icons-round">search_off</span>AWB tidak ditemukan di semua data OB, HVS, dan IB</div>'; return; }
  var typeLabel = { OB: 'Outbound BDO', HVS: 'Outbound HVS', IB: 'Inbound HVS' };
  var typeIcon = { OB: 'local_shipping', HVS: 'inventory_2', IB: 'move_to_inbox' };
  body.innerHTML = results.map(function(item) {
    var t = (item.type || 'OB').toUpperCase();
    var awbHl = escH(item.awb).replace(new RegExp('(' + escRegex(escH(q)) + ')', 'gi'), '<mark>$1</mark>');
    return '<div class="search-awb-item">' +
      '<div class="search-awb-item-icon ' + t.toLowerCase() + '"><span class="material-icons-round">' + typeIcon[t] + '</span></div>' +
      '<div class="search-awb-item-main">' +
        '<div class="search-awb-item-awb">' + awbHl + '</div>' +
        '<div class="search-awb-item-meta">' +
          '<span class="search-awb-type-tag ' + t.toLowerCase() + '">' + typeLabel[t] + '</span>' +
          '<span>' + escH(item.incharge || '—') + '</span>' +
          '<span>•</span><span>' + escH(item.service || '—') + '</span>' +
          '<span>•</span><span>→ ' + escH(item.tujuan || '—') + '</span>' +
          (item.from ? '<span>• FROM: ' + escH(item.from) + '</span>' : '') +
          '<span>•</span><span style="color:var(--gray4)">' + escH(item.date || '') + '</span>' +
        '</div>' +
        '<div style="margin-top:3px">NO TRACK: <span class="search-awb-item-notrack" onclick="openDetailModal(\'' + t.toLowerCase() + '\',\'' + escQ(item.noTrack) + '\')">' + escH(item.noTrack) + '</span></div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function clearSearchAwb() { document.getElementById('searchAwbMainInput').value = ''; doSearchAwb(''); }

// ─── EXPORT ───
function exportCSV() {
  var page = document.querySelector('.nav-item.active .nav-label');
  var pname = page ? page.innerText : '';
  var data, headers, filename;
  if (pname.indexOf('Outbound BDO') !== -1) { data = filteredData(obData); headers = ['no_track', 'incharge', 'service', 'tujuan', 'created_date', 'status', 'total_awb']; filename = 'OB_export.csv'; }
  else if (pname.indexOf('Outbound HVS') !== -1) { data = filteredData(hvsData); headers = ['no_track', 'incharge', 'service', 'tujuan', 'created_date', 'status', 'total_awb']; filename = 'HVS_export.csv'; }
  else if (pname.indexOf('Inbound HVS') !== -1) { data = filteredData(ibData); headers = ['no_track', 'incharge', 'service', 'from', 'tujuan', 'created_date', 'status', 'total_awb']; filename = 'IB_export.csv'; }
  else { toast('Pilih halaman OB/HVS/IB dulu', 'error'); return; }
  var csv = headers.join(',') + '\n' + data.map(function(d) { return headers.map(function(h) { return '"' + (d[h] || '') + '"'; }).join(','); }).join('\n');
  dlCSV(csv, filename);
}

function exportManifestCSV() {
  if (!_mfData) { toast('Manifest belum dimuat', 'error'); return; }
  var colDefs = _mfData.colDefs || []; var awbRows = _mfData.awbRows || []; var hRows = _mfData.headerRows || [];
  if (!colDefs.length) { toast('Tidak ada data manifest', 'error'); return; }
  var h0 = hRows[0] || []; var h1 = hRows[1] || []; var h2 = hRows[2] || [];
  var csvRows = [];
  csvRows.push(['#'].concat(h0).map(function(v) { return '"' + v + '"'; }).join(','));
  csvRows.push([''].concat(h1).map(function(v) { return '"' + v + '"'; }).join(','));
  csvRows.push([''].concat(h2).map(function(v) { return '"' + v + '"'; }).join(','));
  awbRows.forEach(function(row, i) { csvRows.push(['"' + (i + 1) + '"'].concat(row.map(function(c) { return '"' + (c || '') + '"'; })).join(',')); });
  dlCSV(csvRows.join('\n'), 'manifest_export.csv');
}

function exportObibCSV() {
  if (!_obibData) { toast('Data OB&IB belum dimuat', 'error'); return; }
  var colDefs = _obibData.colDefs || []; var dataRows = _obibData.dataRows || []; var ibSections = _obibData.ibSections || [];
  var rows = [['TYPE', 'SERVICE', 'FROM', 'TUJUAN_KOTA', 'TUJUAN_IB', 'DATE', 'STATUS', 'TOTAL AWB', 'NO TRACK', 'AWB']];
  ibSections.forEach(function(sec) {
    if (sec.awbs && sec.awbs.length) { sec.awbs.forEach(function(a, i) { rows.push(['IB', sec.service, sec.from, sec.tujuan, '', sec.date, sec.status, sec.totalAwb, i === 0 ? sec.no_track : '', a.awb || a]); }); }
    else rows.push(['IB', sec.service, sec.from, sec.tujuan, '', sec.date, sec.status, sec.totalAwb, sec.no_track, '']);
  });
  colDefs.forEach(function(c, ci) {
    var ct = (c.colType || '').toUpperCase();
    if (ct === 'OUTBOUND' || ct === 'OUTBOUND_HVS') { dataRows.forEach(function(row) { var val = row[ci]; if (val) rows.push([ct, c.r3, '-', c.r2, '', '-', '-', '-', '-', val]); }); }
  });
  var csv = rows.map(function(r) { return r.map(function(c) { return '"' + (c || '') + '"'; }).join(','); }).join('\n');
  dlCSV(csv, 'OBIB_export.csv');
}

function dlCSV(csv, fn) { var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }); var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fn; a.click(); }