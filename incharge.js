/* ============================================================
   GTW BDO — incharge.js v4.2
   Global incharge, page switching, CB options
   ============================================================ */

// ─── INCHARGE ───
function populateGlobalIncharge() {
  var combined = (masterData.obIncharges || []).slice();
  (masterData.ibIncharges || []).forEach(function(v) { if (combined.indexOf(v) === -1) combined.push(v); });
  allIncharges = combined.sort();
  initGlobalCb(allIncharges);
  if (globalIncharge) {
    document.getElementById('globalInchargeInput').value = globalIncharge;
    document.getElementById('inchargeDot').classList.add('on');
  }
}

function selectGlobalIncharge(v) {
  globalIncharge = v;
  document.getElementById('globalInchargeInput').value = v;
  document.getElementById('globalSmartCb').classList.remove('open');
  document.getElementById('inchargeDot').classList.toggle('on', !!v);
  if (cbRegistry['globalSmartCb']) cbRegistry['globalSmartCb'].value = v;
  buildCbOptions();
  refreshAllFormIncharges();
  renderObTable(); renderHvsTable(); renderIbTable();
  updateObStats(); updateHvsStats(); updateIbStats();
}

// ─── PAGE SWITCHING ───
var pageTitles = {
  ob: 'Outbound BDO <span class="topbar-sub">Log pengiriman keluar dari hub</span>',
  hvs: 'Outbound HVS <span class="topbar-sub">High Value Shipment keluar</span>',
  ib: 'Inbound HVS <span class="topbar-sub">High Value Shipment masuk</span>',
  manifest: 'Manifest <span class="topbar-sub">Rekap AWB per incharge & tujuan — layout GSheet</span>',
  obib: 'OB &amp; IB <span class="topbar-sub">Combined view — mengikuti struktur header sheet</span>',
  search: 'Cari AWB <span class="topbar-sub">Pencarian AWB di semua data OB, HVS, IB</span>'
};
var pages = ['ob', 'hvs', 'ib', 'manifest', 'obib', 'search'];

function switchPage(page) {
  pages.forEach(function(p) {
    document.getElementById('page-' + p).style.display = (p === page) ? '' : 'none';
    var n = document.getElementById('nav-' + p);
    if (n) n.classList.toggle('active', p === page);
  });
  document.getElementById('topbarTitle').innerHTML = pageTitles[page] || page;
  if (page === 'manifest') loadManifestPage();
  if (page === 'obib') renderObibPage();
  if (page === 'search') setTimeout(function() { document.getElementById('searchAwbMainInput').focus(); }, 100);
}

// ─── CB OPTIONS ───
var cbOptions = { ob: { service: [], tujuan: [] }, hvs: { service: [], tujuan: [] }, ib: { service: [], from: [], tujuan: [] } };

function buildCbOptions() {
  var d = (masterData.obData || {})[globalIncharge] || {};
  cbOptions.ob.service = d.services || []; cbOptions.ob.tujuan = d.tujuans || [];
  cbOptions.hvs.service = d.services || []; cbOptions.hvs.tujuan = d.tujuans || [];
  var ib = (masterData.ibData || {})[globalIncharge] || {};
  cbOptions.ib.service = ib.services || []; cbOptions.ib.from = ib.froms || []; cbOptions.ib.tujuan = ib.tujuans || [];
  if (cbRegistry['obServiceCb']) updateCbOptions('obServiceCb', cbOptions.ob.service);
  if (cbRegistry['obTujuanCb']) updateCbOptions('obTujuanCb', cbOptions.ob.tujuan);
  if (cbRegistry['hvsServiceCb']) updateCbOptions('hvsServiceCb', cbOptions.hvs.service);
  if (cbRegistry['hvsTujuanCb']) updateCbOptions('hvsTujuanCb', cbOptions.hvs.tujuan);
  if (cbRegistry['ibServiceCb']) updateCbOptions('ibServiceCb', cbOptions.ib.service);
  if (cbRegistry['ibFromCb']) updateCbOptions('ibFromCb', cbOptions.ib.from);
  if (cbRegistry['ibTujuanCb']) updateCbOptions('ibTujuanCb', cbOptions.ib.tujuan);
}

function initAllCbs() {
  registerCb('obServiceCb', 'obService', 'obServiceDrop', cbOptions.ob.service, function(v) { onObServiceSelect(v); });
  registerCb('obTujuanCb', 'obTujuan', 'obTujuanDrop', cbOptions.ob.tujuan, function(v) { if (v && !obScanMap[v]) initObTujuan(v); checkObForm(); });
  registerCb('hvsServiceCb', 'hvsService', 'hvsServiceDrop', cbOptions.hvs.service, function(v) { onHvsServiceSelect(v); });
  registerCb('hvsTujuanCb', 'hvsTujuan', 'hvsTujuanDrop', cbOptions.hvs.tujuan, function(v) { if (v && !hvsScanMap[v]) initHvsTujuan(v); checkHvsForm(); });
  registerCb('ibServiceCb', 'ibService', 'ibServiceDrop', cbOptions.ib.service, function(v) { onIbServiceSelect(v); });
  registerCb('ibFromCb', 'ibFrom', 'ibFromDrop', cbOptions.ib.from, function() { checkIbScanReady(); checkIbForm(); });
  registerCb('ibTujuanCb', 'ibTujuan', 'ibTujuanDrop', cbOptions.ib.tujuan, function() { checkIbScanReady(); checkIbForm(); });
  registerCb('newTujuanCb', 'newTujuanInput', 'newTujuanDrop', [], function() { });
}

// ─── SERVICE SELECT HANDLERS ───
function onObServiceSelect(v) {
  var has = !!v;
  setCbDisabled('obTujuanCb', !has);
  document.getElementById('obTujuan').placeholder = has ? 'Ketik / pilih...' : 'Pilih service dulu...';
  document.getElementById('obScanInput').disabled = !has || !obActiveTuj;
  document.getElementById('obAddTujBtn').disabled = !has;
  document.getElementById('obServiceHint').style.display = has ? 'none' : '';
  if (cbRegistry['obTujuanCb']) { cbRegistry['obTujuanCb'].value = ''; document.getElementById('obTujuan').value = ''; }
  obScanMap = {}; obActiveTuj = '';
  document.getElementById('obTujuanTabs').innerHTML = '';
  document.getElementById('obScanList').innerHTML = '<div class="scan-empty">Pilih tujuan terlebih dahulu</div>';
  updateObTotalLabel(); checkObForm();
}

function onHvsServiceSelect(v) {
  var has = !!v;
  setCbDisabled('hvsTujuanCb', !has);
  document.getElementById('hvsTujuan').placeholder = has ? 'Ketik / pilih...' : 'Pilih service dulu...';
  document.getElementById('hvsScanInput').disabled = !has || !hvsActiveTuj;
  document.getElementById('hvsAddTujBtn').disabled = !has;
  document.getElementById('hvsServiceHint').style.display = has ? 'none' : '';
  if (cbRegistry['hvsTujuanCb']) { cbRegistry['hvsTujuanCb'].value = ''; document.getElementById('hvsTujuan').value = ''; }
  hvsScanMap = {}; hvsActiveTuj = '';
  document.getElementById('hvsTujuanTabs').innerHTML = '';
  document.getElementById('hvsScanList').innerHTML = '<div class="scan-empty">Pilih tujuan terlebih dahulu</div>';
  updateHvsTotalLabel(); checkHvsForm();
}

function onIbServiceSelect(v) {
  var has = !!v;
  setCbDisabled('ibFromCb', !has); setCbDisabled('ibTujuanCb', !has);
  document.getElementById('ibFrom').placeholder = has ? 'Ketik / pilih...' : 'Pilih service dulu...';
  document.getElementById('ibTujuan').placeholder = has ? 'Ketik / pilih...' : 'Pilih service dulu...';
  document.getElementById('ibServiceHint').style.display = has ? 'none' : '';
  if (cbRegistry['ibFromCb']) { cbRegistry['ibFromCb'].value = ''; document.getElementById('ibFrom').value = ''; }
  if (cbRegistry['ibTujuanCb']) { cbRegistry['ibTujuanCb'].value = ''; document.getElementById('ibTujuan').value = ''; }
  ibScanned = []; renderIbScanList(); checkIbScanReady(); checkIbForm();
}

function checkIbScanReady() {
  var svc = document.getElementById('ibService').value;
  var from = document.getElementById('ibFrom').value;
  var tuj = document.getElementById('ibTujuan').value;
  var ready = !!(svc && from && tuj);
  var scanInp = document.getElementById('ibScanInput');
  var hint = document.getElementById('ibScanHint');
  scanInp.disabled = !ready;
  if (svc && !ready) { scanInp.placeholder = 'Isi FROM & TUJUAN dulu...'; if (hint) hint.style.display = ''; }
  else if (!svc) { scanInp.placeholder = 'Pilih service dulu...'; if (hint) hint.style.display = 'none'; }
  else { scanInp.placeholder = 'Scan nomor AWB...'; if (hint) hint.style.display = 'none'; }
}

// ─── FORM INCHARGE ───
function refreshAllFormIncharges() { ['ob', 'hvs', 'ib'].forEach(function(t) { refreshFormIncharge(t); }); }

function refreshFormIncharge(t) {
  var has = !!globalIncharge;
  document.getElementById(t + 'InfoBar').style.display = has ? '' : 'none';
  document.getElementById(t + 'WarnBar').style.display = has ? 'none' : '';
  document.getElementById(t + 'FormGrid').style.display = has ? '' : 'none';
  document.getElementById(t + 'ScanSection').style.display = has ? '' : 'none';
  document.getElementById(t + 'FormActions').style.display = has ? '' : 'none';
  if (has) document.getElementById(t + 'InchargeDisplay').innerText = globalIncharge;
  if (has) {
    document.getElementById(t + 'ServiceHint').style.display = '';
    if (t === 'ob' || t === 'hvs') {
      setCbDisabled(t + 'TujuanCb', true);
      document.getElementById(t + 'ScanInput').disabled = true;
      if (document.getElementById(t + 'AddTujBtn')) document.getElementById(t + 'AddTujBtn').disabled = true;
    } else {
      setCbDisabled('ibFromCb', true); setCbDisabled('ibTujuanCb', true);
      document.getElementById('ibScanInput').disabled = true;
      var hint = document.getElementById('ibScanHint'); if (hint) hint.style.display = 'none';
    }
  }
  if (t === 'ob') checkObForm();
  else if (t === 'hvs') checkHvsForm();
  else checkIbForm();
}

function toggleForm(type) {
  var body = document.getElementById(type + 'FormBody');
  var icon = document.getElementById(type + 'FormIcon');
  var open = body.classList.toggle('open');
  icon.innerText = open ? 'expand_less' : 'expand_more';
  if (open) refreshFormIncharge(type);
}

function checkObForm() { var hasService = !!(document.getElementById('obService') && document.getElementById('obService').value); var hasTuj = Object.keys(obScanMap).length > 0; document.getElementById('btnSaveOb').disabled = !(globalIncharge && hasService && hasTuj); }
function checkHvsForm() { var hasService = !!(document.getElementById('hvsService') && document.getElementById('hvsService').value); var hasTuj = Object.keys(hvsScanMap).length > 0; document.getElementById('btnSaveHvs').disabled = !(globalIncharge && hasService && hasTuj); }
function checkIbForm() { var svc = document.getElementById('ibService').value; var from = document.getElementById('ibFrom').value; var tuj = document.getElementById('ibTujuan').value; document.getElementById('btnSaveIb').disabled = !(globalIncharge && svc && from && tuj); }

// ─── STATS ───
function filteredData(arr) { if (!globalIncharge) return arr; return arr.filter(function(d) { return d.incharge === globalIncharge; }); }
function updateObStats() { var d = filteredData(obData); var t = d.reduce(function(s, x) { return s + (+x.total_awb || 0); }, 0); var s = d.filter(function(x) { return x.status === 'SELESAI'; }).length; document.getElementById('obTotalAwb').innerText = t; document.getElementById('obSelesai').innerText = s; document.getElementById('obProses').innerText = d.length - s; }
function updateHvsStats() { var d = filteredData(hvsData); var t = d.reduce(function(s, x) { return s + (+x.total_awb || 0); }, 0); var s = d.filter(function(x) { return x.status === 'SELESAI'; }).length; document.getElementById('hvsTotalAwb').innerText = t; document.getElementById('hvsSelesai').innerText = s; document.getElementById('hvsProses').innerText = d.length - s; }
function updateIbStats() { var d = filteredData(ibData); var t = d.reduce(function(s, x) { return s + (+x.total_awb || 0); }, 0); var s = d.filter(function(x) { return x.status === 'SELESAI'; }).length; document.getElementById('ibTotalAwb').innerText = t; document.getElementById('ibSelesai').innerText = s; document.getElementById('ibProses').innerText = d.length - s; }