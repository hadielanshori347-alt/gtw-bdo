     <script src="gtw-realtime.js"></script>
     <script>GtwRealtime.init({ platform: 'desktop' });</script>

     <script src="gtw-realtime.js"></script>
     GtwRealtime.init({ platform: 'monitor', monitorRefresh: loadAll });
     return () => GtwRealtime.stop();

     <script src="gtw-realtime.js"></script>
     <script>GtwRealtime.init({ platform: 'mobile' });</script>

     if (window.GtwRealtime) GtwRealtime.refresh();

(function (global) {
  'use strict';

  var CFG = {
    platform        : 'desktop',
    intervalActive  : 5000,    // polling fallback: 5 detik aktif
    intervalHidden  : 60000,   // polling fallback: 60 detik background
    monitorRefresh  : null,
    showIndicator   : true,
    debug           : false,
  };

  var SB_URL = '';
  var SB_KEY = '';

  var _timer          = null;
  var _countdownTimer = null;
  var _hashOb         = 0;
  var _hashHvs        = 0;
  var _hashIb         = 0;
  var _bcChannel      = null;
  var _indEl          = null;
  var _lastSync       = null;
  var _isFetching     = false;
  var _failCount      = 0;
  var _cooldownTimer  = null;
  var _nextPollAt     = null;
  var _initialized    = false;

  var _ws             = null;
  var _wsConnected    = false;
  var _wsRetry        = 0;
  var _wsRetryTimer   = null;
  var _wsHeartbeat    = null;
  var _wsRef          = null; // ref unik join

  var MAX_FAIL        = 5;
  var COOLDOWN_MS     = 60000;
  var FETCH_TIMEOUT   = 8000;

  function log() {
    if (!CFG.debug) return;
    var a = Array.prototype.slice.call(arguments);
    a.unshift('[GtwRealtime v3]');
    Function.prototype.apply.call(console.log, console, a);
  }

  function djb2(data) {
    var s = JSON.stringify(data), h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
    return h >>> 0;
  }

  function resolveGasUrl() {
    if (typeof GAS_URL !== 'undefined' && GAS_URL) return GAS_URL;
    if (typeof CONFIG  !== 'undefined' && CONFIG.GAS_URL) return CONFIG.GAS_URL;
    return '';
  }

  function resolveSupabase() {
    if (typeof CONFIG !== 'undefined') {
      SB_URL = CONFIG.SUPABASE_URL || '';
      SB_KEY = CONFIG.SUPABASE_KEY || '';
    }
    // fallback: coba ambil dari meta tag jika ada
    if (!SB_URL) {
      var m = document.querySelector('meta[name="supabase-url"]');
      if (m) SB_URL = m.content;
    }
    if (!SB_KEY) {
      var k = document.querySelector('meta[name="supabase-key"]');
      if (k) SB_KEY = k.content;
    }
  }

  function fetchWithTimeout(url, ms) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = null;
    var p = fetch(url, {
      redirect : 'follow',
      mode     : 'cors',
      cache    : 'no-store',
      signal   : controller ? controller.signal : undefined,
    }).then(function(r) { return r.json(); });
    if (controller) {
      timer = setTimeout(function() { controller.abort(); }, ms);
      p = p.finally(function() { clearTimeout(timer); });
    }
    return p;
  }

  function gasGet(action) {
    var base = resolveGasUrl();
    if (!base) return Promise.reject(new Error('GAS URL kosong'));
    var url = new URL(base);
    url.searchParams.set('action', action);
    url.searchParams.set('_t', Date.now());
    return fetchWithTimeout(url.toString(), FETCH_TIMEOUT);
  }

  function _isFormOpen() {
    if (CFG.platform === 'desktop') {
      if (document.querySelectorAll('.form-panel-body.open').length  > 0) return true;
      if (document.querySelectorAll('.modal-overlay.open').length    > 0) return true;
      return false;
    }
    if (CFG.platform === 'mobile') {
      if (typeof STATE === 'undefined') return false;
      var pg = STATE.currentPage || '';
      return (pg === 'pgCreate' || pg === 'pgScan' || pg === 'pgPhoto');
    }
    return false;
  }

  function _applyUpdate(ob, hvs, ib) {
    if (CFG.platform === 'monitor') {
      if (typeof CFG.monitorRefresh === 'function') CFG.monitorRefresh();
      return;
    }
    if (CFG.platform === 'desktop') {
      try { if (ob  && typeof obData  !== 'undefined') global.obData  = ob;  } catch(e) {}
      try { if (hvs && typeof hvsData !== 'undefined') global.hvsData = hvs; } catch(e) {}
      try { if (ib  && typeof ibData  !== 'undefined') global.ibData  = ib;  } catch(e) {}
      try { if (ob  && typeof renderObTable  === 'function') renderObTable();  } catch(e) {}
      try { if (hvs && typeof renderHvsTable === 'function') renderHvsTable(); } catch(e) {}
      try { if (ib  && typeof renderIbTable  === 'function') renderIbTable();  } catch(e) {}
      try { if (ob  && typeof updateObStats  === 'function') updateObStats();  } catch(e) {}
      try { if (hvs && typeof updateHvsStats === 'function') updateHvsStats(); } catch(e) {}
      try { if (ib  && typeof updateIbStats  === 'function') updateIbStats();  } catch(e) {}
      try { if (typeof _obibData !== 'undefined') global._obibData  = null;  } catch(e) {}
      try { if (typeof _mfLoaded !== 'undefined') global._mfLoaded  = false; } catch(e) {}
      return;
    }
    if (CFG.platform === 'mobile') {
      try {
        if (typeof STATE !== 'undefined') {
          if (ob)  STATE.obData  = ob;
          if (hvs) STATE.hvsData = hvs;
          if (ib)  STATE.ibData  = ib;
        }
      } catch(e) {}
      try {
        if (typeof HomePage !== 'undefined') {
          HomePage.render();
          HomePage.updateStats();
        }
      } catch(e) {}
    }
  }

  function _doPoll() {
    if (_isFetching)    { log('masih fetching — skip'); return; }
    if (_cooldownTimer) { log('cooldown aktif — skip'); return; }
    if (_isFormOpen())  { log('form terbuka — skip'); _scheduleNext(); return; }

    _isFetching = true;
    if (!_wsConnected) _setIndicator('fetching');
    log('polling...');

    Promise.all([
      gasGet('getObList'),
      gasGet('getHvsList'),
      gasGet('getIbList'),
    ]).then(function(res) {
      _failCount = 0;

      var ob  = (res[0] && res[0].list) ? res[0].list  : null;
      var hvs = (res[1] && res[1].list) ? res[1].list  : null;
      var ib  = (res[2] && res[2].list) ? res[2].list  : null;

      var hOb  = ob  ? djb2(ob)  : _hashOb;
      var hHvs = hvs ? djb2(hvs) : _hashHvs;
      var hIb  = ib  ? djb2(ib)  : _hashIb;

      var changed = (hOb !== _hashOb || hHvs !== _hashHvs || hIb !== _hashIb);
      if (changed) {
        log('polling: data berubah → update UI');
        _hashOb = hOb; _hashHvs = hHvs; _hashIb = hIb;
        _applyUpdate(ob, hvs, ib);
        _flashIndicator();
        _broadcastUpdate(ob, hvs, ib);
      }

      _lastSync  = new Date();
      _isFetching = false;
      if (!_wsConnected) _setIndicator('live');
      _updateTimeLabel();
      _scheduleNext();

    }).catch(function(e) {
      log('polling gagal:', e.message || e);
      _isFetching  = false;
      _failCount++;
      if (_failCount >= MAX_FAIL) {
        if (!_wsConnected) _setIndicator('error');
        _stopPollTimer();
        _cooldownTimer = setTimeout(function() {
          _cooldownTimer = null;
          _failCount = 0;
          log('cooldown selesai → restart polling');
          _startPollTimer();
          _doPoll();
        }, COOLDOWN_MS);
      } else {
        if (!_wsConnected) _setIndicator('error');
        _scheduleNext(2000);
      }
    });
  }

  function _scheduleNext(overrideMs) {
    if (_timer) { clearTimeout(_timer); _timer = null; }
    if (_cooldownTimer) return;
    /* Saat WS aktif: poll lebih jarang (hanya sebagai safety net) */
    var iv = overrideMs !== undefined
      ? overrideMs
      : (_wsConnected
          ? (_wsConnected && !document.hidden ? 30000 : CFG.intervalHidden)
          : (document.hidden ? CFG.intervalHidden : CFG.intervalActive));
    _nextPollAt = Date.now() + iv;
    _timer = setTimeout(function() { _doPoll(); }, iv);
    log('poll berikutnya dalam', iv, 'ms');
  }

  function _stopPollTimer() {
    if (_timer) { clearTimeout(_timer); _timer = null; }
  }

  function _startPollTimer() {
    _stopPollTimer();
    _scheduleNext();
    if (!_countdownTimer) {
      _countdownTimer = setInterval(function() { _updateCountdown(); }, 1000);
    }
  }

  function _wsUrl() {
    if (!SB_URL || !SB_KEY) return '';
    // https://xyz.supabase.co → wss://xyz.supabase.co/realtime/v1/websocket
    var base = SB_URL.replace(/^http/, 'ws');
    return base + '/realtime/v1/websocket?apikey=' + SB_KEY + '&vsn=1.0.0';
  }

  var _WS_RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];

  function _wsConnect() {
    if (_ws && (_ws.readyState === 0 || _ws.readyState === 1)) return; // already open/connecting
    var url = _wsUrl();
    if (!url) { log('WS: Supabase URL/KEY tidak ada — skip'); return; }

    log('WS: connecting...', url.substring(0, 60) + '...');
    _setIndicatorWs('connecting');

    try {
      _ws = new WebSocket(url);
    } catch(e) {
      log('WS: gagal buat WebSocket:', e.message);
      _wsScheduleReconnect();
      return;
    }

    _ws.onopen = function() {
      log('WS: connected');
      _wsConnected  = true;
      _wsRetry      = 0;
      _wsRef        = 1;
      _setIndicatorWs('connected');
      _wsJoin();
      _wsStartHeartbeat();
      /* Saat WS aktif: perpanjang interval polling */
      _scheduleNext();
    };

    _ws.onclose = function(ev) {
      log('WS: closed — code=' + ev.code + ' reason=' + ev.reason);
      _wsConnected = false;
      _wsStopHeartbeat();
      _setIndicatorWs('disconnected');
      _wsScheduleReconnect();
      /* Fallback ke polling cepat saat WS mati */
      _scheduleNext(CFG.intervalActive);
    };

    _ws.onerror = function(e) {
      log('WS: error', e);
      /* onclose akan dipanggil setelah onerror */
    };

    _ws.onmessage = function(ev) {
      _wsHandleMsg(ev.data);
    };
  }

  function _wsJoin() {
    var ref = String(_wsRef++);
    var joinMsg = JSON.stringify({
      topic   : 'realtime:*',
      event   : 'phx_join',
      payload : {
        config: {
          broadcast    : { self: false },
          presence     : { key: '' },
          postgres_changes: [
            { event: '*', schema: 'public', table: 'tracking_header' },
            { event: '*', schema: 'public', table: 'tracking_scan'   },
          ]
        }
      },
      ref: ref
    });
    log('WS: join channel');
    _wsSend(joinMsg);
  }

  function _wsHandleMsg(raw) {
    var msg;
    try { msg = JSON.parse(raw); } catch(e) { return; }

    if (msg.event === 'phx_reply' && msg.payload && msg.payload.status === 'ok') {
      log('WS: phx_reply ok ref=' + msg.ref);
      return;
    }

    if (msg.event === 'postgres_changes') {
      var payload = msg.payload || {};
      var tbl = (payload.table || (payload.data && payload.data.table) || '');
      log('WS: postgres_changes → table=' + tbl, 'event=', payload.type || payload.eventType);
      /* Trigger reload data dari GAS (tetap via GAS agar cache invalidate) */
      _wsOnChange();
      return;
    }

    if (msg.event === 'system') {
      log('WS: system:', msg.payload && msg.payload.message);
      return;
    }
  }

  var _wsChangeDebounce = null;
  function _wsOnChange() {
    if (_wsChangeDebounce) clearTimeout(_wsChangeDebounce);
    _wsChangeDebounce = setTimeout(function() {
      _wsChangeDebounce = null;
      log('WS: change detected → reload data');
      _stopPollTimer();
      _doPoll();
    }, 300); // 300ms debounce
  }

  function _wsSend(data) {
    if (_ws && _ws.readyState === 1) {
      try { _ws.send(data); } catch(e) { log('WS: send error', e.message); }
    }
  }

  function _wsStartHeartbeat() {
    _wsStopHeartbeat();
    _wsHeartbeat = setInterval(function() {
      var ref = String(_wsRef++);
      _wsSend(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: ref }));
      log('WS: heartbeat sent');
    }, 25000); // tiap 25 detik (Supabase timeout 60 detik)
  }

  function _wsStopHeartbeat() {
    if (_wsHeartbeat) { clearInterval(_wsHeartbeat); _wsHeartbeat = null; }
  }

  function _wsScheduleReconnect() {
    if (_wsRetryTimer) return;
    var delay = _WS_RECONNECT_DELAYS[Math.min(_wsRetry, _WS_RECONNECT_DELAYS.length - 1)];
    _wsRetry++;
    log('WS: reconnect dalam', delay, 'ms (attempt', _wsRetry + ')');
    _wsRetryTimer = setTimeout(function() {
      _wsRetryTimer = null;
      _wsConnect();
    }, delay);
  }

  function _setIndicatorWs(state) {
    if (state === 'connected') {
      _setIndicator('ws-live');
    } else if (state === 'connecting') {
      _setIndicator('fetching');
    } else {
    
      _setIndicator('live');
    }
  }

  function _initBroadcast() {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
      _bcChannel = new BroadcastChannel('gtw_bdo_realtime_v3');
      _bcChannel.onmessage = function(e) {
        var d = e.data;
        if (!d || d.type !== 'gtw_update') return;
        log('BroadcastChannel: data dari tab lain');
        _applyUpdate(d.ob || null, d.hvs || null, d.ib || null);
        _lastSync = new Date(d.ts);
        _setIndicator(_wsConnected ? 'ws-live' : 'live');
        _updateTimeLabel();
        _flashIndicator();
      };
    } catch(e) {}
  }

  function _broadcastUpdate(ob, hvs, ib) {
    if (!_bcChannel) return;
    try {
      _bcChannel.postMessage({ type: 'gtw_update', ob: ob, hvs: hvs, ib: ib, ts: Date.now() });
    } catch(e) {}
  }

  function _bindAutoEvents() {
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) {
        log('tab aktif kembali → poll segera');
        if (!_wsConnected) _setIndicator('live');
        _doPoll();
        if (!_wsConnected && !_wsRetryTimer) _wsConnect();
      } else {
        log('tab background → perpanjang interval');
        _scheduleNext(CFG.intervalHidden);
      }
    });

    window.addEventListener('focus', function() {
      if (!document.hidden) {
        log('window focus → poll segera');
        _doPoll();
      }
    });

    window.addEventListener('online', function() {
      log('online kembali → reconnect WS + poll');
      _failCount = 0;
      if (_cooldownTimer) { clearTimeout(_cooldownTimer); _cooldownTimer = null; }
      if (!_wsConnected) _wsConnect();
      _setIndicator('live');
      _doPoll();
    });

    window.addEventListener('offline', function() {
      log('offline');
      _setIndicator('offline');
      _stopPollTimer();
    });

    window.addEventListener('pageshow', function(e) {
      if (e.persisted) {
        log('pageshow (bfcache) → poll segera');
        _doPoll();
      }
    });
  }

  function _injectCSS() {
    if (document.getElementById('gtw-rt3-css')) return;
    var s = document.createElement('style');
    s.id  = 'gtw-rt3-css';
    s.textContent = [
      '#gtw-rt3{',
        'position:fixed;bottom:14px;right:14px;',
        'display:flex;align-items:center;gap:7px;',
        'background:rgba(10,15,28,.88);',
        'border:1px solid rgba(255,255,255,.1);',
        'border-radius:999px;',
        'padding:6px 13px 6px 10px;',
        'font:600 11px/1 "DM Sans","Plus Jakarta Sans","Segoe UI",sans-serif;',
        'color:#94a3b8;',
        'box-shadow:0 4px 20px rgba(0,0,0,.4);',
        'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);',
        'z-index:99999;user-select:none;cursor:default;',
        'transition:border-color .4s,box-shadow .4s;',
      '}',
      '#gtw-rt3 .rt3-dot{',
        'width:8px;height:8px;border-radius:50%;',
        'background:#22c55e;flex-shrink:0;',
        'transition:background .3s;',
      '}',
     
      '#gtw-rt3.s-ws-live .rt3-dot{',
        'background:#22c55e;',
        'animation:rt3pulse 2s ease-in-out infinite;',
      '}',
     
      '#gtw-rt3.s-live .rt3-dot{',
        'background:#60a5fa;',
        'animation:rt3pulse2 3s ease-in-out infinite;',
      '}',
     
      '#gtw-rt3.s-fetching .rt3-dot{background:#60a5fa;animation:rt3spin 1s linear infinite;}',
      '#gtw-rt3.s-error .rt3-dot{background:#ef4444;animation:none;}',
      '#gtw-rt3.s-offline .rt3-dot{background:#f59e0b;animation:none;}',
      '#gtw-rt3.s-standby .rt3-dot{background:#64748b;animation:none;}',
      '#gtw-rt3 .rt3-lbl{color:#e2e8f0;font-size:11px;font-weight:700;letter-spacing:.3px;}',
      '#gtw-rt3 .rt3-time{color:#475569;font-size:10px;margin-left:1px;font-variant-numeric:tabular-nums;}',
      '#gtw-rt3 .rt3-cd{',
        'color:#1e40af;font-size:9px;font-weight:700;',
        'background:rgba(96,165,250,.12);',
        'border-radius:4px;padding:1px 5px;',
        'font-variant-numeric:tabular-nums;letter-spacing:.3px;',
      '}',
      '#gtw-rt3 .rt3-ws{',
        'font-size:9px;font-weight:700;',
        'background:rgba(34,197,94,.13);',
        'color:#4ade80;',
        'border-radius:4px;padding:1px 5px;letter-spacing:.3px;',
      '}',
      '#gtw-rt3.s-updated{',
        'border-color:rgba(34,197,94,.5);',
        'box-shadow:0 0 0 3px rgba(34,197,94,.12),0 4px 20px rgba(0,0,0,.4);',
      '}',
      '@keyframes rt3pulse{',
        '0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.5);}',
        '50%{box-shadow:0 0 0 5px rgba(34,197,94,0);}',
      '}',
      '@keyframes rt3pulse2{',
        '0%,100%{box-shadow:0 0 0 0 rgba(96,165,250,.4);}',
        '50%{box-shadow:0 0 0 5px rgba(96,165,250,0);}',
      '}',
      '@keyframes rt3spin{',
        '0%{box-shadow:2px 0 0 0 rgba(96,165,250,.8);}',
        '25%{box-shadow:0 2px 0 0 rgba(96,165,250,.8);}',
        '50%{box-shadow:-2px 0 0 0 rgba(96,165,250,.8);}',
        '75%{box-shadow:0 -2px 0 0 rgba(96,165,250,.8);}',
        '100%{box-shadow:2px 0 0 0 rgba(96,165,250,.8);}',
      '}',
    ].join('');
    document.head.appendChild(s);
  }

  function _createIndicator() {
    if (document.getElementById('gtw-rt3')) {
      _indEl = document.getElementById('gtw-rt3');
      return;
    }
    _injectCSS();
    var el = document.createElement('div');
    el.id        = 'gtw-rt3';
    el.className = 's-live';
    el.innerHTML = [
      '<span class="rt3-dot"></span>',
      '<span class="rt3-lbl" id="gtw-rt3-lbl">LIVE</span>',
      '<span class="rt3-ws" id="gtw-rt3-ws" style="display:none">WS</span>',
      '<span class="rt3-time" id="gtw-rt3-time">—</span>',
      '<span class="rt3-cd" id="gtw-rt3-cd" style="display:none">—</span>',
    ].join('');
    document.body.appendChild(el);
    _indEl = el;
  }

  var _statusMap = {
    'ws-live'  : { cls: 's-ws-live',  lbl: 'LIVE',    ws: true  },
    'live'     : { cls: 's-live',     lbl: 'LIVE',    ws: false },
    'fetching' : { cls: 's-fetching', lbl: 'SYNC...',  ws: false },
    'error'    : { cls: 's-error',    lbl: 'ERROR',   ws: false },
    'offline'  : { cls: 's-offline',  lbl: 'OFFLINE', ws: false },
    'standby'  : { cls: 's-standby',  lbl: 'PAUSE',   ws: false },
  };

  function _setIndicator(s) {
    if (!_indEl) return;
    var m   = _statusMap[s] || _statusMap['live'];
    _indEl.className = m.cls;
    var lbl = document.getElementById('gtw-rt3-lbl');
    if (lbl) lbl.textContent = m.lbl;
    var wsBadge = document.getElementById('gtw-rt3-ws');
    if (wsBadge) wsBadge.style.display = m.ws ? 'inline-block' : 'none';
  }

  function _flashIndicator() {
    if (!_indEl) return;
    _indEl.classList.add('s-updated');
    setTimeout(function() {
      if (_indEl) _indEl.classList.remove('s-updated');
    }, 1500);
  }

  function _updateTimeLabel() {
    var el = document.getElementById('gtw-rt3-time');
    if (!el || !_lastSync) return;
    var d = _lastSync;
    var p = function(n) { return n < 10 ? '0' + n : '' + n; };
    el.textContent = p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  function _updateCountdown() {
    var el = document.getElementById('gtw-rt3-cd');
    if (!el) return;
    if (_wsConnected || !_nextPollAt || _isFetching || _cooldownTimer) {
      el.style.display = 'none';
      return;
    }
    var sec = Math.max(0, Math.ceil((_nextPollAt - Date.now()) / 1000));
    el.style.display  = 'inline-block';
    el.textContent    = sec + 's';
  }

 
  global.GtwRealtime = {
    init: function(options) {
      if (_initialized) return;
      options = options || {};
      Object.keys(options).forEach(function(k) { CFG[k] = options[k]; });

      var ready = function() {
        resolveSupabase();

        if (CFG.showIndicator !== false) _createIndicator();
        _initBroadcast();
        _bindAutoEvents();

       
        setTimeout(function() {
          _doPoll();
          _startPollTimer();
          /* Init WebSocket Realtime */
          if (SB_URL && SB_KEY) {
            _wsConnect();
          } else {
            log('Supabase URL/KEY tidak tersedia — hanya polling');
          }
        }, 1500);

        _initialized = true;
        log('init ok — platform=' + CFG.platform +
            ' interval=' + CFG.intervalActive + 'ms' +
            ' SB=' + (SB_URL ? 'YES' : 'NO'));
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ready);
      } else {
        ready();
      }
    },

    stop: function() {
      _stopPollTimer();
      if (_countdownTimer)  { clearInterval(_countdownTimer);  _countdownTimer  = null; }
      if (_cooldownTimer)   { clearTimeout(_cooldownTimer);    _cooldownTimer   = null; }
      if (_wsHeartbeat)     { clearInterval(_wsHeartbeat);     _wsHeartbeat     = null; }
      if (_wsRetryTimer)    { clearTimeout(_wsRetryTimer);     _wsRetryTimer    = null; }
      if (_ws)              { try { _ws.close(); } catch(e) {} _ws = null;              }
      if (_bcChannel)       { try { _bcChannel.close(); } catch(e) {} _bcChannel = null; }
      _wsConnected  = false;
      _initialized  = false;
      _setIndicator('standby');
      log('dihentikan');
    },

    refresh: function() {
      log('manual refresh');
      _stopPollTimer();
      _doPoll();
    },

    status: function() {
      return {
        wsConnected  : _wsConnected,
        wsRetry      : _wsRetry,
        lastSync     : _lastSync,
        failCount    : _failCount,
        isFetching   : _isFetching,
        inCooldown   : !!_cooldownTimer,
        platform     : CFG.platform,
        supabaseOk   : !!(SB_URL && SB_KEY),
      };
    },
  };

}(window));
