/* Fig — paneles: páginas, capas y propiedades (los campos son los de Figma, en kiwi). */
(function () {
  'use strict';
  const A = window.FigApp, FM = window.FigModel, FR = window.FigRender, FL = window.FigLayout;
  const $ = (s, r = document) => r.querySelector(s);
  const h = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (v == null || v === false) continue; if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else if (k === 'style') e.style.cssText = v; else e.setAttribute(k, v === true ? '' : v); }
    for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
    return e;
  };
  const ICON = {
    FRAME: '<path d="M8 3v18M16 3v18M3 8h18M3 16h18"/>', GROUP: '<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3 2"/>', COMPONENT: '<path d="M12 3l4 4-4 4-4-4zM12 13l4 4-4 4-4-4zM7 8l4 4-4 4-4-4zM17 8l4 4-4 4-4-4z"/>',
    INSTANCE: '<path d="M12 3l9 9-9 9-9-9z"/>', TEXT: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>', ROUNDED_RECTANGLE: '<rect x="4" y="5" width="16" height="14" rx="1"/>', RECTANGLE: '<rect x="4" y="5" width="16" height="14"/>',
    ELLIPSE: '<circle cx="12" cy="12" r="8"/>', LINE: '<path d="M5 19L19 5"/>', VECTOR: '<path d="M4 18C8 4 16 20 20 6"/>', BOOLEAN_OPERATION: '<rect x="3" y="3" width="12" height="12"/><rect x="9" y="9" width="12" height="12"/>',
    SECTION: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h8"/>', IMAGE: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-6-6-8 8"/>',
  };
  const icon = (n) => { const img = (n.fillPaints || []).some((p) => p.type === 'IMAGE'); return `<svg viewBox="0 0 24 24">${ICON[FR.isGroup(n) ? 'GROUP' : img && n.type === 'ROUNDED_RECTANGLE' ? 'IMAGE' : n.type] || ICON.VECTOR}</svg>`; };
  const EYE = '<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 6.1A10 10 0 0112 6c6 0 10 6 10 6a17 17 0 01-3.2 3.7M6.6 6.6C3.9 8.3 2 12 2 12s4 6 10 6c1.7 0 3.2-.4 4.5-1"/></svg>';
  const LOCK = '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>';
  const UNLOCK = '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 017.5-2"/></svg>';

  // ---------------------------------------------------------------- páginas
  function renderPages() {
    const el = $('#pages'); el.innerHTML = '';
    for (const p of A.doc.d.pages) {
      if (p.internalOnly || p.name === 'Internal Only Canvas') continue;
      const row = h('div', { class: 'pg' + (p === A.doc.page ? ' on' : ''), onclick: () => A.setPage(p), ondblclick: () => rename(row, p, () => renderPages()) }, p.name || 'Page');
      el.append(row);
    }
  }
  $('#page-add').addEventListener('click', () => {
    A.doc.begin('Página');
    const p = { id: FM.newId(), type: 'CANVAS', name: 'Page ' + (A.doc.d.pages.length + 1), visible: true, opacity: 1, backgroundColor: { r: 0.118, g: 0.118, b: 0.118, a: 1 }, children: [] };
    A.doc.d.pages.push(p); A.doc.commit(); A.setPage(p); A.afterChange();
  });
  function rename(row, n, done) {
    const nm = row.querySelector('.nm') || row, old = n.name || '';
    const inp = h('input', { value: old });
    nm.textContent = ''; nm.append(inp); inp.focus(); inp.select();
    const fin = (ok) => { if (ok && inp.value !== old) A.change('Renombrar', () => { n.name = inp.value; n.autoRename = false; }, { relayout: false }); else done(); };
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') fin(true); if (e.key === 'Escape') fin(false); });
    inp.addEventListener('blur', () => fin(true));
  }

  // ---------------------------------------------------------------- capas
  let dragId = null;
  function renderLayers() {
    const el = $('#layers'), scroll = el.scrollTop; el.innerHTML = '';
    // expandir los padres de lo seleccionado
    for (const n of A.selected()) for (const p of A.doc.ancestors(n)) A.expanded.add(p.id);
    const walk = (list, depth) => {
      for (let i = list.length - 1; i >= 0; i--) {
        const n = list[i], kids = n.children || [], open = A.expanded.has(n.id);
        const row = h('div', { class: 'ly' + (A.sel.includes(n.id) ? ' sel' : '') + (n.visible === false ? ' hid' : ''), draggable: 'true', 'data-id': n.id, style: `padding-left:${8 + depth * 14}px` },
          h('span', { class: 'tw', onclick: (e) => { e.stopPropagation(); if (open) A.expanded.delete(n.id); else A.expanded.add(n.id); renderLayers(); } }, kids.length ? (open ? '▾' : '▸') : ''),
          h('span', { class: 'ic', html: icon(n) }),
          h('span', { class: 'nm' }, n.name || n.type),
          h('button', { class: 'lk' + (n.locked ? ' on' : ''), html: n.locked ? LOCK : UNLOCK, title: 'Bloquear', onclick: (e) => { e.stopPropagation(); A.change('Bloquear', () => { n.locked = !n.locked; }, { relayout: false }); } }),
          h('button', { class: 'eye' + (n.visible === false ? ' off' : ''), html: n.visible === false ? EYE_OFF : EYE, title: 'Mostrar / ocultar', onclick: (e) => { e.stopPropagation(); A.change('Visible', () => { n.visible = n.visible === false; }); } }));
        row.addEventListener('click', (e) => {
          if (e.shiftKey || e.ctrlKey || e.metaKey) A.select(A.sel.includes(n.id) ? A.sel.filter((x) => x !== n.id) : [...A.sel, n.id]);
          else A.select([n.id]);
        });
        row.addEventListener('dblclick', (e) => { e.stopPropagation(); rename(row, n, renderLayers); });
        row.addEventListener('mouseenter', () => { A.hover = n.id; A.render(); });
        row.addEventListener('mouseleave', () => { if (A.hover === n.id) { A.hover = null; A.render(); } });
        row.addEventListener('dragstart', (e) => { dragId = n.id; e.dataTransfer.effectAllowed = 'move'; });
        row.addEventListener('dragover', (e) => {
          if (!dragId || dragId === n.id) return; e.preventDefault();
          const r = row.getBoundingClientRect(), f = (e.clientY - r.top) / r.height;
          row.classList.remove('drop-above', 'drop-below', 'drop-in');
          row.classList.add(FM.CONTAINERS.has(n.type) && f > 0.3 && f < 0.7 ? 'drop-in' : f < 0.5 ? 'drop-above' : 'drop-below');
        });
        row.addEventListener('dragleave', () => row.classList.remove('drop-above', 'drop-below', 'drop-in'));
        row.addEventListener('drop', (e) => {
          e.preventDefault(); const mode = row.classList.contains('drop-in') ? 'in' : row.classList.contains('drop-above') ? 'above' : 'below';
          row.classList.remove('drop-above', 'drop-below', 'drop-in');
          const src = A.doc.node(dragId); dragId = null; if (!src || src === n || A.doc.ancestors(n).includes(src)) return;
          A.change('Mover capa', () => {
            if (mode === 'in') A.doc.reparent(src, n);
            else { const p = A.doc.parent(n), i = p.children.indexOf(n); A.doc.reparent(src, p, mode === 'above' ? i + 1 : i); }   // la lista se pinta al revés
            A.doc.fitGroups(src);
          });
        });
        el.append(row);
        if (kids.length && open) walk(kids, depth + 1);
      }
    };
    walk(A.doc.page.children || [], 0);
    el.scrollTop = scroll;
    const s = el.querySelector('.ly.sel'); if (s && A.scrollLayer) { s.scrollIntoView({ block: 'nearest' }); A.scrollLayer = false; }
  }
  A.on('rename', () => { const s = A.selected(); if (s.length !== 1) return; const row = $(`#layers .ly[data-id="${CSS.escape(s[0].id)}"]`); if (row) rename(row, s[0], renderLayers); });

  // ---------------------------------------------------------------- campos
  const num = (v) => (v == null || Number.isNaN(v) ? '' : String(Math.round(v * 100) / 100));
  // campo numérico con arrastre en la etiqueta
  function field(label, value, onset, opts = {}) {
    const inp = h('input', { value: value === undefined ? (opts.mixed ? 'Mixto' : '') : num(value) });
    const lab = h('label', { title: opts.title || '' }, label);
    const set = (v) => { const x = parseFloat(v); if (!Number.isFinite(x)) return; onset(opts.min != null ? Math.max(opts.min, x) : x); };
    inp.addEventListener('change', () => set(evalExpr(inp.value)));
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') inp.blur(); if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const d = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1); set((parseFloat(inp.value) || 0) + d); } });
    lab.addEventListener('pointerdown', (e) => {
      const x0 = e.clientX, v0 = parseFloat(inp.value) || 0; lab.setPointerCapture(e.pointerId); let moved = false;
      const mv = (ev) => { moved = true; inp.value = num(v0 + (ev.clientX - x0) * (ev.shiftKey ? 10 : 1) * (opts.step || 1)); };
      const up = () => { lab.removeEventListener('pointermove', mv); lab.removeEventListener('pointerup', up); if (moved) set(inp.value); };
      lab.addEventListener('pointermove', mv); lab.addEventListener('pointerup', up);
    });
    return h('div', { class: 'fld', title: opts.title || '' }, lab, inp, opts.suffix ? h('span', { style: 'color:var(--dim)' }, opts.suffix) : null);
  }
  function evalExpr(s) { s = String(s).replace(/,/g, '.'); return /^[\d\s.+\-*/()]+$/.test(s) ? Function('"use strict";return (' + s + ')')() : parseFloat(s); }
  function select(value, options, onset) {
    const sel = h('select', { onchange: () => onset(sel.value) }, ...options.map(([v, l]) => h('option', { value: v, selected: v === value }, l)));
    return h('div', { class: 'fld' }, sel);
  }
  const same = (arr, f) => { const v = arr.map(f); return v.every((x) => JSON.stringify(x) === JSON.stringify(v[0])) ? v[0] : undefined; };
  const sect = (title, ...kids) => h('div', { class: 'ps' }, h('h4', {}, ...[title].flat()), ...kids);
  const hex6 = (c) => '#' + ['r', 'g', 'b'].map((k) => Math.round((c?.[k] ?? 0) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
  const fromHex = (s) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(s).trim()); if (!m) return null; const v = parseInt(m[1], 16); return { r: (v >> 16 & 255) / 255, g: (v >> 8 & 255) / 255, b: (v & 255) / 255, a: 1 }; };
  // cambia un campo de todos los seleccionados
  const setAll = (label, f, opts) => A.change(label, () => { for (const n of A.selected()) f(n); }, opts);

  // ---------------------------------------------------------------- pinturas
  const PTYPES = [['SOLID', 'Sólido'], ['GRADIENT_LINEAR', 'Lineal'], ['GRADIENT_RADIAL', 'Radial'], ['GRADIENT_ANGULAR', 'Angular'], ['GRADIENT_DIAMOND', 'Diamante'], ['IMAGE', 'Imagen']];
  const BLENDS = ['NORMAL', 'DARKEN', 'MULTIPLY', 'LINEAR_BURN', 'COLOR_BURN', 'LIGHTEN', 'SCREEN', 'LINEAR_DODGE', 'COLOR_DODGE', 'OVERLAY', 'SOFT_LIGHT', 'HARD_LIGHT', 'DIFFERENCE', 'EXCLUSION', 'HUE', 'SATURATION', 'COLOR', 'LUMINOSITY'];
  const blendName = (b) => b.charAt(0) + b.slice(1).toLowerCase().replace(/_/g, ' ');
  function swatchCss(p) {
    if (p.type === 'SOLID') return FR.css(p.color);
    if (p.type === 'IMAGE') return '#888';
    return `linear-gradient(90deg, ${(p.stops || []).map((s) => `${FR.css(s.color)} ${s.position * 100}%`).join(',')})`;
  }
  function paintRows(key, label) {
    const ns = A.selected(), paints = same(ns, (n) => n[key] || []);
    const add = h('button', { title: 'Añadir', onclick: () => setAll('Añadir', (n) => { n[key] = [...(n[key] || []), FM.solid(key === 'strokePaints' ? { r: 0, g: 0, b: 0 } : { r: 0.85, g: 0.85, b: 0.85 })]; if (key === 'strokePaints' && !n.strokeWeight) n.strokeWeight = 1; }) }, '+');
    const box = sect([label, add]);
    if (paints === undefined) { box.append(h('div', { class: 'empty', style: 'padding:0' }, 'Varios valores')); return box; }
    paints.forEach((p, i) => {
      const upd = (f, lab = 'Pintura') => setAll(lab, (n) => { const arr = JSON.parse(JSON.stringify(n[key] || [])); f(arr[i], arr); n[key] = arr; });
      const col = h('input', { type: 'color', value: hex6(p.type === 'SOLID' ? p.color : p.stops?.[0]?.color), oninput: (e) => {
        const c = fromHex(e.target.value); for (const n of A.selected()) { const q = (n[key] || [])[i]; if (!q) continue; if (q.type === 'SOLID') q.color = { ...c, a: q.color?.a ?? 1 }; } A.doc.version++; A.render(); },
        onchange: (e) => { const c = fromHex(e.target.value); upd((q) => { if (q.type === 'SOLID') q.color = { ...c, a: q.color?.a ?? 1 }; else if (q.stops?.[0]) q.stops[0].color = { ...c, a: q.stops[0].color.a ?? 1 }; }, 'Color'); } });
      const sw = h('span', { class: 'sw' }, h('i', { style: `background:${swatchCss(p)}` }), p.type === 'SOLID' || p.type.startsWith('GRADIENT') ? col : null);
      const hexIn = h('input', { value: p.type === 'SOLID' ? hex6(p.color).slice(1) : '', placeholder: PTYPES.find((t) => t[0] === p.type)?.[1] || p.type,
        onchange: (e) => { const c = fromHex(e.target.value); if (c) upd((q) => { q.type = 'SOLID'; q.color = { ...c, a: q.color?.a ?? 1 }; }, 'Color'); }, onkeydown: (e) => e.stopPropagation() });
      const opIn = h('input', { value: num((p.opacity ?? 1) * 100), style: 'width:36px;text-align:right', onchange: (e) => upd((q) => { q.opacity = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) / 100; }, 'Opacidad'), onkeydown: (e) => e.stopPropagation() });
      const row = h('div', { class: 'paint' + (p.visible === false ? ' off' : '') }, h('div', { class: 'fld' }, sw, h('span', { style: 'width:6px' }), hexIn, opIn, h('span', { style: 'color:var(--dim)' }, '%')),
        h('button', { class: 'vis', html: p.visible === false ? EYE_OFF : EYE, onclick: () => upd((q) => { q.visible = q.visible === false; }, 'Visible') }),
        h('button', { class: 'x', onclick: () => upd((q, arr) => { arr.splice(i, 1); }, 'Quitar') }, '−'));
      box.append(row);
      // tipo, fusión y detalles
      const det = h('div', { class: 'row' }, select(p.type, PTYPES, (t) => upd((q) => convertPaint(q, t), 'Tipo')),
        select(p.blendMode || 'NORMAL', BLENDS.map((b) => [b, blendName(b)]), (b) => upd((q) => { q.blendMode = b; }, 'Fusión')));
      box.append(det);
      if (p.type.startsWith('GRADIENT')) box.append(stopsEditor(p, upd));
      if (p.type === 'IMAGE') box.append(imageEditor(p, upd));
    });
    if (key === 'strokePaints' && paints.length) {
      box.append(h('div', { class: 'row' }, field('≡', same(ns, (n) => n.strokeWeight), (v) => setAll('Grosor', (n) => { n.strokeWeight = v; A.doc.reshape(n); }), { min: 0, title: 'Grosor' }),
        select(same(ns, (n) => n.strokeAlign) || 'INSIDE', [['INSIDE', 'Dentro'], ['CENTER', 'Centro'], ['OUTSIDE', 'Fuera']], (v) => setAll('Posición del borde', (n) => { n.strokeAlign = v; A.doc.reshape(n); }))));
      box.append(h('div', { class: 'row' }, select(same(ns, (n) => n.strokeJoin) || 'MITER', [['MITER', 'Esquina viva'], ['ROUND', 'Redonda'], ['BEVEL', 'Biselada']], (v) => setAll('Unión', (n) => { n.strokeJoin = v; A.doc.reshape(n); })),
        h('div', { class: 'fld' }, h('label', { title: 'Discontinuo (p. ej. 4 2)' }, '- -'), h('input', { value: (same(ns, (n) => n.dashPattern) || []).join(' '), onkeydown: (e) => e.stopPropagation(),
          onchange: (e) => setAll('Discontinuo', (n) => { const v = e.target.value.trim().split(/[\s,]+/).map(Number).filter((x) => x > 0); if (v.length) n.dashPattern = v; else delete n.dashPattern; A.doc.reshape(n); }) }))));
    }
    return box;
  }
  function convertPaint(q, t) {
    const c = q.type === 'SOLID' ? q.color : q.stops?.[0]?.color || { r: 0.5, g: 0.5, b: 0.5, a: 1 };
    for (const k of Object.keys(q)) if (!['opacity', 'visible', 'blendMode'].includes(k)) delete q[k];
    q.type = t;
    if (t === 'SOLID') q.color = { ...c, a: 1 };
    else if (t.startsWith('GRADIENT')) { q.stops = [{ color: { ...c, a: 1 }, position: 0 }, { color: { r: 1, g: 1, b: 1, a: 1 }, position: 1 }]; q.transform = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }; }
    else if (t === 'IMAGE') { q.imageScaleMode = 'FILL'; q.transform = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }; q.scale = 1; }
  }
  function stopsEditor(p, upd) {
    const wrap = h('div', {});
    // ángulo (lineal): gira la transformación alrededor del centro
    if (p.type === 'GRADIENT_LINEAR') {
      const T = p.transform || {}, ang = Math.round(Math.atan2(T.m01 ?? 0, T.m00 ?? 1) * 180 / Math.PI);
      wrap.append(h('div', { class: 'row' }, field('∠', ang, (deg) => upd((q) => {
        const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
        // t = 0.5 + (u-.5)·cos + (v-.5)·sin  (fila 2 perpendicular)
        q.transform = { m00: c, m01: s, m02: 0.5 - 0.5 * c - 0.5 * s, m10: -s, m11: c, m12: 0.5 + 0.5 * s - 0.5 * c };
      }, 'Ángulo'), { suffix: '°', title: 'Ángulo del degradado' })));
    }
    (p.stops || []).forEach((s, j) => {
      const c = h('input', { type: 'color', value: hex6(s.color), onchange: (e) => upd((q) => { q.stops[j].color = { ...fromHex(e.target.value), a: q.stops[j].color.a ?? 1 }; }, 'Parada') });
      wrap.append(h('div', { class: 'row' }, h('div', { class: 'fld' }, h('span', { class: 'sw' }, h('i', { style: `background:${FR.css(s.color)}` }), c),
        h('input', { value: num(s.position * 100), style: 'width:40px', onkeydown: (e) => e.stopPropagation(), onchange: (e) => upd((q) => { q.stops[j].position = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) / 100; }, 'Parada') }), h('span', { style: 'color:var(--dim)' }, '%'),
        h('input', { value: num((s.color.a ?? 1) * 100), style: 'width:36px;text-align:right', onkeydown: (e) => e.stopPropagation(), onchange: (e) => upd((q) => { q.stops[j].color.a = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) / 100; }, 'Parada') }), h('span', { style: 'color:var(--dim)' }, 'α')),
        h('button', { class: 'x', onclick: () => upd((q) => { if (q.stops.length > 2) q.stops.splice(j, 1); }, 'Parada') }, '−')));
    });
    wrap.append(h('button', { class: 'btn ghost', style: 'width:100%;margin-bottom:6px', onclick: () => upd((q) => { q.stops.push({ color: { r: 0.5, g: 0.5, b: 0.5, a: 1 }, position: 0.5 }); q.stops.sort((a, b) => a.position - b.position); }, 'Parada') }, '+ Parada'));
    return wrap;
  }
  function imageEditor(p, upd) {
    const pick = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const { hash, w, h: ih } = await A.uploadImage(f), hb = A.hexBytes(hash);
      upd((q) => { q.image = { hash: hb, name: '' }; q.imageThumbnail = { hash: hb, name: '' }; q.originalImageWidth = w; q.originalImageHeight = ih; }, 'Imagen');
    } });
    const f = p.paintFilter || {};
    const adj = (k, lab) => field(lab, Math.round((f[k] || 0) * 100), (v) => upd((q) => { q.paintFilter = { ...(q.paintFilter || {}), [k]: Math.max(-100, Math.min(100, v)) / 100 }; }, 'Ajuste'), { title: k });
    return h('div', {},
      h('div', { class: 'row' }, select(p.imageScaleMode || 'FILL', [['FILL', 'Rellenar'], ['FIT', 'Ajustar'], ['STRETCH', 'Recortar'], ['TILE', 'Mosaico']], (v) => upd((q) => { q.imageScaleMode = v; }, 'Modo')),
        p.imageScaleMode === 'TILE' ? field('×', Math.round((p.scale || 1) * 100), (v) => upd((q) => { q.scale = Math.max(1, v) / 100; }, 'Escala'), { suffix: '%' }) : null),
      h('div', { class: 'row' }, adj('exposure', 'Ex'), adj('contrast', 'Co'), adj('saturation', 'Sa')),
      h('div', { class: 'row' }, adj('temperature', 'Te'), adj('tint', 'Ti'), adj('highlights', 'Lu'), adj('shadows', 'So')),
      h('button', { class: 'btn ghost', style: 'width:100%;margin-bottom:6px', onclick: () => pick.click() }, 'Cambiar imagen…'), pick);
  }

  // ---------------------------------------------------------------- efectos
  const ETYPES = [['DROP_SHADOW', 'Sombra'], ['INNER_SHADOW', 'Sombra interior'], ['FOREGROUND_BLUR', 'Desenfoque'], ['BACKGROUND_BLUR', 'Desenfoque de fondo']];
  function effectsSect() {
    const ns = A.selected(), fx = same(ns, (n) => n.effects || []);
    const add = h('button', { onclick: () => setAll('Efecto', (n) => { n.effects = [...(n.effects || []), { type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.25 }, offset: { x: 0, y: 4 }, radius: 4, spread: 0, visible: true, blendMode: 'NORMAL', showShadowBehindNode: false }]; }) }, '+');
    const box = sect(['Efectos', add]);
    if (fx === undefined) return box;
    fx.forEach((e, i) => {
      const upd = (f, lab = 'Efecto') => setAll(lab, (n) => { const arr = JSON.parse(JSON.stringify(n.effects || [])); f(arr[i], arr); n.effects = arr; });
      box.append(h('div', { class: 'paint' + (e.visible === false ? ' off' : '') }, select(e.type, ETYPES, (t) => upd((q) => { q.type = t; })),
        h('button', { class: 'vis', html: e.visible === false ? EYE_OFF : EYE, onclick: () => upd((q) => { q.visible = q.visible === false; }) }),
        h('button', { class: 'x', onclick: () => upd((q, arr) => arr.splice(i, 1)) }, '−')));
      if (e.type.endsWith('SHADOW')) {
        box.append(h('div', { class: 'row' }, field('X', e.offset?.x, (v) => upd((q) => { q.offset = { ...(q.offset || {}), x: v }; })), field('Y', e.offset?.y, (v) => upd((q) => { q.offset = { ...(q.offset || {}), y: v }; }))));
        box.append(h('div', { class: 'row' }, field('B', e.radius, (v) => upd((q) => { q.radius = Math.max(0, v); }), { title: 'Desenfoque' }), field('S', e.spread, (v) => upd((q) => { q.spread = v; }), { title: 'Extensión' }),
          h('div', { class: 'fld' }, h('span', { class: 'sw' }, h('i', { style: `background:${FR.css(e.color || {})}` }), h('input', { type: 'color', value: hex6(e.color), onchange: (ev) => upd((q) => { q.color = { ...fromHex(ev.target.value), a: q.color?.a ?? 0.25 }; }) })),
            h('input', { value: num((e.color?.a ?? 0.25) * 100), style: 'width:30px', onkeydown: (ev) => ev.stopPropagation(), onchange: (ev) => upd((q) => { q.color = { ...(q.color || {}), a: Math.max(0, Math.min(100, parseFloat(ev.target.value) || 0)) / 100 }; }) }), h('span', { style: 'color:var(--dim)' }, '%'))));
      } else box.append(h('div', { class: 'row' }, field('B', e.radius, (v) => upd((q) => { q.radius = Math.max(0, v); }), { title: 'Desenfoque' })));
    });
    return box;
  }

  // ---------------------------------------------------------------- auto layout
  const AL_SVG = { HORIZONTAL: '<svg viewBox="0 0 24 24"><path d="M4 12h16M14 6l6 6-6 6"/></svg>', VERTICAL: '<svg viewBox="0 0 24 24"><path d="M12 4v16M6 14l6 6 6-6"/></svg>', WRAP: '<svg viewBox="0 0 24 24"><path d="M4 7h14a3 3 0 010 6H8M11 10l-3 3 3 3"/></svg>' };
  function addAutoLayout(n) {
    if (n.stackMode && n.stackMode !== 'NONE') { n.stackMode = 'NONE'; return; }
    const kids = (n.children || []).filter((k) => k.visible !== false);
    const xs = kids.map((k) => A.doc.bounds(k)), spreadX = xs.length ? Math.max(...xs.map((b) => b.x)) - Math.min(...xs.map((b) => b.x)) : 1, spreadY = xs.length ? Math.max(...xs.map((b) => b.y)) - Math.min(...xs.map((b) => b.y)) : 0;
    const H = spreadX >= spreadY;
    if (kids.length) n.children.sort((a, b) => (H ? A.doc.bounds(a).x - A.doc.bounds(b).x : A.doc.bounds(a).y - A.doc.bounds(b).y));
    Object.assign(n, { stackMode: H ? 'HORIZONTAL' : 'VERTICAL', stackSpacing: 10, stackHorizontalPadding: 10, stackVerticalPadding: 10, stackPaddingRight: 10, stackPaddingBottom: 10,
      stackPrimaryAlignItems: 'MIN', stackCounterAlignItems: 'MIN', stackPrimarySizing: 'RESIZE_TO_FIT_WITH_IMPLICIT_SIZE', stackCounterSizing: 'RESIZE_TO_FIT_WITH_IMPLICIT_SIZE' });
  }
  A.on('autolayout', () => {
    const s = A.selected(); if (!s.length) return;
    if (s.length === 1 && s[0].type === 'FRAME' && !FR.isGroup(s[0])) A.change('Auto layout', () => addAutoLayout(s[0]));
    else A.change('Auto layout', () => { const f = A.doc.wrap(s, 'FRAME'); addAutoLayout(f); A.sel = [f.id]; });
  });
  function autoLayoutSect(n) {
    const on = n.stackMode && n.stackMode !== 'NONE';
    const box = sect(['Auto layout', h('button', { title: on ? 'Quitar' : 'Añadir (Shift+A)', onclick: () => A.change('Auto layout', () => addAutoLayout(n)) }, on ? '−' : '+')]);
    if (!on) return box;
    const set = (lab, f) => A.change(lab, () => { f(n); A.doc.reshape(n); });
    box.append(h('div', { class: 'row' }, h('div', { class: 'seg', style: 'flex:1' },
      ...['HORIZONTAL', 'VERTICAL'].map((m) => h('button', { class: n.stackMode === m ? 'on' : '', html: AL_SVG[m], title: m === 'HORIZONTAL' ? 'Horizontal' : 'Vertical', onclick: () => set('Dirección', (x) => { x.stackMode = m; }) })),
      h('button', { class: n.stackWrap === 'WRAP' ? 'on' : '', html: AL_SVG.WRAP, title: 'Ajustar a varias líneas', onclick: () => set('Wrap', (x) => { x.stackWrap = x.stackWrap === 'WRAP' ? 'NO_WRAP' : 'WRAP'; }) }))));
    // rejilla de alineación 3×3
    const grid = h('div', { style: 'display:grid;grid-template-columns:repeat(3,22px);gap:2px;background:var(--panel2);padding:4px;border-radius:4px' });
    const P = ['MIN', 'CENTER', 'MAX'], H = n.stackMode === 'HORIZONTAL';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const prim = H ? P[c] : P[r], cnt = H ? P[r] : P[c], cur = (n.stackPrimaryAlignItems || 'MIN') === prim && (n.stackCounterAlignItems || 'MIN') === cnt;
      grid.append(h('button', { style: `height:22px;border-radius:3px;${cur ? 'background:var(--acc)' : ''}`, onclick: () => set('Alinear', (x) => { x.stackPrimaryAlignItems = prim; x.stackCounterAlignItems = cnt; }) }, cur ? '' : '·'));
    }
    box.append(h('div', { class: 'row', style: 'align-items:flex-start' }, grid, h('div', { style: 'flex:1;display:flex;flex-direction:column;gap:6px' },
      field('↔', n.stackPrimaryAlignItems === 'SPACE_BETWEEN' ? undefined : n.stackSpacing, (v) => set('Espacio', (x) => { x.stackSpacing = v; if (x.stackPrimaryAlignItems === 'SPACE_BETWEEN') x.stackPrimaryAlignItems = 'MIN'; }), { title: 'Espacio entre elementos', mixed: true }),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: n.stackPrimaryAlignItems === 'SPACE_BETWEEN', onchange: (e) => set('Espacio', (x) => { x.stackPrimaryAlignItems = e.target.checked ? 'SPACE_BETWEEN' : 'MIN'; }) }), 'Repartir'))));
    box.append(h('div', { class: 'row' }, field('←', n.stackHorizontalPadding, (v) => set('Padding', (x) => { x.stackHorizontalPadding = v; })), field('↑', n.stackVerticalPadding, (v) => set('Padding', (x) => { x.stackVerticalPadding = v; })),
      field('→', n.stackPaddingRight ?? n.stackHorizontalPadding, (v) => set('Padding', (x) => { x.stackPaddingRight = v; })), field('↓', n.stackPaddingBottom ?? n.stackVerticalPadding, (v) => set('Padding', (x) => { x.stackPaddingBottom = v; }))));
    const fit = 'RESIZE_TO_FIT_WITH_IMPLICIT_SIZE', isFit = (v) => v === fit || v === 'RESIZE_TO_FIT';
    const wKey = H ? 'stackPrimarySizing' : 'stackCounterSizing', hKey = H ? 'stackCounterSizing' : 'stackPrimarySizing';
    box.append(h('div', { class: 'row' }, select(isFit(n[wKey]) ? 'HUG' : 'FIXED', [['FIXED', 'Ancho fijo'], ['HUG', 'Ancho: abrazar']], (v) => set('Tamaño', (x) => { x[wKey] = v === 'HUG' ? fit : 'FIXED'; })),
      select(isFit(n[hKey]) ? 'HUG' : 'FIXED', [['FIXED', 'Alto fijo'], ['HUG', 'Alto: abrazar']], (v) => set('Tamaño', (x) => { x[hKey] = v === 'HUG' ? fit : 'FIXED'; }))));
    return box;
  }
  // hijo de un auto layout: rellenar / fijo / posición absoluta
  function childLayoutSect(n) {
    const p = A.doc.parent(n); if (!p || !p.stackMode || p.stackMode === 'NONE') return null;
    const H = p.stackMode === 'HORIZONTAL';
    const grow = (n.stackChildPrimaryGrow || 0) > 0, stretch = n.stackChildAlignSelf === 'STRETCH';
    const w = H ? (grow ? 'FILL' : 'FIXED') : (stretch ? 'FILL' : 'FIXED'), hh = H ? (stretch ? 'FILL' : 'FIXED') : (grow ? 'FILL' : 'FIXED');
    const setW = (v) => A.change('Tamaño', () => { if (H) n.stackChildPrimaryGrow = v === 'FILL' ? 1 : 0; else n.stackChildAlignSelf = v === 'FILL' ? 'STRETCH' : 'AUTO'; A.doc.relayoutUp(n); });
    const setH = (v) => A.change('Tamaño', () => { if (H) n.stackChildAlignSelf = v === 'FILL' ? 'STRETCH' : 'AUTO'; else n.stackChildPrimaryGrow = v === 'FILL' ? 1 : 0; A.doc.relayoutUp(n); });
    return sect('Dentro del auto layout',
      h('div', { class: 'row' }, select(w, [['FIXED', 'Ancho fijo'], ['FILL', 'Ancho: rellenar']], setW), select(hh, [['FIXED', 'Alto fijo'], ['FILL', 'Alto: rellenar']], setH)),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: n.stackPositioning === 'ABSOLUTE', onchange: (e) => A.change('Posición absoluta', () => { n.stackPositioning = e.target.checked ? 'ABSOLUTE' : 'AUTO'; }) }), 'Posición absoluta'));
  }

  // ---------------------------------------------------------------- texto
  let FONTS = null;
  fetch('../studio/figfonts.json').then((r) => r.json()).then((j) => { FONTS = j; }).catch(() => {});
  const COMMON = ['Inter', 'Roboto', 'Montserrat', 'Poppins', 'Open Sans', 'Lato', 'Nunito', 'Fredoka', 'Luckiest Guy', 'Bangers', 'Oswald', 'Source Sans 3', 'Press Start 2P', 'Arimo', 'Ubuntu', 'Rubik', 'Baloo 2', 'Bungee', 'Lilita One', 'Titan One'];
  function textSect(ns) {
    const n0 = ns[0], fam = same(ns, (n) => n.fontName?.family), sty = same(ns, (n) => n.fontName?.style);
    const setT = (lab, f) => setAll(lab, (n) => { f(n); A.doc.reshape(n); FL.fitText(n); });
    const list = h('datalist', { id: 'font-list' }, ...[...new Set([...(FONTS ? Object.keys(FONTS) : []), ...COMMON])].sort().map((f) => h('option', { value: f })));
    const famIn = h('input', { value: fam || '', list: 'font-list', placeholder: 'Mixto', onkeydown: (e) => e.stopPropagation(), onchange: (e) => setT('Fuente', (n) => { n.fontName = { family: e.target.value, style: n.fontName?.style || 'Regular', postscript: '' }; }) });
    const styles = (FONTS && fam && FONTS[fam]) || ['Thin', 'Light', 'Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold', 'Black', 'Italic', 'Bold Italic'];
    const lh = same(ns, (n) => n.lineHeight), auto = !lh || (lh.units === 'PERCENT' && Math.abs(lh.value - 100) < 1e-3);
    const ls = same(ns, (n) => n.letterSpacing);
    const AL = (v, cur, k, lab) => h('button', { class: cur === v ? 'on' : '', title: lab, onclick: () => setT('Alinear texto', (n) => { n[k] = v; }) }, lab);
    return sect('Texto',
      list, h('div', { class: 'row' }, h('div', { class: 'fld' }, famIn)),
      h('div', { class: 'row' }, select(sty || '', [...(sty ? [] : [['', 'Mixto']]), ...styles.map((s) => [s, s])], (v) => setT('Estilo', (n) => { n.fontName = { ...(n.fontName || {}), style: v, postscript: '' }; })),
        field('Aa', same(ns, (n) => n.fontSize), (v) => setT('Tamaño', (n) => { n.fontSize = Math.max(1, v); }), { min: 1, title: 'Tamaño' })),
      h('div', { class: 'row' }, h('div', { class: 'fld' }, h('label', { title: 'Interlineado' }, '↕'), h('input', { value: auto ? 'Auto' : lh.units === 'PIXELS' ? num(lh.value) : num(lh.value) + '%', onkeydown: (e) => e.stopPropagation(),
        onchange: (e) => setT('Interlineado', (n) => { const s = e.target.value.trim(); n.lineHeight = /auto/i.test(s) || !s ? { value: 100, units: 'PERCENT' } : /%$/.test(s) ? { value: parseFloat(s), units: 'PERCENT' } : { value: parseFloat(s), units: 'PIXELS' }; }) })),
        h('div', { class: 'fld' }, h('label', { title: 'Espaciado' }, '|A|'), h('input', { value: ls ? (ls.units === 'PIXELS' ? num(ls.value) : num(ls.value) + '%') : '0%', onkeydown: (e) => e.stopPropagation(),
          onchange: (e) => setT('Espaciado', (n) => { const s = e.target.value.trim(); n.letterSpacing = /px$|^[-\d.]+$/.test(s) && !/%/.test(s) ? { value: parseFloat(s), units: 'PIXELS' } : { value: parseFloat(s) || 0, units: 'PERCENT' }; }) }))),
      h('div', { class: 'row' }, h('div', { class: 'seg', style: 'flex:1' }, ...[['LEFT', '⇤'], ['CENTER', '↔'], ['RIGHT', '⇥'], ['JUSTIFIED', '≡']].map(([v, l]) => AL(v, n0.textAlignHorizontal || 'LEFT', 'textAlignHorizontal', l))),
        h('div', { class: 'seg', style: 'flex:1' }, ...[['TOP', '⤒'], ['CENTER', '↕'], ['BOTTOM', '⤓']].map(([v, l]) => AL(v, n0.textAlignVertical || 'TOP', 'textAlignVertical', l)))),
      h('div', { class: 'row' }, h('div', { class: 'seg', style: 'flex:1' }, ...[['WIDTH_AND_HEIGHT', 'Ancho auto'], ['HEIGHT', 'Alto auto'], ['NONE', 'Fijo']].map(([v, l]) => AL(v, n0.textAutoResize || 'NONE', 'textAutoResize', l)))),
      h('div', { class: 'row' }, select(same(ns, (n) => n.textDecoration) || 'NONE', [['NONE', 'Sin decoración'], ['UNDERLINE', 'Subrayado'], ['STRIKETHROUGH', 'Tachado']], (v) => setT('Decoración', (n) => { n.textDecoration = v; })),
        select(same(ns, (n) => n.textCase) || 'ORIGINAL', [['ORIGINAL', 'Aa'], ['UPPER', 'AA'], ['LOWER', 'aa'], ['TITLE', 'Aa Bb']], (v) => setT('Mayúsculas', (n) => { n.textCase = v; }))));
  }

  // ---------------------------------------------------------------- propiedades
  function renderProps() {
    const el = $('#props'); el.innerHTML = '';
    const ns = A.selected();
    if (!ns.length) {
      const pg = A.doc.page;
      el.append(sect('Página', h('div', { class: 'row' }, h('div', { class: 'fld' }, h('span', { class: 'sw' }, h('i', { style: `background:${FR.css(pg.backgroundColor || { r: 0.118, g: 0.118, b: 0.118 })}` }),
        h('input', { type: 'color', value: hex6(pg.backgroundColor), onchange: (e) => A.change('Fondo', () => { pg.backgroundColor = fromHex(e.target.value); }, { relayout: false }) })), h('span', { style: 'margin-left:8px' }, hex6(pg.backgroundColor))))));
      el.append(h('div', { class: 'empty' }, 'Selecciona una capa para ver sus propiedades. Pega aquí con Ctrl+V lo que copies en Figma.'));
      return;
    }
    const n0 = ns[0], one = ns.length === 1;
    // tipo y posición
    const loc = (n) => { const t = n.transform || {}; return { x: t.m02 || 0, y: t.m12 || 0, rot: A.doc.rotation(n) }; };
    el.append(sect(one ? (FR.isGroup(n0) ? 'Grupo' : n0.type === 'ROUNDED_RECTANGLE' ? 'Rectángulo' : n0.type.charAt(0) + n0.type.slice(1).toLowerCase()) : `${ns.length} capas`,
      h('div', { class: 'row' }, field('X', same(ns, (n) => loc(n).x), (v) => setAll('X', (n) => { A.doc.translate(n, v - loc(n).x, 0); }), { mixed: true }),
        field('Y', same(ns, (n) => loc(n).y), (v) => setAll('Y', (n) => { A.doc.translate(n, 0, v - loc(n).y); }), { mixed: true })),
      h('div', { class: 'row' }, field('W', same(ns, (n) => n.size?.x), (v) => setAll('Ancho', (n) => { const t = n.transform || {}; A.doc.setBox(n, t.m02 || 0, t.m12 || 0, Math.max(0.01, v), n.size?.y || 0); }), { mixed: true, min: 0 }),
        field('H', same(ns, (n) => n.size?.y), (v) => setAll('Alto', (n) => { const t = n.transform || {}; A.doc.setBox(n, t.m02 || 0, t.m12 || 0, n.size?.x || 0, Math.max(0.01, v)); }), { mixed: true, min: 0 })),
      h('div', { class: 'row' }, field('↻', same(ns, (n) => Math.round(-loc(n).rot * 100) / 100), (v) => setAll('Girar', (n) => A.doc.rotateTo(n, -v)), { mixed: true, suffix: '°', title: 'Giro (antihorario, como Figma)' }),
        n0.type !== 'TEXT' && n0.type !== 'LINE' && !FR.isGroup(n0) ? field('◜', same(ns, (n) => n.cornerRadius || 0), (v) => setAll('Radio', (n) => { n.cornerRadius = Math.max(0, v); n.rectangleCornerRadiiIndependent = false;
          n.rectangleTopLeftCornerRadius = n.rectangleTopRightCornerRadius = n.rectangleBottomLeftCornerRadius = n.rectangleBottomRightCornerRadius = Math.max(0, v); A.doc.reshape(n); }), { mixed: true, min: 0, title: 'Radio de esquina' }) : h('span', { style: 'flex:1' })),
      one && FM.CONTAINERS.has(n0.type) && !FR.isGroup(n0) ? h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !n0.frameMaskDisabled, onchange: (e) => A.change('Recortar', () => { n0.frameMaskDisabled = !e.target.checked; }, { relayout: false }) }), 'Recortar contenido') : null));
    if (one && !FR.isGroup(n0) && (n0.rectangleCornerRadiiIndependent !== undefined || ['ROUNDED_RECTANGLE', 'FRAME'].includes(n0.type))) {
      const R4 = FR.radiiOf(n0), setR = (i) => (v) => A.change('Radio', () => { const r = FR.radiiOf(n0); r[i] = Math.max(0, v); [n0.rectangleTopLeftCornerRadius, n0.rectangleTopRightCornerRadius, n0.rectangleBottomRightCornerRadius, n0.rectangleBottomLeftCornerRadius] = r; n0.rectangleCornerRadiiIndependent = true; A.doc.reshape(n0); });
      el.lastChild.append(h('div', { class: 'row' }, field('⌜', R4[0], setR(0)), field('⌝', R4[1], setR(1)), field('⌟', R4[2], setR(2)), field('⌞', R4[3], setR(3))));
    }
    if (one) { const c = childLayoutSect(n0); if (c) el.append(c); }
    if (one && n0.type === 'FRAME' && !FR.isGroup(n0)) el.append(autoLayoutSect(n0));
    // capa
    el.append(sect('Capa', h('div', { class: 'row' }, select(same(ns, (n) => n.blendMode || 'PASS_THROUGH') || 'PASS_THROUGH', [['PASS_THROUGH', 'Atravesar'], ...BLENDS.map((b) => [b, blendName(b)])], (v) => setAll('Fusión', (n) => { n.blendMode = v; }, { relayout: false })),
      field('%', same(ns, (n) => Math.round((n.opacity ?? 1) * 100)), (v) => setAll('Opacidad', (n) => { n.opacity = Math.max(0, Math.min(100, v)) / 100; }, { relayout: false }), { mixed: true, suffix: '%' }))));
    if (ns.every((n) => n.type === 'TEXT')) el.append(textSect(ns));
    if (!FR.isGroup(n0)) el.append(paintRows('fillPaints', 'Relleno'));
    el.append(paintRows('strokePaints', 'Borde'));
    el.append(effectsSect());
    el.append(sect('Exportar', h('div', { class: 'row' }, h('button', { class: 'btn ghost', style: 'flex:1', onclick: () => A.exportPng(1) }, 'PNG 1x'), h('button', { class: 'btn ghost', style: 'flex:1', onclick: () => A.exportPng(2) }, 'PNG 2x'),
      h('button', { class: 'btn', style: 'flex:1', onclick: () => A.copy(false) }, 'A Figma'))));
  }

  let geoTimer = 0;
  A.on('doc', () => { renderPages(); renderLayers(); });
  A.on('sel', () => { A.scrollLayer = true; renderLayers(); renderProps(); });
  A.on('geo', () => { clearTimeout(geoTimer); geoTimer = setTimeout(renderProps, 60); });
})();
