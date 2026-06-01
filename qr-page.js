/* ============================================================
   GTW BDO — qr-page.js v1.0
   Halaman QR Table: paste data dari web lain → tabel + QR
   ============================================================ */

(function () {
  'use strict';

  /* ── Inject CSS ── */
  function injectCSS() {
    if (document.getElementById('_qrPageCSS')) return;
    var s = document.createElement('style');
    s.id = '_qrPageCSS';
    s.textContent = `

/* ══ PAGE WRAPPER ══ */
#page-qr {
  display: none;
  flex-direction: column;
  gap: 14px;
}

/* ══ PASTE ZONE ══ */
.qr-paste-panel {
  background: var(--surface);
  border: 1px solid var(--surface-3);
  border-radius: var(--r2);
  box-shadow: var(--shadow-xs);
  overflow: hidden;
}
.qr-paste-hdr {
  background: var(--ink);
  padding: 11px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
  border-radius: var(--r2) var(--r2) 0 0;
}
.qr-paste-hdr-title {
  color: rgba(255,255,255,.9);
  font-weight: 600;
  font-size: 12.5px;
  display: flex;
  align-items: center;
  gap: 8px;
  letter-spacing: -.01em;
}
.qr-paste-hdr-title .material-icons-round { font-size: 16px; color: rgba(255,255,255,.55); }

.qr-paste-body {
  padding: 16px 18px;
}

.qr-paste-area-wrap {
  position: relative;
  border: 1.5px dashed var(--surface-3);
  border-radius: var(--r);
  transition: border-color .2s, background .2s;
  background: var(--surface-1);
  margin-bottom: 12px;
}
.qr-paste-area-wrap.focused {
  border-color: var(--accent-mid);
  background: var(--accent-faint);
}
.qr-paste-area-label {
  position: absolute;
  top: 10px; left: 12px;
  font-size: 9.5px;
  font-weight: 700;
  color: var(--ink-faint);
  text-transform: uppercase;
  letter-spacing: 1.5px;
  pointer-events: none;
  transition: color .2s;
}
.qr-paste-area-wrap.focused .qr-paste-area-label { color: var(--accent); }

.qr-paste-textarea {
  width: 100%;
  min-height: 88px;
  background: transparent;
  border: none;
  outline: none;
  resize: vertical;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--ink);
  line-height: 1.65;
  padding: 28px 12px 10px;
  caret-color: var(--accent);
}
.qr-paste-textarea::placeholder { color: var(--ink-ghost); }

.qr-paste-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--ink-faint);
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.qr-paste-hint kbd {
  background: var(--surface-2);
  border: 1px solid var(--surface-3);
  border-radius: 4px;
  padding: 1px 6px;
  font-family: var(--mono);
  font-size: 10.5px;
  color: var(--ink-mid);
}

.qr-paste-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

/* ══ STATS BAR ══ */
.qr-stats-bar {
  display: flex;
  gap: 18px;
  padding: 8px 18px;
  background: var(--accent-faint);
  border-top: 1px solid var(--accent-light);
  font-size: 11.5px;
  color: var(--ink-low);
  font-family: var(--mono);
  flex-wrap: wrap;
}
.qr-stats-bar strong { color: var(--accent); font-weight: 700; }

/* ══ RESULT TABLE ══ */
.qr-result-panel {
  background: var(--surface);
  border: 1px solid var(--surface-3);
  border-radius: var(--r2);
  box-shadow: var(--shadow-xs);
  overflow: hidden;
}
.qr-result-toolbar {
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 9px;
  border-bottom: 1px solid var(--surface-2);
  flex-wrap: wrap;
}
.qr-result-title {
  font-weight: 700;
  font-size: 13px;
  color: var(--ink);
  flex: 1;
  letter-spacing: -.01em;
}
.qr-table-wrap {
  overflow-x: auto;
}
.qr-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
.qr-table thead tr { background: var(--surface-1); }
.qr-table th {
  padding: 9px 12px;
  text-align: left;
  font-weight: 700;
  font-size: 10px;
  color: var(--ink-low);
  text-transform: uppercase;
  letter-spacing: .8px;
  white-space: nowrap;
  border-bottom: 1px solid var(--surface-3);
}
.qr-table th.qr-th-qr { width: 72px; text-align: center; }
.qr-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--surface-2);
  vertical-align: middle;
}
.qr-table tr:last-child td { border-bottom: none; }
.qr-table tbody tr:hover td { background: var(--accent-faint); }

.qr-img-cell { text-align: center; padding: 6px 8px !important; }
.qr-img-cell img {
  display: block;
  margin: 0 auto;
  border: 1px solid var(--surface-3);
  border-radius: 4px;
  background: #fff;
  image-rendering: pixelated;
}

.qr-cell-code {
  display: inline-flex;
  align-items: center;
  background: var(--accent-faint);
  color: var(--accent);
  border: 1px solid var(--accent-light);
  border-radius: 4px;
  padding: 2px 8px;
  font-family: var(--mono);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: .3px;
}
.qr-cell-code.green {
  background: var(--green-light);
  color: var(--green);
  border-color: #A7F3D0;
}
.qr-cell-code.orange {
  background: var(--orange-light);
  color: var(--orange);
  border-color: #FDE68A;
}

.qr-row-num {
  color: var(--ink-faint);
  font-size: 10px;
  font-family: var(--mono);
  text-align: center;
  min-width: 28px;
}

/* ══ EMPTY STATE ══ */
.qr-empty {
  padding: 52px 24px;
  text-align: center;
  color: var(--ink-faint);
}
.qr-empty .material-icons-round {
  font-size: 42px;
  color: var(--ink-ghost);
  display: block;
  margin-bottom: 10px;
}
.qr-empty p {
  font-size: 12.5px;
  line-height: 1.8;
  color: var(--ink-low);
}
.qr-empty strong { color: var(--accent); }

/* ══ PRINT / DOWNLOAD ══ */
@media print {
  .sidebar, .topbar, .qr-paste-panel, .qr-result-toolbar { display: none !important; }
  #page-qr { display: block !important; }
  .qr-result-panel { box-shadow: none; border: none; }
}

    `;
    document.head.appendChild(s);
  }

  /* ── Inject halaman ke DOM ── */
  function injectPage() {
    if (document.getElementById('page-qr')) return;

    /* Tambah ke #mainContent */
    var content = document.getElementById('mainContent');
    if (!content) return;

    var div = document.createElement('div');
    div.id = 'page-qr';
    div.style.display = 'none';
    div.innerHTML = `
      <!-- PASTE PANEL -->
      <div class="qr-paste-panel">
        <div class="qr-paste-hdr" onclick="_qrTogglePaste()">
          <div class="qr-paste-hdr-title">
            <span class="material-icons-round">qr_code_scanner</span>
            Paste Data → Generate QR
          </div>
          <span class="material-icons-round" id="qrPasteIcon"
            style="color:rgba(255,255,255,.4);font-size:18px">expand_more</span>
        </div>
        <div class="qr-paste-body" id="qrPasteBody">
          <div class="qr-paste-area-wrap" id="qrPasteWrap">
            <span class="qr-paste-area-label">▸ Area Paste Data</span>
            <textarea
              class="qr-paste-textarea"
              id="qrPasteTA"
              placeholder="Klik di sini lalu Ctrl+V — paste tabel dari web / spreadsheet lain&#10;&#10;Setiap baris = 1 QR Code&#10;Kolom dipisah Tab, baris dipisah Enter"></textarea>
          </div>
          <div class="qr-paste-hint">
            <kbd>Ctrl</kbd>+<kbd>V</kbd> paste dari web / spreadsheet
            &nbsp;·&nbsp;
            Kolom dipisah <kbd>Tab</kbd>
            &nbsp;·&nbsp;
            QR otomatis per baris
          </div>
          <div class="qr-paste-actions">
            <button class="btn btn-primary btn-sm" onclick="_qrGenerate()">
              <span class="material-icons-round">qr_code</span> Generate QR
            </button>
            <button class="btn btn-outline btn-sm" onclick="_qrClear()">
              <span class="material-icons-round">clear</span> Clear
            </button>
            <button class="btn btn-outline btn-sm" onclick="_qrPrint()" id="qrPrintBtn" style="display:none">
              <span class="material-icons-round">print</span> Print
            </button>
          </div>
        </div>
        <div class="qr-stats-bar" id="qrStatsBar" style="display:none">
          <span>Baris: <strong id="qrStatRows">0</strong></span>
          <span>Kolom: <strong id="qrStatCols">0</strong></span>
          <span>QR dibuat: <strong id="qrStatQr">0</strong></span>
        </div>
      </div>

      <!-- RESULT TABLE -->
      <div class="qr-result-panel" id="qrResultPanel">
        <div class="qr-result-toolbar">
          <div class="qr-result-title">
            QR Table
            <span style="color:var(--ink-low);font-weight:400" id="qrTableCount"></span>
          </div>
          <div class="search-box">
            <span class="material-icons-round">search</span>
            <input id="qrSearch" placeholder="Cari data..." oninput="_qrFilterTable()">
          </div>
        </div>
        <div class="qr-table-wrap" id="qrTableWrap">
          <div class="qr-empty">
            <span class="material-icons-round">qr_code</span>
            <p>Paste data dari web lain di atas<br>
            lalu klik <strong>Generate QR</strong><br>
            Setiap baris otomatis mendapat QR Code</p>
          </div>
        </div>
      </div>
    `;
    content.appendChild(div);
  }

  /* ── Inject nav item ke sidebar ── */
  function injectNav() {
    if (document.getElementById('nav-qr')) return;
    var nav = document.querySelector('.sidebar-nav');
    if (!nav) return;

    /* Tambah divider + label baru */
    var divider = document.createElement('div');
    divider.className = 'nav-divider';

    var label = document.createElement('div');
    label.className = 'nav-section-label';
    label.textContent = 'Tools';

    var item = document.createElement('div');
    item.className = 'nav-item';
    item.id = 'nav-qr';
    item.setAttribute('data-tooltip', 'QR Table');
    item.onclick = function () { switchPage('qr'); };
    item.innerHTML = `
      <div class="nav-icon-wrap" style="background:rgba(6,182,212,.18)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="7" height="7" rx="1" stroke="#22D3EE" stroke-width="1.8"/>
          <rect x="14" y="3" width="7" height="7" rx="1" stroke="#22D3EE" stroke-width="1.8"/>
          <rect x="3" y="14" width="7" height="7" rx="1" stroke="#67E8F9" stroke-width="1.8"/>
          <path d="M14 14h2v2h-2zM18 14h3M14 18h3M18 18v3M21 18h0" stroke="#67E8F9" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <span class="nav-label">QR Table</span>
      <span class="nav-active-dot"></span>
    `;

    nav.appendChild(divider);
    nav.appendChild(label);
    nav.appendChild(item);
  }

  /* ── Patch switchPage agar mengenali 'qr' ── */
  function patchSwitchPage() {
    var _orig = window.switchPage;
    window.switchPage = function (page) {
      if (page !== 'qr') { _orig(page); return; }

      /* Sembunyikan semua halaman */
      var all = ['ob','hvs','ib','manifest','obib','search','qr'];
      all.forEach(function (p) {
        var el = document.getElementById('page-' + p);
        if (el) el.style.display = 'none';
        var n = document.getElementById('nav-' + p);
        if (n) n.classList.remove('active');
      });

      var target = document.getElementById('page-qr');
      if (target) {
        target.style.display = 'flex';
        requestAnimationFrame(function () {
          target.style.display = 'flex';
        });
      }
      var navEl = document.getElementById('nav-qr');
      if (navEl) navEl.classList.add('active');

      var titleEl = document.getElementById('topbarTitle');
      if (titleEl) titleEl.innerHTML = 'QR Table <span class="topbar-sub">Paste data → generate QR Code per baris</span>';

      /* Focus textarea */
      setTimeout(function () {
        var ta = document.getElementById('qrPasteTA');
        if (ta) ta.focus();
      }, 120);
    };
  }

  /* ── State ── */
  var _qrRows    = [];   // semua rows parsed
  var _qrFiltered = [];  // setelah filter pencarian

  /* ── Toggle paste panel ── */
  window._qrTogglePaste = function () {
    var body = document.getElementById('qrPasteBody');
    var icon = document.getElementById('qrPasteIcon');
    if (!body) return;
    var isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : '';
    if (icon) icon.innerText = isOpen ? 'expand_more' : 'expand_less';
  };

  /* ── Parse textarea ── */
  function _parse(raw) {
    return raw.trim().split('\n')
      .map(function (r) { return r.split('\t').map(function (c) { return c.trim(); }); })
      .filter(function (r) { return r.some(function (c) { return c.length > 0; }); });
  }

  /* ── QR URL via api.qrserver.com ── */
  function _qrUrl(text, size) {
    size = size || 72;
    return 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size +
      '&data=' + encodeURIComponent(text);
  }

  /* ── Deteksi apakah nilai terlihat seperti kode/ID ── */
  function _isCode(val) {
    return /^(BAG|BDO|GTW|CGK|HVS|OB|IB|[A-Z]{2,}-[A-Z0-9\-]{3,})/i.test(val) ||
           /^[A-Z0-9\-]{8,}$/.test(val);
  }

  function _cellHtml(val) {
    if (!val) return '<span style="color:var(--ink-ghost)">—</span>';
    if (_isCode(val)) return '<span class="qr-cell-code">' + _escH(val) + '</span>';
    /* Deteksi status */
    if (/selesai/i.test(val)) return '<span class="qr-cell-code green">' + _escH(val) + '</span>';
    if (/proses/i.test(val)) return '<span class="qr-cell-code orange">' + _escH(val) + '</span>';
    return _escH(val);
  }

  function _escH(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Generate ── */
  window._qrGenerate = function () {
    var raw = (document.getElementById('qrPasteTA').value || '').trim();
    if (!raw) {
      if (typeof toast === 'function') toast('Paste data terlebih dahulu', 'error');
      return;
    }
    _qrRows = _parse(raw);
    if (!_qrRows.length) {
      if (typeof toast === 'function') toast('Tidak ada data yang dapat diproses', 'error');
      return;
    }

    /* Stats */
    var maxCols = Math.max.apply(null, _qrRows.map(function (r) { return r.length; }));
    document.getElementById('qrStatRows').textContent = _qrRows.length;
    document.getElementById('qrStatCols').textContent = maxCols;
    document.getElementById('qrStatQr').textContent   = _qrRows.length;
    document.getElementById('qrStatsBar').style.display = 'flex';
    document.getElementById('qrPrintBtn').style.display  = '';
    document.getElementById('qrTableCount').textContent  = '— ' + _qrRows.length + ' baris';

    _qrFiltered = _qrRows;
    _qrRender(_qrRows, maxCols);

    /* Collapse paste panel setelah generate */
    var body = document.getElementById('qrPasteBody');
    var icon = document.getElementById('qrPasteIcon');
    if (body) body.style.display = 'none';
    if (icon) icon.innerText = 'expand_more';
  };

  function _qrRender(rows, maxCols) {
    if (!maxCols) maxCols = Math.max.apply(null, rows.map(function (r) { return r.length; }));
    var wrap = document.getElementById('qrTableWrap');
    if (!rows.length) {
      wrap.innerHTML = '<div class="qr-empty"><span class="material-icons-round">qr_code</span><p>Tidak ada data</p></div>';
      return;
    }

    /* Header */
    var thCols = '<th class="qr-th-qr">QR</th><th style="min-width:28px">#</th>';
    for (var i = 0; i < maxCols; i++) {
      thCols += '<th>Kol ' + (i + 1) + '</th>';
    }

    /* Rows */
    var tbodyHtml = rows.map(function (row, ri) {
      /* Gabung semua kolom jadi satu string untuk isi QR */
      var qrContent = row.filter(function (c) { return c; }).join(' | ');
      var imgHtml = qrContent
        ? '<img src="' + _qrUrl(qrContent) + '" width="64" height="64" loading="lazy" alt="QR">'
        : '<span style="color:var(--ink-ghost);font-size:11px">—</span>';

      var tds = '<td class="qr-img-cell">' + imgHtml + '</td>';
      tds += '<td class="qr-row-num">' + (ri + 1) + '</td>';
      for (var ci = 0; ci < maxCols; ci++) {
        tds += '<td>' + _cellHtml(row[ci] || '') + '</td>';
      }
      return '<tr style="animation:fp2ItemIn .2s ease ' + Math.min(ri * 20, 400) + 'ms both">' + tds + '</tr>';
    }).join('');

    wrap.innerHTML =
      '<table class="qr-table">' +
        '<thead><tr>' + thCols + '</tr></thead>' +
        '<tbody>' + tbodyHtml + '</tbody>' +
      '</table>';
  }

  /* ── Filter ── */
  window._qrFilterTable = function () {
    if (!_qrRows.length) return;
    var q = (document.getElementById('qrSearch').value || '').toLowerCase();
    var maxCols = Math.max.apply(null, _qrRows.map(function (r) { return r.length; }));
    if (!q) {
      _qrFiltered = _qrRows;
    } else {
      _qrFiltered = _qrRows.filter(function (row) {
        return row.some(function (c) { return c.toLowerCase().indexOf(q) !== -1; });
      });
    }
    document.getElementById('qrTableCount').textContent = '— ' + _qrFiltered.length + ' baris';
    _qrRender(_qrFiltered, maxCols);
  };

  /* ── Clear ── */
  window._qrClear = function () {
    document.getElementById('qrPasteTA').value = '';
    _qrRows    = [];
    _qrFiltered = [];
    document.getElementById('qrStatsBar').style.display  = 'none';
    document.getElementById('qrPrintBtn').style.display  = 'none';
    document.getElementById('qrTableCount').textContent  = '';
    document.getElementById('qrTableWrap').innerHTML =
      '<div class="qr-empty">' +
        '<span class="material-icons-round">qr_code</span>' +
        '<p>Paste data dari web lain di atas<br>' +
        'lalu klik <strong>Generate QR</strong><br>' +
        'Setiap baris otomatis mendapat QR Code</p>' +
      '</div>';
    /* Buka kembali paste panel */
    var body = document.getElementById('qrPasteBody');
    var icon = document.getElementById('qrPasteIcon');
    if (body) body.style.display = '';
    if (icon) icon.innerText = 'expand_less';
  };

  /* ── Print ── */
  window._qrPrint = function () {
    window.print();
  };

  /* ── Bind textarea events ── */
  function bindEvents() {
    var ta   = document.getElementById('qrPasteTA');
    var wrap = document.getElementById('qrPasteWrap');
    if (!ta || !wrap) return;

    ta.addEventListener('focus',  function () { wrap.classList.add('focused'); });
    ta.addEventListener('blur',   function () { wrap.classList.remove('focused'); });
    ta.addEventListener('paste',  function () { setTimeout(window._qrGenerate, 120); });
  }

  /* ── INIT ── */
  function init() {
    injectCSS();
    injectPage();
    injectNav();
    patchSwitchPage();
    setTimeout(bindEvents, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 500); });
  } else {
    setTimeout(init, 500);
  }

})();
