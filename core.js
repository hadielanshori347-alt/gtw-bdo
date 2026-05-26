/* ============================================================
   GTW BDO — core.js v5.0 (Supabase)
   Config, API helpers, UI helpers, SmartCombobox
   ============================================================ */

// ─── CONFIG ───
var SUPABASE_URL = "https://mcsdhgzojydgytunixne.supabase.co";  // ← ganti
var SUPABASE_KEY = "sb_publishable_I8tKjAoQ49RvG7uNIRZbaw_Z9knWECc";                // ← ganti

// ─── SUPABASE HEADERS ───
function _sbH() {
  return {
    "Content-Type":  "application/json",
    "apikey":        SUPABASE_KEY,
    "Authorization": "Bearer " + SUPABASE_KEY,
    "Prefer":        "return=representation"
  };
}

// ─── LOW-LEVEL HELPERS ───
function sbGet(table, query) {
  query = query || '';
  return fetch(SUPABASE_URL + '/rest/v1/' + table + '?' + query, { headers: _sbH() })
    .then(function(r) {
      if (!r.ok) return r.text().then(function(t) { throw new Error('sbGet ' + table + ': ' + t); });
      return r.json();
    });
}

function sbPost(table, body) {
  return fetch(SUPABASE_URL + '/rest/v1/' + table, {
    method: 'POST', headers: _sbH(), body: JSON.stringify(body)
  }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error('sbPost ' + table + ': ' + t); });
    return r.json();
  });
}

function sbPatch(table, query, body) {
  return fetch(SUPABASE_URL + '/rest/v1/' + table + '?' + query, {
    method: 'PATCH', headers: _sbH(), body: JSON.stringify(body)
  }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error('sbPatch ' + table + ': ' + t); });
    return r.json();
  });
}

function sbDelete(table, query) {
  return fetch(SUPABASE_URL + '/rest/v1/' + table + '?' + query, {
    method: 'DELETE', headers: _sbH()
  }).then(function(r) { return r.ok; });
}

// ─── GENERATE ID (sama dengan GAS) ───
function generateId(service, tujuan, type) {
  var svcCode = (service || '').replace(/[^A-Z0-9]/gi, '').substring(0, 3).toUpperCase();
  var tujCode = (tujuan  || '').replace(/\s+/g, '_').replace(/[^A-Z0-9_]/gi, '').substring(0, 8).toUpperCase();
  var now  = new Date();
  var pad  = function(n) { return n < 10 ? '0' + n : '' + n; };
  var date = '' + now.getFullYear() + pad(now.getMonth()+1) + pad(now.getDate());
  var ms   = now.getTime().toString().slice(-4);
  var rnd  = Math.random().toString(36).substring(2, 5).toUpperCase();
  return type + '_' + svcCode + '_' + tujCode + '_' + date + '_' + ms + rnd;
}

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

// ─── gasGet / gasPost — PENGGANTI drop-in ke Supabase ───
// Semua kode lama yang memanggil gasGet/gasPost otomatis teredirect
// ke Supabase tanpa perlu mengubah views.js, filter.js, forms.js, dll

function gasGet(action, params) {
  params = params || {};
  switch (action) {
    case 'getMasterData':
      return _sbGetMasterData();

    case 'getObList':
      return sbGet('ob', 'select=*&order=created_date.desc')
        .then(function(rows) { return { list: _mapObRows(rows || []) }; });

    case 'getHvsList':
      return sbGet('hvs', 'select=*&order=created_date.desc')
        .then(function(rows) { return { list: _mapHvsRows(rows || []) }; });

    case 'getIbList':
      return sbGet('ib', 'select=*&order=created_date.desc')
        .then(function(rows) { return { list: _mapIbRows(rows || []) }; });

    case 'getObFull':
    case 'getObibFull':
      return _sbGetFull('ob');

    case 'getHvsFull':
      return _sbGetFull('hvs');

    case 'getIbFull':
      return _sbGetFull('ib');

    case 'getAwbList':
      return _sbGetAwbList(params);

    case 'getDetail':
      return _sbGetDetail(params);

    case 'getAllScanAwbs':
      return _sbGetAllScanAwbs();

    case 'searchAwb':
      return _sbSearchAwb(params);

    // Manifest & OBIB — web-only fitur, masih ada GAS fallback
    // karena tabel manifest di Supabase perlu setup manual.
    // Kalau kamu tidak pakai fitur ini, bisa return error biasa.
    case 'getManifestData':
    case 'getManifest':
    case 'getOBIB':
      return _sbGetManifestOrObib(action, params);

    default:
      console.warn('[gasGet] Unknown action:', action);
      return Promise.resolve({ error: 'Unknown action: ' + action });
  }
}

function gasPost(action, data) {
  data = data || {};
  switch (action) {
    case 'saveOb':          return _sbSaveOb(data);
    case 'saveHvs':         return _sbSaveHvs(data);
    case 'saveIb':          return _sbSaveIb(data);
    case 'addAwbToTrack':   return _sbAddAwbToTrack(data);
    case 'updateObStatus':  return sbPatch('ob',  'no_track=eq.' + encodeURIComponent(data.noTrack), { status: data.newStatus }).then(function() { return { success: true }; });
    case 'updateHvsStatus': return sbPatch('hvs', 'no_track=eq.' + encodeURIComponent(data.noTrack), { status: data.newStatus }).then(function() { return { success: true }; });
    case 'updateIbStatus':  return sbPatch('ib',  'no_track=eq.' + encodeURIComponent(data.noTrack), { status: data.newStatus }).then(function() { return { success: true }; });
    case 'deleteOb':        return _sbDelete('ob',  'scan_ob',  data.noTrack);
    case 'deleteHvs':       return _sbDelete('hvs', 'scan_hvs', data.noTrack);
    case 'deleteIb':        return _sbDelete('ib',  'scan_ib',  data.noTrack);
    case 'uploadFoto':
    case 'updateFoto':      return _sbUploadFoto(data);
    default:
      console.warn('[gasPost] Unknown action:', action);
      return Promise.resolve({ error: 'Unknown action: ' + action });
  }
}

// ─── IMPLEMENTATION DETAIL ───

function _sbGetMasterData() {
  return sbGet('data_master', 'select=*').then(function(rows) {
    var obMap = {}, ibMap = {};
    (rows || []).forEach(function(r) {
      if (r.incharge && r.service && r.tujuan) {
        if (!obMap[r.incharge]) obMap[r.incharge] = { services: {}, tujuans: {} };
        obMap[r.incharge].services[r.service] = true;
        obMap[r.incharge].tujuans[r.tujuan]   = true;
      }
      if (r.ib_incharge && r.ib_service) {
        if (!ibMap[r.ib_incharge]) ibMap[r.ib_incharge] = { services: {}, froms: {}, tujuans: {} };
        ibMap[r.ib_incharge].services[r.ib_service] = true;
        if (r.ib_from)  ibMap[r.ib_incharge].froms[r.ib_from]     = true;
        if (r.ib_tujuan) ibMap[r.ib_incharge].tujuans[r.ib_tujuan] = true;
      }
    });
    var obIncharges = Object.keys(obMap).sort();
    var ibIncharges = Object.keys(ibMap).sort();
    var obData2 = {}, ibData2 = {};
    obIncharges.forEach(function(k) {
      obData2[k] = { services: Object.keys(obMap[k].services).sort(), tujuans: Object.keys(obMap[k].tujuans).sort() };
    });
    ibIncharges.forEach(function(k) {
      ibData2[k] = { services: Object.keys(ibMap[k].services).sort(), froms: Object.keys(ibMap[k].froms).sort(), tujuans: Object.keys(ibMap[k].tujuans).sort() };
    });
    return { obIncharges: obIncharges, ibIncharges: ibIncharges, obData: obData2, ibData: ibData2 };
  });
}

function _mapObRows(rows) {
  return rows.map(function(r) {
    var obj = {
      no_track: r.no_track, incharge: r.incharge, service: r.service, tujuan: r.tujuan,
      created_date: r.created_date, status: r.status, total_awb: r.total_awb || 0,
      foto_url: r.foto_url_1 || ''
    };
    if (r.foto_url_2) obj.foto_url_2 = r.foto_url_2;
    if (r.foto_url_3) obj.foto_url_3 = r.foto_url_3;
    if (r.foto_url_4) obj.foto_url_4 = r.foto_url_4;
    if (r.foto_url_5) obj.foto_url_5 = r.foto_url_5;
    return obj;
  });
}

function _mapHvsRows(rows) { return _mapObRows(rows); }

function _mapIbRows(rows) {
  return rows.map(function(r) {
    var obj = {
      no_track: r.no_track, incharge: r.incharge, service: r.service,
      from: r.ib_from, tujuan: r.tujuan,
      created_date: r.created_date, status: r.status, total_awb: r.total_awb || 0,
      foto_url: r.foto_url_1 || ''
    };
    if (r.foto_url_2) obj.foto_url_2 = r.foto_url_2;
    if (r.foto_url_3) obj.foto_url_3 = r.foto_url_3;
    return obj;
  });
}

function _sbGetFull(type) {
  var parentTable = type === 'ib' ? 'ib' : type === 'hvs' ? 'hvs' : 'ob';
  var scanTable   = type === 'ib' ? 'scan_ib' : type === 'hvs' ? 'scan_hvs' : 'scan_ob';
  return Promise.all([
    sbGet(parentTable, 'select=*&order=created_date.desc'),
    sbGet(scanTable,   'select=no_track,awb')
  ]).then(function(results) {
    var rows     = results[0] || [];
    var scanRows = results[1] || [];
    var awbMap   = {};
    scanRows.forEach(function(s) {
      if (!awbMap[s.no_track]) awbMap[s.no_track] = [];
      if (s.awb) awbMap[s.no_track].push(s.awb);
    });
    var list = (type === 'ib' ? _mapIbRows(rows) : _mapObRows(rows)).map(function(item) {
      item.awbs = awbMap[item.no_track] || [];
      return item;
    });
    return { list: list };
  });
}

function _sbGetAwbList(params) {
  var noTrack = params.noTrack;
  var type    = (params.type || 'OB').toUpperCase();
  var table   = type === 'IB' ? 'scan_ib' : type === 'HVS' ? 'scan_hvs' : 'scan_ob';
  return sbGet(table, 'no_track=eq.' + encodeURIComponent(noTrack) + '&select=awb,tujuan,ib_from')
    .then(function(rows) {
      return {
        list: (rows || []).map(function(r) {
          var o = { awb: r.awb, tujuan: r.tujuan };
          if (type === 'IB') o.from = r.ib_from;
          return o;
        })
      };
    });
}

function _sbGetDetail(params) {
  var noTrack  = params.noTrack;
  var type     = (params.type || 'OB').toUpperCase();
  var scanTbl  = type === 'IB' ? 'scan_ib' : type === 'HVS' ? 'scan_hvs' : 'scan_ob';
  var parentTbl = type === 'IB' ? 'ib' : type === 'HVS' ? 'hvs' : 'ob';
  var ntEnc    = encodeURIComponent(noTrack);
  return Promise.all([
    sbGet(scanTbl,  'no_track=eq.' + ntEnc + '&select=awb'),
    sbGet(parentTbl,'no_track=eq.' + ntEnc + '&select=foto_url_1,foto_url_2,foto_url_3,foto_url_4,foto_url_5')
  ]).then(function(res) {
    var awbs   = (res[0] || []).map(function(r) { return r.awb; }).filter(Boolean);
    var p      = (res[1] || [])[0] || {};
    var photos = [p.foto_url_1, p.foto_url_2, p.foto_url_3, p.foto_url_4, p.foto_url_5].filter(Boolean);
    return { awbs: awbs, photos: photos };
  });
}

function _sbGetAllScanAwbs() {
  return Promise.all([
    sbGet('scan_ob',  'select=no_track,incharge,scan_date,awb,service,tujuan'),
    sbGet('scan_hvs', 'select=no_track,incharge,scan_date,awb,service,tujuan'),
    sbGet('scan_ib',  'select=no_track,incharge,scan_date,awb,tujuan,service,ib_from')
  ]).then(function(res) {
    var list = [];
    (res[0] || []).forEach(function(r) { if (r.awb) list.push({ awb: r.awb, no_track: r.no_track, incharge: r.incharge, date: r.scan_date, service: r.service, tujuan: r.tujuan, from: '', type: 'ob' }); });
    (res[1] || []).forEach(function(r) { if (r.awb) list.push({ awb: r.awb, no_track: r.no_track, incharge: r.incharge, date: r.scan_date, service: r.service, tujuan: r.tujuan, from: '', type: 'hvs' }); });
    (res[2] || []).forEach(function(r) { if (r.awb) list.push({ awb: r.awb, no_track: r.no_track, incharge: r.incharge, date: r.scan_date, service: r.service, tujuan: r.tujuan, from: r.ib_from, type: 'ib' }); });
    return { list: list };
  });
}

function _sbSearchAwb(params) {
  var q = (params.q || '').trim();
  if (!q) return Promise.resolve({ list: [] });
  var enc = encodeURIComponent(q);
  return Promise.all([
    sbGet('scan_ob',  'awb=ilike.*' + enc + '*&select=no_track,incharge,scan_date,awb,service,tujuan'),
    sbGet('scan_hvs', 'awb=ilike.*' + enc + '*&select=no_track,incharge,scan_date,awb,service,tujuan'),
    sbGet('scan_ib',  'awb=ilike.*' + enc + '*&select=no_track,incharge,scan_date,awb,tujuan,service,ib_from')
  ]).then(function(res) {
    var list = [];
    (res[0] || []).forEach(function(r) { list.push({ awb: r.awb, noTrack: r.no_track, incharge: r.incharge, date: r.scan_date, service: r.service, tujuan: r.tujuan, from: '', type: 'ob', status: '' }); });
    (res[1] || []).forEach(function(r) { list.push({ awb: r.awb, noTrack: r.no_track, incharge: r.incharge, date: r.scan_date, service: r.service, tujuan: r.tujuan, from: '', type: 'hvs', status: '' }); });
    (res[2] || []).forEach(function(r) { list.push({ awb: r.awb, noTrack: r.no_track, incharge: r.incharge, date: r.scan_date, service: r.service, tujuan: r.tujuan, from: r.ib_from, type: 'ib', status: '' }); });
    return { list: list };
  });
}

function _sbSaveOb(data) {
  var noTrack = generateId(data.service, data.tujuan, 'OB');
  var now     = new Date().toISOString();
  return sbPost('ob', {
    no_track: noTrack, incharge: data.incharge, service: data.service, tujuan: data.tujuan,
    created_date: now, status: 'ON PROSES', total_awb: 0
  }).then(function() {
    var awbs = data.awbList || [];
    if (!awbs.length) return { success: true, noTrack: noTrack };
    return sbPost('scan_ob', awbs.map(function(awb) {
      return { no_track: noTrack, incharge: data.incharge, scan_date: now, awb: awb, status: 'ON PROSES', service: data.service, tujuan: data.tujuan };
    })).then(function() {
      return sbPatch('ob', 'no_track=eq.' + encodeURIComponent(noTrack), { total_awb: awbs.length });
    }).then(function() { return { success: true, noTrack: noTrack }; });
  });
}

function _sbSaveHvs(data) {
  var noTrack = generateId(data.service, data.tujuan, 'HVS');
  var now     = new Date().toISOString();
  return sbPost('hvs', {
    no_track: noTrack, incharge: data.incharge, service: data.service, tujuan: data.tujuan,
    created_date: now, status: 'ON PROSES', total_awb: 0
  }).then(function() {
    var awbs = data.awbList || [];
    if (!awbs.length) return { success: true, noTrack: noTrack };
    return sbPost('scan_hvs', awbs.map(function(awb) {
      return { no_track: noTrack, incharge: data.incharge, scan_date: now, awb: awb, status: 'ON PROSES', service: data.service, tujuan: data.tujuan };
    })).then(function() {
      return sbPatch('hvs', 'no_track=eq.' + encodeURIComponent(noTrack), { total_awb: awbs.length });
    }).then(function() { return { success: true, noTrack: noTrack }; });
  });
}

function _sbSaveIb(data) {
  var noTrack = generateId(data.service, data.tujuan, 'IB');
  var now     = new Date().toISOString();
  return sbPost('ib', {
    no_track: noTrack, incharge: data.incharge, service: data.service, ib_from: data.from, tujuan: data.tujuan,
    created_date: now, status: 'ON PROSES', total_awb: 0
  }).then(function() {
    var awbs = data.awbList || [];
    if (!awbs.length) return { success: true, noTrack: noTrack };
    return sbPost('scan_ib', awbs.map(function(awb) {
      return { no_track: noTrack, incharge: data.incharge, scan_date: now, awb: awb, tujuan: data.tujuan, status: 'ON PROSES', service: data.service, ib_from: data.from };
    })).then(function() {
      return sbPatch('ib', 'no_track=eq.' + encodeURIComponent(noTrack), { total_awb: awbs.length });
    }).then(function() { return { success: true, noTrack: noTrack }; });
  });
}

function _sbAddAwbToTrack(data) {
  var type   = (data.type || 'OB').toUpperCase();
  var awbs   = data.awbList || [];
  if (!awbs.length) return Promise.resolve({ success: false, error: 'AWB list kosong' });

  var parentTable = type === 'OB' ? 'ob' : type === 'HVS' ? 'hvs' : 'ib';
  var scanTable   = type === 'OB' ? 'scan_ob' : type === 'HVS' ? 'scan_hvs' : 'scan_ib';
  var ntEnc       = encodeURIComponent(data.noTrack);

  return sbGet(parentTable, 'no_track=eq.' + ntEnc + '&select=*').then(function(parentRows) {
    var parent = (parentRows || [])[0];
    if (!parent) return { success: false, error: 'NO TRACK tidak ditemukan' };
    var now  = new Date().toISOString();
    var rows = awbs.map(function(awb) {
      var row = { no_track: data.noTrack, incharge: parent.incharge, scan_date: now, awb: awb, status: 'ON PROSES', service: parent.service, tujuan: parent.tujuan };
      if (type === 'IB') row.ib_from = parent.ib_from;
      return row;
    });
    return sbPost(scanTable, rows).then(function() {
      return sbGet(scanTable, 'no_track=eq.' + ntEnc + '&select=id');
    }).then(function(countRows) {
      return sbPatch(parentTable, 'no_track=eq.' + ntEnc, { total_awb: (countRows || []).length });
    }).then(function() { return { success: true, added: awbs.length }; });
  });
}

function _sbDelete(parentTable, scanTable, noTrack) {
  var ntEnc = encodeURIComponent(noTrack);
  return sbDelete(scanTable, 'no_track=eq.' + ntEnc)
    .then(function() { return sbDelete(parentTable, 'no_track=eq.' + ntEnc); })
    .then(function() { return { success: true }; });
}

function _sbUploadFoto(data) {
  var type      = (data.type || 'OB').toUpperCase();
  var photoIdx  = data.photoIndex != null ? parseInt(data.photoIndex, 10) : 0;
  var fileName  = type + '/' + data.noTrack + '_' + (photoIdx + 1) + '_' + Date.now() + '.jpg';

  var b64 = (data.base64Data || '');
  if (b64.indexOf(',') !== -1) b64 = b64.split(',')[1];

  var byteStr = atob(b64);
  var ab = new ArrayBuffer(byteStr.length);
  var ia = new Uint8Array(ab);
  for (var i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
  var blob = new Blob([ab], { type: 'image/jpeg' });

  return fetch(SUPABASE_URL + '/storage/v1/object/foto-gtw/' + fileName, {
    method: 'POST',
    headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY, "Content-Type": "image/jpeg" },
    body: blob
  }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { return { success: false, error: 'Upload gagal: ' + t }; });
    var publicUrl = SUPABASE_URL + '/storage/v1/object/public/foto-gtw/' + fileName;
    var parentTable = type === 'HVS' ? 'hvs' : type === 'IB' ? 'ib' : 'ob';
    var fotoCol = 'foto_url_' + (photoIdx + 1);
    var patch = {};
    patch[fotoCol] = publicUrl;
    return sbPatch(parentTable, 'no_track=eq.' + encodeURIComponent(data.noTrack), patch)
      .then(function() { return { success: true, url: publicUrl }; });
  });
}

// Manifest & OBIB: fitur desktop web yang membaca struktur header sheet khusus.
// Di Supabase tidak ada tabel manifest dinamis seperti di GSheet.
// Return error informatif — kamu bisa implementasi manual bila diperlukan.
function _sbGetManifestOrObib(action, params) {
  console.warn('[gasGet] ' + action + ': fitur ini membutuhkan implementasi khusus di Supabase. Lihat CATATAN_MIGRASI.md');
  return Promise.resolve({
    error: action + ' belum diimplementasi di Supabase. Gunakan tabel manifest yang diisi manual.',
    columns: [], headerRows: [], colDefs: [], awbRows: [], totalCols: 0,
    headerR1: [], headerR2: [], headerR3: [], headerR4: [], dataRows: [], ibSections: []
  });
}

// ─── UI HELPERS ─── (tidak berubah dari versi GAS)
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

// ─── SMART COMBOBOX ─── (tidak berubah — copy persis dari versi GAS)
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
