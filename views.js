/* ============================================================
   GTW BDO — views.js v4.3
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

// ─── ALL SCAN AWBs ───
function buildAllScanAwbs() {
  allScanAwbs = [];
  function pushArr(arr, type) {
    arr.forEach(function (item) {
      if (item._awbs) {
        item._awbs.forEach(function (awb) {
          allScanAwbs.push({
            awb: awb, noTrack: item.no_track, type: type,
            tujuan: item.tujuan, incharge: item.incharge,
            service: item.service, status: item.status,
            from: item.from || '', date: item.created_date
          });
        });
      }
    });
  }
  pushArr(obData,  'ob');
  pushArr(hvsData, 'hvs');
  pushArr(ibData,  'ib');
}

/* ================================================================
   OB & IB COMBINED VIEW  v4.3
   ----------------------------------------------------------------
   Header 4 baris: Incharge → Kota → Service → Tipe kolom
   
   Kolom OUTBOUND (OB):
     [OUTBOUND/tujuan]  [DATE]
     awb[0]             created_date   <- mirror date dari item
     awb[1]             created_date
   
   Kolom OUTBOUND_HVS (HVS):
     [OUTBOUND_HVS/tujuan]  [DATE]
     awb[0]                 created_date
     awb[1]                 created_date
   
   Kolom INBOUND_HVS (IB):
     [DATE]            [INBOUND_HVS/tujuan]
     awb[0].date       awb[0].awb
     awb[1].date       awb[1].awb
     (DATE = timestamp scan per-AWB, bukan mirror)
   
   API: gasGet('getObibFull') → {
     ob:  [{ no_track, incharge, kota, service, tujuan, created_date, status, awbs:[{awb,date}|string] }],
     hvs: [...],
     ib:  [{ ..., tujuan, from, awbs:[{awb,date}] }]
   }
================================================================ */

function renderObibPage() {
  var wrap = document.getElementById('obibTableWrap');
  wrap.innerHTML = '<div class="empty-state"><span class="material-icons-round">hourglass_empty</span>Memuat...</div>';

  if (_obibData) { _buildObibTable(_obibData); return; }

  showLoading('Memuat OB & IB...');
  gasGet('getObibFull')
    .then(function (res) {
      hideLoading();
      if (res && (res.ob || res.hvs || res.ib)) {
        _obibData = { ob: res.ob || [], hvs: res.hvs || [], ib: res.ib || [] };
      } else {
        _obibData = _obibFromMemory();
      }
      _buildObibTable(_obibData);
    })
    .catch(function () {
      hideLoading();
      _obibData = _obibFromMemory();
      _buildObibTable(_obibData);
    });
}

/* Fallback: pakai obData/hvsData/ibData yang sudah ada di memori */
function _obibFromMemory() {
  function mapItem(item) {
    var awbs = (item._awbs || []).map(function (a) {
      return typeof a === 'string' ? { awb: a, date: item.created_date || '' } : a;
    });
    return {
      no_track:     item.no_track     || '',
      incharge:     item.incharge     || '—',
      kota:         item.kota         || item.incharge || '—',
      service:      item.service      || '',
      tujuan:       item.tujuan       || '',
      from:         item.from         || '',
      created_date: item.created_date || '',
      status:       item.status       || '',
      awbs:         awbs
    };
  }
  return { ob: obData.map(mapItem), hvs: hvsData.map(mapItem), ib: ibData.map(mapItem) };
}

function reloadObib() { _obibData = null; renderObibPage(); }

function filterObib() {
  var q = (document.getElementById('obibSearch').value || '').toLowerCase();
  if (!_obibData) return;
  function filt(arr) {
    if (!q) return arr;
    return arr.filter(function (d) {
      var base = (d.no_track + d.incharge + d.kota + d.service + d.tujuan + d.from + d.status).toLowerCase();
      if (base.indexOf(q) !== -1) return true;
      return (d.awbs || []).some(function (a) {
        return ((a.awb || a || '')).toLowerCase().indexOf(q) !== -1;
      });
    });
  }
  _buildObibTable({ ob: filt(_obibData.ob), hvs: filt(_obibData.hvs), ib: filt(_obibData.ib) });
}

/* ── core builder ── */
function _buildObibTable(data) {
  var wrap = document.getElementById('obibTableWrap');

  /* Kelompokkan per incharge, pertahankan urutan kemunculan lalu sort */
  var incOrder = [];
  var incMap   = {};

  function group(arr, type) {
    arr.forEach(function (item) {
      var inc = item.incharge || '—';
      if (!incMap[inc]) {
        incMap[inc] = { kota: item.kota || inc, ob: [], hvs: [], ib: [] };
        incOrder.push(inc);
      }
      if (item.kota && item.kota !== inc) incMap[inc].kota = item.kota;
      incMap[inc][type].push(item);
    });
  }
  group(data.ob,  'ob');
  group(data.hvs, 'hvs');
  group(data.ib,  'ib');
  incOrder.sort();

  if (!incOrder.length) {
    wrap.innerHTML = '<div class="empty-state"><span class="material-icons-round">inbox</span>Tidak ada data</div>';
    return;
  }

  /* colspan per incharge = 2 per item (semua tipe) */
  function colCount(g) { return (g.ob.length + g.hvs.length + g.ib.length) * 2; }

  /* max rows = panjang awbs terpanjang di seluruh incharge */
  var totalMaxRows = 0;
  incOrder.forEach(function (inc) {
    var g = incMap[inc];
    [g.ob, g.hvs, g.ib].forEach(function (arr) {
      arr.forEach(function (item) {
        if ((item.awbs || []).length > totalMaxRows) totalMaxRows = item.awbs.length;
      });
    });
  });

  /* ── HEADER ── */
  var h = '<table class="obib-table"><thead>';

  /* Baris 1 – INCHARGE */
  h += '<tr><th class="obib-rn" rowspan="4">#</th>';
  incOrder.forEach(function (inc) {
    var cc = colCount(incMap[inc]);
    if (!cc) return;
    h += '<th class="obib-hdr-incharge" colspan="' + cc + '">' + escH(inc) + '</th>';
  });
  h += '</tr>';

  /* Baris 2 – KOTA */
  h += '<tr>';
  incOrder.forEach(function (inc) {
    var g = incMap[inc], cc = colCount(g);
    if (!cc) return;
    h += '<th class="obib-hdr-kota" colspan="' + cc + '">' + escH(g.kota) + '</th>';
  });
  h += '</tr>';

  /* Baris 3 – SERVICE (colspan 2 per item) */
  h += '<tr>';
  incOrder.forEach(function (inc) {
    var g = incMap[inc];
    g.ob.forEach(function (item)  { h += '<th class="obib-hdr-service obib-svc-ob"  colspan="2">' + escH(item.service) + '</th>'; });
    g.hvs.forEach(function (item) { h += '<th class="obib-hdr-service obib-svc-hvs" colspan="2">' + escH(item.service) + '</th>'; });
    g.ib.forEach(function (item)  { h += '<th class="obib-hdr-service obib-svc-ib"  colspan="2">' + escH(item.service) + '</th>'; });
  });
  h += '</tr>';

  /* Baris 4 – TIPE KOLOM */
  h += '<tr>';
  incOrder.forEach(function (inc) {
    var g = incMap[inc];
    /* OB  → [OUTBOUND/tujuan]     [DATE] */
    g.ob.forEach(function (item) {
      h += '<th class="obib-hdr-type outbound">' + escH(item.tujuan || item.no_track) + '</th>';
      h += '<th class="obib-hdr-type date">DATE</th>';
    });
    /* HVS → [OUTBOUND_HVS/tujuan] [DATE] */
    g.hvs.forEach(function (item) {
      h += '<th class="obib-hdr-type outbound-hvs">' + escH(item.tujuan || item.no_track) + '</th>';
      h += '<th class="obib-hdr-type date">DATE</th>';
    });
    /* IB  → [DATE] [INBOUND_HVS/tujuan] */
    g.ib.forEach(function (item) {
      h += '<th class="obib-hdr-type date">DATE</th>';
      h += '<th class="obib-hdr-type inbound-hvs">' + escH(item.tujuan || item.from || item.no_track) + '</th>';
    });
  });
  h += '</tr></thead>';

  /* ── BODY ── */
  h += '<tbody>';

  if (totalMaxRows === 0) {
    var totalCols = incOrder.reduce(function (s, inc) { return s + colCount(incMap[inc]); }, 0) + 1;
    h += '<tr><td colspan="' + totalCols + '"><div class="empty-state"><span class="material-icons-round">inbox</span>Tidak ada data AWB</div></td></tr>';
  }

  for (var row = 0; row < totalMaxRows; row++) {
    h += '<tr class="obib-data-row">';
    h += '<td class="obib-rn">' + (row + 1) + '</td>';

    incOrder.forEach(function (inc) {
      var g = incMap[inc];

      /* OB → AWB | DATE-mirror */
      g.ob.forEach(function (item) {
        var entry = (item.awbs || [])[row];
        var awb   = entry ? (typeof entry === 'string' ? entry : (entry.awb || '')) : '';
        var date  = awb ? (item.created_date || '') : '';
        var sel   = item.status === 'SELESAI';
        h += '<td class="obib-cell-awb ob-cell'  + (sel ? ' cell-selesai' : '') + '">' + escH(awb)  + '</td>';
        h += '<td class="obib-cell-date ob-date">' + escH(date) + '</td>';
      });

      /* HVS → AWB | DATE-mirror */
      g.hvs.forEach(function (item) {
        var entry = (item.awbs || [])[row];
        var awb   = entry ? (typeof entry === 'string' ? entry : (entry.awb || '')) : '';
        var date  = awb ? (item.created_date || '') : '';
        var sel   = item.status === 'SELESAI';
        h += '<td class="obib-cell-awb hvs-cell' + (sel ? ' cell-selesai' : '') + '">' + escH(awb)  + '</td>';
        h += '<td class="obib-cell-date hvs-date">' + escH(date) + '</td>';
      });

      /* IB → DATE-per-AWB | AWB */
      g.ib.forEach(function (item) {
        var entry = (item.awbs || [])[row];
        var awb   = '';
        var date  = '';
        if (entry) {
          if (typeof entry === 'string') { awb = entry; date = item.created_date || ''; }
          else { awb = entry.awb || ''; date = entry.date || item.created_date || ''; }
        }
        var sel = item.status === 'SELESAI';
        h += '<td class="obib-cell-date ib-date">'  + escH(date) + '</td>';
        h += '<td class="obib-cell-awb ib-cell'  + (sel ? ' cell-selesai' : '') + '">' + escH(awb)  + '</td>';
      });
    });

    h += '</tr>';
  }

  h += '</tbody></table>';
  wrap.innerHTML = h;
}

/* ── Export OB&IB CSV ── */
function exportObibCSV() {
  if (!_obibData) { toast('Muat data dulu', 'error'); return; }
  var rows = [['INCHARGE','KOTA','TYPE','SERVICE','TUJUAN/FROM','AWB','DATE','STATUS']];
  function addRows(arr, type) {
    arr.forEach(function (item) {
      (item.awbs || []).forEach(function (entry) {
        var awb  = typeof entry === 'string' ? entry : (entry.awb  || '');
        var date = typeof entry === 'string' ? (item.created_date || '') : (entry.date || item.created_date || '');
        rows.push([item.incharge, item.kota||'', type, item.service, item.tujuan||item.from||'', awb, date, item.status]);
      });
    });
  }
  addRows(_obibData.ob,  'OUTBOUND');
  addRows(_obibData.hvs, 'OUTBOUND_HVS');
  addRows(_obibData.ib,  'INBOUND_HVS');
  _downloadCSV(rows, 'obib_' + _dateStr() + '.csv');
}

/* ================================================================
   MANIFEST PAGE
================================================================ */
function loadManifestPage() { if (!_mfLoaded) reloadManifest(); }

function reloadManifest() {
  showLoading('Memuat Manifest...');
  var outer = document.getElementById('mfSheetOuter');
  outer.innerHTML = '<div style="padding:40px;text-align:center;color:var(--gray5)"><span class="material-icons-round" style="font-size:40px;color:var(--gray4);display:block;margin-bottom:8px">hourglass_empty</span>Memuat...</div>';

  gasGet('getManifest').then(function (res) {
    hideLoading();
    _mfData   = res || {};
    _mfLoaded = true;
    _mfFilter = '';
    _mfSelRow = -1; _mfSelCol = -1;
    document.getElementById('manifestSearch').value = '';
    renderManifest();
  }).catch(function (e) {
    hideLoading();
    outer.innerHTML = '<div style="padding:40px;text-align:center;color:var(--red)">Gagal memuat manifest: ' + escH(e.message) + '</div>';
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

  var cols = _mfData.columns;
  var q    = (_mfFilter || '').toLowerCase();

  var filteredCols = cols.map(function (col) {
    if (!q) return col;
    var frows = (col.rows || []).filter(function (row) {
      return row.some(function (c) { return (c || '').toLowerCase().indexOf(q) !== -1; });
    });
    return Object.assign({}, col, { rows: frows });
  }).filter(function (col) {
    if (!q) return true;
    if ((col.rows || []).length) return true;
    return (col.incharge + col.service + col.tujuan).toLowerCase().indexOf(q) !== -1;
  });

  var maxRows  = filteredCols.reduce(function (m, col) { return Math.max(m, (col.rows || []).length); }, 0);
  var totalAwb = 0;
  filteredCols.forEach(function (col) { (col.rows || []).forEach(function (row) { row.forEach(function (c) { if (c) totalAwb++; }); }); });
  var incharges = [];
  filteredCols.forEach(function (col) { if (incharges.indexOf(col.incharge) === -1) incharges.push(col.incharge); });
  _updateMfStats(filteredCols.length, totalAwb, incharges.length);

  if (!filteredCols.length) {
    outer.innerHTML = '<div style="padding:40px;text-align:center;color:var(--gray5)">Tidak ada data</div>';
    return;
  }

  /* Grup incharge untuk header baris-1 */
  var incGroups = [];
  filteredCols.forEach(function (col) {
    if (!incGroups.length || incGroups[incGroups.length - 1].name !== col.incharge)
      incGroups.push({ name: col.incharge, count: 0 });
    incGroups[incGroups.length - 1].count += (col.dates || []).length + 1;
  });

  var h = '<table class="mf-table"><thead>';
  /* Baris 1 – Incharge */
  h += '<tr><th class="mf-rn" rowspan="4">#</th>';
  incGroups.forEach(function (g) { h += '<th class="mf-hdr-incharge" colspan="' + g.count + '">' + escH(g.name) + '</th>'; });
  h += '</tr>';
  /* Baris 2 – Service */
  h += '<tr>';
  filteredCols.forEach(function (col) { h += '<th class="mf-hdr-service" colspan="' + ((col.dates||[]).length + 1) + '">' + escH(col.service) + '</th>'; });
  h += '</tr>';
  /* Baris 3 – Tujuan */
  h += '<tr>';
  filteredCols.forEach(function (col) { h += '<th class="mf-hdr-tujuan" colspan="' + ((col.dates||[]).length + 1) + '">' + escH(col.tujuan) + '</th>'; });
  h += '</tr>';
  /* Baris 4 – AWB | dates */
  h += '<tr>';
  filteredCols.forEach(function (col, ci) {
    h += '<th class="mf-cell-awb" style="background:var(--gray1);font-size:10px;font-weight:700;color:var(--gray5);padding:5px 8px">AWB</th>';
    (col.dates || []).forEach(function (d) { h += '<th class="mf-hdr-date">' + escH(d) + '</th>'; });
  });
  h += '</tr></thead><tbody>';

  for (var row = 0; row < maxRows; row++) {
    h += '<tr class="mf-data-row">';
    h += '<td class="mf-rn">' + (row + 1) + '</td>';
    filteredCols.forEach(function (col, ci) {
      var rowData = (col.rows || [])[row] || [];
      var awb     = rowData[0] || '';
      var sc      = (_mfSelRow === row && _mfSelCol === ci * 1000) ? ' mf-cell-selected' : '';
      h += '<td class="mf-cell-awb' + sc + '" onclick="mfSelect(' + row + ',' + (ci*1000) + ',\'' + escQ(awb) + '\')">' + escH(awb) + '</td>';
      (col.dates || []).forEach(function (d, di) {
        var val = rowData[di + 1] || (awb ? d : '');
        var sc2 = (_mfSelRow === row && _mfSelCol === ci * 1000 + di + 1) ? ' mf-cell-selected' : '';
        h += '<td class="mf-cell-date' + sc2 + '" onclick="mfSelect(' + row + ',' + (ci*1000+di+1) + ',\'' + escQ(val) + '\')">' + escH(val) + '</td>';
      });
    });
    h += '</tr>';
  }
  h += '</tbody></table>';
  outer.innerHTML = h;
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
  if (event && event.target) event.target.classList.add('mf-cell-selected');
  document.getElementById('mfSheetOuter').focus();
}

function _updateMfStats(cols, awb, inc) {
  document.getElementById('mfTotalCols').innerText = cols;
  document.getElementById('mfTotalAwb').innerText  = awb;
  document.getElementById('mfTotalInc').innerText  = inc;
}

function exportManifestCSV() {
  if (!_mfData || !_mfData.columns) { toast('Muat manifest dulu', 'error'); return; }
  var rows = [['INCHARGE','SERVICE','TUJUAN','AWB','DATE']];
  _mfData.columns.forEach(function (col) {
    (col.rows || []).forEach(function (row) {
      rows.push([col.incharge, col.service, col.tujuan, row[0]||'', (col.dates||[]).join(' | ')]);
    });
  });
  _downloadCSV(rows, 'manifest_' + _dateStr() + '.csv');
}

/* ================================================================
   SEARCH AWB
================================================================ */
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
          if ((awb || '').toLowerCase().indexOf(ql) !== -1)
            results.push({ awb: awb, noTrack: item.no_track, type: type, tujuan: item.tujuan, incharge: item.incharge, service: item.service, status: item.status, from: item.from || '', date: item.created_date });
        });
      }
    });
  }
  searchArr(obData,  'ob');
  searchArr(hvsData, 'hvs');
  searchArr(ibData,  'ib');
  allScanAwbs.forEach(function (r) {
    if ((r.awb || '').toLowerCase().indexOf(ql) !== -1) {
      if (!results.some(function (x) { return x.awb === r.awb && x.noTrack === r.noTrack; }))
        results.push(r);
    }
  });

  hdr.innerHTML = '<span class="material-icons-round">search</span> ' + results.length + ' hasil untuk <strong>"' + escH(q) + '"</strong>';

  if (!results.length) {
    body.innerHTML = '<div class="search-awb-empty"><span class="material-icons-round">manage_search</span>Mencari di server...</div>';
    gasGet('searchAwb', { q: q }).then(function (res) {
      var list = res.list || [];
      hdr.innerHTML  = '<span class="material-icons-round">search</span> ' + list.length + ' hasil untuk <strong>"' + escH(q) + '"</strong>';
      body.innerHTML = list.length
        ? list.map(function (r) { return _searchAwbItem(r, q); }).join('')
        : '<div class="search-awb-empty"><span class="material-icons-round">search_off</span>AWB tidak ditemukan</div>';
    }).catch(function () {
      body.innerHTML = '<div class="search-awb-empty"><span class="material-icons-round">search_off</span>AWB tidak ditemukan</div>';
    });
    return;
  }
  body.innerHTML = results.map(function (r) { return _searchAwbItem(r, q); }).join('');
}

function _searchAwbItem(r, q) {
  var typeLabel = r.type === 'ob' ? 'Outbound BDO' : r.type === 'hvs' ? 'Outbound HVS' : 'Inbound HVS';
  var icon      = r.type === 'ob' ? 'local_shipping' : r.type === 'hvs' ? 'inventory_2' : 'move_to_inbox';
  var hi        = escH(r.awb).replace(new RegExp('(' + escRegex(escH(q)) + ')', 'gi'), '<mark>$1</mark>');
  var stTag     = r.status === 'SELESAI'
    ? '<span style="background:var(--green-light);color:var(--green);padding:1px 7px;border-radius:10px;font-size:10px;font-weight:700">✓ Selesai</span>'
    : '<span style="background:var(--orange-light);color:var(--orange);padding:1px 7px;border-radius:10px;font-size:10px;font-weight:700">● On Proses</span>';
  return '<div class="search-awb-item">'
    + '<div class="search-awb-item-icon ' + r.type + '"><span class="material-icons-round">' + icon + '</span></div>'
    + '<div class="search-awb-item-main">'
    +   '<div class="search-awb-item-awb">' + hi + '</div>'
    +   '<div class="search-awb-item-meta">'
    +     '<span class="search-awb-type-tag ' + r.type + '">' + typeLabel + '</span>' + stTag
    +     (r.noTrack   ? '<span class="search-awb-item-notrack" onclick="openDetailModal(\'' + r.type + '\',\'' + escQ(r.noTrack) + '\')">' + escH(r.noTrack) + '</span>' : '')
    +     (r.incharge  ? '<span>' + escH(r.incharge) + '</span>' : '')
    +     (r.service   ? '<span>' + escH(r.service)  + '</span>' : '')
    +     (r.from      ? '<span>From: ' + escH(r.from) + '</span>' : '')
    +     (r.tujuan    ? '<span>→ ' + escH(r.tujuan) + '</span>' : '')
    +     (r.date      ? '<span style="color:var(--gray4)">' + escH(r.date) + '</span>' : '')
    +   '</div>'
    + '</div>'
    + '</div>';
}

function clearSearchAwb() {
  document.getElementById('searchAwbMainInput').value = '';
  doSearchAwb('');
}

/* ================================================================
   SIDEBAR SEARCH
================================================================ */
function handleSidebarSearch(e) {
  if (e.key !== 'Enter') return;
  var q = document.getElementById('sidebarSearchInput').value.trim();
  if (!q) return;
  switchPage('search');
  document.getElementById('searchAwbMainInput').value = q;
  doSearchAwb(q);
  document.getElementById('sidebarSearchInput').value = '';
}

/* ================================================================
   EXPORT CSV
================================================================ */
function exportCSV() {
  var active = '';
  ['ob','hvs','ib','manifest','obib'].forEach(function (p) {
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
  var d = filteredData(obData);
  var rows = [['NO TRACK','INCHARGE','SERVICE','TUJUAN','DATE','TOTAL AWB','STATUS']];
  d.forEach(function (r) { rows.push([r.no_track,r.incharge,r.service,r.tujuan,r.created_date,r.total_awb,r.status]); });
  _downloadCSV(rows, 'outbound_bdo_' + _dateStr() + '.csv');
}
function exportHvsCSV() {
  var d = filteredData(hvsData);
  var rows = [['NO TRACK','INCHARGE','SERVICE','TUJUAN','DATE','TOTAL AWB','STATUS']];
  d.forEach(function (r) { rows.push([r.no_track,r.incharge,r.service,r.tujuan,r.created_date,r.total_awb,r.status]); });
  _downloadCSV(rows, 'outbound_hvs_' + _dateStr() + '.csv');
}
function exportIbCSV() {
  var d = filteredData(ibData);
  var rows = [['NO TRACK','INCHARGE','SERVICE','FROM','TUJUAN','DATE','TOTAL AWB','STATUS']];
  d.forEach(function (r) { rows.push([r.no_track,r.incharge,r.service,r.from||'',r.tujuan,r.created_date,r.total_awb,r.status]); });
  _downloadCSV(rows, 'inbound_hvs_' + _dateStr() + '.csv');
}

/* ─── helpers ─── */
function _downloadCSV(rows, filename) {
  var csv = rows.map(function (r) {
    return r.map(function (c) {
      var s = (c == null) ? '' : String(c);
      if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1)
        s = '"' + s.replace(/"/g, '""') + '"';
      return s;
    }).join(',');
  }).join('\r\n');
  var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url; a.download = filename; a.style.display = 'none';
  document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(url); document.body.removeChild(a); }, 1000);
  toast('CSV diunduh: ' + filename, 'success');
}

function _dateStr() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function _copyText(text) {
  if (!text || !text.trim()) return;
  navigator.clipboard.writeText(text.trim()).then(function () {
    var el = document.getElementById('copyFlash');
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 1200);
  }).catch(function () { toast('Gagal copy', 'error'); });
}

/* ─── Inject CSS tambahan ─── */
(function () {
  var s = document.createElement('style');
  s.textContent = [
    /* OB&IB table scroll + sticky */
    '.obib-table-wrap{overflow-x:auto;max-height:calc(100vh - 160px);overflow-y:auto}',
    '.obib-table thead{position:sticky;top:0;z-index:10}',
    '.obib-table .obib-rn{position:sticky;left:0;z-index:5;background:var(--gray1)}',
    '.obib-table thead .obib-rn{z-index:15}',

    /* Service header per tipe */
    '.obib-svc-ob {background:#DBEAFE!important;color:#1E3A8A!important}',
    '.obib-svc-hvs{background:#EDE7F6!important;color:#4A148C!important}',
    '.obib-svc-ib {background:#DCFCE7!important;color:#14532D!important}',

    /* AWB cells — base */
    '.obib-cell-awb{padding:5px 9px;font-family:var(--mono);font-size:12px;color:var(--gray8);min-width:130px;white-space:nowrap}',
    '.ob-cell {background:#EFF6FF}',
    '.hvs-cell{background:#FAF5FF}',
    '.ib-cell {background:#F0FDF4}',

    /* SELESAI = muted italic */
    '.ob-cell.cell-selesai {color:var(--blue);font-style:italic;opacity:.7}',
    '.hvs-cell.cell-selesai{color:var(--purple);font-style:italic;opacity:.7}',
    '.ib-cell.cell-selesai {color:var(--green);font-style:italic;opacity:.7}',

    /* DATE cells */
    '.obib-cell-date{padding:5px 8px;font-family:var(--mono);font-size:11px;color:var(--gray5);text-align:center;min-width:90px;white-space:nowrap;border-right:2px solid var(--gray3)}',
    '.ob-date {background:#FFFDE7}',
    '.hvs-date{background:#FDF4FF}',
    '.ib-date {background:#F0FFF4}',

    /* Row hover */
    '.obib-data-row:hover .ob-cell {background:#DBEAFE}',
    '.obib-data-row:hover .hvs-cell{background:#EDE9FE}',
    '.obib-data-row:hover .ib-cell {background:#DCFCE7}',
    '.obib-data-row:hover .obib-cell-date{background:#FEF9C3}',

    /* Separator antar group incharge */
    '.obib-table th.obib-hdr-incharge{border-left:3px solid rgba(255,255,255,.35)}',
    '.obib-table th.obib-hdr-kota{border-left:3px solid rgba(255,255,255,.25)}',
  ].join('\n');
  document.head.appendChild(s);
})();
