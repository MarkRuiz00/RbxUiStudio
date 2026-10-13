/* Fig — editor con el modelo de Figma. Núcleo: lienzo, vista, herramientas, selección, teclado, portapapeles y archivos.
   Paneles (capas y propiedades): panels.js. Render: render.js. Maquetación: layout.js. Modelo y deshacer: model.js. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const FR = window.FigRender, FL = window.FigLayout, FM = window.FigModel;
  const cv = $('#cv'), ov = $('#ov'), stage = $('#stage'), ctx = cv.getContext('2d'), octx = ov.getContext('2d');
  const hitCtx = document.createElement('canvas').getContext('2d');
  const ID = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 };

  const A = window.FigApp = {
    doc: null, sel: [], tool: 'move', view: { x: 80, y: 80, k: 1 }, hover: null, drag: null, editing: null, expanded: new Set(), fonts: {},
    listeners: { sel: [], doc: [] },
    on(ev, f) { (this.listeners[ev] = this.listeners[ev] || []).push(f); },
    emit(ev) { for (const f of this.listeners[ev] || []) f(); },
  };
  const dpr = () => window.devicePixelRatio || 1;

  // ---------------------------------------------------------------- avisos
  function toast(msg, kind = '', ms = 3200) {
    const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg; $('#toasts').append(t);
    setTimeout(() => t.remove(), ms);
  }
  A.toast = toast;

  // ---------------------------------------------------------------- documento
  const EMPTY = () => ({ format: 'figdoc', version: 1, name: 'Sin título', schema: null, blobs: [], document: null,
    pages: [{ id: '0:1', type: 'CANVAS', name: 'Page 1', visible: true, opacity: 1, backgroundColor: { r: 0.118, g: 0.118, b: 0.118, a: 1 }, children: [] }] });
  function setDoc(json) {
    A.doc = new FM.Doc(json);
    A.doc.page = A.doc.d.pages.find((p) => !p.internalOnly && p.name !== 'Internal Only Canvas') || A.doc.d.pages[0];
    A.sel = []; $('#doc-name').value = json.name || 'Sin título';
    history.replaceState(null, '', '?doc=' + encodeURIComponent(json.name || ''));
    A.emit('doc'); A.emit('sel'); fitAll(); render();
  }
  A.setDoc = setDoc;
  async function openDoc(name) {
    const r = await fetch('/api/fig/doc?name=' + encodeURIComponent(name));
    if (!r.ok) { toast('No existe el documento ' + name, 'err'); return; }
    setDoc(await r.json());
  }
  async function saveDoc(quiet) {
    if (!A.doc) return;
    A.doc.d.name = $('#doc-name').value.trim() || 'Sin título';
    const body = JSON.stringify(A.doc.d, (k, v) => (k === '_geo' || k === '_geoKey' || k === '_u8' ? undefined : v));
    const r = await fetch('/api/fig/doc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    if (r.ok) { const j = await r.json(); A.doc.dirty = false; A.doc.d.name = j.name; history.replaceState(null, '', '?doc=' + encodeURIComponent(j.name)); updateDirty(); if (!quiet) toast('Guardado'); }
    else toast('No se pudo guardar', 'err');
  }
  A.save = saveDoc;
  let autoTimer = 0;
  function updateDirty() { $('#dirty').textContent = A.doc && A.doc.dirty ? '•' : ''; }
  // cambio con deshacer: label para el historial, fn hace el cambio
  A.change = function (label, fn, { relayout = true } = {}) {
    A.doc.begin(label);
    fn();
    if (relayout) for (const id of A.sel) { const n = A.doc.node(id); if (n) { A.doc.relayoutUp(n); A.doc.fitGroups(n); } }
    A.doc.commit(); afterChange();
  };
  function afterChange() {
    A.sel = A.sel.filter((id) => A.doc.node(id));
    updateDirty(); A.emit('doc'); A.emit('sel'); render();
    clearTimeout(autoTimer); autoTimer = setTimeout(() => { if (A.doc.dirty && A.doc.d.name && A.doc.d.name !== 'Sin título') saveDoc(true); }, 4000);
  }
  A.afterChange = afterChange;
  A.select = function (ids) { A.sel = [...new Set(ids)].filter((id) => A.doc.node(id)); A.emit('sel'); render(); };
  A.selected = () => A.sel.map((id) => A.doc.node(id)).filter(Boolean);
  A.setPage = function (pg) { A.doc.page = pg; A.sel = []; A.emit('doc'); A.emit('sel'); fitAll(); render(); };

  // ---------------------------------------------------------------- vista
  function resize() {
    const r = stage.getBoundingClientRect(), d = dpr();
    for (const c of [cv, ov]) { c.width = Math.round(r.width * d); c.height = Math.round(r.height * d); }
    render();
  }
  const V = () => { const d = dpr(), v = A.view; return [v.k * d, 0, 0, v.k * d, v.x * d, v.y * d]; };
  const toDesign = (sx, sy) => [(sx - A.view.x) / A.view.k, (sy - A.view.y) / A.view.k];
  const toScreen = (x, y) => [x * A.view.k + A.view.x, y * A.view.k + A.view.y];
  A.toDesign = toDesign; A.toScreen = toScreen;
  function zoomAt(k, sx, sy) {
    k = Math.max(0.02, Math.min(256, k));
    const [dx, dy] = toDesign(sx, sy); A.view.k = k; A.view.x = sx - dx * k; A.view.y = sy - dy * k;
    $('#zoom-lab').textContent = Math.round(k * 100) + '%'; render();
  }
  function fitRect(b, pad = 60) {
    const r = stage.getBoundingClientRect(); if (!b || !b.w || !b.h) { A.view = { x: r.width / 2, y: r.height / 2, k: 1 }; render(); return; }
    const k = Math.min((r.width - pad * 2) / b.w, (r.height - pad * 2) / b.h, 8);
    A.view = { k, x: r.width / 2 - (b.x + b.w / 2) * k, y: r.height / 2 - (b.y + b.h / 2) * k };
    $('#zoom-lab').textContent = Math.round(k * 100) + '%'; render();
  }
  function fitAll() { const ks = (A.doc.page.children || []).filter((n) => n.visible !== false); fitRect(ks.length ? FM.union(ks.map((n) => A.doc.bounds(n))) : null); }
  function fitSel() { const s = A.selected(); if (s.length) fitRect(FM.union(s.map((n) => A.doc.bounds(n)))); else fitAll(); }
  A.fitAll = fitAll; A.fitSel = fitSel;

  // ---------------------------------------------------------------- render
  let raf = 0;
  function render() { if (!raf) raf = requestAnimationFrame(draw); }
  A.render = render;
  const RC = { onAsset: render, layoutText: (n) => FL.layoutText(n), imageBase: '/api/fig/image/' };
  FL.setOnFont(() => { A.doc && A.doc.version++; render(); });
  function draw() {
    raf = 0; if (!A.doc) return;
    Object.assign(RC, { doc: A.doc.d, W: cv.width, H: cv.height, version: A.doc.version });
    A.doc.renderCtx = RC;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    FR.renderPage(ctx, A.doc.page, V(), RC);
    drawOverlay();
  }
  A.renderCtx = RC;

  // ---------------------------------------------------------------- overlay: nombres de frames, hover, selección, tiradores
  const HS = 8;    // tamaño del tirador (px de pantalla)
  function quad(n) { const M = A.doc.abs(n), w = n.size?.x || 0, h = n.size?.y || 0; return [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => toScreen(...FR.app(M, x, y))); }
  function selBox() {
    const s = A.selected(); if (!s.length) return null;
    if (s.length === 1) { const q = quad(s[0]); return { q, single: s[0] }; }
    const b = FM.union(s.map((n) => A.doc.bounds(n))), [x0, y0] = toScreen(b.x, b.y), [x1, y1] = toScreen(b.x + b.w, b.y + b.h);
    return { q: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] };
  }
  function handles(q) {
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    return { nw: q[0], ne: q[1], se: q[2], sw: q[3], n: mid(q[0], q[1]), e: mid(q[1], q[2]), s: mid(q[2], q[3]), w: mid(q[3], q[0]) };
  }
  function drawOverlay() {
    const d = dpr(); octx.setTransform(d, 0, 0, d, 0, 0); octx.clearRect(0, 0, ov.width, ov.height);
    // nombres de los frames de primer nivel
    octx.font = '11px Inter, sans-serif'; octx.textBaseline = 'bottom';
    for (const n of A.doc.page.children || []) {
      if (n.visible === false || !['FRAME', 'COMPONENT', 'SECTION', 'SYMBOL', 'COMPONENT_SET'].includes(n.type) || FR.isGroup(n)) continue;
      const q = quad(n), sel = A.sel.includes(n.id);
      octx.fillStyle = sel ? '#0d99ff' : '#999'; octx.fillText(n.name || '', q[0][0], q[0][1] - 4);
    }
    const line = (q, col, w = 1) => { octx.strokeStyle = col; octx.lineWidth = w; octx.beginPath(); q.forEach((p, i) => (i ? octx.lineTo(...p) : octx.moveTo(...p))); octx.closePath(); octx.stroke(); };
    if (A.hover && !A.sel.includes(A.hover) && A.doc.node(A.hover)) line(quad(A.doc.node(A.hover)), '#0d99ff', 1.5);
    for (const n of A.selected()) if (A.sel.length > 1) line(quad(n), '#0d99ff88', 1);
    // guías de alineación
    if (A.drag && A.drag.guides) { octx.strokeStyle = '#f24822'; octx.lineWidth = 1; for (const g of A.drag.guides) { octx.beginPath(); octx.moveTo(...g[0]); octx.lineTo(...g[1]); octx.stroke(); } }
    const sb = selBox();
    if (sb && !A.editing) {
      line(sb.q, '#0d99ff', 1);
      const H = handles(sb.q), noHandles = sb.single && sb.single.type === 'LINE';
      if (!noHandles) for (const k of Object.keys(H)) { if (k.length === 1 && dist(sb.q[0], sb.q[2]) < 40) continue; const [x, y] = H[k]; octx.fillStyle = '#fff'; octx.strokeStyle = '#0d99ff'; octx.lineWidth = 1; octx.fillRect(x - HS / 2, y - HS / 2, HS, HS); octx.strokeRect(x - HS / 2, y - HS / 2, HS, HS); }
      // medidas
      const s = A.selected(), b = s.length === 1 ? { w: s[0].size?.x || 0, h: s[0].size?.y || 0 } : FM.union(s.map((n) => A.doc.bounds(n)));
      const lab = `${fmt(b.w)} × ${fmt(b.h)}`, bot = sb.q.reduce((a, p) => (p[1] > a[1] ? p : a)), cx = (Math.min(...sb.q.map((p) => p[0])) + Math.max(...sb.q.map((p) => p[0]))) / 2;
      octx.font = '600 11px Inter, sans-serif'; const tw = octx.measureText(lab).width;
      octx.fillStyle = '#0d99ff'; roundRect(octx, cx - tw / 2 - 6, bot[1] + 8, tw + 12, 18, 3); octx.fill();
      octx.fillStyle = '#fff'; octx.textBaseline = 'middle'; octx.fillText(lab, cx - tw / 2, bot[1] + 17);
    }
    if (A.drag && A.drag.kind === 'marquee') { const m = A.drag; octx.fillStyle = '#0d99ff22'; octx.strokeStyle = '#0d99ff'; octx.fillRect(m.x0, m.y0, m.x1 - m.x0, m.y1 - m.y0); octx.strokeRect(m.x0, m.y0, m.x1 - m.x0, m.y1 - m.y0); }
    if (A.drag && A.drag.kind === 'create' && A.drag.box) { const b = A.drag.box, [x0, y0] = toScreen(b.x, b.y); octx.strokeStyle = '#0d99ff'; octx.strokeRect(x0, y0, b.w * A.view.k, b.h * A.view.k); }
    if (A.pen) drawPen();
  }
  const fmt = (v) => String(Math.round(v * 100) / 100);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
  A.fmt = fmt;

  // ---------------------------------------------------------------- selección con las reglas de Figma
  const topFrames = () => (A.doc.page.children || []).filter((n) => FM.CONTAINERS.has(n.type) && !FR.isGroup(n));
  function pickAt(x, y, deep, entering) {
    const d = A.doc.deepestAt(x, y, hitCtx);
    if (!d) return null;
    if (deep) return d;
    const ctxs = new Set([...topFrames(), ...A.selected().map((n) => A.doc.parent(n)), ...(entering ? A.selected() : [])].filter(Boolean).map((n) => n.id));
    let c = d;
    while (c) { const p = A.doc.parent(c); if (!p || p.type === 'CANVAS') break; if (ctxs.has(p.id)) return c; c = p; }
    return c;
  }
  function inSel(n) { let p = n; while (p) { if (A.sel.includes(p.id)) return true; p = A.doc.parent(p); } return false; }

  // ---------------------------------------------------------------- ratón
  let space = false;
  const pos = (e) => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  function handleAt(sx, sy) {
    const sb = selBox(); if (!sb || A.editing) return null;
    const H = handles(sb.q);
    for (const [k, p] of Object.entries(H)) if (Math.abs(p[0] - sx) <= HS && Math.abs(p[1] - sy) <= HS) return { kind: 'resize', h: k };
    // girar: justo fuera de una esquina
    for (const k of ['nw', 'ne', 'se', 'sw']) { const p = H[k]; const dd = dist(p, [sx, sy]); if (dd > HS && dd < 22) { const c = center(sb.q); if (dist(c, [sx, sy]) > dist(c, p)) return { kind: 'rotate', h: k }; } }
    return null;
  }
  const center = (q) => [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2];
  const CURSOR = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize' };

  cv.addEventListener('pointerdown', (e) => {
    if (A.editing) commitText();
    cv.setPointerCapture(e.pointerId);
    const [sx, sy] = pos(e), [x, y] = toDesign(sx, sy);
    if (e.button === 1 || space || A.tool === 'hand') { A.drag = { kind: 'pan', sx, sy, vx: A.view.x, vy: A.view.y }; stage.classList.add('grabbing'); return; }
    if (e.button !== 0) return;
    if (A.tool === 'pen') { penClick(x, y, e); return; }
    if (A.tool !== 'move') { A.drag = { kind: 'create', x0: x, y0: y, box: null, type: A.tool }; return; }
    const h = handleAt(sx, sy);
    if (h) { startTransform(h, sx, sy, e); return; }
    const t = pickAt(x, y, e.ctrlKey || e.metaKey, false);
    if (!t) { if (!e.shiftKey) A.select([]); A.drag = { kind: 'marquee', x0: sx, y0: sy, x1: sx, y1: sy, base: e.shiftKey ? [...A.sel] : [] }; return; }
    if (e.shiftKey) { A.select(A.sel.includes(t.id) ? A.sel.filter((i) => i !== t.id) : [...A.sel, t.id]); return; }
    if (!inSel(t)) A.select([t.id]);
    startMove(x, y, e);
  });
  cv.addEventListener('dblclick', (e) => {
    const [sx, sy] = pos(e), [x, y] = toDesign(sx, sy), s = A.selected();
    if (s.length === 1 && s[0].type === 'TEXT') { startText(s[0]); return; }
    const t = pickAt(x, y, false, true);
    if (t && t.type === 'TEXT' && A.sel.includes(t.id)) { startText(t); return; }
    if (t) A.select([t.id]);
  });
  window.addEventListener('pointermove', (e) => {
    const [sx, sy] = pos(e), [x, y] = toDesign(sx, sy);
    if (!A.drag) {
      if (e.target !== cv) return;
      const h = A.tool === 'move' && handleAt(sx, sy);
      cv.style.cursor = h ? (h.kind === 'rotate' ? 'alias' : CURSOR[h.h]) : A.tool === 'move' ? 'default' : A.tool === 'hand' ? 'grab' : 'crosshair';
      const t = A.tool === 'move' ? pickAt(x, y, e.ctrlKey || e.metaKey, false) : null, id = t ? t.id : null;
      if (id !== A.hover) { A.hover = id; render(); A.emit('hover'); }
      if (A.pen) { A.pen.mouse = [x, y]; render(); }
      return;
    }
    const D = A.drag;
    if (D.kind === 'pan') { A.view.x = D.vx + sx - D.sx; A.view.y = D.vy + sy - D.sy; render(); return; }
    if (D.kind === 'marquee') {
      D.x1 = sx; D.y1 = sy;
      const [ax, ay] = toDesign(Math.min(D.x0, sx), Math.min(D.y0, sy)), [bx, by] = toDesign(Math.max(D.x0, sx), Math.max(D.y0, sy));
      const inside = (b) => b.x < bx && b.x + b.w > ax && b.y < by && b.y + b.h > ay;
      // dentro de un frame de primer nivel: sus hijos; si no, los de la página
      const host = topFrames().find((f) => { const b = A.doc.bounds(f); const [x0, y0] = toDesign(D.x0, D.y0); return x0 > b.x && x0 < b.x + b.w && y0 > b.y && y0 < b.y + b.h; });
      const cands = (host ? host.children : A.doc.page.children) || [];
      A.sel = [...D.base, ...cands.filter((n) => n.visible !== false && !n.locked && inside(A.doc.bounds(n))).map((n) => n.id)];
      A.emit('sel'); render(); return;
    }
    if (D.kind === 'create') {
      let w = x - D.x0, h = y - D.y0;
      if (e.shiftKey) { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
      D.box = { x: Math.min(D.x0, D.x0 + w), y: Math.min(D.y0, D.y0 + h), w: Math.abs(w), h: Math.abs(h), raw: [D.x0, D.y0, D.x0 + w, D.y0 + h] };
      render(); return;
    }
    if (D.kind === 'move') moveDrag(x, y, e);
    if (D.kind === 'resize') resizeDrag(x, y, e);
    if (D.kind === 'rotate') rotateDrag(sx, sy, e);
  });
  window.addEventListener('pointerup', (e) => {
    const D = A.drag; if (!D) return;
    A.drag = null; stage.classList.remove('grabbing');
    if (D.kind === 'create') finishCreate(D, e);
    else if (D.kind === 'move' && D.moved) finishMove(D, e);
    else if ((D.kind === 'resize' || D.kind === 'rotate') && D.moved) { A.doc.commit(); afterChange(); }
    else if (D.kind === 'move' && !D.moved) A.doc.undoStack.pop();
    render();
  });
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const [sx, sy] = pos(e);
    if (e.ctrlKey || e.metaKey) zoomAt(A.view.k * Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0025)), sx, sy);
    else { A.view.x -= e.shiftKey ? e.deltaY : e.deltaX; A.view.y -= e.shiftKey ? 0 : e.deltaY; render(); }
  }, { passive: false });

  // mover (con guías a hermanos y al padre, y meter/sacar de frames al soltar)
  function startMove(x, y, e) {
    const nodes = topLevelSel();
    A.doc.begin('Mover');
    A.drag = { kind: 'move', x0: x, y0: y, nodes, start: nodes.map((n) => ({ ...n.transform })), moved: false, alt: e.altKey };
  }
  const topLevelSel = () => A.selected().filter((n) => !A.doc.ancestors(n).some((p) => A.sel.includes(p.id)));
  function moveDrag(x, y, e) {
    const D = A.drag; let dx = x - D.x0, dy = y - D.y0;
    if (!D.moved && Math.hypot(dx, dy) * A.view.k < 3) return;
    if (!D.moved && D.alt) {   // Alt+arrastrar: duplicar
      const copies = D.nodes.map((n) => { const c = A.doc.clone(n); const p = A.doc.parent(n); p.children.splice(p.children.indexOf(n) + 1, 0, c); return c; });
      A.doc.reindex(); D.nodes = copies; A.sel = copies.map((c) => c.id); A.emit('sel');
    }
    D.moved = true;
    if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    D.nodes.forEach((n, i) => { n.transform = { ...D.start[i] }; });
    // guías: bordes y centros contra hermanos y padre
    const snap = snapMove(D.nodes, dx, dy);
    dx += snap.dx; dy += snap.dy; D.guides = snap.guides;
    for (const n of D.nodes) A.doc.translate(n, dx, dy);
    A.doc.version++; render(); A.emit('geo');
  }
  function snapMove(nodes, dx, dy) {
    const bb = FM.union(nodes.map((n) => A.doc.bounds(n))), b = { x: bb.x + dx, y: bb.y + dy, w: bb.w, h: bb.h };
    const p = A.doc.parent(nodes[0]), sibs = ((p && p.children) || []).filter((n) => !nodes.includes(n) && n.visible !== false);
    const tgt = sibs.map((n) => A.doc.bounds(n)); if (p && p.type !== 'CANVAS') tgt.push(A.doc.bounds(p));
    const T = 5 / A.view.k, xs = [b.x, b.x + b.w / 2, b.x + b.w], ys = [b.y, b.y + b.h / 2, b.y + b.h];
    let bx = null, by = null;
    for (const t of tgt) {
      for (const tx of [t.x, t.x + t.w / 2, t.x + t.w]) for (const x of xs) { const d = tx - x; if (Math.abs(d) < T && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = { d, x: tx, t }; }
      for (const ty of [t.y, t.y + t.h / 2, t.y + t.h]) for (const y of ys) { const d = ty - y; if (Math.abs(d) < T && (!by || Math.abs(d) < Math.abs(by.d))) by = { d, y: ty, t }; }
    }
    const guides = [];
    if (bx) { const y0 = Math.min(b.y, bx.t.y), y1 = Math.max(b.y + b.h, bx.t.y + bx.t.h); guides.push([toScreen(bx.x, y0), toScreen(bx.x, y1)]); }
    if (by) { const x0 = Math.min(b.x, by.t.x), x1 = Math.max(b.x + b.w, by.t.x + by.t.w); guides.push([toScreen(x0, by.y), toScreen(x1, by.y)]); }
    return { dx: bx ? bx.d : 0, dy: by ? by.d : 0, guides };
  }
  function finishMove(D, e) {
    const [x, y] = toDesign(...pos(e));
    // ¿soltado sobre otro frame? meterlo dentro (o sacarlo al lienzo)
    const p0 = A.doc.parent(D.nodes[0]);
    const host = frameAt(x, y, D.nodes);
    const target = host || A.doc.page;
    if (target !== p0 && !(FR.isGroup(p0) && !host)) {
      for (const n of D.nodes) A.doc.reparent(n, target, target.stackMode && target.stackMode !== 'NONE' ? insertIndex(target, x, y) : null);
    } else if (p0.stackMode && p0.stackMode !== 'NONE') {   // auto layout: reordenar
      for (const n of D.nodes) { const i = insertIndex(p0, x, y, n); p0.children.splice(p0.children.indexOf(n), 1); p0.children.splice(i, 0, n); }
      A.doc.relayoutUp(p0);
    }
    for (const n of D.nodes) A.doc.fitGroups(n);
    A.doc.commit(); afterChange();
  }
  // frame más profundo bajo el punto que no sea (ni contenga) lo que se arrastra
  function frameAt(x, y, exclude) {
    const ex = new Set(exclude.map((n) => n.id));
    const walk = (list) => {
      for (let i = list.length - 1; i >= 0; i--) {
        const n = list[i]; if (ex.has(n.id) || n.visible === false || n.locked) continue;
        if (!['FRAME', 'COMPONENT', 'SECTION', 'SYMBOL'].includes(n.type) || FR.isGroup(n)) continue;
        const b = A.doc.bounds(n);
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return walk(n.children || []) || n;
      }
      return null;
    };
    return walk(A.doc.page.children || []);
  }
  function insertIndex(p, x, y, self) {
    const H = p.stackMode === 'HORIZONTAL', kids = (p.children || []).filter((k) => k !== self);
    let i = 0; for (const k of kids) { const b = A.doc.bounds(k); if ((H ? x : y) > (H ? b.x + b.w / 2 : b.y + b.h / 2)) i = p.children.indexOf(k) + 1; }
    return Math.min(i, p.children.length);
  }

  // redimensionar (en el espacio local del nodo: respeta el giro) y girar
  function startTransform(h, sx, sy, e) {
    const nodes = topLevelSel(); A.doc.begin(h.kind === 'rotate' ? 'Girar' : 'Redimensionar');
    const snap = nodes.map((n) => JSON.parse(JSON.stringify(n, (k, v) => (k === '_geo' || k === '_geoKey' ? undefined : v))));
    const bb = FM.union(nodes.map((n) => A.doc.bounds(n)));
    A.drag = { kind: h.kind, h: h.h, nodes, snap, bb, sx, sy, moved: false, rot0: nodes.length === 1 ? A.doc.rotation(nodes[0]) : 0 };
  }
  function restoreSnap(D) { D.nodes.forEach((n, i) => { const s = D.snap[i]; for (const k of Object.keys(n)) if (k !== 'id' && k !== 'children') delete n[k]; Object.assign(n, s, { children: n.children }); if (!n.children) delete n.children; }); }
  function resizeDrag(x, y, e) {
    const D = A.drag; D.moved = true; restoreSnap(D);
    const hx = D.h.includes('w') ? -1 : D.h.includes('e') ? 1 : 0, hy = D.h.includes('n') ? -1 : D.h.includes('s') ? 1 : 0;
    if (D.nodes.length === 1) {
      const n = D.nodes[0], M = A.doc.abs(n), I = FR.inv(M), [lx, ly] = FR.app(I, x, y), w = n.size.x, h = n.size.y;
      let x0 = 0, y0 = 0, x1 = w, y1 = h;
      if (hx < 0) x0 = lx; if (hx > 0) x1 = lx; if (hy < 0) y0 = ly; if (hy > 0) y1 = ly;
      if (e.altKey) { if (hx) { const c = w / 2, d = Math.abs((hx > 0 ? x1 : x0) - c); x0 = c - d; x1 = c + d; } if (hy) { const c = h / 2, d = Math.abs((hy > 0 ? y1 : y0) - c); y0 = c - d; y1 = c + d; } }
      if (e.shiftKey && hx && hy) { const s = Math.max(Math.abs(x1 - x0) / w, Math.abs(y1 - y0) / h); if (hx < 0) x0 = x1 - w * s; else x1 = x0 + w * s; if (hy < 0) y0 = y1 - h * s; else y1 = y0 + h * s; }
      const nx = Math.min(x0, x1), ny = Math.min(y0, y1), nw = Math.abs(x1 - x0), nh = Math.abs(y1 - y0);
      // origen local nuevo -> espacio del padre
      const t = n.transform || ID, px = t.m00 * nx + t.m01 * ny + t.m02, py = t.m10 * nx + t.m11 * ny + t.m12;
      A.doc.setBox(n, px, py, Math.max(1, nw), Math.max(1, nh));
      n.transform = { ...n.transform, m00: t.m00, m01: t.m01, m10: t.m10, m11: t.m11 };
    } else {   // varios: escalar la caja común
      const b = D.bb; let x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;
      if (hx < 0) x0 = x; if (hx > 0) x1 = x; if (hy < 0) y0 = y; if (hy > 0) y1 = y;
      const sxk = (x1 - x0) / b.w, syk = (y1 - y0) / b.h;
      for (const n of D.nodes) { const nb = A.doc.bounds(n), nx = x0 + (nb.x - b.x) * sxk, ny = y0 + (nb.y - b.y) * syk; A.doc.translate(n, nx - nb.x, ny - nb.y); const t = n.transform; A.doc.setBox(n, t.m02, t.m12, (n.size.x) * Math.abs(sxk), (n.size.y) * Math.abs(syk)); }
    }
    A.doc.version++; render(); A.emit('geo');
  }
  function rotateDrag(sx, sy, e) {
    const D = A.drag; D.moved = true; restoreSnap(D);
    const sb = selBox(), c = center(sb.q);
    const a0 = Math.atan2(D.sy - c[1], D.sx - c[0]), a1 = Math.atan2(sy - c[1], sx - c[0]);
    let deg = (a1 - a0) * 180 / Math.PI;
    if (D.nodes.length === 1) { let r = D.rot0 + deg; if (e.shiftKey) r = Math.round(r / 15) * 15; A.doc.rotateTo(D.nodes[0], r); }
    A.doc.version++; render(); A.emit('geo');
  }

  // crear formas
  const TOOL_TYPE = { frame: 'FRAME', rect: 'ROUNDED_RECTANGLE', ellipse: 'ELLIPSE', line: 'LINE', text: 'TEXT' };
  function finishCreate(D, e) {
    const type = TOOL_TYPE[D.type]; if (!type) return;
    const b = D.box && D.box.w > 2 && D.box.h > 2 ? D.box : null;
    const parent = (type === 'FRAME' ? frameAt(D.x0, D.y0, []) : frameAt(D.x0, D.y0, [])) || A.doc.page;
    A.doc.begin('Crear');
    const props = {};
    if (type === 'LINE') {
      const [x0, y0, x1, y1] = D.box ? D.box.raw : [D.x0, D.y0, D.x0 + 100, D.y0];
      const len = Math.max(1, Math.hypot(x1 - x0, y1 - y0)), a = Math.atan2(y1 - y0, x1 - x0), c = Math.cos(a), s = Math.sin(a);
      Object.assign(props, { size: { x: len, y: 0 }, transform: { m00: c, m01: -s, m10: s, m11: c, m02: x0, m12: y0 } });
    } else if (type === 'TEXT') Object.assign(props, { transform: { ...ID, m02: D.x0, m12: D.y0 }, size: b ? { x: b.w, y: b.h } : { x: 1, y: 30 }, textAutoResize: b ? 'HEIGHT' : 'WIDTH_AND_HEIGHT' });
    else Object.assign(props, { transform: { ...ID, m02: b ? b.x : D.x0, m12: b ? b.y : D.y0 }, size: { x: b ? b.w : 100, y: b ? b.h : 100 } });
    let n = A.doc.create(type, props, A.doc.page);
    if (parent !== A.doc.page) A.doc.reparent(n, parent);
    if (type === 'FRAME' && !b) { n.size = { x: 100, y: 100 }; }
    A.doc.commit(); A.select([n.id]); setTool('move'); afterChange();
    if (type === 'TEXT') startText(n, true);
  }

  // ---------------------------------------------------------------- pluma (VECTOR con vectorNetworkBlob)
  function penClick(x, y) {
    if (!A.pen) A.pen = { pts: [] };
    const P = A.pen.pts;
    if (P.length > 2 && dist(toScreen(...P[0]), toScreen(x, y)) < 8) { finishPen(true); return; }
    P.push([x, y]); render();
  }
  function drawPen() {
    const P = A.pen.pts; if (!P.length) return;
    octx.strokeStyle = '#0d99ff'; octx.lineWidth = 1.5; octx.beginPath();
    P.forEach((p, i) => { const s = toScreen(...p); if (i) octx.lineTo(...s); else octx.moveTo(...s); });
    if (A.pen.mouse) octx.lineTo(...toScreen(...A.pen.mouse)); octx.stroke();
    for (const p of P) { const s = toScreen(...p); octx.fillStyle = '#fff'; octx.fillRect(s[0] - 3, s[1] - 3, 6, 6); octx.strokeRect(s[0] - 3, s[1] - 3, 6, 6); }
  }
  function finishPen(closed) {
    const P = (A.pen && A.pen.pts) || []; A.pen = null;
    if (P.length < 2) { render(); return; }
    const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]), x0 = Math.min(...xs), y0 = Math.min(...ys);
    const w = Math.max(1, Math.max(...xs) - x0), h = Math.max(1, Math.max(...ys) - y0);
    // red vectorial: vértices, segmentos rectos y (si se cerró) una región
    const nv = P.length, ns = closed ? nv : nv - 1, words = [];
    const u32 = (v) => words.push(['u', v]), f32 = (v) => words.push(['f', v]);
    u32(nv); u32(ns); u32(closed ? 1 : 0);
    for (const p of P) { u32(0); f32(p[0] - x0); f32(p[1] - y0); }
    for (let i = 0; i < ns; i++) { u32(0); u32(i); f32(0); f32(0); u32((i + 1) % nv); f32(0); f32(0); }
    if (closed) { u32(0); u32(1); u32(ns); for (let i = 0; i < ns; i++) u32(i); }
    const buf = new DataView(new ArrayBuffer(words.length * 4));
    words.forEach(([t, v], i) => (t === 'u' ? buf.setUint32(i * 4, v, true) : buf.setFloat32(i * 4, v, true)));
    const bytes = new Uint8Array(buf.buffer); let s = ''; for (const b of bytes) s += String.fromCharCode(b);
    A.doc.begin('Pluma');
    A.doc.d.blobs.push({ $b: btoa(s) });
    const n = A.doc.create('VECTOR', { transform: { ...ID, m02: x0, m12: y0 }, size: { x: w, y: h }, vectorData: { vectorNetworkBlob: A.doc.d.blobs.length - 1, normalizedSize: { x: w, y: h } },
      fillPaints: closed ? [FM.solid({ r: 0.85, g: 0.85, b: 0.85 })] : [], strokePaints: [FM.solid({ r: 0, g: 0, b: 0 })], strokeAlign: 'CENTER' });
    A.doc.commit(); A.select([n.id]); setTool('move'); afterChange();
  }

  // ---------------------------------------------------------------- texto en el sitio
  const ta = $('#text-edit');
  function startText(n, fresh) {
    A.editing = { id: n.id, fresh };
    A.doc.begin('Texto');
    placeTextArea(n); ta.value = n.textData?.characters || ''; ta.style.display = 'block'; ta.focus(); ta.select();
    render();
  }
  function placeTextArea(n) {
    const b = A.doc.bounds(n), [x, y] = toScreen(b.x, b.y), k = A.view.k;
    Object.assign(ta.style, { left: x + 'px', top: y + 'px', width: Math.max(20, b.w * k + 4) + 'px', height: Math.max(20, b.h * k + 4) + 'px',
      font: FL.fontCss(n.fontName?.family || 'Inter', n.fontName?.style || 'Regular', (n.fontSize || 12) * k), textAlign: (n.textAlignHorizontal || 'LEFT').toLowerCase() });
  }
  ta.addEventListener('input', () => {
    const n = A.editing && A.doc.node(A.editing.id); if (!n) return;
    n.textData = { characters: ta.value };       // texto nuevo: un solo estilo
    A.doc.reshape(n); A.doc.relayoutUp(n); A.doc.version++; placeTextArea(n); render();
  });
  ta.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); commitText(); } });
  ta.addEventListener('blur', () => commitText());
  function commitText() {
    if (!A.editing) return;
    const n = A.doc.node(A.editing.id); A.editing = null; ta.style.display = 'none';
    if (n && !(n.textData?.characters || '').length) { A.doc.remove(n); A.sel = []; }
    else if (n) { n.name = n.autoRename === false ? n.name : (n.textData.characters.slice(0, 40) || n.name); }
    A.doc.commit(); afterChange();
  }
  A.startText = startText;

  // ---------------------------------------------------------------- herramientas
  function setTool(t) { A.tool = t; $$('#tools [data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t)); stage.classList.toggle('hand', t === 'hand'); if (t !== 'pen' && A.pen) finishPen(false); }
  A.setTool = setTool;
  $$('#tools [data-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));

  // ---------------------------------------------------------------- teclado (atajos de Figma)
  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    const k = e.key, c = e.ctrlKey || e.metaKey, kl = k.toLowerCase();
    if (k === ' ') { space = true; stage.classList.add('hand'); e.preventDefault(); return; }
    if (!A.doc) return;
    if (c && kl === 's') { e.preventDefault(); saveDoc(); return; }
    if (c && kl === 'z') { e.preventDefault(); if (e.shiftKey ? A.doc.redo() : A.doc.undo()) afterChange(); return; }
    if (c && kl === 'y') { e.preventDefault(); if (A.doc.redo()) afterChange(); return; }
    if (c && kl === 'a') { e.preventDefault(); const s = A.selected(), p = s.length ? A.doc.parent(s[0]) : A.doc.page; A.select((p.children || []).map((n) => n.id)); return; }
    if (c && kl === 'd') { e.preventDefault(); duplicate(); return; }
    if (c && kl === 'g' && e.altKey) { e.preventDefault(); const s = topLevelSel(); if (s.length) A.change('Frame', () => { const f = A.doc.wrap(s, 'FRAME'); A.sel = [f.id]; }); return; }
    if (c && kl === 'g') { e.preventDefault(); const s = topLevelSel(); if (!s.length) return; if (e.shiftKey) A.change('Desagrupar', () => { A.sel = s.flatMap((g) => (FM.CONTAINERS.has(g.type) ? A.doc.unwrap(g) : [g])).map((n) => n.id); }); else A.change('Agrupar', () => { const g = A.doc.wrap(s, 'GROUP'); A.sel = [g.id]; }); return; }
    if (c && e.shiftKey && kl === 'h') { e.preventDefault(); A.change('Ocultar', () => { for (const n of A.selected()) n.visible = n.visible === false; }); return; }
    if (c && e.shiftKey && kl === 'l') { e.preventDefault(); A.change('Bloquear', () => { for (const n of A.selected()) n.locked = !n.locked; }); return; }
    if (c && (k === '=' || k === '+')) { e.preventDefault(); zoomAt(A.view.k * 2, ...centerScreen()); return; }
    if (c && k === '-') { e.preventDefault(); zoomAt(A.view.k / 2, ...centerScreen()); return; }
    if (c && k === '0') { e.preventDefault(); zoomAt(1, ...centerScreen()); return; }
    if (c && (k === ']' || k === '[')) { e.preventDefault(); reorder(k === ']' ? 1 : -1, e.altKey || e.shiftKey); return; }
    if (c && kl === 'r') { e.preventDefault(); A.emit('rename'); return; }
    if (e.shiftKey && k === '!') { fitAll(); return; }
    if (e.shiftKey && k === '"') { fitSel(); return; }
    if (e.shiftKey && e.code === 'Digit1') { fitAll(); return; }
    if (e.shiftKey && e.code === 'Digit2') { fitSel(); return; }
    if (e.shiftKey && kl === 'a' && !c) { e.preventDefault(); A.emit('autolayout'); return; }
    if (c) return;
    const T = { v: 'move', f: 'frame', a: 'frame', r: 'rect', o: 'ellipse', l: 'line', p: 'pen', t: 'text', h: 'hand' }[kl];
    if (T && !e.shiftKey && !e.altKey) { setTool(T); return; }
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); const s = topLevelSel(); if (s.length) A.change('Borrar', () => { for (const n of s) A.doc.remove(n); A.sel = []; }, { relayout: false }); return; }
    if (k === 'Enter' && A.pen) { finishPen(false); return; }
    if (k === 'Escape') { if (A.pen) { A.pen = null; render(); return; } const s = A.selected(); if (s.length) { const p = A.doc.parent(s[0]); A.select(p && p.type !== 'CANVAS' ? [p.id] : []); } return; }
    if (k === 'Enter') { e.preventDefault(); const s = A.selected(); if (s.length === 1 && s[0].type === 'TEXT') startText(s[0]); else if (e.shiftKey) { const p = s.length && A.doc.parent(s[0]); if (p && p.type !== 'CANVAS') A.select([p.id]); } else A.select(s.flatMap((n) => (n.children || []).map((k2) => k2.id))); return; }
    const step = e.shiftKey ? 10 : 1;
    const arrows = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[k];
    if (arrows && A.sel.length) { e.preventDefault(); A.change('Mover', () => { for (const n of topLevelSel()) A.doc.translate(n, ...arrows); }); }
  });
  window.addEventListener('keyup', (e) => { if (e.key === ' ') { space = false; stage.classList.toggle('hand', A.tool === 'hand'); } });
  const centerScreen = () => { const r = stage.getBoundingClientRect(); return [r.width / 2, r.height / 2]; };
  function duplicate() {
    const s = topLevelSel(); if (!s.length) return;
    A.change('Duplicar', () => {
      const out = [];
      for (const n of s) { const c = A.doc.clone(n), p = A.doc.parent(n); p.children.splice(p.children.indexOf(n) + 1, 0, c); out.push(c); }
      A.doc.reindex(); for (const c of out) if (!(A.doc.parent(c).stackMode && A.doc.parent(c).stackMode !== 'NONE')) A.doc.translate(c, 10, 10);
      A.sel = out.map((c) => c.id);
    });
  }
  function reorder(dir, toEnd) {
    const s = topLevelSel(); if (!s.length) return;
    A.change('Orden', () => {
      for (const n of dir > 0 ? s.slice().reverse() : s) {
        const p = A.doc.parent(n), L = p.children, i = L.indexOf(n); L.splice(i, 1);
        L.splice(toEnd ? (dir > 0 ? L.length : 0) : Math.max(0, Math.min(L.length, i + dir)), 0, n);
      }
    });
  }
  A.reorder = reorder; A.duplicate = duplicate;

  // ---------------------------------------------------------------- portapapeles (formato de Figma en los dos sentidos)
  const exportJson = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k === '_geo' || k === '_geoKey' || k === '_u8' ? undefined : v)));
  // nodos seleccionados con su transformación absoluta (para pegar en el sitio)
  // textos sin glifos de Figma (creados o editados aquí): su maquetación, para que el servidor genere los glifos (Figma no los maqueta al pegar)
  function glyphLayouts(src, dst) {
    if (src.type === 'TEXT' && !src.derivedTextData && (src.textData?.characters || '').length) {
      const L = FL.layoutText(src), si = FL.styleInfo(src.fontName?.style);
      dst.__glyphLayout = { chars: L.chars, lines: L.lines, styles: L.styles, w: L.w, h: L.h, weight: si.weight, italic: si.italic };
    }
    (src.children || []).forEach((k, i) => dst.children && glyphLayouts(k, dst.children[i]));
  }
  function selectionForExport() {
    return topLevelSel().map((n) => { const c = exportJson(n), M = A.doc.abs(n); c.transform = { m00: M[0], m10: M[1], m01: M[2], m11: M[3], m02: M[4], m12: M[5] }; glyphLayouts(n, c); return c; });
  }
  A.selectionForExport = selectionForExport;
  async function figmaHtml(nodes) {
    const r = await fetch('/api/fig/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'clipboard', doc: { ...exportJson(A.doc.d), pages: [] }, nodes }) });
    if (!r.ok) throw new Error('export ' + r.status);
    return (await r.json()).html;
  }
  async function copy(cut) {
    const nodes = selectionForExport(); if (!nodes.length) return;
    A.clip = nodes;
    try {
      const html = figmaHtml(nodes).then((h) => new Blob([h], { type: 'text/html' }));
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': html, 'text/plain': new Blob([nodes.map((n) => n.name).join('\n')], { type: 'text/plain' }) })]);
      toast(cut ? 'Cortado' : 'Copiado (también se pega en Figma)');
    } catch (e) { toast('Copiado solo aquí: ' + (e.message || e), 'err'); }
    if (cut) A.change('Cortar', () => { for (const n of topLevelSel()) A.doc.remove(n); A.sel = []; }, { relayout: false });
  }
  A.copy = copy;
  document.addEventListener('copy', (e) => { if (e.target.closest && e.target.closest('input, textarea')) return; e.preventDefault(); copy(false); });
  document.addEventListener('cut', (e) => { if (e.target.closest && e.target.closest('input, textarea')) return; e.preventDefault(); copy(true); });
  document.addEventListener('paste', async (e) => {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const file = [...e.clipboardData.files || []].find((f) => f.type.startsWith('image/'));
    if (html && html.includes('(figma)')) await pasteFigma(html);
    else if (file) await placeImage(file);
    else if (A.clip) pasteNodes(A.clip, A.doc.d.blobs, true);
  });
  // fragmento importado (doc del servidor) -> nodos dentro del documento (blobs remapeados)
  async function pasteFigma(html) {
    const r = await fetch('/api/fig/import', { method: 'POST', body: html });
    if (!r.ok) { toast('No se pudo pegar: ' + ((await r.json().catch(() => ({}))).error || r.status), 'err'); return; }
    const frag = await r.json();
    if (!A.doc.d.schema && frag.schema) A.doc.d.schema = frag.schema;   // el esquema que vino con los datos (campos que Figma usa)
    const nodes = frag.pages.flatMap((p) => p.children || []);
    pasteNodes(nodes, frag.blobs, false);
  }
  function pasteNodes(nodes, blobs, own) {
    if (!nodes.length) return;
    A.doc.begin('Pegar');
    let off = 0;
    if (!own) { off = A.doc.d.blobs.length; A.doc.d.blobs.push(...blobs); }
    const keys = new Set(['commandsBlob', 'vectorNetworkBlob', 'dataBlob']);
    const shift = (o) => { if (Array.isArray(o)) return o.forEach(shift); if (!o || typeof o !== 'object' || o.$b) return; for (const [k, v] of Object.entries(o)) { if (keys.has(k) && typeof v === 'number') o[k] = v + off; else shift(v); } };
    const target = (() => { const s = A.selected(); if (s.length === 1 && FM.CONTAINERS.has(s[0].type) && !FR.isGroup(s[0])) return s[0]; if (s.length) return A.doc.parent(s[0]); return A.doc.page; })();
    const out = [];
    for (const src of nodes) {
      const n = JSON.parse(JSON.stringify(src)); if (off) shift(n);
      const re = (x) => { x.id = FM.newId(); (x.children || []).forEach(re); }; re(n);
      target.children = target.children || []; target.children.push(n); A.doc.reindex();
      // posición: la misma que tenía (absoluta); si cae fuera de la vista, al centro
      if (target !== A.doc.page) { const PM = A.doc.abs(target), L = FR.mul(FR.inv(PM), FR.mat(n.transform)); n.transform = { m00: L[0], m10: L[1], m01: L[2], m11: L[3], m02: L[4], m12: L[5] }; }
      if (own) A.doc.translate(n, 10, 10);
      out.push(n);
    }
    const vb = viewBounds(), bb = FM.union(out.map((n) => A.doc.bounds(n)));
    if (!(bb.x < vb.x + vb.w && bb.x + bb.w > vb.x && bb.y < vb.y + vb.h && bb.y + bb.h > vb.y)) for (const n of out) A.doc.translate(n, vb.x + vb.w / 2 - bb.x - bb.w / 2, vb.y + vb.h / 2 - bb.y - bb.h / 2);
    A.doc.relayoutUp(target);
    A.doc.commit(); A.select(out.map((n) => n.id)); afterChange();
  }
  const viewBounds = () => { const r = stage.getBoundingClientRect(), [x0, y0] = toDesign(0, 0), [x1, y1] = toDesign(r.width, r.height); return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; };
  A.pasteFigma = pasteFigma;

  // imágenes: suben al servidor (sha1) y se colocan como rectángulo con relleno de imagen
  async function uploadImage(file) {
    const r = await fetch('/api/fig/upload', { method: 'POST', body: file });
    if (!r.ok) throw new Error('subida ' + r.status);
    return r.json();   // { hash, w, h }
  }
  async function placeImage(file, at) {
    try {
      const { hash, w, h } = await uploadImage(file), hb = hexBytes(hash);
      const k = Math.min(1, 800 / Math.max(w, h)), vb = viewBounds(), [x, y] = at || [vb.x + vb.w / 2 - w * k / 2, vb.y + vb.h / 2 - h * k / 2];
      A.doc.begin('Imagen');
      const n = A.doc.create('ROUNDED_RECTANGLE', { name: file.name || 'Image', transform: { ...ID, m02: x, m12: y }, size: { x: w * k, y: h * k },
        fillPaints: [{ type: 'IMAGE', image: { hash: hb, name: '' }, imageThumbnail: { hash: hb, name: '' }, imageScaleMode: 'FILL', originalImageWidth: w, originalImageHeight: h,
          opacity: 1, visible: true, blendMode: 'NORMAL', transform: { ...ID }, scale: 1 }] });
      A.doc.commit(); A.select([n.id]); afterChange();
    } catch (e) { toast('No se pudo subir la imagen: ' + e.message, 'err'); }
  }
  const hexBytes = (h) => ({ $b: btoa(String.fromCharCode(...h.match(/../g).map((x) => parseInt(x, 16)))) });
  A.uploadImage = uploadImage; A.hexBytes = hexBytes; A.placeImage = placeImage;

  // ---------------------------------------------------------------- archivos: soltar .fig / imágenes, abrir, exportar
  stage.addEventListener('dragover', (e) => { e.preventDefault(); stage.classList.add('dropping'); });
  stage.addEventListener('dragleave', () => stage.classList.remove('dropping'));
  stage.addEventListener('drop', async (e) => {
    e.preventDefault(); stage.classList.remove('dropping');
    const [sx, sy] = pos(e), at = toDesign(sx, sy);
    for (const f of e.dataTransfer.files) {
      if (/\.fig$/i.test(f.name)) await importFig(f);
      else if (/\.figdoc\.json$/i.test(f.name)) setDoc(JSON.parse(await f.text()));
      else if (f.type.startsWith('image/')) await placeImage(f, at);
    }
  });
  async function importFig(file) {
    toast('Importando ' + file.name + '…');
    const r = await fetch('/api/fig/import?name=' + encodeURIComponent(file.name.replace(/\.fig$/i, '')), { method: 'POST', body: file });
    if (!r.ok) { toast('No se pudo importar: ' + ((await r.json().catch(() => ({}))).error || r.status), 'err'); return; }
    const d = await r.json(); setDoc(d); A.doc.dirty = true; saveDoc(true);
  }
  A.importFig = importFig;
  async function exportFig() {
    const r = await fetch('/api/fig/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'fig', doc: exportJson(A.doc.d) }) });
    if (!r.ok) { toast('No se pudo exportar', 'err'); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = (A.doc.d.name || 'Fig') + '.fig'; a.click();
  }
  A.exportFig = exportFig;
  // PNG de la selección con el propio render
  A.exportPng = function (scale = 2) {
    const s = A.selected(); if (!s.length) return;
    const b = FM.union(s.map((n) => A.doc.bounds(n))), c = document.createElement('canvas');
    c.width = Math.ceil(b.w * scale); c.height = Math.ceil(b.h * scale);
    const x = c.getContext('2d'), R2 = { ...RC, W: c.width, H: c.height, pool: [] };
    FR.renderNodes(x, s.map((n) => ({ ...n, transform: (() => { const M = A.doc.abs(n); return { m00: M[0], m10: M[1], m01: M[2], m11: M[3], m02: M[4], m12: M[5] }; })() })), [scale, 0, 0, scale, -b.x * scale, -b.y * scale], R2);
    c.toBlob((bl) => { const a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = (s[0].name || 'export') + '.png'; a.click(); });
  };
  $('#file-in').addEventListener('change', async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; if (/\.fig$/i.test(f.name)) importFig(f); else if (f.type.startsWith('image/')) placeImage(f); else if (/json$/.test(f.name)) setDoc(JSON.parse(await f.text())); });
  $('#share-btn').addEventListener('click', () => { if (!A.sel.length) { toast('Selecciona algo para copiarlo a Figma'); return; } copy(false); });
  $('#doc-name').addEventListener('change', () => { if (A.doc) { A.doc.d.name = $('#doc-name').value; A.doc.dirty = true; saveDoc(true); } });
  $('#zoom-lab').addEventListener('click', () => zoomAt(1, ...centerScreen()));

  // ---------------------------------------------------------------- menú
  async function openMenu() {
    const m = $('#menu'), docs = await fetch('/api/fig/docs').then((r) => r.json()).catch(() => []);
    const item = (label, fn, key = '') => { const d = document.createElement('div'); d.className = 'mi'; d.innerHTML = `<span></span><span class="k">${key}</span>`; d.firstChild.textContent = label; d.onclick = () => { m.classList.add('hidden'); fn(); }; return d; };
    m.innerHTML = '';
    m.append(item('Nuevo documento', () => setDoc(EMPTY())), item('Importar .fig o imagen…', () => $('#file-in').click()), item('Guardar', () => saveDoc(), 'Ctrl+S'),
      item('Descargar .fig (abrir en Figma)', exportFig), item('Copiar selección para Figma', () => copy(false), 'Ctrl+C'), item('Exportar selección a PNG', () => A.exportPng(2)));
    const hr = document.createElement('hr'); m.append(hr);
    const pl = document.createElement('div'); pl.className = 'mt'; pl.textContent = 'Plugins'; m.append(pl);
    for (const p of (window.FigPlugins.list ? await window.FigPlugins.list() : [])) m.append(item(p.name, () => window.FigPlugins.run(p.id)));
    m.append(item('Instalar plugin (carpeta con manifest.json)…', () => window.FigPlugins.install && window.FigPlugins.install()));
    if (docs.length) { m.append(document.createElement('hr')); const t = document.createElement('div'); t.className = 'mt'; t.textContent = 'Abrir'; m.append(t); for (const d of docs.slice(0, 14)) m.append(item(d.name, () => openDoc(d.name))); }
    const r = $('#menu-btn').getBoundingClientRect(); m.style.left = r.left + 'px'; m.style.top = r.bottom + 4 + 'px'; m.classList.remove('hidden');
  }
  $('#menu-btn').addEventListener('click', (e) => { e.stopPropagation(); if ($('#menu').classList.contains('hidden')) openMenu(); else $('#menu').classList.add('hidden'); });
  $('#plugins-btn').addEventListener('click', (e) => { e.stopPropagation(); openMenu(); });
  document.addEventListener('click', (e) => { if (!e.target.closest('#menu')) $('#menu').classList.add('hidden'); });

  // ---------------------------------------------------------------- arranque
  window.addEventListener('resize', resize);
  new ResizeObserver(resize).observe(stage);
  window.addEventListener('beforeunload', (e) => { if (A.doc && A.doc.dirty) { saveDoc(true); } });
  (async () => {
    resize();
    const name = new URLSearchParams(location.search).get('doc');
    if (name) await openDoc(name); else setDoc(EMPTY());
    window.FigPlugins.init && window.FigPlugins.init(A);
  })();
})();
