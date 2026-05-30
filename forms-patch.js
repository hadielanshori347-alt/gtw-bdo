/* ============================================================
   GTW BDO — forms-patch.js v1.0
   PATCH: 2-Phase Flow untuk OB & HVS
   
   ALUR BARU:
   Phase 1 (Setup): Isi Service + Tujuan → Klik "Setup & Lanjut ke Input"
                    → Server buat NO TRACK → Langsung ke Phase 2
   Phase 2 (Input): Combobox tujuan di atas, scan AWB per tujuan,
                    data tidak hilang saat ganti tujuan
                    → Tombol "Simpan Semua" untuk commit ke server
   
   ⚠️  Semua logika existing di forms.js TIDAK DIUBAH.
       Patch ini hanya mengganti tampilan form panel OB & HVS
       dengan UI 2-phase yang baru.
   ============================================================ */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────────
     INJECT CSS untuk phase 2 input panel
  ───────────────────────────────────────────────────────────── */
  function injectPatchCSS() {
    if (document.getElementById('_formsPatchCSS')) return;
    var s = document.createElement('style');
    s.id = '_formsPatchCSS';
    s.textContent = `

/* ══ PHASE INDICATOR ══ */
.fp2-phase-bar {
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 16px;
  background: var(--surface-2);
  border-radius: 10px;
  padding: 4px;
  border: 1px solid var(--surface-3);
}
.fp2-phase-step {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 8px 12px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-faint);
  transition: all .2s ease;
  cursor: default;
}
.fp2-phase-step.active {
  background: var(--surface);
  color: var(--accent);
  box-shadow: 0 1px 4px rgba(15,23,42,.08);
}
.fp2-phase-step.done {
  color: var(--green);
}
.fp2-phase-step .fp2-num {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  background: var(--surface-3);
  color: var(--ink-low);
  flex-shrink: 0;
  transition: all .2s ease;
}
.fp2-phase-step.active .fp2-num {
  background: var(--accent);
  color: #fff;
}
.fp2-phase-step.done .fp2-num {
  background: var(--green);
  color: #fff;
}
.fp2-phase-arrow {
  color: var(--ink-ghost);
  font-size: 16px;
  flex-shrink: 0;
  margin: 0 -2px;
}

/* ══ PHASE 2: INPUT AWB PANEL ══ */
.fp2-input-panel {
  background: var(--surface);
  border-radius: var(--r2);
  border: 1px solid var(--surface-3);
  margin-bottom: 14px;
  overflow: visible;
  box-shadow: var(--shadow-xs);
}

.fp2-input-header {
  background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
  padding: 13px 18px;
  border-radius: var(--r2) var(--r2) 0 0;
  display: flex;
  align-items: center;
  gap: 10px;
}
.fp2-input-header-title {
  color: rgba(255,255,255,.9);
  font-weight: 700;
  font-size: 13px;
  flex: 1;
  letter-spacing: -.01em;
}
.fp2-input-header-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}
.fp2-meta-chip {
  background: rgba(255,255,255,.1);
  border: 1px solid rgba(255,255,255,.15);
  color: rgba(255,255,255,.8);
  border-radius: 20px;
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}
.fp2-meta-chip .material-icons-round {
  font-size: 12px;
  opacity: .7;
}

.fp2-input-body {
  padding: 16px 18px;
}

/* ══ TUJUAN SELECTOR (top bar) ══ */
.fp2-tuj-selector {
  background: var(--accent-faint);
  border: 1px solid var(--accent-light);
  border-radius: var(--r2);
  padding: 12px 16px;
  margin-bottom: 14px;
}
.fp2-tuj-selector-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: .8px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.fp2-tuj-selector-label .material-icons-round {
  font-size: 13px;
}
.fp2-tuj-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}
.fp2-tuj-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  background: var(--surface);
  color: var(--ink-mid);
  border: 1.5px solid var(--surface-3);
  transition: all .15s ease;
  position: relative;
}
.fp2-tuj-tab:hover {
  border-color: var(--accent-mid);
  color: var(--accent);
  background: var(--accent-faint);
}
.fp2-tuj-tab.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
  box-shadow: 0 2px 8px rgba(37,99,235,.25);
}
.fp2-tuj-tab .fp2-tab-cnt {
  background: rgba(255,255,255,.25);
  color: inherit;
  border-radius: 10px;
  padding: 1px 7px;
  font-size: 10.5px;
  font-weight: 700;
  min-width: 20px;
  text-align: center;
}
.fp2-tuj-tab:not(.active) .fp2-tab-cnt {
  background: var(--accent-faint);
  color: var(--accent);
}
.fp2-tuj-notrack {
  font-size: 10px;
  opacity: .65;
  font-weight: 500;
  margin-top: 1px;
}

/* ══ SCAN INPUT AREA ══ */
.fp2-scan-area {
  background: var(--surface-1);
  border: 1.5px solid var(--surface-3);
  border-radius: var(--r2);
  padding: 14px 16px;
  margin-bottom: 12px;
}
.fp2-scan-area-title {
  font-size: 10px;
  font-weight: 700;
  color: var(--ink-low);
  text-transform: uppercase;
  letter-spacing: .8px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.fp2-scan-area-title .fp2-scan-count {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--accent);
  font-weight: 700;
  background: var(--accent-faint);
  padding: 2px 8px;
  border-radius: 10px;
}
.fp2-scan-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.fp2-scan-inp {
  flex: 1;
  padding: 10px 14px;
  border: 1.5px solid var(--accent-light);
  border-radius: var(--r);
  font-size: 13px;
  font-family: var(--mono);
  color: var(--ink);
  outline: none;
  transition: all .15s ease;
  background: var(--surface);
}
.fp2-scan-inp:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-light);
}
.fp2-scan-inp:disabled {
  background: var(--surface-2);
  border-color: var(--surface-3);
  color: var(--ink-ghost);
  cursor: not-allowed;
}

/* ══ AWB LIST dalam phase 2 ══ */
.fp2-awb-list {
  background: var(--surface);
  border: 1px solid var(--surface-3);
  border-radius: var(--r);
  max-height: 200px;
  overflow-y: auto;
  margin-top: 10px;
}
.fp2-awb-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 12px;
  border-bottom: 1px solid var(--surface-2);
  font-size: 11.5px;
  font-family: var(--mono);
  animation: fp2ItemIn .12s ease;
}
.fp2-awb-item:last-child { border-bottom: none; }
.fp2-awb-item:hover { background: var(--surface-1); }
@keyframes fp2ItemIn {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: none; }
}
.fp2-awb-num {
  color: var(--ink-faint);
  font-size: 10px;
  min-width: 22px;
}
.fp2-awb-text {
  flex: 1;
  color: var(--ink);
  font-weight: 500;
}
.fp2-awb-del {
  color: var(--red);
  cursor: pointer;
  font-size: 15px;
  padding: 3px;
  border-radius: 4px;
  opacity: .6;
  transition: all .13s;
}
.fp2-awb-del:hover {
  opacity: 1;
  background: var(--red-light);
}
.fp2-awb-empty {
  padding: 20px;
  text-align: center;
  color: var(--ink-faint);
  font-size: 12px;
  font-family: var(--font);
}
.fp2-awb-empty .material-icons-round {
  display: block;
  font-size: 24px;
  color: var(--ink-ghost);
  margin-bottom: 6px;
}

/* ══ SUMMARY BAR ══ */
.fp2-summary-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--surface-2);
  border: 1px solid var(--surface-3);
  border-radius: var(--r);
  padding: 10px 14px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.fp2-summary-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  color: var(--ink-mid);
}
.fp2-summary-item strong {
  color: var(--ink);
  font-family: var(--mono);
}
.fp2-summary-sep {
  color: var(--ink-ghost);
  font-size: 14px;
}

/* ══ FOOTER ACTIONS ══ */
.fp2-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid var(--surface-2);
  gap: 8px;
  flex-wrap: wrap;
}
.fp2-footer-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fp2-footer-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fp2-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  border-radius: var(--r);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  background: var(--surface);
  border: 1px solid var(--surface-3);
  color: var(--ink-mid);
  font-family: var(--font);
  transition: all .15s;
}
.fp2-back-btn:hover {
  background: var(--surface-1);
  border-color: var(--ink-ghost);
}
.fp2-save-all-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 20px;
  border-radius: var(--r);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  background: var(--green);
  border: none;
  color: #fff;
  font-family: var(--font);
  transition: all .15s;
  box-shadow: 0 2px 8px rgba(5,150,105,.25);
}
.fp2-save-all-btn:hover {
  background: #047857;
  box-shadow: 0 4px 12px rgba(5,150,105,.35);
}
.fp2-save-all-btn:disabled {
  background: var(--ink-ghost);
  color: var(--ink-faint);
  cursor: not-allowed;
  box-shadow: none;
}
.fp2-save-all-btn .material-icons-round {
  font-size: 16px;
}

/* ══ SAVING STATE ══ */
.fp2-saving-overlay {
  position: absolute;
  inset: 0;
  background: rgba(248,250,252,.85);
  border-radius: var(--r2);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  z-index: 10;
  backdrop-filter: blur(2px);
}
.fp2-saving-overlay .fp2-saving-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--surface-3);
  border-top: 3px solid var(--green);
  border-radius: 50%;
  animation: spin .7s linear infinite;
}
.fp2-saving-overlay .fp2-saving-text {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ink-mid);
}

/* ══ TUJUAN BADGE dalam setup ══ */
.fp2-tuj-badge-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 8px;
}
.fp2-tuj-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--accent-faint);
  color: var(--accent);
  border: 1px solid var(--accent-light);
  border-radius: 20px;
  font-size: 11.5px;
  font-weight: 600;
  padding: 3px 10px;
}
.fp2-tuj-badge-x {
  cursor: pointer;
  font-size: 14px;
  color: var(--accent);
  opacity: .7;
  transition: opacity .13s;
}
.fp2-tuj-badge-x:hover {
  opacity: 1;
  color: var(--red);
}

/* ══ SUCCESS FLASH ══ */
.fp2-success-flash {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--green-light);
  border: 1px solid #A7F3D0;
  border-radius: var(--r);
  padding: 10px 14px;
  font-size: 12.5px;
  font-weight: 600;
  color: #065F46;
  margin-bottom: 10px;
  animation: fp2FadeIn .25s ease;
}
@keyframes fp2FadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: none; }
}
.fp2-success-flash .material-icons-round {
  font-size: 16px;
  color: var(--green);
}

    `;
    document.head.appendChild(s);
  }

  /* ─────────────────────────────────────────────────────────────
     STATE untuk 2-phase flow
     Terpisah dari state existing (obScanMap, hvsScanMap, dll)
  ───────────────────────────────────────────────────────────── */
  
  // State per type: 'ob' | 'hvs'
  var _fp2State = {
    ob: {
      phase: 1,           // 1 = setup, 2 = input awb
      service: '',
      tujuans: [],        // ['GTW_JAKARTA', 'GTW_BAWEN', ...]
      noTracks: {},       // { 'GTW_JAKARTA': 'OB_SAM_..._xxx', ... }
      awbs: {},           // { 'GTW_JAKARTA': ['awb1','awb2'], ... }
      activeTuj: '',
      saving: false,
      setupDone: false,
    },
    hvs: {
      phase: 1,
      service: '',
      tujuans: [],
      noTracks: {},
      awbs: {},
      activeTuj: '',
      saving: false,
      setupDone: false,
    }
  };

  /* ─────────────────────────────────────────────────────────────
     HELPER
  ───────────────────────────────────────────────────────────── */
  function escH2(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escQ2(s) {
    return (s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }
  function totalAwbAllTuj(type) {
    var st = _fp2State[type];
    return st.tujuans.reduce(function (s, t) {
      return s + (st.awbs[t] ? st.awbs[t].length : 0);
    }, 0);
  }

  /* ─────────────────────────────────────────────────────────────
     PHASE 1: SETUP UI
     Inject custom setup panel menggantikan form-panel-body existing
  ───────────────────────────────────────────────────────────── */
  function renderPhase1(type) {
    var st = _fp2State[type];
    var bodyId = type + 'FormBody';
    var body   = document.getElementById(bodyId);
    if (!body) return;

    // Pastikan form panel body open
    body.classList.add('open');
    var iconEl = document.getElementById(type + 'FormIcon');
    if (iconEl) iconEl.innerText = 'expand_less';

    var incharge = (typeof globalIncharge !== 'undefined') ? globalIncharge : '';

    // Kumpulkan opsi tujuan dari cbOptions
    var tujOpts = [];
    try {
      if (type === 'ib') {
        tujOpts = (typeof cbOptions !== 'undefined' && cbOptions.ib) ? (cbOptions.ib.tujuan || []) : [];
      } else {
        tujOpts = (typeof cbOptions !== 'undefined' && cbOptions[type]) ? (cbOptions[type].tujuan || []) : [];
      }
    } catch(e) {}

    var svcOpts = [];
    try {
      svcOpts = (typeof cbOptions !== 'undefined' && cbOptions[type]) ? (cbOptions[type].service || []) : [];
    } catch(e) {}

    // Badge tujuan yang sudah dipilih
    var tujBadges = st.tujuans.map(function (t, i) {
      return '<span class="fp2-tuj-badge">' +
        escH2(t) +
        '<span class="fp2-tuj-badge-x material-icons-round" ' +
          'onclick="window._fp2RemoveTuj(\'' + type + '\',' + i + ')">cancel</span>' +
      '</span>';
    }).join('');

    // Cek apakah data dari incharge sudah tersedia
    var hasIncharge = !!incharge;
    var warnHtml = !hasIncharge
      ? '<div class="warn-bar" style="margin-bottom:12px"><span class="material-icons-round">warning_amber</span>Pilih <strong>Incharge</strong> terlebih dahulu di topbar.</div>'
      : '';
    var infoHtml = hasIncharge
      ? '<div class="info-bar" style="margin-bottom:12px"><span class="material-icons-round">badge</span><span>Incharge: <strong>' + escH2(incharge) + '</strong></span><span class="hint">(ubah di topbar)</span></div>'
      : '';

    var setupContent = !hasIncharge ? '' : `
      <div class="form-grid" style="margin-bottom:12px">
        <div class="fg">
          <label>SERVICE *</label>
          <div class="form-smart-cb" id="fp2-svc-cb-${type}">
            <input class="form-smart-cb-input" id="fp2-svc-inp-${type}"
              value="${escH2(st.service)}"
              placeholder="Pilih service..."
              autocomplete="off">
            <span class="material-icons-round form-smart-cb-arrow"
              onclick="window._fp2ToggleSvcCb('${type}')">expand_more</span>
            <div class="form-smart-cb-dropdown" id="fp2-svc-drop-${type}"></div>
          </div>
        </div>
        <div class="fg" id="fp2-tuj-field-${type}">
          <label>TAMBAH TUJUAN</label>
          <div style="display:flex;gap:6px">
            <div class="form-smart-cb" id="fp2-tuj-cb-${type}" style="flex:1">
              <input class="form-smart-cb-input" id="fp2-tuj-inp-${type}"
                placeholder="${st.service ? 'Ketik / pilih tujuan...' : 'Pilih service dulu...'}"
                autocomplete="off"
                ${!st.service ? 'disabled' : ''}>
              <span class="material-icons-round form-smart-cb-arrow"
                onclick="window._fp2ToggleTujCb('${type}')">expand_more</span>
              <div class="form-smart-cb-dropdown" id="fp2-tuj-drop-${type}"></div>
            </div>
            <button class="btn btn-sm" style="background:var(--accent-faint);color:var(--accent);border:1px solid var(--accent-light);flex-shrink:0"
              onclick="window._fp2AddTuj('${type}')" ${!st.service ? 'disabled' : ''}>
              <span class="material-icons-round" style="font-size:14px">add</span> Tambah
            </button>
          </div>
        </div>
      </div>

      ${st.tujuans.length ? `
      <div style="margin-bottom:14px">
        <div style="font-size:10px;font-weight:700;color:var(--ink-low);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px">
          TUJUAN DIPILIH (${st.tujuans.length})
        </div>
        <div class="fp2-tuj-badge-list">${tujBadges}</div>
      </div>` : ''}

      <div class="form-actions" style="display:flex">
        <button class="btn btn-outline btn-sm" onclick="window._fp2CancelSetup('${type}')">
          <span class="material-icons-round">close</span> Batal
        </button>
        <button class="btn btn-primary" id="fp2-setup-btn-${type}"
          onclick="window._fp2ProceedSetup('${type}')"
          ${!st.service || !st.tujuans.length ? 'disabled' : ''}
          style="gap:6px;padding:8px 18px">
          <span class="material-icons-round">arrow_forward</span>
          Setup & Lanjut ke Input AWB
        </button>
      </div>
    `;

    body.innerHTML = `
      <div class="fp2-phase-bar">
        <div class="fp2-phase-step active">
          <span class="fp2-num">1</span>
          <span>Setup Service &amp; Tujuan</span>
        </div>
        <span class="material-icons-round fp2-phase-arrow">chevron_right</span>
        <div class="fp2-phase-step">
          <span class="fp2-num">2</span>
          <span>Input AWB per Tujuan</span>
        </div>
      </div>
      ${warnHtml}
      ${infoHtml}
      ${setupContent}
    `;

    // Init dropdowns setelah render
    if (hasIncharge) {
      _fp2InitSvcDropdown(type, svcOpts);
      _fp2InitTujDropdown(type, tujOpts);
    }
  }

  function _fp2InitSvcDropdown(type, opts) {
    var inp  = document.getElementById('fp2-svc-inp-' + type);
    var drop = document.getElementById('fp2-svc-drop-' + type);
    var cb   = document.getElementById('fp2-svc-cb-' + type);
    if (!inp || !drop || !cb) return;

    function renderOpts(q) {
      var filtered = q ? opts.filter(function (v) { return v.toLowerCase().indexOf(q.toLowerCase()) !== -1; }) : opts.slice();
      drop.innerHTML = !filtered.length
        ? '<div class="form-smart-cb-empty">Tidak ada pilihan</div>'
        : filtered.map(function (v) {
            return '<div class="form-smart-cb-option' + (v === _fp2State[type].service ? ' selected' : '') + '" ' +
              'onmousedown="window._fp2SelectService(\'' + type + '\',\'' + escQ2(v) + '\')">' +
              escH2(v) + '</div>';
          }).join('');
    }

    inp.addEventListener('focus', function () { cb.classList.add('open'); renderOpts(inp.value); });
    inp.addEventListener('blur',  function () { setTimeout(function () { cb.classList.remove('open'); }, 200); });
    inp.addEventListener('input', function () { cb.classList.add('open'); renderOpts(inp.value); });
    renderOpts('');
  }

  function _fp2InitTujDropdown(type, opts) {
    var inp  = document.getElementById('fp2-tuj-inp-' + type);
    var drop = document.getElementById('fp2-tuj-drop-' + type);
    var cb   = document.getElementById('fp2-tuj-cb-' + type);
    if (!inp || !drop || !cb) return;

    inp._fp2TujOpts = opts;

    function renderOpts(q) {
      var filtered = q ? opts.filter(function (v) { return v.toLowerCase().indexOf(q.toLowerCase()) !== -1; }) : opts.slice();
      drop.innerHTML = !filtered.length
        ? '<div class="form-smart-cb-empty">Tidak ada pilihan</div>'
        : filtered.map(function (v) {
            var already = _fp2State[type].tujuans.indexOf(v) !== -1;
            return '<div class="form-smart-cb-option' + (already ? ' selected' : '') + '" ' +
              'onmousedown="window._fp2SelectTujDrop(\'' + type + '\',\'' + escQ2(v) + '\')">' +
              (already ? '<span class="material-icons-round" style="font-size:13px;color:var(--green)">check</span> ' : '') +
              escH2(v) + '</div>';
          }).join('');
    }

    inp.addEventListener('focus', function () { if (!inp.disabled) { cb.classList.add('open'); renderOpts(inp.value); } });
    inp.addEventListener('blur',  function () { setTimeout(function () { cb.classList.remove('open'); }, 200); });
    inp.addEventListener('input', function () { if (!inp.disabled) { cb.classList.add('open'); renderOpts(inp.value); } });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); window._fp2AddTuj(type); }
    });
    renderOpts('');
  }

  /* ─────────────────────────────────────────────────────────────
     EVENT HANDLERS Phase 1
  ───────────────────────────────────────────────────────────── */
  window._fp2ToggleSvcCb = function (type) {
    var cb = document.getElementById('fp2-svc-cb-' + type);
    var inp = document.getElementById('fp2-svc-inp-' + type);
    if (!cb || !inp || inp.disabled) return;
    if (cb.classList.contains('open')) cb.classList.remove('open');
    else { cb.classList.add('open'); inp.focus(); }
  };

  window._fp2ToggleTujCb = function (type) {
    var cb  = document.getElementById('fp2-tuj-cb-' + type);
    var inp = document.getElementById('fp2-tuj-inp-' + type);
    if (!cb || !inp || inp.disabled) return;
    if (cb.classList.contains('open')) cb.classList.remove('open');
    else { cb.classList.add('open'); inp.focus(); }
  };

  window._fp2SelectService = function (type, val) {
    _fp2State[type].service = val;
    // Re-render phase 1 untuk update state UI
    renderPhase1(type);
    // Fokus ke tujuan input setelah render
    setTimeout(function () {
      var inp = document.getElementById('fp2-tuj-inp-' + type);
      if (inp && !inp.disabled) inp.focus();
    }, 50);
  };

  window._fp2SelectTujDrop = function (type, val) {
    var inp = document.getElementById('fp2-tuj-inp-' + type);
    if (inp) inp.value = val;
    var cb = document.getElementById('fp2-tuj-cb-' + type);
    if (cb) cb.classList.remove('open');
  };

  window._fp2AddTuj = function (type) {
    var inp = document.getElementById('fp2-tuj-inp-' + type);
    if (!inp) return;
    var val = inp.value.trim();
    if (!val) { if (typeof toast === 'function') toast('Masukkan tujuan', 'error'); return; }
    if (_fp2State[type].tujuans.indexOf(val) !== -1) {
      if (typeof toast === 'function') toast('Tujuan sudah ada', 'error'); return;
    }
    _fp2State[type].tujuans.push(val);
    if (!_fp2State[type].awbs[val]) _fp2State[type].awbs[val] = [];
    renderPhase1(type);
    // Re-fokus ke tujuan input
    setTimeout(function () {
      var newInp = document.getElementById('fp2-tuj-inp-' + type);
      if (newInp) newInp.focus();
    }, 50);
  };

  window._fp2RemoveTuj = function (type, idx) {
    var tuj = _fp2State[type].tujuans[idx];
    _fp2State[type].tujuans.splice(idx, 1);
    // Jangan hapus AWBs yang sudah diinput — hanya hapus dari list tujuan setup
    // (AWBs tetap tersimpan di state kalau user re-add tujuan)
    renderPhase1(type);
  };

  window._fp2CancelSetup = function (type) {
    // Reset state
    _fp2State[type] = {
      phase: 1, service: '', tujuans: [], noTracks: {}, awbs: {}, activeTuj: '', saving: false, setupDone: false
    };
    // Kembalikan ke form original
    _restoreOriginalForm(type);
  };

  /* ─────────────────────────────────────────────────────────────
     PHASE 1 → Phase 2: Proceed Setup
     Buat NO TRACK via GAS dulu, baru tampilkan input AWB
  ───────────────────────────────────────────────────────────── */
  window._fp2ProceedSetup = function (type) {
    var st = _fp2State[type];
    if (!st.service || !st.tujuans.length) return;
    var incharge = (typeof globalIncharge !== 'undefined') ? globalIncharge : '';
    if (!incharge) { if (typeof toast === 'function') toast('Pilih Incharge dulu', 'error'); return; }

    // Tampilkan loading state di tombol
    var btn = document.getElementById('fp2-setup-btn-' + type);
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="material-icons-round" style="animation:spin .6s linear infinite;font-size:15px">sync</span> Membuat NO TRACK...';
    }

    var actionName = type === 'ob' ? 'saveOb' : 'saveHvs';

    // Buat NO TRACK untuk setiap tujuan (POST dengan 0 AWB dulu)
    Promise.all(st.tujuans.map(function (tuj) {
      return (typeof gasPost === 'function' ? gasPost : function(a,d){ return Promise.reject(new Error('gasPost not found')); })(actionName, {
        incharge: incharge,
        service:  st.service,
        tujuan:   tuj,
        awbList:  []     // kosong dulu, akan diisi di phase 2
      });
    })).then(function (results) {
      var errors = results.filter(function (r) { return r && r.error; });
      if (errors.length) {
        if (typeof toast === 'function') toast('Error buat NO TRACK: ' + errors[0].error, 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<span class="material-icons-round">arrow_forward</span> Setup & Lanjut ke Input AWB'; }
        return;
      }

      // Simpan NO TRACK yang dibuat
      results.forEach(function (r, i) {
        var tuj = st.tujuans[i];
        var noTrack = (r && r.noTrack) ? r.noTrack : (r && r.no_track) ? r.no_track : ('PENDING_' + tuj);
        st.noTracks[tuj] = noTrack;
      });

      st.phase = 2;
      st.setupDone = true;

      // Reload data list di background
      _fp2ReloadDataList(type);

      // Invalidate caches
      try { if (typeof _mfLoaded !== 'undefined') window._mfLoaded = false; } catch(e) {}
      try { if (typeof _obibData !== 'undefined') window._obibData = null; } catch(e) {}

      // Set active tujuan ke yang pertama
      if (st.tujuans.length) st.activeTuj = st.tujuans[0];

      // Render phase 2
      renderPhase2(type);
      if (typeof toast === 'function') toast('NO TRACK dibuat — silakan input AWB', 'success');

    }).catch(function (e) {
      if (typeof toast === 'function') toast('Error: ' + (e.message || e), 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<span class="material-icons-round">arrow_forward</span> Setup & Lanjut ke Input AWB'; }
    });
  };

  function _fp2ReloadDataList(type) {
    var actionGet = type === 'ob' ? 'getObList' : (type === 'hvs' ? 'getHvsList' : 'getIbList');
    if (typeof gasGet !== 'function') return;
    gasGet(actionGet).then(function (r) {
      if (!r || !r.list) return;
      try {
        if (type === 'ob' && typeof obData !== 'undefined') {
          window.obData = r.list;
          if (typeof renderObTable === 'function') renderObTable();
          if (typeof updateObStats === 'function') updateObStats();
        } else if (type === 'hvs' && typeof hvsData !== 'undefined') {
          window.hvsData = r.list;
          if (typeof renderHvsTable === 'function') renderHvsTable();
          if (typeof updateHvsStats === 'function') updateHvsStats();
        }
      } catch(e) {}
    }).catch(function () {});
  }

  /* ─────────────────────────────────────────────────────────────
     PHASE 2: INPUT AWB UI
  ───────────────────────────────────────────────────────────── */
  function renderPhase2(type) {
    var st     = _fp2State[type];
    var bodyId = type + 'FormBody';
    var body   = document.getElementById(bodyId);
    if (!body) return;
    body.classList.add('open');

    var incharge = (typeof globalIncharge !== 'undefined') ? globalIncharge : '';
    var totalAll = totalAwbAllTuj(type);

    // Tabs tujuan
    var tabsHtml = st.tujuans.map(function (t) {
      var cnt = st.awbs[t] ? st.awbs[t].length : 0;
      var isActive = t === st.activeTuj;
      var noTrack = st.noTracks[t] || '...';
      return '<div class="fp2-tuj-tab' + (isActive ? ' active' : '') + '" ' +
        'onclick="window._fp2SwitchTuj(\'' + type + '\',\'' + escQ2(t) + '\')">' +
        '<div>' +
          '<div>' + escH2(t) + '</div>' +
          '<div class="fp2-tuj-notrack">' + escH2(noTrack) + '</div>' +
        '</div>' +
        '<span class="fp2-tab-cnt">' + cnt + '</span>' +
      '</div>';
    }).join('');

    // AWB list untuk tujuan aktif
    var activeAwbs = st.activeTuj && st.awbs[st.activeTuj] ? st.awbs[st.activeTuj] : [];
    var awbListHtml = !activeAwbs.length
      ? '<div class="fp2-awb-empty"><span class="material-icons-round">qr_code_scanner</span>Belum ada AWB — scan di atas</div>'
      : activeAwbs.map(function (awb, i) {
          return '<div class="fp2-awb-item">' +
            '<span class="fp2-awb-num">' + (i + 1) + '</span>' +
            '<span class="fp2-awb-text">' + escH2(awb) + '</span>' +
            '<span class="material-icons-round fp2-awb-del" onclick="window._fp2DelAwb(\'' + type + '\',' + i + ')">delete</span>' +
          '</div>';
        }).join('');

    // Summary per tujuan
    var summaryHtml = '<div class="fp2-summary-bar">' +
      '<span class="material-icons-round" style="font-size:15px;color:var(--ink-low)">summarize</span>' +
      st.tujuans.map(function (t, i) {
        var cnt = st.awbs[t] ? st.awbs[t].length : 0;
        return (i ? '<span class="fp2-summary-sep">•</span>' : '') +
          '<span class="fp2-summary-item">' + escH2(t) + ': <strong>' + cnt + '</strong></span>';
      }).join('') +
      '<span class="fp2-summary-sep">|</span>' +
      '<span class="fp2-summary-item">Total: <strong>' + totalAll + '</strong></span>' +
    '</div>';

    body.innerHTML = `
      <div class="fp2-phase-bar">
        <div class="fp2-phase-step done">
          <span class="fp2-num">1</span>
          <span>Setup Service &amp; Tujuan</span>
        </div>
        <span class="material-icons-round fp2-phase-arrow">chevron_right</span>
        <div class="fp2-phase-step active">
          <span class="fp2-num">2</span>
          <span>Input AWB per Tujuan</span>
        </div>
      </div>

      <div class="fp2-input-panel" style="position:relative">
        <div class="fp2-input-header">
          <span class="material-icons-round" style="font-size:17px;color:rgba(255,255,255,.6)">qr_code_scanner</span>
          <span class="fp2-input-header-title">Input AWB — ${escH2(st.service)}</span>
          <div class="fp2-input-header-meta">
            <span class="fp2-meta-chip">
              <span class="material-icons-round">badge</span>${escH2(incharge)}
            </span>
            <span class="fp2-meta-chip">
              <span class="material-icons-round">place</span>${st.tujuans.length} tujuan
            </span>
          </div>
        </div>
        <div class="fp2-input-body">

          <div class="fp2-tuj-selector">
            <div class="fp2-tuj-selector-label">
              <span class="material-icons-round">location_on</span>
              Pilih Tujuan Aktif — AWB akan masuk ke tujuan ini
            </div>
            <div class="fp2-tuj-tabs" id="fp2-tuj-tabs-${type}">
              ${tabsHtml}
            </div>
          </div>

          ${summaryHtml}

          <div class="fp2-scan-area">
            <div class="fp2-scan-area-title">
              <span>SCAN AWB — <strong>${escH2(st.activeTuj || '—')}</strong></span>
              <span class="fp2-scan-count">${activeAwbs.length} AWB</span>
            </div>
            <div class="fp2-scan-row">
              <input class="fp2-scan-inp" id="fp2-scan-inp-${type}"
                placeholder="${st.activeTuj ? 'Scan atau ketik AWB, Enter untuk tambah...' : 'Pilih tujuan dulu...'}"
                ${!st.activeTuj ? 'disabled' : ''}
                autocomplete="off"
                onkeydown="window._fp2HandleScan(event, '${type}')">
              <button class="btn btn-primary btn-sm" onclick="window._fp2ManualAdd('${type}')">
                <span class="material-icons-round">add</span> Tambah
              </button>
            </div>
            <div class="fp2-awb-list" id="fp2-awb-list-${type}">
              ${awbListHtml}
            </div>
          </div>

          <div class="fp2-footer">
            <div class="fp2-footer-left">
              <button class="fp2-back-btn" onclick="window._fp2BackToSetup('${type}')">
                <span class="material-icons-round">arrow_back</span> Kembali ke Setup
              </button>
            </div>
            <div class="fp2-footer-right">
              <span style="font-size:11.5px;color:var(--ink-low)">
                <strong>${totalAll}</strong> AWB total
              </span>
              <button class="fp2-save-all-btn" id="fp2-save-all-btn-${type}"
                onclick="window._fp2SaveAll('${type}')"
                ${totalAll === 0 ? 'disabled' : ''}>
                <span class="material-icons-round">save</span>
                Simpan Semua AWB
              </button>
            </div>
          </div>

        </div>
      </div>
    `;

    // Focus ke scan input
    setTimeout(function () {
      var inp = document.getElementById('fp2-scan-inp-' + type);
      if (inp && !inp.disabled) inp.focus();
    }, 100);
  }

  /* ─────────────────────────────────────────────────────────────
     EVENT HANDLERS Phase 2
  ───────────────────────────────────────────────────────────── */
  window._fp2SwitchTuj = function (type, tuj) {
    _fp2State[type].activeTuj = tuj;
    renderPhase2(type);
    setTimeout(function () {
      var inp = document.getElementById('fp2-scan-inp-' + type);
      if (inp && !inp.disabled) inp.focus();
    }, 60);
  };

  window._fp2HandleScan = function (e, type) {
    if (e.key !== 'Enter') return;
    _fp2DoAdd(type);
  };

  window._fp2ManualAdd = function (type) {
    _fp2DoAdd(type);
  };

  function _fp2DoAdd(type) {
    var st  = _fp2State[type];
    var inp = document.getElementById('fp2-scan-inp-' + type);
    if (!inp) return;
    var val = inp.value.trim();
    if (!val) return;
    if (!st.activeTuj) {
      if (typeof toast === 'function') toast('Pilih tujuan dulu', 'error');
      return;
    }
    if (!st.awbs[st.activeTuj]) st.awbs[st.activeTuj] = [];

    // Cek duplikat di semua tujuan
    var allAwbs = [];
    st.tujuans.forEach(function (t) { allAwbs = allAwbs.concat(st.awbs[t] || []); });
    if (allAwbs.indexOf(val) !== -1) {
      if (typeof playBeepError === 'function') playBeepError();
      if (typeof toast === 'function') toast('AWB sudah ada', 'error');
      inp.value = '';
      return;
    }

    st.awbs[st.activeTuj].unshift(val);
    inp.value = '';
    if (typeof playBeep === 'function') playBeep();

    // Re-render hanya bagian AWB list + footer (tanpa full re-render)
    _fp2UpdateListOnly(type);
  }

  window._fp2DelAwb = function (type, idx) {
    var st  = _fp2State[type];
    if (!st.activeTuj || !st.awbs[st.activeTuj]) return;
    st.awbs[st.activeTuj].splice(idx, 1);
    _fp2UpdateListOnly(type);
  };

  // Update hanya list AWB dan footer tanpa re-render seluruh phase 2
  function _fp2UpdateListOnly(type) {
    var st        = _fp2State[type];
    var activeAwbs = st.activeTuj && st.awbs[st.activeTuj] ? st.awbs[st.activeTuj] : [];
    var totalAll  = totalAwbAllTuj(type);

    // Update awb list
    var listEl = document.getElementById('fp2-awb-list-' + type);
    if (listEl) {
      listEl.innerHTML = !activeAwbs.length
        ? '<div class="fp2-awb-empty"><span class="material-icons-round">qr_code_scanner</span>Belum ada AWB — scan di atas</div>'
        : activeAwbs.map(function (awb, i) {
            return '<div class="fp2-awb-item">' +
              '<span class="fp2-awb-num">' + (i + 1) + '</span>' +
              '<span class="fp2-awb-text">' + escH2(awb) + '</span>' +
              '<span class="material-icons-round fp2-awb-del" onclick="window._fp2DelAwb(\'' + type + '\',' + i + ')">delete</span>' +
            '</div>';
          }).join('');
    }

    // Update scan count label
    var scanArea = document.querySelector('#fp2-scan-inp-' + type + ' ~ div');
    var countEl = document.querySelector('.fp2-scan-area-title .fp2-scan-count');
    if (countEl) countEl.textContent = activeAwbs.length + ' AWB';

    // Update tab counts
    var tabsEl = document.getElementById('fp2-tuj-tabs-' + type);
    if (tabsEl) {
      tabsEl.querySelectorAll('.fp2-tuj-tab').forEach(function (tab, i) {
        var t   = st.tujuans[i];
        var cnt = t && st.awbs[t] ? st.awbs[t].length : 0;
        var cntEl = tab.querySelector('.fp2-tab-cnt');
        if (cntEl) cntEl.textContent = cnt;
      });
    }

    // Update save button
    var saveBtn = document.getElementById('fp2-save-all-btn-' + type);
    if (saveBtn) saveBtn.disabled = (totalAll === 0);

    // Update total label di footer
    var totalSpans = document.querySelectorAll('.fp2-footer-right span');
    totalSpans.forEach(function (el) {
      if (el.textContent.indexOf('AWB total') !== -1) {
        el.innerHTML = '<strong>' + totalAll + '</strong> AWB total';
      }
    });

    // Update summary bar
    var summaryBar = document.querySelector('.fp2-summary-bar');
    if (summaryBar) {
      summaryBar.innerHTML = '<span class="material-icons-round" style="font-size:15px;color:var(--ink-low)">summarize</span>' +
        st.tujuans.map(function (t, i) {
          var cnt = st.awbs[t] ? st.awbs[t].length : 0;
          return (i ? '<span class="fp2-summary-sep">•</span>' : '') +
            '<span class="fp2-summary-item">' + escH2(t) + ': <strong>' + cnt + '</strong></span>';
        }).join('') +
        '<span class="fp2-summary-sep">|</span>' +
        '<span class="fp2-summary-item">Total: <strong>' + totalAll + '</strong></span>';
    }
  }

  /* ─────────────────────────────────────────────────────────────
     BACK TO SETUP (data AWB tetap tersimpan di state)
  ───────────────────────────────────────────────────────────── */
  window._fp2BackToSetup = function (type) {
    // Konfirmasi hanya kalau ada AWB yang sudah diinput
    var totalAll = totalAwbAllTuj(type);
    if (totalAll > 0) {
      if (!confirm('Kembali ke setup? Data AWB yang sudah diinput (' + totalAll + ' AWB) tetap tersimpan di sesi ini dan tidak akan hilang.')) return;
    }
    _fp2State[type].phase = 1;
    renderPhase1(type);
  };

  /* ─────────────────────────────────────────────────────────────
     SAVE ALL AWB ke server
  ───────────────────────────────────────────────────────────── */
  window._fp2SaveAll = function (type) {
    var st = _fp2State[type];
    var totalAll = totalAwbAllTuj(type);
    if (totalAll === 0) {
      if (typeof toast === 'function') toast('Input AWB terlebih dahulu', 'error');
      return;
    }

    var incharge = (typeof globalIncharge !== 'undefined') ? globalIncharge : '';

    // Tampilkan saving overlay
    var panel = document.querySelector('.fp2-input-panel');
    if (panel) {
      panel.style.position = 'relative';
      var overlay = document.createElement('div');
      overlay.className = 'fp2-saving-overlay';
      overlay.id = 'fp2-saving-overlay-' + type;
      overlay.innerHTML =
        '<div class="fp2-saving-spinner"></div>' +
        '<div class="fp2-saving-text">Menyimpan ' + totalAll + ' AWB ke ' + st.tujuans.length + ' tujuan...</div>';
      panel.appendChild(overlay);
    }

    // Update AWB untuk setiap noTrack
    var actionAdd = 'addAwbToTrack';
    var saveType  = type.toUpperCase();

    Promise.all(st.tujuans.map(function (tuj) {
      var noTrack = st.noTracks[tuj];
      var awbs    = st.awbs[tuj] || [];
      if (!awbs.length) return Promise.resolve({ success: true, skipped: true });
      if (!noTrack || noTrack.indexOf('PENDING_') === 0) {
        // Fallback: buat baru kalau noTrack belum ada
        var actionSave = type === 'ob' ? 'saveOb' : 'saveHvs';
        return (typeof gasPost === 'function' ? gasPost : function(){ return Promise.reject(new Error('no gasPost')); })(actionSave, {
          incharge: incharge,
          service:  st.service,
          tujuan:   tuj,
          awbList:  awbs
        });
      }
      return (typeof gasPost === 'function' ? gasPost : function(){ return Promise.reject(new Error('no gasPost')); })(actionAdd, {
        noTrack : noTrack,
        type    : saveType,
        awbList : awbs
      });
    })).then(function (results) {
      // Hapus overlay
      var ov = document.getElementById('fp2-saving-overlay-' + type);
      if (ov) ov.remove();

      var errors = results.filter(function (r) { return r && r.error; });
      if (errors.length) {
        if (typeof toast === 'function') toast('Ada error: ' + errors[0].error, 'error');
        return;
      }

      if (typeof toast === 'function') toast(totalAll + ' AWB berhasil disimpan ke ' + st.tujuans.length + ' tujuan!', 'success');

      // Reload data list
      _fp2ReloadDataList(type);

      // Invalidate caches
      try { if (typeof _mfLoaded !== 'undefined') window._mfLoaded = false; } catch(e) {}
      try { if (typeof _obibData !== 'undefined') window._obibData = null; } catch(e) {}
      try { if (typeof _debouncedBuildAllScanAwbs === 'function') _debouncedBuildAllScanAwbs(); } catch(e) {}

      // Reset state dan kembalikan form
      _fp2State[type] = {
        phase: 1, service: '', tujuans: [], noTracks: {}, awbs: {}, activeTuj: '', saving: false, setupDone: false
      };

      // Tutup form panel dan restore
      _restoreOriginalForm(type);
      var body = document.getElementById(type + 'FormBody');
      if (body) { body.classList.remove('open'); }
      var iconEl = document.getElementById(type + 'FormIcon');
      if (iconEl) iconEl.innerText = 'expand_more';

    }).catch(function (e) {
      var ov = document.getElementById('fp2-saving-overlay-' + type);
      if (ov) ov.remove();
      if (typeof toast === 'function') toast('Error: ' + (e.message || e), 'error');
    });
  };

  /* ─────────────────────────────────────────────────────────────
     RESTORE form original (kembalikan ke form-panel-body standard)
  ───────────────────────────────────────────────────────────── */
  function _restoreOriginalForm(type) {
    // Panggil reset function existing
    try {
      if (type === 'ob' && typeof resetObForm === 'function') resetObForm();
      else if (type === 'hvs' && typeof resetHvsForm === 'function') resetHvsForm();
    } catch(e) {}
    // Refresh incharge tampilan
    try { if (typeof refreshFormIncharge === 'function') refreshFormIncharge(type); } catch(e) {}
  }

  /* ─────────────────────────────────────────────────────────────
     INTERCEPT: Toggle form → gunakan phase 1 UI
  ───────────────────────────────────────────────────────────── */
  function _patchToggleForm() {
    // Patch onclick untuk header form panel OB dan HVS
    var patchType = function (type) {
      var hdr = document.querySelector('#page-' + type + ' .form-panel-hdr');
      if (!hdr) return;

      hdr.onclick = function () {
        var body   = document.getElementById(type + 'FormBody');
        var iconEl = document.getElementById(type + 'FormIcon');
        if (!body) return;

        var isOpen = body.classList.contains('open');
        if (isOpen) {
          // Tutup
          body.classList.remove('open');
          if (iconEl) iconEl.innerText = 'expand_more';
          // Reset state jika phase 1 (phase 2 jangan di-reset saat tutup saja)
          if (_fp2State[type].phase === 1 && !_fp2State[type].setupDone) {
            _fp2State[type] = {
              phase: 1, service: '', tujuans: [], noTracks: {}, awbs: {}, activeTuj: '', saving: false, setupDone: false
            };
          }
        } else {
          // Buka — render phase sesuai state
          if (_fp2State[type].phase === 2) {
            renderPhase2(type);
          } else {
            renderPhase1(type);
          }
        }
      };
    };

    patchType('ob');
    patchType('hvs');
  }

  /* ─────────────────────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────────────────────── */
  function init() {
    injectPatchCSS();
    _patchToggleForm();

    // Patch buildCbOptions agar setelah options diupdate, form phase 1 juga diupdate
    var _origBuildCbOptions = (typeof buildCbOptions === 'function') ? buildCbOptions : null;
    if (_origBuildCbOptions) {
      window.buildCbOptions = function () {
        _origBuildCbOptions();
        // Tidak perlu re-render — user akan lihat options terbaru saat berikutnya buka form
      };
    }

    // Patch selectGlobalIncharge agar incharge display di phase 1 terupdate
    var _origSelectGlobalIncharge2 = (typeof selectGlobalIncharge === 'function') ? selectGlobalIncharge : null;
    if (_origSelectGlobalIncharge2) {
      window.selectGlobalIncharge = function (v) {
        _origSelectGlobalIncharge2(v);
        // Re-render phase 1 jika form sedang terbuka
        ['ob', 'hvs'].forEach(function (type) {
          var body = document.getElementById(type + 'FormBody');
          if (body && body.classList.contains('open') && _fp2State[type].phase === 1) {
            renderPhase1(type);
          }
        });
      };
    }
  }

  // Run setelah DOM siap
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 400); });
  } else {
    setTimeout(init, 400);
  }

})();
