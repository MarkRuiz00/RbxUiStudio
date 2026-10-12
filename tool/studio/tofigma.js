/* RbxUI -> Figma (navegador). Escena nativa -> descripción de nodos de Figma (ver figexport.mjs) + imágenes { sha1: base64 }.
   Se pinta la escena fuera de pantalla con el mismo render del editor para leer lo que solo existe en el DOM (tamaño de los
   TextScaled, ancho real de los textos, texto enriquecido ya resuelto); el resto sale de las props, igual que el render:
     Frame/Text/Image -> FRAME (fondo, UIGradient, UICorner, UIStroke, recorte, CanvasGroup) · texto -> TEXT dentro
     UIListLayout + UIPadding -> auto layout · ImageLabel -> relleno de imagen (tinte, 9-slice: horneados a PNG) */
(function (root, factory) {
  root.RBXToFigma = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const R = () => window.RBXJson;
  const r2 = (v) => Math.round(v * 100) / 100;
  const rgb = (h) => { const c = R().hex(h); return { r: c[0] / 255, g: c[1] / 255, b: c[2] / 255 }; };
  const rgbArr = (c) => ({ r: c[0] / 255, g: c[1] / 255, b: c[2] / 255 });

  // ---------------------------------------------------------------- fuentes: estilo de Figma más cercano (figfonts.json)
  let FONTS = null;
  const STYLE_W = { Thin: 100, 'Extra Light': 200, ExtraLight: 200, Light: 300, Regular: 400, Medium: 500, 'Semi Bold': 600, SemiBold: 600, Bold: 700,
    'Extra Bold': 800, ExtraBold: 800, Black: 900, ExtraBlack: 950 };
  function figStyle(family, weight, italic) {
    const list = (FONTS && FONTS[family]) || ['Regular', 'Bold'];
    let best = null, bd = 1e9;
    for (const s of list) {
      const it = /Italic/.test(s), base = s.replace(/\s*Italic$/, '').trim() || 'Regular';
      if (/Condensed|Expanded/.test(base) || STYLE_W[base] == null) continue;
      const d = Math.abs(STYLE_W[base] - weight) + (it !== italic ? 1000 : 0);
      if (d < bd) { bd = d; best = s; }
    }
    return best || 'Regular';
  }

  // ---------------------------------------------------------------- degradados (UIGradient, como gradCss del render: ángulo CSS rot+90)
  function gradientPaint(g, base, alpha, W, H) {
    const RJ = R(), mp = (k) => (g.props || {})[k] ?? RJ.DEFAULTS.UIGradient[k];
    const cs = RJ.seqColor(mp('Color')), ts = RJ.seqNum(mp('Transparency'));
    const rot = +mp('Rotation') || 0, off = mp('Offset') || [0, 0];
    const shift = (rot % 180 === 0 ? off[0] : Math.abs(rot % 180) === 90 ? off[1] : 0) * (rot >= 90 && rot < 270 ? -1 : 1);
    const stops = [...new Set([...cs.map((k) => k[0]), ...ts.map((k) => k[0])])].sort((a, b) => a - b).map((t) => {
      const c = RJ.sampleColor(cs, t);
      return { position: Math.min(1, Math.max(0, t)), color: { r: base.r * c[0] / 255, g: base.g * c[1] / 255, b: base.b * c[2] / 255, a: alpha * (1 - RJ.sampleNum(ts, t)) } };
    });
    // línea de degradado CSS para el ángulo θ: pasa por el centro, longitud |W sinθ| + |H cosθ|
    const th = ((rot + 90) * Math.PI) / 180, dx = Math.sin(th), dy = -Math.cos(th), L = Math.abs(W * dx) + Math.abs(H * dy) || 1;
    // t = ((px - W/2)·dx + (py - H/2)·dy) / L + 0.5 - shift, con px = u·W, py = v·H ; fila 2 = perpendicular
    const m00 = W * dx / L, m01 = H * dy / L, m02 = 0.5 - shift - (W / 2 * dx + H / 2 * dy) / L;
    const m10 = -W * dy / L, m11 = H * dx / L, m12 = 0.5 - (-W / 2 * dy + H / 2 * dx) / L;
    return { type: 'GRADIENT_LINEAR', stops, transform: [m00, m01, m02, m10, m11, m12] };
  }

  // ---------------------------------------------------------------- imágenes
  async function sha1hex(buf) { const d = await crypto.subtle.digest('SHA-1', buf); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join(''); }
  const b64 = (buf) => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const loadImg = (url) => new Promise((ok, ko) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => ok(im); im.onerror = () => ko(new Error('imagen: ' + url)); im.src = url; });
  const canvasPng = (cv) => new Promise((ok) => cv.toBlob((b) => b.arrayBuffer().then(ok), 'image/png'));

  // ---------------------------------------------------------------- conversión
  async function build(scene, opts = {}) {
    const RJ = R(), warns = new Set(), images = {};
    if (!scene || !scene.native) throw new Error('solo escenas nativas (rbxui)');
    if (!FONTS) FONTS = await fetch(opts.fonts || 'figfonts.json').then((r) => r.json()).catch(() => ({}));
    const sc = JSON.parse(JSON.stringify(scene));
    sc.nodes.forEach(function w(n) { if (n.rbxClass) RJ.relayout(n); (n.children || []).forEach(w); });
    // render fuera de pantalla (mismo render que el editor) para medir textos
    const host = document.createElement('div');
    host.style.cssText = `position:fixed;left:-100000px;top:0;width:${sc.stage.w}px;height:${sc.stage.h}px;overflow:hidden;`;
    document.body.appendChild(host);
    try {
      window.RBXRender.renderScene(sc, host, {});
      await document.fonts.ready;
      RJ.fitScaled(host);
      const elOf = (n) => host.querySelector(`[data-nid="${CSS.escape(n.id)}"]`);
      const imgCache = new Map();

      async function imagePaint(n, g) {
        const src = RJ.prop(n, 'Image'); if (!src) return null;
        const url = RJ.imageUrl(src, opts.base || '../');
        if (!url) { warns.add('Imagen sin archivo local (' + src + '): se queda sin imagen'); return null; }
        const st = RJ.prop(n, 'ScaleType') || 'Stretch', tint = String(RJ.prop(n, 'ImageColor3') || '#FFFFFF').toUpperCase();
        const grad = RJ.modOf(n, 'UIGradient'), bake = tint !== '#FFFFFF' || grad || st === 'Slice';
        const key = url + '|' + (bake ? [tint, st, g.w, g.h, JSON.stringify(grad && grad.props), JSON.stringify(RJ.prop(n, 'SliceCenter')), RJ.prop(n, 'SliceScale')].join('|') : '');
        let hit = imgCache.get(key);
        if (!hit) {
          let buf, W, H;
          if (!bake) {
            const res = await fetch(url); if (!res.ok) throw new Error('imagen ' + res.status + ': ' + url);
            const type = res.headers.get('content-type') || ''; buf = await res.arrayBuffer();
            const im = await loadImg(url); W = im.naturalWidth; H = im.naturalHeight;
            if (!/^image\/(png|jpeg)/.test(type)) {   // webp/gif/svg -> PNG
              const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.getContext('2d').drawImage(im, 0, 0); buf = await canvasPng(cv);
            }
          } else {
            const im = await loadImg(url), k = 2;
            const cv = document.createElement('canvas');
            if (st === 'Slice') {      // 9-slice horneado al tamaño de la pieza (×2)
              cv.width = Math.max(1, Math.round(g.w * k)); cv.height = Math.max(1, Math.round(g.h * k));
              const cx = cv.getContext('2d'), s = RJ.prop(n, 'SliceCenter') || [0, 0, 0, 0], q = (+RJ.prop(n, 'SliceScale') || 1) * k;
              const iw = im.naturalWidth, ih = im.naturalHeight, xs = [0, s[0], s[2], iw], ys = [0, s[1], s[3], ih];
              const dxs = [0, s[0] * q, cv.width - (iw - s[2]) * q, cv.width], dys = [0, s[1] * q, cv.height - (ih - s[3]) * q, cv.height];
              for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
                const sw = xs[i + 1] - xs[i], sh = ys[j + 1] - ys[j], dw = dxs[i + 1] - dxs[i], dh = dys[j + 1] - dys[j];
                if (sw > 0 && sh > 0 && dw > 0 && dh > 0) cx.drawImage(im, xs[i], ys[j], sw, sh, dxs[i], dys[j], dw, dh);
              }
            } else { cv.width = im.naturalWidth; cv.height = im.naturalHeight; cv.getContext('2d').drawImage(im, 0, 0); }
            if (tint !== '#FFFFFF' || grad) {   // ImageColor3 / UIGradient multiplican el color (el alfa se conserva)
              const mask = document.createElement('canvas'); mask.width = cv.width; mask.height = cv.height; mask.getContext('2d').drawImage(cv, 0, 0);
              const cx = cv.getContext('2d'), t = rgb(tint);
              cx.globalCompositeOperation = 'multiply';
              if (grad) {
                const gp = gradientPaint(grad, t, 1, cv.width, cv.height), [a, b, c] = gp.transform;
                // t = a·u + b·v + c -> extremos del degradado en px del lienzo
                const den = a * a + b * b || 1, u0 = (0 - c) * a / den, v0 = (0 - c) * b / den, u1 = (1 - c) * a / den, v1 = (1 - c) * b / den;
                const lg = cx.createLinearGradient(u0 * cv.width, v0 * cv.height, u1 * cv.width, v1 * cv.height);
                for (const s of gp.stops) lg.addColorStop(s.position, `rgb(${s.color.r * 255},${s.color.g * 255},${s.color.b * 255})`);
                cx.fillStyle = lg;
              } else cx.fillStyle = `rgb(${t.r * 255},${t.g * 255},${t.b * 255})`;
              cx.fillRect(0, 0, cv.width, cv.height);
              cx.globalCompositeOperation = 'destination-in';
              cx.drawImage(mask, 0, 0);
            }
            buf = await canvasPng(cv); W = cv.width; H = cv.height;
          }
          const hash = await sha1hex(buf);
          images[hash] = b64(buf);
          hit = { hash, W, H };
          imgCache.set(key, hit);
        }
        const mode = st === 'Fit' ? 'FIT' : st === 'Crop' ? 'FILL' : st === 'Tile' ? 'TILE' : 'STRETCH';
        const p = { type: 'IMAGE', hash: hit.hash, scaleMode: mode, imgW: hit.W, imgH: hit.H };
        if (mode === 'TILE') { const ts = RJ.prop(n, 'TileSize') || [1, 0, 1, 0]; p.scale = r2(RJ.udim([ts[0], ts[1]], g.w) / (hit.W || 1)) || 1; }
        const it = +RJ.prop(n, 'ImageTransparency') || 0; if (it) p.opacity = 1 - it;
        return p;
      }

      async function convert(n) {
        const g = n.disp || n, cls = n.rbxClass, p = (k) => RJ.prop(n, k);
        const d = { type: 'FRAME', name: n.name || cls, x: r2(n.x), y: r2(n.y), w: r2(g.w), h: r2(g.h), rot: n.rot || 0, visible: !n.hidden,   // como el editor: Visible=false (ventanas que abren los botones) se ve y se edita
          fills: [], strokes: [], clip: !!(p('ClipsDescendants') || cls === 'CanvasGroup' || cls === 'ScrollingFrame'), children: [] };
        if (cls === 'CanvasGroup') d.opacity = 1 - (+p('GroupTransparency') || 0);
        if (RJ.modOf(n, 'UIScale') && +RJ.mp(RJ.modOf(n, 'UIScale'), 'Scale') !== 1) warns.add('UIScale: se exporta sin escalar');
        // fondo
        const bt = +p('BackgroundTransparency'), bg = rgb(p('BackgroundColor3')), grad = RJ.modOf(n, 'UIGradient');
        const bgPaint = bt < 1 ? (grad ? gradientPaint(grad, bg, 1 - bt, g.w, g.h) : { type: 'SOLID', color: bg, opacity: 1 - bt }) : null;
        const rad = RJ.cornerRad({ ...n, w: g.w, h: g.h });
        const miter = RJ.miterStroke({ ...n, w: g.w, h: g.h });
        if (miter) {           // Roblox: contorno Miter sobre UICorner = cuadrado relleno del color del borde, el fondo redondeado dentro
          d.fills.push({ type: 'SOLID', color: rgb(RJ.mp(miter, 'Color')), opacity: 1 - (+RJ.mp(miter, 'Transparency') || 0) });
          if (bgPaint) d.children.push({ type: 'RECTANGLE', name: 'Fill', x: 0, y: 0, w: d.w, h: d.h, radius: r2(rad), fills: [bgPaint] });
        } else { if (bgPaint) d.fills.push(bgPaint); if (rad) d.radius = r2(rad); }
        // contornos de borde
        for (const s of RJ.modsOf(n, 'UIStroke')) {
          if (RJ.mp(s, 'ApplyStrokeMode') === 'Contextual' && RJ.TEXT.has(cls)) continue;
          const t = +RJ.mp(s, 'Thickness') || 0; if (!t) continue;
          const sg = (s.children || []).find((x) => x.ClassName === 'UIGradient' && RJ.mp(x, 'Enabled') !== false);
          const a = 1 - (+RJ.mp(s, 'Transparency') || 0), c = rgb(RJ.mp(s, 'Color'));
          d.strokes.push(sg ? gradientPaint(sg, c, a, g.w, g.h) : { type: 'SOLID', color: c, opacity: a });
          d.strokeWeight = t;
          const pos = RJ.mp(s, 'BorderStrokePosition');
          d.strokeAlign = pos === 'Inner' ? 'INSIDE' : pos === 'Center' ? 'CENTER' : 'OUTSIDE';
          break;    // Figma: un grosor por nodo
        }
        const bs = +p('BorderSizePixel') || 0;
        if (bs > 0 && bt < 1 && !d.strokes.length) { d.strokes.push({ type: 'SOLID', color: rgb(p('BorderColor3')), opacity: 1 - bt }); d.strokeWeight = bs; d.strokeAlign = 'OUTSIDE'; }
        // imagen
        if (RJ.IMAGE.has(cls)) { try { const ip = await imagePaint(n, g); if (ip) (miter && d.children[0] ? d.children[0].fills : d.fills).push(ip); } catch (e) { warns.add(String(e.message || e)); } }
        // texto
        if (RJ.TEXT.has(cls)) {
          const el = elOf(n), span = el && el.querySelector('.rbx-text > span');
          const f = RJ.fontOf(n), fam = f.css || RJ.CSS_FAMILY[f.family] || f.family;
          const pad = RJ.paddingOf(n, g.w, g.h), cw = Math.max(1, g.w - pad.l - pad.r), ch = Math.max(1, g.h - pad.t - pad.b);
          const size = span ? parseFloat(getComputedStyle(span).fontSize) : (+p('TextSize') || 14) * RJ.TEXT_K;
          const wrap = !!p('TextWrapped') || !!p('TextScaled');
          let chars = span ? span.textContent : String(p('Text') ?? '');
          let tc = rgb(p('TextColor3')), ta = 1 - (+p('TextTransparency') || 0);
          if (cls === 'TextBox' && !String(p('Text') || '')) { chars = String(p('PlaceholderText') || ''); tc = rgb(p('PlaceholderColor3')); }
          const xa = p('TextXAlignment'), ya = p('TextYAlignment');
          let tx = pad.l, tw = cw;
          if (!wrap && span) {      // sin ajuste: Figma partiría la línea en un cuadro fijo; se ensancha al texto y se alinea
            const sw = span.offsetWidth + 2;
            if (sw > cw) { tw = sw; tx = xa === 'Left' ? pad.l : xa === 'Right' ? pad.l + cw - sw : pad.l + (cw - sw) / 2; }
          }
          const t = { type: 'TEXT', name: chars.slice(0, 40) || 'Text', x: r2(tx), y: r2(pad.t), w: r2(tw), h: r2(ch), fills: [], strokes: [],
            text: { characters: chars, family: fam, style: figStyle(fam, RJ.WEIGHTS[f.weight] || 400, f.style === 'Italic'), size: r2(size),
              alignH: xa === 'Left' ? 'LEFT' : xa === 'Right' ? 'RIGHT' : 'CENTER', alignV: ya === 'Top' ? 'TOP' : ya === 'Bottom' ? 'BOTTOM' : 'CENTER',
              autoResize: 'NONE', lineHeight: r2(112 * (+p('LineHeight') || 1)) } };
          if (p('TextTruncate') === 'AtEnd') { t.text.truncate = true; t.text.maxLines = wrap ? Math.max(1, Math.floor(ch / (size * 1.12))) : 1; }
          t.fills.push(grad ? gradientPaint(grad, tc, ta, tw, ch) : { type: 'SOLID', color: tc, opacity: ta });
          const ts = RJ.modsOf(n, 'UIStroke').find((s) => RJ.mp(s, 'ApplyStrokeMode') !== 'Border');
          if (ts && (+RJ.mp(ts, 'Thickness') || 0) > 0) {
            t.strokes.push({ type: 'SOLID', color: rgb(RJ.mp(ts, 'Color')), opacity: (1 - (+RJ.mp(ts, 'Transparency') || 0)) * ta });
            t.strokeWeight = +RJ.mp(ts, 'Thickness'); t.strokeAlign = 'OUTSIDE';
          } else if (+p('TextStrokeTransparency') < 1) {
            t.strokes.push({ type: 'SOLID', color: rgb(p('TextStrokeColor3')), opacity: 1 - +p('TextStrokeTransparency') }); t.strokeWeight = 1; t.strokeAlign = 'OUTSIDE';
          }
          // etiqueta simple (sin fondo, borde ni hijos): el TEXT solo, en el sitio de la pieza
          if (!d.fills.length && !d.strokes.length && !d.children.length && !(n.children || []).length && !d.rot && !pad.l && !pad.t && !pad.r && !pad.b) {
            Object.assign(t, { name: d.name, x: r2(d.x + t.x), y: r2(d.y + t.y), visible: d.visible });
            return t;
          }
          d.children.push(t);
        }
        // auto layout (UIListLayout + UIPadding)
        const list = RJ.modOf(n, 'UIListLayout');
        const kids = [...(n.children || [])];
        if (list) {
          const mp = (k) => RJ.mp(list, k), vert = mp('FillDirection') !== 'Horizontal', pad = RJ.paddingOf(n, g.w, g.h);
          const A = { Left: 'MIN', Top: 'MIN', Center: 'CENTER', Right: 'MAX', Bottom: 'MAX' };
          const flex = vert ? mp('VerticalFlex') : mp('HorizontalFlex');
          const as = RJ.prop(n, 'AutomaticSize') || 'None';
          d.layout = { mode: vert ? 'VERTICAL' : 'HORIZONTAL', spacing: r2(RJ.udim(mp('Padding'), vert ? g.h - pad.t - pad.b : g.w - pad.l - pad.r)),
            padding: [r2(pad.l), r2(pad.t), r2(pad.r), r2(pad.b)],
            primary: flex === 'SpaceBetween' ? 'SPACE_BETWEEN' : flex === 'SpaceEvenly' ? 'SPACE_EVENLY' : flex === 'SpaceAround' ? 'SPACE_AROUND' : A[vert ? mp('VerticalAlignment') : mp('HorizontalAlignment')] || 'MIN',
            counter: A[vert ? mp('HorizontalAlignment') : mp('VerticalAlignment')] || 'MIN', wrap: !!mp('Wraps'),
            hugPrimary: vert ? /Y/.test(as) : /X/.test(as), hugCounter: vert ? /X/.test(as) : /Y/.test(as) };
          kids.sort((a, b) => (vert ? a.y - b.y : a.x - b.x));          // el orden de Figma = orden visual del UIListLayout
          if (d.children.length) d.children.forEach((c) => { c.absolute = true; });
        } else if (RJ.modOf(n, 'UIGridLayout')) warns.add('UIGridLayout: se exporta con posiciones fijas');
        // hijos, por ZIndex (Sibling) y orden
        const conv = [];
        for (let i = 0; i < kids.length; i++) {
          const k = kids[i]; if (!k.rbxClass) continue;
          const c = await convert(k);
          if (list) { const fi = RJ.modOf(k, 'UIFlexItem'); if (fi && RJ.mp(fi, 'FlexMode') !== 'None') c.grow = true; }
          conv.push([+RJ.prop(k, 'ZIndex') || 1, i, c]);
        }
        if (!list) conv.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        d.children.push(...conv.map((x) => x[2]));
        return d;
      }

      const rootF = { type: 'FRAME', name: sc.name || 'RbxUI', x: 0, y: 0, w: sc.stage.w, h: sc.stage.h, clip: true, fills: [], strokes: [], children: [] };
      const bg = sc.design && sc.design.background;
      if (typeof bg === 'string' && /^#?[0-9a-f]{6}$/i.test(bg)) rootF.fills.push({ type: 'SOLID', color: rgb(bg) });
      const tops = [];
      for (let i = 0; i < sc.nodes.length; i++) { const n = sc.nodes[i]; if (n.rbxClass) tops.push([+RJ.prop(n, 'ZIndex') || 1, i, await convert(n)]); }
      tops.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      rootF.children = tops.map((x) => x[2]);
      return { roots: [rootF], images, warns: [...warns] };
    } finally { host.remove(); }
  }
  return { build, figStyle };
});
