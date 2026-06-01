/* ============================================================
   GTW BDO — qr-mobile.js v1.1
   QR Table untuk index-mobile.html
   - Fix: pakai UI.Page.show() agar konsisten dengan sistem page
   - Fix: hapus style.cssText override yang bentrok dengan .page CSS
   - Fix: blank hitam karena position conflict
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
  /* Ambil semua row dari qr_sessions, pakai yang paling baru (order by updated_at desc)
     Tidak filter session_key='default' karena web mungkin pakai key berbeda */
  function _fetchSession() {
    _resolve();
    if (!_sbUrl || !_sbKey) {
      console.warn('[QR-M] Supabase URL/KEY tidak ada');
      return;
    }

    /* Coba ambil semua session, order terbaru dulu, limit 1 */
    var url = _sbUrl + '/rest/v1/qr_sessions?select=*&order=updated_at.desc&limit=1';

    fetch(url, {
      headers: {
        'apikey'        : _sbKey,
        'Authorization' : 'Bearer ' + _sbKey,
        'Accept'        : 'application/json',
      },
    })
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(data) {
      console.log('[QR-M] fetch result:', JSON.stringify(data).substring(0, 200));

      if (!data || !data.length) {
        /* Tidak ada data sama sekali di tabel */
        console.warn('[QR-M] qr_sessions kosong');
        _updateStatus('Tabel qr_sessions kosong. Generate QR dari web dulu.');
        return;
      }

      var rec = data[0];

      /* Support berbagai nama kolom: rows/data/items, max_cols/maxCols/col_count */
      var rows = rec.rows || rec.data || rec.items || [];
      var maxCols = rec.max_cols || rec.maxCols || rec.col_count || 0;

      /* Jika rows adalah string JSON, parse dulu */
      if (typeof rows === 'string') {
        try { rows = JSON.parse(rows); } catch(e) { rows = []; }
      }

      _rows    = Array.isArray(rows) ? rows : [];
      _maxCols = maxCols;

      console.log('[QR-M] loaded', _rows.length, 'rows,', _maxCols, 'cols, key=', rec.session_key);
      _render();
    })
    .catch(function(e) {
      console.warn('[QR-M] fetch failed:', e.message);
      _updateStatus('Gagal fetch: ' + e.message);
    });
  }

  /* Update status bar text tanpa mengubah dot */
  function _updateStatus(msg) {
    var el = document.getElementById('qrmStatusText');
    if (el) el.textContent = msg;
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
      /* heartbeat */
      setInterval(function() {
        _wsSend(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: '0' }));
      }, 25000);
    };

    _ws.onmessage = function(ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch(e) { return; }
      if (msg.event === 'postgres_changes') {
        var rec = (msg.payload && msg.payload.record) || null;
        if (rec) {
          /* Support berbagai nama kolom */
          var rows = rec.rows || rec.data || rec.items || [];
          var maxCols = rec.max_cols || rec.maxCols || rec.col_count || 0;
          if (typeof rows === 'string') { try { rows = JSON.parse(rows); } catch(e) { rows = []; } }
          _rows    = Array.isArray(rows) ? rows : [];
          _maxCols = maxCols;
          _render();
          _showToast('QR data diperbarui');
        } else {
          /* fallback fetch */
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
    if (typeof UI !== 'undefined' && UI.Toast) { UI.Toast.show(msg, 'info'); return; }
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
    s.textContent = [
      /* QR MOBILE PAGE */
      /* Tidak perlu override display/flex — .page CSS yang handle */

      /* STATUS BAR */
      '.qrm-status{display:flex;align-items:center;gap:8px;padding:7px 14px;background:rgba(47,129,247,.1);border-bottom:1px solid rgba(47,129,247,.2);font-size:11px;color:#7d8590;flex-shrink:0;}',
      '.qrm-status-dot{width:7px;height:7px;border-radius:50%;background:#3fb950;flex-shrink:0;box-shadow:0 0 0 0 rgba(63,185,80,.6);animation:qrmPulse 2s ease-in-out infinite;}',
      '.qrm-status-dot.waiting{background:#7d8590;animation:none;}',
      '@keyframes qrmPulse{0%,100%{box-shadow:0 0 0 0 rgba(63,185,80,.6);}50%{box-shadow:0 0 0 5px rgba(63,185,80,0);}}',
      '.qrm-status strong{color:#58a6ff;}',

      /* KOLOM SELECTOR */
      '.qrm-col-bar{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#161b22;border-bottom:1px solid #30363d;flex-shrink:0;flex-wrap:wrap;}',
      '.qrm-col-label{font-size:10px;font-weight:700;color:#7d8590;text-transform:uppercase;letter-spacing:1px;white-space:nowrap;}',
      '.qrm-col-select{flex:1;min-width:140px;appearance:none;-webkit-appearance:none;background:#21262d url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\'%3E%3Cpath d=\'M0 0l5 6 5-6z\' fill=\'%237d8590\'/%3E%3C/svg%3E") no-repeat right 10px center;border:1px solid #3d444d;border-radius:8px;color:#e6edf3;font-size:13px;font-weight:600;padding:9px 28px 9px 12px;outline:none;}',
      '.qrm-col-select:focus{border-color:#2f81f7;}',
      '.qrm-col-select option{background:#1c2128;}',
      '.qrm-col-hint{font-size:10.5px;color:#7d8590;width:100%;font-family:\'DM Mono\',monospace;}',

      /* SCROLL AREA */
      '.qrm-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:10px 14px 80px;}',

      /* EMPTY */
      '.qrm-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 24px;text-align:center;gap:12px;}',
      '.qrm-empty-icon{font-size:52px;opacity:.25;}',
      '.qrm-empty-title{font-size:14px;font-weight:700;color:#e6edf3;}',
      '.qrm-empty-sub{font-size:12px;color:#7d8590;line-height:1.6;}',

      /* QR CARDS */
      '.qrm-card{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:12px;margin-bottom:10px;display:flex;gap:12px;align-items:center;animation:qrmIn .2s ease both;}',
      '@keyframes qrmIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}',
      '.qrm-card-qr{flex-shrink:0;width:90px;height:90px;background:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;}',
      '.qrm-card-qr img{width:86px;height:86px;image-rendering:pixelated;}',
      '.qrm-card-info{flex:1;min-width:0;}',
      '.qrm-card-num{font-size:10px;color:#7d8590;font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px;}',
      '.qrm-card-val{font-size:13px;font-weight:700;color:#58a6ff;font-family:\'DM Mono\',monospace;word-break:break-all;margin-bottom:6px;}',
      '.qrm-card-cols{display:flex;flex-wrap:wrap;gap:4px;}',
      '.qrm-card-col{font-size:10.5px;padding:2px 7px;border-radius:4px;background:rgba(47,129,247,.12);color:#58a6ff;border:1px solid rgba(47,129,247,.2);font-family:\'DM Mono\',monospace;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;}',
      '.qrm-card-col.active{background:rgba(47,129,247,.25);border-color:#2f81f7;color:#93c5fd;}',

      /* STATS */
      '.qrm-stats{display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap;}',
      '.qrm-stat{flex:1;min-width:80px;background:#161b22;border:1px solid #30363d;border-radius:10px;padding:10px 12px;text-align:center;}',
      '.qrm-stat-label{font-size:9.5px;color:#7d8590;text-transform:uppercase;letter-spacing:.8px;margin-bottom:3px;}',
      '.qrm-stat-value{font-size:20px;font-weight:800;color:#58a6ff;}',

      /* Search */
      '.qrm-search-row{display:flex;align-items:center;gap:8px;background:#1c2128;border:1px solid #30363d;border-radius:9px;padding:8px 12px;margin-bottom:12px;}',
      '.qrm-search-row input{flex:1;background:transparent;border:none;outline:none;font-size:13px;color:#e6edf3;}',
      '.qrm-search-row input::placeholder{color:#3d444d;}',
      '.qrm-search-icon{font-size:16px;color:#7d8590;flex-shrink:0;}',
    ].join('');
    document.head.appendChild(s);
  }

  /* ── Inject HTML page into body ── */
  function _injectPage() {
    if (document.getElementById('pgQr')) return;

    var pg = document.createElement('div');
    /* ✅ FIX: gunakan class 'page hidden' saja, JANGAN override style.cssText
       Biarkan .page CSS (position:fixed, display:flex, flex-direction:column)
       yang bekerja — override manual menyebabkan blank hitam */
    pg.className = 'page hidden';
    pg.id = 'pgQr';

    pg.innerHTML = [
      '<div class="appbar">',
        '<button class="hamburger" onclick="UI.Sidebar.toggle()" aria-label="Menu"><span></span></button>',
        '<div class="appbar-title">QR Table</div>',
        '<button class="appbar-icon" onclick="QrMobile.refresh()" aria-label="Refresh">',
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
            '<polyline points="23 4 23 10 17 10"/>',
            '<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
          '</svg>',
        '</button>',
      '</div>',

      '<div class="qrm-status">',
        '<div class="qrm-status-dot waiting" id="qrmDot"></div>',
        '<span id="qrmStatusText">Menunggu data dari web...</span>',
      '</div>',

      '<div class="qrm-col-bar" id="qrmColBar" style="display:none">',
        '<span class="qrm-col-label">Kolom QR:</span>',
        '<select class="qrm-col-select" id="qrmColSelect" onchange="QrMobile.setCol(this.value)">',
          '<option value="all">\u2014 Semua Kolom \u2014</option>',
        '</select>',
        '<span class="qrm-col-hint" id="qrmColHint">QR = semua kolom digabung</span>',
      '</div>',

      '<div class="qrm-scroll" id="qrmScroll">',
        '<div class="qrm-empty" id="qrmEmpty">',
          '<div class="qrm-empty-icon">&#128241;</div>',
          '<div class="qrm-empty-title">Menunggu Input dari Web</div>',
          '<div class="qrm-empty-sub">Buka GTW BDO di desktop/web,<br>paste data &amp; generate QR.<br>Hasilnya muncul otomatis di sini.</div>',
        '</div>',
        '<div id="qrmContent" style="display:none">',
          '<div class="qrm-stats">',
            '<div class="qrm-stat"><div class="qrm-stat-label">Total Baris</div><div class="qrm-stat-value" id="qrmStatRows">0</div></div>',
            '<div class="qrm-stat"><div class="qrm-stat-label">Kolom</div><div class="qrm-stat-value" id="qrmStatCols">0</div></div>',
            '<div class="qrm-stat"><div class="qrm-stat-label">QR dari</div><div class="qrm-stat-value" style="font-size:13px;padding-top:4px" id="qrmStatCol">Semua</div></div>',
          '</div>',
          '<div class="qrm-search-row">',
            '<span class="qrm-search-icon">\uD83D\uDD0D</span>',
            '<input id="qrmSearch" placeholder="Cari data..." oninput="QrMobile.search(this.value)">',
          '</div>',
          '<div id="qrmList"></div>',
        '</div>',
      '</div>',
    ].join('');

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
    btn.innerHTML = [
      '<span class="si-icon">',
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none">',
          '<rect x="3" y="3" width="7" height="7" rx="1" stroke="#22D3EE" stroke-width="1.8"/>',
          '<rect x="14" y="3" width="7" height="7" rx="1" stroke="#22D3EE" stroke-width="1.8"/>',
          '<rect x="3" y="14" width="7" height="7" rx="1" stroke="#67E8F9" stroke-width="1.8"/>',
          '<path d="M14 14h2v2h-2zM18 14h3M14 18h3M18 18v3" stroke="#67E8F9" stroke-width="1.5" stroke-linecap="round"/>',
        '</svg>',
      '</span>',
      'QR Table',
    ].join('');

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
      if (dot)     dot.className = 'qrm-status-dot waiting';
      if (status)  status.innerHTML = 'Menunggu data \u2014 klik <b>&#8635;</b> untuk refresh';
      return;
    }

    if (empty)   empty.style.display   = 'none';
    if (content) content.style.display = '';
    if (colBar)  colBar.style.display  = '';
    if (dot)     dot.className = 'qrm-status-dot';
    if (status)  status.innerHTML = '<strong>' + _rows.length + '</strong> baris \u00B7 real-time aktif';

    /* Rebuild dropdown */
    var sel = document.getElementById('qrmColSelect');
    if (sel) {
      var html = '<option value="all">\u2014 Semua Kolom \u2014</option>';
      for (var i = 0; i < _maxCols; i++) {
        html += '<option value="' + i + '"' + (_col === i ? ' selected' : '') + '>Kolom ' + (i + 1) + '</option>';
      }
      sel.innerHTML = html;
      if (_col !== 'all') sel.value = String(_col);
    }

    /* Stats */
    var el;
    el = document.getElementById('qrmStatRows'); if (el) el.textContent = _rows.length;
    el = document.getElementById('qrmStatCols'); if (el) el.textContent = _maxCols;
    el = document.getElementById('qrmStatCol');  if (el) el.textContent = _col === 'all' ? 'Semua' : 'Kol ' + (parseInt(_col) + 1);

    /* Hint */
    var hint = document.getElementById('qrmColHint');
    if (hint) hint.textContent = _col === 'all' ? 'QR = semua kolom digabung' : 'QR = isi Kolom ' + (parseInt(_col) + 1);

    /* Apply search filter */
    var q = (document.getElementById('qrmSearch') || { value: '' }).value.toLowerCase();
    _filtered = q
      ? _rows.filter(function(r) { return r.some(function(c) { return (c || '').toLowerCase().indexOf(q) !== -1; }); })
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
        : '<span style="color:#3d444d;font-size:11px">\u2014</span>';

      var colsHtml = row.map(function(c, ci) {
        var isActive = _col !== 'all' && parseInt(_col) === ci;
        return '<span class="qrm-card-col' + (isActive ? ' active' : '') + '">' + _escH(c || '\u2014') + '</span>';
      }).join('');

      return [
        '<div class="qrm-card" style="animation-delay:' + Math.min(ri * 30, 300) + 'ms">',
          '<div class="qrm-card-qr">' + qrImg + '</div>',
          '<div class="qrm-card-info">',
            '<div class="qrm-card-num">#' + (ri + 1) + '</div>',
            '<div class="qrm-card-val">' + _escH(qrContent || '\u2014') + '</div>',
            '<div class="qrm-card-cols">' + colsHtml + '</div>',
          '</div>',
        '</div>',
      ].join('');
    }).join('');
  }

  /* ── Public API ── */
  window.QrMobile = {

    open: function() {
      /* ✅ FIX: Pakai UI.Page.show() agar konsisten dengan sistem page app.
         Ini yang menghilangkan blank hitam — sebelumnya manual set display
         bertabrakan dengan .page { position:fixed } dari CSS utama */
      if (typeof UI !== 'undefined' && UI.Page) {
        UI.Page.show('pgQr');
      } else {
        /* Fallback jika UI belum ready */
        document.querySelectorAll('.page').forEach(function(p) {
          p.classList.toggle('hidden', p.id !== 'pgQr');
        });
        if (typeof STATE !== 'undefined') STATE.currentPage = 'pgQr';
      }

      /* Nonaktifkan semua sidebar nav item */
      document.querySelectorAll('.sidebar-item').forEach(function(b) {
        b.classList.remove('active');
      });
      var btn = document.getElementById('sbnQr');
      if (btn) btn.classList.add('active');

      /* Tutup sidebar */
      try {
        if (typeof UI !== 'undefined' && UI.Sidebar) UI.Sidebar.close();
      } catch(e) {}

      /* Refresh data setiap kali halaman dibuka */
      _fetchSession();
    },

    setCol: function(val) {
      _col = val === 'all' ? 'all' : parseInt(val);
      var hint = document.getElementById('qrmColHint');
      if (hint) hint.textContent = val === 'all' ? 'QR = semua kolom digabung' : 'QR = isi Kolom ' + (parseInt(val) + 1);
      var stat = document.getElementById('qrmStatCol');
      if (stat) stat.textContent = val === 'all' ? 'Semua' : 'Kol ' + (parseInt(val) + 1);
      _renderList();
    },

    search: function(q) {
      var query = (q || '').toLowerCase();
      _filtered = query
        ? _rows.filter(function(r) { return r.some(function(c) { return (c || '').toLowerCase().indexOf(query) !== -1; }); })
        : _rows.slice();
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

  /* ── Auto init setelah app siap ── */
  function _autoInit() {
    /* Delay sedikit agar UI.Page sudah terdefinisi */
    setTimeout(function() { QrMobile.init(); }, 800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _autoInit);
  } else {
    _autoInit();
  }

})();
  }

  function _wsScheduleRetry() {
    if (_wsTimer) return;
    var delay = WS_DELAYS[Math.min(_wsRetry, WS_DELAYS.length - 1)];
    _wsRetry++;
    _wsTimer = setTimeout(function() { _wsTimer = null; _wsConnect(); }, delay);
  }

  /* ── Toast helper ── */
  function _showToast(msg) {
    if (typeof UI !== 'undefined' && UI.Toast) { UI.Toast.show(msg, 'info'); return; }
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
    s.textContent = [
      /* QR MOBILE PAGE */
      /* Tidak perlu override display/flex — .page CSS yang handle */

      /* STATUS BAR */
      '.qrm-status{display:flex;align-items:center;gap:8px;padding:7px 14px;background:rgba(47,129,247,.1);border-bottom:1px solid rgba(47,129,247,.2);font-size:11px;color:#7d8590;flex-shrink:0;}',
      '.qrm-status-dot{width:7px;height:7px;border-radius:50%;background:#3fb950;flex-shrink:0;box-shadow:0 0 0 0 rgba(63,185,80,.6);animation:qrmPulse 2s ease-in-out infinite;}',
      '.qrm-status-dot.waiting{background:#7d8590;animation:none;}',
      '@keyframes qrmPulse{0%,100%{box-shadow:0 0 0 0 rgba(63,185,80,.6);}50%{box-shadow:0 0 0 5px rgba(63,185,80,0);}}',
      '.qrm-status strong{color:#58a6ff;}',

      /* KOLOM SELECTOR */
      '.qrm-col-bar{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#161b22;border-bottom:1px solid #30363d;flex-shrink:0;flex-wrap:wrap;}',
      '.qrm-col-label{font-size:10px;font-weight:700;color:#7d8590;text-transform:uppercase;letter-spacing:1px;white-space:nowrap;}',
      '.qrm-col-select{flex:1;min-width:140px;appearance:none;-webkit-appearance:none;background:#21262d url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\'%3E%3Cpath d=\'M0 0l5 6 5-6z\' fill=\'%237d8590\'/%3E%3C/svg%3E") no-repeat right 10px center;border:1px solid #3d444d;border-radius:8px;color:#e6edf3;font-size:13px;font-weight:600;padding:9px 28px 9px 12px;outline:none;}',
      '.qrm-col-select:focus{border-color:#2f81f7;}',
      '.qrm-col-select option{background:#1c2128;}',
      '.qrm-col-hint{font-size:10.5px;color:#7d8590;width:100%;font-family:\'DM Mono\',monospace;}',

      /* SCROLL AREA */
      '.qrm-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:10px 14px 80px;}',

      /* EMPTY */
      '.qrm-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 24px;text-align:center;gap:12px;}',
      '.qrm-empty-icon{font-size:52px;opacity:.25;}',
      '.qrm-empty-title{font-size:14px;font-weight:700;color:#e6edf3;}',
      '.qrm-empty-sub{font-size:12px;color:#7d8590;line-height:1.6;}',

      /* QR CARDS */
      '.qrm-card{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:12px;margin-bottom:10px;display:flex;gap:12px;align-items:center;animation:qrmIn .2s ease both;}',
      '@keyframes qrmIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}',
      '.qrm-card-qr{flex-shrink:0;width:90px;height:90px;background:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;}',
      '.qrm-card-qr img{width:86px;height:86px;image-rendering:pixelated;}',
      '.qrm-card-info{flex:1;min-width:0;}',
      '.qrm-card-num{font-size:10px;color:#7d8590;font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px;}',
      '.qrm-card-val{font-size:13px;font-weight:700;color:#58a6ff;font-family:\'DM Mono\',monospace;word-break:break-all;margin-bottom:6px;}',
      '.qrm-card-cols{display:flex;flex-wrap:wrap;gap:4px;}',
      '.qrm-card-col{font-size:10.5px;padding:2px 7px;border-radius:4px;background:rgba(47,129,247,.12);color:#58a6ff;border:1px solid rgba(47,129,247,.2);font-family:\'DM Mono\',monospace;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;}',
      '.qrm-card-col.active{background:rgba(47,129,247,.25);border-color:#2f81f7;color:#93c5fd;}',

      /* STATS */
      '.qrm-stats{display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap;}',
      '.qrm-stat{flex:1;min-width:80px;background:#161b22;border:1px solid #30363d;border-radius:10px;padding:10px 12px;text-align:center;}',
      '.qrm-stat-label{font-size:9.5px;color:#7d8590;text-transform:uppercase;letter-spacing:.8px;margin-bottom:3px;}',
      '.qrm-stat-value{font-size:20px;font-weight:800;color:#58a6ff;}',

      /* Search */
      '.qrm-search-row{display:flex;align-items:center;gap:8px;background:#1c2128;border:1px solid #30363d;border-radius:9px;padding:8px 12px;margin-bottom:12px;}',
      '.qrm-search-row input{flex:1;background:transparent;border:none;outline:none;font-size:13px;color:#e6edf3;}',
      '.qrm-search-row input::placeholder{color:#3d444d;}',
      '.qrm-search-icon{font-size:16px;color:#7d8590;flex-shrink:0;}',
    ].join('');
    document.head.appendChild(s);
  }

  /* ── Inject HTML page into body ── */
  function _injectPage() {
    if (document.getElementById('pgQr')) return;

    var pg = document.createElement('div');
    /* ✅ FIX: gunakan class 'page hidden' saja, JANGAN override style.cssText
       Biarkan .page CSS (position:fixed, display:flex, flex-direction:column)
       yang bekerja — override manual menyebabkan blank hitam */
    pg.className = 'page hidden';
    pg.id = 'pgQr';

    pg.innerHTML = [
      '<div class="appbar">',
        '<button class="hamburger" onclick="UI.Sidebar.toggle()" aria-label="Menu"><span></span></button>',
        '<div class="appbar-title">QR Table</div>',
        '<button class="appbar-icon" onclick="QrMobile.refresh()" aria-label="Refresh">',
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
            '<polyline points="23 4 23 10 17 10"/>',
            '<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
          '</svg>',
        '</button>',
      '</div>',

      '<div class="qrm-status">',
        '<div class="qrm-status-dot waiting" id="qrmDot"></div>',
        '<span id="qrmStatusText">Menunggu data dari web...</span>',
      '</div>',

      '<div class="qrm-col-bar" id="qrmColBar" style="display:none">',
        '<span class="qrm-col-label">Kolom QR:</span>',
        '<select class="qrm-col-select" id="qrmColSelect" onchange="QrMobile.setCol(this.value)">',
          '<option value="all">\u2014 Semua Kolom \u2014</option>',
        '</select>',
        '<span class="qrm-col-hint" id="qrmColHint">QR = semua kolom digabung</span>',
      '</div>',

      '<div class="qrm-scroll" id="qrmScroll">',
        '<div class="qrm-empty" id="qrmEmpty">',
          '<div class="qrm-empty-icon">&#128241;</div>',
          '<div class="qrm-empty-title">Menunggu Input dari Web</div>',
          '<div class="qrm-empty-sub">Buka GTW BDO di desktop/web,<br>paste data &amp; generate QR.<br>Hasilnya muncul otomatis di sini.</div>',
        '</div>',
        '<div id="qrmContent" style="display:none">',
          '<div class="qrm-stats">',
            '<div class="qrm-stat"><div class="qrm-stat-label">Total Baris</div><div class="qrm-stat-value" id="qrmStatRows">0</div></div>',
            '<div class="qrm-stat"><div class="qrm-stat-label">Kolom</div><div class="qrm-stat-value" id="qrmStatCols">0</div></div>',
            '<div class="qrm-stat"><div class="qrm-stat-label">QR dari</div><div class="qrm-stat-value" style="font-size:13px;padding-top:4px" id="qrmStatCol">Semua</div></div>',
          '</div>',
          '<div class="qrm-search-row">',
            '<span class="qrm-search-icon">\uD83D\uDD0D</span>',
            '<input id="qrmSearch" placeholder="Cari data..." oninput="QrMobile.search(this.value)">',
          '</div>',
          '<div id="qrmList"></div>',
        '</div>',
      '</div>',
    ].join('');

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
    btn.innerHTML = [
      '<span class="si-icon">',
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none">',
          '<rect x="3" y="3" width="7" height="7" rx="1" stroke="#22D3EE" stroke-width="1.8"/>',
          '<rect x="14" y="3" width="7" height="7" rx="1" stroke="#22D3EE" stroke-width="1.8"/>',
          '<rect x="3" y="14" width="7" height="7" rx="1" stroke="#67E8F9" stroke-width="1.8"/>',
          '<path d="M14 14h2v2h-2zM18 14h3M14 18h3M18 18v3" stroke="#67E8F9" stroke-width="1.5" stroke-linecap="round"/>',
        '</svg>',
      '</span>',
      'QR Table',
    ].join('');

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
      if (dot)     dot.className = 'qrm-status-dot waiting';
      if (status)  status.innerHTML = 'Menunggu data dari web...';
      return;
    }

    if (empty)   empty.style.display   = 'none';
    if (content) content.style.display = '';
    if (colBar)  colBar.style.display  = '';
    if (dot)     dot.className = 'qrm-status-dot';
    if (status)  status.innerHTML = '<strong>' + _rows.length + '</strong> baris \u00B7 real-time aktif';

    /* Rebuild dropdown */
    var sel = document.getElementById('qrmColSelect');
    if (sel) {
      var html = '<option value="all">\u2014 Semua Kolom \u2014</option>';
      for (var i = 0; i < _maxCols; i++) {
        html += '<option value="' + i + '"' + (_col === i ? ' selected' : '') + '>Kolom ' + (i + 1) + '</option>';
      }
      sel.innerHTML = html;
      if (_col !== 'all') sel.value = String(_col);
    }

    /* Stats */
    var el;
    el = document.getElementById('qrmStatRows'); if (el) el.textContent = _rows.length;
    el = document.getElementById('qrmStatCols'); if (el) el.textContent = _maxCols;
    el = document.getElementById('qrmStatCol');  if (el) el.textContent = _col === 'all' ? 'Semua' : 'Kol ' + (parseInt(_col) + 1);

    /* Hint */
    var hint = document.getElementById('qrmColHint');
    if (hint) hint.textContent = _col === 'all' ? 'QR = semua kolom digabung' : 'QR = isi Kolom ' + (parseInt(_col) + 1);

    /* Apply search filter */
    var q = (document.getElementById('qrmSearch') || { value: '' }).value.toLowerCase();
    _filtered = q
      ? _rows.filter(function(r) { return r.some(function(c) { return (c || '').toLowerCase().indexOf(q) !== -1; }); })
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
        : '<span style="color:#3d444d;font-size:11px">\u2014</span>';

      var colsHtml = row.map(function(c, ci) {
        var isActive = _col !== 'all' && parseInt(_col) === ci;
        return '<span class="qrm-card-col' + (isActive ? ' active' : '') + '">' + _escH(c || '\u2014') + '</span>';
      }).join('');

      return [
        '<div class="qrm-card" style="animation-delay:' + Math.min(ri * 30, 300) + 'ms">',
          '<div class="qrm-card-qr">' + qrImg + '</div>',
          '<div class="qrm-card-info">',
            '<div class="qrm-card-num">#' + (ri + 1) + '</div>',
            '<div class="qrm-card-val">' + _escH(qrContent || '\u2014') + '</div>',
            '<div class="qrm-card-cols">' + colsHtml + '</div>',
          '</div>',
        '</div>',
      ].join('');
    }).join('');
  }

  /* ── Public API ── */
  window.QrMobile = {

    open: function() {
      /* ✅ FIX: Pakai UI.Page.show() agar konsisten dengan sistem page app.
         Ini yang menghilangkan blank hitam — sebelumnya manual set display
         bertabrakan dengan .page { position:fixed } dari CSS utama */
      if (typeof UI !== 'undefined' && UI.Page) {
        UI.Page.show('pgQr');
      } else {
        /* Fallback jika UI belum ready */
        document.querySelectorAll('.page').forEach(function(p) {
          p.classList.toggle('hidden', p.id !== 'pgQr');
        });
        if (typeof STATE !== 'undefined') STATE.currentPage = 'pgQr';
      }

      /* Nonaktifkan semua sidebar nav item */
      document.querySelectorAll('.sidebar-item').forEach(function(b) {
        b.classList.remove('active');
      });
      var btn = document.getElementById('sbnQr');
      if (btn) btn.classList.add('active');

      /* Tutup sidebar */
      try {
        if (typeof UI !== 'undefined' && UI.Sidebar) UI.Sidebar.close();
      } catch(e) {}

      /* Refresh data setiap kali halaman dibuka */
      _fetchSession();
    },

    setCol: function(val) {
      _col = val === 'all' ? 'all' : parseInt(val);
      var hint = document.getElementById('qrmColHint');
      if (hint) hint.textContent = val === 'all' ? 'QR = semua kolom digabung' : 'QR = isi Kolom ' + (parseInt(val) + 1);
      var stat = document.getElementById('qrmStatCol');
      if (stat) stat.textContent = val === 'all' ? 'Semua' : 'Kol ' + (parseInt(val) + 1);
      _renderList();
    },

    search: function(q) {
      var query = (q || '').toLowerCase();
      _filtered = query
        ? _rows.filter(function(r) { return r.some(function(c) { return (c || '').toLowerCase().indexOf(query) !== -1; }); })
        : _rows.slice();
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

  /* ── Auto init setelah app siap ── */
  function _autoInit() {
    /* Delay sedikit agar UI.Page sudah terdefinisi */
    setTimeout(function() { QrMobile.init(); }, 800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _autoInit);
  } else {
    _autoInit();
  }

})();
