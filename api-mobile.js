// ════════════════════════════════════════════
// API — Supabase REST (pengganti Google Apps Script)
// GTW BDO Mobile v4.0
// ════════════════════════════════════════════

// ── Headers Supabase ──
function _sbHeaders() {
  return {
    "Content-Type":  "application/json",
    "apikey":        CONFIG.SUPABASE_KEY,
    "Authorization": "Bearer " + CONFIG.SUPABASE_KEY,
    "Prefer":        "return=representation"
  };
}

// ── Helper: GET dari Supabase REST ──
async function sbGet(table, query = "") {
  const res = await fetch(
    `${CONFIG.SUPABASE_URL}/rest/v1/${table}?${query}`,
    { headers: _sbHeaders() }
  );
  if (!res.ok) throw new Error(`sbGet ${table} HTTP ${res.status}`);
  return res.json();
}

// ── Helper: POST (insert) ──
async function sbPost(table, body) {
  const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: _sbHeaders(),
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`sbPost ${table}: ${txt}`);
  }
  return res.json();
}

// ── Helper: PATCH (update) ──
async function sbPatch(table, query, body) {
  const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: _sbHeaders(),
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`sbPatch ${table}: ${txt}`);
  }
  return res.json();
}

// ── Helper: DELETE ──
async function sbDelete(table, query) {
  const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "DELETE",
    headers: _sbHeaders()
  });
  return res.ok;
}

// ── Generate ID (sama persis dengan GAS generateId) ──
function generateId(service, tujuan, type) {
  const svcCode = (service || '').replace(/[^A-Z0-9]/gi, '').substring(0, 3).toUpperCase();
  const tujCode = (tujuan  || '').replace(/\s+/g, '_').replace(/[^A-Z0-9_]/gi, '').substring(0, 8).toUpperCase();
  const now     = new Date();
  const pad     = n => String(n).padStart(2, '0');
  const date    = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`;
  const ms      = now.getTime().toString().slice(-4);
  const rnd     = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${type}_${svcCode}_${tujCode}_${date}_${ms}${rnd}`;
}

// ════════════════════════════════════════════
// API OBJECT — drop-in pengganti versi GAS
// Semua method async, return format sama persis
// ════════════════════════════════════════════
const API = {

  // ── getMasterData ──
  // Dulu: API.get('getMasterData')
  async getMasterData() {
    const rows = await sbGet("data_master", "select=*");
    const obMap = {}, ibMap = {};
    (rows || []).forEach(r => {
      const { incharge, service, tujuan, ib_incharge, ib_service, ib_from, ib_tujuan } = r;
      if (incharge && service && tujuan) {
        if (!obMap[incharge]) obMap[incharge] = { services: {}, tujuans: {} };
        obMap[incharge].services[service] = true;
        obMap[incharge].tujuans[tujuan]   = true;
      }
      if (ib_incharge && ib_service) {
        if (!ibMap[ib_incharge]) ibMap[ib_incharge] = { services: {}, froms: {}, tujuans: {} };
        ibMap[ib_incharge].services[ib_service] = true;
        if (ib_from)  ibMap[ib_incharge].froms[ib_from]     = true;
        if (ib_tujuan) ibMap[ib_incharge].tujuans[ib_tujuan] = true;
      }
    });
    const obIncharges = Object.keys(obMap).sort();
    const ibIncharges = Object.keys(ibMap).sort();
    const obData = {}, ibData = {};
    obIncharges.forEach(k => {
      obData[k] = {
        services: Object.keys(obMap[k].services).sort(),
        tujuans:  Object.keys(obMap[k].tujuans).sort()
      };
    });
    ibIncharges.forEach(k => {
      ibData[k] = {
        services: Object.keys(ibMap[k].services).sort(),
        froms:    Object.keys(ibMap[k].froms).sort(),
        tujuans:  Object.keys(ibMap[k].tujuans).sort()
      };
    });
    return { obIncharges, ibIncharges, obData, ibData };
  },

  // ── getObList ──
  async getObList() {
    const rows = await sbGet("ob", "select=*&order=created_date.desc");
    return {
      list: (rows || []).map(r => ({
        no_track:    r.no_track,
        incharge:    r.incharge,
        service:     r.service,
        tujuan:      r.tujuan,
        created_date: r.created_date,
        status:      r.status,
        total_awb:   r.total_awb,
        foto_url:    r.foto_url_1,
        foto_url_2:  r.foto_url_2,
        foto_url_3:  r.foto_url_3,
        foto_url_4:  r.foto_url_4,
        foto_url_5:  r.foto_url_5
      }))
    };
  },

  // ── getHvsList ──
  async getHvsList() {
    const rows = await sbGet("hvs", "select=*&order=created_date.desc");
    return {
      list: (rows || []).map(r => ({
        no_track:    r.no_track,
        incharge:    r.incharge,
        service:     r.service,
        tujuan:      r.tujuan,
        created_date: r.created_date,
        status:      r.status,
        total_awb:   r.total_awb,
        foto_url:    r.foto_url_1,
        foto_url_2:  r.foto_url_2,
        foto_url_3:  r.foto_url_3
      }))
    };
  },

  // ── getIbList ──
  async getIbList() {
    const rows = await sbGet("ib", "select=*&order=created_date.desc");
    return {
      list: (rows || []).map(r => ({
        no_track:    r.no_track,
        incharge:    r.incharge,
        service:     r.service,
        from:        r.ib_from,
        tujuan:      r.tujuan,
        created_date: r.created_date,
        status:      r.status,
        total_awb:   r.total_awb,
        foto_url:    r.foto_url_1,
        foto_url_2:  r.foto_url_2,
        foto_url_3:  r.foto_url_3
      }))
    };
  },

  // ── getAwbList ──
  async getAwbList({ noTrack, type = "OB" }) {
    const table = type === "OB" ? "scan_ob" : type === "IB" ? "scan_ib" : "scan_hvs";
    const rows  = await sbGet(table, `no_track=eq.${encodeURIComponent(noTrack)}&select=awb,tujuan,ib_from`);
    return {
      list: (rows || []).map(r => ({
        awb:    r.awb,
        tujuan: r.tujuan,
        ...(type === "IB" ? { from: r.ib_from } : {})
      }))
    };
  },

  // ── getDetail — AWB list + foto (dipakai pages-mobile.js di DetailPage) ──
  async getDetail({ noTrack, type = "OB" }) {
    const scanTable   = type === "OB" ? "scan_ob"  : type === "IB" ? "scan_ib"  : "scan_hvs";
    const parentTable = type === "OB" ? "ob"        : type === "IB" ? "ib"        : "hvs";

    const [scanRows, parentRows] = await Promise.all([
      sbGet(scanTable,   `no_track=eq.${encodeURIComponent(noTrack)}&select=awb`),
      sbGet(parentTable, `no_track=eq.${encodeURIComponent(noTrack)}&select=foto_url_1,foto_url_2,foto_url_3,foto_url_4,foto_url_5`)
    ]);

    const awbs   = (scanRows   || []).map(r => r.awb).filter(Boolean);
    const p      = (parentRows || [])[0] || {};
    const photos = [p.foto_url_1, p.foto_url_2, p.foto_url_3, p.foto_url_4, p.foto_url_5].filter(Boolean);
    return { awbs, photos };
  },

  // ── getAllScanAwbs ──
  async getAllScanAwbs() {
    const [obRows, hvsRows, ibRows] = await Promise.all([
      sbGet("scan_ob",  "select=no_track,incharge,scan_date,awb,service,tujuan"),
      sbGet("scan_hvs", "select=no_track,incharge,scan_date,awb,service,tujuan"),
      sbGet("scan_ib",  "select=no_track,incharge,scan_date,awb,tujuan,service,ib_from")
    ]);
    const list = [
      ...(obRows  || []).map(r => ({ ...r, from: '',        type: 'ob',  date: r.scan_date })),
      ...(hvsRows || []).map(r => ({ ...r, from: '',        type: 'hvs', date: r.scan_date })),
      ...(ibRows  || []).map(r => ({ ...r, from: r.ib_from, type: 'ib',  date: r.scan_date }))
    ].filter(r => r.awb);
    return { list };
  },

  // ── searchAwb ──
  async searchAwb({ q }) {
    if (!q) return { list: [] };
    const enc = encodeURIComponent(q);
    const [obRows, hvsRows, ibRows] = await Promise.all([
      sbGet("scan_ob",  `awb=ilike.*${enc}*&select=no_track,incharge,scan_date,awb,service,tujuan`),
      sbGet("scan_hvs", `awb=ilike.*${enc}*&select=no_track,incharge,scan_date,awb,service,tujuan`),
      sbGet("scan_ib",  `awb=ilike.*${enc}*&select=no_track,incharge,scan_date,awb,tujuan,service,ib_from`)
    ]);
    const list = [
      ...(obRows  || []).map(r => ({ ...r, from: '',        type: 'ob'  })),
      ...(hvsRows || []).map(r => ({ ...r, from: '',        type: 'hvs' })),
      ...(ibRows  || []).map(r => ({ ...r, from: r.ib_from, type: 'ib'  }))
    ];
    return { list };
  },

  // ── saveOb ──
  async saveOb(data) {
    const noTrack = generateId(data.service, data.tujuan, 'OB');
    const now     = new Date().toISOString();
    await sbPost("ob", {
      no_track: noTrack, incharge: data.incharge,
      service: data.service, tujuan: data.tujuan,
      created_date: now, status: 'ON PROSES', total_awb: 0
    });
    const awbs = data.awbList || [];
    if (awbs.length) {
      await sbPost("scan_ob", awbs.map(awb => ({
        no_track: noTrack, incharge: data.incharge, scan_date: now,
        awb, status: 'ON PROSES', service: data.service, tujuan: data.tujuan
      })));
      await sbPatch("ob", `no_track=eq.${encodeURIComponent(noTrack)}`, { total_awb: awbs.length });
    }
    return { success: true, noTrack };
  },

  // ── saveHvs ──
  async saveHvs(data) {
    const noTrack = generateId(data.service, data.tujuan, 'HVS');
    const now     = new Date().toISOString();
    await sbPost("hvs", {
      no_track: noTrack, incharge: data.incharge,
      service: data.service, tujuan: data.tujuan,
      created_date: now, status: 'ON PROSES', total_awb: 0
    });
    const awbs = data.awbList || [];
    if (awbs.length) {
      await sbPost("scan_hvs", awbs.map(awb => ({
        no_track: noTrack, incharge: data.incharge, scan_date: now,
        awb, status: 'ON PROSES', service: data.service, tujuan: data.tujuan
      })));
      await sbPatch("hvs", `no_track=eq.${encodeURIComponent(noTrack)}`, { total_awb: awbs.length });
    }
    return { success: true, noTrack };
  },

  // ── saveIb ──
  async saveIb(data) {
    const noTrack = generateId(data.service, data.tujuan, 'IB');
    const now     = new Date().toISOString();
    await sbPost("ib", {
      no_track: noTrack, incharge: data.incharge,
      service: data.service, ib_from: data.from, tujuan: data.tujuan,
      created_date: now, status: 'ON PROSES', total_awb: 0
    });
    const awbs = data.awbList || [];
    if (awbs.length) {
      await sbPost("scan_ib", awbs.map(awb => ({
        no_track: noTrack, incharge: data.incharge, scan_date: now,
        awb, tujuan: data.tujuan, status: 'ON PROSES',
        service: data.service, ib_from: data.from
      })));
      await sbPatch("ib", `no_track=eq.${encodeURIComponent(noTrack)}`, { total_awb: awbs.length });
    }
    return { success: true, noTrack };
  },

  // ── addAwbToTrack ──
  async addAwbToTrack(data) {
    const type   = (data.type || 'OB').toUpperCase();
    const awbs   = data.awbList || [];
    if (!awbs.length) return { success: false, error: 'AWB list kosong' };

    const parentTable = type === 'OB' ? 'ob' : type === 'HVS' ? 'hvs' : 'ib';
    const scanTable   = type === 'OB' ? 'scan_ob' : type === 'HVS' ? 'scan_hvs' : 'scan_ib';
    const ntEnc       = encodeURIComponent(data.noTrack);

    const parentRows = await sbGet(parentTable, `no_track=eq.${ntEnc}&select=*`);
    const parent     = (parentRows || [])[0];
    if (!parent) return { success: false, error: 'NO TRACK tidak ditemukan' };

    const now  = new Date().toISOString();
    const rows = awbs.map(awb => ({
      no_track: data.noTrack, incharge: parent.incharge, scan_date: now,
      awb, status: 'ON PROSES', service: parent.service, tujuan: parent.tujuan,
      ...(type === 'IB' ? { ib_from: parent.ib_from } : {})
    }));
    await sbPost(scanTable, rows);

    // Hitung ulang total_awb
    const countRows = await sbGet(scanTable, `no_track=eq.${ntEnc}&select=id`);
    await sbPatch(parentTable, `no_track=eq.${ntEnc}`, { total_awb: (countRows || []).length });

    return { success: true, added: awbs.length };
  },

  // ── Update status ──
  async updateObStatus(data) {
    await sbPatch("ob", `no_track=eq.${encodeURIComponent(data.noTrack)}`, { status: data.newStatus });
    return { success: true };
  },
  async updateHvsStatus(data) {
    await sbPatch("hvs", `no_track=eq.${encodeURIComponent(data.noTrack)}`, { status: data.newStatus });
    return { success: true };
  },
  async updateIbStatus(data) {
    await sbPatch("ib", `no_track=eq.${encodeURIComponent(data.noTrack)}`, { status: data.newStatus });
    return { success: true };
  },

  // ── Delete ──
  async deleteOb(data) {
    const ntEnc = encodeURIComponent(data.noTrack);
    await sbDelete("scan_ob", `no_track=eq.${ntEnc}`);
    await sbDelete("ob",      `no_track=eq.${ntEnc}`);
    return { success: true };
  },
  async deleteHvs(data) {
    const ntEnc = encodeURIComponent(data.noTrack);
    await sbDelete("scan_hvs", `no_track=eq.${ntEnc}`);
    await sbDelete("hvs",      `no_track=eq.${ntEnc}`);
    return { success: true };
  },
  async deleteIb(data) {
    const ntEnc = encodeURIComponent(data.noTrack);
    await sbDelete("scan_ib", `no_track=eq.${ntEnc}`);
    await sbDelete("ib",      `no_track=eq.${ntEnc}`);
    return { success: true };
  },

  // ── uploadFoto — ke Supabase Storage bucket "foto-gtw" ──
  // Signature sama persis: uploadFoto(noTrack, type, base64Data, photoIndex)
  async uploadFoto(noTrack, type, base64Data, photoIndex = 0) {
    const typeUp   = (type || 'OB').toUpperCase();
    const fileName = `${typeUp}/${noTrack}_${photoIndex + 1}_${Date.now()}.jpg`;

    // Decode base64 → Blob
    const b64 = (base64Data || '').includes(',') ? base64Data.split(',')[1] : base64Data;
    const byteStr = atob(b64);
    const ab = new ArrayBuffer(byteStr.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
    const blob = new Blob([ab], { type: 'image/jpeg' });

    // Upload ke Storage
    const uploadRes = await fetch(
      `${CONFIG.SUPABASE_URL}/storage/v1/object/foto-gtw/${fileName}`,
      {
        method: 'POST',
        headers: {
          "apikey":        CONFIG.SUPABASE_KEY,
          "Authorization": "Bearer " + CONFIG.SUPABASE_KEY,
          "Content-Type":  "image/jpeg"
        },
        body: blob
      }
    );
    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      return { success: false, error: 'Upload gagal: ' + err };
    }

    const publicUrl = `${CONFIG.SUPABASE_URL}/storage/v1/object/public/foto-gtw/${fileName}`;

    // Simpan URL ke kolom foto_url_{n} di tabel parent
    const parentTable = typeUp === 'OB' ? 'ob' : typeUp === 'HVS' ? 'hvs' : 'ib';
    const fotoCol     = `foto_url_${photoIndex + 1}`;
    await sbPatch(parentTable, `no_track=eq.${encodeURIComponent(noTrack)}`, { [fotoCol]: publicUrl });

    return { success: true, url: publicUrl };
  },

  // ════════════════════════════════════════════
  // COMPAT LAYER — method get/post lama masih
  // bisa dipanggil oleh kode yang belum diupdate
  // ════════════════════════════════════════════
  get(action, params = {}) {
    switch (action) {
      case 'getMasterData':  return API.getMasterData();
      case 'getObList':      return API.getObList();
      case 'getHvsList':     return API.getHvsList();
      case 'getIbList':      return API.getIbList();
      case 'getAwbList':     return API.getAwbList(params);
      case 'getDetail':      return API.getDetail(params);
      case 'getAllScanAwbs': return API.getAllScanAwbs();
      case 'searchAwb':      return API.searchAwb(params);
      default:
        console.warn('[API.get] Unknown action:', action);
        return Promise.resolve({ error: 'Unknown action: ' + action });
    }
  },

  post(action, data = {}) {
    switch (action) {
      case 'saveOb':          return API.saveOb(data);
      case 'saveHvs':         return API.saveHvs(data);
      case 'saveIb':          return API.saveIb(data);
      case 'addAwbToTrack':   return API.addAwbToTrack(data);
      case 'updateObStatus':  return API.updateObStatus(data);
      case 'updateHvsStatus': return API.updateHvsStatus(data);
      case 'updateIbStatus':  return API.updateIbStatus(data);
      case 'deleteOb':        return API.deleteOb(data);
      case 'deleteHvs':       return API.deleteHvs(data);
      case 'deleteIb':        return API.deleteIb(data);
      case 'uploadFoto':
      case 'updateFoto':
        return API.uploadFoto(data.noTrack, data.type, data.base64Data, data.photoIndex);
      default:
        console.warn('[API.post] Unknown action:', action);
        return Promise.resolve({ error: 'Unknown action: ' + action });
    }
  }
};

// ════════════════════════════════════════════
// DATA LOADER — tidak ada perubahan logika,
// hanya memanggil API.* yang sudah di-remap
// ════════════════════════════════════════════
const DataLoader = {
  async loadMaster() {
    const r = await API.getMasterData();
    STATE.masterData = r || {};
    DataLoader._buildIncharges();
    DataLoader._buildCbOptions();
  },

  async loadLists() {
    const [ob, hvs, ib] = await Promise.all([
      API.getObList(),
      API.getHvsList(),
      API.getIbList(),
    ]);
    STATE.obData  = ob.list  || [];
    STATE.hvsData = hvs.list || [];
    STATE.ibData  = ib.list  || [];
  },

  async loadScanAwbs() {
    try {
      const r = await API.getAllScanAwbs();
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
