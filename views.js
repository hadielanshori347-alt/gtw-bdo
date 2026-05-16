/* ============================================================
   GTW BDO — views.js v4.2
   OB&IB combined view, Manifest, Search AWB, Sidebar search,
   Export CSV, Reload, buildAllScanAwbs
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
// Header 4 baris: Incharge → Kota → Service → Tipe
// Kolom per tujuan: OUTBOUND | DATE | OUTBOUND HVS | DATE | INBOUND HVS | DATE
// DATE = mirror tanggal dari data terkait
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
    gasGet('getObibFull'),       // {list: [{no_track, incharge, service, tujuan, kota, created_date, awbs:[]}]}
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

  // Kelompokkan semua data berdasarkan incharge
  var inchargeMap = {};  // { incharge: { kota, ob:[], hvs:[], ib:[] } }

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

  // Kumpulkan semua tujuan unik per incharge untuk kolom
  // Struktur kolom per incharge:
  //   untuk setiap tujuan OB → kolom OB + DATE
  //   untuk setiap tujuan HVS → kolom HVS + DATE
  //   kolom IB (gabungan semua IB incharge tsb)

  // Hitung max rows per incharge = max(max awb ob per tujuan, max awb hvs per tujuan, max ib awb)
  // Kita render row per AWB index

  var html = '<table class="obib-table"><thead>';

  // ── BARIS 1: INCHARGE (colspan = total kolom per incharge + 1 rn) ──
  html += '<tr><th class="obib-rn" rowspan="4">#</th>';
  incharges.forEach(function (inc) {
    var g = inchargeMap[inc];
    // hitung total kolom untuk incharge ini
    var totalCols = _obibColCount(g);
    html += '<th class="obib-hdr-incharge" colspan="' + totalCols + '">' + escH(inc) + '</th>';
  });
  html += '</tr>';

  // ── BARIS 2: KOTA ──
  html += '<tr>';
  incharges.forEach(function (inc) {
    var g = inchargeMap[inc];
    var totalCols = _obibColCount(g);
    html += '<th class="obib-hdr-kota" colspan="' + totalCols + '">' + escH(g.kota || inc) + '</th>';
  });
  html += '</tr>';

  // ── BARIS 3: SERVICE (per kelompok tujuan / IB) ──
  html += '<tr>';
  incharges.forEach(function (inc) {
    var g = inchargeMap[inc];
    // OB tujuan groups
    g.ob.forEach(function (item) {
      html += '<th class="obib-hdr-service" colspan="2">' + escH(item.service) + '</th>';
    });
    // HVS tujuan groups
    g.hvs.forEach(function (item) {
      html += '<th class="obib-hdr-service" colspan="2">' + escH(item.service) + '</th>';
    });
    // IB — gabungan, gunakan service dari IB pertama
    if (g.ib.length) {
      html += '<th class="obib-hdr-service" colspan="' + (g.ib.length * 2) + '">' + escH(g.ib[0].service) + '</th>';
    }
  });
  html += '</tr>';

  // ── BARIS 4: TIPE KOLOM (Outbound / Date / Outbound HVS / Date / Inbound HVS / Date) ──
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

  // ── ROWS ──
  // Hitung max rows across all incharges
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
      // OB cols
      g.ob.forEach(function (item) {
        var awb = (item.awbs || [])[row] || '';
        var isSelesai = item.status === 'SELESAI';
        html += '<td class="obib-cell-awb' + (isSelesai ? ' selesai' : '') + '">' + escH(awb) + '</td>';
        html += '<td class="obib-cell-date">' + (awb ? escH(item.created_date || '') : '') + '</td>';
      });
      // HVS cols
      g.hvs.forEach(function (item) {
        var awb = (item.awbs || [])[row] || '';
        var isSelesai = item.status === 'SELESAI';
        html += '<td class="obib-cell-awb obib-hvs' + (isSelesai ? ' selesai' : '') + '">' + escH(awb) + '</td>';
        html += '<td class="obib-cell-date">' + (awb ? escH(item.created_date || '') : '') + '</td>';
      });
      // IB cols
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
  // 2 kolom per item OB, 2 per HVS, 2 per IB
  return (g.ob.length * 2) + (g.hvs.length * 2) + (g.ib.length * 2);
}

function _obibMaxRows(g) {
  var m = 0;
  g.ob.forEach(function(i){ if((i.awbs||[]).length > m) m = i.awbs.length; });
  g.hvs.forEach(function(i){ if((i.awbs||[]).length > m) m = i.awbs.length; });
  g.ib.forEach(function(i){ if((i.awbs||[]).length > m) m = i.awbs.length; });
  return m;
}

// Export OB&IB CSV
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
// MANIFEST PAGE
// ═══════════════════════════════════════════════════

function loadManifestPage() {
  if (_mfLoaded) return;
  _mfLoaded = false;
  reloadManifest();
}

function reloadManifest() {
  showLoading('Memuat Manifest...');
  var outer = document.getElementById('mfSheetOuter');
  outer.innerHTML = '<div style="padding:40px;text-align:center;color:var(--gray5)"><span class="material-icons-round" style="font-size:40px;color:var(--gray4);display:block;margin-bottom:8px">hourglass_empty</span>Memuat...</div>';

  gasGet('getManifest').then(function (res) {
    hideLoading();
    _mfData = res || {};
    _mfLoaded = true;
    _mfFilter = '';
    _mfSelRow = -1; _mfSelCol = -1;
    _mfFilteredRows = [];
    document.getElementById('manifestSearch').value = '';
    renderManifest();
  }).catch(function (e) {
    hideLoading();
    document.getElementById('mfSheetOuter').innerHTML = '<div style="padding:40px;text-align:center;color:var(--red)">Gagal memuat manifest: ' + escH(e.message) + '</div>';
  });
}

function filterManifest() {
  _mfFilter = document.getElementById('manifestSearch').value;
  _mfSelRow = -1; _mfSelCol = -1;
  renderManifest();
}

function renderManifest() {
  var outer = document.getElementById('mfSheetOuter');
  if (!_mfData || !_mfData.columns) {
    outer.innerHTML = '<div style="padding:40px;text-align:center;color:var(--gray5)">Tidak ada data manifest</div>';
    _updateMfStats(0, 0, 0);
    return;
  }

  var cols = _mfData.columns; // [{incharge, service, tujuan, dates:[], rows:[[awb,...],[awb,...]]}]
  var q = (_mfFilter || '').toLowerCase();

  // Filter rows per col
  var filteredCols = cols.map(function (col) {
    if (!q) return col;
    var frows = col.rows.filter(function (row) {
      return row.some(function (cell) { return (cell || '').toLowerCase().indexOf(q) !== -1; });
    });
    return Object.assign({}, col, { rows: frows });
  }).filter(function (col) {
    if (!q) return true;
    if (col.rows.length) return true;
    return (col.incharge + col.service + col.tujuan).toLowerCase().indexOf(q) !== -1;
  });

  var maxRows = filteredCols.reduce(function (m, col) { return Math.max(m, col.rows.length); }, 0);
  _mfFilteredRows = [];
  for (var i = 0; i < maxRows; i++) _mfFilteredRows.push(i);

  var totalAwb = 0;
  filteredCols.forEach(function (col) { col.rows.forEach(function (row) { row.forEach(function (c) { if (c) totalAwb++; }); }); });
  var incharges = [];
  filteredCols.forEach(function (col) { if (incharges.indexOf(col.incharge) === -1) incharges.push(col.incharge); });
  _updateMfStats(filteredCols.length, totalAwb, incharges.length);

  if (!filteredCols.length) {
    outer.innerHTML = '<div style="padding:40px;text-align:center;color:var(--gray5)">Tidak ada data</div>';
    return;
  }

  // Bangun colspan untuk header incharge
  var incGroups = [];
  filteredCols.forEach(function (col) {
    if (!incGroups.length || incGroups[incGroups.length - 1].name !== col.incharge) {
      incGroups.push({ name: col.incharge, count: 0 });
    }
    incGroups[incGroups.length - 1].count += col.dates.length + 1; // +1 for AWB col
  });

  var html = '<table class="mf-table"><thead>';

  // Row 1: Incharge
  html += '<tr><th class="mf-rn" rowspan="4">#</th>';
  incGroups.forEach(function (g) {
    html += '<th class="mf-hdr-incharge" colspan="' + g.count + '">' + escH(g.name) + '</th>';
  });
  html += '</tr>';

  // Row 2: Service
  html += '<tr>';
  filteredCols.forEach(function (col) {
    html += '<th class="mf-hdr-service" colspan="' + (col.dates.length + 1) + '">' + escH(col.service) + '</th>';
  });
  html += '</tr>';

  // Row 3: Tujuan
  html += '<tr>';
  filteredCols.forEach(function (col) {
    html += '<th class="mf-hdr-tujuan" colspan="' + (col.dates.length + 1) + '">' + escH(col.tujuan) + '</th>';
  });
  html += '</tr>';

  // Row 4: AWB + dates
  html += '<tr>';
  filteredCols.forEach(function (col, ci) {
    html += '<th class="mf-cell-awb" style="background:var(--gray1);font-size:10px;font-weight:700;color:var(--gray5);padding:5px 8px;white-space:nowrap">AWB</th>';
    col.dates.forEach(function (d, di) {
      html += '<th class="mf-hdr-date" data-ci="' + ci + '" data-di="' + di + '">' + escH(d) + '</th>';
    });
  });
  html += '</tr></thead><tbody>';

  for (var row = 0; row < maxRows; row++) {
    html += '<tr class="mf-data-row">';
    html += '<td class="mf-rn">' + (row + 1) + '</td>';
    filteredCols.forEach(function (col, ci) {
      var rowData = col.rows[row] || [];
      var awb = rowData[0] || '';
      var selClass = (_mfSelRow === row && _mfSelCol === ci * (col.dates.length + 1)) ? ' mf-cell-selected' : '';
      var colIdx = ci * 100; // approximation for cell id
      html += '<td class="mf-cell-awb' + selClass + '" onclick="mfSelect(' + row + ',' + (ci * 100) + ',\'' + escQ(awb) + '\')">' + escH(awb) + '</td>';
      col.dates.forEach(function (d, di) {
        var val = rowData[di + 1] || (awb ? d : '');
        var selClass2 = (_mfSelRow === row && _mfSelCol === ci * 100 + di + 1) ? ' mf-cell-selected' : '';
        html += '<td class="mf-cell-date' + selClass2 + '" onclick="mfSelect(' + row + ',' + (ci * 100 + di + 1) + ',\'' + escQ(val) + '\')">' + escH(val) + '</td>';
      });
    });
    html += '</tr>';
  }

  html += '</tbody></table>';
  outer.innerHTML = html;

  // Keyboard Ctrl+C support
  outer.onkeydown = function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      var sel = outer.querySelector('.mf-cell-selected');
      if (sel) _copyText(sel.innerText);
    }
  };
}

function mfSelect(row, col, val) {
  _mfSelRow = row; _mfSelCol = col;
  document.getElementById('mfActiveCell').innerText = val || '—';
  document.querySelectorAll('.mf-cell-selected').forEach(function (el) { el.classList.remove('mf-cell-selected'); });
  // re-render is expensive; just update class in DOM
  event.target.classList.add('mf-cell-selected');
  document.getElementById('mfSheetOuter').focus();
}

function _updateMfStats(cols, awb, inc) {
  document.getElementById('mfTotalCols').innerText = cols;
  document.getElementById('mfTotalAwb').innerText = awb;
  document.getElementById('mfTotalInc').innerText = inc;
}

function exportManifestCSV() {
  if (!_mfData || !_mfData.columns) { toast('Muat manifest dulu', 'error'); return; }
  var rows = [['INCHARGE', 'SERVICE', 'TUJUAN', 'AWB', 'DATE']];
  _mfData.columns.forEach(function (col) {
    col.rows.forEach(function (row) {
      rows.push([col.incharge, col.service, col.tujuan, row[0] || '', (col.dates || []).join(' | ')]);
    });
  });
  _downloadCSV(rows, 'manifest_' + _dateStr() + '.csv');
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

  var ql = q.toLowerCase();

  // Cari di allScanAwbs (data sudah ada di memory dari _awbs jika tersedia)
  // Kalau tidak ada _awbs, cari dari header data (no_track match)
  var results = [];

  function searchArr(arr, type) {
    arr.forEach(function (item) {
      // Cek apakah AWB ada di _awbs
      if (item._awbs) {
        item._awbs.forEach(function (awb) {
          if ((awb || '').toLowerCase().indexOf(ql) !== -1) {
            results.push({ awb: awb, noTrack: item.no_track, type: type, tujuan: item.tujuan, incharge: item.incharge, service: item.service, status: item.status, from: item.from || '', date: item.created_date });
          }
        });
      } else {
        // fallback: cari di no_track / header
        if ((item.no_track || '').toLowerCase().indexOf(ql) !== -1) {
          results.push({ awb: q, noTrack: item.no_track, type: type, tujuan: item.tujuan, incharge: item.incharge, service: item.service, status: item.status, from: item.from || '', date: item.created_date });
        }
      }
    });
  }

  searchArr(obData,  'ob');
  searchArr(hvsData, 'hvs');
  searchArr(ibData,  'ib');

  // Juga cari dari allScanAwbs
  allScanAwbs.forEach(function (r) {
    if ((r.awb || '').toLowerCase().indexOf(ql) !== -1) {
      // De-duplicate
      var dup = results.some(function (x) { return x.awb === r.awb && x.noTrack === r.noTrack; });
      if (!dup) results.push(r);
    }
  });

  hdr.innerHTML = '<span class="material-icons-round">search</span> ' + results.length + ' hasil untuk <strong>"' + escH(q) + '"</strong>';

  if (!results.length) {
    // Fetch dari server jika tidak ada di lokal
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
  var typeLabel = r.type === 'ob' ? 'Outbound BDO' : r.type === 'hvs' ? 'Outbound HVS' : 'Inbound HVS';
  var icon = r.type === 'ob' ? 'local_shipping' : r.type === 'hvs' ? 'inventory_2' : 'move_to_inbox';
  var highlighted = escH(r.awb).replace(new RegExp('(' + escRegex(escH(q)) + ')', 'gi'), '<mark>$1</mark>');
  var statusTag = r.status === 'SELESAI'
    ? '<span style="background:var(--green-light);color:var(--green);padding:1px 7px;border-radius:10px;font-size:10px;font-weight:700">✓ Selesai</span>'
    : '<span style="background:var(--orange-light);color:var(--orange);padding:1px 7px;border-radius:10px;font-size:10px;font-weight:700">● On Proses</span>';
  return '<div class="search-awb-item">' +
    '<div class="search-awb-item-icon ' + r.type + '"><span class="material-icons-round">' + icon + '</span></div>' +
    '<div class="search-awb-item-main">' +
      '<div class="search-awb-item-awb">' + highlighted + '</div>' +
      '<div class="search-awb-item-meta">' +
        '<span class="search-awb-type-tag ' + r.type + '">' + typeLabel + '</span>' +
        statusTag +
        (r.noTrack ? '<span class="search-awb-item-notrack" onclick="openDetailModal(\'' + r.type + '\',\'' + escQ(r.noTrack) + '\')">' + escH(r.noTrack) + '</span>' : '') +
        (r.incharge ? '<span>' + escH(r.incharge) + '</span>' : '') +
        (r.service  ? '<span>' + escH(r.service)  + '</span>' : '') +
        (r.from     ? '<span>From: ' + escH(r.from) + '</span>' : '') +
        (r.tujuan   ? '<span>→ ' + escH(r.tujuan) + '</span>' : '') +
        (r.date     ? '<span style="color:var(--gray4)">' + escH(r.date) + '</span>' : '') +
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
// EXPORT CSV (main tables)
// ═══════════════════════════════════════════════════

function exportCSV() {
  // Export semua halaman yang aktif
  var active = '';
  ['ob','hvs','ib','manifest','obib'].forEach(function(p){
    if (document.getElementById('page-'+p).style.display !== 'none') active = p;
  });
  if (active === 'ob')       exportObCSV();
  else if (active === 'hvs') exportHvsCSV();
  else if (active === 'ib')  exportIbCSV();
  else if (active === 'manifest') exportManifestCSV();
  else if (active === 'obib')    exportObibCSV();
  else toast('Tidak ada data untuk diexport', 'error');
}

function exportObCSV() {
  var d = filteredData(obData);
  var rows = [['NO TRACK','INCHARGE','SERVICE','TUJUAN','DATE','TOTAL AWB','STATUS']];
  d.forEach(function(r){ rows.push([r.no_track, r.incharge, r.service, r.tujuan, r.created_date, r.total_awb, r.status]); });
  _downloadCSV(rows, 'outbound_bdo_' + _dateStr() + '.csv');
}

function exportHvsCSV() {
  var d = filteredData(hvsData);
  var rows = [['NO TRACK','INCHARGE','SERVICE','TUJUAN','DATE','TOTAL AWB','STATUS']];
  d.forEach(function(r){ rows.push([r.no_track, r.incharge, r.service, r.tujuan, r.created_date, r.total_awb, r.status]); });
  _downloadCSV(rows, 'outbound_hvs_' + _dateStr() + '.csv');
}

function exportIbCSV() {
  var d = filteredData(ibData);
  var rows = [['NO TRACK','INCHARGE','SERVICE','FROM','TUJUAN','DATE','TOTAL AWB','STATUS']];
  d.forEach(function(r){ rows.push([r.no_track, r.incharge, r.service, r.from||'', r.tujuan, r.created_date, r.total_awb, r.status]); });
  _downloadCSV(rows, 'inbound_hvs_' + _dateStr() + '.csv');
}

// ─── CSV HELPER ───
function _downloadCSV(rows, filename) {
  var csv = rows.map(function (r) {
    return r.map(function (c) {
      var s = (c === null || c === undefined) ? '' : String(c);
      if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
        s = '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }).join(',');
  }).join('\r\n');
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
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

// ─── COPY HELPER ───
function _copyText(text) {
  if (!text || !text.trim()) return;
  navigator.clipboard.writeText(text.trim()).then(function () {
    var el = document.getElementById('copyFlash');
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 1200);
  }).catch(function () {
    toast('Gagal copy', 'error');
  });
}

// ─── CSS tambahan untuk OB&IB ───
(function () {
  var style = document.createElement('style');
  style.textContent = [
    '.obib-cell-awb.selesai { color: var(--green2); font-style: italic; }',
    '.obib-cell-awb.obib-hvs { background: var(--purple-light); }',
    '.obib-cell-awb.obib-hvs.selesai { color: var(--purple); font-style: italic; }',
    '.obib-cell-awb.obib-ib { background: var(--green-light); }',
    '.obib-cell-awb.obib-ib.selesai { color: var(--green); font-style: italic; }',
    '.obib-table-wrap { overflow-x: auto; max-height: calc(100vh - 140px); overflow-y: auto; }',
    '.obib-table thead { position: sticky; top: 0; z-index: 10; }',
    '.obib-table .obib-rn { position: sticky; left: 0; z-index: 5; background: var(--gray1); }',
    '.obib-table thead .obib-rn { z-index: 15; }',
  ].join('\n');
  document.head.appendChild(style);
})();
