/* =============================================================
   GTW BDO — gtw-realtime.js v2.0
   Auto-update TANPA refresh manual.

   PERUBAHAN v2.0 vs v1.0:
   • Polling 3 detik (aktif) / 30 detik (background) — 4x lebih cepat
   • Langsung poll saat: tab aktif kembali, HP di-unlock,
     koneksi internet kembali, window focus kembali
   • Retry otomatis jika gagal (max 5x, lalu cooldown 60 detik)
   • Timeout per-request 8 detik agar tidak numpuk
   • Indikator LIVE lebih informatif (countdown + status)
   • Tidak ada perubahan pada kode lama — cukup ganti file ini

   CARA PASANG (sama seperti v1.0, tidak ada yang berubah):

   ── index.html (desktop) ──────────────────────────────────
     <script src="gtw-realtime.js"></script>
     <script>GtwRealtime.init({ platform: 'desktop' });</script>

   ── Outbound-Monitor.html (dashboard React) ───────────────
     <script src="gtw-realtime.js"></script>
     Lalu di App() useEffect:
       GtwRealtime.init({ platform: 'monitor', monitorRefresh: loadAll });
       return () => GtwRealtime.stop();

   ── gtw-bdo-mobile.html (mobile) ─────────────────────────
     <script src="gtw-realtime.js"></script>
     <script>GtwRealtime.init({ platform: 'mobile' });</script>

   ── Setelah save berhasil (forms.js) ─────────────────────
     if (window.GtwRealtime) GtwRealtime.refresh();
   ============================================================ */

(function (global) {
  'use strict';

  /* ── Konfigurasi default ───────────────────────────────── */
  var CFG = {
    platform        : 'desktop',
    intervalActive  : 3000,    // 3 detik saat tab aktif
    intervalHidden  : 30000,   // 30 detik saat background
    monitorRefresh  : null,
    showIndicator   : true,
    debug           : false,
  };

  /* ── Internal state ────────────────────────────────────── */
  var _timer        = null;
  var _hashOb       = 0;
  var _hashHvs      = 0;
  var _hashIb       = 0;
  var _channel      = null;
  var _indEl        = null;
  var _lastSync     = null;
  var _isFetching   = false;   // cegah request tumpang tindih
  var _failCount    = 0;       // jumlah gagal berturut-turut
  var _cooldownTimer = null;   // timer cooldown setelah banyak gagal
  var _countdownTimer = null;  // timer countdown indikator
  var _nextPollAt   = null;    // kapan poll berikutnya
  var _initialized  = false;

  var MAX_FAIL      = 5;       // max gagal sebelum cooldown
  var COOLDOWN_MS   = 60000;   // 60 detik cooldown setelah banyak gagal
  var FETCH_TIMEOUT = 8000;    // timeout per request 8 detik

  /* ── Util ──────────────────────────────────────────────── */
  function log() {
    if (!CFG.debug) return;
    var a = Array.prototype.slice.call(arguments);
    a.unshift('[GtwRealtime v2]');
    Function.prototype.apply.call(console.log, console, a);
  }

  /* Hash djb2 */
  function djb2(data) {
    var s = JSON.stringify(data), h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
    return h >>> 0;
  }

  /* Resolve GAS URL */
  function resolveUrl() {
    if (typeof GAS_URL !== 'undefined' && GAS_URL) return GAS_URL;
    if (typeof CONFIG  !== 'undefined' && CONFIG.GAS_URL) return CONFIG.GAS_URL;
    return '';
  }

  /* Fetch dengan timeout */
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

  /* Fetch satu action dari GAS */
  function gasGet(action) {
    var url = new URL(resolveUrl());
    url.searchParams.set('action', action);
    url.searchParams.set('_t', Date.now()); // bust cache
    return fetchWithTimeout(url.toString(), FETCH_TIMEOUT);
  }

  /* ── Deteksi form/modal terbuka ───────────────────────── */
  function _isFormOpen() {
    if (CFG.platform === 'desktop') {
      if (document.querySelectorAll('.form-panel-body.open').length > 0) return true;
      if (document.querySelectorAll('.modal-overlay.open').length > 0)  return true;
      return false;
    }
    if (CFG.platform === 'mobile') {
      if (typeof STATE === 'undefined') return false;
      var pg = STATE.currentPage || '';
      return (pg === 'pgCreate' || pg === 'pgScan' || pg === 'pgPhoto' || pg === 'pgDetail');
    }
    return false; // monitor: React kelola sendiri
  }

  /* ── Core poll ─────────────────────────────────────────── */
  function _doPoll() {
    if (_isFetching) { log('masih fetching — skip'); return; }
    if (_cooldownTimer) { log('cooldown aktif — skip'); return; }
    if (_isFormOpen()) { log('form terbuka — skip'); _scheduleNext(); return; }

    _isFetching = true;
    _setIndicator('fetching');
    log('polling...');

    Promise.all([
      gasGet('getObList'),
      gasGet('getHvsList'),
      gasGet('getIbList'),
    ]).then(function(res) {
      _failCount = 0; // reset gagal

      var ob  = (res[0] && res[0].list)  ? res[0].list  : null;
      var hvs = (res[1] && res[1].list)  ? res[1].list  : null;
      var ib  = (res[2] && res[2].list)  ? res[2].list  : null;

      var hOb  = ob  ? djb2(ob)  : _hashOb;
      var hHvs = hvs ? djb2(hvs) : _hashHvs;
      var hIb  = ib  ? djb2(ib)  : _hashIb;

      var changed = (hOb !== _hashOb || hHvs !== _hashHvs || hIb !== _hashIb);
      if (changed) {
        log('data berubah → update UI');
        _hashOb = hOb; _hashHvs = hHvs; _hashIb = hIb;
        _applyUpdate(ob, hvs, ib);
        _flashIndicator();
        if (_channel) {
          try {
            _channel.postMessage({ type: 'gtw_update', ob: ob, hvs: hvs, ib: ib, ts: Date.now() });
          } catch(e) {}
        }
      }

      _lastSync = new Date();
      _isFetching = false;
      _setIndicator('live');
      _updateTimeLabel();
      _scheduleNext();

    }).catch(function(e) {
      log('gagal:', e.message || e);
      _isFetching = false;
      _failCount++;

      if (_failCount >= MAX_FAIL) {
        log('terlalu banyak gagal, cooldown', COOLDOWN_MS, 'ms');
        _setIndicator('error');
        _stopTimer();
        _cooldownTimer = setTimeout(function() {
          _cooldownTimer = null;
          _failCount = 0;
          log('cooldown selesai, restart polling');
          _startTimer();
          _doPoll();
        }, COOLDOWN_MS);
      } else {
        _setIndicator('error');
        // retry lebih cepat setelah gagal (2 detik)
        _scheduleNext(2000);
      }
    });
  }

  /* Jadwalkan poll berikutnya */
  function _scheduleNext(overrideMs) {
    if (_timer) { clearTimeout(_timer); _timer = null; }
    if (_cooldownTimer) return;
    var iv = overrideMs !== undefined
      ? overrideMs
      : (document.hidden ? CFG.intervalHidden : CFG.intervalActive);
    _nextPollAt = Date.now() + iv;
    _timer = setTimeout(function() { _doPoll(); }, iv);
    log('poll berikutnya dalam', iv, 'ms');
  }

  function _stopTimer() {
    if (_timer) { clearTimeout(_timer); _timer = null; }
    if (_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer = null; }
  }

  function _startTimer() {
    _stopTimer();
    _scheduleNext();
    /* Countdown indikator — update setiap detik */
    _countdownTimer = setInterval(function() {
      _updateCountdown();
    }, 1000);
  }

  /* ── Event listeners untuk auto-refresh ───────────────── */
  function _bindAutoEvents() {

    /* Tab aktif/background */
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) {
        log('tab aktif kembali → poll segera');
        _setIndicator('live');
        _doPoll();
      } else {
        log('tab background → perlambat interval');
        _scheduleNext(CFG.intervalHidden);
      }
    });

    /* Window focus (kembali dari tab lain / HP unlock) */
    window.addEventListener('focus', function() {
      if (!document.hidden) {
        log('window focus → poll segera');
        _doPoll();
      }
    });

    /* Koneksi internet kembali */
    window.addEventListener('online', function() {
      log('online kembali → poll segera');
      _failCount = 0;
      if (_cooldownTimer) {
        clearTimeout(_cooldownTimer);
        _cooldownTimer = null;
      }
      _setIndicator('live');
      _doPoll();
    });

    /* Koneksi internet mati */
    window.addEventListener('offline', function() {
      log('offline');
      _setIndicator('offline');
      _stopTimer();
    });

    /* Pageshow — saat user kembali via tombol back browser */
    window.addEventListener('pageshow', function(e) {
      if (e.persisted) {
        log('pageshow (bfcache) → poll segera');
        _doPoll();
      }
    });
  }

  /* ── Terapkan update ke platform ─────────────────────── */
  function _applyUpdate(ob, hvs, ib) {

    /* MONITOR (React) */
    if (CFG.platform === 'monitor') {
      if (typeof CFG.monitorRefresh === 'function') {
        CFG.monitorRefresh();
      }
      return;
    }

    /* DESKTOP */
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
      try { if (typeof _obibData !== 'undefined') global._obibData = null; } catch(e) {}
      try { if (typeof _mfLoaded !== 'undefined') global._mfLoaded = false; } catch(e) {}
      return;
    }

    /* MOBILE */
    if (CFG.platform === 'mobile') {
      try {
        if (typeof STATE !== 'undefined') {
          if (ob)  STATE.obData  = ob;
          if (hvs) STATE.hvsData = hvs;
          if (ib)  STATE.ibData  = ib;
        }
      } catch(e) {}
      try { if (typeof HomePage !== 'undefined') { HomePage.render(); HomePage.updateStats(); } } catch(e) {}
    }
  }

  /* ── BroadcastChannel ──────────────────────────────────── */
  function _initChannel() {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
      _channel = new BroadcastChannel('gtw_bdo_realtime_v2');
      _channel.onmessage = function(e) {
        var d = e.data;
        if (!d || d.type !== 'gtw_update') return;
        log('BroadcastChannel: data dari tab lain');
        _applyUpdate(d.ob || null, d.hvs || null, d.ib || null);
        _lastSync = new Date(d.ts);
        _setIndicator('live');
        _updateTimeLabel();
        _flashIndicator();
      };
    } catch(e) {}
  }

  /* ── Indikator LIVE ────────────────────────────────────── */
  function _injectCSS() {
    if (document.getElementById('gtw-rt2-css')) return;
    var s = document.createElement('style');
    s.id = 'gtw-rt2-css';
    s.textContent = [
      '#gtw-rt2{',
        'position:fixed;bottom:14px;right:14px;',
        'display:flex;align-items:center;gap:7px;',
        'background:rgba(10,15,28,.88);',
        'border:1px solid rgba(255,255,255,.1);',
        'border-radius:999px;',
        'padding:6px 13px 6px 10px;',
        'font:600 11px/1 "DM Sans","Plus Jakarta Sans","Segoe UI",sans-serif;',
        'color:#94a3b8;',
        'box-shadow:0 4px 20px rgba(0,0,0,.4);',
        'backdrop-filter:blur(10px);',
        '-webkit-backdrop-filter:blur(10px);',
        'z-index:99999;user-select:none;cursor:default;',
        'transition:opacity .3s;',
      '}',
      '#gtw-rt2 .rt2-dot{',
        'width:8px;height:8px;border-radius:50%;',
        'background:#22c55e;flex-shrink:0;',
        'transition:background .3s;',
      '}',
      '#gtw-rt2.s-live .rt2-dot{animation:rt2pulse 2s ease-in-out infinite;}',
      '#gtw-rt2.s-fetching .rt2-dot{background:#60a5fa;animation:rt2spin 1s linear infinite;}',
      '#gtw-rt2.s-error .rt2-dot{background:#ef4444;animation:none;}',
      '#gtw-rt2.s-offline .rt2-dot{background:#f59e0b;animation:none;}',
      '#gtw-rt2.s-standby .rt2-dot{background:#64748b;animation:none;}',
      '#gtw-rt2 .rt2-lbl{color:#e2e8f0;font-size:11px;font-weight:700;letter-spacing:.3px;}',
      '#gtw-rt2 .rt2-time{color:#475569;font-size:10px;margin-left:1px;font-variant-numeric:tabular-nums;}',
      '#gtw-rt2 .rt2-cd{',
        'color:#1e40af;font-size:9px;font-weight:700;',
        'background:rgba(96,165,250,.12);',
        'border-radius:4px;padding:1px 5px;',
        'font-variant-numeric:tabular-nums;',
        'letter-spacing:.3px;',
      '}',
      '#gtw-rt2.s-updated{border-color:rgba(34,197,94,.5);box-shadow:0 0 0 3px rgba(34,197,94,.12),0 4px 20px rgba(0,0,0,.4);}',
      '@keyframes rt2pulse{',
        '0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.5);}',
        '50%{box-shadow:0 0 0 5px rgba(34,197,94,0);}',
      '}',
      '@keyframes rt2spin{',
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
    if (document.getElementById('gtw-rt2')) {
      _indEl = document.getElementById('gtw-rt2');
      return;
    }
    _injectCSS();
    var el = document.createElement('div');
    el.id = 'gtw-rt2';
    el.className = 's-live';
    el.innerHTML = [
      '<span class="rt2-dot"></span>',
      '<span class="rt2-lbl" id="gtw-rt2-lbl">LIVE</span>',
      '<span class="rt2-time" id="gtw-rt2-time">—</span>',
      '<span class="rt2-cd" id="gtw-rt2-cd" style="display:none">—</span>',
    ].join('');
    document.body.appendChild(el);
    _indEl = el;
  }

  var _statusMap = {
    live     : { cls: 's-live',     lbl: 'LIVE'    },
    fetching : { cls: 's-fetching', lbl: 'SYNC...' },
    error    : { cls: 's-error',    lbl: 'ERROR'   },
    offline  : { cls: 's-offline',  lbl: 'OFFLINE' },
    standby  : { cls: 's-standby',  lbl: 'PAUSE'   },
  };

  function _setIndicator(s) {
    if (!_indEl) return;
    var m = _statusMap[s] || _statusMap.live;
    _indEl.className = m.cls;
    var lbl = document.getElementById('gtw-rt2-lbl');
    if (lbl) lbl.textContent = m.lbl;
  }

  /* Flash hijau singkat saat ada data baru */
  function _flashIndicator() {
    if (!_indEl) return;
    _indEl.classList.add('s-updated');
    setTimeout(function() {
      if (_indEl) _indEl.classList.remove('s-updated');
    }, 1500);
  }

  function _updateTimeLabel() {
    var el = document.getElementById('gtw-rt2-time');
    if (!el || !_lastSync) return;
    var d = _lastSync;
    var p = function(n) { return n < 10 ? '0' + n : '' + n; };
    el.textContent = p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  function _updateCountdown() {
    var el = document.getElementById('gtw-rt2-cd');
    if (!el) return;
    if (!_nextPollAt || _isFetching || _cooldownTimer) {
      el.style.display = 'none';
      return;
    }
    var sec = Math.max(0, Math.ceil((_nextPollAt - Date.now()) / 1000));
    el.style.display = 'inline-block';
    el.textContent = sec + 's';
  }

  /* ── PUBLIC ────────────────────────────────────────────── */
  global.GtwRealtime = {

    /**
     * Mulai realtime. Gantikan init() lama — parameter sama.
     * @param {Object} options
     *   platform       : 'desktop' | 'monitor' | 'mobile'
     *   monitorRefresh : fungsi loadAll() dari React
     *   intervalActive : ms (default 3000)
     *   intervalHidden : ms (default 30000)
     *   showIndicator  : boolean (default true)
     *   debug          : boolean (default false)
     */
    init: function(options) {
      if (_initialized) return; // cegah double init
      options = options || {};
      Object.keys(options).forEach(function(k) { CFG[k] = options[k]; });

      if (!resolveUrl()) {
        console.warn('[GtwRealtime v2] GAS URL tidak ditemukan. Dinonaktifkan.');
        return;
      }

      var ready = function() {
        if (CFG.showIndicator !== false) _createIndicator();
        _initChannel();
        _bindAutoEvents();
        /* Poll pertama langsung setelah 1.5 detik */
        setTimeout(function() {
          _doPoll();
          _startTimer();
        }, 1500);
        _initialized = true;
        log('init ok — platform=' + CFG.platform + ' interval=' + CFG.intervalActive + 'ms');
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ready);
      } else {
        ready();
      }
    },

    /** Hentikan semua polling */
    stop: function() {
      _stopTimer();
      if (_cooldownTimer) { clearTimeout(_cooldownTimer); _cooldownTimer = null; }
      if (_channel) { try { _channel.close(); } catch(e) {} _channel = null; }
      _setIndicator('standby');
      _initialized = false;
      log('dihentikan');
    },

    /** Paksa poll sekarang (setelah save berhasil) */
    refresh: function() {
      log('manual refresh');
      if (_timer) { clearTimeout(_timer); _timer = null; }
      _doPoll();
    },
  };

}(window));
