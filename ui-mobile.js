// ════════════════════════════════════════════
// UI — DOM helpers, Smart Combobox, Toast
// ════════════════════════════════════════════

const UI = {
  // ── Loading ──
  Loading: {
    show(txt = 'Memuat...') {
      document.getElementById('gloading-txt').innerText = txt;
      document.getElementById('gloading').style.display = 'flex';
    },
    hide() {
      const el = document.getElementById('gloading');
      el.style.opacity = '0';
      el.style.transition = 'opacity .25s';
      setTimeout(() => { el.style.display = 'none'; el.style.opacity = ''; el.style.transition = ''; }, 260);
    }
  },

  // ── Toast ──
  Toast: {
    _t: null,
    show(msg, type = '') {
      const el = document.getElementById('gtoast');
      el.innerText = msg; el.className = type;
      el.style.display = 'block';
      clearTimeout(UI.Toast._t);
      UI.Toast._t = setTimeout(() => el.style.display = 'none', CONFIG.TOAST_DURATION);
    },
    success(msg) { UI.Toast.show(msg, 'success'); },
    error(msg)   { UI.Toast.show(msg, 'error');   },
  },

  // ── Page navigation ──
  Page: {
    show(id) {
      document.querySelectorAll('.page').forEach(p => {
        p.classList.toggle('hidden', p.id !== id);
      });
      STATE.currentPage = id;
    }
  },

  // ── Modal ──
  Modal: {
    open(id)  { document.getElementById(id).classList.add('open'); },
    close(id) { document.getElementById(id).classList.remove('open'); }
  },

  // ── Sidebar ──
  Sidebar: {
    open() {
      STATE.sidebarOpen = true;
      document.getElementById('sidebar').classList.add('open');
      document.getElementById('sidebarOv').classList.add('open');
    },
    close() {
      STATE.sidebarOpen = false;
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebarOv').classList.remove('open');
    },
    toggle() { STATE.sidebarOpen ? UI.Sidebar.close() : UI.Sidebar.open(); }
  },

  // ── Dropdown menu ──
  Menu: {
    toggle() {
      const dd = document.getElementById('ddMenu');
      const ov = document.getElementById('ddOv');
      const isOpen = dd.classList.contains('open');
      dd.classList.toggle('open', !isOpen);
      ov.classList.toggle('open', !isOpen);
    },
    close() {
      document.getElementById('ddMenu')?.classList.remove('open');
      document.getElementById('ddOv')?.classList.remove('open');
    }
  },

  // ── Smart Combobox ──
  Scb: {
    init(cbId, inputId, dropId, options, onSelect, readonly = false) {
      const inp  = document.getElementById(inputId);
      const drop = document.getElementById(dropId);
      const cb   = document.getElementById(cbId);
      if (!inp || !drop || !cb) return;

      STATE.scbReg[cbId] = { opts: options, val: '', onSelect, inp, drop, cb, readonly };
      if (readonly) inp.readOnly = true;

      inp.addEventListener('click',  () => { if (!inp.disabled) UI.Scb._toggle(cbId); });
      inp.addEventListener('input',  () => { if (!inp.readOnly && !inp.disabled) UI.Scb._filter(cbId); });
      inp.addEventListener('blur',   () => setTimeout(() => UI.Scb._close(cbId), 180));
      UI.Scb._renderOpts(cbId, '');
    },

    _toggle(cbId) {
      const reg = STATE.scbReg[cbId]; if (!reg || reg.inp.disabled) return;
      const isOpen = reg.cb.classList.contains('open');
      Object.keys(STATE.scbReg).forEach(id => UI.Scb._close(id));
      if (!isOpen) { reg.cb.classList.add('open'); UI.Scb._renderOpts(cbId, ''); }
    },

    _close(cbId) { STATE.scbReg[cbId]?.cb.classList.remove('open'); },
    _filter(cbId) {
      const reg = STATE.scbReg[cbId]; if (!reg) return;
      reg.cb.classList.add('open');
      UI.Scb._renderOpts(cbId, reg.inp.value);
    },

    _renderOpts(cbId, q) {
      const reg = STATE.scbReg[cbId]; if (!reg) return;
      const filtered = q ? reg.opts.filter(v => v.toLowerCase().includes(q.toLowerCase())) : [...reg.opts];
      if (!filtered.length) { reg.drop.innerHTML = '<div class="scb-empty">Tidak ada pilihan</div>'; return; }
      reg.drop.innerHTML = filtered.map(v =>
        `<div class="scb-opt${v === reg.val ? ' sel' : ''}" onmousedown="UI.Scb.pick('${cbId}','${escQ(v)}')">${v === reg.val ? '✓ ' : ''}${escH(v)}</div>`
      ).join('');
    },

    pick(cbId, val) {
      const reg = STATE.scbReg[cbId]; if (!reg) return;
      reg.val = val; reg.inp.value = val;
      UI.Scb._close(cbId);
      reg.onSelect?.(val);
    },

    setOptions(cbId, opts) {
      const reg = STATE.scbReg[cbId]; if (!reg) return;
      reg.opts = opts;
      UI.Scb._renderOpts(cbId, '');
    },

    setDisabled(cbId, dis) {
      const reg = STATE.scbReg[cbId]; if (!reg) return;
      reg.inp.disabled = dis;
      if (dis) { reg.inp.value = ''; reg.val = ''; UI.Scb._close(cbId); }
    },

    getValue(cbId) { return STATE.scbReg[cbId]?.val || ''; },
    setValue(cbId, val) {
      const reg = STATE.scbReg[cbId]; if (!reg) return;
      reg.val = val; reg.inp.value = val;
    },
    reset(cbId) { UI.Scb.setValue(cbId, ''); }
  }
};

// ════════════════════════════════════════════
// HELPERS — String utilities
// ════════════════════════════════════════════
function escH(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escQ(s) { return (s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }
function escRx(s){ return (s||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
