/* ============================================================
   GTW BDO — qr-mobile.js v2.2
   QR Table untuk index-mobile.html
   - Tombol kembali ke home
   - Hapus dropdown kolom
   - Stats + search freeze, hanya list scroll
   - Real-time update via Supabase WebSocket
   ============================================================ */

(function () {
  'use strict';

  /* ── State ── */
  var _rows        = [];
  var _col         = 'all';
  var _maxCols     = 0;
  var _ws          = null;
  var _wsRetry     = 0;
  var _wsTimer     = null;
  var _sbUrl       = '';
  var _sbKey       = '';
  var _initialized = false;
  var _currentIc   = '';

  var WS_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];

  /* ── Resolve Supabase config ── */
  function _resolve() {
    if (_sbUrl && _sbKey) return;
    if (typeof CONFIG !== 'undefined') {
      _sbUrl = (CONFIG.SUPABASE_URL || '').trim();
      _sbKey = (CONFIG.SUPABASE_KEY || '').trim();
    }
    if (!_sbUrl) _sbUrl = 'https://twhtgiexupzwbycemdee.supabase.co';
    if (!_sbKey) _sbKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3aHRnaWV4dXB6d2J5Y2VtZGVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDE1NzQsImV4cCI6MjA5NTM3NzU3NH0.A-j3mbhZUbs8trZLRmYAWG0NP_UY3Jh2u8FyZ5_IOnw';
  }

  /* ── session_key helper ── */
  function _sessionKey(ic) {
    if (!ic) return '';
    return 'ic_' + ic.toLowerCase().replace(/\s+/g, '_');
  }

  /* ── Ambil incharge aktif dari global state ── */
  function _getGlobalIc() {
    if (typeof STATE !== 'undefined' && STATE.globalIncharge) return STATE.globalIncharge;
    if (typeof window._currentIncharge === 'string' && window._currentIncharge) return window._currentIncharge;
    if (typeof window._selectedIncharge === 'string' && window._selectedIncharge) return window._selectedIncharge;
    var el = document.getElementById('sidebarIcName');
    if (el && el.textContent && el.textContent.trim() !== 'Pilih Incharge') return el.textContent.trim();
    return '';
  }

  /* ── Fetch session ── */
  function _fetchSession(ic) {
    _resolve();
    if (!_sbUrl || !_sbKey) return;
    if (!ic) { _rows = []; _maxCols = 0; _render(); return; }
    var key = _sessionKey(ic);
    fetch(_sbUrl + '/rest/v1/qr_sessions?session_key=eq.' + encodeURIComponent(key) + '&select=rows,max_cols,incharge', {
      headers: { 'apikey': _sbKey, 'Authorization': 'Bearer ' + _sbKey },
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data && data[0] && data[0].rows && data[0].rows.length) {
        _rows    = data[0].rows    || [];
        _maxCols = data[0].max_cols || 0;
      } else {
        _rows = []; _maxCols = 0;
      }
      _render();
    })
    .catch(function(e) { console.warn('[QR-M] fetch failed', e.message); });
  }

  /* ── Set incharge aktif ── */
  function _setIc(ic) {
    _currentIc = ic;
    _col       = 'all';
    _rows      = [];
    _maxCols   = 0;

    var dot     = document.getElementById('qrmDot');
    var label   = document.getElementById('qrmStatusText');
    var selKey  = document.getElementById('qrmSessionKeyBadge');
    var display = document.getElementById('qrmIcDisplay');

    if (display) display.textContent = ic || '—';
    if (dot)    dot.className = 'qrm-status-dot' + (ic ? '' : ' waiting');
    if (selKey) { selKey.style.display = ic ? '' : 'none'; selKey.textContent = ic ? _sessionKey(ic) : ''; }
    if (label) {
      label.innerHTML = ic
        ? 'Incharge: <strong>' + _escH(ic) + '</strong> — menunggu data...'
        : 'Belum ada incharge aktif. Pilih incharge lewat menu.';
    }
    _fetchSession(ic);
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
        topic: 'realtime:*', event: 'phx_join',
        payload: { config: { broadcast: { self: false }, presence: { key: '' }, postgres_changes: [{ event: '*', schema: 'public', table: 'qr_sessions' }] } },
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
        var rec = (msg.payload && msg.payload.record) || null;
        if (!rec) { _fetchSession(_currentIc); return; }
        var activeKey = _sessionKey(_currentIc);
        if (!activeKey || rec.session_key !== activeKey) return;
        _rows    = rec.rows    || [];
        _maxCols = rec.max_cols || 0;
        _render();
        _showToast('QR data diperbarui ✓');
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

/* INCHARGE INFO BAR */
.qrm-ic-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #161b22;
  border-bottom: 1px solid #30363d;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.qrm-ic-label {
  font-size: 10px;
  font-weight: 700;
  color: #7d8590;
  text-transform: uppercase;
  letter-spacing: 1px;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 4px;
}
.qrm-ic-label svg { flex-shrink: 0; }
.qrm-ic-display {
  flex: 1;
  font-size: 13px;
  font-weight: 700;
  color: #58a6ff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.qrm-ic-session-badge {
  display: none;
  font-size: 10px;
  font-family: 'DM Mono', monospace;
  color: #58a6ff;
  background: rgba(47,129,247,.12);
  border: 1px solid rgba(47,129,247,.25);
  border-radius: 5px;
  padding: 3px 8px;
  white-space: nowrap;
}

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

/* FREEZE HEADER — stats + search, tidak ikut scroll */
.qrm-freeze-header {
  flex-shrink: 0;
  background: #0d1117;
  border-bottom: 1px solid #30363d;
  padding: 10px 14px 8px;
}

/* STATS */
.qrm-stats {
  display: flex; gap: 10px; margin-bottom: 8px; flex-wrap: wrap;
}
.qrm-stat {
  flex: 1; min-width: 70px;
  background: #161b22; border: 1px solid #30363d; border-radius: 10px;
  padding: 8px 10px; text-align: center;
}
.qrm-stat-label { font-size: 9.5px; color: #7d8590; text-transform: uppercase; letter-spacing: .8px; margin-bottom: 3px; }
.qrm-stat-value { font-size: 18px; font-weight: 800; color: #58a6ff; }
.qrm-stat-value.sm { font-size: 12px; padding-top: 3px; }

/* Search */
.qrm-search-row {
  display: flex; align-items: center; gap: 8px;
  background: #1c2128; border: 1px solid #30363d; border-radius: 9px;
  padding: 8px 12px;
}
.qrm-search-row input {
  flex: 1; background: transparent; border: none; outline: none;
  font-size: 13px; color: #e6edf3;
}
.qrm-search-row input::placeholder { color: #3d444d; }
.qrm-search-icon { font-size: 16px; color: #7d8590; flex-shrink: 0; }

/* SCROLL AREA — hanya list QR */
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
        <button class="back-icon" onclick="QrMobile.goHome()" aria-label="Kembali">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="appbar-title">QR Table</div>
        <button class="appbar-icon" onclick="QrMobile.refresh()" aria-label="Refresh">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        </button>
      </div>

      <!-- INCHARGE INFO (read-only) -->
      <div class="qrm-ic-bar">
        <span class="qrm-ic-label">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Incharge Aktif
        </span>
        <span class="qrm-ic-display" id="qrmIcDisplay">—</span>
        <span class="qrm-ic-session-badge" id="qrmSessionKeyBadge"></span>
      </div>

      <div class="qrm-status">
        <div class="qrm-status-dot waiting" id="qrmDot"></div>
        <span id="qrmStatusText">Belum ada incharge aktif. Pilih incharge lewat menu.</span>
      </div>

      <!-- FREEZE HEADER: stats + search -->
      <div class="qrm-freeze-header" id="qrmFreezeHeader" style="display:none">
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
            <div class="qrm-stat-value sm" id="qrmStatCol">Semua</div>
          </div>
        </div>
        <div class="qrm-search-row">
          <span class="qrm-search-icon">🔍</span>
          <input id="qrmSearch" placeholder="Cari data..." oninput="QrMobile.search(this.value)">
        </div>
      </div>

      <!-- SCROLL AREA — hanya list QR -->
      <div class="qrm-scroll" id="qrmScroll">
        <div class="qrm-empty" id="qrmEmpty">
          <div class="qrm-empty-icon">📱</div>
          <div class="qrm-empty-title">Pilih Incharge</div>
          <div class="qrm-empty-sub">Pilih incharge lewat menu sidebar atau tombol IC di topbar.<br>QR Table akan otomatis tampil data incharge yang aktif.</div>
        </div>
        <div id="qrmList"></div>
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
    var empty        = document.getElementById('qrmEmpty');
    var list         = document.getElementById('qrmList');
    var freezeHeader = document.getElementById('qrmFreezeHeader');
    var dot          = document.getElementById('qrmDot');
    var status       = document.getElementById('qrmStatusText');

    if (!_currentIc) {
      if (empty)        empty.style.display        = '';
      if (list)         list.innerHTML              = '';
      if (freezeHeader) freezeHeader.style.display  = 'none';
      if (dot) dot.className = 'qrm-status-dot waiting';
      if (status) status.innerHTML = 'Belum ada incharge aktif. Pilih incharge lewat menu.';
      var emptyTitle = document.querySelector('#qrmEmpty .qrm-empty-title');
      var emptySub   = document.querySelector('#qrmEmpty .qrm-empty-sub');
      if (emptyTitle) emptyTitle.textContent = 'Pilih Incharge';
      if (emptySub)   emptySub.innerHTML = 'Pilih incharge lewat menu sidebar atau tombol IC di topbar.<br>QR Table akan otomatis tampil data incharge yang aktif.';
      return;
    }

    if (!_rows || !_rows.length) {
      if (empty)        empty.style.display        = '';
      if (list)         list.innerHTML              = '';
      if (freezeHeader) freezeHeader.style.display  = 'none';
      if (dot) dot.className = 'qrm-status-dot waiting';
      if (status) status.innerHTML = 'Incharge: <strong>' + _escH(_currentIc) + '</strong> — belum ada data QR';
      var emptyTitle2 = document.querySelector('#qrmEmpty .qrm-empty-title');
      var emptySub2   = document.querySelector('#qrmEmpty .qrm-empty-sub');
      if (emptyTitle2) emptyTitle2.textContent = 'Belum Ada Data';
      if (emptySub2)   emptySub2.innerHTML = 'Belum ada QR untuk incharge <strong>' + _escH(_currentIc) + '</strong>.<br>Generate QR dari web terlebih dahulu.';
      return;
    }

    if (empty)        empty.style.display        = 'none';
    if (freezeHeader) freezeHeader.style.display  = '';
    if (dot) dot.className = 'qrm-status-dot';
    if (status) status.innerHTML = _escH(_currentIc) + ': <strong>' + _rows.length + '</strong> baris · real-time aktif';

    /* Stats */
    var el;
    el = document.getElementById('qrmStatRows'); if (el) el.textContent = _rows.length;
    el = document.getElementById('qrmStatCols'); if (el) el.textContent = _maxCols;
    el = document.getElementById('qrmStatCol');  if (el) el.textContent = _col === 'all' ? 'Semua' : 'Kol ' + (parseInt(_col)+1);

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

      var globalIc = _getGlobalIc();
      if (globalIc) {
        _setIc(globalIc);
      } else {
        _currentIc = '';
        _render();
      }
    },

    /* Tombol kembali ke home */
    goHome: function() {
      var pg = document.getElementById('pgQr');
      if (pg) { pg.classList.add('hidden'); pg.style.display = ''; }

      var btn = document.getElementById('sbnQr');
      if (btn) btn.classList.remove('active');

      /* Aktifkan home */
      var pgHome = document.getElementById('pgHome');
      if (pgHome) {
        pgHome.classList.remove('hidden');
        pgHome.style.display = '';
      }
      var sbnHome = document.getElementById('sbnHome');
      if (sbnHome) sbnHome.classList.add('active');
    },

    search: function(q) {
      var query = (q||'').toLowerCase();
      _filtered = query
        ? _rows.filter(function(r) { return r.some(function(c) { return (c||'').toLowerCase().indexOf(query) !== -1; }); })
        : _rows;
      _renderList();
    },

    refresh: function() {
      var ic = _getGlobalIc();
      if (ic) {
        _setIc(ic);
      } else {
        _currentIc = '';
        _render();
      }
    },

    init: function() {
      if (_initialized) return;
      _initialized = true;
      _resolve();
      _injectCSS();
      _injectPage();
      _injectNav();
      if (_sbUrl && _sbKey) _wsConnect();

      /* Polling sync incharge global */
      var _prevGlobalIc = '';
      setInterval(function() {
        var gic = _getGlobalIc();
        if (gic !== _prevGlobalIc) {
          _prevGlobalIc = gic;
          var pgQr = document.getElementById('pgQr');
          var isVisible = pgQr && pgQr.style.display !== 'none' && !pgQr.classList.contains('hidden');
          if (isVisible) {
            _setIc(gic);
          } else {
            _currentIc = gic;
          }
        }
      }, 800);
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
