/* Fig — modelo: documento de Figma (nodos kiwi en árbol, ver studio/figdoc.mjs) + operaciones de edición + deshacer.
   Al cambiar la forma o el texto de un nodo se borra lo que Figma había precalculado (fillGeometry, strokeGeometry,
   derivedTextData): el render lo recalcula y, al pegar en Figma, Figma también. */
(function (root) {
  'use strict';
  const R = () => root.FigRender, LT = () => root.FigLayout;
  const ID = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 };
  let seq = 1;
  const newId = () => `u${Date.now().toString(36)}:${seq++}`;
  const CONTAINERS = new Set(['FRAME', 'GROUP', 'COMPONENT', 'INSTANCE', 'SYMBOL', 'SECTION', 'COMPONENT_SET', 'BOOLEAN_OPERATION']);

  class Doc {
    constructor(json) {
      this.d = json; this.page = json.pages[0]; this.parents = new Map(); this.reindex();
      this.undoStack = []; this.redoStack = []; this.version = 1; this.dirty = false;
    }
    // ---------------------------------------------------------------- árbol
    reindex() {
      this.parents.clear(); this.byId = new Map();
      const walk = (n, p) => { this.byId.set(n.id, n); if (p) this.parents.set(n.id, p); for (const k of n.children || []) walk(k, n); };
      for (const pg of this.d.pages) walk(pg, null);
    }
    node(id) { return this.byId.get(id); }
    parent(n) { return this.parents.get(n.id) || null; }
    isContainer(n) { return CONTAINERS.has(n.type) || n.type === 'CANVAS'; }
    pageOf(n) { let p = n; while (p && p.type !== 'CANVAS') p = this.parent(p); return p; }
    ancestors(n) { const out = []; let p = this.parent(n); while (p && p.type !== 'CANVAS') { out.push(p); p = this.parent(p); } return out; }
    // matriz absoluta (diseño de la página) de n
    abs(n) { let M = R().mat(n.transform); let p = this.parent(n); while (p && p.type !== 'CANVAS') { M = R().mul(R().mat(p.transform), M); p = this.parent(p); } return M; }
    // caja (AABB) en coordenadas de página
    bounds(n) {
      const M = this.abs(n), w = n.size?.x || 0, h = n.size?.y || 0;
      const pts = [[0, 0], [w, 0], [0, h], [w, h]].map(([x, y]) => R().app(M, x, y));
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), M };
    }
    // ¿punto (página) dentro de n? (su forma, o su caja si es un contenedor)
    hits(n, x, y, ctx) {
      const M = this.abs(n), I = R().inv(M), [lx, ly] = R().app(I, x, y), w = n.size?.x || 0, h = n.size?.y || 0;
      if (lx < -2 || ly < -2 || lx > w + 2 || ly > h + 2) return false;
      if (n.type === 'TEXT' || this.isContainer(n)) return true;
      const geo = R().geometryOf(n, this.renderCtx || { doc: this.d, version: this.version });
      for (const g of geo.fill) if (ctx.isPointInPath(g.path, lx, ly, g.rule)) return true;
      if (geo.stroke) for (const g of geo.stroke) if (ctx.isPointInPath(g.path, lx, ly, g.rule)) return true;
      if ((n.strokePaints || []).length) { ctx.lineWidth = Math.max(6, n.strokeWeight || 1); for (const g of geo.fill) if (ctx.isPointInStroke(g.path, lx, ly)) return true; }
      return false;
    }
    // nodo más profundo bajo el punto (de arriba abajo), ignorando ocultos y bloqueados
    deepestAt(x, y, ctx, list = this.page.children, clipOk = true) {
      for (let i = (list || []).length - 1; i >= 0; i--) {
        const n = list[i];
        if (n.visible === false || n.locked) continue;
        const inside = this.hits(n, x, y, ctx);
        const clips = R().clips(n);
        if (n.children && n.children.length && (inside || !clips)) { const d = this.deepestAt(x, y, ctx, n.children); if (d) return d; }
        if (inside && !R().isGroup(n)) return n;
      }
      return null;
    }
    // ---------------------------------------------------------------- deshacer (instantáneas de las páginas; los blobs solo crecen)
    snapshot() { return JSON.stringify(this.d.pages, (k, v) => (k === '_geo' || k === '_geoKey' ? undefined : v)); }
    begin(label) { this.undoStack.push({ label, s: this.snapshot(), page: this.page.id }); if (this.undoStack.length > 80) this.undoStack.shift(); this.redoStack = []; }
    commit() { this.version++; this.dirty = true; this.reindex(); }
    restore(entry) { this.d.pages = JSON.parse(entry.s); this.reindex(); this.page = this.d.pages.find((p) => p.id === entry.page) || this.d.pages[0]; this.version++; this.dirty = true; }
    undo() { const e = this.undoStack.pop(); if (!e) return false; this.redoStack.push({ label: e.label, s: this.snapshot(), page: this.page.id }); this.restore(e); return true; }
    redo() { const e = this.redoStack.pop(); if (!e) return false; this.undoStack.push({ label: e.label, s: this.snapshot(), page: this.page.id }); this.restore(e); return true; }
    // ---------------------------------------------------------------- cambios
    // forma cambiada: fuera la geometría precalculada de Figma
    reshape(n) { delete n.fillGeometry; delete n.strokeGeometry; n._geo = null; if (n.type === 'TEXT') delete n.derivedTextData; }
    relayoutUp(n) {   // auto layout del padre (y hacia arriba mientras cambien tamaños)
      let p = n.type === 'CANVAS' ? null : this.parent(n);
      LT().fitText(n); if (n.stackMode) LT().stack(n);
      while (p && p.type !== 'CANVAS') { if (!p.stackMode || p.stackMode === 'NONE') break; LT().stack(p); this.reshape(p); p = this.parent(p); }
    }
    create(type, props = {}, parent = this.page, index = null) {
      const base = { id: newId(), type, name: props.name || NAMES[type] || type, visible: true, opacity: 1, transform: { ...ID }, size: { x: 100, y: 100 },
        strokeWeight: 1, strokeAlign: type === 'LINE' ? 'CENTER' : 'INSIDE', strokeJoin: 'MITER', fillPaints: [], strokePaints: [] };
      if (type === 'FRAME') Object.assign(base, { fillPaints: [solid({ r: 1, g: 1, b: 1 })], frameMaskDisabled: false });
      if (type === 'ROUNDED_RECTANGLE' || type === 'ELLIPSE' || type === 'VECTOR') base.fillPaints = [solid({ r: 0.85, g: 0.85, b: 0.85 })];
      if (type === 'LINE') base.strokePaints = [solid({ r: 0, g: 0, b: 0 })];
      if (type === 'TEXT') Object.assign(base, { fillPaints: [solid({ r: 0, g: 0, b: 0 })], fontName: { family: 'Inter', style: 'Regular', postscript: '' }, fontSize: 24,
        textData: { characters: '' }, textAutoResize: 'WIDTH_AND_HEIGHT', textAlignHorizontal: 'LEFT', textAlignVertical: 'TOP',
        lineHeight: { value: 100, units: 'PERCENT' }, letterSpacing: { value: 0, units: 'PERCENT' } });
      if (type === 'GROUP') delete base.fillPaints;
      const n = Object.assign(base, props, { children: CONTAINERS.has(type) ? (props.children || []) : undefined });
      if (!n.children) delete n.children;
      const list = parent.children || (parent.children = []);
      list.splice(index == null ? list.length : index, 0, n);
      this.parents.set(n.id, parent); this.byId.set(n.id, n);
      return n;
    }
    remove(n) { const p = this.parent(n); if (!p) return; p.children.splice(p.children.indexOf(n), 1); this.relayoutUp(p); }
    // mover n a otro padre conservando su posición en pantalla
    reparent(n, np, index = null) {
      const A = this.abs(n), op = this.parent(n);
      op.children.splice(op.children.indexOf(n), 1);
      const PM = np.type === 'CANVAS' ? [1, 0, 0, 1, 0, 0] : this.abs(np), L = R().mul(R().inv(PM), A);
      n.transform = { m00: L[0], m10: L[1], m01: L[2], m11: L[3], m02: L[4], m12: L[5] };
      const list = np.children || (np.children = []);
      list.splice(index == null ? list.length : Math.min(index, list.length), 0, n);
      this.parents.set(n.id, np);
      if (op !== np) this.relayoutUp(op);
      this.relayoutUp(np);
    }
    // desplazar en coordenadas de página
    translate(n, dx, dy) {
      const p = this.parent(n), PM = p && p.type !== 'CANVAS' ? this.abs(p) : [1, 0, 0, 1, 0, 0], I = R().inv(PM);
      const v = [I[0] * dx + I[2] * dy, I[1] * dx + I[3] * dy];
      n.transform = { ...(n.transform || ID), m02: (n.transform?.m02 || 0) + v[0], m12: (n.transform?.m12 || 0) + v[1] };
    }
    // nueva caja local (x, y en el espacio del padre, sin giro) — para redimensionar
    setBox(n, x, y, w, h) {
      const t = n.transform || ID;
      const ow = n.size?.x || 0, oh = n.size?.y || 0, sx = ow ? w / ow : 1, sy = oh ? h / oh : 1;
      n.transform = { ...t, m02: x, m12: y };
      n.size = { x: Math.max(0.01, w), y: Math.max(0.01, h) };
      if (n.type === 'TEXT' && n.textAutoResize === 'WIDTH_AND_HEIGHT' && Math.abs(sx - 1) > 1e-6) n.textAutoResize = 'HEIGHT';
      if (n.type === 'TEXT' && Math.abs(sy - 1) > 1e-6 && n.textAutoResize !== 'NONE') n.textAutoResize = 'NONE';
      this.reshape(n);
      // hijos sin auto layout: escalar según sus restricciones (SCALE / STRETCH / MAX / CENTER)
      if ((n.children || []).length && !(n.stackMode && n.stackMode !== 'NONE')) for (const k of n.children) constrain(k, ow, oh, w, h, this);
      this.relayoutUp(n);
    }
    rotation(n) { const t = n.transform || ID; return Math.atan2(t.m10, t.m00) * 180 / Math.PI; }
    // girar alrededor del centro del nodo
    rotateTo(n, deg) {
      const t = n.transform || ID, w = n.size?.x || 0, h = n.size?.y || 0;
      const cx = t.m00 * w / 2 + t.m01 * h / 2 + t.m02, cy = t.m10 * w / 2 + t.m11 * h / 2 + t.m12;
      const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      n.transform = { m00: c, m01: -s, m10: s, m11: c, m02: cx - (c * w / 2 - s * h / 2), m12: cy - (s * w / 2 + c * h / 2) };
    }
    // agrupar / envolver en frame
    // type 'GROUP' -> como Figma: FRAME con resizeToFit (sin relleno, sin recorte, abraza a los hijos)
    wrap(nodes, type = 'GROUP') {
      if (!nodes.length) return null;
      const p = this.parent(nodes[0]), idx = Math.max(...nodes.map((n) => p.children.indexOf(n)));
      const bb = union(nodes.map((n) => this.bounds(n)));
      const PM = p.type === 'CANVAS' ? [1, 0, 0, 1, 0, 0] : this.abs(p), I = R().inv(PM), [lx, ly] = R().app(I, bb.x, bb.y);
      const g = this.create('FRAME', { name: type === 'GROUP' ? 'Group' : 'Frame', transform: { ...ID, m02: lx, m12: ly }, size: { x: bb.w, y: bb.h }, fillPaints: [],
        ...(type === 'GROUP' ? { resizeToFit: true, frameMaskDisabled: false } : { frameMaskDisabled: true }) }, p, idx + 1);
      const order = nodes.slice().sort((a, b) => p.children.indexOf(a) - p.children.indexOf(b));
      for (const n of order) this.reparent(n, g);
      return g;
    }
    unwrap(g) {
      const p = this.parent(g), idx = p.children.indexOf(g), kids = [...(g.children || [])];
      kids.forEach((k, i) => this.reparent(k, p, idx + i));
      p.children.splice(p.children.indexOf(g), 1);
      return kids;
    }
    // copia profunda con ids nuevos (y relaciones de estilo intactas)
    clone(n) { const c = JSON.parse(JSON.stringify(n, (k, v) => (k === '_geo' || k === '_geoKey' ? undefined : v))); const re = (x) => { x.id = newId(); (x.children || []).forEach(re); }; re(c); return c; }
    insertTree(n, parent, index = null) {
      const list = parent.children || (parent.children = []);
      list.splice(index == null ? list.length : index, 0, n); this.reindex(); this.relayoutUp(parent);
    }
    // grupos: su caja abraza a los hijos (Figma)
    fitGroups(n) {
      let p = n; while (p && p.type !== 'CANVAS') {
        if (R().isGroup(p)) {
          const kids = p.children || []; if (kids.length) {
            const bb = union(kids.map((k) => this.bounds(k))), pp = this.parent(p), PM = pp.type === 'CANVAS' ? [1, 0, 0, 1, 0, 0] : this.abs(pp), I = R().inv(PM);
            const old = this.abs(p), [lx, ly] = R().app(I, bb.x, bb.y);
            p.transform = { ...ID, m02: lx, m12: ly }; p.size = { x: bb.w, y: bb.h };
            const NI = R().inv(this.abs(p));
            for (const k of kids) { const L = R().mul(NI, R().mul(old, R().mat(k.transform))); k.transform = { m00: L[0], m10: L[1], m01: L[2], m11: L[3], m02: L[4], m12: L[5] }; }
          }
        }
        p = this.parent(p);
      }
    }
  }
  const NAMES = { FRAME: 'Frame', ROUNDED_RECTANGLE: 'Rectangle', ELLIPSE: 'Ellipse', LINE: 'Line', TEXT: 'Text', VECTOR: 'Vector', GROUP: 'Group' };
  const solid = (c, op = 1) => ({ type: 'SOLID', color: { ...c, a: 1 }, opacity: op, visible: true, blendMode: 'NORMAL' });
  const union = (bs) => { const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y)); return { x, y, w: Math.max(...bs.map((b) => b.x + b.w)) - x, h: Math.max(...bs.map((b) => b.y + b.h)) - y }; };
  // restricciones de Figma al redimensionar el padre
  function constrain(k, ow, oh, w, h, doc) {
    const t = k.transform || ID, kw = k.size?.x || 0, kh = k.size?.y || 0;
    const ax = (c, pos, size, o, n) => {
      if (c === 'MAX') return [pos + (n - o), size];
      if (c === 'CENTER') return [pos + (n - o) / 2, size];
      if (c === 'STRETCH') return [pos, Math.max(0.01, size + (n - o))];
      if (c === 'SCALE') { const s = o ? n / o : 1; return [pos * s, size * s]; }
      return [pos, size];
    };
    const [x, nw] = ax(k.horizontalConstraint, t.m02, kw, ow, w), [y, nh] = ax(k.verticalConstraint, t.m12, kh, oh, h);
    if (x !== t.m02 || y !== t.m12 || nw !== kw || nh !== kh) {
      const sw = kw ? nw / kw : 1, sh = kh ? nh / kh : 1;
      k.transform = { ...t, m02: x, m12: y }; k.size = { x: nw, y: nh };
      if (nw !== kw || nh !== kh) { doc.reshape(k); if ((k.children || []).length && !(k.stackMode && k.stackMode !== 'NONE')) for (const c of k.children) constrain(c, kw, kh, nw, nh, doc); }
      void sw; void sh;
    }
  }
  root.FigModel = { Doc, solid, union, newId, CONTAINERS, NAMES };
})(typeof self !== 'undefined' ? self : this);
