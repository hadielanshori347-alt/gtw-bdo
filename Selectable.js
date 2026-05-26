/* ============================================================
   GTW BDO — selectable.js v1.1
   GSheet-like cell selection & copy — KHUSUS halaman OB & IB
   - Klik sel untuk pilih, drag untuk blok multi-sel
   - Shift+klik untuk extend range
   - Ctrl+C / Cmd+C copy ke clipboard
   - Berlaku HANYA di: .obib-cell-awb, .obib-cell-ib-awb,
     .obib-cell-ib-label, .obib-cell-date (semua isi tabel obib)
   ============================================================ */

(function () {
  'use strict';

  /* ── CSS ── */
  var s = document.createElement('style');
  s.textContent = `
/* ─── OBIB SELECTABLE ─── */
.obib-sel {
  cursor: cell;
  user-select: none;
}
.obib-sel.sel-on {
  background: rgba(21,101,192,.15) !important;
  outline: 1.5px solid rgba(21,101,192,.5);
  outline-offset: -1px;
}
.obib-sel.sel-anchor {
  background: rgba(21,101,192,.25) !important;
  outline: 2px solid #1565c0;
  outline-offset: -1px;
}

/* ─── FLOATING COPY BAR ─── */
#_obibSelBar {
  position: fixed;
  z-index: 9999;
  background: #1565c0;
  color: #fff;
  border-radius: 22px;
  padding: 5px 6px 5px 14px;
  display: none;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 4px 20px rgba(0,0,0,.25);
  white-space: nowrap;
  pointer-events: auto;
  user-select: none;
  font-family: var(--font, sans-serif);
}
#_obibSelBar.show { display: flex; }
#_obibSelBar .sbar-count { opacity:.75; font-weight:400; font-size:11px; }
#_obibSelBar button {
  background: rgba(255,255,255,.2);
  border: none;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  border-radius: 14px;
  padding: 3px 11px;
  cursor: pointer;
  transition: background .15s;
  font-family: inherit;
  display: flex;
  align-items: center;
  gap: 4px;
}
#_obibSelBar button:hover { background: rgba(255,255,255,.35); }
#_obibSelBar .sbar-close {
  background: rgba(255,255,255,.08);
  font-size: 15px;
  padding: 2px 7px;
  line-height: 1;
}

/* ─── COPY TOAST ─── */
#_obibCopyToast {
  position: fixed;
  bottom: 76px;
  left: 50%;
  transform: translateX(-50%) translateY(10px);
  background: rgba(21,101,192,.93);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 18px;
  border-radius: 20px;
  pointer-events: none;
  z-index: 10000;
  opacity: 0;
  transition: opacity .22s, transform .22s;
  white-space: nowrap;
  box-shadow: 0 4px 16px rgba(0,0,0,.2);
  font-family: var(--font, sans-serif);
}
#_obibCopyToast.pop {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
`;
  document.head.appendChild(s);

  /* ── DOM ── */
  var bar = document.createElement('div');
  bar.id = '_obibSelBar';
  bar.innerHTML =
    '<span class="material-icons-round" style="font-size:15px;opacity:.7">select_all</span>' +
    '<span class="sbar-count" id="_obibSelCount">0 sel</span>' +
    '<button id="_obibSelCopyBtn">' +
      '<span class="material-icons-round" style="font-size:13px">content_copy</span> Copy' +
    '</button>' +
    '<button class="sbar-close" id="_obibSelClearBtn">✕</button>';
  document.body.appendChild(bar);

  var ct = document.createElement('div');
  ct.id = '_obibCopyToast';
  document.body.appendChild(ct);

  /* ── State ── */
  var _anchor   = null;   // anchor TD element
  var _sel      = [];     // [{el, text}]
  var _dragging = false;
  var _ctTimer  = null;

  /* ── Helpers ── */
  function _text(el) {
    var t = el.dataset.selText || el.textContent || '';
    return t.trim();
  }

  function _clearSel() {
    _sel.forEach(function(c){ c.el.classList.remove('sel-on','sel-anchor'); });
    if (_anchor) _anchor.classList.remove('sel-anchor','sel-on');
    _sel = []; _anchor = null;
  }

  function _hideBar() { bar.classList.remove('show'); }

  function _showBar(refEl) {
    var n = _sel.length;
    if (!n) { _hideBar(); return; }
    document.getElementById('_obibSelCount').textContent = n + ' sel';
    bar.classList.add('show');
    // position floating bar above reference cell
    var r   = refEl.getBoundingClientRect();
    var bw  = bar.offsetWidth || 190;
    var left = Math.min(Math.max(8, r.left + r.width/2 - bw/2), window.innerWidth - bw - 8);
    var top  = r.top - 46;
    if (top < 8) top = r.bottom + 8;
    bar.style.left = left + 'px';
    bar.style.top  = top  + 'px';
  }

  function _showToast(msg) {
    clearTimeout(_ctTimer);
    ct.textContent = msg;
    ct.classList.add('pop');
    _ctTimer = setTimeout(function(){ ct.classList.remove('pop'); }, 2200);
  }

  function _doCopy() {
    if (!_sel.length) return;
    var text = _sel.map(function(c){ return c.text; }).filter(Boolean).join('\n');
    var n = _sel.length;
    function done() { _showToast('✓ ' + n + ' AWB disalin'); _clearSel(); _hideBar(); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function(){
        _fallbackCopy(text); done();
      });
    } else { _fallbackCopy(text); done(); }
  }

  function _fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;width:1px;height:1px';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  /* ── Bar buttons ── */
  document.getElementById('_obibSelCopyBtn').addEventListener('click', _doCopy);
  document.getElementById('_obibSelClearBtn').addEventListener('click', function(){ _clearSel(); _hideBar(); });

  /* ── Range select logic ── */
  function _getContainer(el) {
    // walk up to tbody
    var p = el.parentElement;
    while (p && p.tagName !== 'TBODY' && p.tagName !== 'TABLE') p = p.parentElement;
    return p;
  }

  function _allSelectables(container) {
    return Array.from(container.querySelectorAll('td.obib-sel'));
  }

  function _selectSingle(el) {
    _clearSel();
    _anchor = el;
    el.classList.add('sel-anchor');
    _sel = [{ el: el, text: _text(el) }];
    _showBar(el);
  }

  function _selectRange(from, to) {
    var container = _getContainer(from);
    if (!container) { _selectSingle(from); return; }
    var all  = _allSelectables(container);
    var iF   = all.indexOf(from);
    var iT   = all.indexOf(to);
    if (iF === -1 || iT === -1) { _selectSingle(from); return; }
    if (iF > iT) { var tmp=iF; iF=iT; iT=tmp; }
    _clearSel();
    _anchor = from;
    _sel = [];
    all.forEach(function(el, i){
      if (i >= iF && i <= iT) {
        el.classList.add(el === from ? 'sel-anchor' : 'sel-on');
        _sel.push({ el: el, text: _text(el) });
      }
    });
    _showBar(to);
  }

  /* ── Attach to OBIB table ── */
  function _attachObib() {
    var wrap = document.getElementById('obibTableWrap');
    if (!wrap) return;

    // Target semua td yang berisi AWB atau label (bukan header, bukan rownumber)
    var cells = wrap.querySelectorAll(
      'td.obib-cell-awb, td.obib-cell-ib-awb, td.obib-cell-ib-label, ' +
      'td.obib-cell-date, td.obib-cell-date-empty, td.obib-cell-empty'
    );

    cells.forEach(function(td) {
      if (td.dataset.selBound) return;
      td.dataset.selBound = '1';
      td.classList.add('obib-sel');

      td.addEventListener('mousedown', function(e) {
        if (e.button !== 0) return;
        // Jangan intercept klik di dalam elemen interaktif
        if (e.target.closest('button,a,input')) return;
        e.preventDefault();
        _dragging = true;
        if (e.shiftKey && _anchor) {
          _selectRange(_anchor, td);
        } else {
          _selectSingle(td);
        }
      });

      td.addEventListener('mouseover', function() {
        if (_dragging && _anchor) _selectRange(_anchor, td);
      });
    });
  }

  /* ── Observer: re-attach setelah tabel di-render ulang ── */
  window.addEventListener('DOMContentLoaded', function() {
    var wrap = document.getElementById('obibTableWrap');
    if (!wrap) return;

    // Observe perubahan di obibTableWrap (tiap render ulang)
    new MutationObserver(function() {
      setTimeout(_attachObib, 80);
    }).observe(wrap, { childList: true, subtree: false });

    // Initial attach jika sudah ada isi
    setTimeout(_attachObib, 200);
  });

  /* ── Global mouse / keyboard ── */
  document.addEventListener('mouseup', function() {
    if (_dragging) {
      _dragging = false;
      if (_sel.length) _showBar(_sel[_sel.length-1].el);
    }
  });

  document.addEventListener('keydown', function(e) {
    var ctrl = e.ctrlKey || e.metaKey;

    // Ctrl+C
    if (ctrl && e.key === 'c' && _sel.length) {
      var active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      _doCopy();
      return;
    }

    // Shift+ArrowDown/Up — extend range
    if (e.shiftKey && _anchor && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      var active2 = document.activeElement;
      if (active2 && (active2.tagName === 'INPUT' || active2.tagName === 'TEXTAREA')) return;
      var last = _sel.length ? _sel[_sel.length-1].el : _anchor;
      var container = _getContainer(_anchor);
      if (!container) return;
      var all = _allSelectables(container);
      var idx = all.indexOf(last);
      if (idx === -1) return;
      var next = all[idx + (e.key === 'ArrowDown' ? 1 : -1)];
      if (next) { e.preventDefault(); _selectRange(_anchor, next); }
      return;
    }

    // Escape
    if (e.key === 'Escape' && _sel.length) {
      _clearSel(); _hideBar();
    }
  });

  // Klik di luar — clear
  document.addEventListener('mousedown', function(e) {
    if (bar.contains(e.target)) return;
    if (e.target.closest('.obib-sel')) return;
    _clearSel(); _hideBar();
  });

})();
