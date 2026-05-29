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

  // ─────────────────────────────────────────────────────────
  // Upload foto ke Supabase Storage, lalu update kolom
  // foto_url / foto_url_2..5 di tracking_header via Supabase REST.
  //
  // photoIndex: 0 = foto_url, 1 = foto_url_2, dst
  // ─────────────────────────────────────────────────────────
  async uploadFoto(noTrack, type, base64Data, photoIndex = 0) {
    // Validasi CONFIG
    if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_KEY) {
      console.warn('[uploadFoto] SUPABASE_URL / SUPABASE_KEY tidak ada di CONFIG — fallback ke GAS');
      return API._uploadFotoGas(noTrack, type, base64Data, photoIndex);
    }

    try {
      // 1. Konversi base64 → Blob
      const blob = API._b64ToBlob(base64Data, 'image/jpeg');

      // 2. Buat nama file unik: noTrack_photoIndex_timestamp.jpg
      const safeTrack = noTrack.replace(/[^a-zA-Z0-9_\-]/g, '_');
      const fileName  = `${safeTrack}_${photoIndex}_${Date.now()}.jpg`;
      const filePath  = `fotos/${fileName}`;

      // 3. Upload ke Supabase Storage bucket "gtw-foto"
      const uploadRes = await fetch(
        `${CONFIG.SUPABASE_URL}/storage/v1/object/gtw-foto/${filePath}`,
        {
          method  : 'POST',
          headers : {
            'apikey'        : CONFIG.SUPABASE_KEY,
            'Authorization' : `Bearer ${CONFIG.SUPABASE_KEY}`,
            'Content-Type'  : 'image/jpeg',
            'Cache-Control' : '3600',
            'x-upsert'      : 'true',
          },
          body: blob,
        }
      );

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`Storage upload gagal (${uploadRes.status}): ${errText}`);
      }

      // 4. Buat public URL
      const publicUrl = `${CONFIG.SUPABASE_URL}/storage/v1/object/public/gtw-foto/${filePath}`;

      // 5. Update kolom foto_url* di tracking_header via Supabase REST
      const fotoKey   = photoIndex === 0 ? 'foto_url' : `foto_url_${photoIndex + 1}`;
      const patchBody = {};
      patchBody[fotoKey] = publicUrl;

      const patchRes = await fetch(
        `${CONFIG.SUPABASE_URL}/rest/v1/tracking_header?no_track=eq.${encodeURIComponent(noTrack)}`,
        {
          method  : 'PATCH',
          headers : {
            'apikey'        : CONFIG.SUPABASE_KEY,
            'Authorization' : `Bearer ${CONFIG.SUPABASE_KEY}`,
            'Content-Type'  : 'application/json',
            'Prefer'        : 'return=minimal',
          },
          body: JSON.stringify(patchBody),
        }
      );

      if (!patchRes.ok) {
        const errText = await patchRes.text();
        throw new Error(`Header PATCH gagal (${patchRes.status}): ${errText}`);
      }

      return { success: true, url: publicUrl };

    } catch (err) {
      console.error('[uploadFoto] Supabase error:', err.message);
      // Fallback ke GAS jika Supabase gagal
      console.warn('[uploadFoto] Fallback ke GAS...');
      return API._uploadFotoGas(noTrack, type, base64Data, photoIndex);
    }
  },

  // Fallback: upload via Google Apps Script (Drive)
  _uploadFotoGas(noTrack, type, base64Data, photoIndex = 0) {
    return API.post('uploadFoto', {
      noTrack,
      type,
      base64Data,
      folderId   : CONFIG.DRIVE_FOLDER_ID,
      photoIndex,
    });
  },

  // Konversi base64 string → Blob
  _b64ToBlob(b64, mimeType) {
    // Hapus prefix "data:image/...;base64," jika ada
    const pure = b64.includes(',') ? b64.split(',')[1] : b64;
    const bin  = atob(pure);
    const arr  = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mimeType });
  },
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
