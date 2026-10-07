/* RbxUI Studio — editor visual tipo Figma sobre el design system (ds.css + render.js).
   Escenas en screens/<Name>.scene.json; "Exportar a Roblox" ejecuta export.mjs vía server.mjs.
   Atajos: Clic seleccionar · Ctrl+clic selección profunda · Doble clic entrar · Esc subir al padre · Shift+clic añadir
           Arrastrar mover (Shift bloquea eje, Alt sin imán) · Asas redimensionar (Shift proporción)
           Flechas mover 1px (Shift 10px) · Ctrl+D duplicar · Ctrl+C / Ctrl+V · Supr borrar
           Ctrl+G agrupar · Ctrl+Shift+G desagrupar · Ctrl+] / Ctrl+[ adelante / atrás
           Ctrl+Z / Ctrl+Y · Ctrl+S guardar · Espacio+arrastrar o rueda mover vista · Ctrl+rueda zoom · Shift+1 ajustar */
(() => {
  'use strict';

  // ---------------------------------------------------------------- utilidades
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'style') el.style.cssText = v;
      else if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'innerHTML') el[k] = v;
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
    return el;
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r2 = (v) => Math.round(v * 2) / 2;
  const uid = () => 'n' + Math.random().toString(36).slice(2, 9);
  const tokens = (n) => (n.cls || '').split(/\s+/).filter(Boolean);
  const hasTok = (n, t) => tokens(n).includes(t);
  const getTok = (n, re) => tokens(n).find((t) => re.test(t)) || '';
  const setTok = (n, re, tok) => { const t = tokens(n).filter((x) => !re.test(x)); if (tok) t.push(tok); n.cls = t.join(' '); };
  const styleMap = (n) => {
    const m = new Map();
    for (const part of (n.style || '').split(';')) { const i = part.indexOf(':'); if (i > 0) m.set(part.slice(0, i).trim(), part.slice(i + 1).trim()); }
    return m;
  };
  const getSt = (n, k) => styleMap(n).get(k) || '';
  const setSt = (n, k, v) => { const m = styleMap(n); if (v === '' || v == null) m.delete(k); else m.set(k, String(v)); n.style = [...m].map(([a, b]) => `${a}:${b}`).join(';'); };

  const THEMES = { orange: '#ff9a1e', yellow: '#ffc21e', gold: '#ffd23a', red: '#f23a30', pink: '#ff4fb4', lime: '#9cf01e', green: '#3ad23a',
    teal: '#22d6c0', cyan: '#3cc8ff', blue: '#2e7cff', purple: '#a64aff', grey: '#c2c8d4' };
  const VARIANTS = [['', '—'], ['v-std', 'Color (tema)'], ['v-card', 'Tarjeta radial'], ['v-tile', 'Slot (Index)'], ['v-cta', 'Lima (acción)'],
    ['v-pink', 'Rosa (Robux)'], ['v-danger', 'Rojo (cerrar)'], ['v-gold', 'Dorado'], ['v-grey', 'Gris'], ['v-box', 'Caja oscura']];
  const TSIZES = [['t-title', 'Título 26'], ['t-big', 'Grande 24'], ['t-cur', 'Divisa 30'], ['t-label', 'Etiqueta 17'], ['t-small', 'Pequeño 13'], ['t-xs', 'Mini 11']];
  const TCOLORS = [['', 'Blanco'], ['t-gold', 'Dorado'], ['t-lime', 'Lima'], ['t-pink', 'Rosa'], ['t-red', 'Rojo']];
  const RE_SIZE = /^t-(title|big|cur|label|small|xs)$/, RE_COLOR = /^t-(gold|lime|pink|red)$/, RE_ALIGN = /^t-(left|right)$/;

  // ---------------------------------------------------------------- estado
  const S = { play: false, playVis: {}, openWins: [], scene: null, name: null, sel: [], zoom: 1, px: 0, py: 0, undo: [], redo: [], map: {}, dirty: false,
    clip: null, collapsed: new Set(), hover: null, icons: [], space: false, drag: null };
  const stageEl = () => $('#st-stage');
  const R = window.RBXJson, KIT = window.StudKit, SVGI = window.ICON;   // SVGI = iconos SVG de la interfaz (icons.js)
  const isNative = () => !!(S.scene && S.scene.native);
  const COARSE = matchMedia('(pointer: coarse)').matches;               // pantalla táctil: asas más grandes

  // ---------------------------------------------------------------- árbol
  function walk(fn, list = S.scene.nodes, parent = null) {
    for (const n of list) {
      if (fn(n, parent) === false) return false;
      if (n.children && walk(fn, n.children, n) === false) return false;
    }
  }
  function find(id) { let r = null; walk((n, p) => { if (n.id === id) { r = { n, p }; return false; } }); return r; }
  const node = (id) => find(id)?.n || null;
  const parentOf = (id) => find(id)?.p || null;
  const listOf = (id) => parentOf(id)?.children || S.scene.nodes;
  function chainOf(id) { const out = []; let cur = find(id); while (cur) { out.unshift(cur.n); cur = cur.p ? find(cur.p.id) : null; } return out; }
  const isContainer = (n) => n && (n.rbxClass ? true : (n.type === 'box' || n.type === 'group') && !hasTok(n, 'fx'));
  const isLockedDeep = (id) => chainOf(id).some((n) => n.locked || n.hidden);
  const reid = (n) => { n.id = uid(); (n.children || []).forEach(reid); return n; };
  const clone = (n) => JSON.parse(JSON.stringify(n));
  // quita de una lista de ids los que son descendientes de otro id de la lista
  const topLevel = (ids) => ids.filter((id) => !ids.some((o) => o !== id && chainOf(id).some((a) => a.id === o)));

  // ---------------------------------------------------------------- geometría (unidades del escenario)
  function boxOf(id) {
    const el = S.map[id]; if (!el) return null;
    const r = el.getBoundingClientRect(), s = stageEl().getBoundingClientRect();
    return { x: (r.left - s.left) / S.zoom, y: (r.top - s.top) / S.zoom, w: r.width / S.zoom, h: r.height / S.zoom };
  }
  function originOf(p) {       // esquina de la caja de relleno del contenedor (donde empieza x=0 de sus hijos)
    if (!p) return { x: 0, y: 0 };
    const b = boxOf(p.id), el = S.map[p.id];
    return { x: b.x + el.clientLeft, y: b.y + el.clientTop };
  }
  function innerBox(p) {
    if (!p) return { x: 0, y: 0, w: S.scene.stage.w, h: S.scene.stage.h };
    const o = originOf(p), el = S.map[p.id];
    return { x: o.x, y: o.y, w: el.clientWidth, h: el.clientHeight };
  }
  const union = (bs) => {
    const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y));
    return { x, y, w: Math.max(...bs.map((b) => b.x + b.w)) - x, h: Math.max(...bs.map((b) => b.y + b.h)) - y };
  };

  // ---------------------------------------------------------------- historial
  const snap = () => JSON.stringify(S.scene);
  function pushUndo(before) { S.undo.push(before || snap()); if (S.undo.length > 200) S.undo.shift(); S.redo = []; markDirty(); }
  function undo() { if (!S.undo.length) return; S.redo.push(snap()); S.scene = JSON.parse(S.undo.pop()); markDirty(); refresh(); }
  function redo() { if (!S.redo.length) return; S.undo.push(snap()); S.scene = JSON.parse(S.redo.pop()); markDirty(); refresh(); }
  function markDirty() { const was = S.dirty; S.dirty = true; document.title = '● ' + (S.name || '') + ' — RbxUI Studio'; if (!was) pushState(); }
  function status(msg, err, details) {
    const e = $('#st-status'); e.textContent = msg; e.classList.toggle('err', !!err);
    S.statusDetails = details || null; e.classList.toggle('more', !!details); e.title = details ? 'Clic para ver los avisos' : '';
    e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash');
  }

  // ---------------------------------------------------------------- render
  function renderCanvas() {
    if (S.play) return renderPlay();
    S.map = RBXRender.renderScene(S.scene, stageEl(), { editor: true });
  }
  function refresh(keepProps) {
    if (isNative()) walk((n) => { if (n.rbxClass) R.relayout(n); });
    renderCanvas();
    scheduleCheck(); refreshDevices();
    S.sel = S.sel.filter((id) => S.map[id]);
    drawOverlay(); renderLayers();
    if (!keepProps) renderProps();
    const em = $('#st-empty');
    if (S.scene && !em.hidden && em.style.pointerEvents === 'none' && S.scene.nodes.length) showEmpty(null);
    else if (S.scene && em.hidden && !S.scene.nodes.length && !S.play) showEmpty('scene');
  }
  const update = () => refresh(true);   // tras editar una propiedad (no rehace el panel para no perder el foco)
  function applyGeom(n) {
    const el = S.map[n.id]; if (!el) return;
    const off = el.parentElement && el.parentElement.classList.contains('fxclip') ? 1 : 0;
    el.style.left = (n.x - off) + 'px'; el.style.top = (n.y - off) + 'px';
    el.style.width = n.w + 'px'; el.style.height = n.h + 'px';
  }

  // ---------------------------------------------------------------- vista
  const canvas = $('#st-canvas');
  function applyView() {
    $('#st-world').style.transform = `translate(${S.px}px,${S.py}px) scale(${S.zoom})`;
    $('#st-zoom').textContent = Math.round(S.zoom * 100) + '%';
    drawOverlay();
  }
  // caja de todo el contenido: el marco (escenario) + lo que esté fuera de él, como el lienzo de Figma
  function contentBox() {
    let b = { x: 0, y: 0, w: S.scene?.stage.w || 1280, h: S.scene?.stage.h || 720 };
    for (const n of S.scene?.nodes || []) if (!n.hidden) b = union([b, { x: n.x, y: n.y, w: n.w, h: n.h }]);
    return b;
  }
  function fitRect(b, pad = 72) {
    const r = canvas.getBoundingClientRect();
    if (r.width < 120 || r.height < 120) { S.needFit = true; return; }   // el panel aún no tiene tamaño
    S.needFit = false;
    S.zoom = clamp(Math.min((r.width - pad) / b.w, (r.height - pad) / b.h), 0.05, 8);
    S.px = (r.width - b.w * S.zoom) / 2 - b.x * S.zoom; S.py = (r.height - b.h * S.zoom) / 2 - b.y * S.zoom;
    applyView();
  }
  function fitView() { if (S.scene) fitRect(contentBox()); }
  function fitSelection() { const bs = S.sel.map(boxOf).filter(Boolean); if (bs.length) fitRect(union(bs), 200); else fitView(); }
  function zoomTo(z) {
    const r = canvas.getBoundingClientRect(), mx = r.width / 2, my = r.height / 2, z0 = S.zoom;
    S.px = mx - ((mx - S.px) * z) / z0; S.py = my - ((my - S.py) * z) / z0; S.zoom = z; applyView();
  }

  // ---------------------------------------------------------------- overlay
  function drawOverlay(guides = []) {
    const ov = $('#st-overlay'); ov.innerHTML = '';
    if (!S.scene) return;
    const z = S.zoom, px = (v) => v + 'px';
    const pos = (b) => `left:${px(b.x)};top:${px(b.y)};width:${px(b.w)};height:${px(b.h)};`;
    ov.append(h('div', { class: 'st-ov-frame', style: `top:${px(-20 / z)};transform:scale(${1 / z});transform-origin:0 0` }, h('b', {}, S.name || ''), `${S.scene.stage.w} × ${S.scene.stage.h}`));
    if (S.drag?.type === 'draw' && S.drag.rect) ov.append(h('div', { class: 'st-ov-draw', style: pos(S.drag.rect) + `border-width:${1 / z}px` }));
    if (isNative()) ov.append(h('div', { class: 'st-ov-topbar', style: `width:${px(S.scene.stage.w)};height:${px(R.TOPBAR)}` },
      h('span', { style: `transform:scale(${1 / z})` }, 'Barra superior de Roblox (58 px)')));
    if (S.hover && !S.sel.includes(S.hover) && !S.drag) {
      const b = boxOf(S.hover); if (b) ov.append(h('div', { class: 'st-ov-hover', style: pos(b) + `border-width:${1 / z}px` }));
    }
    for (const id of S.sel) {
      const b = boxOf(id); if (b) ov.append(h('div', { class: 'st-ov-sel', style: pos(b) + `border-width:${1.5 / z}px` }));
    }
    if (S.sel.length === 1) {
      const b = boxOf(S.sel[0]), n = node(S.sel[0]);
      if (b && n) {
        const hs = (COARSE ? 20 : 8) / z;
        const pts = { nw: [0, 0], n: [.5, 0], ne: [1, 0], e: [1, .5], se: [1, 1], s: [.5, 1], sw: [0, 1], w: [0, .5] };
        for (const [dir, [fx, fy]] of Object.entries(pts)) {
          ov.append(h('div', { class: 'st-ov-handle', 'data-dir': dir,
            style: `left:${px(b.x + b.w * fx - hs / 2)};top:${px(b.y + b.h * fy - hs / 2)};width:${px(hs)};height:${px(hs)};border-width:${1 / z}px;cursor:${dir}-resize` }));
        }
        ov.append(h('div', { class: 'st-ov-size', style: `left:${px(b.x + b.w / 2)};top:${px(b.y + b.h + 6 / z)};transform:scale(${1 / z}) translateX(-50%)` },
          `${Math.round(n.w)} × ${Math.round(n.h)}`));
      }
    }
    if (S.alt && S.sel.length === 1) drawMeasures(ov, z, px);
    for (const g of guides) {
      ov.append(h('div', { class: 'st-ov-guide', style: g.axis === 'x'
        ? `left:${px(g.v - .5 / z)};top:-20000px;width:${px(1 / z)};height:40000px`
        : `top:${px(g.v - .5 / z)};left:-20000px;height:${px(1 / z)};width:40000px` }));
    }
  }

  // medir como en Figma: con Alt, distancias de la selección a la capa bajo el ratón (o a su contenedor / la pantalla)
  function measureTarget() {
    const id = S.sel[0];
    if (S.hover && S.hover !== id) return boxOf(S.hover);
    const p = parentOf(id);
    if (p) return boxOf(p.id);
    return { x: 0, y: 0, w: S.scene.stage.w, h: S.scene.stage.h };
  }
  function drawMeasures(ov, z, px) {
    const A = boxOf(S.sel[0]), B = measureTarget();
    if (!A || !B) return;
    const line = (x, y, w, hh, v, lx, ly) => {
      if (Math.round(v) === 0) return;
      ov.append(h('div', { class: 'st-ov-measure', style: `left:${px(x)};top:${px(y)};width:${px(Math.max(w, 1 / z))};height:${px(Math.max(hh, 1 / z))}` }));
      ov.append(h('div', { class: 'st-ov-mlabel', style: `left:${px(lx)};top:${px(ly)};transform:translate(-50%,-50%) scale(${1 / z})` }, String(Math.round(v))));
    };
    const ax2 = A.x + A.w, ay2 = A.y + A.h, bx2 = B.x + B.w, by2 = B.y + B.h, cx = A.x + A.w / 2, cy = A.y + A.h / 2;
    const inside = A.x >= B.x - 0.5 && A.y >= B.y - 0.5 && ax2 <= bx2 + 0.5 && ay2 <= by2 + 0.5;
    if (inside) {                                // dentro: los cuatro márgenes hasta los bordes del contenedor
      line(B.x, cy, A.x - B.x, 0, A.x - B.x, (B.x + A.x) / 2, cy);
      line(ax2, cy, bx2 - ax2, 0, bx2 - ax2, (ax2 + bx2) / 2, cy);
      line(cx, B.y, 0, A.y - B.y, A.y - B.y, cx, (B.y + A.y) / 2);
      line(cx, ay2, 0, by2 - ay2, by2 - ay2, cx, (ay2 + by2) / 2);
      return;
    }
    // separadas: hueco horizontal y/o vertical entre las cajas
    const my = (Math.max(A.y, B.y) + Math.min(ay2, by2)) / 2, mx = (Math.max(A.x, B.x) + Math.min(ax2, bx2)) / 2;
    const yy = Math.max(A.y, B.y) < Math.min(ay2, by2) ? my : cy, xx = Math.max(A.x, B.x) < Math.min(ax2, bx2) ? mx : cx;
    if (B.x >= ax2) line(ax2, yy, B.x - ax2, 0, B.x - ax2, (ax2 + B.x) / 2, yy);
    else if (bx2 <= A.x) line(bx2, yy, A.x - bx2, 0, A.x - bx2, (bx2 + A.x) / 2, yy);
    if (B.y >= ay2) line(xx, ay2, 0, B.y - ay2, B.y - ay2, xx, (ay2 + B.y) / 2);
    else if (by2 <= A.y) line(xx, by2, 0, A.y - by2, A.y - by2, xx, (by2 + A.y) / 2);
  }
  // márgenes de la capa a su contenedor (para comprobar que el padding es igual en todos los lados)
  function marginsRow(n) {
    const A = boxOf(n.id); if (!A) return null;
    const p = parentOf(n.id), B = p ? boxOf(p.id) : { x: 0, y: 0, w: S.scene.stage.w, h: S.scene.stage.h };
    if (!B) return null;
    const m = [A.x - B.x, A.y - B.y, B.x + B.w - A.x - A.w, B.y + B.h - A.y - A.h].map((v) => Math.round(v));
    const eqH = Math.abs(m[0] - m[2]) <= 1, eqV = Math.abs(m[1] - m[3]) <= 1;
    const cell = (lab, v, ok) => h('span', { class: 'st-mcell' + (ok ? '' : ' warn'), title: ok ? '' : 'No coincide con el lado opuesto' }, h('b', {}, lab), String(v));
    return h('div', { class: 'st-row st-margins', title: 'Distancia a los bordes del contenedor (Alt + ratón para medir a otras capas)' },
      h('span', { class: 'st-l' }, 'Márgenes'), cell('I', m[0], eqH), cell('A', m[1], eqV), cell('D', m[2], eqH), cell('B', m[3], eqV));
  }

  // ---------------------------------------------------------------- comprobación contra la API oficial de Roblox (rbxcheck.js)
  let API = null, checkTimer = 0, lastCheck = { errs: [], warns: [] };
  fetch('roblox-api.json').then((r) => r.json()).then((j) => { API = j; scheduleCheck(); }).catch(() => {});
  function scheduleCheck() { clearTimeout(checkTimer); checkTimer = setTimeout(runCheck, 500); }
  function runCheck() {
    const b = $('#st-check');
    if (!API || !S.scene || !isNative() || !window.RBXCheck) { b.hidden = true; return; }
    b.hidden = false;
    try { lastCheck = window.RBXCheck.checkDoc({ format: 'rbxui', version: 1, screens: [R.sceneToScreen(S.scene)] }, API); }
    catch (e) { lastCheck = { errs: [{ path: '', msg: String(e.message || e) }], warns: [] }; }
    const ne = lastCheck.errs.length, nw = lastCheck.warns.length;
    b.textContent = ne ? `✕ ${ne}` : nw ? `⚠ ${nw}` : '✓';
    b.className = 'st-check' + (ne ? ' err' : nw ? ' warn' : ' ok');
    b.title = ne || nw ? `${ne} error(es), ${nw} aviso(s) contra la API de Roblox — clic para verlos` : 'Todo válido según la API oficial de Roblox';
    if (winById('check')) renderCheck();
  }
  // ruta "Pantalla.A.B" del exportado -> nodo de la escena (por nombres)
  function nodeByPath(path) {
    const parts = path.split('.').slice(1); let list = S.scene.nodes, hit = null;
    for (const p of parts) { hit = (list || []).find((n) => (n.name || n.rbxClass) === p); if (!hit) return null; list = hit.children; }
    return hit;
  }
  function renderCheck() {
    const w = winById('check'); if (!w) return;
    const item = (kind, x) => { const n = nodeByPath(x.path); return h('button', { class: 'st-dev-issue', onclick: () => n && setSel([n.id]) },
      h('b', {}, kind === 'e' ? '✕' : '⚠'), h('span', {}, h('strong', {}, (x.path.split('.').pop() || 'Pantalla') + ' '), x.msg)); };
    const all = [...lastCheck.errs.map((x) => item('e', x)), ...lastCheck.warns.map((x) => item('w', x))];
    w.set([h('p', { class: 'st-note' }, 'Propiedades, enums y tipos comprobados contra la API oficial de Roblox (Roblox/creator-docs). Clic = seleccionar la capa.'),
      ...(all.length ? all : [stateBox('ok', 'Todo válido', 'Ninguna propiedad desconocida, enum inválido ni nombre repetido.', [], 'sm')])]);
  }
  function openCheck() {
    const w = openWin({ id: 'check', modal: false, width: 440, icon: 'check', title: 'Comprobación', sub: 'API oficial de Roblox' });
    renderCheck(); return w;
  }

  // ---------------------------------------------------------------- vista por dispositivo
  // La escena se recalcula al tamaño del aparato (Scale/AnchorPoint como Roblox) y se aplica el auto-escalado de RbxUINative
  // (UIScale = min(ancho/diseño, alto/diseño) en cada hijo directo, con origen en su AnchorPoint). Zonas de pulgar marcadas.
  const DEVICES = [['phone', 'Móvil · 844×390', 844, 390, 'touch'], ['phone-s', 'Móvil pequeño · 667×375', 667, 375, 'touch'],
    ['tablet', 'Tablet · 1024×768', 1024, 768, 'touch'], ['pc', 'PC · 1920×1080', 1920, 1080, 'pc'], ['tv', 'TV / consola · 3840×2160', 3840, 2160, 'pad']];
  let devTimer = 0;
  const refreshDevices = () => { if (!winById('devices')) return; clearTimeout(devTimer); devTimer = setTimeout(renderDevices, 250); };
  function openDevices() {
    if (!S.scene || !isNative()) { toast('La vista por dispositivo es para escenas nativas (rbxui)', 'warn'); return; }
    S.devPick ||= 'phone';
    const w = openWin({ id: 'devices', modal: false, width: 620, icon: 'devices', title: 'Vista por dispositivo', sub: 'Así se recoloca en cada pantalla',
      onClose: () => $('#st-devices').classList.remove('on') });
    $('#st-devices').classList.add('on');
    const pick = h('div', { class: 'st-dev-pick' }, ...DEVICES.map(([id, label]) => h('button', { class: 'st-btn' + (S.devPick === id ? ' on' : ''), 'data-dev': id,
      onclick: () => { S.devPick = id; pick.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.dev === id)); renderDevices(); } }, label)));
    w.set([pick, h('div', { class: 'st-dev-box' }), h('div', { class: 'st-dev-issues' })]);
    requestAnimationFrame(renderDevices);
  }
  function renderDevices() {
    const w = winById('devices'); if (!w || !S.scene) return;
    const dev = DEVICES.find((d) => d[0] === S.devPick) || DEVICES[0], [, , DW, DH, input] = dev;
    const d0 = { ...R.DESIGN_DEF, ...(S.scene.design || {}) };
    const sg = R.sceneToScreen(S.scene);
    sg.design = { ...d0, width: DW, height: DH };
    const sc = R.screenToScene(sg);
    const f = d0.autoScale === false ? 1 : Math.min(DW / d0.width, DH / d0.height);
    const box = w.body.querySelector('.st-dev-box'); box.innerHTML = '';
    const k = Math.min((box.clientWidth || 580) / DW, 360 / DH);
    const stage = h('div', { class: 'stage st-dev-stage', style: `width:${DW}px;height:${DH}px;transform:scale(${k});transform-origin:0 0` });
    box.append(h('div', { class: 'st-dev-wrap', style: `width:${Math.round(DW * k)}px;height:${Math.round(DH * k)}px` }, stage));
    const map = RBXRender.renderScene(sc, stage, { export: true, play: true });
    if (f !== 1) for (const n of sc.nodes) {
      const el = map[n.id]; if (!el) continue;
      const A = R.prop(n, 'AnchorPoint') || [0, 0];
      el.style.transformOrigin = `${A[0] * 100}% ${A[1] * 100}%`;
      el.style.transform = `${el.style.transform || ''} scale(${f})`.trim();
    }
    // zonas
    const zone = (cls, css, label) => stage.append(h('div', { class: 'st-dev-zone ' + cls, style: css }, h('span', { style: `transform:scale(${1 / k})` }, label)));
    zone('top', `left:0;top:0;width:100%;height:${R.TOPBAR}px`, 'Barra de Roblox');
    if (input === 'touch') {
      zone('thumb', `left:0;bottom:0;width:${Math.min(DW * 0.4, 420)}px;height:${Math.min(DH * 0.45, 340)}px`, '≈ joystick');
      zone('thumb', `right:0;bottom:0;width:${Math.min(DW * 0.24, 230)}px;height:${Math.min(DH * 0.42, 230)}px`, '≈ saltar');
    }
    if (input === 'pad') zone('tv', `left:5%;top:5%;width:90%;height:90%`, 'zona segura TV ≈ 90 %');
    // problemas: botones pequeños para el dedo y textos ilegibles en este aparato
    const issues = [], stageBox = stage.getBoundingClientRect();
    const walk = (list) => { for (const n of list) {
      const el = map[n.id];
      if (el && R.prop(n, 'Visible') !== false) {
        const r = el.getBoundingClientRect(), wpx = r.width / k, hpx = r.height / k;
        const clickable = /Button/.test(n.rbxClass || '') || n.buttonFx || (n.interactions && n.interactions.length);
        if (input === 'touch' && clickable && Math.min(wpx, hpx) < 44) { issues.push(['dedo', `${n.name}: ${Math.round(wpx)}×${Math.round(hpx)} px (mínimo 44)`, n.id]); el.classList.add('st-dev-bad'); }
        if (R.TEXT.has(n.rbxClass) && !R.prop(n, 'TextScaled') && String(R.prop(n, 'Text') || '').trim()) {
          const ts = (+R.prop(n, 'TextSize') || 14) * f;
          if (ts < 9) { issues.push(['texto', `${n.name}: texto de ${ts.toFixed(1)} px (mínimo 9)`, n.id]); el.classList.add('st-dev-bad'); }
        }
      }
      walk(n.children || []);
    } };
    walk(sc.nodes);
    const ids = new Map(); (function idx(list) { for (const n of list) { ids.set(n.name, n.id); idx(n.children || []); } })(S.scene.nodes);
    w.body.querySelector('.st-dev-issues').replaceChildren(
      h('div', { class: 'st-note' }, `Escala RbxUI ${f.toFixed(2)}× · ${input === 'touch' ? 'táctil' : input === 'pad' ? 'mando' : 'ratón'}` + (issues.length ? ` · ${issues.length} aviso(s)` : ' · sin avisos')),
      ...issues.slice(0, 12).map(([kind, msg]) => h('button', { class: 'st-dev-issue', onclick: () => { const id = ids.get(msg.split(':')[0]); if (id) setSel([id]); } },
        h('b', {}, kind === 'dedo' ? '👆' : 'Aa'), msg)));
  }

  // ---------------------------------------------------------------- selección
  function setSel(ids) {
    S.sel = [...new Set(ids)].filter((id) => node(id));
    for (const id of S.sel) for (const a of chainOf(id).slice(0, -1)) S.collapsed.delete(a.id);
    drawOverlay(); renderLayers(); renderProps(); pushState();
    const row = $(`#st-layers [data-id="${S.sel[0]}"]`); if (row) row.scrollIntoView({ block: 'nearest' });
  }
  const toggleSel = (id) => setSel(S.sel.includes(id) ? S.sel.filter((x) => x !== id) : [...S.sel, id]);

  function hitTest(cx, cy) {
    for (const el of document.elementsFromPoint(cx, cy)) {
      if (!stageEl().contains(el)) continue;
      const t = el.closest('[data-nid]'); if (!t) continue;
      const id = t.getAttribute('data-nid');
      if (!isLockedDeep(id)) return id;
    }
    return null;
  }
  function pickTarget(hitId, deep) {
    if (deep) return hitId;
    const chain = chainOf(hitId).map((n) => n.id);
    for (const s of S.sel) if (chain.includes(s)) return s;
    const scope = new Set(S.sel.map((id) => parentOf(id)?.id ?? null));
    for (const id of chain) if (scope.has(parentOf(id)?.id ?? null)) return id;
    return chain[0];
  }

  // ---------------------------------------------------------------- imán
  function snapTargets(ids) {
    const p = parentOf(ids[0]);
    const boxes = [innerBox(p)];
    for (const s of listOf(ids[0])) if (!ids.includes(s.id) && !s.hidden) { const b = boxOf(s.id); if (b) boxes.push(b); }
    return { xs: boxes.flatMap((b) => [b.x, b.x + b.w / 2, b.x + b.w]), ys: boxes.flatMap((b) => [b.y, b.y + b.h / 2, b.y + b.h]) };
  }
  function snapAxis(vals, targets) {
    const thr = 6 / S.zoom; let best = null;
    for (const v of vals) for (const t of targets) { const d = t - v; if (Math.abs(d) <= thr && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, t }; }
    return best;
  }

  // ---------------------------------------------------------------- herramientas
  S.tool = 'move';
  const DRAW = { frame: 1, text: 1, image: 1, button: 1 };
  function setTool(t) {
    if (DRAW[t] && !isNative()) { status('Las herramientas de dibujo son para escenas nativas', true); t = 'move'; }
    S.tool = t;
    $$('#st-tools [data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
    canvas.classList.toggle('tool-hand', t === 'hand');
    canvas.classList.toggle('tool-draw', !!DRAW[t]);
  }
  const stagePoint = (e) => { const r = stageEl().getBoundingClientRect(); return { x: (e.clientX - r.left) / S.zoom, y: (e.clientY - r.top) / S.zoom }; };
  const TEXTISH = new Set(['TextLabel', 'TextButton', 'TextBox', 'ImageLabel', 'ImageButton']);
  function startDraw(e) {
    // se dibuja dentro del contenedor más profundo bajo el cursor (como un frame de Figma) o suelto en el lienzo
    const hit = hitTest(e.clientX, e.clientY);
    let cont = null;
    if (hit) for (const n of chainOf(hit).reverse()) if (n.rbxClass && !TEXTISH.has(n.rbxClass)) { cont = n; break; }
    S.drag = { type: 'draw', tool: S.tool, cont: cont ? cont.id : null, p0: stagePoint(e), rect: null };
  }
  function finishDraw(d) {
    const DEF = { frame: [200, 120], text: [180, 44], image: [96, 96], button: [160, 48] };
    const [dw, dh] = DEF[d.tool];
    let r = d.rect && d.rect.w > 4 && d.rect.h > 4 ? d.rect : { x: d.p0.x - dw / 2, y: d.p0.y - dh / 2, w: dw, h: dh };
    const cont = d.cont ? node(d.cont) : null, o = originOf(cont);
    r = { x: r2(r.x - o.x), y: r2(r.y - o.y), w: r2(r.w), h: r2(r.h) };
    let n;
    if (d.tool === 'frame') n = R.makeNode('Frame', { name: 'Frame' });
    else if (d.tool === 'text') n = R.makeNode('TextLabel', { name: 'Text' });
    else if (d.tool === 'image') n = R.makeNode('ImageLabel', { name: 'Image', props: { BackgroundTransparency: 1, ScaleType: 'Fit', Image: 'assets/studs/Yellow_Star_Outline.png' } });
    else { const inst = KIT.button('Button', 'Button', 'lime', r.w, r.h); n = R.importInto({ ...inst, props: { ...inst.props, Position: [0, 0, 0, 0] } }, r.w, r.h); delete n.geo0; }
    Object.assign(n, { x: r.x, y: r.y, w: r.w, h: r.h });
    n.orig = { Size: null, Position: null };
    pushUndo();
    (cont ? cont.children : S.scene.nodes).push(n);
    refresh(); setSel([n.id]); setTool('move');
    if (d.tool === 'text') { const t = $('#st-f-text'); if (t) { t.focus(); t.select(); } }
    if (d.tool === 'image') { switchTab('icons'); $('#st-iconq').focus(); status('Elige un icono: reemplaza la imagen seleccionada'); }
  }

  // ---------------------------------------------------------------- ratón en el lienzo
  canvas.addEventListener('mousedown', (e) => {
    if (!S.scene) return;
    if (S.play && !(e.button === 1 || S.space)) return;
    if (e.button === 1 || (e.button === 0 && (S.space || S.tool === 'hand'))) { S.drag = { type: 'pan', sx: e.clientX, sy: e.clientY, px: S.px, py: S.py }; e.preventDefault(); return; }
    if (e.button !== 0) return;
    if (DRAW[S.tool]) { startDraw(e); e.preventDefault(); return; }
    const hd = e.target.closest('.st-ov-handle');
    if (hd && S.sel.length === 1) {
      const n = node(S.sel[0]);
      S.drag = { type: 'resize', dir: hd.dataset.dir, id: n.id, sx: e.clientX, sy: e.clientY, o: { x: n.x, y: n.y, w: n.w, h: n.h }, before: snap(), moved: false };
      e.preventDefault(); return;
    }
    const hit = hitTest(e.clientX, e.clientY);
    if (!hit) { if (!e.shiftKey) setSel([]); return; }
    const target = pickTarget(hit, e.ctrlKey || e.metaKey);
    if (e.shiftKey) { toggleSel(target); return; }
    if (!S.sel.includes(target)) setSel([target]);
    const ids = topLevel(S.sel.filter((id) => !isLockedDeep(id)));
    if (!ids.length) return;
    S.drag = { type: 'move', sx: e.clientX, sy: e.clientY, starts: ids.map((id) => ({ id, x: node(id).x, y: node(id).y })),
      b0: union(ids.map(boxOf)), snap: snapTargets(ids), before: snap(), moved: false };
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    const d = S.drag;
    if (!d) { hoverAt(e); return; }
    if (d.type === 'pan') { S.px = d.px + e.clientX - d.sx; S.py = d.py + e.clientY - d.sy; applyView(); return; }
    if (d.type === 'draw') {
      const q = stagePoint(e);
      let w = Math.abs(q.x - d.p0.x), hh = Math.abs(q.y - d.p0.y);
      if (e.shiftKey) w = hh = Math.max(w, hh);
      d.rect = { x: q.x < d.p0.x ? d.p0.x - w : d.p0.x, y: q.y < d.p0.y ? d.p0.y - hh : d.p0.y, w, h: hh };
      drawOverlay(); return;
    }
    let dx = (e.clientX - d.sx) / S.zoom, dy = (e.clientY - d.sy) / S.zoom;
    if (!d.moved && Math.hypot(dx, dy) * S.zoom < 3) return;
    d.moved = true;
    if (d.type === 'move') {
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      const guides = [];
      if (!e.altKey) {
        const b = d.b0;
        const sx = snapAxis([b.x + dx, b.x + dx + b.w / 2, b.x + dx + b.w], d.snap.xs);
        const sy = snapAxis([b.y + dy, b.y + dy + b.h / 2, b.y + dy + b.h], d.snap.ys);
        if (sx) { dx += sx.d; guides.push({ axis: 'x', v: sx.t }); }
        if (sy) { dy += sy.d; guides.push({ axis: 'y', v: sy.t }); }
      }
      for (const s of d.starts) { const n = node(s.id); n.x = r2(s.x + dx); n.y = r2(s.y + dy); applyGeom(n); }
      drawOverlay(guides);
    } else if (d.type === 'resize') {
      const n = node(d.id), o = d.o;
      let { x, y, w, h: hh } = o;
      if (d.dir.includes('e')) w = o.w + dx;
      if (d.dir.includes('w')) { w = o.w - dx; x = o.x + dx; }
      if (d.dir.includes('s')) hh = o.h + dy;
      if (d.dir.includes('n')) { hh = o.h - dy; y = o.y + dy; }
      if (e.shiftKey && o.w && o.h) {
        const ratio = o.w / o.h;
        if (d.dir.length === 2) { if (Math.abs(w / o.w - 1) > Math.abs(hh / o.h - 1)) hh = w / ratio; else w = hh * ratio; }
        else if (/[ew]/.test(d.dir)) hh = w / ratio; else w = hh * ratio;
        if (d.dir.includes('w')) x = o.x + o.w - w;
        if (d.dir.includes('n')) y = o.y + o.h - hh;
      }
      n.w = r2(Math.max(2, w)); n.h = r2(Math.max(2, hh)); n.x = r2(x); n.y = r2(y);
      applyGeom(n); drawOverlay();
    }
  });

  window.addEventListener('mouseup', () => {
    const d = S.drag; S.drag = null;
    if (!d) return;
    if (d.type === 'draw') { finishDraw(d); return; }
    if ((d.type === 'move' || d.type === 'resize') && d.moved) { pushUndo(d.before); renderLayers(); renderProps(); }
    drawOverlay();
  });

  let hoverRaf = 0;
  function hoverAt(e) {
    if (!S.scene || hoverRaf || S.play) return;
    hoverRaf = requestAnimationFrame(() => {
      hoverRaf = 0;
      if (!canvas.contains(e.target)) { if (S.hover) { S.hover = null; drawOverlay(); } return; }
      const hit = hitTest(e.clientX, e.clientY);
      const hv = hit ? pickTarget(hit, e.ctrlKey || e.metaKey) : null;
      if (hv !== S.hover) { S.hover = hv; drawOverlay(); }
    });
  }

  canvas.addEventListener('dblclick', (e) => {
    if (S.play) return;
    const hit = hitTest(e.clientX, e.clientY); if (!hit) return;
    const chain = chainOf(hit).map((n) => n.id);
    const i = chain.indexOf(S.sel[0]);
    if (i >= 0 && i < chain.length - 1) setSel([chain[i + 1]]);
    else if (node(hit).type === 'text') { setSel([hit]); const t = $('#st-f-text'); if (t) { t.focus(); t.select(); } }
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, z0 = S.zoom;
      const z = clamp(z0 * Math.exp(-e.deltaY * 0.0018), 0.1, 8);
      S.px = mx - ((mx - S.px) * z) / z0; S.py = my - ((my - S.py) * z) / z0; S.zoom = z;
    } else { S.px -= e.deltaX; S.py -= e.deltaY; }
    applyView();
  }, { passive: false });

  // ---------------------------------------------------------------- tacto: un dedo = seleccionar / mover / redimensionar (o desplazar la vista si no hay nada),
  // dos dedos = zoom + desplazar, doble toque = entrar. En «Probar» el toque es un clic normal.
  const TCH = { pinch: null, one: false, last: null, start: null };
  const mev = (type, t, target) => (target || window).dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: t.clientX, clientY: t.clientY, button: 0 }));
  canvas.addEventListener('touchstart', (e) => {
    if (S.mDrawer) mDrawer(null);
    if (!S.scene) return;
    if (e.touches.length === 2) {
      S.drag = null; TCH.one = false;
      const [a, b] = e.touches;
      TCH.pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1, mx: (a.clientX + b.clientX) / 2, my: (a.clientY + b.clientY) / 2, z: S.zoom, px: S.px, py: S.py };
      e.preventDefault(); return;
    }
    if (e.touches.length !== 1 || S.play) return;
    const t = e.touches[0];
    e.preventDefault();
    TCH.one = true; TCH.start = { x: t.clientX, y: t.clientY };
    const onHandle = e.target.closest && e.target.closest('.st-ov-handle');
    if (!onHandle && !DRAW[S.tool] && !hitTest(t.clientX, t.clientY)) {
      setSel([]); S.drag = { type: 'pan', sx: t.clientX, sy: t.clientY, px: S.px, py: S.py }; return;
    }
    mev('mousedown', t, e.target);
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    if (TCH.pinch && e.touches.length >= 2) {
      const [a, b] = e.touches, P = TCH.pinch, r = canvas.getBoundingClientRect();
      const mx = (a.clientX + b.clientX) / 2, my = (a.clientY + b.clientY) / 2;
      const z = clamp(P.z * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / P.d, 0.05, 8);
      const sx = (P.mx - r.left - P.px) / P.z, sy = (P.my - r.top - P.py) / P.z;   // punto del escenario bajo los dedos al empezar
      S.zoom = z; S.px = mx - r.left - sx * z; S.py = my - r.top - sy * z; applyView();
      e.preventDefault(); return;
    }
    if (TCH.one && e.touches.length === 1) { mev('mousemove', e.touches[0]); e.preventDefault(); }
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    if (TCH.pinch) { if (e.touches.length < 2) { TCH.pinch = null; S.drag = null; } return; }
    if (!TCH.one || e.touches.length) return;
    TCH.one = false;
    const t = e.changedTouches[0];
    mev('mouseup', t);
    // doble toque (sin moverse) = doble clic
    const still = TCH.start && Math.hypot(t.clientX - TCH.start.x, t.clientY - TCH.start.y) < 10;
    if (still && TCH.last && Date.now() - TCH.last.at < 320 && Math.hypot(t.clientX - TCH.last.x, t.clientY - TCH.last.y) < 24) {
      const el = document.elementFromPoint(t.clientX, t.clientY);
      if (el) el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: t.clientX, clientY: t.clientY }));
      TCH.last = null;
    } else TCH.last = still ? { at: Date.now(), x: t.clientX, y: t.clientY } : null;
  });
  canvas.addEventListener('touchcancel', () => { TCH.pinch = null; if (TCH.one) { TCH.one = false; window.dispatchEvent(new MouseEvent('mouseup')); } S.drag = null; });

  // móvil: los paneles son cajones que se abren desde la barra de abajo
  S.mDrawer = null;
  const LEFT_TABS = ['layers', 'insert', 'icons'];
  function mDrawer(which) {
    const next = S.mDrawer === which ? null : which;
    S.mDrawer = next;
    document.body.classList.toggle('m-left', LEFT_TABS.includes(next));
    document.body.classList.toggle('m-right', next === 'props');
    if (LEFT_TABS.includes(next)) switchTab(next);
    $$('#st-mnav [data-m]').forEach((x) => x.classList.toggle('on', x.dataset.m === next || (x.dataset.m === 'play' && S.play)));
  }
  $$('#st-mnav [data-m]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.m !== 'play') { mDrawer(b.dataset.m); return; }
    mDrawer(null);
    if (isNative()) setPlay(!S.play); else status('Probar es para escenas nativas', true);
  }));

  // ---------------------------------------------------------------- operaciones
  function removeIds(ids) { for (const id of topLevel(ids)) { const l = listOf(id); l.splice(l.findIndex((n) => n.id === id), 1); } }
  function del() { if (!S.sel.length) return; pushUndo(); removeIds(S.sel); S.sel = []; refresh(); }
  function duplicate() {
    const ids = topLevel(S.sel); if (!ids.length) return;
    pushUndo(); const out = [];
    for (const id of ids) {
      const l = listOf(id), i = l.findIndex((n) => n.id === id);
      const c = reid(clone(l[i])); c.x += 10; c.y += 10; if (c.name) c.name = c.name.replace(/(\d*)$/, (m) => String((+m || 1) + 1));
      l.splice(i + 1, 0, c); out.push(c.id);
    }
    refresh(); setSel(out);
  }
  function copy() { const ids = topLevel(S.sel); if (ids.length) { S.clip = ids.map((id) => clone(node(id))); status(`${ids.length} copiado(s)`); } }
  function paste() {
    if (!S.clip) return;
    const cont = insertContainer(); const list = cont ? cont.children : S.scene.nodes;
    pushUndo(); const out = [];
    for (const src of S.clip) { const c = reid(clone(src)); c.x += 10; c.y += 10; list.push(c); out.push(c.id); }
    refresh(); setSel(out);
  }
  function nudge(dx, dy) {
    const ids = topLevel(S.sel); if (!ids.length) return;
    pushUndo(); for (const id of ids) { const n = node(id); n.x = r2(n.x + dx); n.y = r2(n.y + dy); applyGeom(n); }
    drawOverlay(); renderProps();
  }
  function zorder(dir) {                     // dir: +1 adelante, -1 atrás, +9 al frente, -9 al fondo
    const ids = S.sel; if (ids.length !== 1) return;
    const l = listOf(ids[0]), i = l.findIndex((n) => n.id === ids[0]);
    const j = dir === 9 ? l.length - 1 : dir === -9 ? 0 : clamp(i + dir, 0, l.length - 1);
    if (i === j) return;
    pushUndo(); const [n] = l.splice(i, 1); l.splice(j, 0, n); refresh();
  }
  function group() {
    const ids = topLevel(S.sel); if (!ids.length) return;
    const p = parentOf(ids[0]);
    if (ids.some((id) => parentOf(id) !== p)) { status('Para agrupar, las capas deben tener el mismo padre', true); return; }
    const l = listOf(ids[0]);
    const ns = l.filter((n) => ids.includes(n.id));
    const x = Math.min(...ns.map((n) => n.x)), y = Math.min(...ns.map((n) => n.y));
    const gw = r2(Math.max(...ns.map((n) => n.x + n.w)) - x), gh = r2(Math.max(...ns.map((n) => n.y + n.h)) - y);
    const g = isNative() ? R.makeNode('Frame', { name: 'Group', props: { BackgroundTransparency: 1 }, x: r2(x), y: r2(y), w: gw, h: gh, children: [] })
      : { id: uid(), type: 'group', name: 'Group', rbx: 'frame', x: r2(x), y: r2(y), w: gw, h: gh, children: [] };
    pushUndo();
    const at = Math.max(...ns.map((n) => l.indexOf(n)));
    for (const n of ns) { n.x = r2(n.x - x); n.y = r2(n.y - y); g.children.push(n); }
    l.splice(at + 1, 0, g);
    for (const n of ns) l.splice(l.indexOf(n), 1);
    refresh(); setSel([g.id]);
  }
  function ungroup() {
    const gs = S.sel.map(node).filter((n) => n && n.type === 'group'); if (!gs.length) return;
    pushUndo(); const out = [];
    for (const g of gs) {
      const l = listOf(g.id), i = l.indexOf(g), el = S.map[g.id];
      const kids = (g.children || []).map((k) => { k.x = r2(k.x + g.x + el.clientLeft); k.y = r2(k.y + g.y + el.clientTop); out.push(k.id); return k; });
      l.splice(i, 1, ...kids);
    }
    refresh(); setSel(out);
  }
  function moveLayer(srcId, dstId, mode) {
    if (!srcId || srcId === dstId || chainOf(dstId).some((n) => n.id === srcId)) return;
    const src = node(srcId), dst = node(dstId);
    const o0 = originOf(parentOf(srcId)), absX = o0.x + src.x, absY = o0.y + src.y;
    const newParent = mode === 'in' ? dst : parentOf(dstId);
    const o1 = originOf(newParent);
    pushUndo();
    const from = listOf(srcId); from.splice(from.indexOf(src), 1);
    if (mode === 'in') dst.children.push(src);
    else { const l = listOf(dstId); const i = l.indexOf(dst); l.splice(mode === 'above' ? i + 1 : i, 0, src); }
    src.x = r2(absX - o1.x); src.y = r2(absY - o1.y);
    refresh(); setSel([srcId]);
  }
  function align(mode) {
    const ids = topLevel(S.sel); if (!ids.length) return;
    const bs = ids.map((id) => ({ id, b: boxOf(id) }));
    const ref = ids.length > 1 ? union(bs.map((x) => x.b)) : innerBox(parentOf(ids[0]));
    pushUndo();
    if (mode === 'dh' || mode === 'dv') {
      if (bs.length < 3) return;
      const k = mode === 'dh' ? 'x' : 'y', s = mode === 'dh' ? 'w' : 'h';
      bs.sort((a, b) => a.b[k] - b.b[k]);
      const total = bs.reduce((t, x) => t + x.b[s], 0), gap = (ref[s] - total) / (bs.length - 1);
      let cur = ref[k];
      for (const x of bs) { node(x.id)[k] = r2(node(x.id)[k] + cur - x.b[k]); cur += x.b[s] + gap; }
    } else {
      for (const { id, b } of bs) {
        const n = node(id);
        if (mode === 'l') n.x = r2(n.x + ref.x - b.x);
        if (mode === 'c') n.x = r2(n.x + ref.x + ref.w / 2 - (b.x + b.w / 2));
        if (mode === 'r') n.x = r2(n.x + ref.x + ref.w - (b.x + b.w));
        if (mode === 't') n.y = r2(n.y + ref.y - b.y);
        if (mode === 'm') n.y = r2(n.y + ref.y + ref.h / 2 - (b.y + b.h / 2));
        if (mode === 'b') n.y = r2(n.y + ref.y + ref.h - (b.y + b.h));
      }
    }
    refresh();
  }

  // texto: medir el contenido real con las clases del design system
  function measureText(n) {
    const p = document.createElement('div');
    p.className = n.cls || 'txt'; p.textContent = n.text || ' ';
    p.style.cssText = (n.style || '') + ';position:absolute;left:-9999px;top:0;width:auto;height:auto;visibility:hidden;';
    stageEl().append(p); const m = { w: p.offsetWidth, h: p.offsetHeight }; p.remove(); return m;
  }
  function fitText(n) {
    const m = measureText(n), al = getTok(n, RE_ALIGN);
    const ow = n.w, oh = n.h; n.w = r2(m.w); n.h = r2(m.h);
    if (al === 't-right') n.x = r2(n.x + ow - n.w); else if (al !== 't-left') n.x = r2(n.x + (ow - n.w) / 2);
    n.y = r2(n.y + (oh - n.h) / 2);
  }
  const fitTexts = (n) => { if (n.rbxClass) return; if (n.type === 'text') fitText(n); (n.children || []).forEach(fitTexts); };

  // ---------------------------------------------------------------- componentes
  const ICON = (f) => `../assets/studs/${f}.png`;
  const ROBUX = '../assets/brand/robux_ol.png';
  const ARROW = '<svg viewBox="0 0 40 34" width="100%" height="100%"><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6a8a"/><stop offset="1" stop-color="#e0184a"/></linearGradient></defs><path d="M3 10 H20 V3 L37 17 L20 31 V24 H3 Z" fill="url(#ag)" stroke="#121318" stroke-width="3" stroke-linejoin="round"/><path d="M6 12.5 H22 V8" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2"/></svg>';
  const T = (text, cls, x, y, w, hh, o = {}) => ({ type: 'text', name: o.name || 'Label', rbx: o.baked ? null : 'text', cls: 'txt ' + cls, text, x, y, w, h: hh,
    ...(o.style ? { style: o.style } : {}), ...(o.grad ? { grad: o.grad } : {}) });
  const IMG = (src, x, y, s, name = 'Icon', cls = 'ic ic-sh') => ({ type: 'image', name, rbx: 'image', cls, src, x, y, w: s, h: s });
  const BOX = (name, cls, w, hh, children = [], o = {}) => ({ type: 'box', name, rbx: o.rbx === undefined ? 'image' : o.rbx, ...(o.pad === null ? {} : { pad: o.pad ?? 4 }),
    cls, x: 0, y: 0, w, h: hh, children, ...(o.style ? { style: o.style } : {}) });
  const FX = (kind, x, y, w, hh, style) => ({ type: 'box', name: kind, rbx: null, cls: 'fx ' + kind, x, y, w, h: hh, children: [], ...(style ? { style } : {}) });
  const closeBtn = () => BOX('CloseButton', 'pc xbtn v-danger', 38, 36, [T('X', 't-label', 0, 0, 34, 32, { baked: true, style: 'font-size:22px', name: 'X' })]);
  const button = (name, label, variant, w = 140, hh = 34) => BOX(name, `pc btn m ${variant}`, w, hh, [T(label, 't-label', 0, 0, w - 4, hh - 4, { name: 'Label' })]);
  const win = (theme) => ({ type: 'box', name: 'Window', rbx: 'image', pad: 12, cls: `pc win th-${theme}`, x: 0, y: 0, w: 480, h: 320, children: [
    { type: 'box', name: 'Header', rbx: 'image', cls: 'win-head', x: 0, y: 0, w: 476, h: 50, children: [T('Title', 't-title', 12, 10, 90, 30, { name: 'Title' }), { ...closeBtn(), x: 430, y: 5 }] },
    { type: 'group', name: 'Body', rbx: 'frame', cls: '', x: 0, y: 50, w: 476, h: 266, children: [] }] });

  const COMPONENTS = [
    ['Ventanas', [
      ['Ventana amarilla', 'Cabecera de color + cuerpo carbón', () => win('yellow')],
      ['Ventana morada', '', () => win('purple')],
      ['Ventana roja', '', () => win('red')],
      ['Ventana azul', '', () => win('blue')],
    ]],
    ['Botones', [
      ['Botón lima', 'Acción / comprar', () => button('Button', 'Button', 'v-cta')],
      ['Botón rosa', 'Pagar Robux / saltar', () => button('Button', 'Button', 'v-pink')],
      ['Botón de color', 'Usa el tema', () => button('Button', 'Button', 'v-std th-orange')],
      ['Comprar con Robux', 'Logo oficial + precio', () => BOX('BuyButton', 'pc btn m v-cta', 120, 34, [IMG(ROBUX, 22, 5, 24, 'Robux', 'ic rbx'), T('99', 't-label', 48, 7, 40, 20, { name: 'Price' })])],
      ['Cerrar (X)', '', () => closeBtn()],
      ['HUD cuadrado', 'Icono + etiqueta', () => BOX('HudButton', 'pc hud-sq v-std th-red', 66, 66, [IMG(ICON('Settings_Outline'), 6, 1, 50), T('Label', 't-small', 10, 44, 42, 16, { name: 'Label' })])],
      ['HUD ancho', 'Icono que sobresale', () => BOX('HudWideButton', 'pc hud-wide v-std th-orange', 150, 46, [IMG(ICON('Basket_Outline'), -22, -12, 64), T('Shop', 't-big', 44, 9, 70, 24, { name: 'Label' })], { pad: 14 })],
    ]],
    ['Contenido', [
      ['Tarjeta', 'Radial + sunburst', () => BOX('Card', 'pc card th-green v-card', 220, 150, [FX('fx-burst', -60, -50, 260, 260, 'opacity:.55')])],
      ['Slot (Index)', 'Rareza + icono + textos', () => BOX('Slot', 'pc tile v-tile th-blue', 96, 96, [FX('fx-glow', 13, 9, 70, 70, 'opacity:.35'),
        IMG(ICON('Purple_Gem_Outline'), 13, 9, 70), T('Day 1', 't-small t-left', 5, 4, 40, 13, { name: 'Top' }), T('x100', 't-label t-left', 5, 71, 40, 17, { name: 'Bottom' })])],
      ['Caja oscura', 'Filas de stats', () => BOX('Box', 'pc box v-box', 160, 46, [], { pad: 3 })],
      ['Sección dorada', 'Etiqueta + línea', () => ({ type: 'box', name: 'SectionLabel', rbx: 'image', cls: 'sect', x: 0, y: 0, w: 320, h: 22, children: [T('Section!', 't-small t-gold', 120, 4, 80, 14, { name: 'Text' })] })],
      ['Moneda dorada', 'Marco para iconos', () => ({ type: 'box', name: 'Coin', rbx: null, cls: 'coin', x: 0, y: 0, w: 84, h: 84, children: [IMG(ICON('Green_Cash_Outline'), 12, 12, 56)] })],
      ['Barra de progreso', 'Pista + relleno', () => BOX('Progress', 'pc bar-track v-box', 300, 22, [
        { ...BOX('Fill', 'pc bar-fill v-cta', 180, 14, [], { pad: 2 }), x: 2, y: 2 }, T('50 / 100', 't-small', 110, 2, 76, 14, { name: 'Text' })], { pad: 3 })],
      ['Flecha', '', () => ({ type: 'html', name: 'Arrow', rbx: 'image', pad: 3, x: 0, y: 0, w: 40, h: 34, html: ARROW })],
    ]],
    ['Texto e imagen', [
      ['Título', '', () => T('Title', 't-title', 0, 0, 80, 30, { name: 'Title' })],
      ['Texto', '', () => T('Text', 't-label', 0, 0, 50, 20, { name: 'Label' })],
      ['Texto pequeño', '', () => T('Text', 't-small', 0, 0, 40, 15, { name: 'Label' })],
      ['Número de divisa', 'Verde lima grande', () => T('$1,000', 't-cur t-lime', 0, 0, 110, 34, { name: 'Value' })],
      ['Icono', 'Studs Icon Pack', () => IMG(ICON('Yellow_Star_Outline'), 0, 0, 64)],
    ]],
    ['Efectos (se hornean en la pieza)', [
      ['Sunburst', '', () => FX('fx-burst', 0, 0, 220, 220)],
      ['Brillo', '', () => FX('fx-glow', 0, 0, 100, 100)],
      ['Destello', '', () => FX('fx-spark', 0, 0, 24, 24)],
      ['Halftone', '', () => FX('fx-half', 0, 0, 200, 120)],
    ]],
    ['Estructura', [
      ['Grupo (Frame)', 'Contenedor transparente', () => ({ type: 'group', name: 'Frame', rbx: 'frame', x: 0, y: 0, w: 200, h: 120, children: [] })],
    ]],
  ];

  function insertContainer() {
    if (S.sel.length !== 1) return null;
    const n = node(S.sel[0]);
    if (isContainer(n)) return n;
    return parentOf(n.id);
  }
  function insertNode(n) {
    const cont = insertContainer(), list = cont ? cont.children : S.scene.nodes, box = innerBox(cont);
    reid(n); fitTexts(n);
    n.x = r2((box.w - n.w) / 2); n.y = r2((box.h - n.h) / 2);
    pushUndo(); list.push(n); refresh(); setSel([n.id]);
  }
  // componentes nativos (Instances reales + kit Stud Style de studkit.js)
  const N = (cls, over) => () => R.makeNode(cls, over);
  // un nodo del kit trae su propio Size/AnchorPoint; se importa en una caja de su tamaño y se centra al insertar
  const K = (fn) => () => {
    const inst = fn(), p = inst.props || {}, sz = p.Size || [0, 100, 0, 100];
    const w = sz[0] * 480 + sz[1], hh = sz[2] * 320 + sz[3];
    const n = R.importInto({ ...inst, props: { ...p, Position: [0, 0, 0, 0], AnchorPoint: [0, 0], Size: [0, w, 0, hh] } }, w, hh);
    n.x = 0; n.y = 0; n.props.AnchorPoint = p.AnchorPoint || [0, 0]; n.orig = { Size: sz[0] || sz[2] ? sz : null, Position: null };
    delete n.geo0; delete n.props.Visible;
    return n;
  };
  const NATIVE_COMPONENTS = () => [
    ['Instances', [
      ['Frame', 'Contenedor / fondo', N('Frame')], ['TextLabel', 'Texto', N('TextLabel')],
      ['TextButton', 'Botón de texto', N('TextButton', { props: { Text: 'Button', TextColor3: '#FFFFFF', TextSize: 22, BackgroundColor3: '#5CCB14', FontFace: { family: 'Montserrat', weight: 'Heavy', style: 'Normal' } }, buttonFx: { hover: 1.06, press: 0.9 } })],
      ['ImageLabel', 'Imagen', N('ImageLabel', { props: { BackgroundTransparency: 1, ScaleType: 'Fit', Image: 'assets/studs/Yellow_Star_Outline.png' } })],
      ['ImageButton', 'Botón de imagen', N('ImageButton', { props: { BackgroundTransparency: 1, ScaleType: 'Fit', Image: 'assets/studs/Settings_Outline.png' }, buttonFx: { hover: 1.06, press: 0.9 } })],
      ['ScrollingFrame', 'Lista con scroll', N('ScrollingFrame', { props: { BackgroundTransparency: 1, ScrollBarThickness: 6 } })],
    ]],
    ['Stud 3D · bloques (labio + contorno + studs)', [
      ['Botón 3D verde', 'Comprar / Base / Index', K(() => KIT.button3d('Button', 'BUY', 'green', 160, 58))],
      ['Botón 3D azul', 'Shop / productos', K(() => KIT.button3d('Button', 'SHOP', 'blue', 160, 58))],
      ['Botón 3D rojo', 'Salir / Sell', K(() => KIT.button3d('Button', 'SELL', 'red', 160, 58))],
      ['Botón 3D rosa', 'Rebirth', K(() => KIT.button3d('Button', 'REBIRTH', 'pink', 160, 58))],
      ['Botón 3D cuadrado', 'Menú lateral 78×84', K(() => KIT.button3d('SideButton', 'SHOP', 'blue', 78, 84, { textSize: 17, tile: 39 }))],
      ['Cabecera 3D', 'Barra de título', K(() => KIT.block3d('Header', 'green', 420, 62, { face: [KIT.text3d('Title', 'TITLE', 40, { Position: [0, 18, 0, 0], Size: [1, -36, 1, 0] }, { align: 'Left', stroke: 3.5, depth: 4 })] }))],
      ['Tarjeta 3D', 'Producto / oferta', K(() => KIT.block3d('Card', 'orange', 184, 196, { face: [KIT.text3d('Title', '+50 Cash', 28, { Position: [0, 0, 0, 10], Size: [1, 0, 0, 34] })] }))],
      ['Ventana 3D', 'Fondo translúcido + cabecera + X', K(() => KIT.window3d('Window', 'SHOP', 'green', 640, 460))],
      ['Texto 3D', 'Contorno + sombra dura', K(() => KIT.node('Frame', 'Title', { Size: [0, 300, 0, 56], BackgroundTransparency: 1 }, [KIT.text3d('Text', 'TITLE', 44, {}, { stroke: 3.5, depth: 4 })]))],
    ]],
    ['Stud Style · ventanas', [
      ['Ventana amarilla', 'Cabecera de color + cuerpo carbón', K(() => KIT.win('Window', { title: 'Title', theme: 'yellow' }))],
      ['Ventana morada', '', K(() => KIT.win('Window', { title: 'Title', theme: 'purple' }))],
      ['Ventana roja', '', K(() => KIT.win('Window', { title: 'Title', theme: 'red' }))],
      ['Ventana azul', '', K(() => KIT.win('Window', { title: 'Title', theme: 'blue' }))],
    ]],
    ['Stud Style · botones', [
      ['Botón lima', 'Acción / comprar', K(() => KIT.button('Button', 'Button', 'lime', 140, 38))],
      ['Botón rosa', 'Pagar Robux / saltar', K(() => KIT.button('Button', 'Button', 'pink', 140, 38, {}, { children: [KIT.priceBadge(99)] }))],
      ['Botón rojo', '', K(() => KIT.button('Button', 'Button', 'red', 140, 38))],
      ['Comprar con Robux', 'Logo oficial + precio', K(() => KIT.buyButton('BuyButton', 99, 120, 36))],
      ['HUD cuadrado', 'Icono + etiqueta', K(() => KIT.hudSquare('HudButton', 'Label', KIT.IMG.icon('Settings'), 'red'))],
      ['HUD ancho', 'Icono que sobresale', K(() => KIT.hudWide('HudWideButton', 'Shop', KIT.IMG.icon('Basket'), 'orange'))],
    ]],
    ['Stud Style · contenido', [
      ['Pieza de color', 'Degradado + studs + contorno', K(() => KIT.piece('Card', 'green', { Size: [0, 220, 0, 150] }))],
      ['Slot (Index / Daily)', 'Rareza + icono + textos', K(() => KIT.tile('Slot', 'blue', KIT.IMG.icon('Purple_Gem'), 'Day 1', 'x100'))],
      ['Caja oscura', 'Filas de stats', K(() => KIT.box('Box', { Size: [0, 160, 0, 46] }))],
      ['Moneda dorada', 'Marco redondo para iconos', K(() => KIT.coin('Coin', KIT.IMG.icon('Green_Cash'), 84))],
      ['Sección dorada', 'Etiqueta + línea', K(() => KIT.section('Section', 'Section!', 0, 344))],
      ['Divisa', 'Icono + número + botón +', K(() => KIT.currency('Cash', KIT.IMG.icon('Green_Cash'), '$1,000', '#A8FF2E'))],
      ['Título', 'Montserrat Heavy 26', K(() => KIT.text('Title', 'Title', 26))],
      ['Texto', 'Montserrat Heavy 17', K(() => KIT.text('Label', 'Text', 17))],
    ]],
  ];
  function renderInsert() {
    const P = $('#st-insert'); P.innerHTML = '';
    for (const [g, items] of (isNative() ? NATIVE_COMPONENTS() : COMPONENTS)) {
      P.append(h('div', { class: 'st-cgroup' }, g));
      for (const [name, desc, build] of items)
        P.append(h('button', { class: 'st-comp', onclick: () => S.scene && insertNode(build()) }, name, desc ? h('small', {}, desc) : null));
    }
    P.append(h('p', { class: 'st-note' }, 'Se inserta dentro de la capa seleccionada (si es un contenedor) o junto a ella.'));
  }

  // ---------------------------------------------------------------- iconos
  S.iconSrc = 'studs';
  function renderIcons() {
    const q = $('#st-iconq').value.toLowerCase().trim(), G = $('#st-icongrid'); G.innerHTML = '';
    if (S.iconSrc === 'web') return renderWebIcons(q);
    if (S.iconSrc === 'logos') return renderLogos(q);
    const list = S.iconSrc === 'fx' ? (S.resources || [])
      : S.icons.map((src) => ({ src, title: src.split('/').pop().replace(/\.png$/, '').replace(/_Outline$/, '').replace(/_/g, ' ') }));
    const hits = list.filter((it) => !q || (it.title + ' ' + it.src).toLowerCase().includes(q));
    for (const it of hits.slice(0, 400)) G.append(h('button', { title: it.title, onclick: () => pickIcon(it.src) }, h('img', { src: it.src, loading: 'lazy' })));
    if (!hits.length) G.append(h('div', { class: 'st-more' }, stateBox('search', 'Sin resultados', `Nada con «${q}» aquí. Prueba en «Online» o con otra palabra (en inglés).`, [], 'xs')));
  }
  // Iconify: +200.000 iconos libres (Material, Lucide, Phosphor, Game Icons, emojis…).
  // Una petición de búsqueda + una por colección con los datos de todos sus iconos (JSON con CORS): los SVG se montan aquí,
  // así no se agota el límite de la API con cientos de miniaturas. Al insertar, el SVG se rasteriza a PNG en el servidor.
  const iconData = new Map();                                     // "prefijo:nombre" -> { body, w, h, left, top, flips }
  async function loadIconData(ids) {
    const by = {};
    for (const id of ids) { if (iconData.has(id)) continue; const [pf, nm] = id.split(':'); (by[pf] ||= []).push(nm); }
    await Promise.all(Object.entries(by).map(async ([pf, names]) => {
      const j = await fetch(`https://api.iconify.design/${pf}.json?icons=${names.join(',')}`).then((x) => x.json());
      const W = j.width || 16, H = j.height || 16;
      const get = (nm, depth = 0) => {
        const ic = j.icons && j.icons[nm];
        if (ic) return ic;
        const al = j.aliases && j.aliases[nm];
        if (!al || depth > 4) return null;
        const par = get(al.parent, depth + 1);
        return par ? { ...par, ...al, body: par.body } : null;
      };
      for (const nm of names) {
        const ic = get(nm);
        if (ic && ic.body) iconData.set(`${pf}:${nm}`, { body: ic.body, w: ic.width || W, h: ic.height || H, left: ic.left || 0, top: ic.top || 0, hFlip: ic.hFlip, vFlip: ic.vFlip, rotate: ic.rotate });
      }
    }));
  }
  function iconSvg(id, color, size) {
    const d = iconData.get(id);
    if (!d) return null;
    let body = d.body.replace(/currentColor/g, color);
    const tf = [];
    if (d.hFlip) tf.push(`translate(${d.left * 2 + d.w} 0) scale(-1 1)`);
    if (d.vFlip) tf.push(`translate(0 ${d.top * 2 + d.h}) scale(1 -1)`);
    if (d.rotate) tf.push(`rotate(${d.rotate * 90} ${d.left + d.w / 2} ${d.top + d.h / 2})`);
    if (tf.length) body = `<g transform="${tf.join(' ')}">${body}</g>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${d.left} ${d.top} ${d.w} ${d.h}">${body}</svg>`;
  }
  let webTimer = 0, webSeq = 0;
  function renderWebIcons(q) {
    const G = $('#st-icongrid');
    if (!q) { G.append(h('p', { class: 'st-note st-more' }, 'Escribe en inglés: sword, coin, gem, gift, heart, trophy, settings… Iconos libres de Iconify.')); return; }
    clearTimeout(webTimer);
    webTimer = setTimeout(async () => {
      const my = ++webSeq, set = $('#st-iconset').value, color = $('#st-iconcolor').value;
      G.innerHTML = ''; G.append(h('div', { class: 'st-more' }, stateBox('search', 'Buscando…', '', [], 'xs')));
      try {
        const r = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(q)}&limit=96${set ? '&prefixes=' + set : ''}`).then((x) => {
          if (x.status === 429) throw new Error('Iconify pide esperar un momento (demasiadas peticiones)');
          return x.json();
        });
        const ids = r.icons || [];
        await loadIconData(ids);
        if (my !== webSeq) return;
        G.innerHTML = '';
        for (const id of ids) {
          const svg = iconSvg(id, color, 48);
          if (!svg) continue;
          G.append(h('button', { title: id, onclick: () => pickWebIcon(id) }, h('img', { src: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg), loading: 'lazy' })));
        }
        if (!ids.length) G.append(h('div', { class: 'st-more' }, stateBox('search', 'Sin resultados', `Iconify no tiene nada con «${q}». Prueba en inglés o con otra colección.`, [], 'xs')));
      } catch (e) { G.innerHTML = ''; G.append(h('p', { class: 'st-warn st-more' }, 'Iconify: ' + e.message)); }
    }, 300);
  }
  async function pickWebIcon(id) {
    if (!S.scene) return;
    if (!isNative()) { status('Los iconos online son para escenas nativas', true); return; }
    const svg = iconSvg(id, $('#st-iconcolor').value, 256);
    if (!svg) return;
    status('Insertando ' + id + '…');
    try { await uploadImage(svg, 'svg', 72, id.split(':')[1].replace(/[^\w]/g, '_')); }
    catch (e) { status('No se pudo insertar el icono: ' + (e.data?.error || e.message), true); }
  }
  function pickIcon(src) {
    if (!S.scene) return;
    const n = S.sel.length === 1 ? node(S.sel[0]) : null;
    if (isNative()) {
      const rel = src.replace(/^(\.\.\/)+/, '');
      if (n && R.IMAGE.has(n.rbxClass)) { pushUndo(); n.props.Image = rel; update(); renderProps(); return; }
      insertNode(R.makeNode('ImageLabel', { name: 'Icon', props: { BackgroundTransparency: 1, ScaleType: 'Fit', Image: rel }, w: 64, h: 64 }));
      return;
    }
    if (n && n.type === 'image') { pushUndo(); n.src = src; update(); renderProps(); return; }
    insertNode(IMG(src, 0, 0, 64));
  }

  // ---------------------------------------------------------------- logos: carpetas subidas por el usuario (assets/logos/<carpeta>/)
  S.logos = []; S.logoFolder = '';
  const IMG_FILE = /\.(png|jpe?g|webp|svg)$/i;
  async function loadLogos(keep) {
    S.logos = await api('/api/logos').catch(() => []);
    if (!keep && S.logoFolder && !S.logos.some((l) => l.folder === S.logoFolder)) S.logoFolder = '';
    const sel = $('#st-logofolder'); sel.innerHTML = '';
    const total = S.logos.reduce((a, l) => a + l.files.length, 0);
    sel.append(h('option', { value: '' }, `Todas las carpetas (${total})`));
    for (const l of S.logos) sel.append(h('option', { value: l.folder, selected: l.folder === S.logoFolder }, `${l.folder} (${l.files.length})`));
    $('#st-logodel').disabled = !S.logoFolder;
    if (S.iconSrc === 'logos') renderIcons();
  }
  function renderLogos(q) {
    const G = $('#st-icongrid');
    const groups = S.logos.filter((l) => !S.logoFolder || l.folder === S.logoFolder)
      .map((l) => ({ ...l, files: l.files.filter((f) => !q || (l.folder + ' ' + f.name).toLowerCase().includes(q)) })).filter((l) => l.files.length);
    if (!S.logos.length) {
      G.append(h('div', { class: 'st-more' }, stateBox('empty', 'Sin logos todavía', 'Arrastra aquí una carpeta de logos o usa el botón de subir carpeta. PNG, JPG, WEBP o SVG.', [], 'xs')));
      return;
    }
    for (const l of groups) {
      if (!S.logoFolder) G.append(h('div', { class: 'st-ghead', innerHTML: SVGI('folder', 14) }, l.folder, h('small', {}, String(l.files.length))));
      for (const f of l.files) {
        const img = h('img', { src: '/' + f.path, loading: 'lazy', alt: f.name });
        G.append(h('button', { title: `${f.name} · ${l.folder}\nClic: insertar (o reemplazar la imagen seleccionada)`, onclick: () => pickLogo(f, img) }, img));
      }
    }
    if (!groups.length) G.append(h('div', { class: 'st-more' }, stateBox('search', 'Sin resultados', `Ningún logo se llama «${q}».`, [], 'xs')));
    G.append(h('p', { class: 'st-note st-more' }, 'Suelta imágenes aquí para añadirlas a la carpeta elegida, o una carpeta para crear otra.'));
  }
  async function pickLogo(f, img) {
    if (!S.scene || !needNative('Insertar logo')) return;
    const nm = f.name.replace(/[^\w]/g, '_').replace(/^_+/, '') || 'Logo';
    try {
      if (f.svg) { await uploadImage(await fetch('/' + f.path).then((r) => r.text()), 'svg', 160, nm); return; }
      placeImage({ path: f.path, w: img.naturalWidth || 128, h: img.naturalHeight || 128 }, 160, nm);
    } catch (e) { status('No se pudo insertar el logo: ' + (e.data?.error || e.message), true); }
  }
  // sube [{file, rel}] a una carpeta; rel = ruta dentro de la carpeta (subcarpetas -> prefijo del nombre)
  async function uploadLogos(items, folder) {
    const imgs = items.filter((it) => IMG_FILE.test(it.file.name));
    if (!imgs.length) { toast('No hay imágenes (PNG, JPG, WEBP o SVG) en lo que has soltado', 'warn'); return; }
    folder = folder || 'General';
    const t = toast(`Subiendo 0/${imgs.length} logos a «${folder}»…`, 'busy', { sticky: true });
    let done = 0, fail = 0, real = folder;
    const queue = [...imgs];
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const it = queue.shift();
        const name = (it.rel || it.file.name).split('/').filter(Boolean).join('_');
        try { const r = await api(`/api/logos?folder=${encodeURIComponent(folder)}&name=${encodeURIComponent(name)}`, { method: 'POST', body: it.file }); real = r.folder; done++; }
        catch { fail++; }
        t.set(`Subiendo ${done + fail}/${imgs.length} logos a «${folder}»…`);
      }
    }));
    t.close();
    toast(`${done} logos en «${real}»` + (fail ? ` · ${fail} fallaron` : ''), fail ? 'warn' : 'ok');
    S.logoFolder = real;
    if (S.iconSrc !== 'logos') $('#st-iconsrc [data-src="logos"]').click();
    switchTab('icons');
    await loadLogos(true);
  }
  // entradas de un drop (hay que pedirlas en el mismo evento, antes de cualquier await)
  const dropEntries = (dt) => [...(dt.items || [])].map((i) => (i.kind === 'file' && i.webkitGetAsEntry ? i.webkitGetAsEntry() : null)).filter(Boolean);
  function readEntry(entry, pre, out) {
    return new Promise((res) => {
      if (entry.isFile) entry.file((f) => { out.push({ file: f, rel: pre + f.name }); res(); }, () => res());
      else if (entry.isDirectory) {
        const rd = entry.createReader(), all = [];
        const next = () => rd.readEntries(async (es) => {
          if (es.length) { all.push(...es); next(); return; }
          for (const x of all) await readEntry(x, pre + entry.name + '/', out);
          res();
        }, () => res());
        next();
      } else res();
    });
  }
  // cada carpeta soltada -> su propia carpeta de logos; los archivos sueltos -> la carpeta elegida
  async function uploadDropped(entries) {
    const loose = [];
    for (const en of entries) {
      if (en.isDirectory) { const out = []; await readEntry(en, '', out); await uploadLogos(out.map((x) => ({ ...x, rel: x.rel.split('/').slice(1).join('/') })), en.name); }
      else await readEntry(en, '', loose);
    }
    if (loose.length) await uploadLogos(loose, S.logoFolder || 'General');
  }
  $('#st-logofolder').addEventListener('change', (e) => { S.logoFolder = e.target.value; $('#st-logodel').disabled = !S.logoFolder; renderIcons(); });
  $('#st-logoup-dir').addEventListener('click', () => $('#st-logoin-dir').click());
  $('#st-logoup-files').addEventListener('click', () => $('#st-logoin-files').click());
  $('#st-logoin-dir').addEventListener('change', async (e) => {
    const files = [...e.target.files]; e.target.value = '';
    if (!files.length) return;
    const top = (files[0].webkitRelativePath || '').split('/')[0] || 'General';
    await uploadLogos(files.map((f) => ({ file: f, rel: (f.webkitRelativePath || f.name).split('/').slice(1).join('/') || f.name })), top);
  });
  $('#st-logoin-files').addEventListener('change', async (e) => {
    const files = [...e.target.files]; e.target.value = '';
    if (files.length) await uploadLogos(files.map((f) => ({ file: f, rel: f.name })), S.logoFolder || 'General');
  });
  $('#st-logodel').addEventListener('click', async () => {
    if (!S.logoFolder) return;
    const l = S.logos.find((x) => x.folder === S.logoFolder);
    if (!confirm(`¿Borrar la carpeta «${S.logoFolder}» y sus ${l ? l.files.length : 0} logos del disco?\n(Las capas que ya los usan se quedarán sin imagen.)`)) return;
    await api('/api/logos?folder=' + encodeURIComponent(S.logoFolder), { method: 'DELETE' });
    toast(`Carpeta «${S.logoFolder}» borrada`, 'info');
    S.logoFolder = ''; loadLogos();
  });
  // soltar en la pestaña Iconos (cualquier fuente): se añaden como logos
  {
    const pane = $('#st-icons');
    let depth = 0;
    pane.addEventListener('dragenter', (e) => { if (e.dataTransfer.types.includes('Files')) { depth++; pane.classList.add('over'); } });
    pane.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; pane.classList.remove('over'); } });
    pane.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    pane.addEventListener('drop', async (e) => {
      e.preventDefault(); depth = 0; pane.classList.remove('over');
      await uploadDropped(dropEntries(e.dataTransfer));
    });
  }

  // ---------------------------------------------------------------- capas
  const NATIVE_ICON = { Frame: 'frame', ScrollingFrame: 'scroll', CanvasGroup: 'canvasgroup', TextLabel: 'text', TextButton: 'button', TextBox: 'textbox', ImageLabel: 'image', ImageButton: 'button' };
  const typeIcon = (n) => SVGI(n.rbxClass
    ? (n.rbxClass === 'Frame' && +R.prop(n, 'BackgroundTransparency') >= 1 && n.children?.length ? 'group' : NATIVE_ICON[n.rbxClass] || 'square')
    : ({ text: 'text', image: 'image', html: 'shapes', group: 'group' }[n.type] || (hasTok(n, 'fx') ? 'sparkle' : 'square')), 14);
  const outsideStage = (n) => { const W = S.scene.stage.w, H = S.scene.stage.h; return n.x + n.w <= 0 || n.y + n.h <= 0 || n.x >= W || n.y >= H; };
  const CLS_SHORT = { Frame: 'frm', TextLabel: 'txt', TextButton: 'tbtn', TextBox: 'tbox', ImageLabel: 'img', ImageButton: 'ibtn', ScrollingFrame: 'scrl', CanvasGroup: 'cgrp' };
  // capa generada por una pintura de Figma (pila de rellenos): FigmaFill = posición de la pintura en Figma
  const isFillLayer = (n) => n.attributes?.FigmaFill != null;

  // ---------------------------------------------------------------- texturas de Figma (receta en attributes.FigmaSpec, ver fills.js)
  const RF = window.RBXFills;
  const fillKids = (n, fid) => (n.children || []).filter((k) => isFillLayer(k) && +k.attributes.FigmaFill === fid);
  const setSpec = (ks, spec) => ks.forEach((k) => { k.attributes = { ...(k.attributes || {}), FigmaSpec: JSON.stringify(spec) }; });
  // el tinte de luces/sombras depende del fondo del nodo: al cambiarlo se recalcula (sin tocar las imágenes)
  function retintFills(n) {
    const base = RF.baseOf(n.props, n.mods);
    if (!base) return;
    const st = (n.mods || []).find((m) => m.ClassName === 'UIStroke'), rec = RF.strokeOf(st);
    if (rec) {
      const r = RF.blendOver(rec.blend, base, rec.color);
      if (r) {
        st.props = { ...(st.props || {}), Color: r.color };
        st.children = (st.children || []).filter((c) => c.ClassName !== 'UIGradient');
        if (r.gradient) st.children.push({ ClassName: 'UIGradient', Name: 'UIGradient', props: r.gradient });
      }
    }
    for (const k of n.children || []) {
      const spec = RF.specOf(k), part = k.attributes?.FigmaPart;
      if (spec && part === 'solid') {
        const L = RF.solidLayer(spec, base, null);
        k.props = { ...(k.props || {}), BackgroundColor3: L.props.BackgroundColor3 };
        if (L.props.BackgroundTransparency != null) k.props.BackgroundTransparency = L.props.BackgroundTransparency; else delete k.props.BackgroundTransparency;
        k.mods = (k.mods || []).filter((m) => m.ClassName !== 'UIGradient');
        const lg = (L.children || []).find((c) => c.ClassName === 'UIGradient'); if (lg) k.mods.push(lg);
        continue;
      }
      if (!spec || (part !== 'hi' && part !== 'lo')) continue;
      const t = RF.tintFor(spec.blend, part, base);
      k.props ||= {};
      if (t.color === '#FFFFFF') delete k.props.ImageColor3; else k.props.ImageColor3 = t.color;
      k.mods = (k.mods || []).filter((m) => m.ClassName !== 'UIGradient');
      if (t.gradient) k.mods.push({ ClassName: 'UIGradient', Name: 'UIGradient', props: t.gradient });
    }
  }
  // receta cambiada -> el servidor da las máscaras (PNG sin color, compartidas) -> capas nuevas en el mismo sitio
  async function rebuildFill(n, fid, spec) {
    let r = { masks: {} };
    if (spec.type !== 'solid') {
      try { r = await fetch('/api/fills/masks', { method: 'POST', body: JSON.stringify({ spec }) }).then((x) => x.json()); }
      catch (e) { r = { error: String(e.message || e) }; }
    }
    if (r.error) { toast('No se pudo rehacer la textura: ' + r.error, 'error'); return false; }
    const old = fillKids(n, fid);
    const base = RF.baseOf(n.props, n.mods), corner = (n.mods || []).find((m) => m.ClassName === 'UICorner') || null;
    const insts = RF.layersFor(spec, r.masks, base, corner);
    if (!base) for (const inst of insts) {                 // fondo desconocido (viene de otra capa): se conserva el tinte importado
      const prev = old.find((k) => k.attributes?.FigmaPart === inst.attributes.FigmaPart);
      if (prev?.props?.ImageColor3) inst.props.ImageColor3 = prev.props.ImageColor3;
      const pg = (prev?.mods || []).find((m) => m.ClassName === 'UIGradient');
      if (pg) inst.children = [...(inst.children || []).filter((c) => c.ClassName !== 'UIGradient'), JSON.parse(JSON.stringify(pg))];
    }
    const kids = n.children || (n.children = []);
    let at = old.length ? kids.indexOf(old[0]) : kids.filter((k) => isFillLayer(k) && +k.attributes.FigmaFill < fid).length;
    pushUndo();
    n.children = kids.filter((k) => !old.includes(k));
    at = Math.min(at, n.children.length);
    n.children.splice(at, 0, ...insts.map((inst) => { const x = R.importInto(inst, n.w, n.h); delete x.geo0; return x; }));
    update(); renderLayers(); renderProps();
    return true;
  }
  const FILL_MODES = [['Crop', 'Rellenar'], ['Fit', 'Ajustar'], ['Stretch', 'Estirar'], ['Tile', 'Mosaico']];
  // añadir un relleno nuevo (encima de los que haya) a cualquier capa: textura en Overlay o color con fusión
  const STUD_TEX = 'assets/ui-resources/Textures/Stud/0090_Stud_texture.png';
  async function addFill(n, kind) {
    if (n.mods?.some((m) => m.ClassName === 'UIListLayout' || m.ClassName === 'UIGridLayout')) {
      toast('Esta capa ordena a sus hijos con un layout: pon el relleno en un Frame de fondo (las capas de relleno también se ordenarían)', 'warn'); return;
    }
    const fid = Math.max(0, ...(n.children || []).filter(isFillLayer).map((k) => +k.attributes.FigmaFill || 0)) + 1;
    if (kind === 'solid') {
      const spec = { type: 'solid', fill: fid, paint: 'Solid', color: '#FFFFFF', blend: 'OVERLAY', opacity: 0.35 };
      if (await rebuildFill(n, fid, spec)) openFillWin(n, fid);
      return;
    }
    const src = (S.resources || []).some((r) => r.src.endsWith(STUD_TEX)) ? STUD_TEX : null;
    if (!src) { toast('No hay texturas en local: node tools/ui-resources.mjs fetch 90 (o elige una imagen en el panel)', 'warn'); }
    const dims = await new Promise((ok) => { if (!src) return ok([64, 64]); const im = new Image(); im.onload = () => ok([im.naturalWidth, im.naturalHeight]); im.onerror = () => ok([64, 64]); im.src = '../' + src; });
    const spec = { fill: fid, paint: 'Texture', blend: 'OVERLAY', src: src || STUD_TEX, srcW: dims[0], srcH: dims[1], mode: 'Tile', scale: Math.round(48 / dims[0] * 1000) / 1000,
      k: 1, crop: null, opacity: 1, filter: null, mirror: false };
    if (await rebuildFill(n, fid, spec)) openFillWin(n, fid);
  }
  const fillWins = new Map();
  const refreshFillWin = (n, fid) => { const f = fillWins.get(n.id + ':' + fid); if (f) f(); };
  // panel flotante de un relleno (como el de Figma): imagen, fusión, modo, escala, opacidad, ajustes
  function openFillWin(n, fid) {
    const key = n.id + ':' + fid;
    const w = openWin({ id: 'fill:' + key, modal: false, width: 300, icon: 'image', title: 'Relleno', sub: n.name,
      onClose: () => fillWins.delete(key) });
    let busy = false;
    const render = () => {
      if (w.closed) return;
      const ks = fillKids(n, fid), spec = ks[0] && RF.specOf(ks[0]);
      if (!spec) { closeWin(w); return; }
      w.titleEl.textContent = (spec.type === 'solid' ? 'Color' : spec.paint || 'Image') + (spec.blend && spec.blend !== 'NORMAL' ? ' · ' + (RF.BLENDS.find((b) => b[0] === spec.blend)?.[1] || spec.blend) : '');
      const apply = async (patch) => {
        if (busy) return;
        busy = true; w.el.classList.add('busy');
        const ok = await rebuildFill(n, fid, { ...spec, ...patch });
        busy = false; w.el.classList.remove('busy');
        if (ok) render();
      };
      if (spec.type === 'solid') {
        w.set([
          row('Color', paintIn(spec.color || '#FFFFFF', 1, (v) => { clearTimeout(w.t); w.t = setTimeout(() => apply({ color: v }), 250); }, null)),
          row('Fusión', selIn(RF.BLENDS, spec.blend || 'NORMAL', (v) => apply({ blend: v }))),
          row('Opacidad', bind(h('input', { type: 'number', value: Math.round((spec.opacity ?? 1) * 100), min: 0, max: 100, step: 1 }),
            (v) => { const x = parseFloat(v); if (isFinite(x)) apply({ opacity: clamp(x / 100, 0, 1) }); }, 'change'), note('%')),
          note('Roblox no tiene modos de fusión: se pinta el color que da la fusión sobre el fondo de la capa (se recalcula si cambias el fondo).'),
        ], [h('button', { class: 'st-btn', onclick: () => { pushUndo(); removeIds(fillKids(n, fid).map((k) => k.id)); update(); renderLayers(); renderProps(); closeWin(w); } }, 'Quitar')]);
        return;
      }
      const texPick = () => {                     // texturas/efectos de ui-resources que hay en local
        const list = (S.resources || []).filter((r) => /Textures|Effects/.test(r.cat));
        const grid = h('div', { class: 'st-tex-grid' }, ...list.slice(0, 240).map((r) => h('button', { class: 'st-tex', title: r.title, style: `background-image:url("${r.src}")`,
          onclick: () => { const src = r.src.replace(/^(\.\.\/)+/, ''); const im = new Image(); im.onload = () => apply({ src, srcW: im.naturalWidth, srcH: im.naturalHeight, crop: null, mirror: false }); im.src = r.src; } })));
        return list.length ? h('details', { class: 'st-tex-pick' }, h('summary', {}, `Texturas y efectos (${list.length})`), grid)
          : note('Sin texturas en local: node tools/ui-resources.mjs fetch <id> (ver estilos/resources.md).');
      };
      const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', style: 'display:none', onchange: async () => {
        const f = file.files[0]; if (!f) return;
        const r = await fetch('/api/figma/image', { method: 'POST', body: f }).then((x) => x.json()).catch((e) => ({ error: String(e) }));
        if (r.error) { toast(r.error, 'error'); return; }
        apply({ src: r.path, srcW: r.w, srcH: r.h, crop: null, mirror: false });
      } });
      const flt = spec.filter || {};
      const slider = (key, label) => {
        const val = h('span', { class: 'st-fw-val' }, String(Math.round((flt[key] || 0) * 100)));
        const inp = h('input', { type: 'range', min: -100, max: 100, step: 1, value: Math.round((flt[key] || 0) * 100),
          oninput: () => { val.textContent = inp.value; },
          onchange: () => { const f = { ...flt, [key]: +inp.value / 100 }; if (!f[key]) delete f[key]; apply({ filter: Object.keys(f).length ? f : null }); },
          ondblclick: () => { inp.value = 0; inp.onchange(); } });
        return h('div', { class: 'st-fw-slider' }, h('span', { class: 'st-l' }, label), inp, val);
      };
      const tilePx = spec.mode === 'Tile' ? Math.round((spec.srcW || 64) * (spec.scale || 1) * (spec.k || 1) * 10) / 10 : 0;
      w.set([
        h('div', { class: 'st-fw-prev' + (spec.mode === 'Tile' ? ' tile' : ''), style: `background-image:url("${R.imageUrl(spec.src)}");` + (spec.mode === 'Tile' ? `background-size:${Math.max(8, tilePx)}px` : '') },
          h('button', { class: 'st-btn st-fw-change', onclick: () => file.click() }, 'Cambiar imagen'), file),
        texPick(),
        row('Modo', selIn(FILL_MODES, spec.mode, (v) => apply({ mode: v, paint: v === 'Tile' ? 'Texture' : 'Image' }))),
        spec.mode === 'Tile' ? row('Escala', bind(h('input', { type: 'number', value: Math.round((spec.scale || 1) * 1000) / 10, step: '1', min: '1' }),
          (v) => { const x = parseFloat(v); if (isFinite(x) && x > 0) apply({ scale: x / 100 }); }, 'change'), note(`% · tesela ${tilePx} px`)) : null,
        spec.crop ? row('Recorte', note(`${Math.round(spec.crop[2] * 100)}% × ${Math.round(spec.crop[3] * 100)}% de la imagen`),
          h('button', { class: 'st-btn', onclick: () => apply({ crop: null }) }, 'Quitar')) : null,
        row('Fusión', selIn(RF.BLENDS, spec.blend || 'NORMAL', (v) => apply({ blend: v }))),
        row('Opacidad', bind(h('input', { type: 'number', value: Math.round((spec.opacity ?? 1) * 100), min: 0, max: 100, step: 1 }),
          (v) => { const x = parseFloat(v); if (isFinite(x)) apply({ opacity: clamp(x / 100, 0, 1) }); }, 'change'), note('%')),
        h('h5', { class: 'st-fw-h' }, 'Ajustes'),
        slider('exposure', 'Exposición'), slider('contrast', 'Contraste'), slider('saturation', 'Saturación'),
        note(RF.groupOf(spec.blend) ? 'Roblox no tiene modos de fusión: se exporta como capas de luz y sombra teñidas con el color de debajo (se recalculan solas si cambias el fondo).' : 'Imagen normal.'),
      ], [
        h('button', { class: 'st-btn', onclick: () => setSel(fillKids(n, fid).map((k) => k.id)) }, 'Seleccionar capas'),
        h('button', { class: 'st-btn', onclick: () => { pushUndo(); removeIds(fillKids(n, fid).map((k) => k.id)); update(); renderLayers(); renderProps(); closeWin(w); } }, 'Quitar'),
      ]);
    };
    fillWins.set(key, render);
    render();
  }
  function renderLayers() {
    const P = $('#st-layers'); P.innerHTML = '';
    if (!S.scene) return;
    const add = (list, depth) => {
      for (let i = list.length - 1; i >= 0; i--) {
        const n = list[i]; if (isFillLayer(n)) continue;
        P.append(layerRow(n, depth));
        if (n.children?.length && !S.collapsed.has(n.id)) add(n.children, depth + 1);
      }
    };
    add(S.scene.nodes, 0);
  }
  function layerRow(n, depth) {
    const kids = n.children?.some((k) => !isFillLayer(k));
    const row = h('div', { class: 'st-lrow' + (S.sel.includes(n.id) ? ' sel' : '') + (n.hidden ? ' dim' : ''), draggable: 'true', 'data-id': n.id,
      style: `padding-left:${4 + depth * 13}px` },
      h('span', { class: 'st-tw', innerHTML: kids ? SVGI(S.collapsed.has(n.id) ? 'chevronRight' : 'chevronDown', 12) : '',
        onclick: (e) => { e.stopPropagation(); if (S.collapsed.has(n.id)) S.collapsed.delete(n.id); else S.collapsed.add(n.id); renderLayers(); } }),
      h('span', { class: 'st-ti', innerHTML: typeIcon(n) }),
      h('span', { class: 'st-tn', ondblclick: (e) => renameInline(e.target, n) }, n.name || n.type),
      depth === 0 && outsideStage(n) ? h('span', { class: 'st-ltag out', title: 'Fuera de la pantalla (del marco)' }, 'fuera') : null,
      n.rbxClass && R.prop(n, 'Visible') === false ? h('span', { class: 'st-ltag inv', title: 'Visible = false: empieza oculta en el juego' }, 'oculta') : null,
      n.rbxClass ? h('span', { class: 'st-ltag cls', title: n.rbxClass }, CLS_SHORT[n.rbxClass] || n.rbxClass) : null,
      !n.rbxClass && n.rbx ? h('span', { class: 'st-ltag', title: 'Se exporta como ' + n.rbx }, n.rbx === 'image' ? 'img' : n.rbx) : null,
      h('span', { class: 'st-tb' + (n.locked ? ' on' : ''), title: 'Bloquear', innerHTML: SVGI(n.locked ? 'lock' : 'unlock', 14), onclick: (e) => { e.stopPropagation(); pushUndo(); n.locked = !n.locked; renderLayers(); } }),
      h('span', { class: 'st-tb' + (n.hidden ? ' on' : ''), title: 'Ocultar', innerHTML: SVGI(n.hidden ? 'eyeOff' : 'eye', 14), onclick: (e) => { e.stopPropagation(); pushUndo(); n.hidden = !n.hidden; refresh(); } }));
    row.addEventListener('click', (e) => { if (e.shiftKey) toggleSel(n.id); else setSel([n.id]); });
    row.addEventListener('mouseenter', () => { S.hover = n.id; drawOverlay(); });
    row.addEventListener('mouseleave', () => { S.hover = null; drawOverlay(); });
    row.addEventListener('dragstart', (e) => { S.dragLayer = n.id; e.dataTransfer.setData('text/plain', n.id); });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      const r = row.getBoundingClientRect(), f = (e.clientY - r.top) / r.height;
      row.dataset.drop = isContainer(n) && f > 0.3 && f < 0.7 ? 'in' : f < 0.5 ? 'above' : 'below';
    });
    row.addEventListener('dragleave', () => delete row.dataset.drop);
    row.addEventListener('drop', (e) => { e.preventDefault(); const m = row.dataset.drop; delete row.dataset.drop; moveLayer(S.dragLayer, n.id, m); });
    return row;
  }
  function renameInline(span, n) {
    const i = h('input', { value: n.name || '', style: 'width:100%' });
    span.replaceWith(i); i.focus(); i.select();
    const done = (ok) => { if (ok && i.value !== n.name) { pushUndo(); n.name = i.value.replace(/[^\w]/g, '') || n.name; } renderLayers(); renderProps(); };
    i.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); e.stopPropagation(); });
    i.addEventListener('blur', () => done(true));
  }

  // ---------------------------------------------------------------- propiedades
  function bind(el, apply, evt = 'input') {      // una entrada de deshacer por edición continua
    let pushed = false;
    el.addEventListener('focus', () => { pushed = false; });
    el.addEventListener(evt, () => { if (!pushed) { pushUndo(); pushed = true; } apply(el.type === 'checkbox' ? el.checked : el.value); });
    el.addEventListener('change', () => { pushed = false; });
    return el;
  }
  const sec = (title, ...rows) => h('section', { class: 'st-sec' }, h('h4', {}, title), ...rows);
  const row = (label, ...inputs) => h('div', { class: 'st-row' }, h('span', { class: 'st-l' }, label), ...inputs);
  const numIn = (v, apply, attrs = {}) => bind(h('input', { type: 'number', value: v ?? '', step: attrs.step || '1', placeholder: attrs.placeholder || '', ...(attrs.id ? { id: attrs.id } : {}) }), (x) => apply(x === '' ? '' : +x));
  const txtIn = (v, apply, attrs = {}) => bind(h('input', { type: 'text', value: v ?? '', ...attrs }), apply);
  const selIn = (opts, v, apply) => bind(h('select', {}, ...opts.map(([val, lab]) => h('option', { value: val, selected: val === v }, lab))), apply, 'change');
  const chkIn = (v, apply) => bind(h('input', { type: 'checkbox', checked: !!v }), apply, 'change');
  const colorIn = (v, apply) => bind(h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(v) ? v : '#ffffff', style: 'flex:none;width:34px;padding:0' }), apply);

  // muestra + hex + % (como el panel de Figma)
  function paintIn(color, alpha, onColor, onAlpha) {
    const c = hex6(color);
    const box = h('div', { class: 'st-paint' });
    const hexI = h('input', { type: 'text', class: 'st-hex', value: c.slice(1).toUpperCase(), maxlength: 7, spellcheck: false });
    const sw = bind(h('input', { type: 'color', value: c }), (v) => { hexI.value = v.slice(1).toUpperCase(); onColor(v.toUpperCase()); });
    bind(hexI, (v) => { const m = /^#?([0-9a-f]{6})$/i.exec(v.trim()); if (m) { sw.value = '#' + m[1]; onColor('#' + m[1].toUpperCase()); } });
    box.append(sw, hexI);
    if (onAlpha) box.append(bind(h('input', { type: 'text', class: 'st-pct', value: Math.round(alpha * 100) + '%' }), (v) => { const x = parseFloat(v); if (isFinite(x)) onAlpha(clamp(x / 100, 0, 1)); }));
    return box;
  }
  const secH = (title, actions, ...rows) => h('section', { class: 'st-sec' }, h('h4', {}, title, actions ? h('span', { class: 'st-hact' }, ...actions) : null), ...rows);
  const actBtn = (ic, title, fn) => h('button', { title, onclick: fn, innerHTML: SVGI(ic, 16) });
  function bgSection() {
    const d = S.scene.design || (S.scene.design = {});
    const cur = d.background || 'baseplate';
    const pick = (v) => { pushUndo(); d.background = v; update(); renderProps(); };
    const grid = h('div', { class: 'st-bgs' });
    for (const [k, label, css] of RBXRender.BG_PRESETS) grid.append(h('button', { class: cur === k ? 'on' : '', title: label, style: `background:${css}`, onclick: () => pick(k) }, h('span', {}, label)));
    for (const bp of S.backgrounds || []) grid.append(h('button', { class: cur === 'img:' + bp ? 'on' : '', title: bp.split('/').pop(), style: `background:url('../${bp}') center/cover`, onclick: () => pick('img:' + bp) }));
    const up = h('input', { type: 'file', accept: 'image/*', hidden: true });
    up.addEventListener('change', async () => {
      const f = up.files[0]; if (!f) return;
      try { const r = await api('/api/background', { method: 'POST', body: f }); S.backgrounds = [...new Set([...(S.backgrounds || []), r.path])]; pick('img:' + r.path); }
      catch (e) { status('No se pudo subir el fondo: ' + (e.data?.error || e.message), true); }
    });
    grid.append(h('button', { class: 'st-bgup', title: 'Subir una captura de tu juego como fondo', onclick: () => up.click(), innerHTML: SVGI('upload', 16) + 'Subir' }), up);
    const solid = /^#[0-9a-f]{6}$/i.test(cur) ? cur : '#1E1E1E';
    return secH('Fondo del lienzo', null, grid,
      h('div', { class: 'st-row', style: 'margin-top:8px' }, h('span', { class: 'st-l' }, 'Color'), paintIn(solid, 1, (v) => { d.background = v; update(); }, null)),
      note('Referencia para diseñar: no se exporta a Roblox.'));
  }

  function renderProps() {
    const P = $('#st-props'); P.innerHTML = '';
    if (!S.scene) return;
    if (!S.sel.length) { P.append(sceneProps()); return; }
    P.append(alignTools());
    if (S.sel.length > 1) { P.append(h('p', { class: 'st-note' }, `${S.sel.length} capas seleccionadas. Ctrl+G para agrupar.`)); return; }
    const n = node(S.sel[0]); if (!n) return;
    P.append(commonProps(n));
    if (n.rbxClass) { P.append(...nativeProps(n)); return; }
    if (n.type === 'text') P.append(textProps(n));
    if (n.type === 'image') P.append(imageProps(n));
    if (n.type === 'box' || n.type === 'group') P.append(boxProps(n));
    P.append(advancedProps(n));
  }

  function sceneProps() {
    let count = 0; walk(() => { count++; });
    if (isNative()) return nativeSceneProps(count);
    return h('div', {},
      sec('Escena', row('Nombre', h('b', {}, S.name)), row('Tamaño', h('span', {}, `${S.scene.stage.w} × ${S.scene.stage.h}`)), row('Capas', h('span', {}, String(count)))),
      bgSection(),
      sec('Atajos', h('div', { class: 'st-kbd', innerHTML: [
        '<b>Clic</b> seleccionar · <b>Ctrl+clic</b> profundo · <b>Doble clic</b> entrar · <b>Esc</b> padre',
        '<b>Arrastrar</b> mover (<b>Shift</b> eje, <b>Alt</b> sin imán) · <b>asas</b> tamaño (<b>Shift</b> proporción)',
        '<b>Flechas</b> 1px (<b>Shift</b> 10) · <b>Ctrl+D</b> duplicar · <b>Ctrl+C/V</b> · <b>Supr</b> borrar',
        '<b>Ctrl+G</b> agrupar · <b>Ctrl+Shift+G</b> desagrupar · <b>Ctrl+]</b>/<b>[</b> orden',
        '<b>Ctrl+Z/Y</b> deshacer · <b>Ctrl+S</b> guardar · <b>Espacio+arrastrar</b>/<b>rueda</b> vista · <b>Ctrl+rueda</b> zoom · <b>Shift+1</b> ajustar',
      ].join('<br>') })));
  }
  function alignTools() {
    const b = (ic, title, fn) => h('button', { title, onclick: fn, innerHTML: SVGI(ic, 16) });
    return sec(S.sel.length > 1 ? 'Alinear selección' : 'Alinear en el padre', h('div', { class: 'st-tools' },
      b('alignLeft', 'Izquierda', () => align('l')), b('alignCenterH', 'Centro horizontal', () => align('c')), b('alignRight', 'Derecha', () => align('r')),
      b('alignTop', 'Arriba', () => align('t')), b('alignCenterV', 'Centro vertical', () => align('m')), b('alignBottom', 'Abajo', () => align('b')),
      b('distH', 'Distribuir en horizontal', () => align('dh')), b('distV', 'Distribuir en vertical', () => align('dv')),
      b('duplicate', 'Duplicar (Ctrl+D)', duplicate), b('forward', 'Traer adelante (Ctrl+])', () => zorder(1)), b('backward', 'Enviar atrás (Ctrl+[)', () => zorder(-1)), b('trash', 'Borrar (Supr)', del)));
  }
  function commonProps(n) {
    const geo = (k) => h('label', {}, h('b', {}, k.toUpperCase()), numIn(n[k], (v) => { if (v === '') return; n[k] = v; applyGeom(n); drawOverlay(); }, { step: '0.5' }));
    return sec('Capa',
      row('Nombre', txtIn(n.name, (v) => { n.name = v.replace(/[^\w]/g, ''); renderLayers(); })),
      n.rbxClass ? null : row('Exportar', selIn([['image', 'Imagen (PNG)'], ['text', 'Texto (TextLabel)'], ['frame', 'Frame (vacío)'], ['', 'No (se hornea en el padre)']],
        n.rbx || '', (v) => { n.rbx = v || null; renderLayers(); })),
      !n.rbxClass && n.rbx === 'image' ? row('Margen', numIn(n.pad ?? 0, (v) => { n.pad = v === '' ? undefined : v; }), h('span', { class: 'st-note', style: 'margin:0' }, 'px extra')) : null,
      h('div', { class: 'st-grid4' }, geo('x'), geo('y'), geo('w'), geo('h')),
      marginsRow(n),
      n.rbxClass || n.type === 'text' || n.type === 'html' ? row('Rotación', numIn(n.rot || 0, (v) => { n.rot = +v || 0; update(); })) : null,
      h('div', { class: 'st-grid2', style: 'margin-top:6px' },
        h('label', {}, chkIn(n.hidden, (v) => { n.hidden = v; update(); }), 'Oculto'),
        h('label', {}, chkIn(n.locked, (v) => { n.locked = v; renderLayers(); }), 'Bloqueado')));
  }
  function textProps(n) {
    const refit = () => { fitText(n); update(); };
    const g = (n.grad || '#fff7b0,#ffc83a').split(',');
    return sec('Texto',
      row('Texto', txtIn(n.text, (v) => { n.text = v; refit(); }, { id: 'st-f-text' })),
      row('Tamaño', selIn(TSIZES, getTok(n, RE_SIZE), (v) => { setTok(n, RE_SIZE, v); refit(); })),
      row('px', numIn(parseFloat(getSt(n, 'font-size')) || '', (v) => { setSt(n, 'font-size', v === '' ? '' : v + 'px'); refit(); }, { placeholder: 'auto' })),
      row('Color', selIn(TCOLORS, getTok(n, RE_COLOR), (v) => { setTok(n, RE_COLOR, v); update(); }),
        colorIn(getSt(n, 'color'), (v) => { setSt(n, 'color', v); update(); })),
      row('Alinear', selIn([['', 'Centro'], ['t-left', 'Izquierda'], ['t-right', 'Derecha']], getTok(n, RE_ALIGN), (v) => { setTok(n, RE_ALIGN, v); update(); })),
      row('Degradado', chkIn(!!n.grad, (v) => { n.grad = v ? g.join(',') : undefined; update(); }),
        colorIn(g[0], (v) => { n.grad = v + ',' + (n.grad || g.join(',')).split(',')[1]; update(); }),
        colorIn(g[1], (v) => { n.grad = (n.grad || g.join(',')).split(',')[0] + ',' + v; update(); })),
      h('button', { onclick: () => { pushUndo(); refit(); renderProps(); } }, 'Ajustar caja al texto'));
  }
  function imageProps(n) {
    return sec('Imagen',
      h('div', { class: 'st-row' }, h('img', { class: 'st-prev', src: n.src }),
        h('button', { onclick: () => { switchTab('icons'); $('#st-iconq').focus(); } }, 'Cambiar icono…')),
      row('Ruta', txtIn(n.src, (v) => { n.src = v; update(); })),
      row('Sombra', chkIn(hasTok(n, 'ic-sh'), (v) => { setTok(n, /^ic-sh$/, v ? 'ic-sh' : ''); update(); })),
      row('Opacidad', numIn(getSt(n, 'opacity') || '', (v) => { setSt(n, 'opacity', v === '' ? '' : clamp(v, 0, 1)); update(); }, { step: '0.05', placeholder: '1' })));
  }
  function boxProps(n) {
    const isPc = hasTok(n, 'pc'), isFx = hasTok(n, 'fx');
    const theme = getTok(n, /^th-/).slice(3);
    const sw = h('div', { class: 'st-sw' },
      ...Object.entries(THEMES).map(([k, c]) => h('button', { class: k === theme ? 'on' : '', title: k, style: `background:${c}`,
        onclick: () => { pushUndo(); setTok(n, /^th-/, 'th-' + k); update(); renderProps(); } })),
      h('button', { title: 'Sin tema', style: 'background:repeating-linear-gradient(45deg,#555 0 4px,#333 4px 8px)', onclick: () => { pushUndo(); setTok(n, /^th-/, ''); update(); renderProps(); } }));
    const vnum = (label, k, ph) => row(label, numIn(getSt(n, k) || '', (v) => { setSt(n, k, v === '' ? '' : v); update(); }, { step: '0.05', placeholder: ph }));
    return sec(isFx ? 'Efecto' : n.type === 'group' ? 'Contenedor' : 'Pieza',
      isFx ? vnum('Opacidad', 'opacity', 'auto') : null,
      !isFx && n.type === 'box' ? row('Color', sw) : null,
      isPc ? row('Estilo', selIn(VARIANTS, getTok(n, /^v-/), (v) => { setTok(n, /^v-/, v); update(); })) : null,
      isPc ? h('div', { class: 'st-grid2' }, vnum('Studs', '--to', '0.42'), vnum('Brillo', '--gloss', '0.26'), vnum('Reflejos', '--sheen', '0.34'), vnum('Bisel', '--bevel', '0.3')) : null,
      isPc ? row('Degradado', colorIn(getSt(n, '--a'), (v) => { setSt(n, '--a', v); update(); }), colorIn(getSt(n, '--b'), (v) => { setSt(n, '--b', v); update(); }),
        h('button', { title: 'Quitar degradado propio', onclick: () => { pushUndo(); setSt(n, '--a', ''); setSt(n, '--b', ''); update(); renderProps(); } }, '×')) : null,
      n.type === 'group' ? h('p', { class: 'st-note', style: 'margin:0' }, 'Transparente. En Roblox es un Frame.') : null);
  }
  function advancedProps(n) {
    return sec('Avanzado',
      row('Clases', txtIn(n.cls, (v) => { n.cls = v; update(); })),
      h('textarea', { class: 'st-css', placeholder: 'CSS extra (opacity:.5; --sheen:.5 …)', value: n.style || '', oninput: (e) => { if (!e.target._p) { pushUndo(); e.target._p = 1; } n.style = e.target.value; update(); } }));
  }

  // ---------------------------------------------------------------- propiedades nativas (Instances reales)
  const FAMILIES = ['Montserrat', 'GothamSSm', 'BuilderSans', 'FredokaOne', 'LuckiestGuy', 'Bangers', 'SourceSansPro', 'Roboto', 'RobotoMono', 'Oswald',
    'Nunito', 'Arimo', 'PressStart2P', 'Creepster', 'DenkOne', 'PermanentMarker', 'TitilliumWeb', 'Ubuntu', 'AmaticSC', 'Jura', 'Merriweather',
    'IndieFlower', 'Kalam', 'Michroma', 'Sarpanch', 'SpecialElite', 'PatrickHand'];
  const WEIGHTS = ['Thin', 'ExtraLight', 'Light', 'Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold', 'Heavy'];
  const MOD_CLASSES = ['UICorner', 'UIStroke', 'UIGradient', 'UIPadding', 'UIListLayout', 'UIGridLayout', 'UIScale', 'UIAspectRatioConstraint', 'UISizeConstraint', 'UITextSizeConstraint'];
  const GUI_CLASSES = ['Frame', 'TextLabel', 'TextButton', 'TextBox', 'ImageLabel', 'ImageButton', 'ScrollingFrame', 'CanvasGroup'];
  const MOD_DEF = {
    UICorner: { CornerRadius: [0, 8] }, UIStroke: { ApplyStrokeMode: 'Border', Thickness: 3, Color: '#000000', LineJoinMode: 'Miter' },
    UIGradient: { Color: [[0, '#FFFFFF'], [1, '#B4B4B4']], Rotation: 90 }, UIPadding: { PaddingTop: [0, 6], PaddingBottom: [0, 6], PaddingLeft: [0, 6], PaddingRight: [0, 6] },
    UIListLayout: { FillDirection: 'Vertical', Padding: [0, 6], SortOrder: 'LayoutOrder' }, UIGridLayout: { CellSize: [0, 96, 0, 96], CellPadding: [0, 8, 0, 8], SortOrder: 'LayoutOrder' },
    UIScale: { Scale: 1 }, UIAspectRatioConstraint: { AspectRatio: 1 }, UISizeConstraint: {}, UITextSizeConstraint: { MaxTextSize: 40 },
  };
  const opts = (arr) => arr.map((v) => [v, v]);
  const hex6 = (v) => (/^#[0-9a-f]{6}$/i.test(v || '') ? v : '#FFFFFF');
  const note = (t) => h('span', { class: 'st-note', style: 'margin:0' }, t);

  // editor JSON: una entrada de deshacer por edición, solo aplica si el JSON es válido
  function jsonArea(value, apply, cls = 'st-json small') {
    const ta = h('textarea', { class: cls, spellcheck: false, value: JSON.stringify(value ?? {}, null, 1) });
    let pushed = false;
    ta.addEventListener('focus', () => { pushed = false; });
    ta.addEventListener('input', () => {
      let v;
      try { v = JSON.parse(ta.value); } catch { ta.style.borderColor = '#c0392b'; return; }
      ta.style.borderColor = '';
      if (!pushed) { pushUndo(); pushed = true; }
      apply(v); update(); renderLayers();
    });
    return ta;
  }
  function windowNames() {
    const out = [];
    walk((n, p) => { if (n.rbxClass && (!p || R.prop(n, 'Visible') === false)) out.push(n.name); });
    return [...new Set(out)];
  }

  function nativeProps(n) {
    const P = n.props || (n.props = {});
    const get = (k) => R.prop(n, k);
    const set = (k, v) => { if (v === '' || v === undefined || v === null) delete P[k]; else P[k] = v; update(); };
    const anchor = (i) => (v) => { const a = [...(get('AnchorPoint') || [0, 0])]; a[i] = +v || 0; set('AnchorPoint', a); };
    const A = get('AnchorPoint') || [0, 0];
    const out = [];
    out.push(sec('Instance',
      row('Clase', selIn(opts(GUI_CLASSES), n.rbxClass, (v) => { n.rbxClass = v; n.type = R.typeOf(v); update(); renderLayers(); renderProps(); })),
      row('Visible', chkIn(get('Visible') !== false, (v) => { set('Visible', v ? undefined : false); renderLayers(); }), note('desmarcado = empieza oculta')),
      row('Anchor', numIn(A[0], anchor(0), { step: '0.5' }), numIn(A[1], anchor(1), { step: '0.5' })),
      h('div', { class: 'st-grid2' },
        row('ZIndex', numIn(P.ZIndex ?? '', (v) => set('ZIndex', v), { placeholder: '1' })),
        row('Orden', numIn(P.LayoutOrder ?? '', (v) => set('LayoutOrder', v), { placeholder: '0' }))),
      row('Recortar', chkIn(!!get('ClipsDescendants'), (v) => set('ClipsDescendants', v || undefined)), note('ClipsDescendants'))));
    const mods0 = n.mods || (n.mods = []);
    const re = () => { update(); renderProps(); };
    // Relleno: color + opacidad, o degradado (UIGradient: el color de fondo se multiplica, por eso se pone blanco)
    const gradM = mods0.find((m) => m.ClassName === 'UIGradient');
    const bt = +get('BackgroundTransparency');
    const upd = () => { retintFills(n); update(); };
    const fillRows = [];
    if (gradM) {
      if (!Array.isArray(gradM.props?.Color)) gradM.props = { ...(gradM.props || {}), Color: [[0, '#FFFFFF'], [1, '#FFFFFF']] };
      const st = gradM.props.Color;
      fillRows.push(row('Inicio', paintIn(st[0][1], 1 - bt, (v) => { st[0][1] = v; upd(); }, (a) => { P.BackgroundTransparency = Math.round((1 - a) * 100) / 100; upd(); })),
        row('Fin', paintIn(st[st.length - 1][1], 1, (v) => { st[st.length - 1][1] = v; upd(); }, null)),
        row('Ángulo', numIn(gradM.props.Rotation ?? 0, (v) => { gradM.props.Rotation = +v || 0; upd(); }), note('90 = de arriba abajo')));
    } else fillRows.push(row('Color', paintIn(get('BackgroundColor3'), 1 - bt, (v) => { P.BackgroundColor3 = v; upd(); }, (a) => { P.BackgroundTransparency = Math.round((1 - a) * 100) / 100; upd(); })));
    // pinturas de Figma convertidas en capas hijas: una fila por pintura (arriba la de encima, como en Figma)
    const groups = new Map();
    for (const k of n.children || []) if (isFillLayer(k)) { const id = +k.attributes.FigmaFill; (groups.get(id) || groups.set(id, []).get(id)).push(k); }
    const BLEND_ES = { OVERLAY: 'Overlay', SOFT_LIGHT: 'Soft light', HARD_LIGHT: 'Hard light', MULTIPLY: 'Multiply', SCREEN: 'Screen', COLOR_DODGE: 'Color dodge',
      COLOR_BURN: 'Color burn', DARKEN: 'Darken', LIGHTEN: 'Lighten', LUMINOSITY: 'Luminosity', COLOR: 'Color', HUE: 'Hue', SATURATION: 'Saturation', DIFFERENCE: 'Difference', EXCLUSION: 'Exclusion' };
    const stack = [];
    for (const [, ks] of [...groups].sort((a, b) => b[0] - a[0])) {
      const k0 = ks[0], isImg = /Image/.test(k0.rbxClass || ''), tk = isImg ? 'ImageTransparency' : 'BackgroundTransparency';
      const vis = ks.some((k) => R.prop(k, 'Visible') !== false);
      const alpha = 1 - (+(k0.props?.[tk]) || 0);
      const setAll = (fn) => { pushUndo(); ks.forEach(fn); re(); };
      const spec0 = RF.specOf(k0), fid = +k0.attributes.FigmaFill;
      const thumb = spec0 ? h('span', { class: 'st-fill-thumb', style: `background-image:url("${R.imageUrl(spec0.src)}")` })
        : h('span', { class: 'st-fill-ic', innerHTML: SVGI(isImg ? 'image' : 'square', 14) });
      const label = h('button', { class: 'st-fill-name', title: spec0 ? 'Ajustes del relleno' : 'Seleccionar la capa (' + ks.map((k) => k.name).join(', ') + ')',
        onclick: () => (spec0 ? openFillWin(n, fid) : setSel([k0.id])) },
        thumb, k0.attributes.FigmaPaint || k0.name,
        k0.attributes.FigmaBlend ? h('span', { class: 'st-ltag', title: 'Fusión de Figma (en Roblox: capas de luz/sombra)' }, BLEND_ES[k0.attributes.FigmaBlend] || k0.attributes.FigmaBlend) : null);
      const pct = bind(h('input', { type: 'text', class: 'st-pct', value: Math.round(alpha * 100) + '%', title: 'Opacidad' }), (v) => {
        const x = parseFloat(v); if (!isFinite(x)) return;
        ks.forEach((k) => { (k.props ||= {})[tk] = Math.round((1 - clamp(x / 100, 0, 1)) * 100) / 100; if (!k.props[tk]) delete k.props[tk]; });
        if (spec0) setSpec(ks, { ...spec0, opacity: clamp(x / 100, 0, 1) });
        update(); refreshFillWin(n, fid);
      });
      const col = spec0 ? (spec0.type === 'solid' ? h('span', { class: 'st-fill-thumb', style: `background:${spec0.color}` }) : null)
        : !isImg ? paintIn(R.prop(k0, 'BackgroundColor3'), alpha, (v) => { k0.props.BackgroundColor3 = v; update(); }, null) : null;
      stack.push(h('div', { class: 'st-row st-fillrow' + (vis ? '' : ' dim') }, label, col, pct,
        actBtn(vis ? 'eye' : 'eyeOff', vis ? 'Ocultar relleno' : 'Mostrar relleno', () => setAll((k) => { (k.props ||= {}).Visible = vis ? false : undefined; if (vis === false) delete k.props.Visible; })),
        actBtn('minus', 'Quitar relleno', () => { pushUndo(); removeIds(ks.map((k) => k.id)); re(); renderLayers(); })));
    }
    fillRows.unshift(...stack);
    out.push(secH('Relleno', [
      actBtn('image', 'Añadir textura (studs en Overlay)', () => addFill(n, 'texture')),
      actBtn('plus', 'Añadir color con fusión (Overlay, Multiply…)', () => addFill(n, 'solid')),
      actBtn('gradient', gradM ? 'Quitar degradado' : 'Usar degradado', () => {
        pushUndo();
        if (gradM) mods0.splice(mods0.indexOf(gradM), 1);
        else { mods0.push({ ClassName: 'UIGradient', Name: 'UIGradient', props: { Color: [[0, hex6(get('BackgroundColor3')).toUpperCase()], [1, '#8E97A8']], Rotation: 90 } }); P.BackgroundColor3 = '#FFFFFF'; }
        retintFills(n); re();
      }),
      actBtn(bt >= 1 ? 'eyeOff' : 'eye', bt >= 1 ? 'Mostrar fondo' : 'Fondo transparente', () => { pushUndo(); P.BackgroundTransparency = bt >= 1 ? 0 : 1; re(); }),
    ], ...fillRows));
    // Borde (UIStroke)
    const stM = mods0.find((m) => m.ClassName === 'UIStroke');
    out.push(secH('Borde', [actBtn(stM ? 'minus' : 'plus', stM ? 'Quitar borde' : 'Añadir borde', () => {
      pushUndo();
      if (stM) mods0.splice(mods0.indexOf(stM), 1);
      else mods0.push({ ClassName: 'UIStroke', Name: 'UIStroke', props: { ApplyStrokeMode: R.TEXT.has(n.rbxClass) ? 'Contextual' : 'Border', Thickness: 3, Color: '#000000', LineJoinMode: 'Miter' } });
      re();
    })], ...(stM ? [
      row('Color', paintIn(R.mp(stM, 'Color'), 1 - (+R.mp(stM, 'Transparency') || 0), (v) => { stM.props.Color = v; update(); }, (a) => { stM.props.Transparency = Math.round((1 - a) * 100) / 100; update(); })),
      row('Grosor', numIn(R.mp(stM, 'Thickness'), (v) => { stM.props.Thickness = +v || 0; update(); }, { step: '0.5' }),
        selIn([['Border', 'Borde'], ['Contextual', 'Texto']], R.mp(stM, 'ApplyStrokeMode'), (v) => { stM.props.ApplyStrokeMode = v; update(); })),
      row('Uniones', selIn([['Miter', 'Rectas'], ['Round', 'Redondas'], ['Bevel', 'Biseladas']], R.mp(stM, 'LineJoinMode'), (v) => { stM.props.LineJoinMode = v; update(); })),
    ] : [])));
    // borde importado de Figma con fusión: se edita su color/fusión de Figma y Roblox recibe el resultado sobre el fondo
    const srec = RF.strokeOf(stM);
    if (srec) {
      const sec0 = out[out.length - 1], saveRec = () => { stM.attributes = { ...(stM.attributes || {}), FigmaStroke: JSON.stringify(srec) }; retintFills(n); update(); };
      sec0.querySelector('.st-row')?.replaceWith(
        row('Color', paintIn(srec.color, srec.opacity ?? 1, (v) => { srec.color = v; saveRec(); }, (a) => { srec.opacity = a; stM.props.Transparency = Math.round((1 - a) * 100) / 100; if (!stM.props.Transparency) delete stM.props.Transparency; saveRec(); })),
        row('Fusión', selIn(RF.BLENDS, srec.blend, (v) => { srec.blend = v; saveRec(); renderProps(); }), note('de Figma')));
    }
    // Esquinas (UICorner)
    const crM = mods0.find((m) => m.ClassName === 'UICorner');
    out.push(secH('Esquinas', [actBtn(crM ? 'minus' : 'plus', crM ? 'Esquinas rectas' : 'Redondear esquinas', () => {
      pushUndo();
      if (crM) mods0.splice(mods0.indexOf(crM), 1); else mods0.push({ ClassName: 'UICorner', Name: 'UICorner', props: { CornerRadius: [0, 8] } });
      re();
    })], ...(crM ? [row('Radio', numIn((R.mp(crM, 'CornerRadius') || [0, 8])[1], (v) => { const c0 = R.mp(crM, 'CornerRadius') || [0, 8]; crM.props.CornerRadius = [c0[0] || 0, +v || 0]; update(); }),
      note((R.mp(crM, 'CornerRadius') || [0])[0] ? `+ ${Math.round((R.mp(crM, 'CornerRadius')[0]) * 100)}% del lado corto` : 'px'))] : [])));
    if (R.TEXT.has(n.rbxClass)) {
      const f = P.FontFace || { family: 'LegacyArial', weight: 'Regular', style: 'Normal' };
      const fam = String(f.family || 'LegacyArial').replace(/^.*families\//, '').replace(/\.json$/, '');
      const setF = (k, v) => { const cur = { family: fam, weight: f.weight || 'Regular', style: f.style || 'Normal', ...(P.FontFace || {}) }; cur[k] = v; delete P.Font; set('FontFace', cur); };
      const txt = bind(h('textarea', { class: 'st-css', id: 'st-f-text', rows: 2, value: String(get('Text') ?? '') }), (v) => set('Text', v));
      out.push(sec('Texto',
        row('Texto', txt),
        row('Tamaño', numIn(get('TextSize'), (v) => set('TextSize', v)), h('label', {}, chkIn(!!get('TextScaled'), (v) => set('TextScaled', v || undefined)), 'Scaled')),
        row('Color', colorIn(hex6(get('TextColor3')), (v) => set('TextColor3', v.toUpperCase())),
          numIn(P.TextTransparency ?? '', (v) => set('TextTransparency', v), { step: '0.05', placeholder: '0' })),
        row('Fuente', selIn(opts(FAMILIES.includes(fam) ? FAMILIES : [fam, ...FAMILIES]), fam, (v) => setF('family', v)), selIn(opts(WEIGHTS), f.weight || 'Regular', (v) => setF('weight', v))),
        row('Alinear', selIn(opts(['Left', 'Center', 'Right']), get('TextXAlignment'), (v) => set('TextXAlignment', v)),
          selIn(opts(['Top', 'Center', 'Bottom']), get('TextYAlignment'), (v) => set('TextYAlignment', v))),
        h('div', { class: 'st-grid2' },
          h('label', {}, chkIn(!!get('TextWrapped'), (v) => set('TextWrapped', v || undefined)), 'Wrapped'),
          h('label', {}, chkIn(!!get('RichText'), (v) => set('RichText', v || undefined)), 'RichText'))));
    }
    if (R.IMAGE.has(n.rbxClass)) {
      const url = R.imageUrl(get('Image'));
      out.push(sec('Imagen',
        h('div', { class: 'st-row' }, url ? h('img', { class: 'st-prev', src: url }) : note(get('Image') ? 'id sin copia local' : 'sin imagen'),
          h('button', { onclick: () => { switchTab('icons'); $('#st-iconq').focus(); } }, 'Cambiar icono…')),
        row('Image', txtIn(get('Image'), (v) => set('Image', v), { placeholder: 'rbxassetid://… o assets/…' })),
        row('Escala', selIn(opts(['Stretch', 'Fit', 'Crop', 'Tile', 'Slice']), get('ScaleType'), (v) => set('ScaleType', v))),
        row('Tinte', colorIn(hex6(get('ImageColor3')), (v) => set('ImageColor3', v.toUpperCase())),
          numIn(P.ImageTransparency ?? '', (v) => set('ImageTransparency', v), { step: '0.05', placeholder: '0' }))));
    }
    const mods = n.mods || (n.mods = []);
    const addSel = h('select', {}, h('option', { value: '' }, '+ Añadir modificador…'), ...MOD_CLASSES.map((c) => h('option', { value: c }, c)));
    addSel.addEventListener('change', () => {
      const c = addSel.value; if (!c) return;
      pushUndo(); mods.push({ ClassName: c, Name: c, props: JSON.parse(JSON.stringify(MOD_DEF[c] || {})) }); update(); renderProps();
    });
    out.push(sec('Modificadores', h('div', { class: 'st-mods' }, ...mods.map((m, i) => h('div', { class: 'st-mod' },
      h('header', {}, h('b', {}, m.ClassName), h('button', { title: 'Quitar', onclick: () => { pushUndo(); mods.splice(i, 1); update(); renderProps(); } }, '×')),
      jsonArea(m.props || {}, (v) => { m.props = v; })))), addSel));
    if (R.BUTTON.has(n.rbxClass) || n.interactions || n.buttonFx) {
      const fx = n.buttonFx, list = n.interactions || [];
      out.push(sec('Interacción',
        row('Efecto', chkIn(!!fx, (v) => { n.buttonFx = v ? { hover: 1.06, press: 0.9 } : undefined; renderProps(); }),
          fx ? numIn(fx.hover, (v) => { fx.hover = +v || 1; }, { step: '0.01' }) : null, fx ? numIn(fx.press, (v) => { fx.press = +v || 1; }, { step: '0.01' }) : null),
        fx ? note('hover · pulsar (escala)') : null,
        ...list.map((it, i) => h('div', { class: 'st-row' },
          selIn(opts(['toggle', 'open', 'close']), it.action || 'toggle', (v) => { it.action = v; }),
          txtIn(it.target || '', (v) => { it.target = v.replace(/[^\w]/g, '') || undefined; }, { list: 'st-targets', placeholder: 'Ventana' }),
          selIn(opts(['pop', 'none']), it.animation || 'pop', (v) => { it.animation = v; }),
          h('button', { title: 'Quitar', onclick: () => { pushUndo(); list.splice(i, 1); if (!list.length) delete n.interactions; renderProps(); } }, '×'))),
        h('button', { onclick: () => { pushUndo(); (n.interactions || (n.interactions = [])).push({ trigger: 'click', action: 'toggle', target: '', animation: 'pop' }); renderProps(); } }, '+ Al hacer clic…'),
        h('datalist', { id: 'st-targets' }, ...windowNames().map((t) => h('option', { value: t })))));
    }
    out.push(sec('Props (JSON)', jsonArea(P, (v) => { n.props = v; }),
      note('Size y Position salen de X/Y/W/H + Anchor al exportar.')));
    return out;
  }

  function nativeSceneProps(count) {
    const d = S.scene.design || (S.scene.design = { ...R.DESIGN_DEF });
    const g = S.scene.gui || (S.scene.gui = { props: {} });
    const gp = g.props || (g.props = {});
    const setD = (k, v) => { d[k] = v; update(); };
    return h('div', {},
      sec('ScreenGui', row('Nombre', h('b', {}, S.name)), row('Diseño', h('span', {}, `${S.scene.stage.w} × ${S.scene.stage.h}`)), row('Capas', h('span', {}, String(count))),
        row('Autoescala', chkIn(d.autoScale !== false, (v) => setD('autoScale', v)), note('UIScale según la pantalla')),
        row('DisplayOrder', numIn(gp.DisplayOrder ?? '', (v) => { if (v === '') delete gp.DisplayOrder; else gp.DisplayOrder = v; }, { placeholder: '0' })),
        row('Enabled', chkIn(gp.Enabled !== false, (v) => { if (v) delete gp.Enabled; else gp.Enabled = false; })),
        row('Figma', selIn([['1080', 'Diseño 1920×1080 (×0,67)'], ['native', 'Tamaño real 1:1'], ['fit', 'Encajar en el escenario']], d.figmaScale || '1080', (v) => { d.figmaScale = v; }), note('escala al pegar')),
        row('Auto-layout', selIn([['native', 'Nativo (UIListLayout)'], ['fixed', 'Posiciones fijas']], d.figmaLayout || 'native', (v) => { d.figmaLayout = v; }), note('al pegar de Figma')),
        row('Piezas', selIn([['layers', 'Capas editables'], ['flat', 'Imagen plana']], d.figmaBake || 'layers', (v) => { d.figmaBake = v; }), note('color, texturas y máscaras separados'))),
      bgSection(),
      sec('Atributos (JSON)', jsonArea(g.attributes || {}, (v) => { g.attributes = v; })),
      sec('Formato rbxui', h('div', { class: 'st-row', style: 'flex-wrap:wrap' },
        h('button', { class: 'st-btn', onclick: () => doRbxui('import'), innerHTML: SVGI('import', 14) + 'Importar' }),
        h('button', { class: 'st-btn', onclick: () => doRbxui('export'), innerHTML: SVGI('upload', 14) + 'Exportar' }),
        h('button', { class: 'st-btn', onclick: () => doRbxui('prompt'), innerHTML: SVGI('sparkle', 14) + 'Prompt IA' }))),
      sec('Atajos', h('div', { class: 'st-kbd', innerHTML: [
        '<b>V</b> mover · <b>F</b> frame · <b>T</b> texto · <b>I</b> imagen · <b>B</b> botón · <b>H</b> mano (arrastra en el lienzo para dibujar)',
        '<b>Ctrl+V</b> pega lo copiado en <b>Figma</b> (Ctrl+C allí), imágenes, SVG o JSON rbxui · <b>arrastra</b> un .fig, PNG o SVG al lienzo',
        'Se puede dejar cosas <b>fuera del marco</b> (como en Figma): en Roblox quedan fuera de la pantalla · <b>Shift+1</b> ver todo · <b>Shift+2</b> selección',
        '<b>P</b> probar botones / ventanas · <b>Esc</b> salir de probar',
        '<b>Clic</b> seleccionar · <b>Ctrl+clic</b> profundo · <b>Doble clic</b> entrar · <b>Esc</b> padre',
        '<b>Arrastrar</b> mover (<b>Shift</b> eje, <b>Alt</b> sin imán) · <b>asas</b> tamaño (<b>Shift</b> proporción)',
        '<b>Flechas</b> 1px (<b>Shift</b> 10) · <b>Ctrl+D</b> duplicar · <b>Ctrl+C/V</b> · <b>Supr</b> borrar · <b>Ctrl+G</b> agrupar',
        '<b>Ctrl+Z/Y</b> deshacer · <b>Ctrl+S</b> guardar · <b>Ctrl+rueda</b> zoom · <b>Shift+1</b> ajustar',
      ].join('<br>') })));
  }

  // ---------------------------------------------------------------- modo probar (escenas nativas)
  function sceneForPlay() {
    const sc = JSON.parse(JSON.stringify(S.scene));
    const w = (list) => { for (const n of list) { if (n.id in S.playVis) { n.props = n.props || {}; n.props.Visible = S.playVis[n.id]; } if (n.children) w(n.children); } };
    w(sc.nodes);
    return sc;
  }
  function renderPlay() {
    S.map = RBXRender.renderScene(sceneForPlay(), stageEl(), { editor: true, play: true });
    walk((n) => {
      const el = S.map[n.id];
      if (!el || !(n.buttonFx || n.interactions)) return;
      el.dataset.fx = '1';
      el.style.setProperty('--hover', n.buttonFx ? n.buttonFx.hover : 1);
      el.style.setProperty('--press', n.buttonFx ? n.buttonFx.press : 1);
      el.addEventListener('click', (e) => { e.stopPropagation(); playClick(n); });
    });
  }
  const visOf = (n) => (n.id in S.playVis ? S.playVis[n.id] : R.prop(n, 'Visible') !== false);
  function findByName(name) { let r = null; walk((n) => { if (n.name === name) { r = n; return false; } }); return r; }
  function playClick(n) {
    let pop = null;
    for (const it of n.interactions || []) {
      const t = it.target ? findByName(it.target) : it.action === 'close' ? chainOf(n.id)[0] : null;
      if (!t) { status(`"${it.target}" no está en esta pantalla (en Roblox se busca en todo el PlayerGui)`, true); continue; }
      const act = it.action || 'toggle';
      const show = act === 'open' ? true : act === 'close' ? false : !visOf(t);
      if (show) {
        for (const id of S.openWins) if (id !== t.id) S.playVis[id] = false;
        S.openWins = [t.id];
        if (it.animation !== 'none') pop = t.id;
      } else S.openWins = S.openWins.filter((id) => id !== t.id);
      S.playVis[t.id] = show;
    }
    renderPlay();
    if (pop && S.map[pop]) S.map[pop].classList.add('rbx-pop');
  }
  function setPlay(on) {
    if (on && !isNative()) return;
    S.play = on; S.playVis = {}; S.openWins = [];
    $('#st-play').innerHTML = SVGI(on ? 'stop' : 'play', 16);
    $('#st-play').classList.toggle('on', on); canvas.classList.toggle('play', on);
    const mp = $('#st-mnav [data-m="play"]');
    mp.classList.toggle('on', on);
    mp.innerHTML = SVGI(on ? 'stop' : 'play', 20) + `<span>${on ? 'Editar' : 'Probar'}</span>`;
    if (on) { S.sel = []; S.hover = null; }
    refresh();
    status(on ? 'Probar: clic en los botones · P o Esc para volver a editar' : 'Edición');
  }

  // ---------------------------------------------------------------- JSON rbxui: importar / exportar / prompt para IAs
  async function doRbxui(tab = 'import') {
    const meta = await api('/api/scenes-meta').catch(() => []);
    const natives = meta.filter((m) => m.native).map((m) => m.name);
    const body = h('div'), tabs = h('div', { class: 'st-tools', style: 'margin-bottom:8px' });
    const PANES = {
      import: () => {
        const ta = h('textarea', { class: 'st-json', spellcheck: false, placeholder: 'Pega aquí el JSON {"format":"rbxui",...}\n(vale la respuesta entera de la IA con ```json … ```)' });
        const file = h('input', { type: 'file', accept: '.json,application/json' });
        file.addEventListener('change', async () => { const f = file.files[0]; if (f) ta.value = await f.text(); });
        const warnEl = h('p', { class: 'st-warn' });
        const go = h('button', { class: 'st-primary', onclick: async () => {
          let txt = ta.value.trim();
          const m = txt.match(/```(?:json)?\s*([\s\S]*?)```/); if (m) txt = m[1].trim();
          const a = txt.indexOf('{'), b = txt.lastIndexOf('}');
          if (a >= 0 && b > a) txt = txt.slice(a, b + 1);
          try {
            R.validate(JSON.parse(txt));
            if (S.dirty && !confirm('Hay cambios sin guardar en la escena actual. ¿Descartarlos?')) return;
            const r = await api('/api/rbxui/import?x=1' + projQ(), { method: 'POST', body: txt });
            closeModal(); S.dirty = false;
            await loadSceneList(r.names[0]); await loadScene(r.names[0]);
            status(`Importado: ${r.names.join(', ')}` + (r.warn.length ? ` · ${r.warn.length} avisos` : ''), !!r.warn.length);
            if (r.warn.length) modal(h('h3', {}, 'Importado con avisos'), h('pre', {}, r.warn.join('\n')));
          } catch (e) { warnEl.textContent = 'No se pudo importar: ' + (e.data?.error || e.message); }
        } }, 'Importar');
        return [h('p', { class: 'st-note', style: 'margin:0 0 6px' }, 'Cada ScreenGui pasa a ser una escena nativa editable. Una escena DS con el mismo nombre se guarda antes en screens/ds_backup/.'),
          ta, h('div', { class: 'st-row', style: 'margin-top:6px' }, file, go), warnEl];
      },
      export: () => {
        const checks = natives.map((nm) => h('label', { style: 'margin-right:10px' }, h('input', { type: 'checkbox', checked: nm === S.name || !isNative(), value: nm }), ' ' + nm));
        const ta = h('textarea', { class: 'st-json', readOnly: true, spellcheck: false });
        const gen = async () => {
          if (S.dirty) await save();
          const names = checks.map((c) => c.firstChild).filter((c) => c.checked).map((c) => c.value);
          ta.value = names.length ? JSON.stringify(await api('/api/rbxui?names=' + names.join(',')), null, 1) : '';
        };
        checks.forEach((c) => c.firstChild.addEventListener('change', gen));
        setTimeout(() => gen().catch((e) => { ta.value = e.message; }), 0);
        return [natives.length ? h('div', { class: 'st-row' }, ...checks) : h('p', { class: 'st-warn' }, 'No hay escenas nativas: importa un JSON o crea una escena nativa.'), ta,
          h('div', { class: 'st-row', style: 'margin-top:6px' },
            h('button', { onclick: async () => { await navigator.clipboard.writeText(ta.value); status('JSON copiado'); } }, 'Copiar'),
            h('button', { onclick: () => h('a', { href: URL.createObjectURL(new Blob([ta.value], { type: 'application/json' })), download: (S.name || 'ui') + '.rbxui.json' }).click() }, 'Descargar'))];
      },
      prompt: () => {
        const ta = h('textarea', { class: 'st-json', readOnly: true, value: R.AI_PROMPT });
        const info = h('span', { class: 'st-note', style: 'margin:0' });
        const sel = h('select', { style: 'flex:none;width:220px', onchange: () => load() },
          ...[['marked', 'Con los ejemplos marcados'], ['all', 'Con todos los ejemplos'], ['none', 'Sin ejemplos']].map(([v, l]) => h('option', { value: v }, l)));
        const load = async () => {
          const r = await api('/api/ai-prompt?examples=' + sel.value);
          ta.value = r.text;
          info.textContent = `${r.examples} ejemplos · ~${Math.round(r.text.length / 3.6).toLocaleString('es')} tokens`;
        };
        load().catch(() => {});
        return [h('p', { class: 'st-note', style: 'margin:0 0 6px' }, 'Pégalo en cualquier IA junto a lo que quieres (p. ej. "tienda de huevos con 6 pets"). Su respuesta se mete en la pestaña Importar. Los ejemplos son tus UIs de Figma (ventana Ejemplos IA).'),
          h('div', { class: 'st-row' }, sel, info), ta,
          h('div', { class: 'st-row', style: 'margin-top:6px' },
            h('button', { class: 'st-primary', onclick: () => copyText(ta.value, 'Prompt copiado') }, 'Copiar prompt'),
            h('button', { class: 'st-btn', onclick: () => { closeModal(); openExamples(); }, innerHTML: SVGI('book', 14) + 'Gestionar ejemplos' }))];
      },
    };
    const show = (t) => { body.innerHTML = ''; [...tabs.children].forEach((b) => b.classList.toggle('st-primary', b.dataset.t === t)); body.append(...PANES[t]()); };
    for (const [t, lab] of [['import', 'Importar'], ['export', 'Exportar'], ['prompt', 'Prompt IA']]) tabs.append(h('button', { 'data-t': t, onclick: () => show(t) }, lab));
    const w = modal(h('h3', {}, 'JSON rbxui'), tabs, body);
    w.el.style.width = 'min(900px, 92vw)';
    w.titleEl.after(h('div', { class: 'st-wsub' }, 'Importar la respuesta de una IA · exportar · prompt'));
    $('.st-wicon', w.el).innerHTML = SVGI('code', 16);
    show(tab);
  }

  // ---------------------------------------------------------------- construir en Roblox (Luau con Instances nativas)
  async function doBuildNative() {
    await save();
    const natives = (await api('/api/scenes-meta')).filter((m) => m.native).map((m) => m.name);
    const checks = natives.map((nm) => h('label', { style: 'margin-right:10px' }, h('input', { type: 'checkbox', checked: true, value: nm }), ' ' + nm));
    const docIn = h('input', { type: 'text', value: natives.length > 1 ? 'RbxUI' : S.name });
    const res = h('div');
    const picked = () => checks.map((c) => c.firstChild).filter((c) => c.checked).map((c) => c.value);
    await refreshStudio();
    const st = S.studio.studios[0];
    const upChk = h('input', { type: 'checkbox', checked: true });
    const live = h('button', { class: 'st-primary', disabled: !st, innerHTML: SVGI('send', 14) + (st ? `Instalar en Studio · ${st.place || 'place'}` : 'Studio no conectado'),
      onclick: async () => {
        const names = picked(); if (!names.length) return;
        live.disabled = true;
        try {
          const r = await installInStudio(names, docIn.value.replace(/[^\w-]/g, '') || names[0], upChk.checked);
          res.innerHTML = '';
          res.append(h('pre', {}, String(r.message || '').slice(0, 1500)),
            r.missing.length ? h('p', { class: 'st-warn' }, `${r.missing.length} imágenes sin subir (salen vacías):\n${r.missing.join('\n')}`) : null);
        } catch (e) { res.textContent = e.data?.error || e.message; }
        live.disabled = false;
      } });
    const studioBox = h('div', { class: 'st-target' + (st ? ' ok' : ''), style: 'margin:10px 0' },
      h('header', {}, h('span', { class: 'st-ti2', innerHTML: SVGI('roblox', 14) }), st ? 'Directo a Roblox Studio' : 'Roblox Studio no está conectado'),
      h('small', { class: st ? 'ok' : '' }, st ? `${st.place} · plugin RbxUI Connect ${st.version}` : 'Instala el plugin (botón Studio de la barra) y abre tu place.'),
      h('label', { style: 'display:flex;gap:6px;align-items:center' }, upChk, 'Subir antes las imágenes que falten (desde Studio, sin API key)'),
      st ? live : h('button', { class: 'st-btn', onclick: () => { closeModal(); openStudio(); } }, 'Configurar Studio…'));
    const go = h('button', { class: 'st-btn', onclick: async () => {
      const names = picked();
      if (!names.length) return;
      try {
        const r = await api(`/api/native/build?names=${names.join(',')}&doc=${encodeURIComponent(docIn.value.replace(/[^\w-]/g, '') || names[0])}`, { method: 'POST' });
        res.innerHTML = '';
        res.append(h('pre', {}, `${r.file} (${r.kb} KB)\nScreenGui: ${r.screens.join(', ')}`),
          r.missing.length ? h('p', { class: 'st-warn' }, `${r.missing.length} imágenes locales aún sin subir a Roblox (saldrán vacías):\n${r.missing.join('\n')}`) : null,
          h('p', { class: 'st-note', style: 'margin:0' }, `Para meterlo en Studio dile a Claude: "instala ${r.file}". Crea las Instances en StarterGui (las anteriores van a ServerStorage.RbxUI_Backup) y el LocalScript RbxUINative.`));
        status('Construido ' + r.file);
      } catch (e) { res.textContent = e.data?.error || e.message; }
    } }, 'Solo generar .build.luau');
    const w = modal(h('h3', {}, 'Construir en Roblox (Instances nativas)'),
      h('p', { class: 'st-note', style: 'margin:0 0 6px' }, 'Pantallas a incluir (cada una es un ScreenGui):'), h('div', { class: 'st-row' }, ...checks),
      row('Documento', docIn), studioBox, go, res);
    w.el.style.width = 'min(560px, 92vw)';
    $('.st-wicon', w.el).innerHTML = SVGI('roblox', 16);
  }

  // ---------------------------------------------------------------- portapapeles: Figma, imágenes, SVG, JSON rbxui
  // inserta nodos rbxui (Instances) centrados en el contenedor seleccionado; stage=true => en coordenadas del escenario
  function insertRbxuiNodes(list, opts = {}) {
    const cont = insertContainer(), box = innerBox(cont), arr = cont ? cont.children : S.scene.nodes;
    const ns = list.map((inst) => R.importInto(inst, box.w, box.h));
    if (!ns.length) return [];
    let dx = 0, dy = 0;
    if (!(opts.stage && !cont)) { const u = union(ns); dx = (box.w - u.w) / 2 - u.x; dy = (box.h - u.h) / 2 - u.y; }
    pushUndo();
    const fold = (n, d) => { if (d > 0 && n.children?.length) S.collapsed.add(n.id); (n.children || []).forEach((k) => fold(k, d + 1)); };
    for (const n of ns) { n.x = r2(n.x + dx); n.y = r2(n.y + dy); delete n.geo0; fold(n, 0); }
    arr.push(...ns);
    refresh();
    setSel(ns.map((n) => n.id));
    return ns;
  }
  const needNative = (what) => { if (isNative()) return true; status(`${what}: abre o crea una escena nativa (Nueva → Aceptar)`, true); return false; };

  async function pasteFigma(html) {
    if (!needNative('Pegar de Figma')) return;
    status('Convirtiendo lo copiado en Figma…');
    const t = toast('Convirtiendo lo copiado en Figma…', 'busy', { sticky: true });
    try {
      const r = await api(`/api/figma/paste?w=${S.scene.stage.w}&h=${S.scene.stage.h}&mode=${S.scene.design?.figmaScale || '1080'}&layout=${S.scene.design?.figmaLayout === 'fixed' ? 0 : 1}&bake=${S.scene.design?.figmaBake || 'layers'}`, { method: 'POST', body: html });
      t.close();
      placeFigma(r);
    } catch (e) {
      t.close();
      status('No se pudo leer lo copiado en Figma', true);
      modal(h('h3', {}, 'Error al pegar de Figma'), h('pre', {}, e.data?.error || e.message),
        h('p', { class: 'st-note', style: 'margin:0' }, 'Lo pegado se guardó en rbxui/out/figma/last_paste.html para revisarlo.'));
    }
  }
  function placeFigma(r) {
    insertRbxuiNodes(r.nodes, { stage: r.mode === 'screen' });
    const bits = [`Figma: ${r.count} capas`];
    if (r.rendered) bits.push(`${r.rendered} vectores a PNG`);
    if (r.images) bits.push(`${r.images} imágenes`);
    if (r.mode === 'screen') bits.push(`pantalla escalada ×${r.scale}`);
    if (r.mode === 'fit') bits.push(`encajado al escenario ×${r.scale}`);
    if (r.mode === 'design') bits.push(`diseño 1080p ×${r.scale}`);
    if (r.warn.length) bits.push(`${r.warn.length} avisos (clic)`);
    status(bits.join(' · '), false, r.warn.length ? r.warn : null);
  }
  async function uploadImage(blob, kind, maxSize = 256, name = 'Image') {
    placeImage(await api(kind === 'svg' ? '/api/figma/svg' : '/api/figma/image', { method: 'POST', body: blob }), maxSize, name);
  }
  // imagen ya guardada en el servidor: reemplaza la ImageLabel seleccionada o inserta una nueva
  function placeImage(r, maxSize = 256, name = 'Image') {
    const n = S.sel.length === 1 ? node(S.sel[0]) : null;
    if (n && R.IMAGE.has(n.rbxClass)) { pushUndo(); n.props.Image = r.path; update(); renderProps(); status('Imagen reemplazada'); return; }
    const k = Math.min(1, maxSize / Math.max(r.w, r.h, 1));
    insertRbxuiNodes([{ ClassName: 'ImageLabel', Name: name, props: { BackgroundTransparency: 1, ScaleType: 'Fit', Image: r.path, Size: [0, Math.round(r.w * k), 0, Math.round(r.h * k)] } }]);
    status(`Imagen pegada (${r.w}×${r.h})`);
  }
  async function pasteJson(j) {
    if (j.rbxuiClip) {
      if (!!j.native !== isNative()) { status('Esas capas son de otro tipo de escena (nativa / DS)', true); return; }
      S.clip = j.nodes; paste(); return;
    }
    if (!needNative('Pegar JSON rbxui')) return;
    if (Array.isArray(j.screens)) {
      const kids = j.screens.flatMap((sg) => sg.children || []).filter((c) => R.GUI.has(c.ClassName));
      insertRbxuiNodes(kids, { stage: true });
    } else insertRbxuiNodes((Array.isArray(j) ? j : [j]).filter((c) => R.GUI.has(c.ClassName)));
    status('JSON rbxui pegado');
  }
  // onResult(r, nombreFrame): por defecto se coloca en la escena; la ventana Ejemplos IA lo guarda como ejemplo
  async function openFigFile(file, onResult) {
    if (!onResult && !needNative('Importar .fig')) return;
    const W = S.scene?.stage.w || 1280, H = S.scene?.stage.h || 720;
    status('Leyendo ' + file.name + '…');
    try {
      const r = await api('/api/figma/fig', { method: 'POST', body: file });
      if (!r.frames.length) { status('El .fig no tiene frames visibles', true); return; }
      status(`${file.name}: ${r.frames.length} frames · ${r.images} imágenes`);
      modal(h('h3', {}, 'Importar desde ' + file.name), h('p', { class: 'st-note', style: 'margin:0 0 8px' }, 'Elige el frame. Las imágenes del .fig se importan también. Un frame con proporción de pantalla (16:9) se escala al escenario.'),
        h('div', { class: 'st-list' }, ...r.frames.map((f) => h('button', { onclick: async () => {
          closeModal(); status('Convirtiendo ' + f.name + '…');
          try {
            const res = await api(`/api/figma/fig-import?id=${encodeURIComponent(f.id)}&w=${W}&h=${H}&mode=${S.scene?.design?.figmaScale || '1080'}&layout=${S.scene?.design?.figmaLayout === 'fixed' ? 0 : 1}&bake=${S.scene?.design?.figmaBake || 'layers'}`, { method: 'POST' });
            if (onResult) await onResult(res, f.name); else placeFigma(res);
          }
          catch (e) { status('Error al importar el frame', true); modal(h('h3', {}, 'Error'), h('pre', {}, e.data?.error || e.message)); }
        } }, `${f.page} / ${f.name}`, h('small', {}, ` ${Math.round(f.w)}×${Math.round(f.h)}`)))));
    } catch (e) { status('No se pudo leer el .fig', true); modal(h('h3', {}, 'Error'), h('pre', {}, e.data?.error || e.message)); }
  }

  window.addEventListener('copy', (e) => {
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    if (!S.scene || S.play || !S.sel.length) return;
    copy();
    if (!S.clip) return;
    e.preventDefault();
    e.clipboardData.setData('text/plain', JSON.stringify({ rbxuiClip: 1, native: isNative(), nodes: S.clip }));
  });
  window.addEventListener('paste', async (e) => {
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    const cd = e.clipboardData;
    const html = cd.getData('text/html'), text = cd.getData('text/plain');
    // con la ventana Ejemplos IA delante, lo pegado se guarda como ejemplo para la IA
    if (S.winFocus === 'examples') { e.preventDefault(); return examplePaste(html, text); }
    if (S.winFocus) return;
    if (!S.scene || S.play) return;
    const file = [...cd.files].find((f) => /^image\//.test(f.type));
    e.preventDefault();
    try {
      if (html && html.includes('(figma)')) return await pasteFigma(html);
      const t = (text || '').trim();
      let j = null;
      if (/^[[{]/.test(t)) { try { j = JSON.parse(t); } catch { j = null; } }
      if (j) return await pasteJson(j);
      if (file) { if (needNative('Pegar imagen')) await uploadImage(file, 'img'); return; }
      if (/^<svg[\s>]/i.test(t)) { if (needNative('Pegar SVG')) await uploadImage(t, 'svg'); return; }
      if (S.clip) paste();
    } catch (err) { status('Error al pegar: ' + (err.data?.error || err.message), true); }
  });
  canvas.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  canvas.addEventListener('drop', async (e) => {
    e.preventDefault();
    // carpetas soltadas = carpetas de logos
    const dropped = dropEntries(e.dataTransfer);
    if (dropped.some((x) => x.isDirectory)) { await uploadDropped(dropped); return; }
    if (!S.scene) return;
    for (const f of e.dataTransfer.files) {
      try {
        if (/\.fig$/i.test(f.name)) await openFigFile(f);
        else if (/^image\/svg/.test(f.type) || /\.svg$/i.test(f.name)) { if (needNative('Soltar SVG')) await uploadImage(await f.text(), 'svg'); }
        else if (/^image\//.test(f.type)) { if (needNative('Soltar imagen')) await uploadImage(f, 'img'); }
        else if (/\.json$/i.test(f.name)) await pasteJson(JSON.parse(await f.text()));
      } catch (err) { status('Error con ' + f.name + ': ' + (err.data?.error || err.message), true); }
    }
  });
  $('#st-status').addEventListener('click', () => {
    if (S.statusDetails) modal(h('h3', {}, 'Avisos'), h('pre', { style: 'max-height:50vh' }, S.statusDetails.join('\n')));
  });

  // ---------------------------------------------------------------- pestañas / modal
  function switchTab(t) { $$('.st-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t)); $$('.st-pane').forEach((p) => p.classList.toggle('on', p.id === 'st-' + t)); }
  $$('.st-tabs button').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  // ---------------------------------------------------------------- ventanas (modales con fondo / flotantes sin fondo), arrastrables
  const WIN = { list: [], z: 10 };
  const topWin = () => WIN.list.reduce((a, w) => (!a || +w.el.style.zIndex > +a.el.style.zIndex ? w : a), null);
  const winById = (id) => WIN.list.find((w) => w.id === id) || null;
  function focusWin(w) {
    if (w.back) w.back.style.zIndex = ++WIN.z;
    w.el.style.zIndex = ++WIN.z;
    WIN.list.forEach((x) => x.el.classList.toggle('front', x === w));
    S.winFocus = w.id || 'win';
  }
  // o: { id, title, sub, icon, err, body, foot, width, modal=true, pos:'center'|'right', actions, onClose }
  function openWin(o) {
    const ex = o.id && winById(o.id);
    if (ex) { focusWin(ex); return ex; }
    const w = { id: o.id, modal: o.modal !== false, onClose: o.onClose };
    w.body = h('div', { class: 'st-wbody' });
    w.foot = h('div', { class: 'st-wfoot' });
    w.titleEl = h('div', { class: 'st-wtitle' }, o.title || 'RbxUI Studio');
    w.subEl = h('div', { class: 'st-wsub' }, o.sub || '');
    const head = h('div', { class: 'st-whead' },
      h('span', { class: 'st-wicon' + (o.err ? ' err' : ''), innerHTML: SVGI(o.icon || 'sparkle', 16) }),
      h('div', { class: 'st-wtt' }, w.titleEl, o.sub ? w.subEl : null),
      h('span', { class: 'st-wact' }, ...(o.actions || []),
        h('button', { class: 'st-wclose', title: 'Cerrar (Esc)', innerHTML: SVGI('x', 16), onclick: () => closeWin(w) })));
    w.el = h('div', { class: 'st-win ' + (w.modal ? 'modal' : 'float'), style: `width:${o.width || 460}px` }, head, w.body, w.foot);
    w.set = (body, foot) => {
      if (body !== undefined) { w.body.innerHTML = ''; w.body.append(...[body].flat().filter(Boolean)); }
      if (foot !== undefined) { w.foot.innerHTML = ''; w.foot.append(...[foot].flat().filter(Boolean)); }
    };
    w.set(o.body || [], o.foot || []);
    if (w.modal) w.back = h('div', { class: 'st-back', onmousedown: (e) => { if (e.target === w.back) closeWin(w); } });
    const layer = $('#st-wins');
    if (w.back) layer.append(w.back);
    layer.append(w.el);
    if (!w.modal) {                                   // flotante: junto al panel derecho, escalonada si ya hay otras
      const n = WIN.list.filter((x) => !x.modal).length, wd = Math.min(o.width || 460, innerWidth - 24);
      w.el.style.left = Math.max(12, innerWidth - wd - (innerWidth > 1000 ? 280 : 12) - n * 28) + 'px';
      w.el.style.top = (60 + n * 28) + 'px';
    }
    // arrastrar por la cabecera
    head.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return;
      const r = w.el.getBoundingClientRect();
      w.el.classList.add('moved'); w.el.style.left = r.left + 'px'; w.el.style.top = r.top + 'px';
      const dx = e.clientX - r.left, dy = e.clientY - r.top;
      const mv = (ev) => {
        w.el.style.left = clamp(ev.clientX - dx, 40 - r.width, innerWidth - 60) + 'px';
        w.el.style.top = clamp(ev.clientY - dy, 0, innerHeight - 40) + 'px';
      };
      const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
      window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
      e.preventDefault();
    });
    w.el.addEventListener('mousedown', () => focusWin(w), true);
    WIN.list.push(w); focusWin(w);
    return w;
  }
  function closeWin(w) {
    if (!w || w.closed) return;
    w.closed = true;
    WIN.list = WIN.list.filter((x) => x !== w);
    w.el.classList.add('closing'); if (w.back) w.back.classList.add('closing');
    setTimeout(() => { w.el.remove(); if (w.back) w.back.remove(); }, 180);
    if (w.onClose) w.onClose();
    const t = topWin(); if (t) focusWin(t); else S.winFocus = null;
  }
  // compatibilidad: modal(h('h3', …, título), …contenido) = ventana modal con botón Cerrar (solo una a la vez)
  function modal(...content) {
    let title = 'RbxUI Studio';
    if (content[0] && content[0].tagName === 'H3') title = content.shift().textContent;
    WIN.list.filter((w) => w.modal).forEach(closeWin);
    const err = /error|no se pudo/i.test(title);
    if (err) content.unshift(h('img', { class: 'st-errimg', src: MASCOT.error, alt: '' }));
    return openWin({ title, icon: err ? 'alert' : /aviso/i.test(title) ? 'info' : 'sparkle', err, body: content,
      foot: [h('button', { class: 'st-btn', onclick: closeModal }, 'Cerrar')] });
  }
  const closeModal = () => { const w = [...WIN.list].reverse().find((x) => x.modal); if (w) closeWin(w); };
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('.st-win')) { S.winFocus = null; WIN.list.forEach((x) => x.el.classList.remove('front')); } }, true);

  // ---------------------------------------------------------------- avisos flotantes
  function toast(msg, kind = 'ok', opt = {}) {
    const msgEl = h('span', {}, msg);
    const mas = opt.mascot || (kind === 'busy' ? 'work' : null);
    const el = h('div', { class: 'st-toast ' + kind + (mas ? ' has-m' : '') }, mas ? h('img', { class: 'st-tm', src: MASCOT[mas], alt: '' }) : h('span', { class: 'st-tdot' }), msgEl,
      opt.action ? h('button', { onclick: () => { close(); opt.action.fn(); } }, opt.action.label) : null);
    let gone = false;
    const close = () => { if (gone) return; gone = true; el.classList.add('out'); setTimeout(() => el.remove(), 220); };
    $('#st-toasts').append(el);
    while ($('#st-toasts').children.length > 4) $('#st-toasts').firstElementChild.remove();
    if (!opt.sticky) setTimeout(close, opt.ms || (kind === 'err' ? 5200 : 3200));
    return { close, set: (m) => { msgEl.textContent = m; } };
  }
  const copyText = async (txt, what = 'Copiado') => { await navigator.clipboard.writeText(txt); toast(what); };
  // mascota: 'error' (enchufe desconectado) para errores y sin conexión; 'empty' (cajón vacío) para listas vacías
  // error = enchufe suelto · empty = cajón vacío · ok = enchufe conectado · work = llave inglesa · search = lupa · lock = candado
  const MASCOT = { error: 'brand/mascot_error.png', empty: 'brand/mascot_empty.png', ok: 'brand/mascot_ok.png', work: 'brand/mascot_work.png',
    search: 'brand/mascot_search.png', lock: 'brand/mascot_lock.png' };
  // en memoria desde el arranque: la de «sin conexión» tiene que verse aunque el servidor ya no responda
  for (const k of Object.keys(MASCOT)) fetch(MASCOT[k]).then((r) => r.blob()).then((b) => { MASCOT[k] = URL.createObjectURL(b); }).catch(() => {});
  const stateBox = (kind, title, text, buttons = [], size = '') => h('div', { class: 'st-state' + (size ? ' ' + size : '') },
    h('img', { src: MASCOT[kind], alt: '' }), h('b', {}, title), text ? h('p', {}, text) : null, buttons.length ? h('div', { class: 'st-row' }, ...buttons) : null);
  // lienzo sin escena (no hay proyectos) o con la escena vacía
  function showEmpty(mode, msg) {
    const box = $('#st-empty');
    box.hidden = !mode; box.innerHTML = ''; box.style.pointerEvents = mode === 'scene' ? 'none' : ''; box.classList.toggle('soft', mode === 'scene');
    if (!mode) return;
    const b = (label, icon, fn, cls = 'st-btn') => h('button', { class: cls, style: 'pointer-events:auto', innerHTML: SVGI(icon, 14) + label, onclick: fn });
    if (mode === 'none') box.append(stateBox('empty', S.project ? `«${S.project.name}» no tiene pantallas` : 'Aún no hay escenas', 'Crea una pantalla nueva, pega un diseño de Figma (Ctrl+V) o importa el JSON rbxui que te dé una IA.',
      [b('Nueva pantalla', 'plus', newScene, 'st-primary'), b('Importar JSON rbxui', 'code', () => doRbxui('import')), b('Traer de Roblox Studio', 'roblox', openStudio),
        b('Ir a proyectos', 'layers', () => { location.href = 'home.html'; })]));
    else if (mode === 'scene') box.append(stateBox('empty', 'Escena vacía', 'Pega de Figma con Ctrl+V, dibuja con F / T / I / B o usa la pestaña Insertar.', [], 'sm'));
    else box.append(stateBox('error', 'No se pudo abrir el editor', msg || '', [b('Reintentar', 'refresh', () => location.reload(), 'st-primary')]));
  }
  const hhmm = (t, sec) => new Date(t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', ...(sec ? { second: '2-digit' } : {}) });

  // ---------------------------------------------------------------- Ejemplos IA: UIs del usuario (pegadas de Figma) como referencia de estilo
  // Se guardan en rbxui/examples/<id>.json como documento rbxui; /api/ai-prompt los añade al prompt y el MCP los sirve (rbxui_design_guide).
  S.examples = [];
  const exName = (s) => String(s || 'Ejemplo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'Ejemplo';
  const SRC_LABEL = { figma: 'Figma', selection: 'Selección', scene: 'Escena', json: 'JSON', mcp: 'IA' };
  const countLayers = (doc) => { let c = 0; const w = (n) => { if (R.GUI.has(n.ClassName)) c++; (n.children || []).forEach(w); }; (doc.screens || []).forEach((s) => (s.children || []).forEach(w)); return c; };
  // Instances rbxui sueltas -> documento de una pantalla 1280×720 (centradas, salvo si ya vienen colocadas en pantalla)
  function docFromInst(list, stageMode, name) {
    const W = 1280, H = 720;
    const ns = list.filter((c) => c && R.GUI.has(c.ClassName)).map((inst) => R.importInto(inst, W, H));
    if (!ns.length) throw new Error('no hay Instances de interfaz (Frame, TextLabel, ImageLabel…)');
    if (!stageMode) { const u = union(ns), dx = (W - u.w) / 2 - u.x, dy = (H - u.h) / 2 - u.y; for (const n of ns) { n.x = r2(n.x + dx); n.y = r2(n.y + dy); } }
    for (const n of ns) delete n.geo0;
    const sc = { name: exName(name), native: true, stage: { w: W, h: H }, design: { ...R.DESIGN_DEF }, gui: { props: {} }, nodes: ns };
    return R.scenesToDoc([sc], sc.name);
  }
  // capas seleccionadas en el editor -> documento rbxui (posición absoluta en el escenario)
  function selectionDoc(name) {
    if (!S.scene || !isNative()) throw new Error('abre una escena nativa');
    const ids = topLevel(S.sel);
    if (!ids.length) throw new Error('no hay nada seleccionado en el editor');
    const nodes = ids.map((id) => {
      const c = clone(node(id)), b = boxOf(id);
      if (b && parentOf(id)) { c.x = r2(b.x); c.y = r2(b.y); }
      delete c.geo0; delete c.layout;
      return c;
    });
    const sc = { name: exName(name || node(ids[0]).name), native: true, stage: { ...S.scene.stage }, design: { ...R.DESIGN_DEF, ...(S.scene.design || {}) }, gui: { props: {} }, nodes };
    return R.scenesToDoc([sc], sc.name);
  }
  // miniatura viva: el documento se pinta con el mismo renderizador y se encaja en la caja
  function exThumb(doc, box) {
    try {
      const sc = R.docToScenes(doc).scenes[0];
      sc.design = { ...(sc.design || {}), background: 'transparent' };
      const rl = (n) => { if (n.rbxClass) R.relayout(n); (n.children || []).forEach(rl); };
      sc.nodes.forEach(rl);
      const st = h('div', { class: 'stage' });
      box.append(st);
      RBXRender.renderScene(sc, st, { export: true });
      const vis = sc.nodes.filter((n) => R.prop(n, 'Visible') !== false);
      const u = union((vis.length ? vis : sc.nodes).map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.h })));
      const bw = box.clientWidth || 200, bh = box.clientHeight || 118;
      const k = Math.min(bw / Math.max(u.w, 1), bh / Math.max(u.h, 1)) * 0.9;
      st.style.transform = `translate(${(bw - u.w * k) / 2 - u.x * k}px,${(bh - u.h * k) / 2 - u.y * k}px) scale(${k})`;
    } catch (e) { box.append(h('p', { class: 'st-note', style: 'padding:8px' }, 'Sin vista previa: ' + e.message)); }
  }
  const updateExCount = () => { $('#st-excount').textContent = S.examples.length || ''; };
  const exTokens = (list) => Math.round(list.reduce((a, e) => a + (e.chars ?? JSON.stringify(e.rbxui || {}).length) + 60, 0) / 3.6);
  async function saveExample(ex, quiet) {
    S.exSelf = Date.now();
    const r = await api('/api/examples', { method: 'POST', body: JSON.stringify(ex) });
    if (!quiet) toast(`Ejemplo «${r.name}» guardado · ${countLayers(ex.rbxui || { screens: [] })} capas`);
    await renderExamples();
    return r;
  }
  async function addExample(getDoc, source, name) {
    try { const doc = getDoc(); await saveExample({ name: name || doc.name, source, rbxui: doc }); }
    catch (e) { toast('No se pudo crear el ejemplo: ' + (e.data?.error || e.message), 'err'); }
  }
  async function saveFigExample(r, frameName) {
    const nm = frameName || (r.nodes.length === 1 ? r.nodes[0].Name : '') || 'Figma';
    await saveExample({ name: nm, source: 'figma', rbxui: docFromInst(r.nodes, r.mode === 'screen', nm), warn: r.warn.length });
  }
  async function saveJsonExample(j) {
    let doc;
    if (j.rbxuiClip) {
      if (!j.native) throw new Error('esas capas son de una escena DS, no nativa');
      const sc = { name: 'Copiado', native: true, stage: { w: 1280, h: 720 }, design: { ...R.DESIGN_DEF }, gui: { props: {} },
        nodes: j.nodes.map((n) => { const c = clone(n); delete c.geo0; delete c.layout; return c; }) };
      doc = R.scenesToDoc([sc], sc.name);
    } else if (Array.isArray(j.screens) || j.ClassName === 'ScreenGui') doc = R.validate(j).doc;
    else doc = docFromInst(Array.isArray(j) ? j : [j], false, j.Name || 'JSON');
    await saveExample({ name: doc.name || 'JSON', source: 'json', rbxui: doc });
  }
  async function examplePaste(html, text) {
    try {
      if (html && html.includes('(figma)')) {
        const t = toast('Convirtiendo lo copiado en Figma…', 'busy', { sticky: true });
        try { await saveFigExample(await api(`/api/figma/paste?w=1280&h=720&mode=${S.scene?.design?.figmaScale || '1080'}&layout=${S.scene?.design?.figmaLayout === 'fixed' ? 0 : 1}&bake=${S.scene?.design?.figmaBake || 'layers'}`, { method: 'POST', body: html })); }
        finally { t.close(); }
        return;
      }
      const s = (text || '').trim();
      if (/^[[{]/.test(s)) return await saveJsonExample(JSON.parse(s));
      toast('Eso no es una selección de Figma ni JSON rbxui', 'warn');
    } catch (e) { toast('No se pudo crear el ejemplo: ' + (e.data?.error || e.message), 'err'); }
  }
  function exampleJsonDialog() {
    const ta = h('textarea', { class: 'st-json', spellcheck: false, placeholder: 'Documento rbxui, un ScreenGui o una lista de Instances {ClassName, Name, props, children}' });
    const w = modal(h('h3', {}, 'Ejemplo desde JSON'), ta);
    w.set(undefined, [h('button', { class: 'st-btn', onclick: closeModal }, 'Cancelar'),
      h('button', { class: 'st-primary', onclick: async () => {
        try { let t = ta.value.trim(); const m = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (m) t = m[1]; await saveJsonExample(JSON.parse(t)); closeModal(); }
        catch (e) { toast('JSON no válido: ' + e.message, 'err'); }
      } }, 'Guardar ejemplo')]);
    w.el.style.width = 'min(720px, 92vw)';
    $('.st-wicon', w.el).innerHTML = SVGI('code', 16);
  }
  async function patchExample(e, patch) {
    Object.assign(e, patch);
    S.exSelf = Date.now();
    await api('/api/examples', { method: 'POST', body: JSON.stringify({ id: e.id, ...patch }) }).catch((err) => toast(err.message, 'err'));
    const w = winById('examples'); if (w) w.set(undefined, exFoot());
  }
  async function deleteExample(e, card) {
    if (!confirm(`¿Borrar el ejemplo «${e.name}»?`)) return;
    S.exSelf = Date.now();
    await api('/api/examples?id=' + encodeURIComponent(e.id), { method: 'DELETE' });
    card.style.transition = 'opacity .18s, transform .18s'; card.style.opacity = '0'; card.style.transform = 'scale(.94)';
    setTimeout(renderExamples, 180);
  }
  function insertExample(e) {
    if (!S.scene || !needNative('Insertar ejemplo')) return;
    const kids = (e.rbxui.screens || []).flatMap((s) => s.children || []).filter((c) => R.GUI.has(c.ClassName));
    insertRbxuiNodes(kids, { stage: true });
    toast(`«${e.name}» insertado en ${S.name}`);
  }
  function showExampleJson(e) {
    const txt = JSON.stringify(e.rbxui, null, 1);
    const w = modal(h('h3', {}, e.name), h('textarea', { class: 'st-json', readOnly: true, value: txt, style: 'min-height:50vh' }));
    w.el.style.width = 'min(820px, 92vw)';
    w.set(undefined, [h('span', { class: 'st-grow' }, `${countLayers(e.rbxui)} capas · ${(txt.length / 1024).toFixed(1)} KB`),
      h('button', { class: 'st-btn', onclick: () => copyText(txt, 'JSON copiado') }, 'Copiar'), h('button', { class: 'st-btn', onclick: closeModal }, 'Cerrar')]);
    $('.st-wicon', w.el).innerHTML = SVGI('code', 16);
  }
  function exFoot() {
    const on = S.examples.filter((e) => e.include !== false);
    return [h('span', { class: 'st-grow' }, `${on.length}/${S.examples.length} en el prompt · ~${exTokens(on).toLocaleString('es')} tokens`),
      h('button', { class: 'st-btn', onclick: () => doRbxui('prompt') }, 'Ver prompt'),
      h('button', { class: 'st-primary', onclick: async () => copyText((await api('/api/ai-prompt?examples=marked')).text, 'Prompt con ejemplos copiado') }, 'Copiar prompt')];
  }
  function exCard(e, i) {
    const thumb = h('div', { class: 'st-exthumb' }, h('span', { class: 'st-chip st-exsrc' }, SRC_LABEL[e.source] || 'Ejemplo'));
    const name = h('input', { class: 'st-exname', value: e.name, title: 'Nombre', onchange: () => patchExample(e, { name: name.value }) });
    const desc = h('textarea', { placeholder: 'Qué es y qué debe imitar la IA (p. ej. "tienda con pestañas, botón lima, cabecera rosa")', value: e.desc || '',
      onchange: () => patchExample(e, { desc: desc.value }) });
    const card = h('div', { class: 'st-excard' + (e.include === false ? ' off' : ''), style: `animation-delay:${Math.min(i, 12) * 35}ms` });
    const sw = h('label', { class: 'st-switch', title: 'Usar en el prompt' },
      h('input', { type: 'checkbox', checked: e.include !== false, onchange: (ev) => { card.classList.toggle('off', !ev.target.checked); patchExample(e, { include: ev.target.checked }); } }), h('i'));
    const nt = e.notes;
    const notes = nt ? h('div', { class: 'st-exnotes', title: 'Lo que la IA aprende de este ejemplo' },
      h('span', { class: 'st-swatches' }, ...nt.palette.slice(0, 6).map((c) => h('i', { style: `background:${c}`, title: c }))),
      h('span', {}, [nt.fonts[0] ? nt.fonts[0].replace(/ (Regular|Medium|SemiBold|Bold|ExtraBold|Heavy|Black)$/, '') : '', nt.strokes !== '—' ? `borde ${nt.strokes}` : '', nt.gradients ? `${nt.gradients} degr.` : ''].filter(Boolean).join(' · '))) : null;
    card.append(thumb, h('div', { class: 'st-exbody' }, name, notes, desc,
      h('div', { class: 'st-exfoot' }, h('span', { class: 'st-chip', title: 'Capas · tamaño del JSON' }, `${countLayers(e.rbxui)} capas · ${(JSON.stringify(e.rbxui).length / 1024).toFixed(0)} KB`), sw,
        h('button', { title: 'Insertar en la escena', innerHTML: SVGI('import', 15), onclick: () => insertExample(e) }),
        h('button', { title: 'Ver JSON', innerHTML: SVGI('code', 15), onclick: () => showExampleJson(e) }),
        h('button', { class: 'del', title: 'Borrar', innerHTML: SVGI('trash', 15), onclick: () => deleteExample(e, card) }))));
    card._thumb = () => exThumb(e.rbxui, thumb);
    return card;
  }
  async function renderExamples() {
    S.examples = await api('/api/examples?full=1').catch(() => S.examples);
    updateExCount();
    const w = winById('examples'); if (!w) return;
    const zone = h('div', { class: 'st-paste armed', tabindex: 0,
      innerHTML: `${SVGI('figma', 26)}<b>Pega aquí lo copiado en Figma</b><span>En Figma selecciona → <kbd>Ctrl</kbd>+<kbd>C</kbd> · aquí <kbd>Ctrl</kbd>+<kbd>V</kbd> · o suelta un .fig / .json</span>` });
    zone.append(h('div', { class: 'st-pbtns' },
      h('button', { onclick: () => addExample(() => selectionDoc(), 'selection'), innerHTML: SVGI('pointer', 14) + 'De la selección' }),
      h('button', { onclick: () => addExample(() => { if (!isNative()) throw new Error('la escena abierta no es nativa'); return R.scenesToDoc([S.scene], S.name); }, 'scene', S.name), innerHTML: SVGI('frame', 14) + 'Escena actual' }),
      h('button', { onclick: exampleJsonDialog, innerHTML: SVGI('code', 14) + 'Desde JSON' })));
    zone.addEventListener('click', (ev) => { if (!ev.target.closest('button')) zone.focus(); });
    zone.addEventListener('dragover', (ev) => { ev.preventDefault(); zone.classList.add('over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('over'));
    zone.addEventListener('drop', async (ev) => {
      ev.preventDefault(); zone.classList.remove('over');
      for (const f of ev.dataTransfer.files) {
        try {
          if (/\.fig$/i.test(f.name)) await openFigFile(f, saveFigExample);
          else if (/\.json$/i.test(f.name)) await saveJsonExample(JSON.parse(await f.text()));
          else toast(f.name + ': suelta un .fig o un .json (para imágenes usa Logos)', 'warn');
        } catch (e) { toast(f.name + ': ' + (e.data?.error || e.message), 'err'); }
      }
    });
    const grid = h('div', { class: 'st-exgrid' }, ...S.examples.map(exCard));
    const empty = stateBox('empty', 'Aún no hay apuntes', 'Pega tus mejores UIs de Figma. La IA (también por MCP) las estudia como apuntes: cómo están hechas sus capas, degradados, bordes, fuentes y proporciones, y diseña igual.', [], 'sm');
    const scroll = w.body.scrollTop;
    w.set([zone, S.examples.length ? grid : empty], exFoot());
    w.body.scrollTop = scroll;
    requestAnimationFrame(() => [...grid.children].forEach((c) => c._thumb && c._thumb()));
  }
  function openExamples() {
    const was = winById('examples');
    const w = openWin({ id: 'examples', modal: false, width: 540, icon: 'book', title: 'Ejemplos para la IA',
      sub: 'Apuntes: la IA estudia cómo están hechas tus UIs · Ctrl+V aquí', onClose: () => $('#st-examples').classList.remove('on') });
    $('#st-examples').classList.add('on');
    if (!was) { w.set(h('div', { class: 'st-empty' }, 'Cargando…')); renderExamples(); }
    return w;
  }

  // ---------------------------------------------------------------- MCP: conectar Claude / Cursor / otros al editor
  S.mcp = { clients: [], log: [], configured: {} };
  function mcpDot() {
    const n = S.mcp.clients.length;
    $('#st-mcpdot').classList.toggle('on', n > 0);
    $('#st-mcp').title = n ? `MCP: ${S.mcp.clients.map((c) => c.client).join(', ')} conectado${n > 1 ? 's' : ''}` : 'MCP: conecta Claude u otra IA al editor';
  }
  async function refreshMcp() {
    const st = await api('/api/mcp/status').catch(() => null);
    if (!st) return;
    S.mcp = st; mcpDot();
    if (winById('mcp')) renderMcp();
  }
  const h5 = (ic, label, ...extra) => { const el = h('div', { class: 'st-h5', innerHTML: SVGI(ic, 13) }); el.append(label, ...extra.filter(Boolean)); return el; };
  const codeBox = (txt) => h('div', { class: 'st-code' }, h('pre', {}, txt), h('button', { title: 'Copiar', innerHTML: SVGI('copy', 14), onclick: () => copyText(txt) }));
  function renderMcp() {
    const w = winById('mcp'); if (!w) return;
    const m = S.mcp, n = m.clients.length;
    const hero = h('div', { class: 'st-hero' }, n ? h('img', { class: 'st-hm', src: MASCOT.ok, alt: '' }) : h('img', { src: 'brand/logo-128.png', alt: '' }),
      h('div', {}, h('b', {}, 'Servidor MCP de RbxUI Studio'), h('span', {}, 'La IA lee y escribe escenas, ve capturas, usa tus ejemplos y logos, e inserta capas aquí en vivo.')),
      h('span', { class: 'st-live' + (n ? ' on' : '') }, h('i', { class: 'st-dot' + (n ? ' on' : '') }), n ? `${n} conectado${n > 1 ? 's' : ''}` : 'Sin clientes'));
    const T = [['claude-code', 'Claude Code', 'terminal', 'CLI · todos los proyectos'], ['claude-desktop', 'Claude Desktop', 'sparkle', 'claude_desktop_config.json'], ['cursor', 'Cursor', 'code', '~/.cursor/mcp.json']];
    const targets = h('div', { class: 'st-targets' }, ...T.map(([k, name, ic, where]) => {
      const on = !!m.configured[k];
      const b = h('button', { class: on ? '' : 'st-primary', onclick: async () => {
        b.disabled = true; b.textContent = on ? 'Quitando…' : 'Conectando…';
        try { const r = await api(`/api/mcp/connect?target=${k}${on ? '&off=1' : ''}`, { method: 'POST' }); toast(on ? `${name}: MCP quitado` : `${name} conectado · abre una sesión nueva para usarlo`, on ? 'info' : 'mcp'); void r; }
        catch (e) { toast(`${name}: ${e.data?.out || e.data?.error || e.message}`, 'err'); }
        await refreshMcp();
      } }, on ? 'Quitar' : 'Conectar');
      return h('div', { class: 'st-target' + (on ? ' ok' : '') }, h('header', {}, h('span', { class: 'st-ti2', innerHTML: SVGI(ic, 14) }), name),
        h('small', { class: on ? 'ok' : '' }, on ? '✓ Configurado' : where), b);
    }));
    const clients = n ? h('div', { class: 'st-clients' }, ...m.clients.map((c) => h('div', { class: 'st-client' }, h('i', { class: 'st-dot on' }),
      h('b', {}, c.client), c.version ? h('span', { class: 'st-chip' }, c.version) : null, h('small', {}, `${c.calls || 0} llamadas · desde ${hhmm(c.since)}`))))
      : stateBox('error', 'Nadie conectado ahora', 'Tras «Conectar», abre una sesión nueva de Claude y pídele, por ejemplo: «diseña en RbxUI una tienda de pets con el estilo de mis ejemplos».', [], 'xs');
    const tools = h('div', { class: 'st-tools-list' }, ...(S.mcpTools || []).map((t) => h('span', { title: t.description }, t.name)));
    const testBtn = h('button', { class: 'st-btn', style: 'height:24px', innerHTML: SVGI('pulse', 13) + 'Probar', onclick: async () => {
      testBtn.disabled = true;
      const r = await api('/api/mcp/test', { method: 'POST' }).catch((e) => ({ ok: false, error: e.message }));
      if (r.ok) { S.mcpTools = r.tools; toast(`Servidor MCP OK · ${r.tools.length} herramientas · ${r.ms} ms`); } else toast('MCP: ' + r.error, 'err');
      renderMcp();
    } });
    const log = m.log.length ? h('div', { class: 'st-log' }, ...m.log.map((c) => h('div', { class: 'st-logrow' + (c.ok ? '' : ' err') }, h('i', { class: 'st-dot' }),
      h('b', {}, c.tool.replace(/^rbxui_/, '')), h('code', { title: c.args }, c.args && c.args !== '{}' ? c.args : ''), h('small', {}, `${c.client} · ${c.ms} ms · ${hhmm(c.at, 1)}`))))
      : h('p', { class: 'st-note', style: 'margin:0' }, 'Aquí verás en vivo cada herramienta que use la IA.');
    const cmd = `claude mcp add -s user rbxui -- "${m.node}" "${m.mcpPath}"`;
    const cfg = JSON.stringify({ mcpServers: { rbxui: { command: m.node, args: [m.mcpPath] } } }, null, 2);
    const scroll = w.body.scrollTop;
    w.set([hero,
      h5('plug', 'Conectar'), targets,
      h5('pulse', 'Clientes conectados'), clients,
      h5('sparkle', `Herramientas${S.mcpTools ? ` (${S.mcpTools.length})` : ''}`, h('span', { class: 'st-hact' }, testBtn)),
      S.mcpTools ? tools : h('p', { class: 'st-note', style: 'margin:0' }, 'Pulsa «Probar» para arrancar mcp.mjs y listar sus herramientas.'),
      h5('terminal', 'Actividad'), log,
      h5('code', 'Configuración manual (otros clientes)'), codeBox(cmd), h('div', { style: 'height:6px' }), codeBox(cfg)], []);
    w.body.scrollTop = scroll;
  }
  function openMcp() {
    const was = winById('mcp');
    const w = openWin({ id: 'mcp', modal: false, width: 580, icon: 'plug', title: 'MCP · conectar IAs',
      sub: `Claude, Cursor u otro cliente MCP trabajan en este editor`, onClose: () => $('#st-mcp').classList.remove('on') });
    $('#st-mcp').classList.add('on');
    if (!was) { renderMcp(); refreshMcp(); }
    return w;
  }

  // ---------------------------------------------------------------- Roblox Studio: plugin RbxUI Connect (instalar, subir imágenes, traer ScreenGuis)
  S.studio = { studios: [], log: [], plugin: {}, busy: [] };
  const studioOn = () => S.studio.studios.length > 0;
  function studioDot() {
    const st = S.studio.studios[0];
    $('#st-studiodot').classList.toggle('on', !!st);
    $('#st-studio').title = st ? `Roblox Studio: ${st.place || 'place'} conectado` : 'Roblox Studio: plugin RbxUI Connect (sin conectar)';
  }
  async function refreshStudio() {
    const st = await api('/api/studio/status').catch(() => null);
    if (!st) return;
    S.studio = st; studioDot();
    if (winById('studio')) renderStudio();
  }
  const nativeNames = async () => (await api('/api/scenes-meta')).filter((m) => m.native).map((m) => m.name);
  // instala escenas en Studio (sube antes las imágenes que falten); devuelve el resultado o lanza
  async function installInStudio(names, doc, upload = true) {
    if (S.dirty) await save();
    const t = toast(`Instalando ${names.join(', ')} en Roblox Studio…`, 'busy', { sticky: true });
    S.studioToast = t;
    try {
      const r = await api(`/api/studio/install?names=${encodeURIComponent(names.join(','))}${doc ? '&doc=' + encodeURIComponent(doc) : ''}&upload=${upload ? 1 : 0}`, { method: 'POST' });
      t.close();
      const up = r.upload && r.upload.uploaded ? ` · ${r.upload.uploaded} imágenes subidas` : '';
      toast(`Instalado en Studio: ${r.screens.join(', ')}${up}` + (r.missing.length ? ` · ${r.missing.length} sin imagen` : ''), r.missing.length ? 'warn' : 'ok', { mascot: r.missing.length ? null : 'ok' });
      return r;
    } catch (e) { t.close(); toast('Studio: ' + (e.data?.error || e.message), 'err'); throw e; }
    finally { S.studioToast = null; }
  }
  async function uploadFromStudio(names) {
    const t = toast('Subiendo imágenes con Roblox Studio…', 'busy', { sticky: true });
    S.studioToast = t;
    try {
      const r = await api('/api/studio/upload?names=' + encodeURIComponent(names.join(',')), { method: 'POST' });
      t.close();
      const nf = Object.keys(r.failed || {}).length;
      toast(r.uploaded ? `${r.uploaded} imágenes subidas a Roblox` + (nf ? ` · ${nf} fallaron` : '') : nf ? `${nf} imágenes fallaron` : 'No faltaba ninguna imagen', nf ? 'warn' : 'ok');
      await fetch('/assets/rbx_assets.json').then((x) => x.json()).then((m) => R.setAssets(m)).catch(() => {});
    } catch (e) { t.close(); toast('Studio: ' + (e.data?.error || e.message), 'err'); }
    finally { S.studioToast = null; }
    renderStudio();
  }
  async function pullFromStudio(name) {
    if (S.dirty && !confirm('Hay cambios sin guardar en la escena actual. ¿Descartarlos al abrir la de Studio?')) return;
    const t = toast(name ? `Trayendo ${name} de Studio…` : 'Trayendo la selección de Studio…', 'busy', { sticky: true });
    try {
      const r = await api('/api/studio/pull' + (name ? '?names=' + encodeURIComponent(name) : ''), { method: 'POST' });
      t.close();
      S.dirty = false;
      toast(`${r.names.join(', ')}: ${r.count} instancias desde Studio` + (r.thumbs ? ` · ${r.thumbs} imágenes descargadas` : ''), 'ok');
    } catch (e) { t.close(); toast('Studio: ' + (e.data?.error || e.message), 'err'); }
  }
  function renderStudio() {
    const w = winById('studio'); if (!w) return;
    const m = S.studio, st = m.studios[0], pl = m.plugin || {};
    const hero = h('div', { class: 'st-hero' }, h('img', { class: 'st-hm', src: MASCOT.ok, alt: '' }),
      h('div', {}, h('b', {}, st ? st.place || 'Place sin nombre' : 'Roblox Studio no conectado'),
        h('span', {}, st ? `${st.user ? st.user + ' · ' : ''}placeId ${st.placeId || '—'} · plugin ${st.version}` : pl.installed ? 'Abre tu place en Studio: el plugin se conecta solo.' : 'Instala el plugin y abre (o reinicia) Roblox Studio.')),
      h('span', { class: 'st-live' + (st ? ' on' : '') }, h('i', { class: 'st-dot' + (st ? ' on' : '') }), st ? 'Conectado' : 'Sin conexión'));
    const plBtn = h('button', { class: pl.installed && pl.upToDate ? '' : 'st-primary', onclick: async () => {
      plBtn.disabled = true;
      try { const r = await api('/api/studio/plugin', { method: 'POST' }); toast(`Plugin ${r.version} instalado · reinicia Roblox Studio si ya estaba abierto`, 'ok'); }
      catch (e) { toast('No se pudo instalar el plugin: ' + (e.data?.error || e.message), 'err'); }
      refreshStudio();
    } }, !pl.installed ? 'Instalar plugin' : pl.upToDate ? 'Reinstalar' : 'Actualizar plugin');
    const plugin = h('div', { class: 'st-target' + (pl.installed ? ' ok' : ''), style: 'grid-column:1/-1' },
      h('header', {}, h('span', { class: 'st-ti2', innerHTML: SVGI('plug', 14) }), 'Plugin RbxUI Connect', h('span', { class: 'st-chip', style: 'margin-left:auto' }, 'v' + (pl.version || '?'))),
      h('small', { class: pl.installed ? 'ok' : '' }, pl.installed ? (pl.upToDate ? '✓ Instalado y al día' : '⚠ Instalado, hay versión nueva') : 'Se copia a la carpeta de plugins locales de Roblox'),
      plBtn);
    const cur = isNative() ? S.name : null;
    const miss = h('span', { class: 'st-note', style: 'margin:0' }, '');
    const ins = h('button', { class: 'st-primary', disabled: !st || !cur, innerHTML: SVGI('send', 14) + (cur ? `Instalar «${cur}»` : 'Abre una escena nativa'),
      onclick: async () => { ins.disabled = true; await installInStudio([cur]).catch(() => {}); ins.disabled = false; } });
    const insAll = h('button', { class: 'st-btn', disabled: !st, innerHTML: SVGI('layers', 14) + 'Instalar todas',
      onclick: async () => { const n = await nativeNames(); if (n.length) await installInStudio(n, n.length > 1 ? 'RbxUI' : n[0]).catch(() => {}); } });
    const up = h('button', { class: 'st-btn', disabled: !st, innerHTML: SVGI('upload', 14) + 'Subir imágenes', onclick: async () => uploadFromStudio(cur ? [cur] : await nativeNames()) });
    if (cur) api('/api/studio/missing?names=' + encodeURIComponent(cur)).then((r) => { miss.textContent = r.missing.length ? `${r.missing.length} imágenes de esta escena aún no están en Roblox (se suben al instalar).` : 'Todas las imágenes de esta escena ya están en Roblox.'; }).catch(() => {});
    const guis = h('div', { class: 'st-clients' });
    const listBtn = h('button', { class: 'st-btn', style: 'height:24px', disabled: !st, innerHTML: SVGI('refresh', 13) + 'Ver ScreenGuis', onclick: async () => {
      listBtn.disabled = true; guis.innerHTML = '';
      try {
        const r = await api('/api/studio/guis');
        if (!r.guis.length) guis.append(h('p', { class: 'st-note', style: 'margin:0' }, 'StarterGui no tiene ScreenGuis.'));
        for (const g of r.guis) guis.append(h('div', { class: 'st-client' }, h('i', { class: 'st-dot' + (g.native ? ' on' : '') }), h('b', {}, g.name),
          h('small', {}, `${g.count} instancias${g.native ? ' · RbxUI' : ''}`),
          h('button', { class: 'st-btn', style: 'height:24px', innerHTML: SVGI('pull', 13) + 'Editar', onclick: () => pullFromStudio(g.name) })));
      } catch (e) { guis.append(h('p', { class: 'st-warn' }, e.data?.error || e.message)); }
      listBtn.disabled = false;
    } });
    const log = m.log.length ? h('div', { class: 'st-log' }, ...m.log.map((e) => h('div', { class: 'st-logrow' + (e.ok === false || e.event === 'error' ? ' err' : '') }, h('i', { class: 'st-dot' }),
      h('b', {}, { connect: 'Conectado', disconnect: 'Desconectado', install: 'Instalar', upload: 'Subir', done: e.job || 'Hecho', error: 'Error' }[e.event] || e.event),
      h('code', { title: e.message || '' }, e.message || e.place || (e.names || []).join(', ') || (e.count ? e.count + ' imágenes' : '')), h('small', {}, hhmm(e.at, 1)))))
      : h('p', { class: 'st-note', style: 'margin:0' }, 'Aquí verás lo que hace el plugin.');
    const scroll = w.body.scrollTop;
    w.set([st ? hero : stateBox('error', 'Roblox Studio no está conectado', pl.installed ? 'Abre tu place en Studio: el plugin RbxUI Connect se conecta solo (acepta el permiso HTTP la primera vez).' : 'Instala el plugin aquí abajo y abre (o reinicia) Roblox Studio.', [], 'xs'), h('div', { class: 'st-targets' }, plugin),
      h5('send', 'Llevar a Roblox'), h('div', { class: 'st-row', style: 'flex-wrap:wrap' }, ins, insAll, up), miss,
      h('p', { class: 'st-note', style: 'margin:6px 0 0' }, 'Crea las Instances en StarterGui (lo anterior va a ServerStorage.RbxUI_Backup) y el LocalScript RbxUINative. En Studio se puede deshacer con Ctrl+Z. Las imágenes se suben a tu cuenta desde Studio, sin API key.'),
      h5('pull', 'Traer de Studio al editor', h('span', { class: 'st-hact' }, listBtn)), guis,
      h('div', { class: 'st-row' }, h('button', { class: 'st-btn', disabled: !st, innerHTML: SVGI('pointer', 14) + 'Traer lo seleccionado en Studio', onclick: () => pullFromStudio(null) })),
      h5('terminal', 'Actividad'), log], []);
    w.body.scrollTop = scroll;
  }
  function openStudio() {
    const was = winById('studio');
    const w = openWin({ id: 'studio', modal: false, width: 540, icon: 'roblox', title: 'Roblox Studio', sub: 'Plugin RbxUI Connect: instala, sube imágenes y trae ScreenGuis',
      onClose: () => $('#st-studio').classList.remove('on') });
    $('#st-studio').classList.add('on');
    if (!was) { renderStudio(); refreshStudio(); }
    return w;
  }
  function onStudioEvent(ev) {
    if (ev.event === 'connect') toast(`Roblox Studio conectado: ${ev.place || 'place'}`, 'mcp', { mascot: 'ok' });
    else if (ev.event === 'disconnect') toast(`Roblox Studio desconectado (${ev.place || 'place'})`, 'info');
    else if (ev.event === 'progress') { if (S.studioToast) S.studioToast.set(`Subiendo imágenes ${ev.done}/${ev.total}: ${ev.message || ''}`); return; }
    else if (ev.event === 'done' && ev.ok === false && !S.studioToast) toast('Studio: ' + ev.message, 'err');
    else if (ev.event === 'install' && !S.studioToast) toast(`Studio: instalando ${(ev.names || []).join(', ')}…`, 'info');
    clearTimeout(S.studioT); S.studioT = setTimeout(refreshStudio, 150);
  }

  // ---------------------------------------------------------------- ver en el móvil: enlace con clave + QR (misma Wi-Fi)
  let qrLib = null;
  const loadQr = () => qrLib || (qrLib = new Promise((ok, ko) => {
    const sc = document.createElement('script');
    sc.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
    sc.onload = ok; sc.onerror = () => { qrLib = null; ko(new Error('sin conexión a internet')); };
    document.head.append(sc);
  }));
  async function renderPhone() {
    const w = winById('phone'); if (!w) return;
    let info;
    try { info = await api('/api/lan'); }
    catch { w.set(stateBox('lock', 'Solo desde el PC', 'El enlace para el móvil se saca en el ordenador donde corre RbxUI Studio.', [], 'sm'), []); return; }
    if (!info.urls.length) { w.set(stateBox('error', 'Este PC no está en ninguna red', 'Conéctalo a la Wi-Fi (la misma que el móvil) y vuelve a abrir esta ventana.', [], 'sm'), []); return; }
    const url = info.urls[0];
    const qrBox = h('div', { class: 'st-qr' }, h('span', { style: 'color:#333' }, 'Generando QR…'));
    loadQr().then(() => {
      const q = window.qrcode(0, 'M'); q.addData(url); q.make();
      qrBox.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    }).catch((e) => { qrBox.innerHTML = ''; qrBox.append(h('span', { style: 'color:#333;text-align:center' }, 'No se pudo generar el QR (' + e.message + '): copia el enlace.')); });
    w.set([qrBox,
      h('div', { class: 'st-url' }, h('code', { title: url }, url), h('button', { class: 'st-btn', title: 'Copiar enlace', innerHTML: SVGI('copy', 14), onclick: () => copyText(url, 'Enlace copiado') })),
      h('p', { class: 'st-note', style: 'margin:10px 0 0' }, 'Abre la cámara del móvil y apunta al QR. El móvil tiene que estar en la misma Wi-Fi que este PC; el enlace lleva una clave y deja el acceso guardado 30 días.'),
      h('p', { class: 'st-note', style: 'margin:6px 0 0' }, 'En el móvil: un dedo selecciona y mueve (o desplaza la vista), dos dedos hacen zoom, doble toque entra en un grupo. Los paneles se abren desde la barra de abajo.'),
      info.ips.length > 1 ? h('p', { class: 'st-note', style: 'margin:6px 0 0' }, 'Otras direcciones de este PC: ' + info.ips.slice(1).join(', ')) : null],
    [h('span', { class: 'st-grow' }, `${info.ips[0]}:${info.port}`),
      h('button', { class: 'st-btn', onclick: async () => {
        if (!confirm('¿Cambiar el enlace? El que tenga el móvil dejará de funcionar y habrá que escanear otra vez.')) return;
        await api('/api/lan?reset=1', { method: 'POST' }); toast('Enlace nuevo: el anterior ya no vale', 'info'); renderPhone();
      } }, 'Cambiar enlace')]);
  }
  function openPhone() {
    const w = openWin({ id: 'phone', modal: false, width: 380, icon: 'phone', title: 'Ver en el móvil', sub: 'Misma Wi-Fi · escanea el QR con la cámara',
      onClose: () => $('#st-phone').classList.remove('on') });
    $('#st-phone').classList.add('on');
    renderPhone();
    return w;
  }

  // ---------------------------------------------------------------- en vivo: eventos del servidor (SSE) + RPC que pide el MCP al editor
  S.cid = Math.random().toString(36).slice(2, 10);
  const RPC = {
    state: () => ({ scene: S.name, project: S.project?.id || null, native: isNative(), dirty: S.dirty, selection: S.sel.map((id) => node(id)?.name).filter(Boolean), stage: S.scene?.stage }),
    selection: () => selectionDoc(),
    insert: ({ nodes, stage }) => {
      if (!S.scene || !isNative()) throw new Error('la escena abierta no es nativa');
      const list = (Array.isArray(nodes) ? nodes : [nodes]).filter((c) => c && R.GUI.has(c.ClassName));
      if (!list.length) throw new Error('ningún nodo de interfaz (Frame, TextLabel, ImageLabel…)');
      const ns = insertRbxuiNodes(list, { stage: !!stage });
      toast(`La IA insertó ${ns.length} capa${ns.length > 1 ? 's' : ''} en ${S.name} (sin guardar)`, 'mcp');
      return { inserted: ns.map((x) => x.name), scene: S.name, saved: false };
    },
    open: async ({ name, save: doSave }) => {
      if (S.dirty && name !== S.name) { if (doSave) await save(); else throw new Error(`hay cambios sin guardar en ${S.name}; repite con save=true para guardarlos antes`); }
      const list = await loadSceneList(name);
      if (!list.includes(name)) throw new Error('no existe la escena ' + name);
      S.dirty = false; await loadScene(name);
      toast(`La IA abrió ${name}`, 'mcp');
      return { opened: name };
    },
    save: async () => { await save(); return { saved: S.name }; },
  };
  async function answerRpc(ev) {
    let body;
    try { const fn = RPC[ev.method]; if (!fn) throw new Error('método desconocido: ' + ev.method); body = { id: ev.id, result: await fn(ev.params || {}) }; }
    catch (e) { body = { id: ev.id, error: e.message || String(e) }; }
    await fetch('/api/editor/reply', { method: 'POST', body: JSON.stringify(body) }).catch(() => {});
  }
  let stateT = 0;
  function pushState() {
    clearTimeout(stateT);
    stateT = setTimeout(() => fetch('/api/editor/state', { method: 'POST', body: JSON.stringify({ cid: S.cid, ...RPC.state() }) }).catch(() => {}), 250);
  }
  async function onEvent(ev) {
    if (ev.type === 'rpc') { if (!ev.to || ev.to === S.cid) await answerRpc(ev); return; }
    if (ev.type === 'mcp') {
      if (ev.event === 'connect') toast(`${ev.client} se conectó por MCP`, 'mcp', { mascot: 'ok' });
      if (ev.event === 'disconnect') toast(`${ev.client} se desconectó del MCP`, 'info');
      if (ev.event === 'call') { const d = $('#st-mcpdot'); d.classList.remove('hit'); void d.offsetWidth; d.classList.add('hit'); }
      clearTimeout(S.mcpT); S.mcpT = setTimeout(refreshMcp, 120);
      return;
    }
    if (ev.type === 'studio') { onStudioEvent(ev); return; }
    if (ev.type === 'projects') { if (S.projectId) loadSceneList(S.name); return; }
    if (ev.type === 'examples') {
      if (Date.now() - (S.exSelf || 0) < 1500) return;
      if (winById('examples')) renderExamples(); else api('/api/examples').then((l) => { S.examples = l; updateExCount(); }).catch(() => {});
      return;
    }
    if (ev.type === 'scenes') {
      const mine = ev.names.includes(S.name);
      const target = ev.open ? ev.names[0] : mine ? S.name : null;
      await loadSceneList(target && !S.dirty ? target : S.name);
      if (!target) { toast(`${ev.by} creó ${ev.names.join(', ')}`, 'mcp', { action: { label: 'Abrir', fn: () => loadScene(ev.names[0]) } }); return; }
      if (S.dirty) {
        toast(`${ev.by} cambió ${target}; tienes cambios sin guardar`, 'warn', { sticky: true, action: { label: 'Descartar y abrir', fn: async () => { S.dirty = false; await loadSceneList(target); loadScene(target); } } });
        return;
      }
      await loadScene(target);
      toast(`${ev.by} ${mine ? 'actualizó' : 'creó'} ${target}`, 'mcp');
    }
  }
  function connectEvents() {
    const es = new EventSource('/api/events?cid=' + S.cid);
    es.onmessage = (m) => { let ev; try { ev = JSON.parse(m.data); } catch { return; } onEvent(ev).catch((e) => console.warn('evento', e)); };
    let fails = 0;
    es.onopen = () => { fails = 0; $('#st-offline').hidden = true; pushState(); refreshMcp(); refreshStudio(); };
    es.onerror = () => {
      if (++fails < 2) return;
      const o = $('#st-offline');
      if (!o.hidden) return;
      o.innerHTML = '';
      o.append(stateBox('error', 'Se perdió la conexión con RbxUI Studio', 'El servidor del editor no responde. Vuelve a abrir «RbxUI Studio.bat»; esta pantalla se quita sola al volver. Lo que no hayas guardado sigue aquí.',
        [h('button', { class: 'st-primary', innerHTML: SVGI('refresh', 14) + 'Reintentar ahora', onclick: () => { if (!S.dirty || confirm('Hay cambios sin guardar. ¿Recargar igualmente?')) location.reload(); } })]));
      o.hidden = false;
    };
  }
  window.addEventListener('focus', pushState);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pushState(); });

  // ---------------------------------------------------------------- servidor
  const api = async (url, opts) => { const r = await fetch(url, opts); const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.error || j.out || r.statusText), { data: j }); return j; };
  // proyecto abierto (?project=): el selector solo lista sus pantallas; lo nuevo se guarda dentro de él
  S.projectId = new URLSearchParams(location.search).get('project');
  S.project = null;
  async function loadProject() {
    if (!S.projectId) { $('#st-proj').hidden = true; return; }
    const db = await api('/api/projects').catch(() => null);
    S.project = db && db.projects.find((x) => x.id === S.projectId) || null;
    const b = $('#st-proj');
    b.hidden = !S.project;
    if (S.project) { b.querySelector('span').textContent = S.project.name; b.title = `Proyecto «${S.project.name}» · volver a Inicio`; }
  }
  const projQ = () => (S.project ? '&project=' + encodeURIComponent(S.project.id) : '');
  async function loadSceneList(select) {
    const list = await api('/api/scenes');                      // todas (para comprobar que existen)
    await loadProject();
    const shown = S.project ? S.project.scenes.filter((n) => list.includes(n)) : list;
    if (select && list.includes(select) && !shown.includes(select)) shown.push(select);
    const s = $('#st-scene'); s.innerHTML = '';
    for (const n of shown) s.append(h('option', { value: n, selected: n === select }, n));
    S.sceneNames = shown;
    return list;
  }
  async function loadScene(name) {
    if (S.dirty && !confirm('Hay cambios sin guardar. ¿Descartarlos?')) { $('#st-scene').value = S.name; return; }
    S.scene = await api('/api/scene?name=' + encodeURIComponent(name));
    S.name = name; S.sel = []; S.undo = []; S.redo = []; S.dirty = false; S.play = false; S.playVis = {};
    $('#st-play').classList.remove('on'); canvas.classList.remove('play'); $('#st-play').hidden = !S.scene.native;
    renderInsert();
    $('#st-export').textContent = S.scene.native ? 'Construir en Roblox' : 'Exportar a Roblox';
    // escenas nativas: cada pieza trae capas de decoración (Studs, Gloss, Rim…) => plegar todo salvo el primer nivel
    if (S.scene.native) walk((n, p) => { if (p && n.children?.length) S.collapsed.add(n.id); });
    document.title = name + (S.project ? ' · ' + S.project.name : '') + ' — RbxUI Studio'; history.replaceState(null, '', '?scene=' + name + projQ());
    refresh(); fitView(); status('Abierta ' + name); pushState();
    showEmpty(S.scene.nodes.length ? null : 'scene');
  }
  async function save() {
    if (!S.scene) return;
    await api('/api/scene?name=' + encodeURIComponent(S.name), { method: 'POST', body: JSON.stringify(S.scene) });
    S.dirty = false; document.title = S.name + ' — RbxUI Studio'; status('Guardado ' + new Date().toLocaleTimeString()); pushState();
  }
  async function doExport() {
    if (!S.scene) return;
    if (isNative()) return doBuildNative();
    try {
      await save(); status('Exportando…');
      const r = await api('/api/export?name=' + encodeURIComponent(S.name), { method: 'POST' });
      status('Exportado');
      modal(h('h3', {}, 'Exportado a Roblox'), h('pre', {}, r.out),
        h('img', { class: 'st-shot', src: `/out/${S.name}/design.png?t=${Date.now()}` }),
        h('p', { class: 'st-note', style: 'margin:0' }, `PNG + build.luau en rbxui/out/${S.name}/. Para meterlo en Roblox Studio dile a Claude: "instala ${S.name}".`));
    } catch (e) { status('Error al exportar', true); modal(h('h3', {}, 'Error al exportar'), h('pre', {}, e.data?.out || e.message)); }
  }
  async function doImport() {
    const files = await api('/api/screens');
    modal(h('h3', {}, 'Importar pantalla DS'), h('p', { class: 'st-note', style: 'margin:0 0 8px' }, 'Convierte una pantalla hecha con los constructores (screens/*.html) en escena editable.'),
      h('div', { class: 'st-list' }, ...files.map((f) => h('button', { onclick: async () => {
        closeModal(); status('Importando ' + f + '…');
        try { const r = await api('/api/import?src=' + encodeURIComponent('screens/' + f), { method: 'POST' }); await loadSceneList(r.name); S.dirty = false; await loadScene(r.name); }
        catch (e) { status('Error al importar', true); modal(h('h3', {}, 'Error'), h('pre', {}, e.data?.out || e.message)); }
      } }, f))));
  }
  async function newScene() {
    const name = (prompt('Nombre de la pantalla (será el ScreenGui), p. ej. InventoryScreen:') || '').replace(/[^\w-]/g, '');
    if (!name) return;
    const native = confirm('¿Escena nativa (Instances reales de Roblox, JSON rbxui)?\n\nAceptar = nativa · Cancelar = design system (PNG)');
    const scene = native ? { name, native: true, stage: { w: 1280, h: 720 }, design: { ...R.DESIGN_DEF, background: 'baseplate' }, gui: { props: {} }, nodes: [] }
      : { name, stage: { w: 1280, h: 720 }, nodes: [] };
    await api('/api/scene?name=' + name + projQ(), { method: 'POST', body: JSON.stringify(scene) });
    await loadSceneList(name); S.dirty = false; await loadScene(name);
  }

  // ---------------------------------------------------------------- teclado
  // Alt = medir distancias (como en Figma)
  window.addEventListener('keydown', (e) => { if (e.key === 'Alt' && !S.alt) { S.alt = true; drawOverlay(); e.preventDefault(); } }, true);
  window.addEventListener('keyup', (e) => { if (e.key === 'Alt') { S.alt = false; drawOverlay(); e.preventDefault(); } }, true);
  window.addEventListener('blur', () => { if (S.alt) { S.alt = false; drawOverlay(); } });
  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select')) { if (e.key === 'Escape') e.target.blur(); return; }
    const k = e.key, ctrl = e.ctrlKey || e.metaKey;
    // ventanas: Esc cierra la de delante (las flotantes solo si tienen el foco); con una ventana enfocada el lienzo no recibe atajos
    if (k === 'Escape' && WIN.list.length && (S.winFocus || WIN.list.some((w) => w.modal))) { closeWin(WIN.list.some((w) => w.modal) ? [...WIN.list].reverse().find((w) => w.modal) : topWin()); return; }
    if (WIN.list.some((w) => w.modal)) return;
    if (S.winFocus && !ctrl) return;
    if (k === ' ') { S.space = true; canvas.classList.add('pan'); e.preventDefault(); return; }
    if (!S.scene) return;
    if (!ctrl && k.toLowerCase() === 'p' && isNative()) { setPlay(!S.play); return; }
    if (S.play) { if (k === 'Escape') setPlay(false); return; }
    if (ctrl && k.toLowerCase() === 's') { e.preventDefault(); save(); return; }
    if (ctrl && k.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (ctrl && k.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (ctrl && k.toLowerCase() === 'd') { e.preventDefault(); duplicate(); return; }
    if (ctrl && k.toLowerCase() === 'g') { e.preventDefault(); if (e.shiftKey) ungroup(); else group(); return; }
    if (ctrl && k === ']') { e.preventDefault(); zorder(e.shiftKey ? 9 : 1); return; }
    if (ctrl && k === '[') { e.preventDefault(); zorder(e.shiftKey ? -9 : -1); return; }
    if (ctrl && k.toLowerCase() === 'a') { e.preventDefault(); const p = S.sel.length ? listOf(S.sel[0]) : S.scene.nodes; setSel(p.map((n) => n.id)); return; }
    if (e.shiftKey && e.code === 'Digit1') { e.preventDefault(); fitView(); return; }
    if (e.shiftKey && e.code === 'Digit2') { e.preventDefault(); fitSelection(); return; }
    if (ctrl && k === '0') { e.preventDefault(); zoomTo(1); return; }
    if (!ctrl && !e.altKey && !e.shiftKey) {
      const TK = { v: 'move', f: 'frame', t: 'text', i: 'image', b: 'button', h: 'hand' }[k.toLowerCase()];
      if (TK) { setTool(TK); return; }
    }
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); del(); return; }
    if (k === 'Escape') { if (S.sel.length) { const p = parentOf(S.sel[0]); setSel(p ? [p.id] : []); } return; }
    if (k === 'Enter' && S.sel.length === 1) { const n = node(S.sel[0]); if (n.children?.length) setSel([n.children[n.children.length - 1].id]); return; }
    const step = e.shiftKey ? 10 : 1;
    if (k === 'ArrowLeft') { e.preventDefault(); nudge(-step, 0); } if (k === 'ArrowRight') { e.preventDefault(); nudge(step, 0); }
    if (k === 'ArrowUp') { e.preventDefault(); nudge(0, -step); } if (k === 'ArrowDown') { e.preventDefault(); nudge(0, step); }
  });
  window.addEventListener('keyup', (e) => { if (e.key === ' ') { S.space = false; canvas.classList.remove('pan'); } });
  window.addEventListener('beforeunload', (e) => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

  // ---------------------------------------------------------------- arranque
  $('#st-scene').addEventListener('change', (e) => loadScene(e.target.value));
  $('#st-new').addEventListener('click', newScene);
  $('#st-import').addEventListener('click', doImport);
  $('#st-undo').addEventListener('click', undo);
  $('#st-redo').addEventListener('click', redo);
  $('#st-fit').addEventListener('click', fitView);
  $('#st-zoom').addEventListener('click', () => zoomTo(1));
  $$('#st-tools [data-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
  $$('#st-iconsrc [data-src]').forEach((b) => b.addEventListener('click', () => {
    S.iconSrc = b.dataset.src;
    $$('#st-iconsrc [data-src]').forEach((x) => x.classList.toggle('on', x === b));
    $('#st-webopts').hidden = S.iconSrc !== 'web';
    $('#st-logobar').hidden = S.iconSrc !== 'logos';
    if (S.iconSrc === 'logos') loadLogos();
    $('#st-iconq').placeholder = S.iconSrc === 'web' ? 'Buscar en inglés: sword, coin, gift…' : 'Buscar iconos…';
    renderIcons();
  }));
  $('#st-iconset').addEventListener('change', renderIcons);
  let colorTimer = 0;
  $('#st-iconcolor').addEventListener('input', () => { clearTimeout(colorTimer); colorTimer = setTimeout(renderIcons, 250); });
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('st-theme', t); } catch { /* sin almacenamiento: solo esta sesión */ }
    $('#st-theme').innerHTML = SVGI(t === 'light' ? 'moon' : 'sun', 16);
  }
  $('#st-theme').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'));
  paintIcons();
  setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  $('#st-save').addEventListener('click', save);
  $('#st-export').addEventListener('click', doExport);
  $('#st-rbxui').addEventListener('click', () => doRbxui('import'));
  $('#st-examples').addEventListener('click', () => { const w = winById('examples'); if (w) closeWin(w); else openExamples(); });
  $('#st-mcp').addEventListener('click', () => { const w = winById('mcp'); if (w) closeWin(w); else openMcp(); });
  $('#st-studio').addEventListener('click', () => { const w = winById('studio'); if (w) closeWin(w); else openStudio(); });
  $('#st-phone').addEventListener('click', () => { const w = winById('phone'); if (w) closeWin(w); else openPhone(); });
  $('#st-check').addEventListener('click', () => { const w = winById('check'); if (w) closeWin(w); else { runCheck(); openCheck(); } });
  $('#st-devices').addEventListener('click', () => { const w = winById('devices'); if (w) closeWin(w); else openDevices(); });
  $('#st-play').addEventListener('click', () => setPlay(!S.play));
  $('#st-iconq').addEventListener('input', renderIcons);
  window.addEventListener('resize', () => drawOverlay());
  new ResizeObserver(() => { if (S.needFit && S.scene) fitView(); }).observe(canvas);

  const hideSplash = () => { const sp = $('#st-splash'); if (!sp || sp.classList.contains('gone')) return; sp.classList.add('gone'); setTimeout(() => sp.remove(), 600); };
  const splashMin = new Promise((r) => setTimeout(r, 650));
  (async () => {
    renderInsert();
    connectEvents();
    loadLogos();
    api('/api/examples').then((l) => { S.examples = l; updateExCount(); }).catch(() => {});
    await fetch('/assets/rbx_assets.json').then((r) => (r.ok ? r.json() : {})).then((m) => R.setAssets(m)).catch(() => {});
    api('/api/icons').then((l) => { S.icons = l; renderIcons(); });
    api('/api/resources').then((l) => { S.resources = l; }).catch(() => {});
    api('/api/backgrounds').then((l) => { S.backgrounds = l; if (!S.sel.length) renderProps(); }).catch(() => {});
    await document.fonts.ready;
    let want = new URLSearchParams(location.search).get('scene');
    const list = await loadSceneList(want);
    const pool = S.project ? S.sceneNames : list;
    if (!(want && list.includes(want))) want = pool[0];
    if (want) await loadScene(want);
    else { renderProps(); showEmpty('none'); }
    await splashMin; hideSplash();
  })().catch((e) => { hideSplash(); status(String(e.message || e), true); showEmpty('error', String(e.message || e)); });
  setTimeout(hideSplash, 8000);

  window.RBXStudio = { S, node, refresh, save, loadScene, openWin, toast, openExamples, openMcp, openStudio, showEmpty, openPhone };   // depuración
})();
