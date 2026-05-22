/* ============================================================
   GTW BDO — views-filter.js v1.0
   Filter Panel (show/hide) untuk OB, HVS, IB, Manifest, OB&IB
   TIDAK mengubah skrip yang sudah ada (core.js, incharge.js,
   forms.js, views.js). Cukup include SETELAH views.js.
   ============================================================ */

// ── Inject CSS filter panel sekali ──
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
  overflow: hidden;
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
  transition: background .15s ease, border-color .15s ease;
}
.fp-header.open {
  border-bottom-color: var(--blue-mid);
  background: linear-gradient(90deg, #DBEAFE 0%, #EFF6FF 100%);
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
  padding: 14px 16px 12px;
  background: var(--white);
  animation: fpSlideDown .18s ease;
}
.fp-body.open {
  display: block;
}
@keyframes fpSlideDown {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ─── GRID LAYOUT ─── */
.fp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px 14px;
  margin-bottom: 12px;
}
.fp-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
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
}
.fp-input:focus, .fp-select:focus {
  border-color: var(--blue2);
  box-shadow: 0 0 0 3px var(--blue-light);
}
.fp-input::placeholder {
  color: var(--gray4);
}

/* ─── ACTIONS ─── */
.fp-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 10px;
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

// ═══════════════════════════════════════════════════════════════════
// HELPER: buat elemen filter panel
// ═══════════════════════════════════════════════════════════════════
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

  // Grid
  var grid = document.createElement('div');
  grid.className = 'fp-grid';
  fields.forEach(function (f) {
    var field = document.createElement('div');
    field.className = 'fp-field';
    var lbl = '<div class="fp-label">' + f.label + '</div>';
    var inp = '';
    if (f.type === 'select') {
      inp = '<select class="fp-select" id="fpf-' + id + '-' + f.key + '">' +
        '<option value="">' + (f.placeholder || '— Semua —') + '</option>' +
        (f.options || []).map(function (o) {
          return '<option value="' + o + '">' + o + '</option>';
        }).join('') +
        '</select>';
    } else {
      inp = '<input class="fp-input" id="fpf-' + id + '-' + f.key + '" ' +
        'type="' + (f.type || 'text') + '" ' +
        'placeholder="' + (f.placeholder || '') + '">';
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

  // Store callbacks & fields
  _fpRegistry[id] = { fields: fields, onFilter: onFilter, onClear: onClear, active: {} };
  return wrap;
}

var _fpRegistry = {};

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
    var el = document.getElementById('fpf-' + id + '-' + f.key);
    vals[f.key] = el ? el.value.trim() : '';
  });
  reg.active = vals;
  _renderFPTags(id);
  if (reg.onFilter) reg.onFilter(vals);
}

function _clearFP(id) {
  var reg = _fpRegistry[id];
  if (!reg) return;
  reg.fields.forEach(function (f) {
    var el = document.getElementById('fpf-' + id + '-' + f.key);
    if (el) el.value = '';
  });
  reg.active = {};
  _renderFPTags(id);
  if (reg.onClear) reg.onClear();
}

function _clearFPKey(id, key) {
  var el = document.getElementById('fpf-' + id + '-' + key);
  if (el) el.value = '';
  _applyFP(id);
}

function _renderFPTags(id) {
  var reg     = _fpRegistry[id];
  var tagsEl  = document.getElementById('fp-tags-' + id);
  var badgeEl = document.getElementById('fp-badge-' + id);
  if (!reg || !tagsEl) return;
  var active  = reg.active || {};
  var keys    = Object.keys(active).filter(function (k) { return active[k]; });
  tagsEl.innerHTML = keys.map(function (k) {
    var label = (reg.fields.find(function (f) { return f.key === k; }) || {}).label || k;
    return '<span class="fp-tag">' + label + ': ' + active[k] +
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

// ═══════════════════════════════════════════════════════════════════
// HELPERS: ambil option unik dari data array
// ═══════════════════════════════════════════════════════════════════
function _uniqueVals(arr, key) {
  var seen = {}, out = [];
  arr.forEach(function (d) {
    var v = d[key] || '';
    if (v && !seen[v]) { seen[v] = true; out.push(v); }
  });
  return out.sort();
}

// ═══════════════════════════════════════════════════════════════════
// FILTER LOGIC: OB
// ═══════════════════════════════════════════════════════════════════
var _obFilter = {};

function _applyObFilter(vals) {
  _obFilter = vals;
  _renderObWithFilter();
}
function _clearObFilter() {
  _obFilter = {};
  _renderObWithFilter();
}
function _renderObWithFilter() {
  var from    = _obFilter.from || '';
  var to      = _obFilter.to   || '';
  var inc     = (_obFilter.incharge || '').toLowerCase();
  var svc     = (_obFilter.service  || '').toLowerCase();
  var tuj     = (_obFilter.tujuan   || '').toLowerCase();
  var stat    = (_obFilter.status   || '').toLowerCase();
  var notrack = (_obFilter.notrack  || '').toLowerCase();

  var data = obData.filter(function (d) {
    if (inc     && (d.incharge  || '').toLowerCase().indexOf(inc)     === -1) return false;
    if (svc     && (d.service   || '').toLowerCase().indexOf(svc)     === -1) return false;
    if (tuj     && (d.tujuan    || '').toLowerCase().indexOf(tuj)     === -1) return false;
    if (stat    && (d.status    || '').toLowerCase().indexOf(stat)    === -1) return false;
    if (notrack && (d.no_track  || '').toLowerCase().indexOf(notrack) === -1) return false;
    if (from || to) {
      var d0 = (d.created_date || '').substring(0, 10);
      if (from && d0 < from) return false;
      if (to   && d0 > to)   return false;
    }
    return true;
  });

  // Terapkan filter tabel search juga
  var q = (document.getElementById('obSearch').value || '').toLowerCase();
  if (q) {
    data = data.filter(function (d) {
      return (d.no_track + d.incharge + d.service + d.tujuan + d.status).toLowerCase().indexOf(q) !== -1;
    });
  }

  document.getElementById('obTableCount').innerText = data.length + ' record';
  var tbody = document.getElementById('obTbody');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><span class="material-icons-round">search_off</span>Tidak ada data sesuai filter</div></td></tr>';
    return;
  }
  // Gunakan renderer asli forms.js dengan data override sementara
  var _orig = obData;
  obData = data;
  renderObTable();
  obData = _orig;
  // Kembalikan count yang benar
  document.getElementById('obTableCount').innerText = data.length + ' record';
}

// ═══════════════════════════════════════════════════════════════════
// FILTER LOGIC: HVS
// ═══════════════════════════════════════════════════════════════════
var _hvsFilter = {};

function _applyHvsFilter(vals) {
  _hvsFilter = vals;
  _renderHvsWithFilter();
}
function _clearHvsFilter() {
  _hvsFilter = {};
  _renderHvsWithFilter();
}
function _renderHvsWithFilter() {
  var from    = _hvsFilter.from || '';
  var to      = _hvsFilter.to   || '';
  var inc     = (_hvsFilter.incharge || '').toLowerCase();
  var svc     = (_hvsFilter.service  || '').toLowerCase();
  var tuj     = (_hvsFilter.tujuan   || '').toLowerCase();
  var stat    = (_hvsFilter.status   || '').toLowerCase();
  var notrack = (_hvsFilter.notrack  || '').toLowerCase();

  var data = hvsData.filter(function (d) {
    if (inc     && (d.incharge  || '').toLowerCase().indexOf(inc)     === -1) return false;
    if (svc     && (d.service   || '').toLowerCase().indexOf(svc)     === -1) return false;
    if (tuj     && (d.tujuan    || '').toLowerCase().indexOf(tuj)     === -1) return false;
    if (stat    && (d.status    || '').toLowerCase().indexOf(stat)    === -1) return false;
    if (notrack && (d.no_track  || '').toLowerCase().indexOf(notrack) === -1) return false;
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

  document.getElementById('hvsTableCount').innerText = data.length + ' record';
  var tbody = document.getElementById('hvsTbody');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><span class="material-icons-round">search_off</span>Tidak ada data sesuai filter</div></td></tr>';
    return;
  }
  var _orig = hvsData;
  hvsData = data;
  renderHvsTable();
  hvsData = _orig;
  document.getElementById('hvsTableCount').innerText = data.length + ' record';
}

// ═══════════════════════════════════════════════════════════════════
// FILTER LOGIC: IB
// ═══════════════════════════════════════════════════════════════════
var _ibFilter = {};

function _applyIbFilter(vals) {
  _ibFilter = vals;
  _renderIbWithFilter();
}
function _clearIbFilter() {
  _ibFilter = {};
  _renderIbWithFilter();
}
function _renderIbWithFilter() {
  var from    = _ibFilter.from    || '';
  var to      = _ibFilter.to      || '';
  var inc     = (_ibFilter.incharge || '').toLowerCase();
  var svc     = (_ibFilter.service  || '').toLowerCase();
  var tuj     = (_ibFilter.tujuan   || '').toLowerCase();
  var stat    = (_ibFilter.status   || '').toLowerCase();
  var notrack = (_ibFilter.notrack  || '').toLowerCase();
  var frm     = (_ibFilter.kota_from|| '').toLowerCase();

  var data = ibData.filter(function (d) {
    if (inc     && (d.incharge  || '').toLowerCase().indexOf(inc)     === -1) return false;
    if (svc     && (d.service   || '').toLowerCase().indexOf(svc)     === -1) return false;
    if (tuj     && (d.tujuan    || '').toLowerCase().indexOf(tuj)     === -1) return false;
    if (stat    && (d.status    || '').toLowerCase().indexOf(stat)    === -1) return false;
    if (notrack && (d.no_track  || '').toLowerCase().indexOf(notrack) === -1) return false;
    if (frm     && (d.from      || '').toLowerCase().indexOf(frm)     === -1) return false;
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

  document.getElementById('ibTableCount').innerText = data.length + ' record';
  var tbody = document.getElementById('ibTbody');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="11"><div class="empty-state"><span class="material-icons-round">search_off</span>Tidak ada data sesuai filter</div></td></tr>';
    return;
  }
  var _orig = ibData;
  ibData = data;
  renderIbTable();
  ibData = _orig;
  document.getElementById('ibTableCount').innerText = data.length + ' record';
}

// ═══════════════════════════════════════════════════════════════════
// FILTER LOGIC: MANIFEST
// ═══════════════════════════════════════════════════════════════════
var _mfFilterAdv = {};

function _applyMfFilter(vals) {
  _mfFilterAdv = vals;
  _applyMfFilterToSheet();
}
function _clearMfFilter() {
  _mfFilterAdv = {};
  _applyMfFilterToSheet();
}
function _applyMfFilterToSheet() {
  if (!_mfData) return;
  var inc = (_mfFilterAdv.incharge || '').toLowerCase();
  var svc = (_mfFilterAdv.service  || '').toLowerCase();
  var tuj = (_mfFilterAdv.tujuan   || '').toLowerCase();

  if (!inc && !svc && !tuj) {
    // Tidak ada filter advanced → render normal
    renderManifestSheet();
    return;
  }

  // Filter kolom sesuai kriteria
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

  // Buat data sementara dengan hanya kolom yang valid
  var _origDefs = _mfData.colDefs;
  var _origRows = _mfData.awbRows;

  _mfData.colDefs = validCols.map(function (ci) { return colDefs[ci]; });
  _mfData.awbRows = awbRows.map(function (row) {
    return validCols.map(function (ci) { return row[ci] || ''; });
  });
  // Remap colIdx
  _mfData.colDefs.forEach(function (c, i) {
    c = Object.assign({}, c);
    c.colIdx = i;
    _mfData.colDefs[i] = c;
  });

  renderManifestSheet();

  // Restore
  _mfData.colDefs = _origDefs;
  _mfData.awbRows = _origRows;
}

// ═══════════════════════════════════════════════════════════════════
// FILTER LOGIC: OB&IB
// ═══════════════════════════════════════════════════════════════════
var _obibFilterAdv = {};

function _applyObibFilterAdv(vals) {
  _obibFilterAdv = vals;
  if (_obibData) _buildObibTable(_obibData);
}
function _clearObibFilterAdv() {
  _obibFilterAdv = {};
  if (_obibData) _buildObibTable(_obibData);
}

// Patch filterObib agar juga apply advanced filter
var _origFilterObib = (typeof filterObib === 'function') ? filterObib : function () {};
filterObib = function () {
  if (_obibData) _buildObibTable(_obibData);
};

// ═══════════════════════════════════════════════════════════════════
// INJECT FILTER PANELS setelah DOM siap
// ═══════════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', function () {
  setTimeout(_injectAllFilterPanels, 300);
});

function _injectAllFilterPanels() {
  _injectObFilter();
  _injectHvsFilter();
  _injectIbFilter();
  _injectMfFilter();
  _injectObibFilter();
}

// ── OB Filter ──
function _injectObFilter() {
  var page = document.getElementById('page-ob');
  if (!page) return;
  var statsRow = page.querySelector('.stats-row');
  if (!statsRow) return;

  var fields = [
    { key: 'from',     label: 'Dari Tanggal', type: 'date' },
    { key: 'to',       label: 'Sampai Tanggal', type: 'date' },
    { key: 'notrack',  label: 'No Track',    type: 'text', placeholder: 'Cari No Track...' },
    { key: 'incharge', label: 'Incharge',    type: 'text', placeholder: 'Cari Incharge...' },
    { key: 'service',  label: 'Service',     type: 'text', placeholder: 'Cari Service...' },
    { key: 'tujuan',   label: 'Tujuan',      type: 'text', placeholder: 'Cari Tujuan...' },
    { key: 'status',   label: 'Status',      type: 'select',
      options: ['ON PROSES', 'SELESAI'], placeholder: '— Semua Status —' }
  ];

  var panel = _createFilterPanel('ob', fields, _applyObFilter, _clearObFilter);
  statsRow.parentNode.insertBefore(panel, statsRow.nextSibling);
}

// ── HVS Filter ──
function _injectHvsFilter() {
  var page = document.getElementById('page-hvs');
  if (!page) return;
  var statsRow = page.querySelector('.stats-row');
  if (!statsRow) return;

  var fields = [
    { key: 'from',     label: 'Dari Tanggal', type: 'date' },
    { key: 'to',       label: 'Sampai Tanggal', type: 'date' },
    { key: 'notrack',  label: 'No Track',    type: 'text', placeholder: 'Cari No Track...' },
    { key: 'incharge', label: 'Incharge',    type: 'text', placeholder: 'Cari Incharge...' },
    { key: 'service',  label: 'Service',     type: 'text', placeholder: 'Cari Service...' },
    { key: 'tujuan',   label: 'Tujuan',      type: 'text', placeholder: 'Cari Tujuan...' },
    { key: 'status',   label: 'Status',      type: 'select',
      options: ['ON PROSES', 'SELESAI'], placeholder: '— Semua Status —' }
  ];

  var panel = _createFilterPanel('hvs', fields, _applyHvsFilter, _clearHvsFilter);
  statsRow.parentNode.insertBefore(panel, statsRow.nextSibling);
}

// ── IB Filter ──
function _injectIbFilter() {
  var page = document.getElementById('page-ib');
  if (!page) return;
  var statsRow = page.querySelector('.stats-row');
  if (!statsRow) return;

  var fields = [
    { key: 'from',      label: 'Dari Tanggal',   type: 'date' },
    { key: 'to',        label: 'Sampai Tanggal', type: 'date' },
    { key: 'notrack',   label: 'No Track',       type: 'text', placeholder: 'Cari No Track...' },
    { key: 'incharge',  label: 'Incharge',       type: 'text', placeholder: 'Cari Incharge...' },
    { key: 'service',   label: 'Service',        type: 'text', placeholder: 'Cari Service...' },
    { key: 'kota_from', label: 'From (Kota)',    type: 'text', placeholder: 'Cari Kota Asal...' },
    { key: 'tujuan',    label: 'Tujuan',         type: 'text', placeholder: 'Cari Tujuan...' },
    { key: 'status',    label: 'Status',         type: 'select',
      options: ['ON PROSES', 'SELESAI'], placeholder: '— Semua Status —' }
  ];

  var panel = _createFilterPanel('ib', fields, _applyIbFilter, _clearIbFilter);
  statsRow.parentNode.insertBefore(panel, statsRow.nextSibling);
}

// ── Manifest Filter ──
function _injectMfFilter() {
  var page = document.getElementById('page-manifest');
  if (!page) return;
  var toolbar = page.querySelector('.mf-toolbar');
  if (!toolbar) return;

  var fields = [
    { key: 'incharge', label: 'Incharge', type: 'text', placeholder: 'Cari Incharge...' },
    { key: 'service',  label: 'Service',  type: 'text', placeholder: 'Cari Service...' },
    { key: 'tujuan',   label: 'Tujuan',   type: 'text', placeholder: 'Cari Tujuan/Kota...' }
  ];

  var panel = _createFilterPanel('mf', fields, _applyMfFilter, _clearMfFilter);
  panel.style.flexShrink = '0';
  // Insert setelah toolbar (sebelum stats row)
  var statsRow = page.querySelector('.mf-stats-row');
  if (statsRow) {
    page.insertBefore(panel, statsRow);
  } else {
    toolbar.after(panel);
  }
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
    { key: 'incharge', label: 'Incharge (R1)', type: 'text', placeholder: 'Cari Incharge...' },
    { key: 'service',  label: 'Service (R2)',  type: 'text', placeholder: 'Cari Service...' },
    { key: 'kota',     label: 'Kota/Tujuan',   type: 'text', placeholder: 'Cari Kota...' },
    { key: 'awb',      label: 'AWB',           type: 'text', placeholder: 'Cari AWB...' }
  ];

  var panel = _createFilterPanel('obib_adv', fields, _applyObibFilterAdv, _clearObibFilterAdv);
  tablePanel.insertBefore(panel, toolbar.nextSibling);
}

// ═══════════════════════════════════════════════════════════════════
// PATCH _buildObibTable agar support filter advanced
// ═══════════════════════════════════════════════════════════════════
var _origBuildObibTable = (typeof _buildObibTable === 'function') ? _buildObibTable : null;

// Override _buildObibTable dengan wrapper yang apply advanced filter
(function patchObibTable() {
  var _interval = setInterval(function () {
    if (typeof _buildObibTable !== 'function') return;
    clearInterval(_interval);
    var _orig = _buildObibTable;
    _buildObibTable = function (data) {
      // Apply advanced filter ke search input jika ada
      var adv = _obibFilterAdv || {};
      var inc = (adv.incharge || '').toLowerCase();
      var svc = (adv.service  || '').toLowerCase();
      var kot = (adv.kota     || '').toLowerCase();
      var awb = (adv.awb      || '').toLowerCase();

      if (inc || svc || kot || awb) {
        // Override search input sementara dengan filter gabungan
        var searchEl = document.getElementById('obibSearch');
        var prevVal  = searchEl ? searchEl.value : '';
        // Buat data filtered dengan filter advanced
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
        // Untuk AWB filter, set search input sementara
        if (awb && searchEl) searchEl.value = awb;
        _orig(filteredData);
        if (awb && searchEl) searchEl.value = prevVal;
      } else {
        _orig(data);
      }
    };
  }, 100);
})();

// ═══════════════════════════════════════════════════════════════════
// PATCH filterObTable / filterHvsTable / filterIbTable
// agar saat user ketik di search box, filter advanced tetap aktif
// ═══════════════════════════════════════════════════════════════════
var _origFilterObTable  = filterObTable;
var _origFilterHvsTable = filterHvsTable;
var _origFilterIbTable  = filterIbTable;

filterObTable = function () {
  if (Object.keys(_obFilter).some(function(k){return _obFilter[k];})) {
    _renderObWithFilter();
  } else {
    _origFilterObTable();
  }
};

filterHvsTable = function () {
  if (Object.keys(_hvsFilter).some(function(k){return _hvsFilter[k];})) {
    _renderHvsWithFilter();
  } else {
    _origFilterHvsTable();
  }
};

filterIbTable = function () {
  if (Object.keys(_ibFilter).some(function(k){return _ibFilter[k];})) {
    _renderIbWithFilter();
  } else {
    _origFilterIbTable();
  }
};

// ─── Enter key support pada input filter ───
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter') return;
  var el = e.target;
  if (!el.classList.contains('fp-input') && !el.classList.contains('fp-select')) return;
  // Cari panel id dari parent
  var wrap = el.closest('.fp-wrap');
  if (!wrap) return;
  var id = wrap.id.replace('fp-', '');
  _applyFP(id);
});
