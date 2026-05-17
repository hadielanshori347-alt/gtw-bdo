/* ============================================================
   GTW BDO — views.js v4.3
   OB&IB flat rows (AWB turun ke bawah, DATE mirror per baris),
   Manifest, Search AWB, Sidebar search, Export CSV, Reload
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
  _mfLoaded  = false;
  _obibData  = null;
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
  gasGet('getAllScanAwbs').then(function (r) {
    if (r && r.list) allScanAwbs = r.list;
  }).catch(function () {});
}

// ═══════════════════════════════════════════════════════════════
// ★★★  OB & IB  — FLAT ROWS v4.3  ★★★
//
// Menggunakan endpoint getOBIB dari backend v4.2
// Backend mengembalikan:
//   headerR1/R2/R3/R4 : array raw header (sudah propagate)
//   colDefs[]          : { colIdx, r1, r2, r3, colType, flatRows[], ibSections[], entries[] }
//   ibSections[]       : records IB lengkap { no_track, service, from, tujuan, date, awbs[] }
//
// Layout tabel:
//   4 baris thead   : Incharge | Kota/Tujuan | Service | Tipe Kolom
//   tbody flat rows : SETIAP AWB = SATU BARIS
//
// Kolom OUTBOUND / OUTBOUND_HVS:
//   - Setiap baris = 1 AWB
//   - Kolom DATE setelahnya = tanggal AWB tersebut (tiap baris)
//
// Kolom INBOUND_HVS:
//   - Baris LABEL : TUJUAN_(FROM)  ← bold biru
//   - Baris AWB   : nomor AWB
//   - Kolom DATE setelahnya = tanggal record IB (mirror per baris)
// ═══════════════════════════════════════════════════════════════

function renderObibPage() {
  var wrap = document.getElementById('obibTableWrap');
  wrap.innerHTML = '<div class="empty-state"><span class="material-icons-round">hourglass_empty</span>Memuat...</div>';

  if (_obibData) {
    _buildObibFlatTable(_obibData);
    return;
  }

  showLoading('Memuat OB & IB...');
  gasGet('getOBIB').then(function (res) {
    hideLoading();
    if (res.error) {
      wrap.innerHTML = '<div class="empty-state"><span class="material-icons-round">error</span>' + escH(res.error) + '</div>';
      return;
    }
    _obibData = res;
    _buildObibFlatTable(_obibData);
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
  if (_obibData) _buildObibFlatTable(_obibData);
}

/* ── Core render ── */
function _buildObibFlatTable(data) {
  var wrap = document.getElementById('obibTableWrap');

  var colDefs    = data.colDefs    || [];
  var ibSections = data.ibSections || [];
  var headerR1   = data.headerR1   || [];
  var headerR2   = data.headerR2   || [];
  var headerR3   = data.headerR3   || [];
  var headerR4   = data.headerR4   || [];

  var filter = (document.getElementById('obibSearch').value || '').toLowerCase().trim();

  if (!colDefs.length) {
    wrap.innerHTML = '<div class="empty-state"><span class="material-icons-round">inbox</span>Tidak ada kolom di sheet OB&IB</div>';
    return;
  }

  var nCols = colDefs.length;

  // ── Lookup IB sections per "SERVICE|TUJUAN_KOTA" ──
  // r3 = service, r1 = kota/tujuan di colDef INBOUND_HVS
  var ibMap = {};
  ibSections.forEach(function (sec) {
    var k = (sec.service || '').toUpperCase() + '|' + (sec.tujuan || '').toUpperCase();
    if (!ibMap[k]) ibMap[k] = [];
    ibMap[k].push(sec);
  });

  // ── Build flat row arrays per kolom ──
  // flatCol[ci] = array of { cellType, text, date }
  //   cellType: 'AWB' | 'LABEL' | 'EMPTY'
  //   Untuk DATE kolom: { cellType:'DATE_VAL'|'DATE_EMPTY', text, date }
  var flatCol = [];

  for (var ci = 0; ci < nCols; ci++) {
    var def = colDefs[ci];
    var ct  = (def.colType || '').toUpperCase();

    if (ct === 'OUTBOUND' || ct === 'OUTBOUND_HVS') {
      // entries dari backend (flatRows atau entries)
      var rawEntries = def.entries && def.entries.length ? def.entries : (def.flatRows || []);
      var rows = [];
      rawEntries.forEach(function (e) {
        var awbText = e.awb || e.text || '';
        var dateText = e.date || '';
        if (!awbText) return;
        // filter
        if (filter && awbText.toLowerCase().indexOf(filter) === -1 && dateText.toLowerCase().indexOf(filter) === -1) return;
        rows.push({ cellType: 'AWB', text: awbText, date: dateText });
      });
      flatCol.push(rows);

    } else if (ct === 'INBOUND_HVS') {
      // Cari IB sections yang match r3 (service) + r1 (kota tujuan)
      var k    = (def.r3 || '').toUpperCase() + '|' + (def.r1 || '').toUpperCase();
      var secs = (ibMap[k] || []).slice();

      // filter
      if (filter) {
        secs = secs.filter(function (sec) {
          var label = (sec.tujuan || '') + (sec.from ? '_(' + sec.from + ')' : '');
          if (label.toLowerCase().indexOf(filter) !== -1) return true;
          if ((sec.service || '').toLowerCase().indexOf(filter) !== -1) return true;
          if ((sec.date || '').toLowerCase().indexOf(filter) !== -1) return true;
          return (sec.awbs || []).some(function (a) {
            return (a.awb || a || '').toLowerCase().indexOf(filter) !== -1;
          });
        });
      }

      var ibRows = [];
      secs.forEach(function (sec) {
        var label = (sec.tujuan || '') + (sec.from ? '_(' + sec.from + ')' : '');
        var awbs  = sec.awbs || [];
        var date  = sec.date || '';

        // Baris label (TUJUAN_(FROM))
        ibRows.push({ cellType: 'LABEL', text: label, date: date });

        // Baris per AWB
        if (awbs.length) {
          awbs.forEach(function (a) {
            ibRows.push({ cellType: 'AWB', text: a.awb || a || '', date: date });
          });
        }
        // (Jika tidak ada AWB, hanya label saja yang tampil)
      });

      flatCol.push(ibRows);

    } else if (ct === 'DATE') {
      flatCol.push(null); // Diisi setelah semua kolom selesai

    } else {
      flatCol.push([]);
    }
  }

  // ── Isi kolom DATE berdasarkan kolom data sebelumnya ──
  for (var ci = 0; ci < nCols; ci++) {
    if (flatCol[ci] !== null) continue; // bukan placeholder DATE

    // Cari kolom data terdekat di kiri dalam grup r1 yang sama
    var prevCi = -1;
    for (var ci2 = ci - 1; ci2 >= 0; ci2--) {
      if ((colDefs[ci2].r1 || '') !== (colDefs[ci].r1 || '')) break;
      if (flatCol[ci2] !== null) { prevCi = ci2; break; }
    }

    if (prevCi === -1) { flatCol[ci] = []; continue; }

    var prevCt   = (colDefs[prevCi].colType || '').toUpperCase();
    var prevRows = flatCol[prevCi] || [];

    if (prevCt === 'INBOUND_HVS') {
      // DATE mirror: setiap baris IB (LABEL atau AWB) → tampilkan datenya
      flatCol[ci] = prevRows.map(function (r) {
        return { cellType: 'DATE_VAL', text: r.date || '', date: r.date || '' };
      });
    } else {
      // OUTBOUND / HVS: setiap baris AWB → tampilkan datenya (per baris!)
      flatCol[ci] = prevRows.map(function (r) {
        return { cellType: 'DATE_VAL', text: r.date || '', date: r.date || '' };
      });
    }
  }

  // ── Hitung maxRows ──
  var maxRows = 0;
  flatCol.forEach(function (arr) {
    if (arr && arr.length > maxRows) maxRows = arr.length;
  });
  if (!maxRows) maxRows = 1;

  // ── Helper: build merged header row ──
  function buildMergedHdrRow(hArr, cellClass) {
    var cells = [], i = 0;
    while (i < nCols) {
      var val  = (hArr[i] || '').toString();
      var span = 1;
      while (i + span < nCols && !(hArr[i + span] || '').toString().trim()) span++;
      cells.push({ val: val, span: span });
      i += span;
    }
    return '<tr>' +
      '<th class="obib-rn" style="position:sticky;left:0;z-index:8"></th>' +
      cells.map(function (c) {
        return '<th colspan="' + c.span + '" class="' + cellClass + '">' + escH(c.val) + '</th>';
      }).join('') +
      '</tr>';
  }

  // ── Row 4: tipe kolom ──
  function typeClass(t) {
    t = (t || '').toUpperCase();
    if (t === 'OUTBOUND')     return 'outbound';
    if (t === 'OUTBOUND_HVS') return 'outbound-hvs';
    if (t === 'INBOUND_HVS')  return 'inbound-hvs';
    if (t === 'DATE')         return 'date';
    return '';
  }

  var hdr4 = '<tr>' +
    '<th class="obib-rn" style="position:sticky;left:0;z-index:8">#</th>' +
    colDefs.map(function (c) {
      return '<th class="obib-hdr-type ' + typeClass(c.colType) + '">' + escH(c.colType || '—') + '</th>';
    }).join('') +
    '</tr>';

  // ── Build tbody ──
  var tbodyHtml = '';
  for (var ri = 0; ri < maxRows; ri++) {
    tbodyHtml += '<tr>';
    tbodyHtml += '<td class="obib-rn">' + (ri + 1) + '</td>';

    for (var ci = 0; ci < nCols; ci++) {
      var arr  = flatCol[ci] || [];
      var def  = colDefs[ci];
      var ct   = (def.colType || '').toUpperCase();
      var row  = ri < arr.length ? arr[ri] : null;

      if (!row) {
        // Sel kosong
        if (ct === 'DATE') {
          tbodyHtml += '<td style="background:#FFFDE7;min-width:150px;border:1px solid var(--gray3)"></td>';
        } else {
          tbodyHtml += '<td style="min-width:' + (ct === 'INBOUND_HVS' ? '160' : '130') + 'px;background:var(--gray0);border:1px solid var(--gray3)"></td>';
        }
        continue;
      }

      if (ct === 'DATE') {
        // Kolom DATE: tampilkan tanggal dari baris yang bersesuaian
        if (row.text) {
          tbodyHtml += '<td style="padding:4px 8px;font-size:11px;font-family:var(--mono);color:var(--gray6);background:#FFFDE7;min-width:150px;border:1px solid var(--gray3);white-space:nowrap">' + escH(row.text) + '</td>';
        } else {
          tbodyHtml += '<td style="background:#FFFDE7;min-width:150px;border:1px solid var(--gray3)"></td>';
        }

      } else if (ct === 'INBOUND_HVS') {
        if (row.cellType === 'LABEL') {
          // Baris label TUJUAN_(FROM) — bold biru, background berbeda
          tbodyHtml += '<td style="padding:4px 10px;font-size:12px;font-weight:700;font-family:var(--mono);color:var(--blue2);background:#EEF6FF;min-width:160px;border:1px solid var(--gray3);border-left:3px solid var(--blue-mid);white-space:nowrap">' + escH(row.text) + '</td>';
        } else if (row.cellType === 'AWB') {
          tbodyHtml += '<td style="padding:4px 10px;font-size:12px;font-family:var(--mono);color:var(--gray7);background:#F0FDF4;min-width:160px;border:1px solid var(--gray3);white-space:nowrap">' + escH(row.text) + '</td>';
        } else {
          tbodyHtml += '<td style="min-width:160px;background:var(--gray0);border:1px solid var(--gray3)"></td>';
        }

      } else if (ct === 'OUTBOUND' || ct === 'OUTBOUND_HVS') {
        if (row.cellType === 'AWB' && row.text) {
          var bgColor = ct === 'OUTBOUND_HVS' ? '#FAF5FF' : '#fff';
          var txColor = ct === 'OUTBOUND_HVS' ? 'var(--purple)' : 'var(--gray8)';
          tbodyHtml += '<td style="padding:4px 8px;font-size:12px;font-family:var(--mono);color:' + txColor + ';background:' + bgColor + ';min-width:130px;border:1px solid var(--gray3);white-space:nowrap" title="' + escH(row.text) + '">' + escH(row.text) + '</td>';
        } else {
          tbodyHtml += '<td style="min-width:130px;background:var(--gray0);border:1px solid var(--gray3)"></td>';
        }

      } else {
        tbodyHtml += row.text
          ? '<td style="padding:4px 8px;font-size:12px;font-family:var(--mono);border:1px solid var(--gray3)">' + escH(row.text) + '</td>'
          : '<td style="border:1px solid var(--gray3)"></td>';
      }
    }

    tbodyHtml += '</tr>';
  }

  var html =
    '<table class="obib-table">' +
    '<thead>' +
      buildMergedHdrRow(headerR1, 'obib-hdr-incharge') +
      buildMergedHdrRow(headerR2, 'obib-hdr-kota') +
      buildMergedHdrRow(headerR3, 'obib-hdr-service') +
      hdr4 +
    '</thead>' +
    '<tbody>' + tbodyHtml + '</tbody>' +
    '</table>';

  wrap.innerHTML = html;
}

/* ── Export OB&IB CSV ── */
function exportObibCSV() {
  if (!_obibData) { toast('Muat data dulu', 'error'); return; }

  var colDefs    = _obibData.colDefs    || [];
  var ibSections = _obibData.ibSections || [];
  var ibMap = {};
  ibSections.forEach(function (sec) {
    var k = (sec.service || '').toUpperCase() + '|' + (sec.tujuan || '').toUpperCase();
    if (!ibMap[k]) ibMap[k] = [];
    ibMap[k].push(sec);
  });

  var rows = [['TYPE', 'INCHARGE', 'KOTA', 'SERVICE', 'TUJUAN', 'FROM', 'DATE', 'AWB']];

  colDefs.forEach(function (def) {
    var ct = (def.colType || '').toUpperCase();
    if (ct === 'DATE') return;

    if (ct === 'OUTBOUND' || ct === 'OUTBOUND_HVS') {
      var entries = def.entries && def.entries.length ? def.entries : (def.flatRows || []);
      entries.forEach(function (e) {
        var awb = e.awb || e.text || '';
        if (!awb) return;
        rows.push([ct, def.r1, def.r1, def.r3, def.r1, '', e.date || '', awb]);
      });
    } else if (ct === 'INBOUND_HVS') {
      var k    = (def.r3 || '').toUpperCase() + '|' + (def.r1 || '').toUpperCase();
      var secs = ibMap[k] || [];
      secs.forEach(function (sec) {
        var label = (sec.tujuan || '') + (sec.from ? '_(' + sec.from + ')' : '');
        rows.push([ct + '_LABEL', sec.incharge || def.r1, def.r1, def.r3, sec.tujuan || '', sec.from || '', sec.date || '', label]);
        (sec.awbs || []).forEach(function (a) {
          rows.push([ct + '_AWB', sec.incharge || def.r1, def.r1, def.r3, sec.tujuan || '', sec.from || '', sec.date || '', a.awb || a || '']);
        });
      });
    }
  });

  _downloadCSV(rows, 'OBIB_export_' + _dateStr() + '.csv');
}

// ═══════════════════════════════════════════════════════════════
// MANIFEST PAGE
// ═══════════════════════════════════════════════════════════════

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
  _mfLoaded = false; _mfData = null; _mfSelRow = -1; _mfSelCol = -1;
  showLoading('Refresh manifest...');
  gasGet('getManifestData').then(function (res) {
    hideLoading();
    if (res.error) { toast('Error: ' + res.error, 'error'); return; }
    _mfData = res; _mfLoaded = true;
    renderManifestSheet(); setupMfKeyboard();
    toast('Manifest diperbarui', 'success');
  }).catch(function (e) { hideLoading(); toast('Error: ' + e.message, 'error'); });
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
  var filteredAwbRows = awbRows;
  if (fq) {
    filteredAwbRows = awbRows.filter(function (row) {
      return row.some(function (cell) { return (cell || '').toLowerCase().indexOf(fq) !== -1; });
    });
  }
  _mfFilteredRows = filteredAwbRows;

  var incSet  = {};
  colDefs.forEach(function (c) { if (c.incharge) incSet[c.incharge] = true; });
  var tujCols = colDefs.filter(function (c) { return !c.isDate && c.tujuan; });
  var totalAwb = tujCols.reduce(function (s, c) {
    return s + awbRows.filter(function (r) { return r[c.colIdx] && r[c.colIdx].trim(); }).length;
  }, 0);
  document.getElementById('mfTotalCols').innerText = tujCols.length;
  document.getElementById('mfTotalAwb').innerText  = totalAwb;
  document.getElementById('mfTotalInc').innerText  = Object.keys(incSet).length;

  var nCols = totalCols;

  function buildSpannedRow(hArr, cellClass) {
    var cells = [], i = 0;
    while (i < nCols) {
      var val = hArr[i] || '';
      if (!val) { cells.push({ val: '', span: 1 }); i++; continue; }
      var span = 1;
      while (i + span < nCols && (!hArr[i + span] || hArr[i + span] === '')) span++;
      cells.push({ val: val, span: span }); i += span;
    }
    return '<tr><th class="mf-rn" style="z-index:5">#</th>' +
      cells.map(function (c) { return '<th colspan="' + c.span + '" class="' + cellClass + '">' + escH(c.val) + '</th>'; }).join('') +
    '</tr>';
  }

  var row0Html = buildSpannedRow(hRows[0] || [], 'mf-hdr-incharge');
  var row1Html = buildSpannedRow(hRows[1] || [], 'mf-hdr-service');
  var row2Html = '<tr><th class="mf-rn">—</th>' +
    colDefs.map(function (c) {
      return c.isDate
        ? '<th class="mf-hdr-date">DATE</th>'
        : '<th class="mf-hdr-tujuan">' + escH(c.tujuan) + '</th>';
    }).join('') + '</tr>';

  var dataHtml = filteredAwbRows.length
    ? filteredAwbRows.map(function (row, ri) {
        return '<tr class="mf-data-row" data-ri="' + ri + '">' +
          '<td class="mf-rn">' + (ri + 1) + '</td>' +
          colDefs.map(function (c, ci) {
            var val   = row[c.colIdx] || '';
            var isSel = (_mfSelRow === ri && _mfSelCol === ci);
            var sel   = isSel ? ' mf-cell-selected' : '';
            if (c.isDate) return '<td class="mf-cell-date' + sel + '" data-ci="' + ci + '" data-ri="' + ri + '" onclick="mfSelectCell(' + ri + ',' + ci + ')">' + escH(val) + '</td>';
            if (!val)     return '<td class="mf-cell-empty' + sel + '" data-ci="' + ci + '" data-ri="' + ri + '" onclick="mfSelectCell(' + ri + ',' + ci + ')"></td>';
            return '<td class="mf-cell-awb' + sel + '" data-ci="' + ci + '" data-ri="' + ri + '" onclick="mfSelectCell(' + ri + ',' + ci + ')" title="' + escH(val) + '">' + escH(val) + '</td>';
          }).join('') + '</tr>';
      }).join('')
    : '<tr><td class="mf-rn" style="color:var(--gray5)">—</td>' +
      '<td colspan="' + (nCols || 1) + '" style="text-align:center;padding:20px;color:var(--gray5);font-size:12px">Tidak ada data AWB</td></tr>';

  var tableHtml = '<table class="mf-table"><thead>' + row0Html + row1Html + row2Html + '</thead><tbody>' + dataHtml + '</tbody></table>';
  document.getElementById('mfSheetOuter').innerHTML = tableHtml;
  updateMfActiveCellLabel();
}

function mfSelectCell(ri, ci) {
  _mfSelRow = ri; _mfSelCol = ci;
  document.querySelectorAll('.mf-cell-selected').forEach(function (el) { el.classList.remove('mf-cell-selected'); });
  var target = document.querySelector('[data-ri="' + ri + '"][data-ci="' + ci + '"]');
  if (target) { target.classList.add('mf-cell-selected'); target.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  updateMfActiveCellLabel();
  document.getElementById('mfSheetOuter').focus();
}

function updateMfActiveCellLabel() {
  var el = document.getElementById('mfActiveCell');
  if (!el) return;
  if (_mfSelRow < 0 || _mfSelCol < 0 || !_mfData) { el.innerText = '—'; return; }
  var row = _mfFilteredRows[_mfSelRow];
  var c   = (_mfData.colDefs || [])[_mfSelCol];
  if (!row || !c) { el.innerText = '—'; return; }
  el.innerText = row[c.colIdx] || '(kosong)';
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
    else if (e.key === 'ArrowUp')    { e.preventDefault(); _mfSelRow = Math.max(_mfSelRow - 1, 0);          moved = true; }
    else if (e.key === 'ArrowRight') { e.preventDefault(); _mfSelCol = Math.min(_mfSelCol + 1, nCols - 1); moved = true; }
    else if (e.key === 'ArrowLeft')  { e.preventDefault(); _mfSelCol = Math.max(_mfSelCol - 1, 0);          moved = true; }
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
  var row = _mfFilteredRows[_mfSelRow];
  var c   = (_mfData.colDefs || [])[_mfSelCol];
  if (!row || !c) return;
  var val = row[c.colIdx] || '';
  if (!val) { toast('Sel kosong', 'error'); return; }
  navigator.clipboard.writeText(val).then(function () { showCopyFlash(val); }).catch(function () {
    var ta = document.createElement('textarea');
    ta.value = val; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); showCopyFlash(val); } catch (ex) { toast('Gagal copy', 'error'); }
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
  var colDefs = _mfData.colDefs || [], awbRows = _mfData.awbRows || [], hRows = _mfData.headerRows || [];
  if (!colDefs.length) { toast('Tidak ada data manifest', 'error'); return; }
  var h0 = hRows[0] || [], h1 = hRows[1] || [], h2 = hRows[2] || [];
  var csvRows = [];
  csvRows.push(['#'].concat(h0).map(function (v) { return '"' + v + '"'; }).join(','));
  csvRows.push([''].concat(h1).map(function (v) { return '"' + v + '"'; }).join(','));
  csvRows.push([''].concat(h2).map(function (v) { return '"' + v + '"'; }).join(','));
  awbRows.forEach(function (row, i) {
    csvRows.push(['"' + (i + 1) + '"'].concat(row.map(function (c) { return '"' + (c || '') + '"'; })).join(','));
  });
  _downloadCSV(csvRows.join('\n'), 'manifest_export_' + _dateStr() + '.csv');
}

// ═══════════════════════════════════════════════════════════════
// SEARCH AWB
// ═══════════════════════════════════════════════════════════════

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
  var results = allScanAwbs.filter(function (item) {
    return (item.awb || '').toLowerCase().indexOf(ql) !== -1;
  });

  hdr.innerHTML = '<span class="material-icons-round">' + (results.length ? 'check_circle' : 'search_off') + '</span> ' +
    (results.length
      ? results.length + ' hasil ditemukan untuk "' + escH(q) + '"'
      : 'Tidak ada hasil untuk "' + escH(q) + '"');

  if (!results.length) {
    // Fallback ke server
    body.innerHTML = '<div class="search-awb-empty"><span class="material-icons-round">hourglass_empty</span>Mencari di server...</div>';
    gasGet('searchAwb', { q: q }).then(function (res) {
      var list = res.list || [];
      hdr.innerHTML = '<span class="material-icons-round">' + (list.length ? 'check_circle' : 'search_off') + '</span> ' +
        (list.length ? list.length + ' hasil untuk "' + escH(q) + '"' : 'AWB tidak ditemukan');
      body.innerHTML = list.length
        ? list.map(function (r) { return _searchAwbItem(r, q); }).join('')
        : '<div class="search-awb-empty"><span class="material-icons-round">search_off</span>AWB tidak ditemukan di semua data OB, HVS, dan IB</div>';
    }).catch(function () {
      body.innerHTML = '<div class="search-awb-empty"><span class="material-icons-round">search_off</span>AWB tidak ditemukan</div>';
    });
    return;
  }

  body.innerHTML = results.map(function (r) { return _searchAwbItem(r, q); }).join('');
}

function _searchAwbItem(r, q) {
  var typeLabel = r.type === 'OB' || r.type === 'ob' ? 'Outbound BDO' : r.type === 'HVS' || r.type === 'hvs' ? 'Outbound HVS' : 'Inbound HVS';
  var typeKey   = (r.type || '').toLowerCase();
  var icon      = typeKey === 'ob' ? 'local_shipping' : typeKey === 'hvs' ? 'inventory_2' : 'move_to_inbox';
  var highlighted = escH(r.awb).replace(new RegExp('(' + escRegex(escH(q)) + ')', 'gi'), '<mark>$1</mark>');
  return '<div class="search-awb-item">' +
    '<div class="search-awb-item-icon ' + typeKey + '"><span class="material-icons-round">' + icon + '</span></div>' +
    '<div class="search-awb-item-main">' +
      '<div class="search-awb-item-awb">' + highlighted + '</div>' +
      '<div class="search-awb-item-meta">' +
        '<span class="search-awb-type-tag ' + typeKey + '">' + typeLabel + '</span>' +
        '<span>' + escH(r.incharge || '—') + '</span>' +
        '<span>•</span><span>' + escH(r.service || '—') + '</span>' +
        '<span>•</span><span>→ ' + escH(r.tujuan || '—') + '</span>' +
        (r.from ? '<span>• FROM: ' + escH(r.from) + '</span>' : '') +
        '<span>•</span><span style="color:var(--gray4)">' + escH(r.date || '') + '</span>' +
      '</div>' +
      '<div style="margin-top:3px">NO TRACK: <span class="search-awb-item-notrack" onclick="openDetailModal(\'' + typeKey + '\',\'' + escQ(r.noTrack) + '\')">' + escH(r.noTrack || '') + '</span></div>' +
    '</div>' +
  '</div>';
}

function clearSearchAwb() {
  document.getElementById('searchAwbMainInput').value = '';
  doSearchAwb('');
}

// ─── SIDEBAR SEARCH ───
function handleSidebarSearch(e) {
  if (e.key !== 'Enter') return;
  var q = document.getElementById('sidebarSearchInput').value.trim();
  if (!q) return;
  switchPage('search');
  document.getElementById('searchAwbMainInput').value = q;
  doSearchAwb(q);
  document.getElementById('sidebarSearchInput').value = '';
}

// ═══════════════════════════════════════════════════════════════
// EXPORT CSV
// ═══════════════════════════════════════════════════════════════

function exportCSV() {
  var pages = ['ob', 'hvs', 'ib', 'manifest', 'obib'];
  var active = '';
  pages.forEach(function (p) {
    var el = document.getElementById('page-' + p);
    if (el && el.style.display !== 'none') active = p;
  });
  if      (active === 'ob')       _exportListCSV(filteredData(obData),  ['no_track','incharge','service','tujuan','created_date','status','total_awb'], 'outbound_bdo_' + _dateStr() + '.csv');
  else if (active === 'hvs')      _exportListCSV(filteredData(hvsData), ['no_track','incharge','service','tujuan','created_date','status','total_awb'], 'outbound_hvs_' + _dateStr() + '.csv');
  else if (active === 'ib')       _exportListCSV(filteredData(ibData),  ['no_track','incharge','service','from','tujuan','created_date','status','total_awb'], 'inbound_hvs_' + _dateStr() + '.csv');
  else if (active === 'manifest') exportManifestCSV();
  else if (active === 'obib')     exportObibCSV();
  else toast('Tidak ada data untuk diexport', 'error');
}

function _exportListCSV(data, headers, filename) {
  var rows = [headers];
  data.forEach(function (r) { rows.push(headers.map(function (h) { return r[h] !== undefined ? r[h] : ''; })); });
  _downloadCSV(rows, filename);
}

function _downloadCSV(rows, filename) {
  var csv;
  if (typeof rows === 'string') {
    csv = rows;
  } else {
    csv = rows.map(function (r) {
      return r.map(function (c) {
        var s = (c === null || c === undefined) ? '' : String(c);
        if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
      }).join(',');
    }).join('\r\n');
  }
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
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
