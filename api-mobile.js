// ════════════════════════════════════════════
// API — Google Apps Script communication
// ════════════════════════════════════════════

const API = {
  get(action, params = {}) {
    const url = new URL(CONFIG.GAS_URL);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return fetch(url.toString(), { redirect: 'follow', mode: 'cors' }).then(r => r.json());
  },

  post(action, data = {}) {
    data.action = action;
    return fetch(CONFIG.GAS_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(data)
    }).then(r => r.json());
  },

  // Upload foto ke Drive — photoIndex menentukan kolom tujuan (0=kolom pertama, 1=berikutnya, dst)
  uploadFoto(noTrack, type, base64Data, photoIndex = 0) {
    return API.post('uploadFoto', {
      noTrack,
      type,
      base64Data,
      folderId: CONFIG.DRIVE_FOLDER_ID,
      photoIndex   // dikirim ke backend agar tahu kolom mana yang diisi
    });
  }
};

// ════════════════════════════════════════════
// DATA LOADER
// ════════════════════════════════════════════
const DataLoader = {
  async loadMaster() {
    const r = await API.get('getMasterData');
    STATE.masterData = r || {};
    DataLoader._buildIncharges();
    DataLoader._buildCbOptions();
  },

  async loadLists() {
    const [ob, hvs, ib] = await Promise.all([
      API.get('getObList'),
      API.get('getHvsList'),
      API.get('getIbList'),
    ]);
    STATE.obData  = ob.list  || [];
    STATE.hvsData = hvs.list || [];
    STATE.ibData  = ib.list  || [];
  },

  async loadScanAwbs() {
    try {
      const r = await API.get('getAllScanAwbs');
      if (r && r.list) STATE.allScanAwbs = r.list;
    } catch(e) {}
  },

  async reloadAll() {
    await DataLoader.loadLists();
    DataLoader.loadScanAwbs();
  },

  _buildIncharges() {
    const all = [...(STATE.masterData.obIncharges || [])];
    (STATE.masterData.ibIncharges || []).forEach(v => { if (!all.includes(v)) all.push(v); });
    STATE.allIncharges = all.sort();
  },

  _buildCbOptions() {
    const ic = STATE.globalIncharge;
    const ob = (STATE.masterData.obData || {})[ic] || {};
    UI.Scb.setOptions('scbSvc',    ob.services || []);
    UI.Scb.setOptions('scbTuj',    ob.tujuans  || []);
    const ib = (STATE.masterData.ibData || {})[ic] || {};
    UI.Scb.setOptions('scbIbSvc',  ib.services || []);
    UI.Scb.setOptions('scbIbFrom', ib.froms    || []);
    UI.Scb.setOptions('scbIbTuj',  ib.tujuans  || []);
  }
};
