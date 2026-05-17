/* ============================================================
   GTW BDO — views.js v4.2
   OB&IB combined view, Manifest (load on demand - today only),
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
// MANIFEST PAGE — load on demand, TODAY ONLY
// Menggunakan getManifest dengan dateFilter=today
// Header 3 baris: Incharge → Service → Tujuan/DATE
// ═══════════════════════════════════════════════════

function loadManifestPage() {
  // Jika sudah loaded, tidak perlu load ulang
  if (_mfLoaded) return;

  var outer = document.getElementById('mfSheetOuter');

  // Tampilkan spinner loading
  outer.innerHTML = [
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;padding:40px;text-align:center">',
      '<div class="spinner"></div>',
      '<div style="font-size:13px;color:var(--gray5);font-weight:500">Memuat manifest hari ini...</div>',
    '</div>'
  ].join('');

  showLoading('Memuat Manifest hari ini...');

  // ─── Panggil getManifest dengan dateFilter=today ───
  gasGet('getManifest', { dateFilter: 'today' }).then(function (res) {
    hideLoading();
    _mfData = res || {};
    _mfLoaded = true;
    _mfFilter = '';
    _mfSelRow = -1;
    _mfSelCol = -1;
    _mfFilteredRows = [];
    document.getElementById('manifestSearch').value = '';
    renderManifest();
  }).catch(function (e) {
    hideLoading();
    _showManifestError(e.message, 'loadManifestPage()');
  });
}

function reloadManifest() {
  // Reset state lalu load ulang data hari ini
  _mfLoaded = false;
  _mfData   = null;
  _mfSelRow = -1;
  _mfSelCol = -1;

  var outer = document.getElementById('mfSheetOuter');
  outer.innerHTML = [
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;padding:40px;text-align:center">',
      '<div class="spinner"></div>',
      '<div style="font-size:13px;color:var(--gray5);font-weight:500">Memuat ulang manifest hari ini...</div>',
    '</div>'
  ].join('');

  showLoading('Memuat ulang Manifest hari ini...');

  gasGet('getManifest', { dateFilter: 'today' }).then(function (res) {
    hideLoading();
    _mfData   = res || {};
    _mfLoaded = true;
    _mfFilter = '';
    _mfFilteredRows = [];
    document.getElementById('manifestSearch').value = '';
    renderManifest();
    toast('Manifest hari ini diperbarui', 'success');
  }).catch(function (e) {
    hideLoading();
    _showManifestError(e.message, 'reloadManifest()');
  });
}

function _showManifestError(msg, retryFn) {
  var outer = document.getElementById('mfSheetOuter');
  outer.innerHTML = [
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;padding:40px;text-align:center">',
      '<span class="material-icons-round" style="font-size:48px;color:var(--red)">error_outline</span>',
      '<div style="font-size:14px;color:var(--red);font-weight:600">Gagal memuat manifest</div>',
      '<div style="font-size:12px;color:var(--gray5)">' + escH(msg) + '</div>',
      '<button class="btn btn-primary" style="padding:11px 28px;font-size:13px;border-radius:10px;gap:8px;margin-top:4px" onclick="' + retryFn + '">',
        '<span class="material-icons-round">refresh</span> Coba Lagi',
      '</button>',
    '</div>'
  ].join('');
}

function filterManifest() {
  _mfFilter = document.getElementById('manifestSearch').value;
  _mfSelRow = -1;
  _mfSelCol = -1;
  renderManifest();
}

// ─── RENDER MANIFEST ───
// Struktur data dari getManifest:
//   res.columns → array of { incharge, service, tujuan, dates[], rows[][] }
//   rows[i] = [ awb, date1?, date2?, ... ]   (sesuai col.dates.length)
// Header yang dirender:
//   Row 1 — Incharge  (merged per grup incharge)
//   Row 2 — Service   (merged per kolom tujuan)
//   Row 3 — Tujuan    (1 kolom AWB + N kolom DATE per tujuan)
//   Row 4 — "AWB" | "DATE"
// Ini sesuai tampilan di screenshot.
function renderManifest() {
  var outer = document.getElementById('mfSheetOuter');

  if (!_mfData || !_mfData.columns || !_mfData.columns.length) {
    outer.innerHTML = _manifestEmptyPlaceholder();
    _updateMfStats(0, 0, 0);
    return;
  }

  var cols = _mfData.columns;
  var q    = (_mfFilter || '').toLowerCase();

  // Filter kolom berdasarkan query
  var filteredCols = cols.map(function (col) {
    if (!q) return col;
    var matchedRows = col.rows.filter(function (row) {
      return row.some(function (cell) {
        return (cell || '').toLowerCase().indexOf(q) !== -1;
      });
    });
    // Cek apakah header cocok
    var headerMatch = (col.incharge + col.service + col.tujuan).toLowerCase().indexOf(q) !== -1;
    return Object.assign({}, col, { rows: headerMatch ? col.rows : matchedRows });
  }).filter(function (col) {
    if (!q) return true;
    return col.rows.length > 0 ||
      (col.incharge + col.service + col.tujuan).toLowerCase().indexOf(q) !== -1;
  });

  if (!filteredCols.length) {
    outer.innerHTML = '<div style="padding:40px;text-align:center;color:var(--gray5);font-size:13px">Tidak ada data yang cocok dengan pencarian "<strong>' + escH(q) + '</strong>"</div>';
    _updateMfStats(0, 0, 0);
    return;
  }

  // Hitung maxRows
  var maxRows = filteredCols.reduce(function (m, col) {
    return Math.max(m, col.rows.length);
  }, 0);
  _mfFilteredRows = [];
  for (var i = 0; i < maxRows; i++) _mfFilteredRows.push(i);

  // Stats
  var totalAwb = 0;
  filteredCols.forEach(function (col) {
    col.rows.forEach(function (row) {
      if (row[0]) totalAwb++;
    });
  });
  var inchargeList = [];
  filteredCols.forEach(function (col) {
    if (inchargeList.indexOf(col.incharge) === -1) inchargeList.push(col.incharge);
  });

  // Total kolom display (1 AWB + N DATE per tujuan)
  var totalDisplayCols = filteredCols.reduce(function (s, col) {
    return s + 1 + (col.dates ? col.dates.length : 1);
  }, 0);
  _updateMfStats(filteredCols.length, totalAwb, inchargeList.length);

  // ── Build header colspan groups ──

  // Grup Incharge: berapa colspan per incharge
  var incGroups = [];
  filteredCols.forEach(function (col) {
    var span = 1 + (col.dates ? col.dates.length : 1); // AWB cols + DATE cols
    if (!incGroups.length || incGroups[incGroups.length - 1].name !== col.incharge) {
      incGroups.push({ name: col.incharge, count: 0 });
    }
    incGroups[incGroups.length - 1].count += span;
  });

  // ── Build HTML ──
  var html = '<table class="mf-table"><thead>';

  // ── Row 1: Incharge ──
  html += '<tr><th class="mf-rn" rowspan="4">#</th>';
  incGroups.forEach(function (g) {
    html += '<th class="mf-hdr-incharge" colspan="' + g.count + '">' + escH(g.name) + '</th>';
  });
  html += '</tr>';

  // ── Row 2: Service (merged per tujuan-kolom) ──
  // Group consecutive cols dengan service+incharge sama
  html += '<tr>';
  var svcGroups = [];
  filteredCols.forEach(function (col) {
    var span = 1 + (col.dates ? col.dates.length : 1);
    var key  = col.incharge + '|' + col.service;
    if (!svcGroups.length || svcGroups[svcGroups.length - 1].key !== key) {
      svcGroups.push({ key: key, name: col.service, count: 0 });
    }
    svcGroups[svcGroups.length - 1].count += span;
  });
  svcGroups.forEach(function (g) {
    html += '<th class="mf-hdr-service" colspan="' + g.count + '">' + escH(g.name) + '</th>';
  });
  html += '</tr>';

  // ── Row 3: Tujuan (1 kolom tujuan = 1 AWB + N DATE cells) ──
  html += '<tr>';
  filteredCols.forEach(function (col) {
    var span = 1 + (col.dates ? col.dates.length : 1);
    html += '<th class="mf-hdr-tujuan" colspan="' + span + '">' + escH(col.tujuan) + '</th>';
  });
  html += '</tr>';

  // ── Row 4: AWB | DATE sub-headers ──
  html += '<tr>';
  filteredCols.forEach(function (col, ci) {
    // Kolom AWB
    html += '<th class="mf-hdr-sub-awb" data-ci="' + ci + '" data-si="0">AWB</th>';
    // Kolom DATE (satu atau lebih)
    var dates = col.dates || [];
    if (dates.length) {
      dates.forEach(function (d, di) {
        html += '<th class="mf-hdr-date" data-ci="' + ci + '" data-di="' + di + '">' + escH(d) + '</th>';
      });
    } else {
      // Minimal 1 kolom DATE
      html += '<th class="mf-hdr-date" data-ci="' + ci + '" data-di="0">DATE</th>';
    }
  });
  html += '</tr></thead><tbody>';

  // ── Data rows ──
  for (var row = 0; row < maxRows; row++) {
    html += '<tr class="mf-data-row">';
    html += '<td class="mf-rn">' + (row + 1) + '</td>';

    filteredCols.forEach(function (col, ci) {
      var rowData = col.rows[row] || [];
      var awb     = rowData[0] || '';
      var colBase = ci * 1000; // Unique col ID

      // Cell AWB
      var selClass = (_mfSelRow === row && _mfSelCol === colBase) ? ' mf-cell-selected' : '';
      html += '<td class="mf-cell-awb' + selClass + '" onclick="mfSelect(' + row + ',' + colBase + ',\'' + escQ(awb) + '\')">' + escH(awb) + '</td>';

      // Cell DATE(s)
      var dates = col.dates || [];
      if (dates.length) {
        dates.forEach(function (d, di) {
          // Isi date hanya jika ada AWB di baris ini; jika tidak, kosong
          var dateVal = awb ? (rowData[di + 1] || d) : '';
          var selClassD = (_mfSelRow === row && _mfSelCol === colBase + di + 1) ? ' mf-cell-selected' : '';
          html += '<td class="mf-cell-date' + selClassD + '" onclick="mfSelect(' + row + ',' + (colBase + di + 1) + ',\'' + escQ(dateVal) + '\')">' + escH(dateVal) + '</td>';
        });
      } else {
        // Satu kolom DATE — tampilkan date jika ada AWB
        var dateVal = awb ? (rowData[1] || '') : '';
        var selClassD = (_mfSelRow === row && _mfSelCol === colBase + 1) ? ' mf-cell-selected' : '';
        html += '<td class="mf-cell-date' + selClassD + '" onclick="mfSelect(' + row + ',' + (colBase + 1) + ',\'' + escQ(dateVal) + '\')">' + escH(dateVal) + '</td>';
      }
    });

    html += '</tr>';
  }

  if (maxRows === 0) {
    var totalSubCols = filteredCols.reduce(function (s, col) {
      return s + 1 + (col.dates ? col.dates.length : 1);
    }, 0);
    html += '<tr><td class="mf-rn">—</td><td colspan="' + totalSubCols + '" style="padding:20px;text-align:center;color:var(--gray5);font-size:12px">Tidak ada AWB untuk hari ini</td></tr>';
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

// ─── Placeholder saat belum load ───
function _manifestEmptyPlaceholder() {
  return [
    '<div id="mfPlaceholder" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;padding:40px;text-align:center">',
      '<span class="material-icons-round" style="font-size:64px;color:var(--gray3)">grid_on</span>',
      '<div style="font-size:16px;font-weight:700;color:var(--gray6)">Manifest Hari Ini</div>',
      '<div style="font-size:13px;color:var(--gray5);max-width:320px;line-height:1.7">',
        'Data manifest belum dimuat. Klik tombol di bawah untuk mengambil data manifest <strong>hari ini</strong>.',
      '</div>',
      '<button class="btn btn-primary" style="padding:13px 32px;font-size:14px;border-radius:10px;gap:10px;margin-top:8px" onclick="loadManifestPage()">',
        '<span class="material-icons-round" style="font-size:20px">grid_on</span>',
        'Muat Manifest Hari Ini',
      '</button>',
    '</div>'
  ].join('');
}

function mfSelect(row, col, val) {
  _mfSelRow = row;
  _mfSelCol = col;
  document.getElementById('mfActiveCell').innerText = val || '—';
  document.querySelectorAll('.mf-cell-selected').forEach(function (el) {
    el.classList.remove('mf-cell-selected');
  });
  event.target.classList.add('mf-cell-selected');
  document.getElementById('mfSheetOuter').focus();
}

function _updateMfStats(cols, awb, inc) {
  document.getElementById('mfTotalCols').innerText = cols;
  document.getElementById('mfTotalAwb').innerText  = awb;
  document.getElementById('mfTotalInc').innerText  = inc;
}

function exportManifestCSV() {
  if (!_mfData || !_mfData.columns || !_mfData.columns.length) {
    toast('Muat manifest dulu', 'error');
    return;
  }
  var today = _dateStr();
  var rows  = [['INCHARGE', 'SERVICE', 'TUJUAN', 'AWB', 'DATE', 'TANGGAL_EXPORT']];
  _mfData.columns.forEach(function (col) {
    col.rows.forEach(function (row) {
      var awb   = row[0] || '';
      var dates = col.dates || [];
      var dateVal = dates.length ? (row[1] || dates[0] || '') : (row[1] || '');
      rows.push([col.incharge, col.service, col.tujuan, awb, dateVal, today]);
    });
  });
  _downloadCSV(rows, 'manifest_' + today + '.csv');
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

// ─── CSV & COPY HELPERS ───
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
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

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

// ─── CSS tambahan untuk Manifest (mf-hdr-sub-awb) ───
(function () {
  var style = document.createElement('style');
  style.textContent = [
    /* Sub-header "AWB" di baris ke-4 manifest */
    '.mf-hdr-sub-awb{',
      'background:var(--gray1);',
      'color:var(--gray5);',
      'font-weight:700;',
      'font-size:10px;',
      'text-align:center;',
      'padding:5px 8px;',
      'white-space:nowrap;',
      'border:1px solid var(--gray3);',
      'text-transform:uppercase;',
      'letter-spacing:.5px;',
    '}',
    /* Hover highlight manifest rows */
    '.mf-data-row:hover .mf-cell-awb { background: var(--blue-light); }',
    '.mf-data-row:hover .mf-cell-date { background: #FFF9C4; }',
    '.mf-data-row:hover .mf-cell-selected { background: #BBDEFB !important; }',
    /* Obib extra styles */
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
