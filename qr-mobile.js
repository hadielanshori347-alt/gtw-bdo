/* ============================================================
   GTW BDO — qr-mobile.js v1.1
   QR Table untuk index-mobile.html
   - Terima data real-time dari Supabase (web yg input)
   - Mobile hanya bisa pilih kolom & lihat QR
   - Kolom bisa dipilih via dropdown ATAU input angka
   ============================================================ */

(function () {
  'use strict';

  /* ── State ── */
  var _rows    = [];
  var _col     = 'all';
  var _maxCols = 0;
  var _ws      = null;
  var _wsRetry = 0;
  var _wsTimer = null;
  var _sbUrl   = '';
  var _sbKey   = '';
  var _initialized = false;

  var WS_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];

  /* ── Resolve Supabase config ── */
  function _resolve() {
    if (_sbUrl && _sbKey) return;
    if (typeof CONFIG !== 'undefined') {
      _sbUrl = (CONFIG.SUPABASE_URL || '').trim();
      _sbKey = (CONFIG.SUPABASE_KEY || '').trim();
    }
  }

  /* ── Fetch current session from Supabase REST ── */
  function _fetchSession() {
    _resolve();
    if (!_sbUrl || !_sbKey) return;
    fetch(_sbUrl + '/rest/v1/qr_sessions?session_key=eq.default&select=rows,max_cols', {
      headers: {
        'apikey'        : _sbKey,
        'Authorization' : 'Bearer ' + _sbKey,
      },
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data && data[0]) {
        _rows    = data[0].rows    || [];
        _maxCols = data[0].max_cols || 0;
        _render();
      }
    })
    .catch(function(e) { console.warn('[QR-M] fetch failed', e.message); });
  }

  /* ── WebSocket Supabase Realtime ── */
  function _wsUrl() {
    if (!_sbUrl || !_sbKey) return '';
    return _sbUrl.replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey=' + _sbKey + '&vsn=1.0.0';
  }

  function _wsConnect() {
    var url = _wsUrl();
    if (!url) return;
    try { _ws = new WebSocket(url); } catch(e) { _wsScheduleRetry(); return; }

    _ws.onopen = function() {
      _wsRetry = 0;
      _wsSend(JSON.stringify({
        topic   : 'realtime:*',
        event   : 'phx_join',
        payload : {
          config: {
            broadcast: { self: false },
            presence : { key: '' },
            postgres_changes: [
              { event: '*', schema: 'public', table: 'qr_sessions' }
            ]
          }
        },
        ref: '1'
      }));
      setInterval(function() {
        _wsSend(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: '0' }));
      }, 25000);
    };

    _ws.onmessage = function(ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch(e) { return; }
      if (msg.event === 'postgres_changes') {
        var newRecord = (msg.payload && msg.payload.record) || null;
        if (newRecord && newRecord.rows !== undefined) {
          _rows    = newRecord.rows    || [];
          _maxCols = newRecord.max_cols || 0;
          _render();
          _showToast('QR data diperbarui');
        } else {
          _fetchSession();
        }
      }
    };

    _ws.onclose = function() { _wsScheduleRetry(); };
    _ws.onerror = function() {};
  }

  function _wsSend(data) {
    if (_ws && _ws.readyState === 1) try { _ws.send(data); } catch(e) {}
  }

  function _wsScheduleRetry() {
    if (_wsTimer) return;
    var delay = WS_DELAYS[Math.min(_wsRetry, WS_DELAYS.length - 1)];
    _wsRetry++;
    _wsTimer = setTimeout(function() { _wsTimer = null; _wsConnect(); }, delay);
  }

  /* ── Toast helper ── */
  function _showToast(msg) {
    if (typeof UI !== 'undefined' && UI.Toast) { UI.Toast.show(msg); return; }
    var el = document.getElementById('gtoast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'visible';
    setTimeout(function() { el.className = ''; }, 2200);
  }

  /* ── Helpers ── */
  function _qrUrl(text) {
    return 'https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=' + encodeURIComponent(text);
  }
  function _escH(s) {
    return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* ── CSS ── */
  function _injectCSS() {
    if (document.getElementById('_qrMobileCSS')) return;
    var s = document.createElement('style');
    s.id = '_qrMobileCSS';
    s.textContent = `
/* QR MOBILE PAGE */
#pgQr {
  display: none;
  flex-direction: column;
  height: 100%;
  background: var(--ink, #0d1117);
  overflow: hidden;
}
#pgQr.visible { display: flex; }

/* APPBAR */
#pgQr .appbar { flex-shrink: 0; }

/* STATUS BAR */
.qrm-status {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 14px;
  background: rgba(47,129,247,.1);
  border-bottom: 1px solid rgba(47,129,247,.2);
  font-size: 11px; color: #7d8590;
  flex-shrink: 0;
}
.qrm-status-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: #3fb950; flex-shrink: 0;
  box-shadow: 0 0 0 0 rgba(63,185,80,.6);
  animation: qrmPulse 2s ease-in-out infinite;
}
.qrm-status-dot.waiting { background: #7d8590; animation: none; }
@keyframes qrmPulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(63,185,80,.6); }
  50%      { box-shadow: 0 0 0 5px rgba(63,185,80,0); }
}
.qrm-status strong { color: #58a6ff; }

/* KOLOM SELECTOR */
.qrm-col-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px;
  background: #161b22;
  border-bottom: 1px solid #30363d;
  flex-shrink: 0; flex-wrap: wrap;
}
.qrm-col-label {
  font-size: 10px; font-weight: 700; color: #7d8590;
  text-transform: uppercase; letter-spacing: 1px; white-space: nowrap;
}
.qrm-col-select {
  flex: 1; min-width: 120px;
  appearance: none; -webkit-appearance: none;
  background: #21262d url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%237d8590'/%3E%3C/svg%3E") no-repeat right 10px center;
  border: 1px solid #3d444d; border-radius: 8px;
  color: #e6edf3; font-size: 13px; font-weight: 600;
  padding: 9px 28px 9px 12px; outline: none;
}
.qrm-col-select:focus { border-color: #2f81f7; }
.qrm-col-select option { background: #1c2128; }
.qrm-col-input {
  width: 64px;
  background: #21262d;
  border: 1px solid #3d444d; border-radius: 8px;
  color: #e6edf3; font-size: 13px; font-weight: 600;
  padding: 9px 8px; outline: none;
  text-align: center;
  -webkit-appearance: none;
  appearance: none;
}
.qrm-col-input:focus { border-color: #2f81f7; }
.qrm-col-input::placeholder { color: #3d444d; font-size: 11px; }
.qrm-col-hint {
  font-size: 10.5px; color: #7d8590; width: 100%;
  font-family: 'DM Mono', monospace;
}

/* SCROLL AREA */
.qrm-scroll {
  flex: 1; overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 10px 14px 80px;
}

/* EMPTY */
.qrm-empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 60px 24px; text-align: center; gap: 12px;
}
.qrm-empty-icon { font-size: 52px; opacity: .25; }
.qrm-empty-title { font-size: 14px; font-weight: 700; color: #e6edf3; }
.qrm-empty-sub { font-size: 12px; color: #7d8590; line-height: 1.6; }

/* QR CARDS */
.qrm-card {
  background: #161b22; border: 1px solid #30363d; border-radius: 12px;
  padding: 12px; margin-bottom: 10px;
  display: flex; gap: 12px; align-items: center;
  animation: qrmIn .2s ease both;
}
@keyframes qrmIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: none; }
}
.qrm-card-qr {
  flex-shrink: 0; width: 90px; height: 90px;
  background: #fff; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
.qrm-card-qr img { width: 86px; height: 86px; image-rendering: pixelated; }
.qrm-card-info { flex: 1; min-width: 0; }
.qrm-card-num {
  font-size: 10px; color: #7d8590; font-weight: 700;
  text-transform: uppercase; letter-spacing: .8px; margin-bottom: 4px;
}
.qrm-card-val {
  font-size: 13px; font-weight: 700; color: #58a6ff;
  font-family: 'DM Mono', monospace; word-break: break-all;
  margin-bottom: 6px;
}
.qrm-card-cols {
  display: flex; flex-wrap: wrap; gap: 4px;
}
.qrm-card-col {
  font-size: 10.5px; padding: 2px 7px; border-radius: 4px;
  background: rgba(47,129,247,.12); color: #58a6ff;
  border: 1px solid rgba(47,129,247,.2);
  font-family: 'DM Mono', monospace; font-weight: 500;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 160px;
}
.qrm-card-col.active {
  background: rgba(47,129,247,.25); border-color: #2f81f7;
  color: #93c5fd;
}

/* STATS */
.qrm-stats {
  display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap;
}
.qrm-stat {
  flex: 1; min-width: 80px;
  background: #161b22; border: 1px solid #30363d; border-radius: 10px;
  padding: 10px 12px; text-align: center;
}
.qrm-stat-label { font-size: 9.5px; color: #7d8590; text-transform: uppercase; letter-spacing: .8px; margin-bottom: 3px; }
.qrm-stat-value { font-size: 20px; font-weight: 800; color: #58a6ff; }

/* Search */
.qrm-search-row {
  display: flex; align-items: center; gap: 8px;
  background: #1c2128; border: 1px solid #30363d; border-radius: 9px;
  padding: 8px 12px; margin-bottom: 12px;
}
.qrm-search-row input {
  flex: 1; background: transparent; border: none; outline: none;
  font-size: 13px; color: #e6edf3;
}
.qrm-search-row input::placeholder { color: #3d444d; }
.qrm-search-icon { font-size: 16px; color: #7d8590; flex-shrink: 0; }
    `;
    document.head.appendChild(s);
  }

  /* ── Inject HTML page into body ── */
  function _injectPage() {
    if (document.getElementById('pgQr')) return;
    var pg = document.createElement('div');
    pg.className = 'page hidden';
    pg.id = 'pgQr';
    pg.style.cssText = 'flex-direction:column;height:100%;overflow:hidden;background:#0d1117;';
    pg.innerHTML = `
      <div class="appbar">
        <button class="hamburger" onclick="UI.Sidebar.toggle()" aria-label="Menu"><span></span></button>
        <div class="appbar-title">QR Table</div>
        <button class="appbar-icon" onclick="QrMobile.refresh()" aria-label="Refresh">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        </button>
      </div>

      <div class="qrm-status">
        <div class="qrm-status-dot waiting" id="qrmDot"></div>
        <span id="qrmStatusText">Menunggu data dari web...</span>
      </div>

      <div class="qrm-col-bar" id="qrmColBar" style="display:none">
        <span class="qrm-col-label">Kolom QR:</span>
        <select class="qrm-col-select" id="qrmColSelect" onchange="QrMobile.setCol(this.value)">
          <option value="all">— Semua Kolom —</option>
        </select>
        <input type="number" class="qrm-col-input" id="qrmColInput"
          min="1" placeholder="No."
          oninput="QrMobile.setColFromInput(this.value)"
          title="Ketik nomor kolom">
        <span class="qrm-col-hint" id="qrmColHint">QR = semua kolom digabung</span>
      </div>

      <div class="qrm-scroll" id="qrmScroll">
        <div class="qrm-empty" id="qrmEmpty">
          <div class="qrm-empty-icon">📱</div>
          <div class="qrm-empty-title">Menunggu Input dari Web</div>
          <div class="qrm-empty-sub">Buka GTW BDO di desktop/web,<br>paste data & generate QR.<br>Hasilnya muncul otomatis di sini.</div>
        </div>
        <div id="qrmContent" style="display:none">
          <div class="qrm-stats">
            <div class="qrm-stat">
              <div class="qrm-stat-label">Total Baris</div>
              <div class="qrm-stat-value" id="qrmStatRows">0</div>
            </div>
            <div class="qrm-stat">
              <div class="qrm-stat-label">Kolom</div>
              <div class="qrm-stat-value" id="qrmStatCols">0</div>
            </div>
            <div class="qrm-stat">
              <div class="qrm-stat-label">QR dari</div>
              <div class="qrm-stat-value" style="font-size:13px;padding-top:4px" id="qrmStatCol">Semua</div>
            </div>
          </div>
          <div class="qrm-search-row">
            <span class="qrm-search-icon material-icons-round" style="font-size:16px">search</span>
            <input id="qrmSearch" placeholder="Cari data..." oninput="QrMobile.search(this.value)">
          </div>
          <div id="qrmList"></div>
        </div>
      </div>
    `;
    document.body.appendChild(pg);
  }

  /* ── Inject nav item into sidebar ── */
  function _injectNav() {
    if (document.getElementById('sbnQr')) return;
    var sidebar = document.querySelector('.sidebar-body');
    if (!sidebar) return;

    var divider = document.createElement('div');
    divider.className = 'sidebar-divider';
    var section = document.createElement('div');
    section.className = 'sidebar-section';
    section.textContent = 'Tools';

    var btn = document.createElement('button');
    btn.className = 'sidebar-item';
    btn.id = 'sbnQr';
    btn.onclick = function() { QrMobile.open(); UI.Sidebar.close(); };
    btn.innerHTML = `
      <span class="si-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="7" height="7" rx="1" stroke="#22D3EE" stroke-width="1.8"/>
          <rect x="14" y="3" width="7" height="7" rx="1" stroke="#22D3EE" stroke-width="1.8"/>
          <rect x="3" y="14" width="7" height="7" rx="1" stroke="#67E8F9" stroke-width="1.8"/>
          <path d="M14 14h2v2h-2zM18 14h3M14 18h3M18 18v3" stroke="#67E8F9" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </span>
      QR Table
    `;

    sidebar.appendChild(divider);
    sidebar.appendChild(section);
    sidebar.appendChild(btn);
  }

  /* ── Render QR list ── */
  var _filtered = [];

  function _render() {
    var empty   = document.getElementById('qrmEmpty');
    var content = document.getElementById('qrmContent');
    var colBar  = document.getElementById('qrmColBar');
    var dot     = document.getElementById('qrmDot');
    var status  = document.getElementById('qrmStatusText');

    if (!_rows || !_rows.length) {
      if (empty)   empty.style.display   = '';
      if (content) content.style.display = 'none';
      if (colBar)  colBar.style.display  = 'none';
      if (dot) { dot.className = 'qrm-status-dot waiting'; }
      if (status) status.innerHTML = 'Menunggu data dari web...';
      return;
    }

    if (empty)   empty.style.display   = 'none';
    if (content) content.style.display = '';
    if (colBar)  colBar.style.display  = '';
    if (dot) { dot.className = 'qrm-status-dot'; }
    if (status) status.innerHTML = '<strong>' + _rows.length + '</strong> baris · real-time aktif';

    /* Rebuild dropdown */
    var sel = document.getElementById('qrmColSelect');
    if (sel) {
      var html = '<option value="all">— Semua Kolom —</option>';
      for (var i = 0; i < _maxCols; i++) {
        html += '<option value="' + i + '"' + (_col === i ? ' selected' : '') + '>Kolom ' + (i+1) + '</option>';
      }
      sel.innerHTML = html;
      if (_col !== 'all') sel.value = String(_col);
    }

    /* Sync input angka */
    var inp = document.getElementById('qrmColInput');
    if (inp) inp.value = _col === 'all' ? '' : (parseInt(_col) + 1);

    /* Stats */
    var el;
    el = document.getElementById('qrmStatRows'); if (el) el.textContent = _rows.length;
    el = document.getElementById('qrmStatCols'); if (el) el.textContent = _maxCols;
    el = document.getElementById('qrmStatCol');  if (el) el.textContent = _col === 'all' ? 'Semua' : 'Kol ' + (parseInt(_col)+1);

    /* Hint */
    var hint = document.getElementById('qrmColHint');
    if (hint) hint.textContent = _col === 'all' ? 'QR = semua kolom digabung' : 'QR = isi Kolom ' + (parseInt(_col)+1);

    /* Apply search filter */
    var q = (document.getElementById('qrmSearch') || {value:''}).value.toLowerCase();
    _filtered = q
      ? _rows.filter(function(r) { return r.some(function(c) { return (c||'').toLowerCase().indexOf(q) !== -1; }); })
      : _rows;

    _renderList();
  }

  function _renderList() {
    var list = document.getElementById('qrmList');
    if (!list) return;
    if (!_filtered.length) {
      list.innerHTML = '<div class="qrm-empty" style="padding:30px"><div class="qrm-empty-sub">Tidak ada data yang cocok</div></div>';
      return;
    }
    list.innerHTML = _filtered.map(function(row, ri) {
      var qrContent = _col === 'all'
        ? row.filter(function(c) { return c; }).join(' | ')
        : (row[parseInt(_col)] || '');

      var qrImg = qrContent
        ? '<img src="' + _qrUrl(qrContent) + '" width="86" height="86" loading="lazy" alt="QR">'
        : '<span style="color:#3d444d;font-size:11px">—</span>';

      var colsHtml = row.map(function(c, ci) {
        var isActive = _col !== 'all' && parseInt(_col) === ci;
        return '<span class="qrm-card-col' + (isActive ? ' active' : '') + '">' + _escH(c||'—') + '</span>';
      }).join('');

      return '<div class="qrm-card" style="animation-delay:' + Math.min(ri*30,300) + 'ms">' +
        '<div class="qrm-card-qr">' + qrImg + '</div>' +
        '<div class="qrm-card-info">' +
          '<div class="qrm-card-num">#' + (ri+1) + '</div>' +
          '<div class="qrm-card-val">' + _escH(qrContent || '—') + '</div>' +
          '<div class="qrm-card-cols">' + colsHtml + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  /* ── Public API ── */
  window.QrMobile = {

    open: function() {
      var pages = ['pgHome','pgSearch','pgCreate','pgScan','pgPhoto','pgDetail'];
      pages.forEach(function(id) {
        var p = document.getElementById(id);
        if (p) { p.classList.add('hidden'); p.style.display = ''; }
      });

      document.querySelectorAll('.sidebar-item').forEach(function(b) { b.classList.remove('active'); });
      ['sbnHome','sbnSearch','sbnOb','sbnHvs','sbnIb'].forEach(function(id) {
        var b = document.getElementById(id); if (b) b.classList.remove('active');
      });

      var pg = document.getElementById('pgQr');
      if (pg) {
        pg.classList.remove('hidden');
        pg.style.display = 'flex';
        pg.style.flexDirection = 'column';
        pg.style.height = '100%';
        pg.style.position = 'relative';
      }

      var btn = document.getElementById('sbnQr');
      if (btn) btn.classList.add('active');

      try { if (typeof UI !== 'undefined' && UI.Sidebar) UI.Sidebar.close(); } catch(e) {}
    },

    setCol: function(val) {
      _col = val === 'all' ? 'all' : parseInt(val);

      /* Sync input angka */
      var inp = document.getElementById('qrmColInput');
      if (inp) inp.value = _col === 'all' ? '' : (parseInt(_col) + 1);

      /* Sync dropdown */
      var sel = document.getElementById('qrmColSelect');
      if (sel) sel.value = _col === 'all' ? 'all' : String(_col);

      var hint = document.getElementById('qrmColHint');
      if (hint) hint.textContent = _col === 'all' ? 'QR = semua kolom digabung' : 'QR = isi Kolom ' + (parseInt(_col)+1);

      var stat = document.getElementById('qrmStatCol');
      if (stat) stat.textContent = _col === 'all' ? 'Semua' : 'Kol ' + (parseInt(_col)+1);

      _renderList();
    },

    setColFromInput: function(val) {
      if (!val || !String(val).trim()) {
        QrMobile.setCol('all');
        return;
      }
      var n = parseInt(val);
      if (isNaN(n) || n < 1) return;
      var col = Math.min(n, _maxCols) - 1;
      _col = col;

      /* Sync dropdown */
      var sel = document.getElementById('qrmColSelect');
      if (sel) sel.value = String(col);

      var hint = document.getElementById('qrmColHint');
      if (hint) hint.textContent = 'QR = isi Kolom ' + n;

      var stat = document.getElementById('qrmStatCol');
      if (stat) stat.textContent = 'Kol ' + n;

      _renderList();
    },

    search: function(q) {
      var query = (q||'').toLowerCase();
      _filtered = query
        ? _rows.filter(function(r) { return r.some(function(c) { return (c||'').toLowerCase().indexOf(query) !== -1; }); })
        : _rows;
      _renderList();
    },

    refresh: function() {
      _fetchSession();
    },

    init: function() {
      if (_initialized) return;
      _initialized = true;
      _resolve();
      _injectCSS();
      _injectPage();
      _injectNav();
      _fetchSession();
      if (_sbUrl && _sbKey) _wsConnect();
    },
  };

  /* ── Auto init ── */
  function _autoInit() {
    setTimeout(function() { QrMobile.init(); }, 800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _autoInit);
  } else {
    _autoInit();
  }

})();
