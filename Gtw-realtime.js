/* =============================================================
   GTW BDO — gtw-realtime.js v1.0
   Auto-polling realtime tanpa refresh manual.

   CARA PASANG (tidak ada kode lama yang diubah/dihapus):

   ── index.html (desktop) ──────────────────────────────────
   Tambahkan SETELAH semua <script> yang ada, sebelum </body>:
     <script src="gtw-realtime.js"></script>
     <script>GtwRealtime.init({ platform: 'desktop' });</script>

   ── Outbound-Monitor.html (dashboard) ────────────────────
   Tambahkan tag script setelah React CDN:
     <script src="gtw-realtime.js"></script>
   Lalu di dalam App(), cari baris:
     React.useEffect(() => { loadAll(); }, []);
   Ganti HANYA baris itu dengan:
     React.useEffect(() => {
       loadAll();
       GtwRealtime.init({ platform: 'monitor', monitorRefresh: loadAll });
       return () => GtwRealtime.stop();
     }, []);

   ── gtw-bdo-mobile.html (mobile) ─────────────────────────
   Tambahkan SETELAH <script src="app-mobile.js">:
     <script src="gtw-realtime.js"></script>
     <script>GtwRealtime.init({ platform: 'mobile' });</script>

   ── Opsional: trigger refresh setelah save (forms.js) ─────
   Di setiap fungsi saveOb, saveHvs, saveIb — setelah
   toast('Berhasil...') — tambahkan:
     if (window.GtwRealtime) GtwRealtime.refresh();
   ============================================================

   CARA KERJA:
   • Polling otomatis setiap 12 detik (tab aktif) / 60 detik
     (tab background) — hemat request, tidak boros kuota
   • Hanya update UI jika data BENAR-BENAR BERUBAH (hash compare)
   • BroadcastChannel: 2 tab browser di device sama → saat satu
     tab terima data baru, tab lain langsung update TANPA poll
   • Skip otomatis saat form/scan/modal sedang terbuka
   • Indikator dot LIVE di pojok kanan bawah
   ============================================================ */

(function (global) {
  'use strict';

  /* ── Konfigurasi default ───────────────────────────────── */
  var CFG = {
    platform        : 'desktop',  // 'desktop' | 'monitor' | 'mobile'
    intervalActive  : 12000,       // ms — tab aktif
    intervalHidden  : 60000,       // ms — tab background
    monitorRefresh  : null,        // fungsi loadAll() dari React App()
    showIndicator   : true,
    debug           : false,
  };

  /* ── Internal state ────────────────────────────────────── */
  var _timer    = null;
  var _hashOb   = 0;
  var _hashHvs  = 0;
  var _hashIb   = 0;
  var _channel  = null;
  var _indEl    = null;
  var _lastSync = null;

  /* ── Util ──────────────────────────────────────────────── */
  function log() {
    if (!CFG.debug) return;
    var a = Array.prototype.slice.call(arguments);
    a.unshift('[GtwRealtime]');
    Function.prototype.apply.call(console.log, console, a);
  }

  /* Hash djb2 — deteksi perubahan data */
  function djb2(data) {
    var s = JSON.stringify(data), h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
    return h >>> 0;
  }

  /* Resolve GAS URL dari lingkungan yang ada */
  function resolveUrl() {
    if (typeof GAS_URL !== 'undefined' && GAS_URL) return GAS_URL;
    if (typeof CONFIG  !== 'undefined' && CONFIG.GAS_URL) return CONFIG.GAS_URL;
    return '';
  }

  /* Fetch JSON dari GAS tanpa cache */
  function gasGet(action) {
    var url = new URL(resolveUrl());
    url.searchParams.set('action', action);
    return fetch(url.toString(), { redirect: 'follow', mode: 'cors', cache: 'no-store' })
      .then(function (r) { return r.json(); });
  }

  /* ── Deteksi apakah form/modal/scan sedang terbuka ───── */
  function _isFormOpen() {
    if (CFG.platform === 'desktop') {
      /* form panel terbuka */
      var bodies = document.querySelectorAll('.form-body.open');
      if (bodies.length > 0) return true;
      /* modal overlay terbuka */
      var modals = document.querySelectorAll('.modal-overlay.open');
      if (modals.length > 0) return true;
      return false;
    }
    if (CFG.platform === 'mobile') {
      if (typeof STATE === 'undefined') return false;
      var pg = STATE.currentPage || '';
      return (pg === 'pgCreate' || pg === 'pgScan' || pg === 'pgPhoto' || pg === 'pgDetail');
    }
    /* monitor — React mengelola state-nya sendiri, selalu boleh refresh */
    return false;
  }

  /* ── Core poll ─────────────────────────────────────────── */
  function _doPoll() {
    if (_isFormOpen()) { log('form terbuka — skip'); return; }

    log('polling...');

    Promise.all([
      gasGet('getObList'),
      gasGet('getHvsList'),
      gasGet('getIbList'),
    ]).then(function (res) {
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
        /* Broadcast ke tab lain di browser yang sama */
        if (_channel) {
          try { _channel.postMessage({ type: 'gtw_update', ob: ob, hvs: hvs, ib: ib, ts: Date.now() }); }
          catch (e) {}
        }
      }

      _lastSync = new Date();
      _setIndicator('live');
      _updateTime();
    }).catch(function (e) {
      log('gagal:', e.message || e);
      _setIndicator('error');
    });
  }

  /* ── Terapkan update ke platform ─────────────────────── */
  function _applyUpdate(ob, hvs, ib) {

    /* ── DESKTOP ── */
    if (CFG.platform === 'desktop') {
      /* Update data global */
      try { if (ob  && typeof obData  !== 'undefined') { global.obData  = ob;  } } catch(e) {}
      try { if (hvs && typeof hvsData !== 'undefined') { global.hvsData = hvs; } } catch(e) {}
      try { if (ib  && typeof ibData  !== 'undefined') { global.ibData  = ib;  } } catch(e) {}
      /* Render tabel & statistik */
      try { if (ob  && typeof renderObTable  === 'function') renderObTable();  } catch(e) {}
      try { if (hvs && typeof renderHvsTable === 'function') renderHvsTable(); } catch(e) {}
      try { if (ib  && typeof renderIbTable  === 'function') renderIbTable();  } catch(e) {}
      try { if (ob  && typeof updateObStats  === 'function') updateObStats();  } catch(e) {}
      try { if (hvs && typeof updateHvsStats === 'function') updateHvsStats(); } catch(e) {}
      try { if (ib  && typeof updateIbStats  === 'function') updateIbStats();  } catch(e) {}
      /* Invalidate cache OB&IB dan Manifest agar fresh saat dibuka */
      try { if (typeof _obibData !== 'undefined') global._obibData = null; } catch(e) {}
      try { if (typeof _mfLoaded !== 'undefined') global._mfLoaded = false; } catch(e) {}
      return;
    }

    /* ── MONITOR (React) ── */
    if (CFG.platform === 'monitor') {
      if (typeof CFG.monitorRefresh === 'function') {
        CFG.monitorRefresh();
      }
      return;
    }

    /* ── MOBILE ── */
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

  /* ── Timer ─────────────────────────────────────────────── */
  function _startTimer() {
    if (_timer) clearInterval(_timer);
    var iv = document.hidden ? CFG.intervalHidden : CFG.intervalActive;
    _timer = setInterval(_doPoll, iv);
    log('timer iv=' + iv + 'ms');
  }

  function _stopTimer() {
    if (_timer) { clearInterval(_timer); _timer = null; }
  }

  /* Page Visibility API — percepat/perlambat saat tab aktif */
  document.addEventListener('visibilitychange', function () {
    _stopTimer();
    _startTimer();
    if (!document.hidden) {
      setTimeout(_doPoll, 200);
      _setIndicator('live');
    } else {
      _setIndicator('standby');
    }
  });

  /* ── BroadcastChannel ──────────────────────────────────── */
  function _initChannel() {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
      _channel = new BroadcastChannel('gtw_bdo_realtime_v1');
      _channel.onmessage = function (e) {
        var d = e.data;
        if (!d || d.type !== 'gtw_update') return;
        log('BroadcastChannel: data dari tab lain');
        _applyUpdate(d.ob || null, d.hvs || null, d.ib || null);
        _lastSync = new Date(d.ts);
        _setIndicator('live');
        _updateTime();
      };
    } catch(e) {}
  }

  /* ── Indikator LIVE ────────────────────────────────────── */
  function _injectCSS() {
    if (document.getElementById('gtw-rt-css')) return;
    var s = document.createElement('style');
    s.id  = 'gtw-rt-css';
    s.textContent =
      '#gtw-rt-bar{position:fixed;bottom:16px;right:16px;display:flex;align-items:center;' +
      'gap:6px;background:rgba(10,15,25,.82);border:1px solid rgba(255,255,255,.09);' +
      'border-radius:999px;padding:5px 13px 5px 9px;' +
      'font:600 11px/1 "Plus Jakarta Sans","Segoe UI",sans-serif;' +
      'color:#ccc;box-shadow:0 4px 18px rgba(0,0,0,.35);' +
      'backdrop-filter:blur(8px);z-index:99999;user-select:none;cursor:default;}' +
      '#gtw-rt-bar .rt-dot{width:7px;height:7px;border-radius:50%;' +
      'background:#22c55e;flex-shrink:0;transition:background .3s;}' +
      '#gtw-rt-bar.rt-live .rt-dot{animation:rtpulse 1.8s ease-in-out infinite;}' +
      '#gtw-rt-bar.rt-error .rt-dot{background:#ef4444;animation:none;}' +
      '#gtw-rt-bar.rt-standby .rt-dot{background:#f59e0b;animation:none;}' +
      '#gtw-rt-bar .rt-lbl{color:#fff;}' +
      '#gtw-rt-bar .rt-time{color:#555;font-size:10px;margin-left:1px;}' +
      '@keyframes rtpulse{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.5);}' +
      '50%{box-shadow:0 0 0 5px rgba(34,197,94,0);}}';
    document.head.appendChild(s);
  }

  function _createIndicator() {
    if (document.getElementById('gtw-rt-bar')) { _indEl = document.getElementById('gtw-rt-bar'); return; }
    _injectCSS();
    var el = document.createElement('div');
    el.id  = 'gtw-rt-bar';
    el.innerHTML = '<span class="rt-dot"></span><span class="rt-lbl">LIVE</span><span class="rt-time" id="gtw-rt-time">—</span>';
    document.body.appendChild(el);
    _indEl = el;
  }

  function _setIndicator(s) {
    if (!_indEl) return;
    _indEl.className = 'rt-' + s;
    var lbl = _indEl.querySelector('.rt-lbl');
    if (!lbl) return;
    lbl.textContent = s === 'live' ? 'LIVE' : s === 'error' ? 'ERROR' : 'STANDBY';
  }

  function _updateTime() {
    var el = document.getElementById('gtw-rt-time');
    if (!el || !_lastSync) return;
    var d = _lastSync, p = function (n) { return n < 10 ? '0' + n : '' + n; };
    el.textContent = p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  /* ── PUBLIC ────────────────────────────────────────────── */
  global.GtwRealtime = {

    /**
     * Mulai realtime polling.
     * @param {Object} options
     *   platform       : 'desktop' | 'monitor' | 'mobile'
     *   monitorRefresh : fungsi loadAll() dari React App()
     *   intervalActive : ms (default 12000)
     *   intervalHidden : ms (default 60000)
     *   showIndicator  : boolean (default true)
     *   debug          : boolean (default false)
     */
    init: function (options) {
      options = options || {};
      Object.keys(options).forEach(function (k) { CFG[k] = options[k]; });

      if (!resolveUrl()) {
        console.warn('[GtwRealtime] GAS URL tidak ditemukan. Dinonaktifkan.');
        return;
      }

      var ready = function () {
        if (CFG.showIndicator !== false) _createIndicator();
        _initChannel();
        /* Poll pertama 3 detik setelah load agar tidak benturan dengan init halaman */
        setTimeout(function () { _doPoll(); _startTimer(); }, 3000);
        log('init ok — platform=' + CFG.platform);
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ready);
      } else {
        ready();
      }
    },

    /** Hentikan semua polling */
    stop: function () {
      _stopTimer();
      if (_channel) { try { _channel.close(); } catch(e) {} _channel = null; }
      _setIndicator('standby');
      log('dihentikan');
    },

    /** Paksa poll sekarang (mis. setelah save berhasil) */
    refresh: function () { _doPoll(); },
  };

}(window));
