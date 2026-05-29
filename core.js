/* ============================================================
   GTW BDO — core.js v4.2
   Config, API helpers, UI helpers, SmartCombobox
   ============================================================ */

// ─── CONFIG ───
var GAS_URL = "https://script.google.com/macros/s/AKfycbz1TSC5YaKxuaqPLkC6qkaOs785RN8kzpZZLxRitUsLCU3aYSGvzQBZvBizr3tpEt-p6g/exec";

// ─── STATE ───
var masterData = {};
var obData = [], hvsData = [], ibData = [];
var globalIncharge = '';
var allIncharges = [];
var currentDetailItem = null, currentDetailType = '';
var pendingTujuanType = '';
var obScanMap = {}, hvsScanMap = {}, ibScanMap = {};
var ibScanned = [];
var obActiveTuj = '', hvsActiveTuj = '', ibActiveTuj = '';
var _obibData = null;
var _mfData = null, _mfLoaded = false, _mfFilter = '';
var _mfSelRow = -1, _mfSelCol = -1, _mfFilteredRows = [];
var allScanAwbs = [];

// ─── API ───
function gasGet(action, params) {
  return new Promise(function(resolve, reject) {
    var url = new URL(GAS_URL);
    url.searchParams.set('action', action);
    if (params) Object.keys(params).forEach(function(k) { url.searchParams.set(k, params[k]); });
    fetch(url.toString(), { redirect: 'follow', mode: 'cors' })
      .then(function(r) { return r.json(); }).then(resolve)
      .catch(function() {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url.toString(), true);
        xhr.onload = function() { try { resolve(JSON.parse(xhr.responseText)); } catch(e) { reject(new Error('Parse error')); } };
        xhr.onerror = function() { reject(new Error('Network error')); };
        xhr.send();
      });
  });
}

function gasPost(action, data) {
  data.action = action;
  var body = JSON.stringify(data);
  return new Promise(function(resolve, reject) {
    fetch(GAS_URL, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body })
      .then(function(r) { return r.json(); }).then(resolve)
      .catch(function() {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', GAS_URL, true);
        xhr.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
        xhr.onload = function() { try { resolve(JSON.parse(xhr.responseText)); } catch(e) { reject(new Error('Parse error')); } };
        xhr.onerror = function() { reject(new Error('Network error')); };
        xhr.send(body);
      });
  });
}

// ─── UI HELPERS ───
function showLoading(t) { document.getElementById('loadingText').innerText = t || 'Memuat...'; document.getElementById('loading').style.display = 'flex'; }
function hideLoading() { document.getElementById('loading').style.display = 'none'; }
function toast(msg, type) {
  var el = document.getElementById('toast');
  el.innerText = msg; el.className = type || '';
  el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(function() { el.style.display = 'none'; }, 3500);
}
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('collapsed'); }
function escQ(s) { return (s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function escH(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function escRegex(s) { return (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

document.querySelectorAll('.modal-overlay').forEach(function(el) {
  el.addEventListener('click', function(e) { if (e.target === el) el.classList.remove('open'); });
});

// ─── SMART COMBOBOX ───
var cbRegistry = {};

function registerCb(cbId, inputId, dropId, options, onSelect, readOnly) {
  var inputEl = document.getElementById(inputId);
  var dropEl = document.getElementById(dropId);
  var cbEl = document.getElementById(cbId);
  cbRegistry[cbId] = { options: options, value: '', onSelect: onSelect, inputEl: inputEl, dropEl: dropEl, cbEl: cbEl, focusIdx: -1 };
  if (readOnly) { inputEl.setAttribute('readonly', true); inputEl.style.cursor = 'pointer'; }
  inputEl.addEventListener('click', function() { if (!inputEl.disabled) openCb2(cbId); });
  inputEl.addEventListener('input', function() { if (!readOnly && !inputEl.disabled) filterCb2(cbId); });
  inputEl.addEventListener('keydown', function(e) { if (!inputEl.disabled) handleCbKey(e, cbId); });
  inputEl.addEventListener('blur', function() { setTimeout(function() { closeCb2(cbId); }, 200); });
  renderCbOptions(cbId, '');
}

function openCb2(cbId) {
  Object.keys(cbRegistry).forEach(function(id) { if (id !== cbId) closeCb2(id); });
  var reg = cbRegistry[cbId];
  if (reg.inputEl.disabled) return;
  reg.cbEl.classList.add('open'); reg.focusIdx = -1;
  renderCbOptions(cbId, reg.inputEl.getAttribute('readonly') ? '' : reg.inputEl.value);
}
function closeCb2(cbId) { var reg = cbRegistry[cbId]; if (reg) reg.cbEl.classList.remove('open'); }
function filterCb2(cbId) { var reg = cbRegistry[cbId]; if (reg.inputEl.disabled) return; var q = reg.inputEl.value; reg.cbEl.classList.add('open'); reg.focusIdx = -1; renderCbOptions(cbId, q); }
function renderCbOptions(cbId, q) {
  var reg = cbRegistry[cbId]; var opts = reg.options;
  var filtered = q ? opts.filter(function(v) { return v.toLowerCase().indexOf(q.toLowerCase()) !== -1; }) : opts.slice();
  if (!filtered.length) { reg.dropEl.innerHTML = '<div class="form-smart-cb-empty">Tidak ada pilihan</div>'; reg._filtered = []; return; }
  reg._filtered = filtered;
  reg.dropEl.innerHTML = filtered.map(function(v) {
    var isSel = v === reg.value;
    return '<div class="form-smart-cb-option' + (isSel ? ' selected' : '') + '" onmousedown="selectCb2(\'' + cbId + '\',\'' + escQ(v) + '\')">' +
      (isSel ? '<span class="material-icons-round" style="font-size:13px;color:var(--blue)">check</span>' : '<span style="width:13px;display:inline-block"></span>') + v + '</div>';
  }).join('');
}
function selectCb2(cbId, val) { var reg = cbRegistry[cbId]; reg.value = val; reg.inputEl.value = val; closeCb2(cbId); if (reg.onSelect) reg.onSelect(val); }
function handleCbKey(e, cbId) {
  var reg = cbRegistry[cbId]; var isOpen = reg.cbEl.classList.contains('open'); var filtered = reg._filtered || [];
  if (e.key === 'ArrowDown') { e.preventDefault(); if (!isOpen) { openCb2(cbId); return; } reg.focusIdx = Math.min(reg.focusIdx + 1, filtered.length - 1); highlightCbOption(cbId); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); reg.focusIdx = Math.max(reg.focusIdx - 1, 0); highlightCbOption(cbId); }
  else if (e.key === 'Enter') { e.preventDefault(); if (isOpen && reg.focusIdx >= 0 && filtered[reg.focusIdx]) selectCb2(cbId, filtered[reg.focusIdx]); else if (isOpen && filtered.length === 1) selectCb2(cbId, filtered[0]); else if (!isOpen) openCb2(cbId); }
  else if (e.key === 'Escape') { closeCb2(cbId); }
  else if (e.key === 'Tab') { if (isOpen && filtered.length > 0) selectCb2(cbId, filtered[reg.focusIdx >= 0 ? reg.focusIdx : 0]); }
}
function highlightCbOption(cbId) {
  var reg = cbRegistry[cbId];
  reg.dropEl.querySelectorAll('.form-smart-cb-option').forEach(function(el, i) { el.classList.toggle('focused', i === reg.focusIdx); if (i === reg.focusIdx) el.scrollIntoView({ block: 'nearest' }); });
}
function toggleFormCb(cbId) { var reg = cbRegistry[cbId]; if (!reg || reg.inputEl.disabled) return; if (reg.cbEl.classList.contains('open')) closeCb2(cbId); else { openCb2(cbId); reg.inputEl.focus(); } }
function updateCbOptions(cbId, options) { if (!cbRegistry[cbId]) return; cbRegistry[cbId].options = options; renderCbOptions(cbId, cbRegistry[cbId].inputEl.getAttribute('readonly') ? '' : cbRegistry[cbId].inputEl.value); }
function setCbDisabled(cbId, disabled) { var reg = cbRegistry[cbId]; if (!reg) return; reg.inputEl.disabled = disabled; if (disabled) { reg.inputEl.value = ''; reg.value = ''; closeCb2(cbId); } }

function initGlobalCb(options) {
  var inputEl = document.getElementById('globalInchargeInput');
  var dropEl = document.getElementById('globalCbDrop');
  var cbEl = document.getElementById('globalSmartCb');
  var reg = { options: options, value: globalIncharge, onSelect: selectGlobalIncharge, inputEl: inputEl, dropEl: dropEl, cbEl: cbEl, focusIdx: -1, _filtered: options.slice() };
  cbRegistry['globalSmartCb'] = reg;
  function renderGlobal(q) {
    var filtered = q ? options.filter(function(v) { return v.toLowerCase().indexOf(q.toLowerCase()) !== -1; }) : options.slice();
    reg._filtered = filtered;
    if (!filtered.length) { dropEl.innerHTML = '<div class="smart-cb-empty">Tidak ada</div>'; return; }
    dropEl.innerHTML = filtered.map(function(v) { return '<div class="smart-cb-option' + (v === globalIncharge ? ' selected' : '') + '" onmousedown="selectGlobalIncharge(\'' + escQ(v) + '\')">' + v + '</div>'; }).join('');
  }
  reg.render = renderGlobal;
  inputEl.setAttribute('readonly', true); inputEl.style.cursor = 'pointer';
  inputEl.addEventListener('click', function() { cbEl.classList.toggle('open'); renderGlobal(''); });
  inputEl.addEventListener('keydown', function(e) {
    var isOpen = cbEl.classList.contains('open'); var filtered = reg._filtered || [];
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!isOpen) { cbEl.classList.add('open'); renderGlobal(''); return; } reg.focusIdx = Math.min((reg.focusIdx || 0) + 1, filtered.length - 1); dropEl.querySelectorAll('.smart-cb-option').forEach(function(el, i) { el.classList.toggle('focused', i === reg.focusIdx); if (i === reg.focusIdx) el.scrollIntoView({ block: 'nearest' }); }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); reg.focusIdx = Math.max((reg.focusIdx || 0) - 1, 0); dropEl.querySelectorAll('.smart-cb-option').forEach(function(el, i) { el.classList.toggle('focused', i === reg.focusIdx); }); }
    else if (e.key === 'Enter') { e.preventDefault(); if (isOpen && reg.focusIdx >= 0 && filtered[reg.focusIdx]) selectGlobalIncharge(filtered[reg.focusIdx]); }
    else if (e.key === 'Escape') { cbEl.classList.remove('open'); }
  });
  inputEl.addEventListener('blur', function() { setTimeout(function() { cbEl.classList.remove('open'); }, 200); });
}

document.addEventListener('click', function(e) {
  Object.keys(cbRegistry).forEach(function(cbId) { var reg = cbRegistry[cbId]; if (reg && reg.cbEl && !reg.cbEl.contains(e.target)) closeCb2(cbId); });
  var gcb = document.getElementById('globalSmartCb');
  if (gcb && !gcb.contains(e.target)) gcb.classList.remove('open');
});
