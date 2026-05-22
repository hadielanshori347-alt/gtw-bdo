/* ============================================================
   GTW BDO — views-filter.js v2.0
   Filter Panel redesign:
   - Layout horizontal satu baris (sesuai screenshot)
   - "No Track" diganti "AWB"
   - Incharge auto dari globalIncharge (topbar), tidak perlu input
   - Service & Tujuan: smart combobox (dropdown + ketik)
   - Semua panel (OB, HVS, IB, Manifest, OB&IB) diseragamkan
   ============================================================ */

// ── Inject CSS filter panel ──
(function injectFilterCSS() {
  if (document.getElementById('_filterPanelCSS')) return;
  var s = document.createElement('style');
  s.id = '_filterPanelCSS';
  s.textContent = `
/* ─── FILTER PANEL WRAPPER ─── */
.fp-wrap {
  margin-bottom: 12px;
  border-radius: 9px;
  border: 1.5px solid var(--gray3);
  background: var(--white);
  box-shadow: 0 2px 8px rgba(0,0,0,.06);
  overflow: visible;
  transition: box-shadow .18s ease;
}
.fp-wrap:focus-within {
  box-shadow: 0 4px 16px rgba(21,101,192,.10);
}

/* ─── HEADER TOGGLE ─── */
.fp-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  background: linear-gradient(90deg, #EFF6FF 0%, #F8FAFF 100%);
  border-bottom: 1.5px solid transparent;
  cursor: pointer;
  user-select: none;
  border-radius: 9px;
  transition: background .15s ease, border-color .15s ease;
}
.fp-header.open {
  border-bottom-color: var(--blue-mid);
  background: linear-gradient(90deg, #DBEAFE 0%, #EFF6FF 100%);
  border-radius: 9px 9px 0 0;
}
.fp-header:hover {
  background: linear-gradient(90deg, #DBEAFE 0%, #EFF6FF 100%);
}
.fp-header-icon {
  font-size: 17px;
  color: var(--blue2);
}
.fp-header-label {
  flex: 1;
  font-size: 13px;
  font-weight: 700;
  color: var(--blue);
  letter-spacing: .2px;
}
.fp-header-badge {
  font-size: 10px;
  font-weight: 700;
  background: var(--blue2);
  color: #fff;
  border-radius: 20px;
  padding: 1px 9px;
  font-family: var(--mono);
  display: none;
}
.fp-header-badge.has-filter {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.fp-chevron {
  font-size: 20px;
  color: var(--blue2);
  transition: transform .2s ease;
}
.fp-header.open .fp-chevron {
  transform: rotate(180deg);
}

/* ─── BODY ─── */
.fp-body {
  display: none;
  padding: 12px 16px 10px;
  background: var(--white);
  border-radius: 0 0 9px 9px;
  animation: fpSlideDown .18s ease;
  overflow: visible;
}
.fp-body.open {
  display: block;
}
@keyframes fpSlideDown {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ─── HORIZONTAL GRID — satu baris ─── */
.fp-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
  align-items: flex-end;
}
.fp-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 120px;
  max-width: 220px;
}
.fp-field-date {
  max-width: 160px;
}
.fp-field-status {
  max-width: 160px;
}
.fp-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--gray5);
  text-transform: uppercase;
  letter-spacing: .6px;
}
.fp-input, .fp-select {
  padding: 7px 11px;
  border: 1.5px solid var(--gray3);
  border-radius: 7px;
  font-size: 13px;
  font-family: var(--font);
  color: var(--gray8);
  background: var(--white);
  outline: none;
  transition: border-color .15s, box-shadow .15s;
  width: 100%;
  height: 34px;
}
.fp-input:focus, .fp-select:focus {
  border-color: var(--blue2);
  box-shadow: 0 0 0 3px var(--blue-light);
}
.fp-input::placeholder {
  color: var(--gray4);
}
.fp-input:disabled {
  background: var(--gray1);
  color: var(--gray5);
  cursor: not-allowed;
}

/* ─── SMART COMBOBOX DALAM FILTER ─── */
.fp-cb-wrap {
  position: relative;
  width: 100%;
}
.fp-cb-input {
  padding: 7px 28px 7px 11px;
  border: 1.5px solid var(--gray3);
  border-radius: 7px;
  font-size: 13px;
  font-family: var(--font);
  color: var(--gray8);
  background: var(--white);
  outline: none;
  transition: border-color .15s, box-shadow .15s;
  width: 100%;
  height: 34px;
}
.fp-cb-input:focus {
  border-color: var(--blue2);
  box-shadow: 0 0 0 3px var(--blue-light);
}
.fp-cb-input::placeholder { color: var(--gray4); }
.fp-cb-arrow {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--gray5);
  font-size: 18px;
  cursor: pointer;
  transition: transform .2s;
  pointer-events: auto;
  user-select: none;
}
.fp-cb-wrap.open .fp-cb-arrow {
  transform: translateY(-50%) rotate(180deg);
  color: var(--blue2);
}
.fp-cb-wrap.open .fp-cb-input {
  border-color: var(--blue2);
  box-shadow: 0 0 0 3px var(--blue-light);
}
.fp-cb-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--white);
  border: 1.5px solid var(--blue-mid);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,.12);
  z-index: 600;
  max-height: 200px;
  overflow-y: auto;
  display: none;
}
.fp-cb-wrap.open .fp-cb-dropdown { display: block; }
.fp-cb-option {
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  color: var(--gray7);
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background .1s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fp-cb-option:hover, .fp-cb-option.focused { background: var(--blue-light); color: var(--blue2); }
.fp-cb-option.selected { color: var(--blue); font-weight: 600; background: var(--blue-light); }
.fp-cb-empty { padding: 10px 12px; font-size: 12px; color: var(--gray5); font-style: italic; }

/* ─── ACTIONS ─── */
.fp-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid var(--gray2);
}
.fp-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  font-family: var(--font);
  transition: filter .15s, background .15s;
  white-space: nowrap;
  height: 34px;
}
.fp-btn .material-icons-round { font-size: 15px; }
.fp-btn-filter {
  background: var(--blue2);
  color: #fff;
}
.fp-btn-filter:hover { filter: brightness(.92); }
.fp-btn-clear {
  background: var(--gray2);
  color: var(--gray7);
  border: 1.5px solid var(--gray3);
}
.fp-btn-clear:hover { background: var(--gray3); }
.fp-active-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-right: auto;
}
.fp-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--blue-light);
  color: var(--blue2);
  border: 1px solid var(--blue-mid);
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 9px 2px 8px;
}
.fp-tag-x {
  cursor: pointer;
  font-size: 13px;
  color: var(--blue);
  line-height: 1;
}
.fp-tag-x:hover { color: var(--red); }
`;
  document.head.appendChild(s);
})();

// ═══════════════════════════════════════════════════════
// SMART COMBOBOX UNTUK FILTER PANEL
// ═══════════════════════════════════════════════════════
var _fpCbRegistry = {};

function _fpCbRegister(uid, options) {
  var wrap = document.getElementById('fp-cb-' + uid);
  var inp  = document.getElementById('fp-cbi-' + uid);
  var drop = document.getElementById('fp-cbd-' + uid);
  if (!wrap || !inp || !drop) return;
  _fpCbRegistry[uid] = { options: options, value: '', wrap: wrap, inp: inp, drop: drop, focusIdx: -1 };

  inp.addEventListener('input', function () { _fpCbFilter(uid); });
  inp.addEventListener('focus', function () { _fpCbOpen(uid); });
  inp.addEventListener('blur',  function () { setTimeout(function () { _fpCbClose(uid); }, 200); });
  inp.addEventListener('keydown', function (e) { _fpCbKey(e, uid); });
  wrap.querySelector('.fp-cb-arrow').addEventListener('mousedown', function (e) {
    e.preventDefault();
    if (wrap.classList.contains('open')) _fpCbClose(uid);
    else { inp.focus(); _fpCbOpen(uid); }
  });
}

function _fpCbOpen(uid) {
  var reg = _fpCbRegistry[uid];
  if (!reg) return;
  // Tutup semua filter CB lain
  Object.keys(_fpCbRegistry).forEach(function (k) { if (k !== uid) _fpCbClose(k); });
  reg.wrap.classList.add('open');
  reg.focusIdx = -1;
  _fpCbRender(uid, reg.inp.value);
}
function _fpCbClose(uid) {
  var reg = _fpCbRegistry[uid];
  if (reg) reg.wrap.classList.remove('open');
}
function _fpCbFilter(uid) {
  var reg = _fpCbRegistry[uid];
  if (!reg) return;
  reg.wrap.classList.add('open');
  reg.focusIdx = -1;
  _fpCbRender(uid, reg.inp.value);
}
function _fpCbRender(uid, q) {
  var reg  = _fpCbRegistry[uid];
  var opts = reg.options || [];
  var filt = q ? opts.filter(function (v) { return v.toLowerCase().indexOf(q.toLowerCase()) !== -1; }) : opts.slice();
  reg._filtered = filt;
  if (!filt.length) {
    reg.drop.innerHTML = '<div class="fp-cb-empty">Tidak ada pilihan</div>';
    return;
  }
  reg.drop.innerHTML = filt.map(function (v, i) {
    var sel = v === reg.value ? ' selected' : '';
    return '<div class="fp-cb-option' + sel + '" data-idx="' + i + '" onmousedown="_fpCbSelect(\'' + uid + '\',\'' + escQ(v) + '\')">' +
      (sel ? '<span class="material-icons-round" style="font-size:13px;color:var(--blue)">check</span>' : '<span style="width:13px;display:inline-block"></span>') +
      escH(v) + '</div>';
  }).join('');
}
function _fpCbSelect(uid, val) {
  var reg = _fpCbRegistry[uid];
  if (!reg) return;
  reg.value    = val;
  reg.inp.value = val;
  _fpCbClose(uid);
}
function _fpCbKey(e, uid) {
  var reg      = _fpCbRegistry[uid];
  var isOpen   = reg.wrap.classList.contains('open');
  var filtered = reg._filtered || [];
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (!isOpen) { _fpCbOpen(uid); return; }
    reg.focusIdx = Math.min(reg.focusIdx + 1, filtered.length - 1);
    _fpCbHighlight(uid);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    reg.focusIdx = Math.max(reg.focusIdx - 1, 0);
    _fpCbHighlight(uid);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (isOpen && reg.focusIdx >= 0 && filtered[reg.focusIdx]) _fpCbSelect(uid, filtered[reg.focusIdx]);
    else if (isOpen && filtered.length === 1) _fpCbSelect(uid, filtered[0]);
    else if (!isOpen) _fpCbOpen(uid);
  } else if (e.key === 'Escape') {
    _fpCbClose(uid);
  } else if (e.key === 'Tab') {
    if (isOpen && filtered.length > 0) _fpCbSelect(uid, filtered[reg.focusIdx >= 0 ? reg.focusIdx : 0]);
  }
}
function _fpCbHighlight(uid) {
  var reg = _fpCbRegistry[uid];
  reg.drop.querySelectorAll('.fp-cb-option').forEach(function (el, i) {
    el.classList.toggle('focused', i === reg.focusIdx);
    if (i === reg.focusIdx) el.scrollIntoView({ block: 'nearest' });
  });
}
function _fpCbUpdate(uid, options) {
  var reg = _fpCbRegistry[uid];
  if (!reg) return;
  reg.options = options;
  if (reg.wrap.classList.contains('open')) _fpCbRender(uid, reg.inp.value);
}
function _fpCbGetValue(uid) {
  var reg = _fpCbRegistry[uid];
  if (!reg) return '';
  // Pakai nilai yang diketik user (tidak harus dari dropdown)
  return reg.inp.value.trim();
}
function _fpCbClear(uid) {
  var reg = _fpCbRegistry[uid];
  if (!reg) return;
  reg.value = '';
  reg.inp.value = '';
}

// Tutup semua dropdown filter CB saat klik di luar
document.addEventListener('click', function (e) {
  Object.keys(_fpCbRegistry).forEach(function (uid) {
    var reg = _fpCbRegistry[uid];
    if (reg && reg.wrap && !reg.wrap.contains(e.target)) _fpCbClose(uid);
  });
});

// ═══════════════════════════════════════════════════════
// HELPER: buat HTML smart combobox dalam filter
// ═══════════════════════════════════════════════════════
function _fpCbHtml(uid, placeholder) {
  return '<div class="fp-cb-wrap" id="fp-cb-' + uid + '">' +
    '<input class="fp-cb-input" id="fp-cbi-' + uid + '" placeholder="' + escH(placeholder || '') + '" autocomplete="off">' +
    '<span class="material-icons-round fp-cb-arrow">expand_more</span>' +
    '<div class="fp-cb-dropdown" id="fp-cbd-' + uid + '"></div>' +
  '</div>';
}

// ═══════════════════════════════════════════════════════
// HELPER: buat filter panel
// ═══════════════════════════════════════════════════════
var _fpRegistry = {};

function _createFilterPanel(id, fields, onFilter, onClear) {
  var wrap = document.createElement('div');
  wrap.className = 'fp-wrap';
  wrap.id = 'fp-' + id;

  // Header
  var hdr = document.createElement('div');
  hdr.className = 'fp-header';
  hdr.innerHTML =
    '<span class="material-icons-round fp-header-icon">filter_list</span>' +
    '<span class="fp-header-label">Filter</span>' +
    '<span class="fp-header-badge" id="fp-badge-' + id + '"></span>' +
    '<span class="material-icons-round fp-chevron">expand_more</span>';
  hdr.onclick = function () { _toggleFP(id); };
  wrap.appendChild(hdr);

  // Body
  var body = document.createElement('div');
  body.className = 'fp-body';
  body.id = 'fp-body-' + id;

  // Grid horizontal
  var grid = document.createElement('div');
  grid.className = 'fp-grid';

  fields.forEach(function (f) {
    var field = document.createElement('div');
    field.className = 'fp-field' + (f.type === 'date' ? ' fp-field-date' : '') + (f.type === 'status' ? ' fp-field-status' : '');
    var lbl = '<div class="fp-label">' + escH(f.label) + '</div>';
    var inp = '';

    if (f.type === 'combobox') {
      inp = _fpCbHtml(id + '-' + f.key, f.placeholder || '');
    } else if (f.type === 'status') {
      inp = '<select class="fp-select" id="fpf-' + id + '-' + f.key + '">' +
        '<option value="">— Semua Status —</option>' +
        (f.options || []).map(function (o) { return '<option value="' + escH(o) + '">' + escH(o) + '</option>'; }).join('') +
        '</select>';
    } else if (f.type === 'display') {
      inp = '<input class="fp-input" id="fpf-' + id + '-' + f.key + '" type="text" disabled placeholder="' + escH(f.placeholder || '') + '">';
    } else {
      inp = '<input class="fp-input" id="fpf-' + id + '-' + f.key + '" type="' + (f.type || 'text') + '" placeholder="' + escH(f.placeholder || '') + '">';
    }

    field.innerHTML = lbl + inp;
    grid.appendChild(field);
  });

  body.appendChild(grid);

  // Actions
  var actions = document.createElement('div');
  actions.className = 'fp-actions';
  actions.innerHTML =
    '<div class="fp-active-tags" id="fp-tags-' + id + '"></div>' +
    '<button class="fp-btn fp-btn-clear" onclick="_clearFP(\'' + id + '\')">' +
      '<span class="material-icons-round">close</span> Clear' +
    '</button>' +
    '<button class="fp-btn fp-btn-filter" onclick="_applyFP(\'' + id + '\')">' +
      '<span class="material-icons-round">filter_alt</span> Filter' +
    '</button>';
  body.appendChild(actions);
  wrap.appendChild(body);

  _fpRegistry[id] = { fields: fields, onFilter: onFilter, onClear: onClear, active: {} };
  return wrap;
}

function _toggleFP(id) {
  var hdr  = document.querySelector('#fp-' + id + ' .fp-header');
  var body = document.getElementById('fp-body-' + id);
  if (!hdr || !body) return;
  var isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  hdr.classList.toggle('open', !isOpen);
}

function _applyFP(id) {
  var reg = _fpRegistry[id];
  if (!reg) return;
  var vals = {};
  reg.fields.forEach(function (f) {
    if (f.type === 'combobox') {
      vals[f.key] = _fpCbGetValue(id + '-' + f.key);
    } else if (f.type === 'display') {
      // Incharge selalu dari globalIncharge
      vals[f.key] = globalIncharge || '';
    } else {
      var el = document.getElementById('fpf-' + id + '-' + f.key);
      vals[f.key] = el ? el.value.trim() : '';
    }
  });
  reg.active = vals;
  _renderFPTags(id);
  if (reg.onFilter) reg.onFilter(vals);
}

function _clearFP(id) {
  var reg = _fpRegistry[id];
  if (!reg) return;
  reg.fields.forEach(function (f) {
    if (f.type === 'combobox') {
      _fpCbClear(id + '-' + f.key);
    } else if (f.type !== 'display') {
      var el = document.getElementById('fpf-' + id + '-' + f.key);
      if (el) el.value = '';
    }
  });
  reg.active = {};
  _renderFPTags(id);
  if (reg.onClear) reg.onClear();
}

function _clearFPKey(id, key) {
  var reg = _fpRegistry[id];
  if (!reg) return;
  var f = (reg.fields || []).find(function (x) { return x.key === key; });
  if (f && f.type === 'combobox') {
    _fpCbClear(id + '-' + key);
  } else if (f && f.type !== 'display') {
    var el = document.getElementById('fpf-' + id + '-' + key);
    if (el) el.value = '';
  }
  _applyFP(id);
}

function _renderFPTags(id) {
  var reg     = _fpRegistry[id];
  var tagsEl  = document.getElementById('fp-tags-' + id);
  var badgeEl = document.getElementById('fp-badge-' + id);
  if (!reg || !tagsEl) return;
  var active  = reg.active || {};
  // Jangan tampilkan tag untuk incharge (sudah di topbar) & field kosong
  var keys = Object.keys(active).filter(function (k) {
    if (!active[k]) return false;
    var f = (reg.fields || []).find(function (x) { return x.key === k; });
    return f && f.type !== 'display';
  });
  tagsEl.innerHTML = keys.map(function (k) {
    var label = (reg.fields.find(function (f) { return f.key === k; }) || {}).label || k;
    return '<span class="fp-tag">' + escH(label) + ': ' + escH(active[k]) +
      '<span class="fp-tag-x material-icons-round" onclick="_clearFPKey(\'' + id + '\',\'' + k + '\')">cancel</span>' +
      '</span>';
  }).join('');
  if (badgeEl) {
    badgeEl.className = 'fp-header-badge' + (keys.length ? ' has-filter' : '');
    badgeEl.innerHTML = keys.length
      ? '<span class="material-icons-round" style="font-size:11px">filter_alt</span>' + keys.length + ' aktif'
      : '';
  }
}

// ═══════════════════════════════════════════════════════
// UPDATE OPTIONS saat incharge/data berubah
// ═══════════════════════════════════════════════════════
function _updateFpServiceOptions(panelId, options) {
  _fpCbUpdate(panelId + '-service', options);
}
function _updateFpTujuanOptions(panelId, options) {
  _fpCbUpdate(panelId + '-tujuan', options);
}

function _getServiceOptions(type) {
  if (!globalIncharge) return [];
  var d = (masterData.obData || {})[globalIncharge] || {};
  if (type === 'ib') {
    var ib = (masterData.ibData || {})[globalIncharge] || {};
    return ib.services || [];
  }
  return d.services || [];
}
function _getTujuanOptions(type) {
  if (!globalIncharge) return [];
  var d = (masterData.obData || {})[globalIncharge] || {};
  if (type === 'ib') {
    var ib = (masterData.ibData || {})[globalIncharge] || {};
    return ib.tujuans || [];
  }
  return d.tujuans || [];
}
function _getFromOptions() {
  if (!globalIncharge) return [];
  var ib = (masterData.ibData || {})[globalIncharge] || {};
  return ib.froms || [];
}

// Panggil ini saat globalIncharge berubah atau data dimuat
function _refreshFpOptions() {
  ['ob', 'hvs'].forEach(function (type) {
    _updateFpServiceOptions(type, _getServiceOptions(type));
    _updateFpTujuanOptions(type, _getTujuanOptions(type));
  });
  _updateFpServiceOptions('ib', _getServiceOptions('ib'));
  _updateFpTujuanOptions('ib', _getTujuanOptions('ib'));
  _fpCbUpdate('ib-kota_from', _getFromOptions());

  // Manifest
  if (_mfData) {
    var mfInc = [], mfSvc = [], mfTuj = [];
    (_mfData.colDefs || []).forEach(function (c) {
      if (!c.isDate) {
        if (c.incharge && mfInc.indexOf(c.incharge) === -1) mfInc.push(c.incharge);
        if (c.service  && mfSvc.indexOf(c.service)  === -1) mfSvc.push(c.service);
        if (c.tujuan   && mfTuj.indexOf(c.tujuan)   === -1) mfTuj.push(c.tujuan);
      }
    });
    _fpCbUpdate('mf-incharge', mfInc.sort());
    _fpCbUpdate('mf-service',  mfSvc.sort());
    _fpCbUpdate('mf-tujuan',   mfTuj.sort());
  }

  // OB&IB
  if (_obibData) {
    var obibInc = [], obibSvc = [], obibKot = [];
    (_obibData.colDefs || []).forEach(function (def) {
      if ((def.colType || '').toUpperCase() !== 'DATE') {
        if (def.r1 && obibInc.indexOf(def.r1) === -1) obibInc.push(def.r1);
        if (def.r2 && obibSvc.indexOf(def.r2) === -1) obibSvc.push(def.r2);
        if (def.r3 && obibKot.indexOf(def.r3) === -1) obibKot.push(def.r3);
      }
    });
    _fpCbUpdate('obib_adv-incharge', obibInc.sort());
    _fpCbUpdate('obib_adv-service',  obibSvc.sort());
    _fpCbUpdate('obib_adv-kota',     obibKot.sort());
  }

  // Sync display field incharge
  ['ob', 'hvs', 'ib'].forEach(function (t) {
    var el = document.getElementById('fpf-' + t + '-incharge_display');
    if (el) el.value = globalIncharge || '— Semua —';
  });
}

// ═══════════════════════════════════════════════════════
// FILTER LOGIC: OB
// ═══════════════════════════════════════════════════════
var _obFilter = {};

function _applyObFilter(vals) { _obFilter = vals; _renderObWithFilter(); }
function _clearObFilter()     { _obFilter = {}; _renderObWithFilter(); }

function _renderObWithFilter() {
  var from  = _obFilter.from    || '';
  var to    = _obFilter.to      || '';
  var svc   = (_obFilter.service  || '').toLowerCase();
  var tuj   = (_obFilter.tujuan   || '').toLowerCase();
  var stat  = (_obFilter.status   || '').toLowerCase();
  var awb   = (_obFilter.awb      || '').toLowerCase();
  // incharge selalu dari globalIncharge (sudah difilter di filteredData)

  var data = filteredData(obData).filter(function (d) {
    if (svc  && (d.service  || '').toLowerCase().indexOf(svc)  === -1) return false;
    if (tuj  && (d.tujuan   || '').toLowerCase().indexOf(tuj)  === -1) return false;
    if (stat && (d.status   || '').toLowerCase().indexOf(stat) === -1) return false;
    if (from || to) {
      var d0 = (d.created_date || '').substring(0, 10);
      if (from && d0 < from) return false;
      if (to   && d0 > to)   return false;
    }
    return true;
  });

  var q = (document.getElementById('obSearch').value || '').toLowerCase();
  if (q) {
    data = data.filter(function (d) {
      return (d.no_track + d.incharge + d.service + d.tujuan + d.status).toLowerCase().indexOf(q) !== -1;
    });
  }

  // Filter AWB (cari di allScanAwbs untuk no_track yang match)
  if (awb) {
    var matchedTracks = {};
    allScanAwbs.forEach(function (item) {
      if ((item.awb || '').toLowerCase().indexOf(awb) !== -1 && item.noTrack) {
        matchedTracks[item.noTrack] = true;
      }
    });
    data = data.filter(function (d) { return matchedTracks[d.no_track]; });
  }

  document.getElementById('obTableCount').innerText = data.length + ' record';
  var _orig = obData; obData = data;
  renderObTable(); obData = _orig;
  document.getElementById('obTableCount').innerText = data.length + ' record';
}

// ═══════════════════════════════════════════════════════
// FILTER LOGIC: HVS
// ═══════════════════════════════════════════════════════
var _hvsFilter = {};

function _applyHvsFilter(vals) { _hvsFilter = vals; _renderHvsWithFilter(); }
function _clearHvsFilter()     { _hvsFilter = {}; _renderHvsWithFilter(); }

function _renderHvsWithFilter() {
  var from = _hvsFilter.from  || '';
  var to   = _hvsFilter.to    || '';
  var svc  = (_hvsFilter.service  || '').toLowerCase();
  var tuj  = (_hvsFilter.tujuan   || '').toLowerCase();
  var stat = (_hvsFilter.status   || '').toLowerCase();
  var awb  = (_hvsFilter.awb      || '').toLowerCase();

  var data = filteredData(hvsData).filter(function (d) {
    if (svc  && (d.service  || '').toLowerCase().indexOf(svc)  === -1) return false;
    if (tuj  && (d.tujuan   || '').toLowerCase().indexOf(tuj)  === -1) return false;
    if (stat && (d.status   || '').toLowerCase().indexOf(stat) === -1) return false;
    if (from || to) {
      var d0 = (d.created_date || '').substring(0, 10);
      if (from && d0 < from) return false;
      if (to   && d0 > to)   return false;
    }
    return true;
  });

  var q = (document.getElementById('hvsSearch').value || '').toLowerCase();
  if (q) {
    data = data.filter(function (d) {
      return (d.no_track + d.incharge + d.service + d.tujuan + d.status).toLowerCase().indexOf(q) !== -1;
    });
  }

  if (awb) {
    var matchedTracks = {};
    allScanAwbs.forEach(function (item) {
      if ((item.awb || '').toLowerCase().indexOf(awb) !== -1 && item.noTrack) {
        matchedTracks[item.noTrack] = true;
      }
    });
    data = data.filter(function (d) { return matchedTracks[d.no_track]; });
  }

  document.getElementById('hvsTableCount').innerText = data.length + ' record';
  var _orig = hvsData; hvsData = data;
  renderHvsTable(); hvsData = _orig;
  document.getElementById('hvsTableCount').innerText = data.length + ' record';
}

// ═══════════════════════════════════════════════════════
// FILTER LOGIC: IB
// ═══════════════════════════════════════════════════════
var _ibFilter = {};

function _applyIbFilter(vals) { _ibFilter = vals; _renderIbWithFilter(); }
function _clearIbFilter()     { _ibFilter = {}; _renderIbWithFilter(); }

function _renderIbWithFilter() {
  var from  = _ibFilter.from      || '';
  var to    = _ibFilter.to        || '';
  var svc   = (_ibFilter.service   || '').toLowerCase();
  var tuj   = (_ibFilter.tujuan    || '').toLowerCase();
  var stat  = (_ibFilter.status    || '').toLowerCase();
  var awb   = (_ibFilter.awb       || '').toLowerCase();
  var frm   = (_ibFilter.kota_from || '').toLowerCase();

  var data = filteredData(ibData).filter(function (d) {
    if (svc  && (d.service  || '').toLowerCase().indexOf(svc)  === -1) return false;
    if (tuj  && (d.tujuan   || '').toLowerCase().indexOf(tuj)  === -1) return false;
    if (stat && (d.status   || '').toLowerCase().indexOf(stat) === -1) return false;
    if (frm  && (d.from     || '').toLowerCase().indexOf(frm)  === -1) return false;
    if (from || to) {
      var d0 = (d.created_date || '').substring(0, 10);
      if (from && d0 < from) return false;
      if (to   && d0 > to)   return false;
    }
    return true;
  });

  var q = (document.getElementById('ibSearch').value || '').toLowerCase();
  if (q) {
    data = data.filter(function (d) {
      return (d.no_track + d.incharge + d.service + d.tujuan + (d.from || '') + d.status).toLowerCase().indexOf(q) !== -1;
    });
  }

  if (awb) {
    var matchedTracks = {};
    allScanAwbs.forEach(function (item) {
      if ((item.awb || '').toLowerCase().indexOf(awb) !== -1 && item.noTrack) {
        matchedTracks[item.noTrack] = true;
      }
    });
    data = data.filter(function (d) { return matchedTracks[d.no_track]; });
  }

  document.getElementById('ibTableCount').innerText = data.length + ' record';
  var _orig = ibData; ibData = data;
  renderIbTable(); ibData = _orig;
  document.getElementById('ibTableCount').innerText = data.length + ' record';
}

// ═══════════════════════════════════════════════════════
// FILTER LOGIC: MANIFEST
// ═══════════════════════════════════════════════════════
var _mfFilterAdv = {};

function _applyMfFilter(vals) { _mfFilterAdv = vals; _applyMfFilterToSheet(); }
function _clearMfFilter()     { _mfFilterAdv = {}; _applyMfFilterToSheet(); }

function _applyMfFilterToSheet() {
  if (!_mfData) return;
  var inc = (_mfFilterAdv.incharge || '').toLowerCase();
  var svc = (_mfFilterAdv.service  || '').toLowerCase();
  var tuj = (_mfFilterAdv.tujuan   || '').toLowerCase();
  if (!inc && !svc && !tuj) { renderManifestSheet(); return; }

  var colDefs = _mfData.colDefs || [];
  var awbRows = _mfData.awbRows || [];
  var validCols = [];
  colDefs.forEach(function (c, ci) {
    if (c.isDate) { validCols.push(ci); return; }
    var matchInc = !inc || (c.incharge || '').toLowerCase().indexOf(inc) !== -1;
    var matchSvc = !svc || (c.service  || '').toLowerCase().indexOf(svc) !== -1;
    var matchTuj = !tuj || (c.tujuan   || '').toLowerCase().indexOf(tuj) !== -1;
    if (matchInc && matchSvc && matchTuj) validCols.push(ci);
  });

  var _origDefs = _mfData.colDefs;
  var _origRows = _mfData.awbRows;
  _mfData.colDefs = validCols.map(function (ci) { return Object.assign({}, colDefs[ci], { colIdx: validCols.indexOf(ci) }); });
  _mfData.awbRows = awbRows.map(function (row) { return validCols.map(function (ci) { return row[ci] || ''; }); });
  renderManifestSheet();
  _mfData.colDefs = _origDefs;
  _mfData.awbRows = _origRows;
}

// ═══════════════════════════════════════════════════════
// FILTER LOGIC: OB&IB
// ═══════════════════════════════════════════════════════
var _obibFilterAdv = {};

function _applyObibFilterAdv(vals) { _obibFilterAdv = vals; if (_obibData) _buildObibTable(_obibData); }
function _clearObibFilterAdv()     { _obibFilterAdv = {}; if (_obibData) _buildObibTable(_obibData); }

var _origFilterObib = (typeof filterObib === 'function') ? filterObib : function () {};
filterObib = function () { if (_obibData) _buildObibTable(_obibData); };

// ═══════════════════════════════════════════════════════
// INJECT PANELS setelah DOM siap
// ═══════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', function () {
  setTimeout(_injectAllFilterPanels, 350);
});

function _injectAllFilterPanels() {
  _injectObFilter();
  _injectHvsFilter();
  _injectIbFilter();
  _injectMfFilter();
  _injectObibFilter();
  _refreshFpOptions();
}

// ── OB Filter ──
function _injectObFilter() {
  var page = document.getElementById('page-ob');
  if (!page) return;
  var statsRow = page.querySelector('.stats-row');
  if (!statsRow) return;

  var fields = [
    { key: 'from',             label: 'Dari Tanggal',   type: 'date' },
    { key: 'to',               label: 'Sampai Tanggal', type: 'date' },
    { key: 'awb',              label: 'AWB',            type: 'text', placeholder: 'Cari AWB...' },
    { key: 'incharge_display', label: 'Incharge',       type: 'display', placeholder: '— Semua —' },
    { key: 'service',          label: 'Service',        type: 'combobox', placeholder: 'Pilih / ketik...' },
    { key: 'tujuan',           label: 'Tujuan',         type: 'combobox', placeholder: 'Pilih / ketik...' },
    { key: 'status',           label: 'Status',         type: 'status', options: ['ON PROSES', 'SELESAI'] }
  ];

  var panel = _createFilterPanel('ob', fields, _applyObFilter, _clearObFilter);
  statsRow.parentNode.insertBefore(panel, statsRow.nextSibling);

  // Register comboboxes
  _fpCbRegister('ob-service', _getServiceOptions('ob'));
  _fpCbRegister('ob-tujuan',  _getTujuanOptions('ob'));

  // Set tampilan incharge
  var elInc = document.getElementById('fpf-ob-incharge_display');
  if (elInc) elInc.value = globalIncharge || '— Semua —';
}

// ── HVS Filter ──
function _injectHvsFilter() {
  var page = document.getElementById('page-hvs');
  if (!page) return;
  var statsRow = page.querySelector('.stats-row');
  if (!statsRow) return;

  var fields = [
    { key: 'from',             label: 'Dari Tanggal',   type: 'date' },
    { key: 'to',               label: 'Sampai Tanggal', type: 'date' },
    { key: 'awb',              label: 'AWB',            type: 'text', placeholder: 'Cari AWB...' },
    { key: 'incharge_display', label: 'Incharge',       type: 'display', placeholder: '— Semua —' },
    { key: 'service',          label: 'Service',        type: 'combobox', placeholder: 'Pilih / ketik...' },
    { key: 'tujuan',           label: 'Tujuan',         type: 'combobox', placeholder: 'Pilih / ketik...' },
    { key: 'status',           label: 'Status',         type: 'status', options: ['ON PROSES', 'SELESAI'] }
  ];

  var panel = _createFilterPanel('hvs', fields, _applyHvsFilter, _clearHvsFilter);
  statsRow.parentNode.insertBefore(panel, statsRow.nextSibling);

  _fpCbRegister('hvs-service', _getServiceOptions('hvs'));
  _fpCbRegister('hvs-tujuan',  _getTujuanOptions('hvs'));

  var elInc = document.getElementById('fpf-hvs-incharge_display');
  if (elInc) elInc.value = globalIncharge || '— Semua —';
}

// ── IB Filter ──
function _injectIbFilter() {
  var page = document.getElementById('page-ib');
  if (!page) return;
  var statsRow = page.querySelector('.stats-row');
  if (!statsRow) return;

  var fields = [
    { key: 'from',             label: 'Dari Tanggal',   type: 'date' },
    { key: 'to',               label: 'Sampai Tanggal', type: 'date' },
    { key: 'awb',              label: 'AWB',            type: 'text', placeholder: 'Cari AWB...' },
    { key: 'incharge_display', label: 'Incharge',       type: 'display', placeholder: '— Semua —' },
    { key: 'service',          label: 'Service',        type: 'combobox', placeholder: 'Pilih / ketik...' },
    { key: 'kota_from',        label: 'From (Kota)',    type: 'combobox', placeholder: 'Pilih / ketik...' },
    { key: 'tujuan',           label: 'Tujuan',         type: 'combobox', placeholder: 'Pilih / ketik...' },
    { key: 'status',           label: 'Status',         type: 'status', options: ['ON PROSES', 'SELESAI'] }
  ];

  var panel = _createFilterPanel('ib', fields, _applyIbFilter, _clearIbFilter);
  statsRow.parentNode.insertBefore(panel, statsRow.nextSibling);

  _fpCbRegister('ib-service',   _getServiceOptions('ib'));
  _fpCbRegister('ib-kota_from', _getFromOptions());
  _fpCbRegister('ib-tujuan',    _getTujuanOptions('ib'));

  var elInc = document.getElementById('fpf-ib-incharge_display');
  if (elInc) elInc.value = globalIncharge || '— Semua —';
}

// ── Manifest Filter ──
function _injectMfFilter() {
  var page = document.getElementById('page-manifest');
  if (!page) return;
  var statsRow = page.querySelector('.mf-stats-row');
  if (!statsRow) return;

  var fields = [
    { key: 'incharge', label: 'Incharge', type: 'combobox', placeholder: 'Pilih / ketik...' },
    { key: 'service',  label: 'Service',  type: 'combobox', placeholder: 'Pilih / ketik...' },
    { key: 'tujuan',   label: 'Tujuan',   type: 'combobox', placeholder: 'Pilih / ketik...' }
  ];

  var panel = _createFilterPanel('mf', fields, _applyMfFilter, _clearMfFilter);
  statsRow.parentNode.insertBefore(panel, statsRow);

  _fpCbRegister('mf-incharge', []);
  _fpCbRegister('mf-service',  []);
  _fpCbRegister('mf-tujuan',   []);
}

// ── OB&IB Filter ──
function _injectObibFilter() {
  var page = document.getElementById('page-obib');
  if (!page) return;
  var tablePanel = page.querySelector('.table-panel');
  if (!tablePanel) return;
  var toolbar = tablePanel.querySelector('.table-toolbar');
  if (!toolbar) return;

  var fields = [
    { key: 'incharge', label: 'Incharge (R1)', type: 'combobox', placeholder: 'Pilih / ketik...' },
    { key: 'service',  label: 'Service (R2)',  type: 'combobox', placeholder: 'Pilih / ketik...' },
    { key: 'kota',     label: 'Kota/Tujuan',   type: 'combobox', placeholder: 'Pilih / ketik...' },
    { key: 'awb',      label: 'AWB',           type: 'text',     placeholder: 'Cari AWB...' }
  ];

  var panel = _createFilterPanel('obib_adv', fields, _applyObibFilterAdv, _clearObibFilterAdv);
  tablePanel.insertBefore(panel, toolbar.nextSibling);

  _fpCbRegister('obib_adv-incharge', []);
  _fpCbRegister('obib_adv-service',  []);
  _fpCbRegister('obib_adv-kota',     []);
}

// ═══════════════════════════════════════════════════════
// PATCH _buildObibTable untuk advanced filter
// ═══════════════════════════════════════════════════════
(function patchObibTable() {
  var _interval = setInterval(function () {
    if (typeof _buildObibTable !== 'function') return;
    clearInterval(_interval);
    var _orig = _buildObibTable;
    _buildObibTable = function (data) {
      var adv = _obibFilterAdv || {};
      var inc = (adv.incharge || '').toLowerCase();
      var svc = (adv.service  || '').toLowerCase();
      var kot = (adv.kota     || '').toLowerCase();
      var awb = (adv.awb      || '').toLowerCase();

      if (inc || svc || kot || awb) {
        var filteredData = JSON.parse(JSON.stringify(data));
        if (filteredData.colDefs) {
          filteredData.colDefs = filteredData.colDefs.filter(function (def) {
            var ct = (def.colType || '').toUpperCase();
            if (ct === 'DATE') return true;
            var r1Match = !inc || (def.r1 || '').toLowerCase().indexOf(inc) !== -1;
            var r2Match = !svc || (def.r2 || '').toLowerCase().indexOf(svc) !== -1;
            var r3Match = !kot || (def.r3 || '').toLowerCase().indexOf(kot) !== -1;
            return r1Match && r2Match && r3Match;
          });
        }
        var searchEl = document.getElementById('obibSearch');
        var prevVal  = searchEl ? searchEl.value : '';
        if (awb && searchEl) searchEl.value = awb;
        _orig(filteredData);
        if (awb && searchEl) searchEl.value = prevVal;
      } else {
        _orig(data);
      }

      // Refresh options OB&IB setelah data dimuat
      setTimeout(function () { _refreshFpOptions(); }, 200);
    };
  }, 100);
})();

// ═══════════════════════════════════════════════════════
// PATCH filter table functions agar filter advanced tetap aktif
// ═══════════════════════════════════════════════════════
var _origFilterObTable  = (typeof filterObTable  === 'function') ? filterObTable  : function () {};
var _origFilterHvsTable = (typeof filterHvsTable === 'function') ? filterHvsTable : function () {};
var _origFilterIbTable  = (typeof filterIbTable  === 'function') ? filterIbTable  : function () {};

filterObTable = function () {
  if (Object.keys(_obFilter).some(function (k) { return _obFilter[k]; })) {
    _renderObWithFilter();
  } else {
    _origFilterObTable();
  }
};
filterHvsTable = function () {
  if (Object.keys(_hvsFilter).some(function (k) { return _hvsFilter[k]; })) {
    _renderHvsWithFilter();
  } else {
    _origFilterHvsTable();
  }
};
filterIbTable = function () {
  if (Object.keys(_ibFilter).some(function (k) { return _ibFilter[k]; })) {
    _renderIbWithFilter();
  } else {
    _origFilterIbTable();
  }
};

// ═══════════════════════════════════════════════════════
// PATCH selectGlobalIncharge agar filter panel ter-update
// ═══════════════════════════════════════════════════════
var _origSelectGlobalIncharge = (typeof selectGlobalIncharge === 'function') ? selectGlobalIncharge : null;
if (_origSelectGlobalIncharge) {
  selectGlobalIncharge = function (v) {
    _origSelectGlobalIncharge(v);
    setTimeout(function () { _refreshFpOptions(); }, 100);
  };
}

// ── Enter key support pada input filter ──
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter') return;
  var el = e.target;
  if (!el.classList.contains('fp-input') && !el.classList.contains('fp-select') && !el.classList.contains('fp-cb-input')) return;
  var wrap = el.closest('.fp-wrap');
  if (!wrap) return;
  var id = wrap.id.replace('fp-', '');
  _applyFP(id);
});

// ── Refresh manifest filter options saat manifest dimuat ──
(function patchLoadManifestPage() {
  var _interval = setInterval(function () {
    if (typeof loadManifestPage !== 'function') return;
    clearInterval(_interval);
    var _orig = loadManifestPage;
    loadManifestPage = function (forceMode) {
      _orig(forceMode);
      setTimeout(function () { _refreshFpOptions(); }, 800);
    };
  }, 150);
})();
