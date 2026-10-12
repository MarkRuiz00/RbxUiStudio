/* RbxUI — fórmulas del renderer de Figma, sacadas de su WASM (compiled_wasm.wasm, shaders GLSL/WGSL) con REA
   y comprobadas contra exportAsync del propio Figma. Compartido: importador (node) y página de horneado (window.FigFX).

   - blendChannel/blendRgb: los 17 modos de fusión tal como los compone Figma (W3C, premultiplicado; shader de fusión, type_ 2..18),
       salvo Soft light, que en Figma tiene las ramas cambiadas respecto a W3C/CSS
   - adjustRgb: ajustes de imagen (exposición, contraste, saturación, temperatura, tinte, luces, sombras) — error máx. 1/255
       el kiwi guarda el contraste ya ×0.3 respecto al panel (= globalContrast del shader); umbral luces/sombras fijo 0.5
   - BLUR_SIGMA: Layer blur y sombras = gaussiano de σ = radio / 2.3548 (el radio de Figma es la anchura a media altura)
   - noise*: ruido de gradiente de 3 octavas del efecto Noise y de Texture (GRAIN); uniforms reales: frecuencia = 1/noiseSize,
       origen = centro del nodo, MONO=1 DUO=2 MULTI=0, banda de densidad. El hash fract(sin·43758) depende del sin de cada GPU:
       no es bit a bit, pero el tamaño de grano y la cobertura por densidad coinciden con Figma. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FigFX = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  // ------------------------------------------------------------------ desenfoque
  const BLUR_SIGMA = 1 / 2.3548;
  const blurSigma = (radius) => (radius || 0) * BLUR_SIGMA;

  // ------------------------------------------------------------------ fusiones (canal a canal, sin premultiplicar: Cb fondo, Cs capa)
  const softD = (C) => (C <= 0.25 ? ((16 * C - 12) * C + 4) * C : Math.sqrt(C));
  const SEP = {
    NORMAL: (b, s) => s, PASS_THROUGH: (b, s) => s,
    DARKEN: (b, s) => Math.min(b, s), MULTIPLY: (b, s) => b * s, LINEAR_BURN: (b, s) => Math.max(0, b + s - 1),
    COLOR_BURN: (b, s) => (b >= 1 ? 1 : s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / s)),
    LIGHTEN: (b, s) => Math.max(b, s), SCREEN: (b, s) => b + s - b * s, LINEAR_DODGE: (b, s) => Math.min(1, b + s),
    COLOR_DODGE: (b, s) => (b <= 0 ? 0 : s >= 1 ? 1 : Math.min(1, b / (1 - s))),
    OVERLAY: (b, s) => (2 * b <= 1 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s)),
    HARD_LIGHT: (b, s) => (2 * s <= 1 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s)),
    // ojo: Figma tiene las ramas de W3C cambiadas (capa > 0.5 usa B·(1-B), capa <= 0.5 usa D(B)); Chrome/CSS usa W3C
    SOFT_LIGHT: (b, s) => (s > 0.5 ? b + (2 * s - 1) * b * (1 - b) : b + (2 * s - 1) * (softD(b) - b)),
    DIFFERENCE: (b, s) => Math.abs(b - s), EXCLUSION: (b, s) => b + s - 2 * b * s,
  };
  const lum = (c) => 0.3 * c.r + 0.59 * c.g + 0.11 * c.b;
  function clipColor(c) {
    const l = lum(c), n = Math.min(c.r, c.g, c.b), x = Math.max(c.r, c.g, c.b);
    if (n < 0) return { r: l + (c.r - l) * l / (l - n), g: l + (c.g - l) * l / (l - n), b: l + (c.b - l) * l / (l - n) };
    if (x > 1) return { r: l + (c.r - l) * (1 - l) / (x - l), g: l + (c.g - l) * (1 - l) / (x - l), b: l + (c.b - l) * (1 - l) / (x - l) };
    return c;
  }
  const setLum = (c, l) => { const d = l - lum(c); return clipColor({ r: c.r + d, g: c.g + d, b: c.b + d }); };
  const sat = (c) => Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
  function setSat(c, s) {
    const n = Math.min(c.r, c.g, c.b), x = Math.max(c.r, c.g, c.b), d = x - n;
    if (d <= 0) return { r: 0, g: 0, b: 0 };
    return { r: (c.r - n) * s / d, g: (c.g - n) * s / d, b: (c.b - n) * s / d };
  }
  const NONSEP = {
    HUE: (b, s) => setLum(setSat(s, sat(b)), lum(b)), SATURATION: (b, s) => setLum(setSat(b, sat(s)), lum(b)),
    COLOR: (b, s) => setLum(s, lum(b)), LUMINOSITY: (b, s) => setLum(b, lum(s)),
  };
  // color resultante (opaco) de pintar T con el modo `mode` sobre B; colores {r,g,b} 0..1
  function blendRgb(mode, B, T) {
    if (NONSEP[mode]) { const o = NONSEP[mode](B, T); return { r: clamp01(o.r), g: clamp01(o.g), b: clamp01(o.b) }; }
    const f = SEP[mode] || SEP.NORMAL;
    return { r: clamp01(f(B.r, T.r)), g: clamp01(f(B.g, T.g)), b: clamp01(f(B.b, T.b)) };
  }
  const blendChannel = (mode, b, s) => (SEP[mode] || SEP.NORMAL)(b, s);
  // ¿la fusión es lineal en la capa por mitades y neutra en gris medio? -> se puede hacer exacta con capas de luz/sombra teñidas
  const SPLIT_EXACT = { OVERLAY: 1, SOFT_LIGHT: 1, HARD_LIGHT: 1 };
  // mix-blend-mode CSS equivalente (Chrome no tiene plus-darker: LINEAR_BURN no tiene equivalente CSS)
  const CSS_BLEND = { MULTIPLY: 'multiply', SCREEN: 'screen', OVERLAY: 'overlay', DARKEN: 'darken', LIGHTEN: 'lighten', COLOR_DODGE: 'color-dodge',
    COLOR_BURN: 'color-burn', HARD_LIGHT: 'hard-light', SOFT_LIGHT: 'soft-light', DIFFERENCE: 'difference', EXCLUSION: 'exclusion', HUE: 'hue',
    SATURATION: 'saturation', COLOR: 'color', LUMINOSITY: 'luminosity', LINEAR_DODGE: 'plus-lighter', LINEAR_BURN: 'multiply' };

  // ------------------------------------------------------------------ ajustes de imagen (shader de pintura de imagen)
  const LW = [0.2126, 0.7152, 0.0722];
  const XYZ = [[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]];
  const RGB = [[3.2404542, -1.5371385, -0.4985314], [-0.9692660, 1.8760108, 0.0415560], [0.0556434, -0.2040259, 1.0572252]];
  const hasAdjust = (f) => !!f && ['exposure', 'contrast', 'saturation', 'temperature', 'tint', 'highlights', 'shadows'].some((k) => Math.abs(f[k] || 0) > 1e-4);
  // uniforms del shader a partir del paintFilter del kiwi de Figma (portapapeles / .fig). Ojo: el kiwi ya guarda el contraste
  // escalado (panel/API de plugins 0.4 -> kiwi 0.12); el resto de campos van tal cual
  const adjustUniforms = (f) => ({ exp: f.exposure || 0, con: f.contrast || 0, sat: f.saturation || 0, temp: f.temperature || 0,
    tint: f.tint || 0, hi: f.highlights || 0, sh: f.shadows || 0, thr: 0.5 });
  // c = [r,g,b] 0..1 en sRGB, sin premultiplicar
  function adjustRgb(c, U) {
    const dot = (v) => v[0] * LW[0] + v[1] * LW[1] + v[2] * LW[2];
    c = [Math.pow(c[0], 2.2), Math.pow(c[1], 2.2), Math.pow(c[2], 2.2)];
    const hl = dot(c) - Math.pow(U.thr, 2.2);
    const e = 0.75 * hl / Math.sqrt(1 + 4 * hl * hl) * (hl > 0 ? U.hi : -U.sh * 0.999);
    { // temperatura / tinte / contraste en Lab
      let a = XYZ.map((r) => r[0] * c[0] + r[1] * c[1] + r[2] * c[2]); a[0] /= 0.95047; a[2] /= 1.08883; a = a.map(Math.cbrt);
      const L = [116 * a[1] - 16, 500 * (a[0] - a[1]) + 30 * U.tint, 200 * (a[1] - a[2]) + 30 * U.temp];
      const z = U.con, ac = U.thr * 100, ad = 30;
      const sm = (t, u, v) => { v = clamp01((v - t) / (u - t)); return v * v * v * (v * (v * 6 - 15) + 10); };
      const ae = z < 0 ? (L[0] - ac) * 0.2 + 50 : L[0], af = z < 0 ? L[0] : sm(ac - ad, ac + ad, L[0]) * 100, ag = z < 0 ? z + 1 : z;
      L[0] = ae + (af - ae) * ag;
      a[1] = (L[0] + 16) / 116; a[0] = L[1] / 500 + a[1]; a[2] = a[1] - L[2] / 200; a = a.map((v) => v * v * v); a[0] *= 0.95047; a[2] *= 1.08883;
      c = RGB.map((r) => clamp01(r[0] * a[0] + r[1] * a[1] + r[2] * a[2]));
    }
    { // exposición (+ luces/sombras)
      const j = U.exp + e, k = Math.pow(10, 2 * j) - 1, l = 0.75; let m = 1 / (1 - l) - 1, n = dot(c);
      m *= 1 + n * n * Math.min(0, j) / (0.2 - Math.min(0, j));
      c = c.map((x) => x + (n - x) * l);
      if (j < 0) { c = c.map((x) => x * (1 + j / 16)); n *= 1 + j / 16; }
      c = c.map((x) => x * (k + 1) / (x * k + 1)); n = n * (k + 1) / (n * k + 1);
      c = c.map((x) => clamp01(x + (x - n) * m));
    }
    { // saturación
      const p = Math.max(-1, Math.min(1, U.sat)), n = dot(c);
      if (p <= 0) c = c.map((x) => x - (n - x) * p);
      else {
        const q = n / (n - Math.min(c[0], c[1], c[2]) + 1e-6), r = (1 - n) / (Math.max(c[0], c[1], c[2]) - n + 1e-6);
        const k = Math.min(1 + (Math.min(q, r) - 1) * p, 2); c = c.map((x) => x + (n - x) * (1 - k));
      }
    }
    return c.map((x) => Math.pow(Math.max(0, x), 1 / 2.2));
  }
  // RGBA de 8 bits (ImageData.data o Buffer), in situ; f = paintFilter de Figma
  function adjustPixels(px, f) {
    if (!hasAdjust(f)) return px;
    const U = adjustUniforms(f), cache = new Map();
    for (let i = 0; i < px.length; i += 4) {
      if (!px[i + 3]) continue;
      const key = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
      let o = cache.get(key);
      if (!o) { const c = adjustRgb([px[i] / 255, px[i + 1] / 255, px[i + 2] / 255], U); o = [Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255)]; cache.set(key, o); }
      px[i] = o[0]; px[i + 1] = o[1]; px[i + 2] = o[2];
    }
    return px;
  }

  // ------------------------------------------------------------------ ruido (float32 como en la GPU)
  const F = Math.fround, M = (a, b) => F(F(a) * F(b)), A = (a, b) => F(F(a) + F(b)), S = (a, b) => F(F(a) - F(b));
  const fract = (x) => S(x, Math.floor(x)), sin = (x) => F(Math.sin(F(x)));
  const modf = (x, y) => S(x, M(y, Math.floor(F(x / F(y)))));
  const hsh = (x, y) => { const n = modf(A(M(x, 12.9898), M(y, 78.233)), 3.14159); return fract(A(M(sin(M(n, 2.71828)), 438.5453), 1.73205)); };
  const grd = (px, py, qx, qy, seed) => { let r = M(A(M(qx, px), M(qy, py)), 0.25); r = M(sin(M(r, 0.25)), A(seed, 312)); return M(2, S(fract(r), 0.5)); };
  const t1 = (u) => fract(M(sin(A(M(u, 91.3458), 12.345)), 43758.547));
  function gradAt(wx, wy, x) {
    const r = hsh(wx, wy), y = A(M(M(x, r), 1.61803), 18.345), z = A(M(M(x, r), 0.61803), 21.543);
    const a1 = t1(A(x, 2.6457)), a2 = t1(A(x, 3.6055));
    const ab = grd(wx, wy, M(12.42, a1), M(78.23, a1), y), ac = grd(wx, wy, M(-19.98, a2), M(31.21, a2), z);
    const l = F(Math.sqrt(A(M(ab, ab), M(ac, ac)))) || 1;
    return [F(ab / l), F(ac / l)];
  }
  const fade = (a) => a * a * (3 - 2 * a), lerp = (a, j, k) => j + a * (k - j);
  const octSeed = (s, i) => fract(M(sin(A(A(M(s, 91.3458), M(i, 57.123)), 12.345)), 43758.547));
  // campo de ruido fBm (3 octavas, con signo) con caché de gradientes por punto de red
  function noiseField(seed) {
    const cache = [new Map(), new Map(), new Map()], oct = [0, 1, 2].map((i) => octSeed(seed, i));
    const g = (ix, iy, o) => { const k = (ix + 1048576) * 2097152 + (iy + 1048576); let v = cache[o].get(k); if (!v) { v = gradAt(ix, iy, oct[o]); cache[o].set(k, v); } return v; };
    return (px, py, fx, fy) => {
      let s = 0, x = px * fx, y = py * fy, w = 1;
      for (let o = 0; o < 3; o++) {
        const ix = Math.floor(x), iy = Math.floor(y), dx = x - ix, dy = y - iy, u = fade(dx), v = fade(dy);
        const g00 = g(ix, iy, o), g10 = g(ix + 1, iy, o), g01 = g(ix, iy + 1, o), g11 = g(ix + 1, iy + 1, o);
        const a = lerp(u, dx * g00[0] + dy * g00[1], (dx - 1) * g10[0] + dy * g10[1]);
        const b = lerp(u, dx * g01[0] + (dy - 1) * g01[1], (dx - 1) * g11[0] + (dy - 1) * g11[1]);
        s += lerp(v, a, b) / w; x *= 2; y *= 2; w *= 2;
      }
      return s;
    };
  }
  const band = (j, d, second) => { const f = 10 * ((second ? 0.75 : 0.25) - d / 4), g = f + 10 * (d / 2), b = j * 10; return b >= f && b < g ? 1 : 0; };
  /* efecto/pintura Noise -> RGBA sin premultiplicar (Uint8ClampedArray) de W×H píxeles de salida.
     e = { noiseType, noiseSize:{x,y}, density, color, secondaryColor, seed }; k = px de salida por px de diseño;
     cx, cy = centro del nodo en px de diseño, relativo al origen de la imagen (x0, y0 en px de diseño).
     ss = submuestras por lado: Figma suaviza el grano como un supersampling 4×4 (medido: % de píxeles grises igual) */
  function noiseRGBA(e, W, H, k, x0, y0, cx, cy, ss = 4) {
    if (ss > 1) {
      const hi = noiseRGBA(e, W * ss, H * ss, k * ss, x0, y0, cx, cy, 1), out = new Uint8ClampedArray(W * H * 4), n = ss * ss;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) { const q = ((y * ss + j) * W * ss + x * ss + i) * 4, al = hi[q + 3]; r += hi[q] * al; g += hi[q + 1] * al; b += hi[q + 2] * al; a += al; }
        const o = (y * W + x) * 4; if (!a) continue;
        out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; out[o + 3] = a / n;
      }
      return out;
    }
    const out = new Uint8ClampedArray(W * H * 4), seed = e.seed | 0, d = clamp01(e.density ?? 0.5);
    const fx = 1 / Math.max(1e-3, e.noiseSize?.x || 1), fy = 1 / Math.max(1e-3, e.noiseSize?.y || e.noiseSize?.x || 1);
    const nR = noiseField(seed), nG = noiseField(seed + 1), nB = noiseField(seed + 2), nA = noiseField(seed + 3);
    const type = e.noiseType === 'MULTITONE' ? 0 : e.noiseType === 'DUOTONE' ? 2 : 1;
    const c1 = e.color || { r: 0, g: 0, b: 0, a: 0.25 }, c2 = e.secondaryColor || { r: 1, g: 1, b: 1, a: 0.25 };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const px = x0 + (x + 0.5) / k - cx, py = y0 + (y + 0.5) / k - cy, i = (y * W + x) * 4;
      const r = (nR(px, py, fx, fy) + 1) / 2, gg = (nG(px, py, fx, fy) + 1) / 2, b = (nB(px, py, fx, fy) + 1) / 2;
      if (type === 0) {
        const a = band((nA(px, py, fx, fy) + 1) / 2, d, false) * (c1.a ?? 1);
        if (!a) continue;
        out[i] = clamp01(2 * r - 0.5) * 255; out[i + 1] = clamp01(2 * gg - 0.5) * 255; out[i + 2] = clamp01(2 * b - 0.5) * 255; out[i + 3] = a * 255;
        continue;
      }
      const j = 0.213 * r + 0.715 * gg + 0.072 * b;
      let c = null, a = 0;
      if (type === 1) { a = band(j, d, false); c = c1; }
      else if (band(j, d, false)) { a = 1; c = c2; } else { a = band(j, d, true); c = c1; }
      if (!a) continue;
      out[i] = clamp01(c.r) * 255; out[i + 1] = clamp01(c.g) * 255; out[i + 2] = clamp01(c.b) * 255; out[i + 3] = a * clamp01(c.a ?? 1) * 255;
    }
    return out;
  }
  /* Texture (GRAIN): desplazamiento = (ruido semilla, ruido semilla+1) × radio. Devuelve un mapa para feDisplacementMap
     (R = x, G = y, 0.5 = sin desplazamiento) y la escala a usar: scale = 2 × máx|desplazamiento| en px de salida. */
  function grainMap(e, W, H, k, x0, y0, cx, cy) {
    const out = new Uint8ClampedArray(W * H * 4), seed = e.seed | 0;
    const fx = 1 / Math.max(1e-3, e.noiseSize?.x || 1), fy = 1 / Math.max(1e-3, e.noiseSize?.y || e.noiseSize?.x || 1);
    const nX = noiseField(seed), nY = noiseField(seed + 1), lim = 1.75;     // |fBm 3 octavas| < 1.75
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const px = x0 + (x + 0.5) / k - cx, py = y0 + (y + 0.5) / k - cy, i = (y * W + x) * 4;
      out[i] = (0.5 + nX(px, py, fx, fy) / (2 * lim)) * 255; out[i + 1] = (0.5 + nY(px, py, fx, fy) / (2 * lim)) * 255; out[i + 2] = 128; out[i + 3] = 255;
    }
    return { rgba: out, scale: 2 * lim * (e.radius || 0) * k };
  }

  return { BLUR_SIGMA, blurSigma, blendRgb, blendChannel, SPLIT_EXACT, CSS_BLEND, hasAdjust, adjustUniforms, adjustRgb, adjustPixels, noiseField, noiseRGBA, grainMap };
});
