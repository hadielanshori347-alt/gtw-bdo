/* ============================================================
   GTW BDO — filter_css.css v1.0
   Filter bar collapsible untuk halaman OB, HVS, IB
   ============================================================ */

/* ─── FILTER PANEL WRAPPER ─── */
.filter-panel {
  background: var(--white);
  border: 1.5px solid var(--blue-mid);
  border-radius: var(--r);
  margin-bottom: 10px;
  box-shadow: 0 1px 4px rgba(21,101,192,.07);
  overflow: hidden;
  transition: box-shadow .18s ease;
}
.filter-panel:focus-within {
  box-shadow: 0 2px 10px rgba(21,101,192,.13);
}

/* ─── FILTER TOGGLE HEADER ─── */
.filter-toggle-hdr {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  cursor: pointer;
  user-select: none;
  background: var(--blue-light);
  transition: background .15s ease;
}
.filter-toggle-hdr:hover {
  background: #DBEAFE;
}
.filter-toggle-label {
  flex: 1;
  font-size: 12px;
  font-weight: 700;
  color: var(--blue2);
  text-transform: uppercase;
  letter-spacing: .6px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.filter-toggle-label .material-icons-round {
  font-size: 16px;
  color: var(--blue);
}
.filter-active-badge {
  display: none;
  align-items: center;
  gap: 3px;
  background: var(--blue2);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 20px;
  letter-spacing: .3px;
}
.filter-active-badge.show {
  display: inline-flex;
}
.filter-toggle-arrow {
  color: var(--blue2);
  font-size: 18px;
  transition: transform .22s cubic-bezier(.4,0,.2,1);
  flex-shrink: 0;
}
.filter-panel.open .filter-toggle-arrow {
  transform: rotate(180deg);
}

/* ─── FILTER BODY (collapsible) ─── */
.filter-body {
  max-height: 0;
  overflow: hidden;
  transition: max-height .28s cubic-bezier(.4,0,.2,1);
}
.filter-panel.open .filter-body {
  max-height: 260px; /* cukup untuk 2 baris filter */
}

/* ─── FILTER INNER ─── */
.filter-inner {
  padding: 12px 14px 10px;
  border-top: 1px solid var(--blue-mid);
}

/* ─── FILTER FIELDS ROW ─── */
.filter-fields {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: flex-end;
  margin-bottom: 10px;
}
.filter-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 120px;
  max-width: 180px;
}
.filter-field label {
  font-size: 10px;
  font-weight: 700;
  color: var(--gray5);
  text-transform: uppercase;
  letter-spacing: .5px;
}
.filter-input,
.filter-select {
  padding: 6px 10px;
  border: 1.5px solid var(--gray3);
  border-radius: 6px;
  font-size: 12px;
  font-family: var(--font);
  color: var(--gray8);
  background: var(--white);
  outline: none;
  transition: border-color .15s ease, box-shadow .15s ease;
  width: 100%;
}
.filter-input:focus,
.filter-select:focus {
  border-color: var(--blue2);
  box-shadow: 0 0 0 2px var(--blue-light);
}

/* ─── FILTER ACTIONS ─── */
.filter-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

/* ─── ARCHIVE BADGE ─── */
.filter-archive-badge {
  display: none;
  align-items: center;
  gap: 4px;
  background: #FFF8E1;
  border: 1px solid #FFE082;
  color: #856404;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 20px;
  margin-left: 4px;
}
.filter-archive-badge.show {
  display: inline-flex;
}
.filter-archive-badge .material-icons-round {
  font-size: 13px;
}

/* ─── FILTER SUMMARY LINE (di header ketika collapsed) ─── */
.filter-summary {
  display: none;
  font-size: 11px;
  color: var(--blue2);
  font-weight: 500;
  background: rgba(21,101,192,.07);
  border-radius: 5px;
  padding: 2px 8px;
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.filter-summary.show {
  display: block;
}

/* ─── RESPONSIVE ─── */
@media (max-width: 600px) {
  .filter-field {
    min-width: 100px;
    max-width: 100%;
  }
  .filter-panel.open .filter-body {
    max-height: 380px;
  }
}
