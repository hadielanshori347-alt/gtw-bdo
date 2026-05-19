/* ============================================================
   GTW BDO — views.js v4.8
   FIX: Header Row3 (KOTA) merge persis GSheet — DATE kolom tidak ikut merge
   FIX: INBOUND_HVS DATE terisi di semua baris AWB (bukan hanya IB_LABEL)
   ============================================================ */

window.addEventListener('DOMContentLoaded', function () {
  showLoading('Memuat data...');
  gasGet('getMasterData').then(function (r) {
    masterData = r || {};
    populateGlobalIncharge();
    buildCbOptions();
    initAllCbs();
    return Promise.all([gasGet('getObList'), gasGet('getHvsList'), gasGet('getIbList')]);
  }).then(function (results) {
    obData  = results[0].list || [];
    hvsData = results[1].list || [];
    ibData  = results[2].list || [];
    renderObTable(); renderHvsTable(); renderIbTable();
    updateObStats(); updateHvsStats(); updateIbStats();
    buildAllScanAwbs();
    hideLoading();
  }).catch(function (e) { hideLoading(); toast('Gagal memuat data: ' + e.message, 'error'); });
});

function reloadAll() {
  showLoading('Memuat ulang...');
  _mfLoaded = false; _obibData = null;
  Promise.all([gasGet('getObList'), gasGet('getHvsList'), gasGet('getIbList')])
    .then(function (results) {
      obData  = results[0].list || [];
      hvsData = results[1].list || [];
      ibData  = results[2].list || [];
      renderObTable(); renderHvsTable(); renderIbTable();
      updateObStats(); updateHvsStats(); updateIbStats();
      buildAllScanAwbs(); hideLoading();
      toast('Data diperbarui', 'success');
    }).catch(function (e) { hideLoading(); toast('Gagal reload: ' + e.message, 'error'); });
}

function buildAllScanAwbs() {
  gasGet('getAllScanAwbs').then(function (r) { if (r && r.list) allScanAwbs = r.list; }).catch(function () {});
}

// ═══════════════════════════════════════════════════════════════════
// OB & IB COMBINED VIEW v4.8
//
// Struktur GSheet (persis):
//   Row1: INCHARGE (merged span)
//   Row2: SERVICE  (merged span)
//   Row3: KOTA     (merged per grup, DATE kolom = cell kosong sendiri)
//   Row4: DATE | OUTBOUND | DATE | OUTBOUND_HVS | DATE | INBOUND_HVS | DATE
//
// FIX v4.8:
//   - Row3 KOTA: DATE kolom (r3 kosong) render sendiri colspan=1, tidak ikut merge
//   - INBOUND_HVS DATE: semua baris AWB terisi date masing-masing
// ═══════════════════════════════════════════════════════════════════

function renderObibPage() {
  var wrap = document.getElementById('obibTableWrap');
  wrap.innerHTML = '<div class="empty-state"><span class="material-icons-round">hourglass_empty</span>Memuat...</div>';
  if (_obibData) { _buildObibTable(_obibData); return; }
  showLoading('Memuat OB & IB...');
  gasGet('getOBIB').then(function (res) {
    hideLoading();
    if (res.error) { wrap.innerHTML = '<div class="empty-state"><span class="material-icons-round">error</span>' + escH(res.error) + '</div>'; return; }
    _obibData = res;
    _buildObibTable(_obibData);
  }).catch(function (e) {
    hideLoading();
    wrap.innerHTML = '<div class="empty-state"><span class="material-icons-round">error</span>' + escH(e.message) + '</div>';
  });
}

function reloadObib() { _obibData = null; renderObibPage(); }
function filterObib()  { if (_obibData) _buildObibTable(_obibData); }

// ─── Core builder ───
function _buildObibTable(data) {
  var wrap = document.getElementById('obibTableWrap');
  var colDefs    = data.colDefs    || [];
  var ibSections = data.ibSections || [];
  var filter     = (document.getElementById('obibSearch').value || '').toLowerCase().trim();

  if (!colDefs.length) {
    wrap.innerHTML = '<div class="empty-state"><span class="material-icons-round">inbox</span>Tidak ada kolom</div>';
    return;
  }

  var nCols = colDefs.length;

  // ── ibMap: key = SERVICE(r2)|FROM-kota(r3) → array of sections ──
  var ibMap = {};
  ibSections.forEach(function (sec) {
    var k = (sec.service || '').toUpperCase() + '|' + (sec.from || '').toUpperCase();
    if (!ibMap[k]) ibMap[k] = [];
    ibMap[k].push(sec);
  });

  // ── Build flatRows per kolom ──
  var flatCol = [];
  for (var ci = 0; ci < nCols; ci++) { flatCol.push(null); }

  for (var ci = 0; ci < nCols; ci++) {
    var def = colDefs[ci];
    var ct  = (def.colType || '').toUpperCase();

    if (ct === 'OUTBOUND' || ct === 'OUTBOUND_HVS') {
      var entries = def.entries && def.entries.length ? def.entries : (def.flatRows || []);
      var rows = [];
      entries.forEach(function (e) {
        var awb = e.awb || e.text || '';
        if (!awb) return;
        if (filter && awb.toLowerCase().indexOf(filter) === -1) return;
        rows.push({ cellType: 'AWB', text: awb, date: e.date || '' });
      });
      flatCol[ci] = rows;
      continue;
    }

    if (ct === 'INBOUND_HVS') {
      var k    = (def.r2 || '').toUpperCase() + '|' + (def.r3 || '').toUpperCase();
      var secs = ibMap[k] || [];
      if (!secs.length && def.ibSections && def.ibSections.length) { secs = def.ibSections; }

      var tujOrder  = [];
      var tujGroups = {};
      var tujDate   = {};

      secs.forEach(function (sec) {
        var awbList = sec.awbs || [];
        if (!awbList.length && sec.tujuan) {
          var t = sec.tujuan;
          if (!tujGroups[t]) { tujGroups[t] = []; tujOrder.push(t); tujDate[t] = sec.date || ''; }
          return;
        }
        awbList.forEach(function (a) {
          var tuj = a.tujuan || sec.tujuan || '';
          var awb = a.awb || '';
          var dt  = a.date || sec.date || '';
          if (!awb) return;
          if (filter) {
            if (awb.toLowerCase().indexOf(filter) === -1 &&
                tuj.toLowerCase().indexOf(filter) === -1 &&
                dt.indexOf(filter) === -1) return;
          }
          if (!tujGroups[tuj]) { tujGroups[tuj] = []; tujOrder.push(tuj); tujDate[tuj] = dt; }
          tujGroups[tuj].push({ awb: awb, date: dt });
        });
      });

      var ibRows = [];
      tujOrder.forEach(function (tuj) {
        var awbs = tujGroups[tuj] || [];
        var ld   = tujDate[tuj] || (awbs.length ? awbs[0].date : '');
        ibRows.push({ cellType: 'IB_LABEL', text: tuj, date: ld });
        awbs.forEach(function (a) {
          ibRows.push({ cellType: 'AWB', text: a.awb, date: a.date });
        });
      });

      flatCol[ci] = ibRows;
      continue;
    }

    if (ct === 'DATE') { flatCol[ci] = null; continue; }

    flatCol[ci] = [];
  }

  // ── Isi kolom DATE dari kolom AWB pasangannya ──
  for (var ci = 0; ci < nCols; ci++) {
    if (flatCol[ci] !== null) continue;

    var srcCi = -1;
    // Cari sumber di KANAN dalam grup r1 yang sama
    for (var j = ci + 1; j < nCols; j++) {
      if ((colDefs[j].r1 || '') !== (colDefs[ci].r1 || '')) break;
      var jct = (colDefs[j].colType || '').toUpperCase();
      if (jct !== 'DATE' && flatCol[j] !== null) { srcCi = j; break; }
    }
    // Fallback: cari di KIRI
    if (srcCi === -1) {
      for (var j = ci - 1; j >= 0; j--) {
        if ((colDefs[j].r1 || '') !== (colDefs[ci].r1 || '')) break;
        var jct = (colDefs[j].colType || '').toUpperCase();
        if (jct !== 'DATE' && flatCol[j] !== null) { srcCi = j; break; }
      }
    }

    if (srcCi === -1) { flatCol[ci] = []; continue; }

    var srcCt = (colDefs[srcCi].colType || '').toUpperCase();

    // ── FIX v4.8: Mirror date ──
    flatCol[ci] = (flatCol[srcCi] || []).map(function (r) {
      if (srcCt === 'INBOUND_HVS') {
        // IB_LABEL → date label grup
        if (r.cellType === 'IB_LABEL') {
          return r.date ? { cellType: 'DATE_VAL', text: r.date, date: r.date } : { cellType: 'DATE_EMPTY', text: '', date: '' };
        }
        // AWB di bawah IB_LABEL → FIX: tampilkan date AWB itu sendiri
        if (r.cellType === 'AWB') {
          return r.date ? { cellType: 'DATE_VAL', text: r.date, date: r.date } : { cellType: 'DATE_EMPTY', text: '', date: '' };
        }
        return { cellType: 'DATE_EMPTY', text: '', date: '' };
      }
      // OUTBOUND / OUTBOUND_HVS → setiap AWB tampilkan date-nya
      if (r.cellType === 'AWB') {
        return r.date ? { cellType: 'DATE_VAL', text: r.date, date: r.date } : { cellType: 'DATE_EMPTY', text: '', date: '' };
      }
      return { cellType: 'DATE_EMPTY', text: '', date: '' };
    });
  }

  // ── maxRows ──
  var maxRows = 0;
  flatCol.forEach(function (arr) { if (arr && arr.length > maxRows) maxRows = arr.length; });

  // ── renderOrder ──
  var renderOrder = [];
  for (var ci = 0; ci < nCols; ci++) { renderOrder.push(ci); }
  var nRender = renderOrder.length;

  // ── Row 1: INCHARGE — group by r1 ──
  var hdrR1 = (function() {
    var cells = [], i = 0;
    while (i < nRender) {
      var ci  = renderOrder[i];
      var val = colDefs[ci].r1 || '';
      var span = 1;
      while (i + span < nRender && (colDefs[renderOrder[i + span]].r1 || '') === val) span++;
      cells.push({ val: val, span: span }); i += span;
    }
    return '<tr><th class="obib-rn" style="position:sticky;left:0;z-index:8;background:var(--gray2)"></th>' +
      cells.map(function(c) { return '<th colspan="' + c.span + '" class="obib-hdr-incharge">' + escH(c.val) + '</th>'; }).join('') + '</tr>';
  })();

  // ── Row 2: SERVICE — group by r1+r2 ──
  var hdrR2 = (function() {
    var cells = [], i = 0;
    while (i < nRender) {
      var ci   = renderOrder[i];
      var key  = (colDefs[ci].r1 || '') + '|||' + (colDefs[ci].r2 || '');
      var val  = colDefs[ci].r2 || '';
      var span = 1;
      while (i + span < nRender) {
        var nci  = renderOrder[i + span];
        var nkey = (colDefs[nci].r1 || '') + '|||' + (colDefs[nci].r2 || '');
        if (nkey === key) span++; else break;
      }
      cells.push({ val: val, span: span }); i += span;
    }
    return '<tr><th class="obib-rn" style="position:sticky;left:0;z-index:8;background:var(--gray2)"></th>' +
      cells.map(function(c) { return '<th colspan="' + c.span + '" class="obib-hdr-service">' + escH(c.val) + '</th>'; }).join('') + '</tr>';
  })();

  // ── Row 3: KOTA — FIX v4.8 ──
  // DATE kolom (r3 kosong) = cell kosong sendiri, TIDAK ikut merge grup KOTA
  // Non-DATE merge selama r1+r2+r3 sama DAN tidak melewati DATE kolom
  var hdrR3 = (function() {
    var cells = [], i = 0;
    while (i < nRender) {
      var ci  = renderOrder[i];
      var ct  = (colDefs[ci].colType || '').toUpperCase();
      var val = colDefs[ci].r3 || '';

      // DATE kolom atau r3 kosong → render sendiri colspan=1
      if (ct === 'DATE' || !val) {
        cells.push({ val: val, span: 1 });
        i++;
        continue;
      }

      // Non-DATE dengan r3 berisi → merge selama key r1+r2+r3 sama dan bukan DATE
      var key  = (colDefs[ci].r1 || '') + '|||' + (colDefs[ci].r2 || '') + '|||' + val;
      var span = 1;
      while (i + span < nRender) {
        var nci  = renderOrder[i + span];
        var nct  = (colDefs[nci].colType || '').toUpperCase();
        if (nct === 'DATE') break; // stop di DATE kolom
        var nkey = (colDefs[nci].r1 || '') + '|||' + (colDefs[nci].r2 || '') + '|||' + (colDefs[nci].r3 || '');
        if (nkey === key) span++; else break;
      }
      cells.push({ val: val, span: span }); i += span;
    }
    return '<tr><th class="obib-rn" style="position:sticky;left:0;z-index:8;background:var(--gray2)"></th>' +
      cells.map(function(c) { return '<th colspan="' + c.span + '" class="obib-hdr-kota">' + escH(c.val) + '</th>'; }).join('') + '</tr>';
  })();

  // ── Row 4: TYPE — tidak di-merge ──
  function typeClass(t) {
    t = (t || '').toUpperCase();
    return t === 'OUTBOUND' ? 'outbound' : t === 'OUTBOUND_HVS' ? 'outbound-hvs' : t === 'INBOUND_HVS' ? 'inbound-hvs' : 'date';
  }

  var hdr4 = '<tr><th class="obib-rn" style="position:sticky;left:0;z-index:8;background:var(--gray2)">#</th>' +
    renderOrder.map(function (ci) {
      var ct = colDefs[ci].colType || '—';
      return '<th class="obib-hdr-type ' + typeClass(ct) + '">' + escH(ct) + '</th>';
    }).join('') + '</tr>';

  // ── Build tbody ──
  var tbodyHtml = '';
  if (maxRows === 0) {
    tbodyHtml = '<tr><td class="obib-rn">—</td><td colspan="' + nRender + '" style="text-align:center;padding:24px;color:var(--gray5)">Belum ada data AWB</td></tr>';
  } else {
    for (var ri = 0; ri < maxRows; ri++) {
      tbodyHtml += '<tr>';
      tbodyHtml += '<td class="obib-rn">' + (ri + 1) + '</td>';

      for (var roi = 0; roi < nRender; roi++) {
        var ci  = renderOrder[roi];
        var arr = flatCol[ci] || [];
        var ct  = (colDefs[ci].colType || '').toUpperCase();
        var row = ri < arr.length ? arr[ri] : null;

        if (ct === 'DATE') {
          if (row && row.text) {
            tbodyHtml += '<td class="obib-cell-date">' + escH(row.text) + '</td>';
          } else {
            tbodyHtml += '<td class="obib-cell-date-empty"></td>';
          }
          continue;
        }

        if (ct === 'INBOUND_HVS') {
          if (!row) {
            tbodyHtml += '<td class="obib-cell-empty" style="min-width:160px"></td>';
          } else if (row.cellType === 'IB_LABEL') {
            tbodyHtml += '<td class="obib-cell-ib-label" title="' + escH(row.text) + '">' + escH(row.text) + '</td>';
          } else {
            tbodyHtml += '<td class="obib-cell-ib-awb" title="' + escH(row.text) + '">' + escH(row.text) + '</td>';
          }
          continue;
        }

        if (ct === 'OUTBOUND' || ct === 'OUTBOUND_HVS') {
          if (!row || !row.text) {
            tbodyHtml += '<td class="obib-cell-empty" style="min-width:140px"></td>';
          } else {
            tbodyHtml += '<td class="obib-cell-awb' + (ct === 'OUTBOUND_HVS' ? ' hvs' : '') + '" title="' + escH(row.text) + '">' + escH(row.text) + '</td>';
          }
          continue;
        }

        tbodyHtml += row && row.text
          ? '<td class="obib-cell-awb">' + escH(row.text) + '</td>'
          : '<td class="obib-cell-empty"></td>';
      }
      tbodyHtml += '</tr>';
    }
  }

  wrap.innerHTML =
    '<table class="obib-table"><thead>' +
      hdrR1 +
      hdrR2 +
      hdrR3 +
      hdr4 +
    '</thead><tbody>' + tbodyHtml + '</tbody></table>';
}

// ─── Export OB&IB CSV ───
function exportObibCSV() {
  if (!_obibData) { toast('Muat data dulu', 'error'); return; }
  var colDefs = _obibData.colDefs || [], ibSections = _obibData.ibSections || [];
  var ibMap = {};
  ibSections.forEach(function (sec) {
    var k = (sec.service || '').toUpperCase() + '|' + (sec.from || '').toUpperCase();
    if (!ibMap[k]) ibMap[k] = [];
    ibMap[k].push(sec);
  });
  var rows = [['TYPE','INCHARGE','SERVICE','KOTA','TUJUAN_IB','FROM','DATE','AWB']];
  colDefs.forEach(function (def) {
    var ct = (def.colType || '').toUpperCase();
    if (ct === 'DATE') return;
    if (ct === 'OUTBOUND' || ct === 'OUTBOUND_HVS') {
      var ent = def.entries && def.entries.length ? def.entries : (def.flatRows || []);
      ent.forEach(function (e) { var awb = e.awb || e.text || ''; if (awb) rows.push([ct, def.r1, def.r2, def.r3, def.r3, '', e.date || '', awb]); });
    } else if (ct === 'INBOUND_HVS') {
      var k = (def.r2 || '').toUpperCase() + '|' + (def.r3 || '').toUpperCase();
      (ibMap[k] || []).forEach(function (sec) {
        (sec.awbs || []).forEach(function (a) {
          rows.push([ct, def.r1, def.r2, def.r3, a.tujuan || sec.tujuan || '', sec.from || '', a.date || sec.date || '', a.awb || '']);
        });
      });
    }
  });
  _downloadCSV(rows, 'OBIB_export_' + _dateStr() + '.csv');
}

// ═══════════════════════════════════════════════════════════════════
// MANIFEST PAGE
// ═══════════════════════════════════════════════════════════════════

function loadManifestPage() {
  if (_mfLoaded) { renderManifestSheet(); return; }
  showLoading('Memuat manifest...');
  gasGet('getManifestData').then(function (res) {
    hideLoading();
    if (res.error) { toast('Error manifest: ' + res.error, 'error'); return; }
    _mfData = res; _mfLoaded = true; _mfSelRow = -1; _mfSelCol = -1;
    renderManifestSheet(); setupMfKeyboard();
  }).catch(function (e) { hideLoading(); toast('Error: ' + e.message, 'error'); });
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
    document.getElementById('mfSheetOuter').innerHTML = '<div style="padding:40px;text-align:center;color:var(--gray5)"><span class="material-icons-round" style="font-size:40px;color:var(--gray4);display:block;margin-bottom:8px">grid_on</span>Klik Manifest di sidebar</div>';
    return;
  }
  var hRows = _mfData.headerRows || [], colDefs = _mfData.colDefs || [], awbRows = _mfData.awbRows || [];
  var totalCols = _mfData.totalCols || 0;
  var fq = (_mfFilter || '').toLowerCase().trim();
  var filteredAwbRows = fq ? awbRows.filter(function (row) { return row.some(function (c) { return (c || '').toLowerCase().indexOf(fq) !== -1; }); }) : awbRows;
  _mfFilteredRows = filteredAwbRows;
  var incSet = {}; colDefs.forEach(function (c) { if (c.incharge) incSet[c.incharge] = true; });
  var tujCols = colDefs.filter(function (c) { return !c.isDate && c.tujuan; });
  var totalAwb = tujCols.reduce(function (s, c) { return s + awbRows.filter(function (r) { return r[c.colIdx] && r[c.colIdx].trim(); }).length; }, 0);
  document.getElementById('mfTotalCols').innerText = tujCols.length;
  document.getElementById('mfTotalAwb').innerText  = totalAwb;
  document.getElementById('mfTotalInc').innerText  = Object.keys(incSet).length;
  var nCols = totalCols;
  function buildSpannedRow(hArr, cls) {
    var cells = [], i = 0;
    while (i < nCols) {
      var val = hArr[i] || '';
      if (!val) { cells.push({ val: '', span: 1 }); i++; continue; }
      var span = 1;
      while (i + span < nCols && (!hArr[i + span] || hArr[i + span] === '')) span++;
      cells.push({ val: val, span: span }); i += span;
    }
    return '<tr><th class="mf-rn" style="z-index:5">#</th>' + cells.map(function (c) { return '<th colspan="' + c.span + '" class="' + cls + '">' + escH(c.val) + '</th>'; }).join('') + '</tr>';
  }
  var row0Html = buildSpannedRow(hRows[0] || [], 'mf-hdr-incharge');
  var row1Html = buildSpannedRow(hRows[1] || [], 'mf-hdr-service');
  var row2Html = '<tr><th class="mf-rn">—</th>' + colDefs.map(function (c) { return c.isDate ? '<th class="mf-hdr-date">DATE</th>' : '<th class="mf-hdr-tujuan">' + escH(c.tujuan) + '</th>'; }).join('') + '</tr>';
  var dataHtml = filteredAwbRows.length
    ? filteredAwbRows.map(function (row, ri) {
        return '<tr class="mf-data-row" data-ri="' + ri + '"><td class="mf-rn">' + (ri + 1) + '</td>' +
          colDefs.map(function (c, ci) {
            var val = row[c.colIdx] || '';
            var sel = (_mfSelRow === ri && _mfSelCol === ci) ? ' mf-cell-selected' : '';
            var attr = ' data-ci="' + ci + '" data-ri="' + ri + '" onclick="mfSelectCell(' + ri + ',' + ci + ')"';
            if (c.isDate) return '<td class="mf-cell-date' + sel + '"' + attr + '>' + escH(val) + '</td>';
            if (!val)     return '<td class="mf-cell-empty' + sel + '"' + attr + '></td>';
            return '<td class="mf-cell-awb' + sel + '"' + attr + ' title="' + escH(val) + '">' + escH(val) + '</td>';
          }).join('') + '</tr>';
      }).join('')
    : '<tr><td class="mf-rn">—</td><td colspan="' + (nCols || 1) + '" style="text-align:center;padding:20px;color:var(--gray5)">Tidak ada data AWB</td></tr>';
  document.getElementById('mfSheetOuter').innerHTML = '<table class="mf-table"><thead>' + row0Html + row1Html + row2Html + '</thead><tbody>' + dataHtml + '</tbody></table>';
  updateMfActiveCellLabel();
}

function mfSelectCell(ri, ci) {
  _mfSelRow = ri; _mfSelCol = ci;
  document.querySelectorAll('.mf-cell-selected').forEach(function (el) { el.classList.remove('mf-cell-selected'); });
  var t = document.querySelector('[data-ri="' + ri + '"][data-ci="' + ci + '"]');
  if (t) { t.classList.add('mf-cell-selected'); t.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  updateMfActiveCellLabel();
  document.getElementById('mfSheetOuter').focus();
}

function updateMfActiveCellLabel() {
  var el = document.getElementById('mfActiveCell'); if (!el) return;
  if (_mfSelRow < 0 || _mfSelCol < 0 || !_mfData) { el.innerText = '—'; return; }
  var row = _mfFilteredRows[_mfSelRow], c = (_mfData.colDefs || [])[_mfSelCol];
  el.innerText = (row && c) ? (row[c.colIdx] || '(kosong)') : '—';
}

function setupMfKeyboard() {
  var outer = document.getElementById('mfSheetOuter');
  if (!outer || outer._kbSetup) return;
  outer._kbSetup = true;
  outer.addEventListener('keydown', function (e) {
    if (!_mfData) return;
    var nRows = _mfFilteredRows.length, nCols = (_mfData.colDefs || []).length;
    if (!nRows || !nCols) return;
    if (_mfSelRow < 0) { _mfSelRow = 0; _mfSelCol = 0; }
    var moved = false;
    if      (e.key === 'ArrowDown')  { e.preventDefault(); _mfSelRow = Math.min(_mfSelRow + 1, nRows - 1); moved = true; }
    else if (e.key === 'ArrowUp')    { e.preventDefault(); _mfSelRow = Math.max(_mfSelRow - 1, 0); moved = true; }
    else if (e.key === 'ArrowRight') { e.preventDefault(); _mfSelCol = Math.min(_mfSelCol + 1, nCols - 1); moved = true; }
    else if (e.key === 'ArrowLeft')  { e.preventDefault(); _mfSelCol = Math.max(_mfSelCol - 1, 0); moved = true; }
    else if (e.key === 'Tab') { e.preventDefault(); _mfSelCol = (_mfSelCol + 1) % nCols; if (_mfSelCol === 0) _mfSelRow = Math.min(_mfSelRow + 1, nRows - 1); moved = true; }
    else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); copyMfCell(); return; }
    if (moved) {
      document.querySelectorAll('.mf-cell-selected').forEach(function (el) { el.classList.remove('mf-cell-selected'); });
      var t = document.querySelector('[data-ri="' + _mfSelRow + '"][data-ci="' + _mfSelCol + '"]');
      if (t) { t.classList.add('mf-cell-selected'); t.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
      updateMfActiveCellLabel();
    }
  });
}

function copyMfCell() {
  if (_mfSelRow < 0 || _mfSelCol < 0 || !_mfData) return;
  var row = _mfFilteredRows[_mfSelRow], c = (_mfData.colDefs || [])[_mfSelCol];
  if (!row || !c) return;
  var val = row[c.colIdx] || '';
  if (!val) { toast('Sel kosong', 'error'); return; }
  navigator.clipboard.writeText(val).then(function () { showCopyFlash(val); }).catch(function () {
    var ta = document.createElement('textarea'); ta.value = val; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); showCopyFlash(val); } catch (x) { toast('Gagal copy', 'error'); }
    document.body.removeChild(ta);
  });
}

function showCopyFlash(val) {
  var el = document.getElementById('copyFlash');
  el.innerText = '✓ Copied: ' + val; el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(function () { el.classList.remove('show'); }, 1200);
}

function exportManifestCSV() {
  if (!_mfData) { toast('Manifest belum dimuat', 'error'); return; }
  var colDefs = _mfData.colDefs || [], awbRows = _mfData.awbRows || [], hRows = _mfData.headerRows || [];
  if (!colDefs.length) { toast('Tidak ada data manifest', 'error'); return; }
  var csvRows = [];
  csvRows.push(['#'].concat(hRows[0] || []).map(function (v) { return '"' + v + '"'; }).join(','));
  csvRows.push([''].concat(hRows[1] || []).map(function (v) { return '"' + v + '"'; }).join(','));
  csvRows.push([''].concat(hRows[2] || []).map(function (v) { return '"' + v + '"'; }).join(','));
  awbRows.forEach(function (row, i) { csvRows.push(['"' + (i + 1) + '"'].concat(row.map(function (c) { return '"' + (c || '') + '"'; })).join(',')); });
  _downloadCSV(csvRows.join('\n'), 'manifest_export_' + _dateStr() + '.csv');
}

// ═══════════════════════════════════════════════════════════════════
// SEARCH AWB
// ═══════════════════════════════════════════════════════════════════

function doSearchAwb(q) {
  q = (q || '').trim();
  var hdr  = document.getElementById('searchAwbResult').querySelector('.search-awb-result-hdr');
  var body = document.getElementById('searchAwbResultBody');
  if (!q) {
    hdr.innerHTML  = '<span class="material-icons-round">info</span> Masukkan nomor AWB untuk mencari';
    body.innerHTML = '<div class="search-awb-empty"><span class="material-icons-round">search</span>Ketik nomor AWB di atas</div>';
    return;
  }
  var ql = q.toLowerCase();
  var results = allScanAwbs.filter(function (item) { return (item.awb || '').toLowerCase().indexOf(ql) !== -1; });
  hdr.innerHTML = '<span class="material-icons-round">' + (results.length ? 'check_circle' : 'search_off') + '</span> ' +
    (results.length ? results.length + ' hasil untuk "' + escH(q) + '"' : 'Tidak ada hasil untuk "' + escH(q) + '"');
  if (!results.length) {
    body.innerHTML = '<div class="search-awb-empty"><span class="material-icons-round">hourglass_empty</span>Mencari di server...</div>';
    gasGet('searchAwb', { q: q }).then(function (res) {
      var list = res.list || [];
      hdr.innerHTML = '<span class="material-icons-round">' + (list.length ? 'check_circle' : 'search_off') + '</span> ' +
        (list.length ? list.length + ' hasil untuk "' + escH(q) + '"' : 'AWB tidak ditemukan');
      body.innerHTML = list.length ? list.map(function (r) { return _searchItem(r, q); }).join('') :
        '<div class="search-awb-empty"><span class="material-icons-round">search_off</span>AWB tidak ditemukan</div>';
    }).catch(function () { body.innerHTML = '<div class="search-awb-empty"><span class="material-icons-round">search_off</span>AWB tidak ditemukan</div>'; });
    return;
  }
  body.innerHTML = results.map(function (r) { return _searchItem(r, q); }).join('');
}

function _searchItem(r, q) {
  var tk = (r.type || '').toLowerCase();
  var tl = tk === 'ob' ? 'Outbound BDO' : tk === 'hvs' ? 'Outbound HVS' : 'Inbound HVS';
  var ic = tk === 'ob' ? 'local_shipping' : tk === 'hvs' ? 'inventory_2' : 'move_to_inbox';
  var hl = escH(r.awb || '').replace(new RegExp('(' + escRegex(escH(q)) + ')', 'gi'), '<mark>$1</mark>');
  return '<div class="search-awb-item">' +
    '<div class="search-awb-item-icon ' + tk + '"><span class="material-icons-round">' + ic + '</span></div>' +
    '<div class="search-awb-item-main">' +
      '<div class="search-awb-item-awb">' + hl + '</div>' +
      '<div class="search-awb-item-meta">' +
        '<span class="search-awb-type-tag ' + tk + '">' + tl + '</span>' +
        '<span>' + escH(r.incharge || '—') + '</span><span>•</span><span>' + escH(r.service || '—') + '</span>' +
        '<span>•</span><span>→ ' + escH(r.tujuan || '—') + '</span>' +
        (r.from ? '<span>• FROM: ' + escH(r.from) + '</span>' : '') +
        '<span>•</span><span style="color:var(--gray4)">' + escH(r.date || '') + '</span>' +
      '</div>' +
      '<div style="margin-top:3px">NO TRACK: <span class="search-awb-item-notrack" onclick="openDetailModal(\'' + tk + '\',\'' + escQ(r.noTrack || '') + '\')">' + escH(r.noTrack || '') + '</span></div>' +
    '</div></div>';
}

function clearSearchAwb() { document.getElementById('searchAwbMainInput').value = ''; doSearchAwb(''); }

function handleSidebarSearch(e) {
  if (e.key !== 'Enter') return;
  var q = document.getElementById('sidebarSearchInput').value.trim();
  if (!q) return;
  switchPage('search');
  document.getElementById('searchAwbMainInput').value = q;
  doSearchAwb(q);
  document.getElementById('sidebarSearchInput').value = '';
}

// ═══════════════════════════════════════════════════════════════════
// EXPORT CSV
// ═══════════════════════════════════════════════════════════════════

function exportCSV() {
  var pages = ['ob', 'hvs', 'ib', 'manifest', 'obib'], active = '';
  pages.forEach(function (p) { var el = document.getElementById('page-' + p); if (el && el.style.display !== 'none') active = p; });
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
  var csv = typeof rows === 'string' ? rows : rows.map(function (r) {
    return r.map(function (c) {
      var s = (c === null || c === undefined) ? '' : String(c);
      if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) s = '"' + s.replace(/"/g, '""') + '"';
      return s;
    }).join(',');
  }).join('\r\n');
  var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename; a.style.display = 'none';
  document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(url); document.body.removeChild(a); }, 1000);
  toast('CSV diunduh: ' + filename, 'success');
}

function _dateStr() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
