/* Fig — maquetación: texto (cuando no trae los glifos de Figma) y auto layout (stackMode).
   Campos kiwi de Figma: textData.characters / characterStyleIDs / styleOverrideTable, fontName, fontSize, lineHeight
   ({units:'PERCENT', value:100} = automático: altura natural de la fuente), letterSpacing, textAlignHorizontal/Vertical,
   textAutoResize (NONE | HEIGHT | WIDTH_AND_HEIGHT); stackMode, stackSpacing, stack*Padding, stackPrimaryAlignItems,
   stackCounterAlignItems, stackPrimarySizing / stackCounterSizing, stackChildPrimaryGrow, stackChildAlignSelf, stackPositioning. */
(function (root) {
  'use strict';
  // ---------------------------------------------------------------- fuentes (Google Fonts bajo demanda)
  const WEIGHT = { thin: 100, hairline: 100, extralight: 200, 'extra light': 200, ultralight: 200, light: 300, regular: 400, normal: 400, book: 400, medium: 500,
    semibold: 600, 'semi bold': 600, demibold: 600, bold: 700, extrabold: 800, 'extra bold': 800, ultrabold: 800, black: 900, heavy: 900, extrablack: 950 };
  function styleInfo(style) {
    const s = String(style || 'Regular').toLowerCase(), italic = /italic|oblique/.test(s), base = s.replace(/italic|oblique/g, '').trim() || 'regular';
    return { weight: WEIGHT[base] || WEIGHT[base.replace(/\s+/g, '')] || 400, italic };
  }
  const loaded = new Set(), pending = new Map();
  let onFont = null;
  function ensureFont(family, style) {
    const { weight, italic } = styleInfo(style), key = `${family}|${weight}|${italic}`;
    if (loaded.has(key)) return true;
    if (!pending.has(key)) {
      const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:ital,wght@${italic ? 1 : 0},${weight}&display=block`;
      if (!document.querySelector(`link[href="${href}"]`)) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); }
      pending.set(key, document.fonts.load(`${italic ? 'italic ' : ''}${weight} 16px "${family}"`).catch(() => {}).then(() => { loaded.add(key); pending.delete(key); onFont && onFont(); }));
    }
    return false;
  }
  const fontCss = (fam, style, size) => { const { weight, italic } = styleInfo(style); return `${italic ? 'italic ' : ''}${weight} ${size}px "${fam}", Inter, sans-serif`; };

  // ---------------------------------------------------------------- texto
  const mctx = document.createElement('canvas').getContext('2d');
  // estilo de cada carácter (base + styleOverrideTable)
  function charStyles(n) {
    const base = { family: n.fontName?.family || 'Inter', style: n.fontName?.style || 'Regular', size: n.fontSize || 12, ls: n.letterSpacing, lh: n.lineHeight, deco: n.textDecoration };
    const tab = new Map((n.textData?.styleOverrideTable || []).map((s) => [s.styleID, s])), ids = n.textData?.characterStyleIDs || [];
    const cache = new Map();
    return (i) => {
      const id = ids[i] || 0; if (!id) return { ...base, id: 0 };
      if (cache.has(id)) return cache.get(id);
      const o = tab.get(id) || {}, st = { family: o.fontName?.family || base.family, style: o.fontName?.style || base.style, size: o.fontSize || base.size,
        ls: o.letterSpacing || base.ls, lh: o.lineHeight || base.lh, deco: o.textDecoration || base.deco, id };
      cache.set(id, st); return st;
    };
  }
  const lsPx = (ls, size) => (!ls ? 0 : ls.units === 'PIXELS' ? ls.value : (ls.value || 0) / 100 * size);
  function natural(st) {   // altura natural y ascenso de la fuente (px)
    mctx.font = fontCss(st.family, st.style, st.size);
    const m = mctx.measureText('Hg'), a = m.fontBoundingBoxAscent ?? st.size * 0.95, d = m.fontBoundingBoxDescent ?? st.size * 0.25;
    return { asc: a, desc: d, h: a + d };
  }
  function lineH(st) {
    const lh = st.lh;
    if (!lh || (lh.units === 'PERCENT' && Math.abs(lh.value - 100) < 1e-3) || lh.units === 'RAW' && !lh.value) return natural(st).h;
    if (lh.units === 'PIXELS') return lh.value;
    if (lh.units === 'RAW') return lh.value * st.size;
    return lh.value / 100 * st.size;
  }
  // -> { runs:[{text,x,y,font,ci}], lines:[...], w, h } en px del nodo. maxW = null: sin ajuste de línea
  function layoutText(n) {
    const chars = String(n.textData?.characters ?? ''), styleAt = charStyles(n);
    let ready = true;
    for (let i = 0; i < chars.length; i++) { const st = styleAt(i); if (!ensureFont(st.family, st.style)) ready = false; }
    if (!chars.length) { const st = styleAt(0); ensureFont(st.family, st.style); }
    const ar = n.textAutoResize || 'NONE', W = n.size?.x || 0, maxW = ar === 'WIDTH_AND_HEIGHT' ? Infinity : W;
    // palabras -> líneas
    const lines = []; let cur = { items: [], w: 0, h: 0, asc: 0 };
    const pushLine = () => { lines.push(cur); cur = { items: [], w: 0, h: 0, asc: 0 }; };
    const width = (s, st) => { mctx.font = fontCss(st.family, st.style, st.size); mctx.letterSpacing = lsPx(st.ls, st.size) + 'px'; return mctx.measureText(s).width; };
    let i = 0;
    while (i < chars.length) {
      if (chars[i] === '\n') { if (!cur.items.length) { const st = styleAt(i); cur.h = lineH(st); cur.asc = natural(st).asc; } pushLine(); i++; continue; }
      // siguiente trozo: palabra + espacios, con el mismo estilo
      let j = i; const st = styleAt(i);
      while (j < chars.length && chars[j] !== '\n' && styleAt(j).id === st.id && !(chars[j] === ' ' && j > i && chars[j - 1] !== ' ')) j++;
      while (j < chars.length && chars[j] === ' ' && styleAt(j).id === st.id) j++;
      const piece = chars.slice(i, j), pw = width(piece, st), trimmed = width(piece.replace(/ +$/, ''), st);
      if (cur.items.length && cur.w + trimmed > maxW + 0.5) pushLine();
      cur.items.push({ text: piece, w: pw, st, ci: i }); cur.w += pw;
      cur.h = Math.max(cur.h, lineH(st)); cur.asc = Math.max(cur.asc, natural(st).asc);
      i = j;
    }
    if (cur.items.length || !lines.length) { if (!cur.items.length) { const st = styleAt(0); cur.h = lineH(st); cur.asc = natural(st).asc; } pushLine(); }
    const tw = Math.max(0, ...lines.map((l) => l.items.reduce((a, it, k) => a + (k === l.items.length - 1 ? width(it.text.replace(/ +$/, ''), it.st) : it.w), 0)));
    const th = lines.reduce((a, l) => a + l.h, 0);
    const boxW = ar === 'WIDTH_AND_HEIGHT' ? tw : W, boxH = ar === 'NONE' ? n.size?.y || 0 : th;
    const va = n.textAlignVertical || 'TOP', ha = n.textAlignHorizontal || 'LEFT';
    let y = va === 'CENTER' ? (boxH - th) / 2 : va === 'BOTTOM' ? boxH - th : 0;
    // runs (para pintar) + posición de cada carácter y líneas (para generar los glifos de Figma al exportar, studio/figtext.mjs)
    const runs = [], cpos = [], lout = [], styles = new Map();
    for (const l of lines) {
      const lw = l.items.reduce((a, it, k) => a + (k === l.items.length - 1 ? width(it.text.replace(/ +$/, ''), it.st) : it.w), 0);
      let x = ha === 'CENTER' ? (boxW - lw) / 2 : ha === 'RIGHT' ? boxW - lw : 0;
      const nat = l.items.length ? natural(l.items[0].st) : { asc: l.asc, h: l.h };
      const base = y + (l.h - nat.h) / 2 + l.asc;
      const li = lout.length, first = l.items.length ? l.items[0].ci : 0;
      for (const it of l.items) {
        runs.push({ text: it.text, x, y: base, font: fontCss(it.st.family, it.st.style, it.st.size), ls: lsPx(it.st.ls, it.st.size), ci: it.ci });
        for (let k = 0; k < it.text.length; k++) {
          const cx = x + (k ? width(it.text.slice(0, k), it.st) : 0), cw = width(it.text[k], it.st);
          cpos.push({ i: it.ci + k, x: cx, base, line: li, s: it.st.id, w: cw });
        }
        if (it.st.id && !styles.has(it.st.id)) { const si = styleInfo(it.st.style); styles.set(it.st.id, { id: it.st.id, family: it.st.family, style: it.st.style, weight: si.weight, italic: si.italic, size: it.st.size, deco: it.st.deco === 'STRIKETHROUGH' ? 'line-through' : it.st.deco === 'UNDERLINE' ? 'underline' : '' }); }
        x += it.w;
      }
      const end = l.items.length ? l.items[l.items.length - 1].ci + l.items[l.items.length - 1].text.length : first;
      lout.push({ top: y, height: l.h, base, x: ha === 'CENTER' ? (boxW - lw) / 2 : ha === 'RIGHT' ? boxW - lw : 0, width: lw, first, end });
      y += l.h;
    }
    return { runs, w: tw, h: th, boxW, boxH, ready, chars: cpos, lines: lout, styles: [...styles.values()] };
  }

  // ---------------------------------------------------------------- auto layout
  const kidsOf = (n) => (n.children || []).filter((k) => k.visible !== false && k.stackPositioning !== 'ABSOLUTE');
  const sz = (k) => [k.size?.x || 0, k.size?.y || 0];
  const setPos = (k, x, y) => { k.transform = { ...(k.transform || { m00: 1, m01: 0, m10: 0, m11: 1 }), m02: x, m12: y }; };
  const fit = (v) => v === 'RESIZE_TO_FIT' || v === 'RESIZE_TO_FIT_WITH_IMPLICIT_SIZE';
  // recoloca los hijos de n (y su tamaño si abraza); devuelve true si cambió el tamaño de n
  function stack(n) {
    if (!n.stackMode || n.stackMode === 'NONE' || n.stackMode === 'GRID') return false;
    const H = n.stackMode === 'HORIZONTAL', P = H ? 0 : 1, C = 1 - P;
    const pl = n.stackHorizontalPadding ?? n.stackPadding ?? 0, pt = n.stackVerticalPadding ?? n.stackPadding ?? 0;
    const pr = n.stackPaddingRight ?? pl, pb = n.stackPaddingBottom ?? pt;
    const padS = H ? [pl, pr] : [pt, pb], padC = H ? [pt, pb] : [pl, pr];
    const gap = n.stackSpacing || 0, kids = kidsOf(n);
    const size = sz(n), old = [...size];
    const hugP = fit(n.stackPrimarySizing), hugC = fit(n.stackCounterSizing);
    // tamaño en el eje transversal
    const crossAvail = size[C] - padC[0] - padC[1];
    for (const k of kids) if (k.stackChildAlignSelf === 'STRETCH' && !hugC) { const s = sz(k); s[C] = Math.max(0, crossAvail); k.size = { x: s[0], y: s[1] }; }
    // rellenar en el eje principal
    const grow = kids.filter((k) => (k.stackChildPrimaryGrow || 0) > 0);
    const fixedSum = kids.filter((k) => !((k.stackChildPrimaryGrow || 0) > 0)).reduce((a, k) => a + sz(k)[P], 0);
    if (grow.length && !hugP) {
      const free = size[P] - padS[0] - padS[1] - fixedSum - gap * Math.max(0, kids.length - 1), each = Math.max(0, free / grow.length);
      for (const k of grow) { const s = sz(k); s[P] = each; k.size = { x: s[0], y: s[1] }; }
    }
    const total = kids.reduce((a, k) => a + sz(k)[P], 0) + gap * Math.max(0, kids.length - 1);
    if (hugP) size[P] = total + padS[0] + padS[1];
    if (hugC) size[C] = Math.max(0, ...kids.map((k) => sz(k)[C])) + padC[0] + padC[1];
    n.size = { x: size[0], y: size[1] };
    let pos = padS[0], step = gap;
    const free = size[P] - padS[0] - padS[1] - total, ja = n.stackPrimaryAlignItems || 'MIN';
    if (ja === 'CENTER') pos += free / 2; else if (ja === 'MAX') pos += free;
    else if (ja === 'SPACE_BETWEEN' && kids.length > 1) step = gap + free / (kids.length - 1);
    else if ((ja === 'SPACE_EVENLY' || ja === 'SPACE_EVENLY_CSS') && kids.length) { const g = free / (kids.length + 1); pos += g; step = gap + g; }
    for (const k of kids) {
      const s = sz(k), ca = k.stackChildAlignSelf && k.stackChildAlignSelf !== 'AUTO' && k.stackChildAlignSelf !== 'STRETCH' ? k.stackChildAlignSelf : (n.stackCounterAlignItems || 'MIN');
      const cfree = size[C] - padC[0] - padC[1] - s[C];
      const c = padC[0] + (ca === 'CENTER' ? cfree / 2 : ca === 'MAX' ? cfree : 0);
      if (H) setPos(k, pos, c); else setPos(k, c, pos);
      pos += s[P] + step;
    }
    return old[0] !== size[0] || old[1] !== size[1];
  }
  // texto que abraza: tamaño del nodo según su contenido
  function fitText(n) {
    if (n.type !== 'TEXT' || n.derivedTextData) return false;
    const ar = n.textAutoResize || 'NONE'; if (ar === 'NONE') return false;
    const L = layoutText(n), old = [n.size?.x, n.size?.y];
    n.size = { x: ar === 'WIDTH_AND_HEIGHT' ? Math.ceil(L.w) : n.size.x, y: Math.ceil(L.h) };
    return old[0] !== n.size.x || old[1] !== n.size.y;
  }
  // recalcula de abajo arriba (hijos antes que padres)
  function relayout(n) { for (const k of n.children || []) relayout(k); fitText(n); stack(n); }

  root.FigLayout = { layoutText, relayout, stack, fitText, ensureFont, styleInfo, fontCss, setOnFont: (f) => { onFont = f; } };
})(typeof self !== 'undefined' ? self : this);
