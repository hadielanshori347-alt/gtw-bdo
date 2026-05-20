/* ============================================================
   GTW BDO — views.js v4.11
   CHANGES dari v4.10:
   - STARTUP CEPAT: tidak ada showLoading overlay saat buka
   - Paralel fetch: getMasterData + getObList bersamaan
   - HVS & IB lazy load di background (tidak blokir render OB)
   - getAllScanAwbs delay 1 detik setelah render awal
   - reloadAll: pakai spinner kecil di tombol, bukan overlay fullscreen
   - switchPage: pakai requestAnimationFrame supaya sidebar klik terasa instant
   ============================================================ */

// ── State manifest tambahan ──
var _mfDateMode = 'today'; // 'today' | 'all'

window.addEventListener('DOMContentLoaded', function () {
  // ── Paralel: getMasterData + getObList bersamaan ──
  // Tidak ada showLoading — halaman langsung tampil
  Promise.all([
    gasGet('getMasterData'),
    gasGet('getObList')
  ]).then(function (results) {
    masterData = results[0] || {};
    populateGlobalIncharge();
    buildCbOptions();
    initAllCbs();

    // Render OB duluan — halaman default
    obData = results[1].list || [];
    renderObTable();
    updateObStats();

    // HVS di background — tidak halangi UI
    gasGet('getHvsList').then(function (r) {
      hvsData = r.list || [];
      renderHvsTable();
      updateHvsStats();
    }).catch(function () {});

    // IB di background — tidak halangi UI
    gasGet('getIbList').then(function (r) {
      ibData = r.list || [];
      renderIbTable();
      updateIbStats();
    }).catch(function () {});

    // getAllScanAwbs berat — delay 1 detik setelah render awal selesai
    setTimeout(function () { buildAllScanAwbs(); }, 1000);

  }).catch(function (e) {
    toast('Gagal memuat data: ' + e.message, 'error');
  });
  // Tidak ada hideLoading — tidak pernah ada overlay
});

// ── reloadAll: spinner kecil di tombol, bukan overlay fullscreen ──
function reloadAll() {
  var btn = document.querySelector('[onclick="reloadAll()"]');
  var origHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-round" style="animation:spin .6s linear infinite;font-size:15px">sync</span> Memuat...';
  }
  _mfLoaded = false; _obibData = null;
  Promise.all([gasGet('getObList'), gasGet('getHvsList'), gasGet('getIbList')])
    .then(function (results) {
      obData  = results[0].list || [];
      hvsData = results[1].list || [];
      ibData  = results[2].list || [];
      renderObTable(); renderHvsTable(); renderIbTable();
      updateObStats(); updateHvsStats(); updateIbStats();
      buildAllScanAwbs();
      if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
      toast('Data diperbarui', 'success');
    }).catch(function (e) {
      if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
      toast('Gagal reload: ' + e.message, 'error');
    });
}

function buildAllScanAwbs() {
  gasGet('getAllScanAwbs').then(function (r) {
    if (r && r.list) allScanAwbs = r.list;
  }).catch(function () {});
}

// ═══════════════════════════════════════════════════════════════════
// OB & IB COMBINED VIEW v4.9
// ═══════════════════════════════════════════════════════════════════

function renderObibPage() {
  var wrap = document.getElementById('obibTableWrap');
  wrap.innerHTML = '<div class="empty-state"><span class="material-icons-round">hourglass_empty</span>Memuat...</div>';
  if (_obibData) { _buildObibTable(_obibData); return; }
  showLoading('Memuat OB & IB...');
  gasGet('getOBIB').then(function (res) {
    hideLoading();
    if (res.error) {
      wrap.innerHTML = '<div class="empty-state"><span class="material-icons-round">error</span>' + escH(res.error) + '</div>';
      return;
    }
    _obibData = res;
    _buildObibTable(_obibData);
  }).catch(function (e) {
    hideLoading();
    wrap.innerHTML = '<div class="empty-state"><span class="material-icons-round">error</span>' + escH(e.message) + '</div>';
  });
}

function reloadObib() { _obibData = null; renderObibPage(); }
function filterObib()  { if (_obibData) _buildObibTable(_obibData); }

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

  var propR1 = '', propR2 = '', propR3 = '';
  colDefs.forEach(function (def) {
    var inR1 = def.r1 || '';
    var inR2 = def.r2 || '';

    if (inR1 && inR1 !== propR1) {
      propR1 = inR1; propR2 = ''; propR3 = '';
    } else if (!inR1) {
      def.r1 = propR1;
    }

    if (inR2 && inR2 !== propR2) {
      propR2 = inR2; propR3 = '';
    } else if (!inR2) {
      def.r2 = propR2;
    }

    var ct = (def.colType || '').toUpperCase();
    if (ct !== 'DATE') {
      if (def.r3) propR3 = def.r3;
      else def.r3 = propR3;
    }
  });

  var ibMap = {};
  ibSections.forEach(function (sec) {
    var k = (sec.incharge || '').toUpperCase() + '|' + (sec.service || '').toUpperCase() + '|' + (sec.from || '').toUpperCase();
    if (!ibMap[k]) ibMap[k] = [];
    ibMap[k].push(sec);
  });

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
      var k    = (def.r1 || '').toUpperCase() + '|' + (def.r2 || '').toUpperCase() + '|' + (def.r3 || '').toUpperCase();
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

  for (var ci = 0; ci < nCols; ci++) {
    if (flatCol[ci] !== null) continue;
    var srcCi = -1;
    var curR1 = colDefs[ci].r1 || '';

    for (var j = ci + 1; j < nCols; j++) {
      if ((colDefs[j].r1 || '') !== curR1) break;
      var jct = (colDefs[j].colType || '').toUpperCase();
      if (jct !== 'DATE' && flatCol[j] !== null) { srcCi = j; break; }
    }
    if (srcCi === -1) {
      for (var j = ci - 1; j >= 0; j--) {
        if ((colDefs[j].r1 || '') !== curR1) break;
        var jct = (colDefs[j].colType || '').toUpperCase();
        if (jct !== 'DATE' && flatCol[j] !== null) { srcCi = j; break; }
      }
    }

    if (srcCi === -1) { flatCol[ci] = []; continue; }

    var srcCt = (colDefs[srcCi].colType || '').toUpperCase();
    flatCol[ci] = (flatCol[srcCi] || []).map(function (r) {
      if (srcCt === 'INBOUND_HVS') {
        if (r.cellType === 'IB_LABEL') {
          return r.date ? { cellType: 'DATE_VAL', text: r.date, date: r.date } : { cellType: 'DATE_EMPTY', text: '', date: '' };
        }
        if (r.cellType === 'AWB') {
          return r.date ? { cellType: 'DATE_VAL', text: r.date, date: r.date } : { cellType: 'DATE_EMPTY', text: '', date: '' };
        }
        return { cellType: 'DATE_EMPTY', text: '', date: '' };
      }
      if (r.cellType === 'AWB') {
        return r.date ? { cellType: 'DATE_VAL', text: r.date, date: r.date } : { cellType: 'DATE_EMPTY', text: '', date: '' };
      }
      return { cellType: 'DATE_EMPTY', text: '', date: '' };
    });
  }

  var maxRows = 0;
  flatCol.forEach(function (arr) { if (arr && arr.length > maxRows) maxRows = arr.length; });

  var renderOrder = [];
  for (var ci = 0; ci < nCols; ci++) { renderOrder.push(ci); }
  var nRender = renderOrder.length;

  var hdrR1 = '<tr>' +
    '<th class="obib-rn" style="position:sticky;left:0;z-index:8;background:var(--gray2)"></th>' +
    renderOrder.map(function (ci) {
      return '<th class="obib-hdr-incharge">' + escH(colDefs[ci].r1 || '') + '</th>';
    }).join('') + '</tr>';

  var hdrR2 = '<tr>' +
    '<th class="obib-rn" style="position:sticky;left:0;z-index:8;background:var(--gray2)"></th>' +
    renderOrder.map(function (ci) {
      return '<th class="obib-hdr-service">' + escH(colDefs[ci].r2 || '') + '</th>';
    }).join('') + '</tr>';

  var hdrR3 = '<tr>' +
    '<th class="obib-rn" style="position:sticky;left:0;z-index:8;background:var(--gray2)"></th>' +
    renderOrder.map(function (ci) {
      var ct  = (colDefs[ci].colType || '').toUpperCase();
      var val = ct === 'DATE' ? '' : (colDefs[ci].r3 || '');
      return '<th class="obib-hdr-kota">' + escH(val) + '</th>';
    }).join('') + '</tr>';

  function typeClass(t) {
    t = (t || '').toUpperCase();
    return t === 'OUTBOUND' ? 'outbound' : t === 'OUTBOUND_HVS' ? 'outbound-hvs' : t === 'INBOUND_HVS' ? 'inbound-hvs' : 'date';
  }

  var hdr4 = '<tr>' +
    '<th class="obib-rn" style="position:sticky;left:0;z-index:8;background:var(--gray2)">#</th>' +
    renderOrder.map(function (ci) {
      var ct = colDefs[ci].colType || '—';
      return '<th class="obib-hdr-type ' + typeClass(ct) + '">' + escH(ct) + '</th>';
    }).join('') + '</tr>';

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
      hdrR1 + hdrR2 + hdrR3 + hdr4 +
    '</thead><tbody>' + tbodyHtml + '</tbody></table>';
}

function exportObibCSV() {
  if (!_obibData) { toast('Muat data dulu', 'error'); return; }
  var colDefs = _obibData.colDefs || [], ibSections = _obibData.ibSections || [];
  var ibMap = {};
  ibSections.forEach(function (sec) {
    var k = (sec.incharge || '').toUpperCase() + '|' + (sec.service || '').toUpperCase() + '|' + (sec.from || '').toUpperCase();
    if (!ibMap[k]) ibMap[k] = [];
    ibMap[k].push(sec);
  });
  var rows = [['TYPE','INCHARGE','SERVICE','KOTA','TUJUAN_IB','FROM','DATE','AWB']];
  colDefs.forEach(function (def) {
    var ct = (def.colType || '').toUpperCase();
    if (ct === 'DATE') return;
    if (ct === 'OUTBOUND' || ct === 'OUTBOUND_HVS') {
      var ent = def.entries && def.entries.length ? def.entries : (def.flatRows || []);
      ent.forEach(function (e) {
        var awb = e.awb || e.text || '';
        if (awb) rows.push([ct, def.r1, def.r2, def.r3, def.r3, '', e.date || '', awb]);
      });
    } else if (ct === 'INBOUND_HVS') {
      var k = (def.r1 || '').toUpperCase() + '|' + (def.r2 || '').toUpperCase() + '|' + (def.r3 || '').toUpperCase();
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
// MANIFEST PAGE v4.10
// - Toggle "Hari Ini" / "Semua Data"
// - DATE kolom tampil di KIRI AWB
// - Format tanggal compact "15/01 14:30"
// ═══════════════════════════════════════════════════════════════════

function loadManifestPage(forceMode) {
  if (forceMode) _mfDateMode = forceMode;
  _updateMfModeButtons();

  if (_mfLoaded && _mfData && _mfData._mode === _mfDateMode) {
    renderManifestSheet();
    return;
  }

  showLoading('Memuat manifest...');

  var apiCall = _mfDateMode === 'today'
    ? gasGet('getManifest', { dateFilter: 'today' })
    : gasGet('getManifestData');

  apiCall.then(function (res) {
    hideLoading();
    if (res.error) { toast('Error manifest: ' + res.error, 'error'); return; }

    if (_mfDateMode === 'today' && res.columns !== undefined) {
      _mfData = _normaliseManifestColumns(res);
    } else {
      _mfData = res;
    }
    _mfData._mode = _mfDateMode;
    _mfLoaded     = true;
    _mfSelRow     = -1;
    _mfSelCol     = -1;

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
  loadManifestPage(_mfDateMode);
}

function filterManifest() {
  _mfFilter = document.getElementById('manifestSearch').value || '';
  if (_mfLoaded) renderManifestSheet();
}

function _updateMfModeButtons() {
  var btnToday = document.getElementById('mfBtnToday');
  var btnAll   = document.getElementById('mfBtnAll');
  if (!btnToday || !btnAll) return;
  if (_mfDateMode === 'today') {
    btnToday.className = 'btn btn-primary btn-sm';
    btnAll.className   = 'btn btn-outline btn-sm';
  } else {
    btnToday.className = 'btn btn-outline btn-sm';
    btnAll.className   = 'btn btn-primary btn-sm';
  }
}

function _normaliseManifestColumns(res) {
  var columns = res.columns || [];
  if (!columns.length) {
    return { headerRows: [[], [], []], colDefs: [], awbRows: [], totalCols: 0, _mode: 'today' };
  }

  var r0 = [], r1 = [], r2 = [];
  var colDefs = [];
  var colData = {};
  var colIdx  = 0;

  columns.forEach(function (col) {
    var dateCi = colIdx;
    r0.push('');
    r1.push('');
    r2.push('DATE');
    colDefs.push({
      colIdx  : dateCi,
      tujuan  : '',
      incharge: col.incharge || '',
      service : col.service  || '',
      isDate  : true
    });
    colData[dateCi] = (col.rows || []).map(function (row) { return row[1] || ''; });
    colIdx++;

    var awbCi = colIdx;
    r0.push(col.incharge || '');
    r1.push(col.service  || '');
    r2.push(col.tujuan   || '');
    colDefs.push({
      colIdx  : awbCi,
      tujuan  : col.tujuan  || '',
      incharge: col.incharge || '',
      service : col.service  || '',
      isDate  : false
    });
    colData[awbCi] = (col.rows || []).map(function (row) { return row[0] || ''; });
    colIdx++;
  });

  var maxRows = 0;
  for (var ci = 0; ci < colIdx; ci++) {
    if (colData[ci] && colData[ci].length > maxRows) maxRows = colData[ci].length;
  }

  var awbRows = [];
  for (var ri = 0; ri < maxRows; ri++) {
    var row = new Array(colIdx).fill('');
    for (var ci = 0; ci < colIdx; ci++) {
      row[ci] = (colData[ci] && ri < colData[ci].length) ? colData[ci][ri] : '';
    }
    awbRows.push(row);
  }

  return {
    headerRows: [r0, r1, r2],
    colDefs   : colDefs,
    awbRows   : awbRows,
    totalCols : colDefs.length,
    _mode     : 'today'
  };
}

function _buildMfRenderOrder(colDefs) {
  if (!colDefs.length) return [];

  var firstDate = -1;
  var firstAwb  = -1;
  for (var i = 0; i < colDefs.length; i++) {
    if (colDefs[i].isDate  && firstDate < 0) firstDate = i;
    if (!colDefs[i].isDate && firstAwb  < 0) firstAwb  = i;
    if (firstDate >= 0 && firstAwb >= 0) break;
  }

  if (firstDate < firstAwb || firstDate < 0) {
    var order = [];
    for (var i = 0; i < colDefs.length; i++) order.push(i);
    return order;
  }

  var used  = new Array(colDefs.length).fill(false);
  var order = [];

  for (var i = 0; i < colDefs.length; i++) {
    if (used[i] || colDefs[i].isDate) continue;

    var datePair = -1;
    for (var j = i + 1; j < colDefs.length; j++) {
      if ((colDefs[j].incharge || '') !== (colDefs[i].incharge || '')) break;
      if (colDefs[j].isDate) { datePair = j; break; }
    }

    if (datePair !== -1) {
      order.push(datePair);
      used[datePair] = true;
    }
    order.push(i);
    used[i] = true;
  }

  for (var i = 0; i < colDefs.length; i++) {
    if (!used[i]) { order.push(i); used[i] = true; }
  }

  return order;
}

function _buildMfSpannedRow(hArr, cls, renderOrder, colDefs) {
  var reordered = renderOrder.map(function (ci) {
    return (hArr && hArr[colDefs[ci].colIdx]) ? hArr[colDefs[ci].colIdx].toString().trim() : '';
  });

  var cells = [], i = 0;
  while (i < reordered.length) {
    var val = reordered[i] || '';
    if (!val) { cells.push({ val: '', span: 1 }); i++; continue; }
    var span = 1;
    while (i + span < reordered.length && (!reordered[i + span] || reordered[i + span] === '')) span++;
    cells.push({ val: val, span: span });
    i += span;
  }

  return '<tr><th class="mf-rn" style="z-index:5">#</th>' +
    cells.map(function (c) {
      return '<th colspan="' + c.span + '" class="' + cls + '">' + escH(c.val) + '</th>';
    }).join('') + '</tr>';
}

function _shortDate(dateStr) {
  if (!dateStr) return '';
  try {
    var parts    = dateStr.split(' ');
    var datePart = parts[0] || '';
    var timePart = parts[1] ? parts[1].substring(0, 5) : '';
    var dp = datePart.split('-');
    if (dp.length === 3) return dp[2] + '/' + dp[1] + ' ' + timePart;
  } catch (e) {}
  return dateStr.substring(0, 16);
}

function renderManifestSheet() {
  if (!_mfData) {
    document.getElementById('mfSheetOuter').innerHTML =
      '<div style="padding:40px;text-align:center;color:var(--gray5)">' +
      '<span class="material-icons-round" style="font-size:40px;color:var(--gray4);display:block;margin-bottom:8px">grid_on</span>' +
      'Klik <strong>Hari Ini</strong> atau <strong>Semua Data</strong> untuk memuat manifest.</div>';
    return;
  }

  var hRows   = _mfData.headerRows || [];
  var colDefs = _mfData.colDefs    || [];
  var awbRows = _mfData.awbRows    || [];
  var fq      = (_mfFilter || '').toLowerCase().trim();

  var filteredAwbRows = fq
    ? awbRows.filter(function (row) {
        return row.some(function (c) { return (c || '').toLowerCase().indexOf(fq) !== -1; });
      })
    : awbRows;

  _mfFilteredRows = filteredAwbRows;

  var renderOrder = _buildMfRenderOrder(colDefs);

  var incSet  = {};
  var tujCols = [];
  colDefs.forEach(function (c) {
    if (!c.isDate && c.tujuan) {
      tujCols.push(c);
      if (c.incharge) incSet[c.incharge] = true;
    }
  });
  var totalAwb = tujCols.reduce(function (s, c) {
    return s + awbRows.filter(function (r) { return r[c.colIdx] && r[c.colIdx].trim(); }).length;
  }, 0);

  document.getElementById('mfTotalCols').innerText = tujCols.length;
  document.getElementById('mfTotalAwb').innerText  = totalAwb;
  document.getElementById('mfTotalInc').innerText  = Object.keys(incSet).length;

  var row0Html = _buildMfSpannedRow(hRows[0], 'mf-hdr-incharge', renderOrder, colDefs);
  var row1Html = _buildMfSpannedRow(hRows[1], 'mf-hdr-service',  renderOrder, colDefs);

  var row2Html = '<tr><th class="mf-rn">—</th>' +
    renderOrder.map(function (ci) {
      var c = colDefs[ci];
      return c.isDate
        ? '<th class="mf-hdr-date">DATE</th>'
        : '<th class="mf-hdr-tujuan">' + escH(c.tujuan) + '</th>';
    }).join('') + '</tr>';

  var dataHtml = filteredAwbRows.length
    ? filteredAwbRows.map(function (row, ri) {
        return '<tr class="mf-data-row" data-ri="' + ri + '">' +
          '<td class="mf-rn">' + (ri + 1) + '</td>' +
          renderOrder.map(function (ci, rci) {
            var c   = colDefs[ci];
            var val = row[c.colIdx] || '';
            var sel = (_mfSelRow === ri && _mfSelCol === rci) ? ' mf-cell-selected' : '';
            var attr = ' data-ci="' + rci + '" data-ri="' + ri + '" onclick="mfSelectCell(' + ri + ',' + rci + ')"';
            if (c.isDate) {
              return val
                ? '<td class="mf-cell-date' + sel + '"' + attr + ' title="' + escH(val) + '">' + escH(_shortDate(val)) + '</td>'
                : '<td class="mf-cell-date' + sel + '"' + attr + '></td>';
            }
            if (!val) return '<td class="mf-cell-empty' + sel + '"' + attr + '></td>';
            return '<td class="mf-cell-awb' + sel + '"' + attr + ' title="' + escH(val) + '">' + escH(val) + '</td>';
          }).join('') +
        '</tr>';
      }).join('')
    : '<tr><td class="mf-rn">—</td><td colspan="' + (renderOrder.length || 1) +
      '" style="text-align:center;padding:24px;color:var(--gray5)">Tidak ada data AWB' +
      (_mfDateMode === 'today' ? ' hari ini' : '') + '</td></tr>';

  document.getElementById('mfSheetOuter').innerHTML =
    '<table class="mf-table"><thead>' + row0Html + row1Html + row2Html + '</thead><tbody>' + dataHtml + '</tbody></table>';

  updateMfActiveCellLabel();
}

function mfSelectCell(ri, rci) {
  _mfSelRow = ri; _mfSelCol = rci;
  document.querySelectorAll('.mf-cell-selected').forEach(function (el) { el.classList.remove('mf-cell-selected'); });
  var t = document.querySelector('[data-ri="' + ri + '"][data-ci="' + rci + '"]');
  if (t) { t.classList.add('mf-cell-selected'); t.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  updateMfActiveCellLabel();
  document.getElementById('mfSheetOuter').focus();
}

function updateMfActiveCellLabel() {
  var el = document.getElementById('mfActiveCell');
  if (!el) return;
  if (_mfSelRow < 0 || _mfSelCol < 0 || !_mfData) { el.innerText = '—'; return; }
  var row   = _mfFilteredRows[_mfSelRow];
  var defs  = _mfData.colDefs || [];
  var order = _buildMfRenderOrder(defs);
  var ci    = _mfSelCol < order.length ? order[_mfSelCol] : -1;
  var c     = ci >= 0 ? defs[ci] : null;
  if (!row || !c) { el.innerText = '—'; return; }
  var val = row[c.colIdx] || '';
  el.innerText = val ? (c.isDate ? _shortDate(val) : val) : '(kosong)';
}

function setupMfKeyboard() {
  var outer = document.getElementById('mfSheetOuter');
  if (!outer || outer._kbSetup) return;
  outer._kbSetup = true;
  outer.addEventListener('keydown', function (e) {
    if (!_mfData) return;
    var nRows  = _mfFilteredRows.length;
    var order  = _buildMfRenderOrder(_mfData.colDefs || []);
    var nCols  = order.length;
    if (!nRows || !nCols) return;
    if (_mfSelRow < 0) { _mfSelRow = 0; _mfSelCol = 0; }
    var moved = false;
    if      (e.key === 'ArrowDown')  { e.preventDefault(); _mfSelRow = Math.min(_mfSelRow + 1, nRows - 1); moved = true; }
    else if (e.key === 'ArrowUp')    { e.preventDefault(); _mfSelRow = Math.max(_mfSelRow - 1, 0); moved = true; }
    else if (e.key === 'ArrowRight') { e.preventDefault(); _mfSelCol = Math.min(_mfSelCol + 1, nCols - 1); moved = true; }
    else if (e.key === 'ArrowLeft')  { e.preventDefault(); _mfSelCol = Math.max(_mfSelCol - 1, 0); moved = true; }
    else if (e.key === 'Tab')        { e.preventDefault(); _mfSelCol = (_mfSelCol + 1) % nCols; if (_mfSelCol === 0) _mfSelRow = Math.min(_mfSelRow + 1, nRows - 1); moved = true; }
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
  var row   = _mfFilteredRows[_mfSelRow];
  var defs  = _mfData.colDefs || [];
  var order = _buildMfRenderOrder(defs);
  var ci    = _mfSelCol < order.length ? order[_mfSelCol] : -1;
  var c     = ci >= 0 ? defs[ci] : null;
  if (!row || !c) return;
  var val = row[c.colIdx] || '';
  if (!val) { toast('Sel kosong', 'error'); return; }
  navigator.clipboard.writeText(val).then(function () { showCopyFlash(val); }).catch(function () {
    var ta = document.createElement('textarea');
    ta.value = val; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); showCopyFlash(val); } catch (x) { toast('Gagal copy', 'error'); }
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
  var colDefs = _mfData.colDefs || [];
  var awbRows = _mfData.awbRows || [];
  var hRows   = _mfData.headerRows || [];
  if (!colDefs.length) { toast('Tidak ada data manifest', 'error'); return; }

  var order   = _buildMfRenderOrder(colDefs);
  var csvRows = [];

  csvRows.push(['"#"'].concat(order.map(function (ci) {
    var h = hRows[0] && hRows[0][colDefs[ci].colIdx] ? hRows[0][colDefs[ci].colIdx] : '';
    return '"' + h + '"';
  })).join(','));
  csvRows.push(['""'].concat(order.map(function (ci) {
    var h = hRows[1] && hRows[1][colDefs[ci].colIdx] ? hRows[1][colDefs[ci].colIdx] : '';
    return '"' + h + '"';
  })).join(','));
  csvRows.push(['""'].concat(order.map(function (ci) {
    var c = colDefs[ci];
    return '"' + (c.isDate ? 'DATE' : (c.tujuan || '')) + '"';
  })).join(','));
  awbRows.forEach(function (row, i) {
    csvRows.push(['"' + (i + 1) + '"'].concat(order.map(function (ci) {
      return '"' + (row[colDefs[ci].colIdx] || '') + '"';
    })).join(','));
  });

  _downloadCSV(csvRows.join('\r\n'), 'manifest_export_' + _dateStr() + '.csv');
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
  var ql      = q.toLowerCase();
  var results = allScanAwbs.filter(function (item) { return (item.awb || '').toLowerCase().indexOf(ql) !== -1; });
  hdr.innerHTML = '<span class="material-icons-round">' + (results.length ? 'check_circle' : 'search_off') + '</span> ' +
    (results.length ? results.length + ' hasil untuk "' + escH(q) + '"' : 'Tidak ada hasil untuk "' + escH(q) + '"');
  if (!results.length) {
    body.innerHTML = '<div class="search-awb-empty"><span class="material-icons-round">hourglass_empty</span>Mencari di server...</div>';
    gasGet('searchAwb', { q: q }).then(function (res) {
      var list = res.list || [];
      hdr.innerHTML = '<span class="material-icons-round">' + (list.length ? 'check_circle' : 'search_off') + '</span> ' +
        (list.length ? list.length + ' hasil untuk "' + escH(q) + '"' : 'AWB tidak ditemukan');
      body.innerHTML = list.length
        ? list.map(function (r) { return _searchItem(r, q); }).join('')
        : '<div class="search-awb-empty"><span class="material-icons-round">search_off</span>AWB tidak ditemukan</div>';
    }).catch(function () {
      body.innerHTML = '<div class="search-awb-empty"><span class="material-icons-round">search_off</span>AWB tidak ditemukan</div>';
    });
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

function clearSearchAwb() {
  document.getElementById('searchAwbMainInput').value = '';
  doSearchAwb('');
}

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
// PAGE SWITCHING — pakai requestAnimationFrame agar klik sidebar instant
// ═══════════════════════════════════════════════════════════════════

// Override switchPage dari incharge.js agar pakai rAF
var _origSwitchPage = switchPage;
switchPage = function(page) {
  // Sembunyikan semua page dulu secara sinkron (cepat)
  var pages = ['ob', 'hvs', 'ib', 'manifest', 'obib', 'search'];
  pages.forEach(function (p) {
    var el = document.getElementById('page-' + p);
    if (el) el.style.display = 'none';
    var n = document.getElementById('nav-' + p);
    if (n) n.classList.remove('active');
  });
  // Aktifkan nav item target segera
  var navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');
  var titleMap = {
    ob      : 'Outbound BDO <span class="topbar-sub">Log pengiriman keluar dari hub</span>',
    hvs     : 'Outbound HVS <span class="topbar-sub">High Value Shipment keluar</span>',
    ib      : 'Inbound HVS <span class="topbar-sub">High Value Shipment masuk</span>',
    manifest: 'Manifest <span class="topbar-sub">Rekap AWB per incharge &amp; tujuan</span>',
    obib    : 'OB &amp; IB <span class="topbar-sub">Combined view</span>',
    search  : 'Cari AWB <span class="topbar-sub">Pencarian AWB di semua data</span>'
  };
  document.getElementById('topbarTitle').innerHTML = titleMap[page] || page;

  // Render page target di frame berikutnya agar browser sempat repaint dulu
  requestAnimationFrame(function () {
    var target = document.getElementById('page-' + page);
    if (target) target.style.display = '';
    if (page === 'manifest') loadManifestPage();
    if (page === 'obib') renderObibPage();
    if (page === 'search') {
      setTimeout(function () {
        var inp = document.getElementById('searchAwbMainInput');
        if (inp) inp.focus();
      }, 100);
    }
  });
};

// ═══════════════════════════════════════════════════════════════════
// EXPORT CSV
// ═══════════════════════════════════════════════════════════════════

function exportCSV() {
  var pages  = ['ob', 'hvs', 'ib', 'manifest', 'obib'];
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
  data.forEach(function (r) {
    rows.push(headers.map(function (h) { return r[h] !== undefined ? r[h] : ''; }));
  });
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
