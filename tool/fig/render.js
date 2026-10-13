/* Fig — renderizador Canvas2D del modelo de Figma (nodos kiwi, ver studio/figdoc.mjs).
   Pinta lo que Figma ya calculó cuando viene en el documento (fillGeometry / strokeGeometry / derivedTextData: forma exacta,
   esquinas suavizadas, glifos) y lo calcula cuando falta (nodos creados o editados aquí).
   Fórmulas de efectos y ajustes: las del renderer de Figma (studio/figfx.js, sacadas de su WASM). */
(function (root) {
  'use strict';
  const FX = () => root.FigFX;
  const ID = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 };

  // ---------------------------------------------------------------- matrices (a b c d e f de canvas)
  const mat = (t) => { t = t || ID; return [t.m00, t.m10, t.m01, t.m11, t.m02, t.m12]; };
  const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3],
    A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
  const inv = (M) => { const det = M[0] * M[3] - M[1] * M[2] || 1e-12; return [M[3] / det, -M[1] / det, -M[2] / det, M[0] / det, (M[2] * M[5] - M[3] * M[4]) / det, (M[1] * M[4] - M[0] * M[5]) / det]; };
  const app = (M, x, y) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];

  // ---------------------------------------------------------------- blobs -> Path2D
  function b64bytes(b) {
    if (!b) return new Uint8Array(0);
    if (b instanceof Uint8Array) return b;
    if (b._u8) return b._u8;
    const s = atob(b.$b || ''), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    Object.defineProperty(b, '_u8', { value: u, enumerable: false }); return u;
  }
  // comandos: 0 cerrar · 1 moveTo · 2 lineTo · 3 quad · 4 cúbica (float32 LE). scaleY = -1 para glifos (em, y arriba)
  function blobPath(bytes, sx = 1, sy = 1) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), p = new Path2D();
    let i = 0, open = false;
    const f = () => { const v = dv.getFloat32(i, true); i += 4; return v; };
    while (i < bytes.length) {
      const c = bytes[i++];
      if (c === 0) { if (open) p.closePath(); open = false; }
      else if (c === 1) { p.moveTo(f() * sx, f() * sy); open = true; }
      else if (c === 2) p.lineTo(f() * sx, f() * sy);
      else if (c === 3) { const a = f() * sx, b = f() * sy; p.quadraticCurveTo(a, b, f() * sx, f() * sy); }
      else if (c === 4) { const a = f() * sx, b = f() * sy, c2 = f() * sx, d = f() * sy; p.bezierCurveTo(a, b, c2, d, f() * sx, f() * sy); }
      else break;
    }
    return p;
  }

  // ---------------------------------------------------------------- red vectorial (vectorNetworkBlob) -> Path2D
  // u32 vértices, segmentos, regiones · vértice: flags u32, x f32, y f32 · segmento: flags, ini u32, tanIni f32×2, fin u32, tanFin f32×2
  function networkPath(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); let o = 0;
    const u = () => { const v = dv.getUint32(o, true); o += 4; return v; }, f = () => { const v = dv.getFloat32(o, true); o += 4; return v; };
    const nv = u(), ns = u(), nr = u(), V = [], S = [];
    for (let i = 0; i < nv; i++) { u(); V.push([f(), f()]); }
    for (let i = 0; i < ns; i++) { u(); const a = u(), ta = [f(), f()], b = u(), tb = [f(), f()]; S.push({ a, ta, b, tb }); }
    const p = new Path2D(), seg = (s, first) => {
      const A = V[s.a], Bv = V[s.b];
      if (first) p.moveTo(A[0], A[1]);
      if (!s.ta[0] && !s.ta[1] && !s.tb[0] && !s.tb[1]) p.lineTo(Bv[0], Bv[1]);
      else p.bezierCurveTo(A[0] + s.ta[0], A[1] + s.ta[1], Bv[0] + s.tb[0], Bv[1] + s.tb[1], Bv[0], Bv[1]);
    };
    if (nr) {
      for (let r = 0; r < nr; r++) {
        u(); const loops = u();
        for (let l = 0; l < loops; l++) { const n = u(); for (let k = 0; k < n; k++) seg(S[u()], k === 0); p.closePath(); }
      }
    } else { let last = -1; for (const s of S) { seg(s, s.a !== last); last = s.b; } }
    return p;
  }

  // ---------------------------------------------------------------- geometría de un nodo (px del nodo)
  function radiiOf(n) {
    const r = n.cornerRadius || 0;
    if (n.rectangleCornerRadiiIndependent) return [n.rectangleTopLeftCornerRadius || 0, n.rectangleTopRightCornerRadius || 0, n.rectangleBottomRightCornerRadius || 0, n.rectangleBottomLeftCornerRadius || 0];
    return [n.rectangleTopLeftCornerRadius ?? r, n.rectangleTopRightCornerRadius ?? r, n.rectangleBottomRightCornerRadius ?? r, n.rectangleBottomLeftCornerRadius ?? r];
  }
  function rectPath(w, h, rr) {
    const p = new Path2D(), m = Math.min(w, h) / 2, [a, b, c, d] = rr.map((x) => Math.max(0, Math.min(m, x || 0)));
    if (!a && !b && !c && !d) { p.rect(0, 0, w, h); return p; }
    p.roundRect(0, 0, w, h, [a, b, c, d]); return p;
  }
  function ellipsePath(n, w, h) {
    const p = new Path2D(), ad = n.arcData;
    if (!ad || (Math.abs((ad.endingAngle || 0) - (ad.startingAngle || 0) - 2 * Math.PI) < 1e-3 && !(ad.innerRadius > 0))) { p.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); return p; }
    const s = ad.startingAngle || 0, e = ad.endingAngle ?? Math.PI * 2, ir = ad.innerRadius || 0;
    p.ellipse(w / 2, h / 2, w / 2, h / 2, 0, s, e);
    if (ir > 0) p.ellipse(w / 2, h / 2, w / 2 * ir, h / 2 * ir, 0, e, s, true); else p.lineTo(w / 2, h / 2);
    p.closePath(); return p;
  }
  // { fill: [{path, rule}], stroke: [{path, rule}] | null }
  function geometryOf(n, R) {
    if (n._geo && n._geoKey === R.version) return n._geo;
    const w = n.size?.x || 0, h = n.size?.y || 0, blobs = R.doc.blobs || [];
    const fromBlobs = (arr) => (arr && arr.length ? arr.map((g) => ({ path: blobPath(b64bytes(blobs[g.commandsBlob])), rule: g.windingRule === 'EVENODD' ? 'evenodd' : 'nonzero' })) : null);
    let fill = fromBlobs(n.fillGeometry), stroke = fromBlobs(n.strokeGeometry);
    if (!fill) {
      if (n.type === 'ELLIPSE') fill = [{ path: ellipsePath(n, w, h), rule: 'nonzero' }];
      else if (n.vectorData?.vectorNetworkBlob != null) fill = [{ path: networkPath(b64bytes(blobs[n.vectorData.vectorNetworkBlob])), rule: 'nonzero' }];
      else if (n.type === 'LINE') { const p = new Path2D(); p.moveTo(0, 0); p.lineTo(w, 0); fill = [{ path: p, rule: 'nonzero', open: true }]; }
      else if (n.type !== 'TEXT' && n.type !== 'GROUP') fill = [{ path: rectPath(w, h, radiiOf(n)), rule: 'nonzero' }];
      else fill = [];
    }
    const geo = { fill, stroke };
    Object.defineProperty(n, '_geo', { value: geo, writable: true, configurable: true, enumerable: false });
    Object.defineProperty(n, '_geoKey', { value: R.version, writable: true, configurable: true, enumerable: false });
    return geo;
  }

  // ---------------------------------------------------------------- imágenes
  const IMG = new Map();      // hash -> { img, ready }
  function imageOf(hash, R) {
    let e = IMG.get(hash);
    if (!e) {
      e = { img: new Image(), ready: false }; IMG.set(hash, e);
      e.img.onload = () => { e.ready = true; R.onAsset && R.onAsset(); };
      e.img.src = (R.imageBase || '/api/fig/image/') + hash;
    }
    return e.ready ? e.img : null;
  }
  const ADJ = new Map();
  function adjusted(img, hash, f) {
    if (!f || !FX() || !FX().hasAdjust(f)) return img;
    const k = hash + JSON.stringify(f); let c = ADJ.get(k);
    if (!c) {
      c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height); FX().adjustPixels(d.data, f); x.putImageData(d, 0, 0); ADJ.set(k, c);
    }
    return c;
  }
  const hexOf = (h) => (h instanceof Uint8Array ? [...h] : [...b64bytes(h)]).map((b) => b.toString(16).padStart(2, '0')).join('');

  // ---------------------------------------------------------------- pinturas
  const BLEND = { NORMAL: 'source-over', PASS_THROUGH: 'source-over', MULTIPLY: 'multiply', SCREEN: 'screen', OVERLAY: 'overlay', DARKEN: 'darken', LIGHTEN: 'lighten',
    COLOR_DODGE: 'color-dodge', COLOR_BURN: 'color-burn', HARD_LIGHT: 'hard-light', SOFT_LIGHT: 'soft-light', DIFFERENCE: 'difference', EXCLUSION: 'exclusion',
    HUE: 'hue', SATURATION: 'saturation', COLOR: 'color', LUMINOSITY: 'luminosity', LINEAR_DODGE: 'lighter', LINEAR_BURN: 'multiply' };
  const css = (c, a = 1) => `rgba(${Math.round((c.r || 0) * 255)},${Math.round((c.g || 0) * 255)},${Math.round((c.b || 0) * 255)},${(c.a ?? 1) * a})`;
  // pinta p dentro del clip actual (ctx ya en px del nodo), nodo de tamaño w×h
  function paint(ctx, p, w, h, R) {
    if (p.visible === false || !(p.opacity ?? 1)) return;
    ctx.save();
    ctx.globalCompositeOperation = BLEND[p.blendMode] || 'source-over';
    const op = p.opacity ?? 1;
    if (p.type === 'SOLID') { ctx.fillStyle = css(p.color, op); ctx.fillRect(-1e5, -1e5, 2e5, 2e5); }
    else if (p.type.startsWith('GRADIENT')) gradient(ctx, p, w, h, op);
    else if (p.type === 'IMAGE') imagePaint(ctx, p, w, h, R, op);
    ctx.restore();
  }
  function gradient(ctx, p, w, h, op) {
    const T = mat(p.transform), G = inv(T);             // T: UV del nodo -> espacio del degradado
    const stops = (p.stops || []).slice().sort((a, b) => a.position - b.position);
    // caja del nodo en el espacio del degradado
    const cs = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => app(T, u, v));
    const xs = cs.map((c) => c[0]), ys = cs.map((c) => c[1]), x0 = Math.min(...xs) - 1, y0 = Math.min(...ys) - 1, x1 = Math.max(...xs) + 1, y1 = Math.max(...ys) + 1;
    ctx.transform(w, 0, 0, h, 0, 0); ctx.transform(...G);
    if (p.type === 'GRADIENT_DIAMOND') { diamond(ctx, stops, op, x0, y0, x1, y1); return; }
    let g;
    if (p.type === 'GRADIENT_LINEAR') g = ctx.createLinearGradient(0, 0.5, 1, 0.5);
    else if (p.type === 'GRADIENT_RADIAL') g = ctx.createRadialGradient(0.5, 0.5, 0, 0.5, 0.5, 0.5);
    else g = ctx.createConicGradient(0, 0.5, 0.5);
    for (const s of stops) g.addColorStop(Math.max(0, Math.min(1, s.position)), css(s.color, op));
    ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  // degradado diamante: t = 2·(|x-½| + |y-½|) en el espacio del degradado (por píxel, en un lienzo pequeño)
  function diamond(ctx, stops, op, x0, y0, x1, y1) {
    const N = 128, c = document.createElement('canvas'); c.width = c.height = N;
    const x = c.getContext('2d'), d = x.createImageData(N, N);
    const lerp = (t) => { let i = 0; while (i < stops.length - 2 && stops[i + 1].position < t) i++; const a = stops[i], b = stops[Math.min(i + 1, stops.length - 1)];
      const k = b.position > a.position ? Math.max(0, Math.min(1, (t - a.position) / (b.position - a.position))) : 0;
      return ['r', 'g', 'b', 'a'].map((ch) => (a.color[ch] ?? 1) + ((b.color[ch] ?? 1) - (a.color[ch] ?? 1)) * k); };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const gx = x0 + (i + 0.5) / N * (x1 - x0), gy = y0 + (j + 0.5) / N * (y1 - y0), t = Math.min(1, 2 * (Math.abs(gx - 0.5) + Math.abs(gy - 0.5)));
      const v = lerp(t), o = (j * N + i) * 4; d.data[o] = v[0] * 255; d.data[o + 1] = v[1] * 255; d.data[o + 2] = v[2] * 255; d.data[o + 3] = v[3] * 255 * op;
    }
    x.putImageData(d, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(c, x0, y0, x1 - x0, y1 - y0);
  }
  function imagePaint(ctx, p, w, h, R, op) {
    const hash = p.image?.hash ? hexOf(p.image.hash) : null; if (!hash) return;
    const raw = imageOf(hash, R); if (!raw) return;
    const img = adjusted(raw, hash, p.paintFilter), iw = raw.naturalWidth, ih = raw.naturalHeight;
    ctx.globalAlpha *= op;
    const mode = p.imageScaleMode || 'FILL', rot = ((p.rotation || 0) % 360 + 360) % 360;
    if (mode === 'TILE') {
      const s = p.scale || 1, pat = ctx.createPattern(img, 'repeat');
      pat.setTransform(new DOMMatrix().scale(s * (iw ? (p.originalImageWidth || iw) / iw : 1), s * (ih ? (p.originalImageHeight || ih) / ih : 1)).rotate(rot));
      ctx.fillStyle = pat; ctx.fillRect(0, 0, w, h); return;
    }
    if (mode === 'STRETCH') { ctx.transform(w, 0, 0, h, 0, 0); ctx.transform(...inv(mat(p.transform))); ctx.drawImage(img, 0, 0, 1, 1); return; }
    // FILL (cubrir) / FIT (contener), con giro de 90°
    const sw = rot % 180 ? ih : iw, sh = rot % 180 ? iw : ih;
    const k = mode === 'FIT' ? Math.min(w / sw, h / sh) : Math.max(w / sw, h / sh);
    ctx.translate(w / 2, h / 2); ctx.rotate(rot * Math.PI / 180);
    ctx.drawImage(img, -iw * k / 2, -ih * k / 2, iw * k, ih * k);
  }

  // ---------------------------------------------------------------- capas (lienzos auxiliares del tamaño de la vista)
  function layer(R) {
    const pool = R.pool || (R.pool = []); let c = pool.find((x) => !x.busy);
    if (!c) { c = { cv: document.createElement('canvas'), busy: false }; pool.push(c); }
    c.busy = true;
    if (c.cv.width !== R.W || c.cv.height !== R.H) { c.cv.width = R.W; c.cv.height = R.H; }
    const x = c.cv.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; x.clearRect(0, 0, R.W, R.H);
    return { ...c, ctx: x, done: () => { c.busy = false; } };
  }

  // ---------------------------------------------------------------- texto
  function drawText(ctx, n, R, which) {
    const D = n.derivedTextData, blobs = R.doc.blobs || [];
    const styles = new Map((n.textData?.styleOverrideTable || []).map((s) => [s.styleID, s]));
    const ids = n.textData?.characterStyleIDs || [];
    const paintsFor = (ci) => { const st = styles.get(ids[ci] || 0); return (which === 'fill' ? st?.fillPaints : null) || (which === 'fill' ? n.fillPaints : n.strokePaints) || []; };
    if (D && D.glyphs && D.glyphs.length) {
      for (const g of D.glyphs) {
        if (g.commandsBlob == null) continue;
        const k = g.commandsBlob + '|' + g.fontSize;
        const cache = R.glyphCache || (R.glyphCache = new Map());
        let path = cache.get(k);
        if (!path) { path = blobPath(b64bytes(blobs[g.commandsBlob]), g.fontSize, -g.fontSize); cache.set(k, path); }
        ctx.save(); ctx.translate(g.position.x, g.position.y);
        if (which === 'fill') { ctx.clip(path); for (const p of paintsFor(g.firstCharacter)) paint(ctx, p, n.size.x, n.size.y, R); }
        else { ctx.lineWidth = (n.strokeWeight || 1) * (n.strokeAlign === 'CENTER' ? 1 : 2); ctx.lineJoin = 'round'; strokeWith(ctx, path, n, R); }
        ctx.restore();
      }
      if (which === 'fill') for (const d of D.decorations || []) for (const r of d.rects || []) {
        ctx.save(); const pr = new Path2D(); pr.rect(r.x, r.y, r.w, r.h); ctx.clip(pr);
        for (const p of paintsFor((n.textData?.characterStyleIDs || []).indexOf(d.styleID))) paint(ctx, p, n.size.x, n.size.y, R); ctx.restore();
      }
      return;
    }
    // sin glifos (texto creado o editado aquí): maquetación propia
    const L = R.layoutText ? R.layoutText(n) : null; if (!L) return;
    for (const run of L.runs) {
      ctx.save(); ctx.font = run.font; ctx.letterSpacing = (run.ls || 0) + 'px';
      if (which === 'fill') {
        ctx.beginPath();
        const ps = paintsFor(run.ci);
        const solid = ps.length === 1 && ps[0].type === 'SOLID' && (!ps[0].blendMode || ps[0].blendMode === 'NORMAL');
        if (solid) { ctx.fillStyle = css(ps[0].color, ps[0].opacity ?? 1); ctx.fillText(run.text, run.x, run.y); }
        else maskedPaint(ctx, (x) => { x.font = run.font; x.letterSpacing = (run.ls || 0) + 'px'; x.fillText(run.text, run.x, run.y); }, ps, n.size.x, n.size.y, R);   // pintura no sólida
      } else { ctx.lineWidth = (n.strokeWeight || 1) * 2; ctx.lineJoin = 'round'; const ps = paintsFor(run.ci); ctx.strokeStyle = ps[0]?.type === 'SOLID' ? css(ps[0].color, ps[0].opacity ?? 1) : '#000'; ctx.strokeText(run.text, run.x, run.y); }
      ctx.restore();
    }
  }
  // pinturas (con sus fusiones contra el fondo real) recortadas a una máscara que dibuja drawMask (trazo, texto…)
  function maskedPaint(ctx, drawMask, paints, w, h, R) {
    const M = layer(R), P = layer(R);
    M.ctx.setTransform(ctx.getTransform()); drawMask(M.ctx);
    P.ctx.drawImage(ctx.canvas, 0, 0); P.ctx.setTransform(ctx.getTransform());
    for (const p of paints) paint(P.ctx, p, w, h, R);
    P.ctx.setTransform(1, 0, 0, 1, 0, 0); P.ctx.globalCompositeOperation = 'destination-in'; P.ctx.drawImage(M.cv, 0, 0);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-out'; ctx.drawImage(M.cv, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(P.cv, 0, 0);
    ctx.restore(); M.done(); P.done();
  }
  // contorno sin strokeGeometry: banda del trazo como máscara + pinturas del borde
  function strokeWith(ctx, path, n, R) {
    const ps = (n.strokePaints || []).filter((p) => p.visible !== false);
    if (ps.length === 1 && ps[0].type === 'SOLID' && (!ps[0].blendMode || ps[0].blendMode === 'NORMAL')) { ctx.strokeStyle = css(ps[0].color, ps[0].opacity ?? 1); ctx.stroke(path); return; }
    const lw = ctx.lineWidth, lj = ctx.lineJoin, lc = ctx.lineCap, dash = ctx.getLineDash();
    maskedPaint(ctx, (x) => { x.lineWidth = lw; x.lineJoin = lj; x.lineCap = lc; x.setLineDash(dash); x.stroke(path); }, ps, n.size.x, n.size.y, R);
  }

  // ---------------------------------------------------------------- nodo
  const visiblePaints = (ps) => (ps || []).filter((p) => p.visible !== false && (p.opacity ?? 1) > 0);
  const liveFx = (n) => (n.effects || []).filter((e) => e.visible !== false);
  function drawContent(ctx, n, M, R) {
    const w = n.size?.x || 0, h = n.size?.y || 0;
    ctx.save(); ctx.setTransform(...M);
    if (n.type === 'TEXT') {
      // contorno: por fuera = debajo del relleno (el relleno tapa la mitad interior); centrado / por dentro = encima
      const st = visiblePaints(n.strokePaints).length && (n.strokeWeight || 0) > 0, outside = (n.strokeAlign || 'OUTSIDE') === 'OUTSIDE';
      if (st && outside) drawText(ctx, n, R, 'stroke');
      drawText(ctx, n, R, 'fill');
      if (st && !outside) drawText(ctx, n, R, 'stroke');
      ctx.restore(); return;
    }
    const geo = geometryOf(n, R);
    // rellenos
    const fills = visiblePaints(n.fillPaints);
    if (fills.length) for (const g of geo.fill) { if (g.open) continue; ctx.save(); ctx.clip(g.path, g.rule); for (const p of fills) paint(ctx, p, w, h, R); ctx.restore(); }
    ctx.restore();
  }
  function drawStrokes(ctx, n, M, R) {
    const strokes = visiblePaints(n.strokePaints), sw = n.strokeWeight ?? 1;
    if (!strokes.length || !(sw > 0) || n.type === 'TEXT') return;
    const w = n.size?.x || 0, h = n.size?.y || 0, geo = geometryOf(n, R);
    ctx.save(); ctx.setTransform(...M);
    if (geo.stroke) {
      // strokeGeometry de Figma = banda de 2× el grosor centrada en el borde (igual para dentro y fuera): se recorta según la alineación
      const al = n.strokeAlign || 'INSIDE', fillP = new Path2D(); for (const g of geo.fill) if (!g.open) fillP.addPath(g.path);
      for (const g of geo.stroke) {
        ctx.save(); ctx.clip(g.path, g.rule);
        if (al === 'INSIDE' && geo.fill.length) ctx.clip(fillP);
        else if (al === 'OUTSIDE' && geo.fill.length) { const out = new Path2D(); out.rect(-1e5, -1e5, 2e5, 2e5); out.addPath(fillP); ctx.clip(out, 'evenodd'); }
        for (const p of strokes) paint(ctx, p, w, h, R);
        ctx.restore();
      }
    }
    else {
      const al = n.strokeAlign || (n.type === 'LINE' || n.type === 'VECTOR' ? 'CENTER' : 'INSIDE');
      for (const g of geo.fill) {
        ctx.save(); ctx.lineJoin = n.strokeJoin === 'ROUND' ? 'round' : n.strokeJoin === 'BEVEL' ? 'bevel' : 'miter'; ctx.lineCap = n.strokeCap === 'ROUND' ? 'round' : n.strokeCap === 'SQUARE' ? 'square' : 'butt';
        if (al === 'INSIDE' && !g.open) { ctx.clip(g.path, g.rule); ctx.lineWidth = sw * 2; }
        else if (al === 'OUTSIDE' && !g.open) { const out = new Path2D(); out.rect(-1e5, -1e5, 2e5, 2e5); out.addPath(g.path); ctx.clip(out, 'evenodd'); ctx.lineWidth = sw * 2; }
        else ctx.lineWidth = sw;
        if (n.dashPattern && n.dashPattern.length) ctx.setLineDash(n.dashPattern);
        strokeWith(ctx, g.path, n, R);
        ctx.restore();
      }
    }
    ctx.restore();
  }
  // recorte de un frame (su forma) en coordenadas de la vista
  function clipTo(ctx, n, M, R) {
    const geo = geometryOf(n, R), p = new Path2D();
    for (const g of geo.fill) p.addPath(g.path, new DOMMatrix(M));
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clip(p);
  }

  // dibuja n (con sus hijos) sobre ctx; M = matriz de la vista × la del padre
  function drawNode(ctx, n, PM, R) {
    if (n.visible === false || n.type === 'SLICE') return;
    const M = mul(PM, mat(n.transform));
    const fx = liveFx(n), op = n.opacity ?? 1;
    const blend = n.blendMode && n.blendMode !== 'PASS_THROUGH' && n.blendMode !== 'NORMAL' ? BLEND[n.blendMode] : null;
    const needLayer = op < 1 || blend || fx.length;
    if (!needLayer) { body(ctx, n, M, R); return; }
    const Lr = layer(R);
    if (!blend && !fx.length) {   // solo opacidad: fondo + nodo, mezclado con el fondo según la opacidad
      Lr.ctx.drawImage(ctx.canvas, 0, 0); body(Lr.ctx, n, M, R);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = op; ctx.drawImage(Lr.cv, 0, 0); ctx.restore(); Lr.done(); return;
    }
    body(Lr.ctx, n, M, R);
    composite(ctx, Lr, n, M, fx, op, blend, R);
    Lr.done();
  }
  // en kiwi, un grupo de Figma es un FRAME con resizeToFit: no recorta
  const isGroup = (n) => n.type === 'GROUP' || n.type === 'BOOLEAN_OPERATION' || (n.type === 'FRAME' && n.resizeToFit);
  const clips = (n) => ['FRAME', 'COMPONENT', 'INSTANCE', 'SYMBOL', 'COMPONENT_SET'].includes(n.type) && !n.frameMaskDisabled && !n.resizeToFit;
  function body(ctx, n, M, R) {
    drawContent(ctx, n, M, R);
    const kids = n.children || [];
    if (kids.length) {
      ctx.save();
      if (clips(n)) clipTo(ctx, n, M, R);
      drawChildren(ctx, kids, M, R);
      ctx.restore();
    }
    drawStrokes(ctx, n, M, R);
  }
  // hijos, con máscaras: un hijo mask=true recorta a los hermanos que tiene encima
  function drawChildren(ctx, kids, M, R) {
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i];
      if (k.mask && k.visible !== false) {
        const Lr = layer(R), Lm = layer(R);
        Lr.ctx.drawImage(ctx.canvas, 0, 0);    // fondo: Overlay y demás fusiones de lo enmascarado lo necesitan
        let j = i + 1; for (; j < kids.length; j++) drawNode(Lr.ctx, kids[j], M, R);
        // máscara: alfa (o luminancia) de la forma de la máscara
        const km = { ...k, mask: false, effects: [], opacity: 1 };
        Object.defineProperty(km, '_geo', { value: k._geo, writable: true, configurable: true, enumerable: false });
        drawNode(Lm.ctx, km, M, R);
        if (k.maskType === 'LUMINANCE') lumToAlpha(Lm.ctx, R);
        Lr.ctx.setTransform(1, 0, 0, 1, 0, 0); Lr.ctx.globalCompositeOperation = 'destination-in'; Lr.ctx.drawImage(Lm.cv, 0, 0);
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'destination-out'; ctx.drawImage(Lm.cv, 0, 0);   // hueco con la forma de la máscara…
        ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(Lr.cv, 0, 0);      // …relleno con fondo + contenido
        ctx.restore();
        Lr.done(); Lm.done(); return;
      }
      drawNode(ctx, k, M, R);
    }
  }
  function lumToAlpha(x, R) {
    const d = x.getImageData(0, 0, R.W, R.H), p = d.data;
    for (let i = 0; i < p.length; i += 4) { const l = (0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2]) / 255; p[i + 3] = Math.round(l * p[i + 3]); }
    x.putImageData(d, 0, 0);
  }
  // extensión de una sombra: dilatar (copias desplazadas en círculo) o erosionar la silueta
  function spread(Lr, s, R) {
    if (Math.abs(s) < 0.25) return Lr;
    const S = layer(R), x = S.ctx, N = Math.max(8, Math.min(32, Math.ceil(Math.abs(s) * 4)));
    if (s > 0) { for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; x.drawImage(Lr.cv, Math.cos(a) * s, Math.sin(a) * s); } x.drawImage(Lr.cv, 0, 0); }
    else { x.drawImage(Lr.cv, 0, 0); x.globalCompositeOperation = 'destination-in'; for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; x.drawImage(Lr.cv, Math.cos(a) * -s, Math.sin(a) * -s); } }
    return S;
  }
  // silueta opaca de una capa (donde hay algo, alfa 1; los bordes suavizados se conservan)
  function silhouette(Lr, R) {
    const S = layer(R); S.ctx.drawImage(Lr.cv, 0, 0);
    const d = S.ctx.getImageData(0, 0, R.W, R.H), p = d.data;
    for (let i = 3; i < p.length; i += 4) if (p[i]) p[i] = Math.min(255, p[i] * 64);
    S.ctx.putImageData(d, 0, 0); return S;
  }
  // capa del nodo -> destino, con sombras, desenfoque, opacidad y fusión
  function composite(ctx, Lr, n, M, fx, op, blend, R) {
    let SIL = null; const sil = () => SIL || (SIL = silhouette(Lr, R));
    const k = Math.hypot(M[0], M[1]) || 1;          // escala de la vista (px de pantalla por px de diseño)
    const sigma = (r) => (FX() ? FX().blurSigma(r) : r / 2.3548) * k;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    // sombras paralelas (detrás)
    for (const e of fx.filter((x) => x.type === 'DROP_SHADOW')) {
      const S = layer(R), x = S.ctx, o = app(M, e.offset?.x || 0, e.offset?.y || 0), o0 = app(M, 0, 0);
      const src = spread(Lr, (e.spread || 0) * k, R);
      x.filter = `blur(${sigma(e.radius || 0)}px)`; x.drawImage(src.cv, o[0] - o0[0], o[1] - o0[1]); x.filter = 'none'; if (src !== Lr) src.done();
      x.globalCompositeOperation = 'source-in'; x.fillStyle = css(e.color || { r: 0, g: 0, b: 0, a: 0.25 }); x.fillRect(0, 0, R.W, R.H);
      if (!e.showShadowBehindNode) { x.globalCompositeOperation = 'destination-out'; x.drawImage(sil().cv, 0, 0); }   // oculta bajo la forma
      ctx.globalAlpha = op; ctx.globalCompositeOperation = BLEND[e.blendMode] || blend || 'source-over'; ctx.drawImage(S.cv, 0, 0); S.done();
    }
    // sombra interior: fuera de la forma, desplazado y difuminado, recortado a la forma
    for (const e of fx.filter((x) => x.type === 'INNER_SHADOW')) {
      const S = layer(R), x = S.ctx, o = app(M, e.offset?.x || 0, e.offset?.y || 0), o0 = app(M, 0, 0);
      x.fillStyle = '#000'; x.fillRect(0, 0, R.W, R.H); x.globalCompositeOperation = 'destination-out';
      x.filter = 'none'; x.drawImage(Lr.cv, o[0] - o0[0], o[1] - o0[1]);
      const S2 = layer(R); S2.ctx.filter = `blur(${sigma(e.radius || 0)}px)`; S2.ctx.drawImage(S.cv, 0, 0); S2.ctx.filter = 'none';
      S2.ctx.globalCompositeOperation = 'source-in'; S2.ctx.fillStyle = css(e.color || { r: 0, g: 0, b: 0, a: 0.25 }); S2.ctx.fillRect(0, 0, R.W, R.H);
      S2.ctx.globalCompositeOperation = 'destination-in'; S2.ctx.drawImage(Lr.cv, 0, 0);
      Lr.ctx.setTransform(1, 0, 0, 1, 0, 0); Lr.ctx.globalCompositeOperation = BLEND[e.blendMode] || 'source-atop'; Lr.ctx.drawImage(S2.cv, 0, 0); Lr.ctx.globalCompositeOperation = 'source-over';
      S.done(); S2.done();
    }
    // desenfoque de fondo: lo que hay detrás, difuminado y recortado a la silueta del nodo (bajo el nodo)
    for (const e of fx.filter((x) => x.type === 'BACKGROUND_BLUR')) {
      const S = layer(R); S.ctx.filter = `blur(${sigma(e.radius || 0)}px)`; S.ctx.drawImage(ctx.canvas, 0, 0); S.ctx.filter = 'none';
      S.ctx.globalCompositeOperation = 'destination-in'; S.ctx.drawImage(sil().cv, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(S.cv, 0, 0); S.done();
    }
    const blur = fx.find((x) => x.type === 'FOREGROUND_BLUR');
    ctx.globalAlpha = op; ctx.globalCompositeOperation = blend || 'source-over';
    if (blur) ctx.filter = `blur(${sigma(blur.radius || 0)}px)`;
    ctx.drawImage(Lr.cv, 0, 0);
    ctx.restore();
    if (SIL) SIL.done();
  }

  // ---------------------------------------------------------------- API
  // R = { doc, W, H, version, onAsset, imageBase, layoutText }; view = [a,b,c,d,e,f] (diseño -> pantalla)
  function renderPage(ctx, page, view, R) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    const bg = page.backgroundColor; ctx.fillStyle = bg ? css(bg) : '#1e1e1e'; ctx.fillRect(0, 0, R.W, R.H);
    ctx.restore();
    for (const n of page.children || []) drawNode(ctx, n, view, R);
  }
  function renderNodes(ctx, nodes, view, R) { for (const n of nodes) drawNode(ctx, n, view, R); }
  root.FigRender = { isGroup, clips, renderPage, renderNodes, drawNode, mat, mul, inv, app, blobPath, b64bytes, geometryOf, radiiOf, hexOf, imageOf, css, BLEND };
})(typeof self !== 'undefined' ? self : this);
