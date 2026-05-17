/* ============================================================
   GTW BDO — views.js v4.2
   OB&IB combined view, Manifest (dari 5-in-one, getManifestData),
   Search AWB, Sidebar search, Export CSV, Reload, buildAllScanAwbs
   ============================================================ */

// ─── INIT & RELOAD ───
window.addEventListener('DOMContentLoaded', function () {
  showLoading('Memuat data...');
  gasGet('getMasterData').then(function (r) {
    masterData = r || {};
    populateGlobalIncharge();
    buildCbOptions();
    initAllCbs();
    return Promise.all([
      gasGet('getObList'),
      gasGet('getHvsList'),
      gasGet('getIbList')
    ]);
  }).then(function (results) {
    obData  = (results[0].list || []);
    hvsData = (results[1].list || []);
    ibData  = (results[2].list || []);
    renderObTable();
    renderHvsTable();
    renderIbTable();
    updateObStats();
    updateHvsStats();
    updateIbStats();
    buildAllScanAwbs();
    hideLoading();
  }).catch(function (e) {
    hideLoading();
    toast('Gagal memuat data: ' + e.message, 'error');
  });
});

function reloadAll() {
  showLoading('Memuat ulang...');
  _mfLoaded = false;
  _obibData = null;
  Promise.all([
    gasGet('getObList'),
    gasGet('getHvsList'),
    gasGet('getIbList')
  ]).then(function (results) {
    obData  = results[0].list || [];
    hvsData = results[1].list || [];
    ibData  = results[2].list || [];
    renderObTable();
    renderHvsTable();
    renderIbTable();
    updateObStats();
    updateHvsStats();
    updateIbStats();
    buildAllScanAwbs();
    hideLoading();
    toast('Data diperbarui', 'success');
  }).catch(function (e) {
    hideLoading();
    toast('Gagal reload: ' + e.message, 'error');
  });
}

// ─── ALL SCAN AWBs (untuk search) ───
function buildAllScanAwbs() {
  allScanAwbs = [];
  function pushArr(arr, type) {
    arr.forEach(function (item) {
      if (item._awbs) {
        item._awbs.forEach(function (awb) {
          allScanAwbs.push({ awb: awb, noTrack: item.no_track, type: type, tujuan: item.tujuan, incharge: item.incharge, service: item.service, status: item.status, from: item.from || '' });
        });
      }
    });
  }
  pushArr(obData,  'ob');
  pushArr(hvsData, 'hvs');
  pushArr(ibData,  'ib');
}

// ═══════════════════════════════════════════════════
// OB & IB COMBINED VIEW
// ═══════════════════════════════════════════════════

function renderObibPage() {
  var wrap = document.getElementById('obibTableWrap');
  wrap.innerHTML = '<div class="empty-state"><span class="material-icons-round">hourglass_empty</span>Memuat...</div>';

  if (_obibData) {
    _buildObibTable(_obibData);
    return;
  }

  showLoading('Memuat OB & IB...');
  Promise.all([
    gasGet('getObibFull'),
    gasGet('getHvsFull'),
    gasGet('getIbFull')
  ]).then(function (res) {
    hideLoading();
    _obibData = { ob: res[0].list || [], hvs: res[1].list || [], ib: res[2].list || [] };
    _buildObibTable(_obibData);
  }).catch(function (e) {
    hideLoading();
    wrap.innerHTML = '<div class="empty-state"><span class="material-icons-round">error</span>Gagal memuat: ' + escH(e.message) + '</div>';
  });
}

function reloadObib() {
  _obibData = null;
  renderObibPage();
}

function filterObib() {
  var q = document.getElementById('obibSearch').value.toLowerCase();
  if (!_obibData) return;
  var filtered = {
    ob:  _obibData.ob.filter(function(d){ return _obibMatch(d,q); }),
    hvs: _obibData.hvs.filter(function(d){ return _obibMatch(d,q); }),
    ib:  _obibData.ib.filter(function(d){ return _obibMatch(d,q); })
  };
  _buildObibTable(filtered);
}

function _obibMatch(d, q) {
  if (!q) return true;
  var haystack = (d.no_track + d.incharge + d.service + (d.tujuan||'') + (d.kota||'') + (d.from||'') + (d.status||'')).toLowerCase();
  if (haystack.indexOf(q) !== -1) return true;
  if (d.awbs && d.awbs.some(function(a){ return (a||'').toLowerCase().indexOf(q) !== -1; })) return true;
  return false;
}

function _buildObibTable(data) {
  var wrap = document.getElementById('obibTableWrap');

  var inchargeMap = {};

  function groupBy(arr, type) {
    arr.forEach(function (item) {
      var inc = item.incharge || '—';
      if (!inchargeMap[inc]) inchargeMap[inc] = { kota: item.kota || inc, ob: [], hvs: [], ib: [] };
      inchargeMap[inc][type].push(item);
    });
  }
  groupBy(data.ob,  'ob');
  groupBy(data.hvs, 'hvs');
  groupBy(data.ib,  'ib');

  var incharges = Object.keys(inchargeMap).sort();

  if (!incharges.length) {
    wrap.innerHTML = '<div class="empty-state"><span class="material-icons-round">inbox</span>Tidak ada data</div>';
    return;
  }

  var html = '<table class="obib-table"><thead>';

  // Baris 1: Incharge
  html += '<tr><th class="obib-rn" rowspan="4">#</th>';
  incharges.forEach(function (inc) {
    var g = inchargeMap[inc];
    var totalCols = _obibColCount(g);
    html += '<th class="obib-hdr-incharge" colspan="' + totalCols + '">' + escH(inc) + '</th>';
  });
  html += '</tr>';

  // Baris 2: Kota
  html += '<tr>';
  incharges.forEach(function (inc) {
    var g = inchargeMap[inc];
    var totalCols = _obibColCount(g);
    html += '<th class="obib-hdr-kota" colspan="' + totalCols + '">' + escH(g.kota || inc) + '</th>';
  });
  html += '</tr>';

  // Baris 3: Service
  html += '<tr>';
  incharges.forEach(function (inc) {
    var g = inchargeMap[inc];
    g.ob.forEach(function (item) {
      html += '<th class="obib-hdr-service" colspan="2">' + escH(item.service) + '</th>';
    });
    g.hvs.forEach(function (item) {
      html += '<th class="obib-hdr-service" colspan="2">' + escH(item.service) + '</th>';
    });
    if (g.ib.length) {
      html += '<th class="obib-hdr-service" colspan="' + (g.ib.length * 2) + '">' + escH(g.ib[0].service) + '</th>';
    }
  });
  html += '</tr>';

  // Baris 4: Tipe kolom
  html += '<tr>';
  incharges.forEach(function (inc) {
    var g = inchargeMap[inc];
    g.ob.forEach(function (item) {
      html += '<th class="obib-hdr-type outbound">' + escH(item.tujuan) + '</th>';
      html += '<th class="obib-hdr-type date">DATE</th>';
    });
    g.hvs.forEach(function (item) {
      html += '<th class="obib-hdr-type outbound-hvs">' + escH(item.tujuan) + '</th>';
      html += '<th class="obib-hdr-type date">DATE</th>';
    });
    g.ib.forEach(function (item) {
      html += '<th class="obib-hdr-type inbound-hvs">' + escH(item.tujuan) + '</th>';
      html += '<th class="obib-hdr-type date">DATE</th>';
    });
  });
  html += '</tr>';
  html += '</thead><tbody>';

  var maxRows = 0;
  incharges.forEach(function (inc) {
    var g = inchargeMap[inc];
    var m = _obibMaxRows(g);
    if (m > maxRows) maxRows = m;
  });

  for (var row = 0; row < maxRows; row++) {
    html += '<tr>';
    html += '<td class="obib-rn">' + (row + 1) + '</td>';
    incharges.forEach(function (inc) {
      var g = inchargeMap[inc];
      g.ob.forEach(function (item) {
        var awb = (item.awbs || [])[row] || '';
        var isSelesai = item.status === 'SELESAI';
        html += '<td class="obib-cell-awb' + (isSelesai ? ' selesai' : '') + '">' + escH(awb) + '</td>';
        html += '<td class="obib-cell-date">' + (awb ? escH(item.created_date || '') : '') + '</td>';
      });
      g.hvs.forEach(function (item) {
        var awb = (item.awbs || [])[row] || '';
        var isSelesai = item.status === 'SELESAI';
        html += '<td class="obib-cell-awb obib-hvs' + (isSelesai ? ' selesai' : '') + '">' + escH(awb) + '</td>';
        html += '<td class="obib-cell-date">' + (awb ? escH(item.created_date || '') : '') + '</td>';
      });
      g.ib.forEach(function (item) {
        var awb = (item.awbs || [])[row] || '';
        var isSelesai = item.status === 'SELESAI';
        html += '<td class="obib-cell-awb obib-ib' + (isSelesai ? ' selesai' : '') + '">' + escH(awb) + '</td>';
        html += '<td class="obib-cell-date">' + (awb ? escH(item.created_date || '') : '') + '</td>';
      });
    });
    html += '</tr>';
  }

  html += '</tbody></table>';
  wrap.innerHTML = html;
}

function _obibColCount(g) {
  return (g.ob.length * 2) + (g.hvs.length * 2) + (g.ib.length * 2);
}

function _obibMaxRows(g) {
  var m = 0;
  g.ob.forEach(function(i){ if((i.awbs||[]).length > m) m = i.awbs.length; });
  g.hvs.forEach(function(i){ if((i.awbs||[]).length > m) m = i.awbs.length; });
  g.ib.forEach(function(i){ if((i.awbs||[]).length > m) m = i.awbs.length; });
  return m;
}

function exportObibCSV() {
  if (!_obibData) { toast('Muat data dulu', 'error'); return; }
  var rows = [['INCHARGE','KOTA','TYPE','SERVICE','TUJUAN','AWB','DATE','STATUS']];
  function addRows(arr, type) {
    arr.forEach(function(item){
      (item.awbs || []).forEach(function(awb){
        rows.push([item.incharge, item.kota||item.incharge, type, item.service, item.tujuan||item.from||'', awb, item.created_date, item.status]);
      });
    });
  }
  addRows(_obibData.ob,  'OUTBOUND');
  addRows(_obibData.hvs, 'OUTBOUND HVS');
  addRows(_obibData.ib,  'INBOUND HVS');
  _downloadCSV(rows, 'obib_' + _dateStr() + '.csv');
}

// ═══════════════════════════════════════════════════
// MANIFEST PAGE — Persis dari 5-in-one
// Menggunakan getManifestData (backend harus return:
//   { headerRows: [[...],[...],[...]], colDefs: [...], awbRows: [[...]], totalCols: N }
// Header 3 baris: Incharge → Service → Tujuan/DATE
// ═══════════════════════════════════════════════════

function loadManifestPage() {
  if (_mfLoaded) { renderManifestSheet(); return; }
  showLoading('Memuat manifest...');
  gasGet('getManifestData').then(function (res) {
    hideLoading();
    if (res.error) { toast('Error manifest: ' + res.error, 'error'); return; }
    _mfData   = res;
    _mfLoaded = true;
    _mfSelRow = -1;
    _mfSelCol = -1;
    renderManifestSheet();
    setupMfKeyboard();
  }).catch(function (e) {
    hideLoading();
    toast('Error: ' + e.message, 'error');
  });
}

function reloadManifest() {
  _mfLoaded = false;
  _mfData   = null;
  _mfSelRow = -1;
  _mfSelCol = -1;
  showLoading('Refresh manifest...');
  gasGet('getManifestData').then(function (res) {
    hideLoading();
    if (res.error) { toast('Error: ' + res.error, 'error'); return; }
    _mfData   = res;
    _mfLoaded = true;
    renderManifestSheet();
    setupMfKeyboard();
    toast('Manifest diperbarui', 'success');
  }).catch(function (e) {
    hideLoading();
    toast('Error: ' + e.message, 'error');
  });
}

function filterManifest() {
  _mfFilter = document.getElementById('manifestSearch').value || '';
  if (_mfLoaded) renderManifestSheet();
}

function renderManifestSheet() {
  if (!_mfData) {
    document.getElementById('mfSheetOuter').innerHTML =
      '<div style="padding:40px;text-align:center;color:var(--gray5)">' +
        '<span class="material-icons-round" style="font-size:40px;color:var(--gray4);display:block;margin-bottom:8px">grid_on</span>' +
        'Klik Manifest di sidebar' +
      '</div>';
    return;
  }

  var hRows    = _mfData.headerRows || [];
  var colDefs  = _mfData.colDefs   || [];
  var awbRows  = _mfData.awbRows   || [];
  var totalCols = _mfData.totalCols || 0;

  var fq = (_mfFilter || '').toLowerCase().trim();

  // Filter rows berdasar query
  var filteredAwbRows = awbRows;
  if (fq) {
    var tujuanMatch = false;
    if (hRows[2]) hRows[2].forEach(function (v) {
      if ((v || '').toLowerCase().indexOf(fq) !== -1) tujuanMatch = true;
    });
    if (!tujuanMatch) {
      filteredAwbRows = awbRows.filter(function (row) {
        return row.some(function (cell) { return (cell || '').toLowerCase().indexOf(fq) !== -1; });
      });
    }
  }
  _mfFilteredRows = filteredAwbRows;

  // Update stats
  var incSet  = {};
  colDefs.forEach(function (c) { if (c.incharge) incSet[c.incharge] = true; });
  var tujCols = colDefs.filter(function (c) { return !c.isDate && c.tujuan; });
  var totalAwb = tujCols.reduce(function (s, c) {
    var cnt = awbRows.filter(function (r) { return r[c.colIdx] && r[c.colIdx].trim(); }).length;
    return s + cnt;
  }, 0);
  document.getElementById('mfTotalCols').innerText = tujCols.length;
  document.getElementById('mfTotalAwb').innerText  = totalAwb;
  document.getElementById('mfTotalInc').innerText  = Object.keys(incSet).length;

  var nCols = totalCols;

  // Helper: buat baris header dengan merged cells
  function buildSpannedRow(hArr, cellClass) {
    var cells = [];
    var i = 0;
    while (i < nCols) {
      var val = hArr[i] || '';
      if (!val) { cells.push({ val: '', span: 1 }); i++; continue; }
      var span = 1;
      while (i + span < nCols && (!hArr[i + span] || hArr[i + span] === '')) span++;
      cells.push({ val: val, span: span });
      i += span;
    }
    return '<tr><th class="mf-rn" style="z-index:5">#</th>' +
      cells.map(function (c) {
        return '<th colspan="' + c.span + '" class="' + cellClass + '">' + escH(c.val) + '</th>';
      }).join('') + '</tr>';
  }

  var row0Html = buildSpannedRow(hRows[0] || [], 'mf-hdr-incharge');
  var row1Html = buildSpannedRow(hRows[1] || [], 'mf-hdr-service');
  var row2Html = '<tr><th class="mf-rn">—</th>' +
    colDefs.map(function (c) {
      if (c.isDate) return '<th class="mf-hdr-date">DATE</th>';
      return '<th class="mf-hdr-tujuan">' + escH(c.tujuan) + '</th>';
    }).join('') + '</tr>';

  var dataHtml = filteredAwbRows.length
    ? filteredAwbRows.map(function (row, ri) {
        return '<tr class="mf-data-row" data-ri="' + ri + '">' +
          '<td class="mf-rn">' + (ri + 1) + '</td>' +
          colDefs.map(function (c, ci) {
            var val    = row[c.colIdx] || '';
            var isSel  = (_mfSelRow === ri && _mfSelCol === ci);
            if (c.isDate) return '<td class="mf-cell-date' + (isSel ? ' mf-cell-selected' : '') +
              '" data-ci="' + ci + '" data-ri="' + ri + '" onclick="mfSelectCell(' + ri + ',' + ci + ')">' + escH(val) + '</td>';
            if (!val) return '<td class="mf-cell-empty' + (isSel ? ' mf-cell-selected' : '') +
              '" data-ci="' + ci + '" data-ri="' + ri + '" onclick="mfSelectCell(' + ri + ',' + ci + ')"></td>';
            return '<td class="mf-cell-awb' + (isSel ? ' mf-cell-selected' : '') +
              '" data-ci="' + ci + '" data-ri="' + ri + '" onclick="mfSelectCell(' + ri + ',' + ci + ')" title="' + escH(val) + '">' + escH(val) + '</td>';
          }).join('') +
        '</tr>';
      }).join('')
    : '<tr><td class="mf-rn" style="color:var(--gray5)">—</td>' +
      '<td colspan="' + (nCols || 1) + '" style="text-align:center;padding:20px;color:var(--gray5);font-size:12px">Tidak ada data AWB</td></tr>';

  var tableHtml = '<table class="mf-table"><thead>' + row0Html + row1Html + row2Html + '</thead><tbody>' + dataHtml + '</tbody></table>';
  document.getElementById('mfSheetOuter').innerHTML = tableHtml;
  updateMfActiveCellLabel();
}

function mfSelectCell(ri, ci) {
  _mfSelRow = ri;
  _mfSelCol = ci;
  document.querySelectorAll('.mf-cell-selected').forEach(function (el) { el.classList.remove('mf-cell-selected'); });
  var target = document.querySelector('[data-ri="' + ri + '"][data-ci="' + ci + '"]');
  if (target) {
    target.classList.add('mf-cell-selected');
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  updateMfActiveCellLabel();
  document.getElementById('mfSheetOuter').focus();
}

function updateMfActiveCellLabel() {
  var el = document.getElementById('mfActiveCell');
  if (!el) return;
  if (_mfSelRow < 0 || _mfSelCol < 0 || !_mfData) { el.innerText = '—'; return; }
  var row     = _mfFilteredRows[_mfSelRow];
  var colDefs = _mfData.colDefs || [];
  var c       = colDefs[_mfSelCol];
  if (!row || !c) { el.innerText = '—'; return; }
  el.innerText = (row[c.colIdx] || '(kosong)');
}

function setupMfKeyboard() {
  var outer = document.getElementById('mfSheetOuter');
  if (!outer || outer._kbSetup) return;
  outer._kbSetup = true;
  outer.addEventListener('keydown', function (e) {
    if (!_mfData) return;
    var colDefs = _mfData.colDefs || [];
    var nRows   = _mfFilteredRows.length;
    var nCols   = colDefs.length;
    if (!nRows || !nCols) return;
    if (_mfSelRow < 0) { _mfSelRow = 0; _mfSelCol = 0; }
    var moved = false;
    if      (e.key === 'ArrowDown')  { e.preventDefault(); _mfSelRow = Math.min(_mfSelRow + 1, nRows - 1); moved = true; }
    else if (e.key === 'ArrowUp')    { e.preventDefault(); _mfSelRow = Math.max(_mfSelRow - 1, 0);         moved = true; }
    else if (e.key === 'ArrowRight') { e.preventDefault(); _mfSelCol = Math.min(_mfSelCol + 1, nCols - 1); moved = true; }
    else if (e.key === 'ArrowLeft')  { e.preventDefault(); _mfSelCol = Math.max(_mfSelCol - 1, 0);         moved = true; }
    else if (e.key === 'Tab') {
      e.preventDefault();
      _mfSelCol = (_mfSelCol + 1) % nCols;
      if (_mfSelCol === 0) _mfSelRow = Math.min(_mfSelRow + 1, nRows - 1);
      moved = true;
    }
    else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); copyMfCell(); return; }
    if (moved) {
      document.querySelectorAll('.mf-cell-selected').forEach(function (el) { el.classList.remove('mf-cell-selected'); });
      var target = document.querySelector('[data-ri="' + _mfSelRow + '"][data-ci="' + _mfSelCol + '"]');
      if (target) { target.classList.add('mf-cell-selected'); target.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
      updateMfActiveCellLabel();
    }
  });
}

function copyMfCell() {
  if (_mfSelRow < 0 || _mfSelCol < 0 || !_mfData) return;
  var row     = _mfFilteredRows[_mfSelRow];
  var colDefs = _mfData.colDefs || [];
  var c       = colDefs[_mfSelCol];
  if (!row || !c) return;
  var val = row[c.colIdx] || '';
  if (!val) { toast('Sel kosong', 'error'); return; }
  navigator.clipboard.writeText(val).then(function () {
    showCopyFlash(val);
  }).catch(function () {
    var ta = document.createElement('textarea');
    ta.value = val; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); showCopyFlash(val); }
    catch (ex) { toast('Gagal copy', 'error'); }
    document.body.removeChild(ta);
  });
}

function showCopyFlash(val) {
  var el = document.getElementById('copyFlash');
  el.innerText = '✓ Copied: ' + val;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(function () { el.classList.remove('show'); }, 1200);
}

function exportManifestCSV() {
  if (!_mfData) { toast('Manifest belum dimuat', 'error'); return; }
  var colDefs  = _mfData.colDefs   || [];
  var awbRows  = _mfData.awbRows   || [];
  var hRows    = _mfData.headerRows || [];
  if (!colDefs.length) { toast('Tidak ada data manifest', 'error'); return; }
  var h0 = hRows[0] || [];
  var h1 = hRows[1] || [];
  var h2 = hRows[2] || [];
  var csvRows = [];
  csvRows.push(['#'].concat(h0).map(function (v) { return '"' + v + '"'; }).join(','));
  csvRows.push([''].concat(h1).map(function (v) { return '"' + v + '"'; }).join(','));
  csvRows.push([''].concat(h2).map(function (v) { return '"' + v + '"'; }).join(','));
  awbRows.forEach(function (row, i) {
    csvRows.push(['"' + (i + 1) + '"'].concat(row.map(function (c) { return '"' + (c || '') + '"'; })).join(','));
  });
  _downloadCSV(csvRows.join('\n'), 'manifest_export_' + _dateStr() + '.csv');
}

// ═══════════════════════════════════════════════════
// SEARCH AWB
// ═══════════════════════════════════════════════════

function doSearchAwb(q) {
  q = (q || '').trim();
  var hdr  = document.getElementById('searchAwbResult').querySelector('.search-awb-result-hdr');
  var body = document.getElementById('searchAwbResultBody');

  if (!q) {
    hdr.innerHTML  = '<span class="material-icons-round">info</span> Masukkan nomor AWB untuk mencari';
    body.innerHTML = '<div class="search-awb-empty"><span class="material-icons-round">search</span>Ketik nomor AWB di atas untuk mencari di semua data</div>';
    return;
  }

  var ql      = q.toLowerCase();
  var results = [];

  function searchArr(arr, type) {
    arr.forEach(function (item) {
      if (item._awbs) {
        item._awbs.forEach(function (awb) {
          if ((awb || '').toLowerCase().indexOf(ql) !== -1) {
            results.push({ awb: awb, noTrack: item.no_track, type: type, tujuan: item.tujuan, incharge: item.incharge, service: item.service, status: item.status, from: item.from || '', date: item.created_date });
          }
        });
      } else {
        if ((item.no_track || '').toLowerCase().indexOf(ql) !== -1) {
          results.push({ awb: q, noTrack: item.no_track, type: type, tujuan: item.tujuan, incharge: item.incharge, service: item.service, status: item.status, from: item.from || '', date: item.created_date });
        }
      }
    });
  }

  searchArr(obData,  'ob');
  searchArr(hvsData, 'hvs');
  searchArr(ibData,  'ib');

  allScanAwbs.forEach(function (r) {
    if ((r.awb || '').toLowerCase().indexOf(ql) !== -1) {
      var dup = results.some(function (x) { return x.awb === r.awb && x.noTrack === r.noTrack; });
      if (!dup) results.push(r);
    }
  });

  hdr.innerHTML = '<span class="material-icons-round">search</span> ' + results.length + ' hasil untuk <strong>"' + escH(q) + '"</strong>';

  if (!results.length) {
    body.innerHTML = '<div class="search-awb-empty"><span class="material-icons-round">manage_search</span>Mencari di server...</div>';
    gasGet('searchAwb', { q: q }).then(function (res) {
      var list = res.list || [];
      if (!list.length) {
        hdr.innerHTML  = '<span class="material-icons-round">search</span> 0 hasil untuk <strong>"' + escH(q) + '"</strong>';
        body.innerHTML = '<div class="search-awb-empty"><span class="material-icons-round">search_off</span>AWB tidak ditemukan</div>';
        return;
      }
      hdr.innerHTML = '<span class="material-icons-round">search</span> ' + list.length + ' hasil untuk <strong>"' + escH(q) + '"</strong>';
      body.innerHTML = list.map(function (r) { return _searchAwbItem(r, q); }).join('');
    }).catch(function () {
      body.innerHTML = '<div class="search-awb-empty"><span class="material-icons-round">search_off</span>AWB tidak ditemukan</div>';
    });
    return;
  }

  body.innerHTML = results.map(function (r) { return _searchAwbItem(r, q); }).join('');
}

function _searchAwbItem(r, q) {
  var typeLabel   = r.type === 'ob' ? 'Outbound BDO' : r.type === 'hvs' ? 'Outbound HVS' : 'Inbound HVS';
  var icon        = r.type === 'ob' ? 'local_shipping' : r.type === 'hvs' ? 'inventory_2' : 'move_to_inbox';
  var highlighted = escH(r.awb).replace(new RegExp('(' + escRegex(escH(q)) + ')', 'gi'), '<mark>$1</mark>');
  var statusTag   = r.status === 'SELESAI'
    ? '<span style="background:var(--green-light);color:var(--green);padding:1px 7px;border-radius:10px;font-size:10px;font-weight:700">✓ Selesai</span>'
    : '<span style="background:var(--orange-light);color:var(--orange);padding:1px 7px;border-radius:10px;font-size:10px;font-weight:700">● On Proses</span>';
  return '<div class="search-awb-item">' +
    '<div class="search-awb-item-icon ' + r.type + '"><span class="material-icons-round">' + icon + '</span></div>' +
    '<div class="search-awb-item-main">' +
      '<div class="search-awb-item-awb">' + highlighted + '</div>' +
      '<div class="search-awb-item-meta">' +
        '<span class="search-awb-type-tag ' + r.type + '">' + typeLabel + '</span>' +
        statusTag +
        (r.noTrack   ? '<span class="search-awb-item-notrack" onclick="openDetailModal(\'' + r.type + '\',\'' + escQ(r.noTrack) + '\')">' + escH(r.noTrack) + '</span>' : '') +
        (r.incharge  ? '<span>' + escH(r.incharge) + '</span>' : '') +
        (r.service   ? '<span>' + escH(r.service)  + '</span>' : '') +
        (r.from      ? '<span>From: ' + escH(r.from) + '</span>' : '') +
        (r.tujuan    ? '<span>→ ' + escH(r.tujuan) + '</span>' : '') +
        (r.date      ? '<span style="color:var(--gray4)">' + escH(r.date) + '</span>' : '') +
      '</div>' +
    '</div>' +
  '</div>';
}

function clearSearchAwb() {
  document.getElementById('searchAwbMainInput').value = '';
  doSearchAwb('');
}

// ═══════════════════════════════════════════════════
// SIDEBAR SEARCH
// ═══════════════════════════════════════════════════

function handleSidebarSearch(e) {
  if (e.key !== 'Enter') return;
  var q = document.getElementById('sidebarSearchInput').value.trim();
  if (!q) return;
  switchPage('search');
  document.getElementById('searchAwbMainInput').value = q;
  doSearchAwb(q);
  document.getElementById('sidebarSearchInput').value = '';
}

// ═══════════════════════════════════════════════════
// EXPORT CSV
// ═══════════════════════════════════════════════════

function exportCSV() {
  var active = '';
  ['ob', 'hvs', 'ib', 'manifest', 'obib'].forEach(function (p) {
    if (document.getElementById('page-' + p).style.display !== 'none') active = p;
  });
  if      (active === 'ob')       exportObCSV();
  else if (active === 'hvs')      exportHvsCSV();
  else if (active === 'ib')       exportIbCSV();
  else if (active === 'manifest') exportManifestCSV();
  else if (active === 'obib')     exportObibCSV();
  else toast('Tidak ada data untuk diexport', 'error');
}

function exportObCSV() {
  var d    = filteredData(obData);
  var rows = [['NO TRACK', 'INCHARGE', 'SERVICE', 'TUJUAN', 'DATE', 'TOTAL AWB', 'STATUS']];
  d.forEach(function (r) { rows.push([r.no_track, r.incharge, r.service, r.tujuan, r.created_date, r.total_awb, r.status]); });
  _downloadCSV(rows, 'outbound_bdo_' + _dateStr() + '.csv');
}

function exportHvsCSV() {
  var d    = filteredData(hvsData);
  var rows = [['NO TRACK', 'INCHARGE', 'SERVICE', 'TUJUAN', 'DATE', 'TOTAL AWB', 'STATUS']];
  d.forEach(function (r) { rows.push([r.no_track, r.incharge, r.service, r.tujuan, r.created_date, r.total_awb, r.status]); });
  _downloadCSV(rows, 'outbound_hvs_' + _dateStr() + '.csv');
}

function exportIbCSV() {
  var d    = filteredData(ibData);
  var rows = [['NO TRACK', 'INCHARGE', 'SERVICE', 'FROM', 'TUJUAN', 'DATE', 'TOTAL AWB', 'STATUS']];
  d.forEach(function (r) { rows.push([r.no_track, r.incharge, r.service, r.from || '', r.tujuan, r.created_date, r.total_awb, r.status]); });
  _downloadCSV(rows, 'inbound_hvs_' + _dateStr() + '.csv');
}

// ─── CSV HELPER ───
function _downloadCSV(rows, filename) {
  var csv;
  // rows bisa array of arrays atau string langsung
  if (typeof rows === 'string') {
    csv = rows;
  } else {
    csv = rows.map(function (r) {
      return r.map(function (c) {
        var s = (c === null || c === undefined) ? '' : String(c);
        if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
          s = '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      }).join(',');
    }).join('\r\n');
  }
  var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href  = url; a.download = filename; a.style.display = 'none';
  document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(url); document.body.removeChild(a); }, 1000);
  toast('CSV diunduh: ' + filename, 'success');
}

function _dateStr() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
