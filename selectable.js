/* ============================================================
   GTW BDO — selectable.js v1.2
   GSheet-like cell selection & copy — KHUSUS halaman OB & IB
   - Klik sel → select 1 sel
   - Drag / Shift+klik → blok SATU KOLOM saja (kolom yang sama)
   - Ctrl+C / Cmd+C → copy ke clipboard (1 AWB per baris)
   ============================================================ */

(function () {
  'use strict';

  /* ── CSS ── */
  var s = document.createElement('style');
  s.textContent = `
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
  user-select: none;
  font-family: var(--font, sans-serif);
  pointer-events: auto;
}
#_obibSelBar.show { display: flex; }
#_obibSelBar .sbar-count { opacity:.75; font-weight:400; font-size:11px; }
#_obibSelBar button {
  background: rgba(255,255,255,.2);
  border: none; color: #fff;
  font-size: 11px; font-weight: 700;
  border-radius: 14px; padding: 3px 11px;
  cursor: pointer; transition: background .15s;
  font-family: inherit;
  display: flex; align-items: center; gap: 4px;
}
#_obibSelBar button:hover { background: rgba(255,255,255,.35); }
#_obibSelBar .sbar-close {
  background: rgba(255,255,255,.08);
  font-size: 15px; padding: 2px 8px; line-height: 1;
}

#_obibCopyToast {
  position: fixed;
  bottom: 76px; left: 50%;
  transform: translateX(-50%) translateY(10px);
  background: rgba(21,101,192,.93);
  color: #fff; font-size: 12px; font-weight: 600;
  padding: 6px 18px; border-radius: 20px;
  pointer-events: none; z-index: 10000;
  opacity: 0; transition: opacity .22s, transform .22s;
  white-space: nowrap; box-shadow: 0 4px 16px rgba(0,0,0,.2);
  font-family: var(--font, sans-serif);
}
#_obibCopyToast.pop {
  opacity: 1; transform: translateX(-50%) translateY(0);
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

  var toast = document.createElement('div');
  toast.id = '_obibCopyToast';
  document.body.appendChild(toast);

  /* ── State ── */
  var _anchor   = null;   // {el, colIdx, rowIdx}
  var _sel      = [];     // [{el, text}]
  var _dragging = false;
  var _toastTimer = null;

  /* ── Util ── */
  function _text(td) {
    return (td.textContent || '').trim();
  }

  // Dapatkan index kolom dari <td> dalam <tr>-nya
  function _colIdx(td) {
    return Array.prototype.indexOf.call(td.parentElement.children, td);
  }

  // Dapatkan semua <td> pada kolom yang sama (colIdx) dalam tbody
  function _colCells(tbody, ci) {
    var cells = [];
    var rows = tbody.querySelectorAll('tr');
    rows.forEach(function(tr) {
      var td = tr.children[ci];
      if (td && td.classList.contains('obib-sel')) cells.push(td);
    });
    return cells;
  }

  function _getRowIdx(td) {
    var tr = td.parentElement;
    var tbody = tr.parentElement;
    return Array.prototype.indexOf.call(tbody.querySelectorAll('tr'), tr);
  }

  function _getTbody(td) {
    return td.closest('tbody');
  }

  /* ── Clear ── */
  function _clearSel() {
    _sel.forEach(function(c) { c.el.classList.remove('sel-on', 'sel-anchor'); });
    _sel = []; _anchor = null;
  }

  /* ── Bar ── */
  function _hideBar() { bar.classList.remove('show'); }

  function _showBar(refEl) {
    if (!_sel.length) { _hideBar(); return; }
    document.getElementById('_obibSelCount').textContent = _sel.length + ' sel';
    bar.classList.add('show');
    var r   = refEl.getBoundingClientRect();
    var bw  = bar.offsetWidth || 190;
    var left = Math.min(Math.max(8, r.left + r.width/2 - bw/2), window.innerWidth - bw - 8);
    var top  = r.top - 46; if (top < 8) top = r.bottom + 8;
    bar.style.left = left + 'px';
    bar.style.top  = top + 'px';
  }

  /* ── Toast ── */
  function _showToast(msg) {
    clearTimeout(_toastTimer);
    toast.textContent = msg;
    toast.classList.add('pop');
    _toastTimer = setTimeout(function(){ toast.classList.remove('pop'); }, 2300);
  }

  /* ── Copy ── */
  function _doCopy() {
    if (!_sel.length) return;
    var text = _sel.map(function(c){ return c.text; }).filter(Boolean).join('\n');
    var n = _sel.length;
    function done() { _showToast('✓ ' + n + ' AWB disalin'); _clearSel(); _hideBar(); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function(){
        _fallback(text); done();
      });
    } else { _fallback(text); done(); }
  }

  function _fallback(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;width:1px;height:1px';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
  }

  bar.querySelector('#_obibSelCopyBtn').addEventListener('click', _doCopy);
  bar.querySelector('#_obibSelClearBtn').addEventListener('click', function(){ _clearSel(); _hideBar(); });

  /* ── Select single ── */
  function _selectSingle(td) {
    _clearSel();
    _anchor = td;
    td.classList.add('sel-anchor');
    _sel = [{ el: td, text: _text(td) }];
    _showBar(td);
  }

  /* ── Select range — HANYA dalam kolom yang sama ── */
  function _selectRange(fromTd, toTd) {
    var ciFrom = _colIdx(fromTd);
    var ciTo   = _colIdx(toTd);

    // Beda kolom → hanya select toTd saja (tidak blok lintas kolom)
    if (ciFrom !== ciTo) {
      _selectSingle(fromTd);
      return;
    }

    var tbody  = _getTbody(fromTd);
    if (!tbody) { _selectSingle(fromTd); return; }

    // Ambil semua sel di kolom ini
    var colCells = _colCells(tbody, ciFrom);
    var iFrom    = colCells.indexOf(fromTd);
    var iTo      = colCells.indexOf(toTd);
    if (iFrom === -1 || iTo === -1) { _selectSingle(fromTd); return; }
    if (iFrom > iTo) { var tmp = iFrom; iFrom = iTo; iTo = tmp; }

    _clearSel();
    _anchor = fromTd;
    _sel = [];
    colCells.forEach(function(td, i) {
      if (i >= iFrom && i <= iTo) {
        td.classList.add(td === fromTd ? 'sel-anchor' : 'sel-on');
        _sel.push({ el: td, text: _text(td) });
      }
    });
    _showBar(toTd);
  }

  /* ── Attach ke tabel ── */
  function _attachObib() {
    var wrap = document.getElementById('obibTableWrap');
    if (!wrap) return;
    var tds = wrap.querySelectorAll(
      'td.obib-cell-awb, td.obib-cell-ib-awb, td.obib-cell-ib-label'
    );
    tds.forEach(function(td) {
      if (td.dataset.selBound) return;
      td.dataset.selBound = '1';
      td.classList.add('obib-sel');

      td.addEventListener('mousedown', function(e) {
        if (e.button !== 0) return;
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
        if (!_dragging || !_anchor) return;
        // Hanya lanjutkan drag jika kolom sama
        if (_colIdx(td) === _colIdx(_anchor)) {
          _selectRange(_anchor, td);
        }
      });
    });
  }

  /* ── Observer ── */
  window.addEventListener('DOMContentLoaded', function() {
    var wrap = document.getElementById('obibTableWrap');
    if (!wrap) return;
    new MutationObserver(function() {
      setTimeout(_attachObib, 80);
    }).observe(wrap, { childList: true, subtree: false });
    setTimeout(_attachObib, 200);
  });

  /* ── Global events ── */
  document.addEventListener('mouseup', function() {
    if (_dragging) {
      _dragging = false;
      if (_sel.length) _showBar(_sel[_sel.length - 1].el);
    }
  });

  document.addEventListener('keydown', function(e) {
    var ctrl = e.ctrlKey || e.metaKey;
    var active = document.activeElement;
    var inInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');

    if (ctrl && e.key === 'c' && _sel.length && !inInput) {
      e.preventDefault(); _doCopy(); return;
    }

    if (e.shiftKey && _anchor && !inInput && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      var last   = _sel.length ? _sel[_sel.length - 1].el : _anchor;
      var tbody  = _getTbody(_anchor);
      if (!tbody) return;
      var ci     = _colIdx(_anchor);
      var cells  = _colCells(tbody, ci);
      var idx    = cells.indexOf(last);
      if (idx === -1) return;
      var next   = cells[idx + (e.key === 'ArrowDown' ? 1 : -1)];
      if (next) { e.preventDefault(); _selectRange(_anchor, next); }
      return;
    }

    if (e.key === 'Escape' && _sel.length) { _clearSel(); _hideBar(); }
  });

  document.addEventListener('mousedown', function(e) {
    if (bar.contains(e.target)) return;
    if (e.target.closest('.obib-sel')) return;
    _clearSel(); _hideBar();
  });

})();
