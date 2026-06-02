/* ============================================================
   GTW BDO — qr-page.js v2.0
   Session QR per Incharge:
   - Web pilih incharge → session_key = nama incharge (lowercase)
   - Mobile baca sesuai incharge aktif
   ============================================================ */

(function () {
  'use strict';

  function injectCSS() {
    if (document.getElementById('_qrPageCSS')) return;
    var s = document.createElement('style');
    s.id = '_qrPageCSS';
    s.textContent = `
#page-qr {
  --qr-bg:      #0d1117;
  --qr-surface: #161b22;
  --qr-surface2:#1c2128;
  --qr-surface3:#21262d;
  --qr-border:  #30363d;
  --qr-border2: #3d444d;
  --qr-text:    #e6edf3;
  --qr-muted:   #7d8590;
  --qr-accent:  #2f81f7;
  --qr-accent2: #58a6ff;
  --qr-green:   #3fb950;
  --qr-orange:  #d29922;
}
#page-qr {
  display: none;
  flex-direction: column;
  gap: 14px;
  background: var(--qr-bg);
  min-height: calc(100vh - 52px);
  margin: -18px -20px;
  padding: 18px 20px;
}

/* ── INCHARGE SELECTOR BAR ── */
.qr-ic-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 10px;
  padding: 10px 16px;
  flex-wrap: wrap;
}
.qr-ic-bar-label {
  font-size: 10px;
  font-weight: 700;
  color: #7d8590;
  text-transform: uppercase;
  letter-spacing: 1px;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 5px;
}
.qr-ic-bar-label .material-icons-round { font-size: 14px; color: #58a6ff; }
.qr-ic-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #3d444d; flex-shrink: 0;
  transition: background .3s;
}
.qr-ic-dot.active {
  background: #3fb950;
  box-shadow: 0 0 0 3px rgba(63,185,80,.2);
}
.qr-ic-select {
  flex: 1; min-width: 160px;
  appearance: none; -webkit-appearance: none;
  background: #21262d url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%237d8590'/%3E%3C/svg%3E") no-repeat right 10px center;
  border: 1px solid #3d444d; border-radius: 7px;
  color: #e6edf3; font-size: 12.5px; font-weight: 600;
  padding: 7px 28px 7px 10px; outline: none; cursor: pointer;
  transition: border-color .15s;
}
.qr-ic-select:focus { border-color: #2f81f7; }
.qr-ic-select option { background: #1c2128; }
.qr-ic-session-key {
  font-size: 10.5px;
  color: #7d8590;
  font-family: 'JetBrains Mono', monospace;
  background: #21262d;
  border: 1px solid #30363d;
  border-radius: 5px;
  padding: 3px 8px;
  white-space: nowrap;
}
.qr-ic-session-key span { color: #58a6ff; }

/* PASTE PANEL */
.qr-paste-panel {
  background: var(--qr-surface);
  border: 1px solid var(--qr-border);
  border-radius: 12px;
  overflow: hidden;
}
.qr-paste-hdr {
  background: linear-gradient(135deg,#161b22 0%,#1c2128 100%);
  border-bottom: 1px solid var(--qr-border);
  padding: 12px 18px;
  display: flex; align-items: center; justify-content: space-between;
  cursor: pointer; user-select: none;
}
.qr-paste-hdr-title {
  color: var(--qr-text); font-weight: 600; font-size: 12.5px;
  display: flex; align-items: center; gap: 8px;
}
.qr-paste-hdr-title .material-icons-round { font-size: 16px; color: var(--qr-accent2); }
.qr-paste-body { padding: 16px 18px; }

.qr-no-ic-warn {
  display: none;
  align-items: center; gap: 8px;
  background: rgba(210,153,34,.12);
  border: 1px solid rgba(210,153,34,.3);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 12px; color: #d29922;
  margin-bottom: 12px;
}
.qr-no-ic-warn .material-icons-round { font-size: 16px; }
.qr-no-ic-warn.show { display: flex; }

.qr-paste-area-wrap {
  position: relative;
  border: 1.5px dashed var(--qr-border2);
  border-radius: 8px;
  background: var(--qr-surface2);
  margin-bottom: 12px;
  transition: border-color .2s, background .2s;
}
.qr-paste-area-wrap.focused {
  border-color: var(--qr-accent);
  background: rgba(47,129,247,.06);
}
.qr-paste-area-label {
  position: absolute; top: 10px; left: 12px;
  font-size: 9.5px; font-weight: 700; color: var(--qr-muted);
  text-transform: uppercase; letter-spacing: 1.5px;
  pointer-events: none; transition: color .2s;
}
.qr-paste-area-wrap.focused .qr-paste-area-label { color: var(--qr-accent2); }
.qr-paste-textarea {
  width: 100%; min-height: 88px; background: transparent;
  border: none; outline: none; resize: vertical;
  font-family: 'JetBrains Mono', monospace; font-size: 12px;
  color: var(--qr-text); line-height: 1.65; padding: 28px 12px 10px;
  caret-color: var(--qr-accent2);
}
.qr-paste-textarea::placeholder { color: var(--qr-border2); }

/* KOLOM QR SELECTOR */
.qr-col-row {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 12px; flex-wrap: wrap;
}
.qr-col-label {
  font-size: 10px; font-weight: 700; color: var(--qr-muted);
  text-transform: uppercase; letter-spacing: 1px; white-space: nowrap;
}
.qr-col-select-wrap {
  display: flex; align-items: center; gap: 6px; flex: 1; flex-wrap: wrap;
}
.qr-col-select {
  appearance: none; -webkit-appearance: none;
  background: var(--qr-surface3) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%237d8590'/%3E%3C/svg%3E") no-repeat right 10px center;
  border: 1px solid var(--qr-border2); border-radius: 6px;
  color: var(--qr-text); font-family: 'JetBrains Mono', monospace;
  font-size: 12px; font-weight: 600; padding: 5px 28px 5px 10px;
  cursor: pointer; outline: none; min-width: 140px;
  transition: border-color .15s;
}
.qr-col-select:focus { border-color: var(--qr-accent); }
.qr-col-select option { background: var(--qr-surface2); color: var(--qr-text); }
.qr-col-input-wrap {
  display: flex; align-items: center; gap: 5px;
}
.qr-col-input-label {
  font-size: 10px; color: var(--qr-muted); white-space: nowrap;
}
.qr-col-input {
  width: 52px; background: var(--qr-surface3); border: 1px solid var(--qr-border2);
  border-radius: 6px; color: var(--qr-text); font-family: 'JetBrains Mono', monospace;
  font-size: 12px; font-weight: 600; padding: 5px 8px; outline: none;
  text-align: center; transition: border-color .15s;
}
.qr-col-input:focus { border-color: var(--qr-accent); }
.qr-col-input::-webkit-inner-spin-button { -webkit-appearance: none; }
.qr-col-hint {
  font-size: 11px; color: var(--qr-muted); font-family: 'JetBrains Mono', monospace;
  width: 100%;
}

.qr-paste-hint {
  display: flex; align-items: center; gap: 8px; font-size: 11px;
  color: var(--qr-muted); margin-bottom: 12px; flex-wrap: wrap;
}
.qr-paste-hint kbd {
  background: var(--qr-surface3); border: 1px solid var(--qr-border2);
  border-radius: 4px; padding: 1px 6px;
  font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--qr-text);
}
.qr-paste-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.qr-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600;
  cursor: pointer; border: none; font-family: inherit; transition: all .15s; white-space: nowrap;
}
.qr-btn .material-icons-round { font-size: 14px; }
.qr-btn-primary { background: var(--qr-accent); color: #fff; }
.qr-btn-primary:hover { background: #388bfd; }
.qr-btn-primary:disabled { background: #3d444d; color: #7d8590; cursor: not-allowed; }
.qr-btn-outline { background: transparent; border: 1px solid var(--qr-border2); color: var(--qr-muted); }
.qr-btn-outline:hover { border-color: var(--qr-accent2); color: var(--qr-accent2); }

/* STATS */
.qr-stats-bar {
  display: flex; gap: 20px; padding: 8px 18px;
  background: rgba(47,129,247,.08); border-top: 1px solid rgba(47,129,247,.2);
  font-size: 11.5px; color: var(--qr-muted);
  font-family: 'JetBrains Mono', monospace; flex-wrap: wrap;
}
.qr-stats-bar strong { color: var(--qr-accent2); font-weight: 700; }

/* RESULT */
.qr-result-panel {
  background: var(--qr-surface); border: 1px solid var(--qr-border);
  border-radius: 12px; overflow: hidden;
}
.qr-result-toolbar {
  padding: 10px 16px; display: flex; align-items: center; gap: 9px;
  border-bottom: 1px solid var(--qr-border); background: var(--qr-surface2); flex-wrap: wrap;
}
.qr-result-title { font-weight: 700; font-size: 13px; color: var(--qr-text); flex: 1; }
.qr-search-box {
  display: flex; align-items: center; background: var(--qr-surface3);
  border: 1px solid var(--qr-border); border-radius: 7px; padding: 5px 10px;
  gap: 6px; transition: border-color .15s;
}
.qr-search-box:focus-within { border-color: var(--qr-accent); }
.qr-search-box input {
  border: none; outline: none; background: transparent; font-size: 12px;
  width: 160px; color: var(--qr-text); font-family: inherit;
}
.qr-search-box input::placeholder { color: var(--qr-border2); }
.qr-search-box .material-icons-round { font-size: 14px; color: var(--qr-muted); }

/* TABLE */
.qr-table-wrap { overflow-x: auto; }
.qr-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.qr-table thead tr { background: var(--qr-surface2); }
.qr-table th {
  padding: 9px 12px; text-align: left; font-weight: 700; font-size: 10px;
  color: var(--qr-muted); text-transform: uppercase; letter-spacing: .8px;
  white-space: nowrap; border-bottom: 1px solid var(--qr-border);
}
.qr-table th.qr-th-qr { width: 72px; text-align: center; }
.qr-table th.qr-th-active { color: var(--qr-accent2) !important; }
.qr-table td {
  padding: 8px 12px; border-bottom: 1px solid var(--qr-border);
  vertical-align: middle; color: var(--qr-text);
}
.qr-table tr:last-child td { border-bottom: none; }
.qr-table tbody tr:hover td { background: rgba(47,129,247,.07); }
.qr-td-active { background: rgba(47,129,247,.05) !important; }

.qr-img-cell { text-align: center; padding: 6px 8px !important; }
.qr-img-cell img {
  display: block; margin: 0 auto; border: 1px solid var(--qr-border2);
  border-radius: 4px; background: #fff; image-rendering: pixelated;
}
.qr-cell-code {
  display: inline-flex; align-items: center;
  background: rgba(47,129,247,.12); color: var(--qr-accent2);
  border: 1px solid rgba(47,129,247,.25); border-radius: 4px;
  padding: 2px 8px; font-family: 'JetBrains Mono', monospace;
  font-size: 11.5px; font-weight: 600;
}
.qr-cell-code.green { background: rgba(63,185,80,.12); color: var(--qr-green); border-color: rgba(63,185,80,.25); }
.qr-cell-code.orange { background: rgba(210,153,34,.12); color: var(--qr-orange); border-color: rgba(210,153,34,.25); }
.qr-row-num { color: var(--qr-muted); font-size: 10px; font-family: 'JetBrains Mono', monospace; text-align: center; min-width: 28px; }

.qr-empty { padding: 52px 24px; text-align: center; }
.qr-empty .material-icons-round { font-size: 42px; color: var(--qr-border2); display: block; margin-bottom: 10px; }
.qr-empty p { font-size: 12.5px; line-height: 1.8; color: var(--qr-muted); }
.qr-empty strong { color: var(--qr-accent2); }

/* ── RESPONSIVE MOBILE ── */
@media (max-width: 640px) {
  #page-qr { margin: -18px -12px; padding: 12px; gap: 10px; }
  .qr-paste-body { padding: 12px; }
  .qr-paste-hdr { padding: 10px 12px; }
  .qr-paste-textarea { font-size: 13px; min-height: 72px; padding: 26px 10px 8px; }
  .qr-col-row { flex-direction: column; align-items: flex-start; gap: 6px; }
  .qr-col-select-wrap { width: 100%; }
  .qr-col-select { width: 100%; min-width: unset; font-size: 13px; padding: 8px 28px 8px 10px; }
  .qr-col-input-wrap { width: 100%; }
  .qr-col-input { width: 60px; font-size: 13px; padding: 7px 8px; }
  .qr-paste-hint { font-size: 10.5px; gap: 5px; }
  .qr-paste-actions { gap: 6px; }
  .qr-btn { padding: 9px 14px; font-size: 12.5px; border-radius: 8px; }
  .qr-btn .material-icons-round { font-size: 15px; }
  .qr-stats-bar { gap: 12px; padding: 8px 12px; font-size: 11px; }
  .qr-result-toolbar { padding: 8px 10px; gap: 6px; flex-wrap: wrap; }
  .qr-result-title { font-size: 12.5px; width: 100%; }
  .qr-search-box { flex: 1; }
  .qr-search-box input { width: 100%; font-size: 13px; }
  .qr-table-wrap { -webkit-overflow-scrolling: touch; }
  .qr-table { font-size: 12px; }
  .qr-table th { padding: 7px 8px; font-size: 9.5px; }
  .qr-table td { padding: 6px 8px; }
  .qr-img-cell { padding: 4px 6px !important; }
  .qr-img-cell img { width: 80px !important; height: 80px !important; }
  .qr-empty { padding: 36px 16px; }
  .qr-empty p { font-size: 12px; }
}

@media print {
  .sidebar,.topbar,.qr-paste-panel,.qr-result-toolbar { display: none !important; }
  #page-qr { display: block !important; background: #fff !important; }
}
    `;
    document.head.appendChild(s);
  }

  /* ── Collect incharge list from global state ── */
  function _getInchargeList() {
    // Coba ambil dari CONFIG atau state global yang sudah ada di aplikasi
    var list = [];
    if (typeof CONFIG !== 'undefined' && Array.isArray(CONFIG.INCHARGE_LIST)) {
      list = CONFIG.INCHARGE_LIST;
    } else if (typeof INCHARGE_LIST !== 'undefined' && Array.isArray(INCHARGE_LIST)) {
      list = INCHARGE_LIST;
    } else if (typeof window._inchargeList !== 'undefined') {
      list = window._inchargeList;
    }
    return list;
  }

  /* ── Get active incharge from global widget ── */
  function _getActiveIncharge() {
    // Coba dari global state dulu
    if (typeof window._currentIncharge === 'string' && window._currentIncharge) {
      return window._currentIncharge;
    }
    // Fallback: baca dari input widget topbar
    var inp = document.getElementById('globalInchargeInput');
    if (inp && inp.value && inp.value.trim()) return inp.value.trim();
    return '';
  }

  /* ── session_key helper: pakai nama incharge lowercase ── */
  function _sessionKey(ic) {
    if (!ic) return '';
    return 'ic_' + ic.toLowerCase().replace(/\s+/g, '_');
  }

  function injectPage() {
    if (document.getElementById('page-qr')) return;
    var content = document.getElementById('mainContent');
    if (!content) return;
    var div = document.createElement('div');
    div.id = 'page-qr';
    div.style.display = 'none';
    div.innerHTML = `
      <!-- ── INCHARGE SELECTOR ── -->
      <div class="qr-ic-bar">
        <span class="qr-ic-bar-label">
          <span class="material-icons-round">person</span>
          Incharge QR
        </span>
        <div class="qr-ic-dot" id="qrIcDot"></div>
        <select class="qr-ic-select" id="qrIcSelect" onchange="_qrOnIcChange(this.value)">
          <option value="">— Pilih Incharge —</option>
        </select>
        <span class="qr-ic-session-key" id="qrIcSessionLabel" style="display:none">
          session: <span id="qrIcSessionVal">—</span>
        </span>
      </div>

      <div class="qr-paste-panel">
        <div class="qr-paste-hdr" onclick="_qrTogglePaste()">
          <div class="qr-paste-hdr-title">
            <span class="material-icons-round">qr_code_scanner</span>
            Paste Data → Generate QR
          </div>
          <span class="material-icons-round" id="qrPasteIcon" style="color:rgba(255,255,255,.35);font-size:18px">expand_less</span>
        </div>
        <div class="qr-paste-body" id="qrPasteBody">
          <!-- Warn jika belum pilih incharge -->
          <div class="qr-no-ic-warn" id="qrNoIcWarn">
            <span class="material-icons-round">warning_amber</span>
            Pilih <strong>Incharge</strong> di atas sebelum generate QR.
          </div>

          <div class="qr-paste-area-wrap" id="qrPasteWrap">
            <span class="qr-paste-area-label">▸ Area Paste Data</span>
            <textarea class="qr-paste-textarea" id="qrPasteTA"
              placeholder="Klik di sini lalu Ctrl+V — paste tabel dari web / spreadsheet lain&#10;&#10;Setiap baris = 1 QR Code&#10;Kolom dipisah Tab, baris dipisah Enter"></textarea>
          </div>
          <div class="qr-paste-hint">
            <kbd>Ctrl</kbd>+<kbd>V</kbd> paste dari web / spreadsheet
            &nbsp;·&nbsp; Kolom dipisah <kbd>Tab</kbd>
            &nbsp;·&nbsp; QR otomatis per baris
          </div>

          <div class="qr-col-row">
            <span class="qr-col-label">Kolom QR:</span>
            <div class="qr-col-select-wrap">
              <select class="qr-col-select" id="qrColSelect" onchange="_qrSetColFromSelect()">
                <option value="all">— Semua Kolom —</option>
              </select>
              <div class="qr-col-input-wrap" id="qrColInputWrap" style="display:none">
                <span class="qr-col-input-label">atau ketik no. kol:</span>
                <input type="number" class="qr-col-input" id="qrColInput" min="1" placeholder="1"
                  oninput="_qrSetColFromInput()" />
              </div>
            </div>
            <span class="qr-col-hint" id="qrColHint">QR = semua kolom digabung</span>
          </div>

          <div class="qr-paste-actions">
            <button class="qr-btn qr-btn-primary" id="qrBtnGenerate" onclick="_qrGenerate()" disabled>
              <span class="material-icons-round">qr_code</span> Generate QR
            </button>
            <button class="qr-btn qr-btn-outline" onclick="_qrClear()">
              <span class="material-icons-round">clear</span> Clear
            </button>
            <button class="qr-btn qr-btn-outline" onclick="window.print()" id="qrPrintBtn" style="display:none">
              <span class="material-icons-round">print</span> Print
            </button>
          </div>
        </div>
        <div class="qr-stats-bar" id="qrStatsBar" style="display:none">
          <span>Incharge: <strong id="qrStatIc">—</strong></span>
          <span>Baris: <strong id="qrStatRows">0</strong></span>
          <span>Kolom: <strong id="qrStatCols">0</strong></span>
          <span>QR dari: <strong id="qrStatCol">Semua</strong></span>
        </div>
      </div>

      <div class="qr-result-panel">
        <div class="qr-result-toolbar">
          <div class="qr-result-title">
            QR Table
            <span style="color:#7d8590;font-weight:400" id="qrTableCount"></span>
          </div>
          <div class="qr-search-box">
            <span class="material-icons-round">search</span>
            <input id="qrSearch" placeholder="Cari data..." oninput="_qrFilterTable()">
          </div>
        </div>
        <div class="qr-table-wrap" id="qrTableWrap">
          <div class="qr-empty">
            <span class="material-icons-round">qr_code</span>
            <p>Pilih <strong>Incharge</strong> lalu paste data di atas<br>
            dan klik <strong>Generate QR</strong><br>
            Setiap baris otomatis mendapat QR Code</p>
          </div>
        </div>
      </div>
    `;
    content.appendChild(div);
  }

  function injectNav() {
    if (document.getElementById('nav-qr')) return;
    var nav = document.querySelector('.sidebar-nav');
    if (!nav) return;
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

  function patchSwitchPage() {
    var _orig = window.switchPage;
    window.switchPage = function (page) {
      if (page !== 'qr') { _orig(page); return; }
      ['ob','hvs','ib','manifest','obib','search','qr'].forEach(function(p) {
        var el = document.getElementById('page-'+p); if (el) el.style.display = 'none';
        var n  = document.getElementById('nav-'+p);  if (n)  n.classList.remove('active');
      });
      requestAnimationFrame(function() {
        var t = document.getElementById('page-qr'); if (t) t.style.display = 'flex';
      });
      var nav = document.getElementById('nav-qr'); if (nav) nav.classList.add('active');
      var ttl = document.getElementById('topbarTitle');
      if (ttl) ttl.innerHTML = 'QR Table <span class="topbar-sub">Paste data → generate QR Code per baris (per incharge)</span>';

      // Populate incharge dropdown saat halaman dibuka
      _qrPopulateIcDropdown();

      // Sync dengan incharge yang sudah aktif di topbar
      var activeIc = _getActiveIncharge();
      if (activeIc) _qrSetIc(activeIc);

      setTimeout(function(){ var ta=document.getElementById('qrPasteTA'); if(ta) ta.focus(); }, 120);
    };
  }

  /* ── Populate incharge dropdown ── */
  function _qrPopulateIcDropdown() {
    var sel = document.getElementById('qrIcSelect');
    if (!sel) return;

    // Ambil list dari Supabase atau CONFIG
    var list = _getInchargeList();

    // Selalu sediakan option kosong
    var html = '<option value="">— Pilih Incharge —</option>';

    if (list.length) {
      list.forEach(function(ic) {
        var name = typeof ic === 'object' ? (ic.name || ic.nama || ic) : ic;
        html += '<option value="' + _escH(name) + '">' + _escH(name) + '</option>';
      });
    } else {
      // Fallback: ambil dari Supabase langsung
      _qrFetchInchargeList(function(names) {
        var h = '<option value="">— Pilih Incharge —</option>';
        names.forEach(function(n) { h += '<option value="'+_escH(n)+'">'+_escH(n)+'</option>'; });
        sel.innerHTML = h;
        // Re-apply active jika ada
        var active = _getActiveIncharge();
        if (active) { sel.value = active; _qrSetIc(active); }
      });
    }
    sel.innerHTML = html;
  }

  /* ── Fetch incharge list dari Supabase ── */
  function _qrFetchInchargeList(cb) {
    _qrResolveSupabase();
    if (!_qrSbUrl || !_qrSbKey) return;
    // Coba dari tabel incharge atau config
    fetch(_qrSbUrl + '/rest/v1/rpc/get_incharge_list', {
      method: 'POST',
      headers: {
        'apikey': _qrSbKey,
        'Authorization': 'Bearer ' + _qrSbKey,
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
    .then(function(r) { return r.ok ? r.json() : []; })
    .then(function(data) {
      if (Array.isArray(data)) cb(data.map(function(d){ return d.name || d.nama || d; }));
    })
    .catch(function() {
      // Fallback: coba dari tabel incharge langsung
      fetch(_qrSbUrl + '/rest/v1/incharge?select=nama&order=nama', {
        headers: { 'apikey': _qrSbKey, 'Authorization': 'Bearer ' + _qrSbKey },
      })
      .then(function(r) { return r.ok ? r.json() : []; })
      .then(function(data) {
        if (Array.isArray(data)) cb(data.map(function(d){ return d.nama || d.name || ''; }).filter(Boolean));
      })
      .catch(function() { cb([]); });
    });
  }

  /* ── On incharge change ── */
  window._qrOnIcChange = function(ic) {
    _qrSetIc(ic);
  };

  function _qrSetIc(ic) {
    _qrCurrentIc = ic;

    var dot   = document.getElementById('qrIcDot');
    var label = document.getElementById('qrIcSessionLabel');
    var val   = document.getElementById('qrIcSessionVal');
    var warn  = document.getElementById('qrNoIcWarn');
    var btn   = document.getElementById('qrBtnGenerate');
    var sel   = document.getElementById('qrIcSelect');

    if (dot)   dot.classList.toggle('active', !!ic);
    if (label) label.style.display = ic ? '' : 'none';
    if (val)   val.textContent = ic ? _sessionKey(ic) : '—';
    if (warn)  warn.classList.toggle('show', !ic);
    if (btn)   btn.disabled = !ic;
    if (sel && sel.value !== ic) sel.value = ic;

    // Jika ada data tersimpan untuk incharge ini, load dulu
    if (ic) _qrLoadFromSupabase(ic);
  }

  /* ── State ── */
  var _qrRows       = [];
  var _qrFiltered   = [];
  var _qrCol        = 'all';
  var _qrMaxCols    = 0;
  var _qrCurrentIc  = '';

  /* ── Supabase Config ── */
  var _qrSbUrl = "https://twhtgiexupzwbycemdee.supabase.co";
  var _qrSbKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3aHRnaWV4dXB6d2J5Y2VtZGVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDE1NzQsImV4cCI6MjA5NTM3NzU3NH0.A-j3mbhZUbs8trZLRmYAWG0NP_UY3Jh2u8FyZ5_IOnw";

  function _qrResolveSupabase() {
    if (_qrSbUrl && _qrSbKey) return;
    if (typeof CONFIG !== 'undefined') {
      _qrSbUrl = (CONFIG.SUPABASE_URL || '').trim();
      _qrSbKey = (CONFIG.SUPABASE_KEY || '').trim();
    }
  }

  /* ── Upsert session per incharge ── */
  function _qrUpsert(ic, rows, maxCols) {
    _qrResolveSupabase();
    if (!_qrSbUrl || !_qrSbKey || !ic) return;
    var key = _sessionKey(ic);
    fetch(_qrSbUrl + '/rest/v1/qr_sessions', {
      method  : 'POST',
      headers : {
        'apikey'        : _qrSbKey,
        'Authorization' : 'Bearer ' + _qrSbKey,
        'Content-Type'  : 'application/json',
        'Prefer'        : 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        session_key : key,
        incharge    : ic,
        rows        : rows,
        max_cols    : maxCols,
        updated_at  : new Date().toISOString(),
      }),
    })
    .then(function(r) {
      if (!r.ok) r.text().then(function(t) { console.warn('[QR] upsert error', r.status, t); });
      else console.log('[QR] upsert OK ✓ ic=' + ic + ' rows=' + rows.length);
    })
    .catch(function(e) { console.warn('[QR] upsert failed:', e.message); });
  }

  /* ── Load session dari Supabase untuk incharge tertentu ── */
  function _qrLoadFromSupabase(ic) {
    _qrResolveSupabase();
    if (!_qrSbUrl || !_qrSbKey || !ic) return;
    var key = _sessionKey(ic);
    fetch(_qrSbUrl + '/rest/v1/qr_sessions?session_key=eq.' + encodeURIComponent(key) + '&select=rows,max_cols,incharge', {
      headers: {
        'apikey'        : _qrSbKey,
        'Authorization' : 'Bearer ' + _qrSbKey,
      },
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data && data[0] && data[0].rows && data[0].rows.length) {
        _qrRows    = data[0].rows;
        _qrMaxCols = data[0].max_cols || 0;
        _qrFiltered = _qrRows;
        _buildColTabs(_qrMaxCols);
        _updateStats();
        document.getElementById('qrTableCount').textContent = '— ' + _qrRows.length + ' baris';
        _qrRender(_qrFiltered, _qrMaxCols);
        document.getElementById('qrStatsBar').style.display = 'flex';
        document.getElementById('qrPrintBtn').style.display = '';
        var ta = document.getElementById('qrPasteTA');
        if (ta && !ta.value.trim()) {
          ta.value = _qrRows.map(function(r){ return r.join('\t'); }).join('\n');
        }
      } else {
        // Tidak ada data untuk incharge ini — reset tabel
        _qrRows = []; _qrFiltered = []; _qrMaxCols = 0;
        document.getElementById('qrTableCount').textContent = '';
        document.getElementById('qrStatsBar').style.display = 'none';
        document.getElementById('qrPrintBtn').style.display = 'none';
        document.getElementById('qrTableWrap').innerHTML =
          '<div class="qr-empty"><span class="material-icons-round">qr_code</span>' +
          '<p>Belum ada data QR untuk incharge <strong>' + _escH(ic) + '</strong><br>' +
          'Paste data di atas lalu klik <strong>Generate QR</strong></p></div>';
      }
    })
    .catch(function(e) { console.warn('[QR] load failed', e.message); });
  }

  function _updateStats() {
    var el;
    el = document.getElementById('qrStatIc');   if (el) el.textContent = _qrCurrentIc || '—';
    el = document.getElementById('qrStatRows');  if (el) el.textContent = _qrRows.length;
    el = document.getElementById('qrStatCols');  if (el) el.textContent = _qrMaxCols;
    el = document.getElementById('qrStatCol');
    if (el) el.textContent = _qrCol === 'all' ? 'Semua' : 'Kol ' + (parseInt(_qrCol)+1);
  }

  /* ── Toggle paste panel ── */
  window._qrTogglePaste = function() {
    var body = document.getElementById('qrPasteBody');
    var icon = document.getElementById('qrPasteIcon');
    if (!body) return;
    var open = body.style.display !== 'none';
    body.style.display = open ? 'none' : '';
    if (icon) icon.innerText = open ? 'expand_more' : 'expand_less';
  };

  /* ── Rebuild dropdown kolom ── */
  function _buildColTabs(maxCols) {
    var sel = document.getElementById('qrColSelect');
    if (!sel) return;
    var html = '<option value="all">— Semua Kolom —</option>';
    for (var i = 0; i < maxCols; i++) {
      html += '<option value="' + i + '"' + (_qrCol === i ? ' selected' : '') + '>Kolom ' + (i+1) + '</option>';
    }
    sel.innerHTML = html;
    if (_qrCol !== 'all') sel.value = _qrCol;
    var iw = document.getElementById('qrColInputWrap');
    if (iw) iw.style.display = maxCols > 0 ? '' : 'none';
  }

  window._qrSetColFromSelect = function() {
    var sel = document.getElementById('qrColSelect');
    if (sel) window._qrSetCol(sel.value);
  };

  window._qrSetColFromInput = function() {
    var inp = document.getElementById('qrColInput');
    if (!inp) return;
    if (!inp.value.trim()) { window._qrSetCol('all'); return; }
    var val = parseInt(inp.value);
    if (isNaN(val) || val < 1) return;
    var col = Math.min(val, _qrMaxCols) - 1;
    window._qrSetCol(col);
    var sel = document.getElementById('qrColSelect');
    if (sel) sel.value = col;
  };

  window._qrSetCol = function(col) {
    _qrCol = col === 'all' ? 'all' : parseInt(col);
    var sel = document.getElementById('qrColSelect');
    if (sel) sel.value = col;
    var inp = document.getElementById('qrColInput');
    if (inp) inp.value = col === 'all' ? '' : (parseInt(col) + 1);
    var hint = document.getElementById('qrColHint');
    if (hint) hint.textContent = col === 'all' ? 'QR = semua kolom digabung' : 'QR = isi Kolom ' + (parseInt(col)+1);
    if (_qrRows.length) {
      _qrFiltered = _qrRows;
      _updateStats();
      _qrRender(_qrFiltered, _qrMaxCols);
    }
  };

  /* ── Parse paste data ── */
  function _parse(raw) {
    return raw.trim().split('\n')
      .map(function(r){ return r.split('\t').map(function(c){ return c.trim(); }); })
      .filter(function(r){ return r.some(function(c){ return c.length > 0; }); });
  }

  /* ── QR URL helper ── */
  function _qrUrl(text, size) {
    return 'https://api.qrserver.com/v1/create-qr-code/?size='+(size||72)+'x'+(size||72)+
      '&data='+encodeURIComponent(text);
  }

  /* ── Cell helpers ── */
  function _isCode(val) {
    return /^(BAG|BDO|GTW|CGK|HVS|OB|IB|[A-Z]{2,}-[A-Z0-9\-]{3,})/i.test(val) ||
           /^[A-Z0-9\-]{8,}$/.test(val);
  }
  function _escH(s) {
    return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function _cellHtml(val) {
    if (!val) return '<span style="color:#3d444d">—</span>';
    if (/selesai/i.test(val)) return '<span class="qr-cell-code green">'+_escH(val)+'</span>';
    if (/proses/i.test(val))  return '<span class="qr-cell-code orange">'+_escH(val)+'</span>';
    if (_isCode(val))          return '<span class="qr-cell-code">'+_escH(val)+'</span>';
    return '<span style="color:#e6edf3">'+_escH(val)+'</span>';
  }

  /* ── Generate QR ── */
  window._qrGenerate = function() {
    if (!_qrCurrentIc) {
      if (typeof toast==='function') toast('Pilih Incharge terlebih dahulu!','error');
      var warn = document.getElementById('qrNoIcWarn');
      if (warn) { warn.classList.add('show'); setTimeout(function(){ warn.classList.remove('show'); }, 3000); }
      return;
    }
    var raw = (document.getElementById('qrPasteTA').value||'').trim();
    if (!raw) {
      if (typeof toast==='function') toast('Paste data terlebih dahulu','error');
      return;
    }
    _qrRows = _parse(raw);
    if (!_qrRows.length) return;
    _qrMaxCols = Math.max.apply(null, _qrRows.map(function(r){ return r.length; }));
    _buildColTabs(_qrMaxCols);
    _updateStats();
    document.getElementById('qrStatsBar').style.display = 'flex';
    document.getElementById('qrPrintBtn').style.display  = '';
    document.getElementById('qrTableCount').textContent  = '— '+_qrRows.length+' baris';
    _qrFiltered = _qrRows;
    _qrRender(_qrFiltered, _qrMaxCols);

    // Simpan ke Supabase dengan session_key = incharge
    _qrUpsert(_qrCurrentIc, _qrRows, _qrMaxCols);

    var body = document.getElementById('qrPasteBody');
    var icon = document.getElementById('qrPasteIcon');
    if (body) body.style.display = 'none';
    if (icon) icon.innerText = 'expand_more';
  };

  /* ── Render table ── */
  function _qrRender(rows, maxCols) {
    var wrap = document.getElementById('qrTableWrap');
    if (!rows.length) {
      wrap.innerHTML = '<div class="qr-empty"><span class="material-icons-round">qr_code</span><p>Tidak ada data</p></div>';
      return;
    }
    var thCols = '<th class="qr-th-qr">QR</th><th style="min-width:28px;color:#7d8590">#</th>';
    for (var i = 0; i < maxCols; i++) {
      var isActive = _qrCol !== 'all' && _qrCol === i;
      thCols += '<th' + (isActive ? ' class="qr-th-active"' : '') + '>Kol '+(i+1)+'</th>';
    }
    var tbodyHtml = rows.map(function(row, ri) {
      var qrContent;
      if (_qrCol === 'all') {
        qrContent = row.filter(function(c){ return c; }).join(' | ');
      } else {
        qrContent = row[_qrCol] || '';
      }
      var imgHtml = qrContent
        ? '<img src="'+_qrUrl(qrContent)+'" width="64" height="64" loading="lazy" alt="QR">'
        : '<span style="color:#3d444d;font-size:11px">—</span>';
      var tds = '<td class="qr-img-cell">'+imgHtml+'</td>';
      tds += '<td class="qr-row-num">'+(ri+1)+'</td>';
      for (var ci = 0; ci < maxCols; ci++) {
        var isActive = _qrCol !== 'all' && _qrCol === ci;
        tds += '<td'+(isActive ? ' class="qr-td-active"' : '')+'>'+_cellHtml(row[ci]||'')+'</td>';
      }
      return '<tr style="animation:fp2ItemIn .2s ease '+Math.min(ri*20,400)+'ms both">'+tds+'</tr>';
    }).join('');
    wrap.innerHTML =
      '<table class="qr-table"><thead><tr>'+thCols+'</tr></thead><tbody>'+tbodyHtml+'</tbody></table>';
  }

  /* ── Filter / search ── */
  window._qrFilterTable = function() {
    if (!_qrRows.length) return;
    var q = (document.getElementById('qrSearch').value||'').toLowerCase();
    _qrFiltered = q
      ? _qrRows.filter(function(row){ return row.some(function(c){ return c.toLowerCase().indexOf(q)!==-1; }); })
      : _qrRows;
    document.getElementById('qrTableCount').textContent = '— '+_qrFiltered.length+' baris';
    _qrRender(_qrFiltered, _qrMaxCols);
  };

  /* ── Clear ── */
  window._qrClear = function() {
    document.getElementById('qrPasteTA').value = '';
    _qrRows=[]; _qrFiltered=[]; _qrCol='all'; _qrMaxCols=0;
    // Clear session incharge yang aktif di Supabase
    if (_qrCurrentIc) _qrUpsert(_qrCurrentIc, [], 0);
    document.getElementById('qrStatsBar').style.display = 'none';
    document.getElementById('qrPrintBtn').style.display = 'none';
    document.getElementById('qrTableCount').textContent = '';
    var sel = document.getElementById('qrColSelect');
    if (sel) sel.innerHTML = '<option value="all">— Semua Kolom —</option>';
    var inp = document.getElementById('qrColInput');
    if (inp) inp.value = '';
    var iw = document.getElementById('qrColInputWrap');
    if (iw) iw.style.display = 'none';
    var hint = document.getElementById('qrColHint');
    if (hint) hint.textContent = 'QR = semua kolom digabung';
    document.getElementById('qrTableWrap').innerHTML =
      '<div class="qr-empty"><span class="material-icons-round">qr_code</span>'+
      '<p>Paste data di atas lalu klik <strong>Generate QR</strong><br>'+
      'Setiap baris otomatis mendapat QR Code</p></div>';
    var body=document.getElementById('qrPasteBody');
    var icon=document.getElementById('qrPasteIcon');
    if (body) body.style.display='';
    if (icon) icon.innerText='expand_less';
  };

  /* ── Bind events ── */
  function bindEvents() {
    var ta   = document.getElementById('qrPasteTA');
    var wrap = document.getElementById('qrPasteWrap');
    if (!ta||!wrap) return;
    ta.addEventListener('focus', function(){ wrap.classList.add('focused'); });
    ta.addEventListener('blur',  function(){ wrap.classList.remove('focused'); });
    ta.addEventListener('paste', function(){
      if (!_qrCurrentIc) {
        var warn = document.getElementById('qrNoIcWarn');
        if (warn) warn.classList.add('show');
        return;
      }
      setTimeout(window._qrGenerate, 120);
    });

    // Pantau perubahan incharge global (topbar)
    var globalInp = document.getElementById('globalInchargeInput');
    if (globalInp) {
      var _prevIc = '';
      setInterval(function() {
        var ic = _getActiveIncharge();
        if (ic !== _prevIc) {
          _prevIc = ic;
          // Sync ke selector QR jika halaman QR aktif
          var pgQr = document.getElementById('page-qr');
          if (pgQr && pgQr.style.display !== 'none') {
            _qrSetIc(ic);
            var sel = document.getElementById('qrIcSelect');
            if (sel) sel.value = ic;
          }
        }
      }, 800);
    }
  }

  /* ── Init ── */
  function init() {
    injectCSS();
    injectPage();
    injectNav();
    patchSwitchPage();
    setTimeout(bindEvents, 300);
  }

  if (document.readyState==='loading') {
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(init, 500); });
  } else {
    setTimeout(init, 500);
  }

})();
