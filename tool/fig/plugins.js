/* Fig — plugins con la API de Figma (figma.*). Un plugin de Figma es una carpeta con manifest.json + code.js (+ ui.html).
   code.js corre en un iframe oculto del mismo origen (global propio, acceso síncrono al documento como en Figma) con
   `figma`, `__html__` y `__uiFiles__`; la UI va en otro iframe y habla con postMessage({ pluginMessage }), igual que en Figma.
   Los nodos que ve el plugin son envoltorios sobre los nodos kiwi del documento: las propiedades de la API de plugins
   (fills, x, layoutMode, characters…) se traducen a los campos de Figma (fillPaints, transform, stackMode, textData…).
   Los cambios hechos en el mismo tick se agrupan en un solo paso de deshacer. */
(function (root) {
  'use strict';
  let A = null;
  const FM = () => root.FigModel, FR = () => root.FigRender, FL = () => root.FigLayout;
  const MIXED = Symbol('figma.mixed');
  const ID = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 };
  const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));

  // ---------------------------------------------------------------- SHA-1 síncrono (figma.createImage devuelve el hash al momento)
  function sha1(bytes) {
    const rotl = (x, n) => (x << n) | (x >>> (32 - n)), l = bytes.length, words = ((l + 8) >> 6) + 1, W = new Uint32Array(words * 16);
    for (let i = 0; i < l; i++) W[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
    W[l >> 2] |= 0x80 << (24 - (l % 4) * 8); W[words * 16 - 1] = l * 8;
    let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
    const w = new Uint32Array(80);
    for (let b = 0; b < W.length; b += 16) {
      for (let t = 0; t < 16; t++) w[t] = W[b + t];
      for (let t = 16; t < 80; t++) w[t] = rotl(w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16], 1);
      let a = h0, bb = h1, c = h2, d = h3, e = h4;
      for (let t = 0; t < 80; t++) {
        const f = t < 20 ? (bb & c) | (~bb & d) : t < 40 ? bb ^ c ^ d : t < 60 ? (bb & c) | (bb & d) | (c & d) : bb ^ c ^ d;
        const k = t < 20 ? 0x5a827999 : t < 40 ? 0x6ed9eba1 : t < 60 ? 0x8f1bbcdc : 0xca62c1d6;
        const tmp = (rotl(a, 5) + f + e + k + w[t]) >>> 0; e = d; d = c; c = rotl(bb, 30) >>> 0; bb = a; a = tmp;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + bb) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
    }
    return [h0, h1, h2, h3, h4].map((x) => x.toString(16).padStart(8, '0')).join('');
  }
  const b64enc = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const b64dec = (s) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const hexOfHash = (h) => FR().hexOf(h);
  const hashBytes = (hex) => ({ $b: b64enc(new Uint8Array(hex.match(/../g).map((x) => parseInt(x, 16)))) });
  const IMAGES = new Map();   // hash -> bytes (de createImage, hasta que se suben)
  function imageObj(hash) {
    return { hash, async getBytesAsync() { if (IMAGES.has(hash)) return IMAGES.get(hash); return new Uint8Array(await (await fetch('/api/fig/image/' + hash)).arrayBuffer()); },
      async getSizeAsync() { const bm = await createImageBitmap(new Blob([await this.getBytesAsync()])); return { width: bm.width, height: bm.height }; } };
  }

  // ---------------------------------------------------------------- pinturas y efectos: API de plugins <-> kiwi
  const SCALE_IN = { FILL: 'FILL', FIT: 'FIT', CROP: 'STRETCH', TILE: 'TILE' }, SCALE_OUT = { FILL: 'FILL', FIT: 'FIT', STRETCH: 'CROP', TILE: 'TILE' };
  const m2 = (t) => [[t.m00, t.m01, t.m02], [t.m10, t.m11, t.m12]], m6 = (a) => ({ m00: a[0][0], m01: a[0][1], m02: a[0][2], m10: a[1][0], m11: a[1][1], m12: a[1][2] });
  function paintOut(p) {
    const base = { type: p.type, visible: p.visible !== false, opacity: p.opacity ?? 1, blendMode: p.blendMode || 'NORMAL' };
    if (p.type === 'SOLID') return Object.freeze({ ...base, color: { r: p.color.r, g: p.color.g, b: p.color.b }, opacity: (p.opacity ?? 1) * (p.color.a ?? 1) });
    if (p.type.startsWith('GRADIENT')) return Object.freeze({ ...base, gradientStops: (p.stops || []).map((s) => ({ position: s.position, color: { ...s.color } })), gradientTransform: m2(p.transform || ID) });
    if (p.type === 'IMAGE') return Object.freeze({ ...base, scaleMode: SCALE_OUT[p.imageScaleMode || 'FILL'], imageHash: p.image?.hash ? hexOfHash(p.image.hash) : null,
      imageTransform: m2(p.transform || ID), scalingFactor: p.scale ?? 1, rotation: p.rotation || 0, filters: { exposure: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, highlights: 0, shadows: 0, ...(p.paintFilter || {}) } });
    return Object.freeze({ ...base });
  }
  function paintIn(p) {
    const base = { type: p.type, visible: p.visible !== false, opacity: p.opacity ?? 1, blendMode: p.blendMode || 'NORMAL' };
    if (p.type === 'SOLID') return { ...base, color: { r: p.color.r, g: p.color.g, b: p.color.b, a: 1 } };
    if (p.type.startsWith('GRADIENT')) return { ...base, stops: (p.gradientStops || []).map((s) => ({ position: s.position, color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a ?? 1 } })), transform: m6(p.gradientTransform || [[1, 0, 0], [0, 1, 0]]) };
    if (p.type === 'IMAGE') {
      const hb = p.imageHash ? hashBytes(p.imageHash) : null;
      return { ...base, imageScaleMode: SCALE_IN[p.scaleMode || 'FILL'], ...(hb ? { image: { hash: hb, name: '' }, imageThumbnail: { hash: hb, name: '' } } : {}),
        transform: m6(p.imageTransform || [[1, 0, 0], [0, 1, 0]]), scale: p.scalingFactor ?? 1, rotation: p.rotation || 0, ...(p.filters ? { paintFilter: { ...p.filters } } : {}) };
    }
    return { ...base };
  }
  const FX_OUT = { FOREGROUND_BLUR: 'LAYER_BLUR' }, FX_IN = { LAYER_BLUR: 'FOREGROUND_BLUR' };
  const effectOut = (e) => Object.freeze({ ...clone(e), type: FX_OUT[e.type] || e.type, visible: e.visible !== false });
  const effectIn = (e) => ({ ...clone(e), type: FX_IN[e.type] || e.type, visible: e.visible !== false });
  const TYPE_OUT = (n) => (FR().isGroup(n) && n.type === 'FRAME' ? 'GROUP' : n.type === 'ROUNDED_RECTANGLE' ? 'RECTANGLE' : n.type === 'SYMBOL' ? 'COMPONENT' : n.type === 'CANVAS' ? 'PAGE' : n.type);

  // ---------------------------------------------------------------- sesión de plugin
  function Session(plugin) {
    const S = { plugin, wrappers: new WeakMap(), handlers: {}, closed: false, ui: null, pending: false };
    // agrupa los cambios del mismo tick en un paso de deshacer
    const mutate = (fn) => {
      if (S.closed) throw new Error('El plugin está cerrado');
      if (!S.pending) { S.pending = true; A.doc.begin('Plugin: ' + plugin.name); queueMicrotask(flush); }
      const r = fn(); A.doc.version++; return r;
    };
    const flush = () => { if (!S.pending) return; S.pending = false; A.doc.reindex(); A.doc.commit(); A.afterChange(); };
    const wrap = (n) => { if (!n) return null; let w = S.wrappers.get(n); if (!w) { w = makeNode(n); S.wrappers.set(n, w); } return w; };
    const raw = (w) => (w && w.__raw) || null;
    const reshape = (n) => A.doc.reshape(n);

    function makeNode(n) {
      const isText = n.type === 'TEXT', W = { __raw: n };
      const def = (k, get, set) => Object.defineProperty(W, k, { get, set: set ? (v) => mutate(() => set(v)) : undefined, enumerable: true });
      const t = () => n.transform || ID;
      def('id', () => n.id); def('type', () => TYPE_OUT(n)); def('removed', () => !A.doc.node(n.id));
      def('name', () => n.name || '', (v) => { n.name = String(v); n.autoRename = false; });
      def('parent', () => { const p = A.doc.parent(n); return p ? wrap(p) : (n.type === 'CANVAS' ? documentNode() : null); });
      def('visible', () => n.visible !== false, (v) => { n.visible = !!v; });
      def('locked', () => !!n.locked, (v) => { n.locked = !!v; });
      def('opacity', () => n.opacity ?? 1, (v) => { n.opacity = +v; });
      def('blendMode', () => n.blendMode || 'PASS_THROUGH', (v) => { n.blendMode = v; });
      def('isMask', () => !!n.mask, (v) => { n.mask = !!v; });
      def('x', () => t().m02, (v) => { n.transform = { ...t(), m02: +v }; A.doc.relayoutUp(n); });
      def('y', () => t().m12, (v) => { n.transform = { ...t(), m12: +v }; A.doc.relayoutUp(n); });
      def('width', () => n.size?.x || 0); def('height', () => n.size?.y || 0);
      def('rotation', () => -A.doc.rotation(n), (v) => { A.doc.rotateTo(n, -v); });
      def('relativeTransform', () => m2(t()), (v) => { n.transform = m6(v); });
      def('absoluteTransform', () => { const M = A.doc.abs(n); return [[M[0], M[2], M[4]], [M[1], M[3], M[5]]]; });
      def('absoluteBoundingBox', () => { const b = A.doc.bounds(n); return { x: b.x, y: b.y, width: b.w, height: b.h }; });
      def('absoluteRenderBounds', () => { const b = A.doc.bounds(n); return { x: b.x, y: b.y, width: b.w, height: b.h }; });
      W.resize = (w, h) => mutate(() => { const tt = t(); A.doc.setBox(n, tt.m02, tt.m12, Math.max(0.01, w), Math.max(0.01, h)); });
      W.resizeWithoutConstraints = (w, h) => mutate(() => { n.size = { x: Math.max(0.01, w), y: Math.max(0.01, h) }; reshape(n); });
      W.rescale = (k) => mutate(() => { n.size = { x: n.size.x * k, y: n.size.y * k }; reshape(n); });
      // pinturas, bordes, efectos, esquinas
      def('fills', () => (n.fillPaints || []).map(paintOut), (v) => { n.fillPaints = [...v].map(paintIn); });
      def('strokes', () => (n.strokePaints || []).map(paintOut), (v) => { n.strokePaints = [...v].map(paintIn); });
      def('strokeWeight', () => n.strokeWeight ?? 1, (v) => { n.strokeWeight = +v; reshape(n); });
      def('strokeAlign', () => n.strokeAlign || 'INSIDE', (v) => { n.strokeAlign = v; reshape(n); });
      def('strokeJoin', () => n.strokeJoin || 'MITER', (v) => { n.strokeJoin = v; });
      def('strokeCap', () => n.strokeCap || 'NONE', (v) => { n.strokeCap = v; });
      def('dashPattern', () => n.dashPattern || [], (v) => { n.dashPattern = [...v]; reshape(n); });
      def('effects', () => (n.effects || []).map(effectOut), (v) => { n.effects = [...v].map(effectIn); });
      def('cornerRadius', () => { const r = FR().radiiOf(n); return r.every((x) => x === r[0]) ? r[0] : MIXED; }, (v) => { Object.assign(n, { cornerRadius: +v, rectangleCornerRadiiIndependent: false,
        rectangleTopLeftCornerRadius: +v, rectangleTopRightCornerRadius: +v, rectangleBottomLeftCornerRadius: +v, rectangleBottomRightCornerRadius: +v }); reshape(n); });
      [['topLeftRadius', 'rectangleTopLeftCornerRadius'], ['topRightRadius', 'rectangleTopRightCornerRadius'], ['bottomLeftRadius', 'rectangleBottomLeftCornerRadius'], ['bottomRightRadius', 'rectangleBottomRightCornerRadius']]
        .forEach(([k, kk], i) => def(k, () => FR().radiiOf(n)[[0, 1, 3, 2][i]], (v) => { const r = FR().radiiOf(n); n.rectangleTopLeftCornerRadius = r[0]; n.rectangleTopRightCornerRadius = r[1]; n.rectangleBottomRightCornerRadius = r[2]; n.rectangleBottomLeftCornerRadius = r[3]; n[kk] = +v; n.rectangleCornerRadiiIndependent = true; reshape(n); }));
      def('cornerSmoothing', () => n.cornerSmoothing || 0, (v) => { n.cornerSmoothing = +v; reshape(n); });
      def('clipsContent', () => !n.frameMaskDisabled && !n.resizeToFit, (v) => { n.frameMaskDisabled = !v; });
      def('constraints', () => ({ horizontal: n.horizontalConstraint || 'MIN', vertical: n.verticalConstraint || 'MIN' }), (v) => { n.horizontalConstraint = v.horizontal; n.verticalConstraint = v.vertical; });
      // auto layout
      const fit = (v) => v === 'RESIZE_TO_FIT' || v === 'RESIZE_TO_FIT_WITH_IMPLICIT_SIZE';
      const relay = () => { A.doc.relayoutUp(n); };
      def('layoutMode', () => n.stackMode || 'NONE', (v) => { n.stackMode = v; relay(); });
      def('itemSpacing', () => n.stackSpacing || 0, (v) => { n.stackSpacing = +v; relay(); });
      def('counterAxisSpacing', () => n.stackCounterSpacing || 0, (v) => { n.stackCounterSpacing = +v; relay(); });
      def('layoutWrap', () => n.stackWrap || 'NO_WRAP', (v) => { n.stackWrap = v; relay(); });
      def('paddingLeft', () => n.stackHorizontalPadding || 0, (v) => { n.stackHorizontalPadding = +v; relay(); });
      def('paddingTop', () => n.stackVerticalPadding || 0, (v) => { n.stackVerticalPadding = +v; relay(); });
      def('paddingRight', () => n.stackPaddingRight ?? n.stackHorizontalPadding ?? 0, (v) => { n.stackPaddingRight = +v; relay(); });
      def('paddingBottom', () => n.stackPaddingBottom ?? n.stackVerticalPadding ?? 0, (v) => { n.stackPaddingBottom = +v; relay(); });
      def('horizontalPadding', () => n.stackHorizontalPadding || 0, (v) => { n.stackHorizontalPadding = n.stackPaddingRight = +v; relay(); });
      def('verticalPadding', () => n.stackVerticalPadding || 0, (v) => { n.stackVerticalPadding = n.stackPaddingBottom = +v; relay(); });
      def('primaryAxisAlignItems', () => n.stackPrimaryAlignItems || 'MIN', (v) => { n.stackPrimaryAlignItems = v; relay(); });
      def('counterAxisAlignItems', () => n.stackCounterAlignItems || 'MIN', (v) => { n.stackCounterAlignItems = v; relay(); });
      def('primaryAxisSizingMode', () => (fit(n.stackPrimarySizing) ? 'AUTO' : 'FIXED'), (v) => { n.stackPrimarySizing = v === 'AUTO' ? 'RESIZE_TO_FIT_WITH_IMPLICIT_SIZE' : 'FIXED'; relay(); });
      def('counterAxisSizingMode', () => (fit(n.stackCounterSizing) ? 'AUTO' : 'FIXED'), (v) => { n.stackCounterSizing = v === 'AUTO' ? 'RESIZE_TO_FIT_WITH_IMPLICIT_SIZE' : 'FIXED'; relay(); });
      def('layoutGrow', () => n.stackChildPrimaryGrow || 0, (v) => { n.stackChildPrimaryGrow = +v; A.doc.relayoutUp(n); });
      def('layoutAlign', () => (n.stackChildAlignSelf === 'STRETCH' ? 'STRETCH' : 'INHERIT'), (v) => { n.stackChildAlignSelf = v === 'STRETCH' ? 'STRETCH' : 'AUTO'; A.doc.relayoutUp(n); });
      def('layoutPositioning', () => n.stackPositioning || 'AUTO', (v) => { n.stackPositioning = v; A.doc.relayoutUp(n); });
      const sizing = (axis) => {
        const p = A.doc.parent(n), H = p && p.stackMode === 'HORIZONTAL', V = p && p.stackMode === 'VERTICAL', primary = (axis === 'x' && H) || (axis === 'y' && V);
        if (p && (H || V)) { if (primary && (n.stackChildPrimaryGrow || 0) > 0) return 'FILL'; if (!primary && n.stackChildAlignSelf === 'STRETCH') return 'FILL'; }
        if (n.stackMode && n.stackMode !== 'NONE') { const own = (axis === 'x') === (n.stackMode === 'HORIZONTAL') ? n.stackPrimarySizing : n.stackCounterSizing; if (fit(own)) return 'HUG'; }
        if (isText && (n.textAutoResize === 'WIDTH_AND_HEIGHT' || (axis === 'y' && n.textAutoResize === 'HEIGHT'))) return 'HUG';
        return 'FIXED';
      };
      const setSizing = (axis, v) => {
        const p = A.doc.parent(n), H = p && p.stackMode === 'HORIZONTAL', primary = (axis === 'x') === !!H;
        if (v === 'FILL') { if (primary) n.stackChildPrimaryGrow = 1; else n.stackChildAlignSelf = 'STRETCH'; }
        else { if (primary) n.stackChildPrimaryGrow = 0; else if (n.stackChildAlignSelf === 'STRETCH') n.stackChildAlignSelf = 'AUTO'; }
        if (v === 'HUG' && n.stackMode && n.stackMode !== 'NONE') { const k = (axis === 'x') === (n.stackMode === 'HORIZONTAL') ? 'stackPrimarySizing' : 'stackCounterSizing'; n[k] = 'RESIZE_TO_FIT_WITH_IMPLICIT_SIZE'; }
        if (v === 'FIXED' && n.stackMode && n.stackMode !== 'NONE') { const k = (axis === 'x') === (n.stackMode === 'HORIZONTAL') ? 'stackPrimarySizing' : 'stackCounterSizing'; n[k] = 'FIXED'; }
        if (isText && v === 'HUG') n.textAutoResize = axis === 'x' ? 'WIDTH_AND_HEIGHT' : 'HEIGHT';
        A.doc.relayoutUp(n);
      };
      def('layoutSizingHorizontal', () => sizing('x'), (v) => setSizing('x', v));
      def('layoutSizingVertical', () => sizing('y'), (v) => setSizing('y', v));
      // texto
      if (isText) {
        const tx = (f) => (v) => { f(v); reshape(n); FL().fitText(n); A.doc.relayoutUp(n); };
        def('characters', () => n.textData?.characters || '', tx((v) => { n.textData = { characters: String(v) }; if (n.autoRename !== false) n.name = String(v).slice(0, 40); }));
        def('fontName', () => ({ family: n.fontName?.family || 'Inter', style: n.fontName?.style || 'Regular' }), tx((v) => { n.fontName = { family: v.family, style: v.style, postscript: '' }; }));
        def('fontSize', () => n.fontSize || 12, tx((v) => { n.fontSize = +v; }));
        def('textAlignHorizontal', () => n.textAlignHorizontal || 'LEFT', tx((v) => { n.textAlignHorizontal = v; }));
        def('textAlignVertical', () => n.textAlignVertical || 'TOP', tx((v) => { n.textAlignVertical = v; }));
        def('textAutoResize', () => n.textAutoResize || 'NONE', tx((v) => { n.textAutoResize = v; }));
        def('textCase', () => n.textCase || 'ORIGINAL', tx((v) => { n.textCase = v; }));
        def('textDecoration', () => n.textDecoration || 'NONE', tx((v) => { n.textDecoration = v; }));
        def('lineHeight', () => { const l = n.lineHeight; return !l || (l.units === 'PERCENT' && Math.abs(l.value - 100) < 1e-3) ? { unit: 'AUTO' } : { value: l.value, unit: l.units === 'RAW' ? 'PERCENT' : l.units }; },
          tx((v) => { n.lineHeight = v.unit === 'AUTO' ? { value: 100, units: 'PERCENT' } : { value: v.value, units: v.unit }; }));
        def('letterSpacing', () => ({ value: n.letterSpacing?.value || 0, unit: n.letterSpacing?.units || 'PERCENT' }), tx((v) => { n.letterSpacing = { value: v.value, units: v.unit }; }));
        def('hasMissingFont', () => false);
        W.insertCharacters = (i, s) => mutate(() => { const c = n.textData?.characters || ''; n.textData = { characters: c.slice(0, i) + s + c.slice(i) }; reshape(n); FL().fitText(n); });
        W.deleteCharacters = (a, b) => mutate(() => { const c = n.textData?.characters || ''; n.textData = { characters: c.slice(0, a) + c.slice(b) }; reshape(n); FL().fitText(n); });
        W.getRangeFontName = () => W.fontName; W.getRangeFontSize = () => W.fontSize; W.getRangeFills = () => W.fills;
        W.setRangeFills = (a, b, v) => { if (a === 0 && b >= W.characters.length) W.fills = v; else rangeStyle(a, b, { fillPaints: [...v].map(paintIn) }); };
        W.setRangeFontName = (a, b, v) => { if (a === 0 && b >= W.characters.length) W.fontName = v; else rangeStyle(a, b, { fontName: { family: v.family, style: v.style, postscript: '' } }); };
        W.setRangeFontSize = (a, b, v) => { if (a === 0 && b >= W.characters.length) W.fontSize = v; else rangeStyle(a, b, { fontSize: +v }); };
        W.setRangeTextDecoration = (a, b, v) => rangeStyle(a, b, { textDecoration: v });
        W.getStyledTextSegments = () => [{ characters: W.characters, start: 0, end: W.characters.length, fontName: W.fontName, fontSize: W.fontSize, fills: W.fills }];
        // tramo con estilo propio (characterStyleIDs + styleOverrideTable, como Figma)
        const rangeStyle = (a, b, over) => mutate(() => {
          const td = n.textData = { ...(n.textData || {}) }, len = (td.characters || '').length, ids = (td.characterStyleIDs || []).slice();
          while (ids.length < len) ids.push(0);
          const table = (td.styleOverrideTable || []).slice(), nid = Math.max(0, ...table.map((s) => s.styleID)) + 1;
          const merged = new Map();
          for (let i = a; i < b; i++) { const old = ids[i] || 0; if (!merged.has(old)) { const base = table.find((s) => s.styleID === old) || {}; const id = merged.size ? nid + merged.size : nid; merged.set(old, id); table.push({ ...clone(base), ...over, styleID: id }); } ids[i] = merged.get(old); }
          td.characterStyleIDs = ids; td.styleOverrideTable = table; reshape(n);
        });
      }
      // árbol
      if (n.children || FM().CONTAINERS.has(n.type) || n.type === 'CANVAS') {
        def('children', () => (n.children || []).map(wrap));
        W.appendChild = (c) => mutate(() => { const cn = raw(c); if (A.doc.parent(cn)) { const op = A.doc.parent(cn); op.children.splice(op.children.indexOf(cn), 1); } (n.children || (n.children = [])).push(cn); A.doc.reindex(); A.doc.relayoutUp(cn); });
        W.insertChild = (i, c) => mutate(() => { const cn = raw(c); const op = A.doc.parent(cn); if (op) op.children.splice(op.children.indexOf(cn), 1); (n.children || (n.children = [])).splice(i, 0, cn); A.doc.reindex(); A.doc.relayoutUp(cn); });
        const all = (pred, first) => { const out = []; const walk = (l) => { for (const k of l || []) { if (first && out.length) return; if (!pred || pred(wrap(k))) out.push(wrap(k)); walk(k.children); } }; walk(n.children); return out; };
        W.findAll = (pred) => all(pred, false); W.findOne = (pred) => all(pred, true)[0] || null;
        W.findChildren = (pred) => (n.children || []).map(wrap).filter((k) => !pred || pred(k));
        W.findChild = (pred) => W.findChildren(pred)[0] || null;
        W.findAllWithCriteria = (c) => all((k) => (!c.types || c.types.includes(k.type)), false);
      }
      if (n.type === 'CANVAS') {
        def('selection', () => (n === A.doc.page ? A.selected().map(wrap) : []), (v) => { if (n === A.doc.page) { A.sel = [...v].map((w) => w.id); A.emit('sel'); } });
        def('backgrounds', () => [paintOut({ type: 'SOLID', color: n.backgroundColor || { r: 0.118, g: 0.118, b: 0.118, a: 1 } })], (v) => { const p = v[0]; if (p && p.color) n.backgroundColor = { ...p.color, a: 1 }; });
        W.loadAsync = async () => {};
      }
      W.remove = () => mutate(() => { A.doc.remove(n); A.doc.reindex(); A.sel = A.sel.filter((id) => A.doc.node(id)); });
      W.clone = () => mutate(() => { const c = A.doc.clone(n), p = A.doc.parent(n) || A.doc.page; p.children.splice(p.children.indexOf(n) + 1, 0, c); A.doc.reindex(); return wrap(c); });
      // datos de plugin (campo kiwi pluginData: [{ pluginID, key, value }])
      const pd = (pid) => ({ get: (k) => ((n.pluginData || []).find((d) => d.pluginID === pid && d.key === k) || {}).value || '',
        set: (k, v) => mutate(() => { const arr = (n.pluginData || []).filter((d) => !(d.pluginID === pid && d.key === k)); if (v !== '') arr.push({ pluginID: pid, key: k, value: String(v) }); n.pluginData = arr; }),
        keys: () => (n.pluginData || []).filter((d) => d.pluginID === pid).map((d) => d.key) });
      W.getPluginData = (k) => pd(plugin.id).get(k); W.setPluginData = (k, v) => pd(plugin.id).set(k, v); W.getPluginDataKeys = () => pd(plugin.id).keys();
      W.getSharedPluginData = (ns, k) => pd('shared:' + ns).get(k); W.setSharedPluginData = (ns, k, v) => pd('shared:' + ns).set(k, v); W.getSharedPluginDataKeys = (ns) => pd('shared:' + ns).keys();
      W.setRelaunchData = () => {};
      W.exportAsync = (opts = {}) => exportNode(n, opts);
      W.toString = () => `[Node ${n.id}]`;
      return W;
    }
    function documentNode() {
      return { type: 'DOCUMENT', id: '0:0', name: A.doc.d.name, get children() { return A.doc.d.pages.filter((p) => !p.internalOnly && p.name !== 'Internal Only Canvas').map(wrap); },
        findAll: (pred) => A.doc.d.pages.flatMap((p) => wrap(p).findAll(pred)), findOne: (pred) => { for (const p of A.doc.d.pages) { const r = wrap(p).findOne(pred); if (r) return r; } return null; },
        findAllWithCriteria: (c) => A.doc.d.pages.flatMap((p) => wrap(p).findAllWithCriteria(c)), getPluginData: () => '', setPluginData: () => {} };
    }
    async function exportNode(n, opts) {
      const fmt = opts.format || 'PNG', k = opts.constraint?.type === 'SCALE' ? opts.constraint.value : opts.constraint?.type === 'WIDTH' ? opts.constraint.value / (n.size?.x || 1) : opts.constraint?.type === 'HEIGHT' ? opts.constraint.value / (n.size?.y || 1) : 1;
      const b = A.doc.bounds(n), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(b.w * k)); c.height = Math.max(1, Math.round(b.h * k));
      const x = c.getContext('2d'), R2 = { ...A.renderCtx, doc: A.doc.d, version: A.doc.version, W: c.width, H: c.height, pool: [] };
      const M = A.doc.abs(n), copy = { ...n, transform: { m00: M[0], m10: M[1], m01: M[2], m11: M[3], m02: M[4], m12: M[5] } };
      FR().renderNodes(x, [copy], [k, 0, 0, k, -b.x * k, -b.y * k], R2);
      await new Promise((r) => setTimeout(r, 300)); x.clearRect(0, 0, c.width, c.height); FR().renderNodes(x, [copy], [k, 0, 0, k, -b.x * k, -b.y * k], R2);
      const blob = await new Promise((r) => c.toBlob(r, fmt === 'JPG' ? 'image/jpeg' : 'image/png'));
      return new Uint8Array(await blob.arrayBuffer());
    }
    // creación de nodos
    const create = (type, props = {}) => mutate(() => {
      const parent = A.doc.page, vb = viewCenter();
      const n = A.doc.create(type, { transform: { ...ID, m02: Math.round(vb[0]), m12: Math.round(vb[1]) }, ...props }, parent);
      return wrap(n);
    });
    const viewCenter = () => { const r = document.getElementById('stage').getBoundingClientRect(); return A.toDesign(r.width / 2, r.height / 2); };

    // ---------------------------------------------------------------- objeto figma
    // como Figma: lo que se manda antes de que cargue la UI se encola
    const ui = { postMessage: (msg) => { if (!S.ui) return; const m = { pluginMessage: msg, pluginId: plugin.id }; if (S.ui.ready) S.ui.frame.contentWindow.postMessage(m, '*'); else S.ui.queue.push(m); },
      onmessage: undefined, on: (ev, f) => { (S.handlers['ui:' + ev] = S.handlers['ui:' + ev] || []).push(f); }, off: (ev, f) => { S.handlers['ui:' + ev] = (S.handlers['ui:' + ev] || []).filter((x) => x !== f); },
      once: (ev, f) => { const g = (...a) => { ui.off(ev, g); f(...a); }; ui.on(ev, g); },
      show: () => { if (S.ui) S.ui.win.style.display = ''; }, hide: () => { if (S.ui) S.ui.win.style.display = 'none'; },
      resize: (w, h) => { if (S.ui) { S.ui.frame.style.width = w + 'px'; S.ui.frame.style.height = h + 'px'; } }, reposition: () => {}, close: () => closeUi() };
    const figma = {
      mixed: MIXED, apiVersion: '1.0.0', editorType: 'figma', mode: 'default', pluginId: plugin.id, command: plugin.command || '', parameters: {},
      get root() { return documentNode(); },
      get currentPage() { return wrap(A.doc.page); }, set currentPage(p) { A.setPage(raw(p)); },
      setCurrentPageAsync: async (p) => { A.setPage(raw(p)); },
      ui,
      showUI(html, opts = {}) { openUi(html, opts); },
      closePlugin(msg) { if (msg) A.toast(msg); close(); },
      notify(msg, opts = {}) { A.toast(String(msg), opts.error ? 'err' : '', opts.timeout || 3200); return { cancel() {} }; },
      on(ev, f) { (S.handlers[ev] = S.handlers[ev] || []).push(f); }, once(ev, f) { const g = (...a) => { figma.off(ev, g); f(...a); }; figma.on(ev, g); },
      off(ev, f) { S.handlers[ev] = (S.handlers[ev] || []).filter((x) => x !== f); },
      getNodeById(id) { const n = A.doc.node(id); return n ? wrap(n) : null; }, getNodeByIdAsync: async (id) => figma.getNodeById(id),
      createRectangle: () => create('ROUNDED_RECTANGLE'), createEllipse: () => create('ELLIPSE'), createLine: () => create('LINE', { size: { x: 100, y: 0 } }),
      createFrame: () => create('FRAME'), createComponent: () => create('FRAME', { name: 'Component' }), createText: () => create('TEXT', { size: { x: 1, y: 30 } }),
      createVector: () => create('VECTOR'), createPolygon: () => create('ELLIPSE', { name: 'Polygon' }), createStar: () => create('ELLIPSE', { name: 'Star' }),
      createPage: () => mutate(() => { const p = { id: FM().newId(), type: 'CANVAS', name: 'Page ' + (A.doc.d.pages.length + 1), visible: true, opacity: 1, backgroundColor: { r: 0.118, g: 0.118, b: 0.118, a: 1 }, children: [] }; A.doc.d.pages.push(p); A.doc.reindex(); return wrap(p); }),
      group(nodes, parent, index) { return mutate(() => { const g = A.doc.wrap([...nodes].map(raw), 'GROUP'); return wrap(g); }); },
      flatten(nodes) { return figma.group(nodes); },
      createImage(bytes) {
        const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), hash = sha1(u8);
        if (!IMAGES.has(hash)) { IMAGES.set(hash, u8); fetch('/api/fig/upload', { method: 'POST', body: u8 }).then(() => { A.doc.version++; A.render(); }); }
        return imageObj(hash);
      },
      async createImageAsync(url) { return figma.createImage(new Uint8Array(await (await fetch(url)).arrayBuffer())); },
      getImageByHash: (h) => imageObj(h),
      async loadFontAsync(f) { FL().ensureFont(f.family, f.style); const si = FL().styleInfo(f.style); await document.fonts.load(`${si.italic ? 'italic ' : ''}${si.weight} 16px "${f.family}"`).catch(() => {}); },
      async listAvailableFontsAsync() { const j = await fetch('../studio/figfonts.json').then((r) => r.json()).catch(() => ({})); return Object.entries(j).flatMap(([family, styles]) => styles.map((style) => ({ fontName: { family, style } }))); },
      viewport: { get center() { const c = viewCenter(); return { x: c[0], y: c[1] }; }, set center(p) { const r = document.getElementById('stage').getBoundingClientRect(); A.view.x = r.width / 2 - p.x * A.view.k; A.view.y = r.height / 2 - p.y * A.view.k; A.render(); },
        get zoom() { return A.view.k; }, set zoom(k) { A.view.k = k; A.render(); }, scrollAndZoomIntoView(nodes) { A.select([...nodes].map((w) => w.id)); A.fitSel(); },
        get bounds() { const r = document.getElementById('stage').getBoundingClientRect(), [x0, y0] = A.toDesign(0, 0), [x1, y1] = A.toDesign(r.width, r.height); return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }; } },
      clientStorage: { async getAsync(k) { try { const v = localStorage.getItem(`fig-plugin:${plugin.id}:${k}`); return v == null ? undefined : JSON.parse(v); } catch { return undefined; } },
        async setAsync(k, v) { try { localStorage.setItem(`fig-plugin:${plugin.id}:${k}`, JSON.stringify(v)); } catch { /* lleno */ } },
        async deleteAsync(k) { try { localStorage.removeItem(`fig-plugin:${plugin.id}:${k}`); } catch { /* */ } }, async keysAsync() { return Object.keys(localStorage).filter((k) => k.startsWith(`fig-plugin:${plugin.id}:`)).map((k) => k.split(':').slice(2).join(':')); } },
      base64Encode: (u8) => b64enc(u8), base64Decode: (s) => b64dec(s),
      util: { rgb: (c) => (typeof c === 'string' ? hexColor(c) : { r: c.r, g: c.g, b: c.b }), rgba: (c) => (typeof c === 'string' ? { ...hexColor(c), a: 1 } : { a: 1, ...c }), solidPaint: (c, o = {}) => ({ type: 'SOLID', color: typeof c === 'string' ? hexColor(c) : c, ...o }) },
      getLocalPaintStylesAsync: async () => [], getLocalTextStylesAsync: async () => [], getLocalEffectStylesAsync: async () => [], getLocalPaintStyles: () => [], getLocalTextStyles: () => [],
      saveVersionHistoryAsync: async () => ({ id: String(Date.now()) }), commitUndo() { flush(); }, triggerUndo() { if (A.doc.undo()) A.afterChange(); },
      loadAllPagesAsync: async () => {}, skipInvisibleInstanceChildren: false,
    };
    const hexColor = (s) => { const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s.trim()); let h = m ? m[1] : '000'; if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const v = parseInt(h, 16); return { r: (v >> 16 & 255) / 255, g: (v >> 8 & 255) / 255, b: (v & 255) / 255 }; };

    // ---------------------------------------------------------------- UI del plugin
    function openUi(html, opts) {
      closeUi();
      const win = document.createElement('div'); win.className = 'plug-win'; win.style.cssText = `right:280px;top:70px;${opts.visible === false ? 'display:none;' : ''}`;
      const head = document.createElement('div'); head.className = 'ph'; head.innerHTML = `<span></span><button style="color:inherit">✕</button>`; head.firstChild.textContent = opts.title || plugin.name;
      head.lastChild.onclick = () => close();
      const frame = document.createElement('iframe'); frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups allow-modals allow-downloads');
      frame.style.cssText = `width:${opts.width || 300}px;height:${opts.height || 200}px;`;
      // la UI de Figma recibe la clase del tema y llama a parent.postMessage({ pluginMessage }, '*')
      frame.srcdoc = `<!doctype html><html class="figma-dark"><head><meta charset="utf-8"></head><body>${html}</body></html>`;
      win.append(head, frame); document.body.append(win);
      // arrastrar la ventana por la cabecera
      head.addEventListener('pointerdown', (e) => { if (e.target.tagName === 'BUTTON') return; const r = win.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top; head.setPointerCapture(e.pointerId);
        const mv = (ev) => { win.style.left = ev.clientX - dx + 'px'; win.style.top = ev.clientY - dy + 'px'; win.style.right = 'auto'; }; const up = () => { head.removeEventListener('pointermove', mv); head.removeEventListener('pointerup', up); };
        head.addEventListener('pointermove', mv); head.addEventListener('pointerup', up); });
      S.ui = { win, frame, ready: false, queue: [] };
      frame.addEventListener('load', () => { const u = S.ui; if (!u || u.frame !== frame) return; u.ready = true; for (const m of u.queue.splice(0)) frame.contentWindow.postMessage(m, '*'); });
    }
    function closeUi() { if (S.ui) { S.ui.win.remove(); S.ui = null; } }
    S.onUiMessage = (e) => {
      if (!S.ui || e.source !== S.ui.frame.contentWindow || !e.data || !('pluginMessage' in e.data)) return;
      const msg = e.data.pluginMessage, props = { origin: e.origin };
      try { if (typeof ui.onmessage === 'function') ui.onmessage(msg, props); for (const f of S.handlers['ui:message'] || []) f(msg, props); }
      catch (err) { A.toast(`${plugin.name}: ${err.message || err}`, 'err', 6000); console.error(err); }
    };
    window.addEventListener('message', S.onUiMessage);
    S.fire = (ev, ...a) => { for (const f of S.handlers[ev] || []) try { f(...a); } catch (err) { console.error(err); } };
    function close() {
      if (S.closed) return; S.fire('close'); flush(); S.closed = true; closeUi(); window.removeEventListener('message', S.onUiMessage);
      if (S.sandbox) S.sandbox.remove(); if (current === S) current = null;
    }
    S.close = close; S.figma = figma;
    return S;
  }

  // ---------------------------------------------------------------- catálogo e instalación
  let current = null;
  async function list() { return fetch('/api/fig/plugins').then((r) => r.json()).catch(() => []); }
  async function run(id, command) {
    if (current) current.close();
    const p = await fetch('/api/fig/plugin?id=' + encodeURIComponent(id)).then((r) => r.json());
    if (!p || !p.code) { A.toast('No se pudo cargar el plugin', 'err'); return; }
    const S = current = Session({ id: p.id, name: p.name, command });
    // sandbox: iframe oculto del mismo origen con su propio global
    const sb = document.createElement('iframe'); sb.style.display = 'none'; document.body.append(sb); S.sandbox = sb;
    const g = sb.contentWindow;
    g.figma = S.figma; g.__html__ = p.ui || ''; g.__uiFiles__ = p.uiFiles || {};
    g.console = console; g.fetch = window.fetch.bind(window);
    g.onerror = (m) => { A.toast(`${p.name}: ${m}`, 'err', 6000); };
    try {
      const r = g.eval(`(async function(){\n${p.code}\n})()\n//# sourceURL=fig-plugin-${p.id}.js`);
      if (r && r.catch) r.catch((e) => { A.toast(`${p.name}: ${e.message || e}`, 'err', 6000); console.error(e); });
      S.fire('run', { command: command || '', parameters: {} });
    } catch (e) { A.toast(`${p.name}: ${e.message || e}`, 'err', 6000); console.error(e); S.close(); }
  }
  // instalar: elegir la carpeta del plugin (manifest.json + main + ui)
  function install() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.webkitdirectory = true; inp.multiple = true;
    inp.onchange = async () => {
      const files = [...inp.files], rel = (f) => f.webkitRelativePath.split('/').slice(1).join('/');
      const man = files.find((f) => rel(f) === 'manifest.json');
      if (!man) { A.toast('Esa carpeta no tiene manifest.json', 'err'); return; }
      const manifest = JSON.parse(await man.text()), read = async (p) => { const f = files.find((x) => rel(x) === String(p).replace(/^\.\//, '')); return f ? f.text() : null; };
      const code = await read(manifest.main);
      if (!code) { A.toast('No encuentro el archivo main del manifest: ' + manifest.main, 'err'); return; }
      const ui = typeof manifest.ui === 'string' ? await read(manifest.ui) : null;
      const uiFiles = {}; if (manifest.ui && typeof manifest.ui === 'object') for (const [k, v] of Object.entries(manifest.ui)) uiFiles[k] = await read(v);
      const r = await fetch('/api/fig/plugins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ manifest, code, ui, uiFiles }) });
      if (r.ok) A.toast('Plugin instalado: ' + manifest.name); else A.toast('No se pudo instalar', 'err');
    };
    inp.click();
  }
  function init(app) {
    A = app;
    A.on('sel', () => current && current.fire('selectionchange'));
    A.on('doc', () => current && current.fire('currentpagechange'));
  }
  root.FigPlugins = { init, list, run, install, sha1, get current() { return current; } };
})(typeof self !== 'undefined' ? self : this);
