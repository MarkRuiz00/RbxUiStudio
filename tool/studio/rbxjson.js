/* RbxUI — formato JSON "rbxui" (árboles de Instances reales de Roblox) <-> escena del editor + render nativo.
   Compartido: navegador (window.RBXJson) y node (require vía createRequire).

   Documento:  {"format":"rbxui","version":1,"name":"...","screens":[ScreenGui...]}
   Nodo:       {"ClassName","Name","props":{...},"children":[...],"interactions":[...],"buttonFx":{...},"attributes":{...}}
   Tipos:      Color3 "#RRGGBB" · UDim2 [xs,xo,ys,yo] · UDim [s,o] · Vector2 [x,y] · enums por nombre
               ColorSequence [[t,"#hex"],...] · NumberSequence n | [[t,v],...] · Font {family,weight,style}
   ScreenGui:  "design":{"device","width","height","autoScale","background"}

   Nodo de escena nativo (lo que edita el editor):
     { id, name, type:'box'|'text'|'image', rbxClass, props (sin Size/Position), mods:[nodos UI*], extras:[otros hijos],
       x, y, w, h (px, relativos a la caja del padre), rot, geo0 (geometría importada), orig {Size, Position},
       interactions, buttonFx, attributes, hidden/locked (solo editor), children } */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RBXJson = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------- clases
  const GUI = new Set(['Frame', 'TextLabel', 'TextButton', 'TextBox', 'ImageLabel', 'ImageButton', 'ScrollingFrame', 'CanvasGroup', 'ViewportFrame', 'VideoFrame']);
  const TEXT = new Set(['TextLabel', 'TextButton', 'TextBox']);
  const IMAGE = new Set(['ImageLabel', 'ImageButton']);
  const BUTTON = new Set(['TextButton', 'ImageButton']);
  const isMod = (c) => /^UI/.test(c) && !GUI.has(c);
  const typeOf = (c) => (TEXT.has(c) ? 'text' : IMAGE.has(c) ? 'image' : 'box');

  // Valores por defecto. El constructor Luau aplica FORCED antes de las props, así que el resto debe coincidir
  // con los de Instance.new en Roblox (el editor pinta con esta tabla => lo que ves = lo que sale).
  const GUI_DEF = { AnchorPoint: [0, 0], BackgroundColor3: '#A3A2A5', BackgroundTransparency: 0, BorderSizePixel: 0, BorderColor3: '#1B2A35',
    Position: [0, 0, 0, 0], Size: [0, 100, 0, 100], Rotation: 0, Visible: true, ZIndex: 1, ClipsDescendants: false, LayoutOrder: 0, AutomaticSize: 'None' };
  const TEXT_DEF = { Text: 'Label', TextColor3: '#1B2A35', TextSize: 14, TextScaled: false, TextWrapped: false, TextXAlignment: 'Center',
    TextYAlignment: 'Center', FontFace: { family: 'LegacyArial', weight: 'Regular', style: 'Normal' }, RichText: false, TextTransparency: 0,
    LineHeight: 1, TextStrokeTransparency: 1, TextStrokeColor3: '#000000', TextTruncate: 'None' };
  const IMAGE_DEF = { Image: '', ImageColor3: '#FFFFFF', ImageTransparency: 0, ScaleType: 'Stretch', TileSize: [1, 0, 1, 0] };
  const DEFAULTS = {
    Frame: GUI_DEF, CanvasGroup: { ...GUI_DEF, GroupTransparency: 0 }, ScrollingFrame: { ...GUI_DEF, ScrollBarThickness: 12, CanvasSize: [0, 0, 2, 0], ScrollingDirection: 'XY', AutomaticCanvasSize: 'None' },
    ViewportFrame: GUI_DEF, VideoFrame: GUI_DEF,
    TextLabel: { ...GUI_DEF, ...TEXT_DEF }, TextButton: { ...GUI_DEF, ...TEXT_DEF, Text: 'Button', AutoButtonColor: false },
    TextBox: { ...GUI_DEF, ...TEXT_DEF, Text: '', PlaceholderText: '', PlaceholderColor3: '#B2B2B2' },
    ImageLabel: { ...GUI_DEF, ...IMAGE_DEF }, ImageButton: { ...GUI_DEF, ...IMAGE_DEF, AutoButtonColor: false },
    UICorner: { CornerRadius: [0, 8] },
    UIStroke: { Color: '#000000', Thickness: 1, Transparency: 0, ApplyStrokeMode: 'Contextual', LineJoinMode: 'Round', Enabled: true, BorderStrokePosition: 'Outer' },
    UIGradient: { Color: [[0, '#FFFFFF'], [1, '#FFFFFF']], Transparency: 0, Rotation: 0, Offset: [0, 0], Enabled: true },
    UIPadding: { PaddingTop: [0, 0], PaddingBottom: [0, 0], PaddingLeft: [0, 0], PaddingRight: [0, 0] },
    UIListLayout: { FillDirection: 'Vertical', Padding: [0, 0], HorizontalAlignment: 'Left', VerticalAlignment: 'Top', SortOrder: 'LayoutOrder',
      HorizontalFlex: 'None', VerticalFlex: 'None', Wraps: false, ItemLineAlignment: 'Automatic' },
    UIFlexItem: { FlexMode: 'None', GrowRatio: 1, ShrinkRatio: 1, ItemLineAlignment: 'Automatic' },
    UIGridLayout: { CellSize: [0, 100, 0, 100], CellPadding: [0, 5, 0, 5], FillDirection: 'Horizontal', HorizontalAlignment: 'Left',
      VerticalAlignment: 'Top', SortOrder: 'LayoutOrder', FillDirectionMaxCells: 0, StartCorner: 'TopLeft' },
    UIScale: { Scale: 1 },
    UIAspectRatioConstraint: { AspectRatio: 1, AspectType: 'FitWithinMaxSize', DominantAxis: 'Width' },
    UISizeConstraint: { MinSize: [0, 0], MaxSize: [1e9, 1e9] },
    UITextSizeConstraint: { MinTextSize: 1, MaxTextSize: 100 },
    ScreenGui: { Enabled: true, ResetOnSpawn: false, ZIndexBehavior: 'Sibling', ScreenInsets: 'DeviceSafeInsets', DisplayOrder: 0 },
  };
  // Lo que el constructor fija siempre (difiere de Instance.new y el editor lo asume)
  const FORCED = {
    GuiObject: { BorderSizePixel: 0 },
    TextButton: { AutoButtonColor: false }, ImageButton: { AutoButtonColor: false },
    ScreenGui: { ResetOnSpawn: false, ZIndexBehavior: 'Sibling', ScreenInsets: 'DeviceSafeInsets' },
  };
  const DESIGN_DEF = { device: 'studio', width: 1280, height: 720, autoScale: true, background: '#3A6EA5' };
  const TOPBAR = 58;
  const defOf = (cls) => DEFAULTS[cls] || {};
  const prop = (n, k) => (n.props && n.props[k] !== undefined ? n.props[k] : defOf(n.rbxClass || n.ClassName)[k]);
  const mp = (m, k) => (m.props && m.props[k] !== undefined ? m.props[k] : defOf(m.ClassName)[k]);

  // ---------------------------------------------------------------- fuentes
  const WEIGHTS = { Thin: 100, ExtraLight: 200, Light: 300, Regular: 400, Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800, Heavy: 900 };
  const CSS_FAMILY = { LegacyArial: 'Arimo', Montserrat: 'Montserrat', GothamSSm: 'Montserrat', Gotham: 'Montserrat', BuilderSans: 'Inter', FredokaOne: 'Fredoka',
    LuckiestGuy: 'Luckiest Guy', Bangers: 'Bangers', SourceSansPro: 'Source Sans 3', SourceSans: 'Source Sans 3', Roboto: 'Roboto',
    RobotoMono: 'Roboto Mono', RobotoCondensed: 'Roboto Condensed', Oswald: 'Oswald', Nunito: 'Nunito', Arimo: 'Arimo', Arial: 'Arimo',
    PressStart2P: 'Press Start 2P', Creepster: 'Creepster', DenkOne: 'Denk One', Merriweather: 'Merriweather', PermanentMarker: 'Permanent Marker',
    IndieFlower: 'Indie Flower', Jura: 'Jura', Kalam: 'Kalam', Michroma: 'Michroma', Sarpanch: 'Sarpanch', SpecialElite: 'Special Elite',
    TitilliumWeb: 'Titillium Web', Ubuntu: 'Ubuntu', AmaticSC: 'Amatic SC', Inconsolata: 'Inconsolata', PatrickHand: 'Patrick Hand',
    JosefinSans: 'Josefin Sans', Fondamento: 'Fondamento', GrenzeGotisch: 'Grenze Gotisch', Balthazar: 'Balthazar', Zekton: 'Oxanium',
    ComicNeueAngular: 'Comic Neue', AccanthisADFStd: 'Merriweather', Guru: 'Nunito', HighwayGothic: 'Oswald', RomanAntique: 'Merriweather' };
  const FONT_URL = 'https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&family=Inter:wght@100..900&family=Fredoka:wght@300..700'
    + '&family=Luckiest+Guy&family=Bangers&family=Source+Sans+3:ital,wght@0,200..900;1,200..900&family=Roboto:wght@100..900&family=Roboto+Mono'
    + '&family=Oswald:wght@200..700&family=Nunito:wght@200..1000&family=Arimo:wght@400..700&family=Press+Start+2P&family=Creepster&family=Denk+One'
    + '&family=Permanent+Marker&family=Titillium+Web:wght@200..900&family=Ubuntu:wght@300..700&family=Amatic+SC:wght@400;700&family=Jura:wght@300..700&display=swap';
  // Fuentes de la Creator Store de Roblox (FontFamily por id): Font.new("rbxassetid://ID"). id -> nombre de Google Fonts
  const ASSET_FONTS = { 12187371840: 'Silkscreen', 12187607722: 'Damion', 12187370000: 'Bungee Inline', 12187375716: 'Finger Paint', 12187372629: 'Mulish',
    12187377099: 'Cairo', 11702779517: 'Montserrat', 12187372382: 'Eater', 11322590111: 'Fuzzy Bubbles', 12187377325: 'Nosifer', 12187376545: 'Tangerine',
    12187360881: 'Audiowide', 16658221428: 'Builder Sans', 12187368843: 'Caesar Dressing', 12187370928: 'Faster One', 12187365559: 'Mukta',
    12187363148: 'Rubik Burned', 12187367066: 'Rubik Marker Hatch', 12187367666: 'Bungee Shade', 8764312106: 'Dancing Script', 12187375194: 'Frijole',
    12187376739: 'Noto Serif SC', 12187607287: 'Prompt', 12187365977: 'Rubik', 12187371991: 'Barrio', 16658237174: 'Builder Extended',
    12188570269: 'M PLUS Rounded 1c', 12187367901: 'Nothing You Could Do', 12187368625: 'Roboto Slab', 12187376357: 'Sedgwick Ave Display',
    12187363616: 'Are You Serious', 16658246179: 'Builder Mono', 12187363887: 'Codystar', 12187375958: 'Great Vibes', 12187365364: 'Inter',
    12187376910: 'Irish Grover', 12187374273: 'Italianno', 8836875837: 'Lobster', 12187364648: 'Marhey', 12187606783: 'Monofett', 11702779409: 'Poppins',
    12187375422: 'Rajdhani', 12187607493: 'Shadows Into Light', 12187376174: 'Teko', 12187364842: 'Unica One', 12187365104: 'Blaka', 12187369802: 'Caveat',
    12187364147: 'IBM Plex Sans JP', 12187373592: 'Kanit', 12187371622: 'Kings', 12187365769: 'Libre Baskerville', 12187374098: 'Monoton',
    12187361718: 'Nanum Gothic', 12187370747: 'Noto Sans', 12187366846: 'Noto Serif HK', 12187369639: 'Noto Serif JP', 12187367362: 'Pacifico',
    12187361943: 'Parisienne', 12187371324: 'Quicksand', 11702779240: 'Raleway', 12187362120: 'Rubik Iso', 12187366475: 'Rubik Maze',
    12187369046: 'Rubik Wet Paint', 12187372175: 'Rye', 12187374537: 'Sono', 12187362578: 'Sono Monospace', 12187373327: 'Work Sans', 12187368317: 'Akronim',
    16658254058: 'Arimo', 12187372847: 'Barlow', 12187374954: 'Fira Sans', 12187361116: 'Hind', 12187361378: 'Hind Siliguri', 12187607116: 'La Belle Aurore',
    11598289817: 'Lato', 12187366657: 'Lora', 12187362892: 'Noto Sans HK', 12187368093: 'Noto Serif TC', 12187363368: 'Nunito Sans', 11598121416: 'Open Sans',
    12187374765: 'Playfair Display', 12187606934: 'PT Sans', 12187606624: 'PT Serif', 12187377588: 'Tajawal', 12187373881: 'Yellowtail' };
  // carga al vuelo una fuente de Google en el editor (API v1: tolera pesos que no existan)
  const loadedFonts = new Set();
  function ensureFont(fam) {
    if (typeof document === 'undefined' || !fam || loadedFonts.has(fam)) return;
    loadedFonts.add(fam);
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = `https://fonts.googleapis.com/css?family=${encodeURIComponent(fam).replace(/%20/g, '+')}:100,200,300,400,500,600,700,800,900,100i,400i,700i,900i&display=swap`;
    document.head.appendChild(l);
  }
  // Enum.Font (legado) -> [familia, peso, estilo]
  const LEGACY = { Legacy: ['LegacyArial', 'Regular'], SourceSans: ['SourceSansPro', 'Regular'], SourceSansBold: ['SourceSansPro', 'Bold'],
    SourceSansLight: ['SourceSansPro', 'Light'], SourceSansSemibold: ['SourceSansPro', 'SemiBold'], SourceSansItalic: ['SourceSansPro', 'Regular', 'Italic'],
    Arial: ['Arimo', 'Regular'], ArialBold: ['Arimo', 'Bold'], Arimo: ['Arimo', 'Regular'], ArimoBold: ['Arimo', 'Bold'],
    Gotham: ['GothamSSm', 'Regular'], GothamMedium: ['GothamSSm', 'Medium'], GothamBold: ['GothamSSm', 'Bold'], GothamBlack: ['GothamSSm', 'Heavy'],
    BuilderSans: ['BuilderSans', 'Regular'], BuilderSansMedium: ['BuilderSans', 'Medium'], BuilderSansBold: ['BuilderSans', 'Bold'],
    BuilderSansExtraBold: ['BuilderSans', 'ExtraBold'], FredokaOne: ['FredokaOne', 'Regular'], LuckiestGuy: ['LuckiestGuy', 'Regular'],
    Bangers: ['Bangers', 'Regular'], Cartoon: ['ComicNeueAngular', 'Regular'], Code: ['Inconsolata', 'Regular'], Arcade: ['PressStart2P', 'Regular'],
    SciFi: ['Zekton', 'Regular'], Fantasy: ['Balthazar', 'Regular'], Highway: ['HighwayGothic', 'Regular'], Antique: ['RomanAntique', 'Regular'] };
  function fontOf(n) {
    const legacy = n.props && n.props.Font;
    if (legacy && !(n.props.FontFace)) { const l = LEGACY[legacy] || [legacy, 'Regular']; return { family: l[0], weight: l[1], style: l[2] || 'Normal' }; }
    const f = prop(n, 'FontFace') || TEXT_DEF.FontFace;
    const raw = String(f.family || 'LegacyArial');
    const aid = /^rbxassetid:\/\/(\d+)/.exec(raw);
    if (aid) { const nm = ASSET_FONTS[aid[1]] || 'Montserrat'; ensureFont(nm); return { family: nm, css: nm, weight: f.weight || 'Regular', style: f.style || 'Normal' }; }
    const fam = raw.replace(/^.*families\//, '').replace(/\.json$/, '');
    return { family: fam, weight: f.weight || 'Regular', style: f.style || 'Normal' };
  }
  const cssFont = (f) => `font-family:'${f.css || CSS_FAMILY[f.family] || f.family}','Montserrat',sans-serif;font-weight:${WEIGHTS[f.weight] || 400};font-style:${f.style === 'Italic' ? 'italic' : 'normal'};`;
  // A igual TextSize, Roblox pinta los glifos ~14% más pequeños que Chrome (medido con Montserrat/GothamSSm)
  const TEXT_K = 1 / 1.14;

  // ---------------------------------------------------------------- colores
  const hex = (s) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(s || '')); const v = m ? parseInt(m[1], 16) : 0xffffff; return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${+(a).toFixed(3)})`;
  const mul = (a, b) => [Math.round(a[0] * b[0] / 255), Math.round(a[1] * b[1] / 255), Math.round(a[2] * b[2] / 255)];
  const seqColor = (v) => (typeof v === 'string' ? [[0, v], [1, v]] : Array.isArray(v) && v.length ? v : [[0, '#FFFFFF'], [1, '#FFFFFF']]);
  const seqNum = (v) => (typeof v === 'number' ? [[0, v], [1, v]] : Array.isArray(v) && v.length ? v.map((k) => [k[0], k[1]]) : [[0, 0], [1, 0]]);
  function sampleColor(seq, t) {
    for (let i = 0; i < seq.length - 1; i++) {
      const [t0, c0] = seq[i], [t1, c1] = seq[i + 1];
      if (t >= t0 && t <= t1) { const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0); const a = hex(c0), b = hex(c1); return a.map((x, j) => x + (b[j] - x) * f); }
    }
    return hex(t <= seq[0][0] ? seq[0][1] : seq[seq.length - 1][1]);
  }
  function sampleNum(seq, t) {
    for (let i = 0; i < seq.length - 1; i++) {
      const [t0, v0] = seq[i], [t1, v1] = seq[i + 1];
      if (t >= t0 && t <= t1) return t1 === t0 ? v0 : v0 + (v1 - v0) * (t - t0) / (t1 - t0);
    }
    return t <= seq[0][0] ? seq[0][1] : seq[seq.length - 1][1];
  }
  // UIGradient -> linear-gradient CSS multiplicando por el color base (como Roblox)
  function gradCss(g, base, baseAlpha) {
    const cs = seqColor(mp(g, 'Color')), ts = seqNum(mp(g, 'Transparency'));
    const stops = [...new Set([...cs.map((k) => k[0]), ...ts.map((k) => k[0])])].sort((a, b) => a - b);
    const off = mp(g, 'Offset') || [0, 0], rot = +mp(g, 'Rotation') || 0;
    const shift = (rot % 180 === 0 ? off[0] : Math.abs(rot % 180) === 90 ? off[1] : 0) * (rot >= 90 && rot < 270 ? -1 : 1);
    const parts = stops.map((t) => `${rgba(mul(base, sampleColor(cs, t)), baseAlpha * (1 - sampleNum(ts, t)))} ${+((t + shift) * 100).toFixed(2)}%`);
    return `linear-gradient(${rot + 90}deg, ${parts.join(', ')})`;
  }

  // ---------------------------------------------------------------- geometría
  const r2 = (v) => Math.round(v * 100) / 100;
  const r4 = (v) => Math.round(v * 10000) / 10000;
  const udim = (u, len) => (Array.isArray(u) ? (+u[0] || 0) * len + (+u[1] || 0) : 0);
  const modOf = (n, cls) => (n.mods || []).find((m) => m.ClassName === cls && mp(m, 'Enabled') !== false);
  const modsOf = (n, cls) => (n.mods || []).filter((m) => m.ClassName === cls && mp(m, 'Enabled') !== false);
  function paddingOf(n, w, h) {
    const p = modOf(n, 'UIPadding');
    if (!p) return { l: 0, t: 0, r: 0, b: 0 };
    return { l: udim(mp(p, 'PaddingLeft'), w), r: udim(mp(p, 'PaddingRight'), w), t: udim(mp(p, 'PaddingTop'), h), b: udim(mp(p, 'PaddingBottom'), h) };
  }
  // caja de contenido de un nodo (donde viven sus hijos): tamaño menos UIPadding
  function contentBox(n, w, h) { const p = paddingOf(n, w, h); return { x: p.l, y: p.t, w: Math.max(0, w - p.l - p.r), h: Math.max(0, h - p.t - p.b) }; }

  function sizeFor(inst, mods, box) {
    const p = inst.props || {};
    const S = p.Size || GUI_DEF.Size;
    let w = udim([S[0], S[1]], box.w), h = udim([S[2], S[3]], box.h);
    const ar = mods.find((m) => m.ClassName === 'UIAspectRatioConstraint');
    if (ar) {
      const a = +mp(ar, 'AspectRatio') || 1, type = mp(ar, 'AspectType'), axis = mp(ar, 'DominantAxis');
      if (type === 'ScaleWithParentSize') { if (axis === 'Height') w = h * a; else h = w / a; }
      else if (w / (h || 1) > a) w = h * a; else h = w / a;
    }
    const sc = mods.find((m) => m.ClassName === 'UISizeConstraint');
    if (sc) { const mn = mp(sc, 'MinSize'), mx = mp(sc, 'MaxSize'); w = Math.min(Math.max(w, mn[0]), mx[0]); h = Math.min(Math.max(h, mn[1]), mx[1]); }
    return { w, h };
  }

  // posiciones que dicta un UIListLayout / UIGridLayout sobre hijos ya medidos
  function layoutKids(kids, lay, box) {
    const vis = kids.filter((k) => prop(k, 'Visible') !== false);
    const order = mp(lay, 'SortOrder') === 'Name' ? [...vis].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      : vis.map((k, i) => [k, i]).sort((a, b) => ((+prop(a[0], 'LayoutOrder') || 0) - (+prop(b[0], 'LayoutOrder') || 0)) || a[1] - b[1]).map((x) => x[0]);
    const ha = mp(lay, 'HorizontalAlignment'), va = mp(lay, 'VerticalAlignment');
    const alignOff = (free, a, lo, hi) => (a === lo ? 0 : a === hi ? free : free / 2);
    if (lay.ClassName === 'UIListLayout') {
      // eje principal M (w|h) y cruzado C; Flex (SpaceBetween/Around/Evenly/Fill), Wraps y UIFlexItem como en Roblox
      const vert = mp(lay, 'FillDirection') !== 'Horizontal';
      const M = vert ? 'h' : 'w', C = vert ? 'w' : 'h', MP = vert ? 'y' : 'x', CP = vert ? 'x' : 'y';
      const mainLen = vert ? box.h : box.w, crossLen = vert ? box.w : box.h;
      const gap = udim(mp(lay, 'Padding'), mainLen);
      const flex = mp(lay, vert ? 'VerticalFlex' : 'HorizontalFlex') || 'None';
      const mainAl = vert ? [va, 'Top', 'Bottom'] : [ha, 'Left', 'Right'], crossAl = vert ? [ha, 'Left', 'Right'] : [va, 'Top', 'Bottom'];
      const fi = (k) => modOf(k, 'UIFlexItem');
      const lines = [];
      if (mp(lay, 'Wraps')) {
        let cur = [], used = 0;
        for (const k of order) {
          const add = (cur.length ? gap : 0) + k[M];
          if (cur.length && used + add > mainLen + 0.5) { lines.push(cur); cur = []; used = 0; }
          used += (cur.length ? gap : 0) + k[M]; cur.push(k);
        }
        if (cur.length) lines.push(cur);
      } else lines.push(order);
      const lineCross = lines.map((l) => (lines.length === 1 ? crossLen : Math.max(0, ...l.map((k) => k[C]))));
      const totalCross = lineCross.reduce((a, b) => a + b, 0) + gap * Math.max(0, lines.length - 1);
      let cc = lines.length === 1 ? 0 : alignOff(crossLen - totalCross, ...crossAl);
      lines.forEach((line, li) => {
        const sum = () => line.reduce((t, k) => t + k[M], 0) + gap * Math.max(0, line.length - 1);
        let free = mainLen - sum();
        // crecer / encoger (Fill en el layout o FlexMode en cada hijo)
        const mode = (k) => (fi(k) ? mp(fi(k), 'FlexMode') : null) || (flex === 'Fill' ? 'Fill' : 'None');
        const flexers = line.filter((k) => (free > 0.5 ? /Fill|Grow/ : /Fill|Shrink/).test(mode(k)));
        if (Math.abs(free) > 0.5 && flexers.length) {
          const ratio = (k) => (fi(k) ? +mp(fi(k), free > 0 ? 'GrowRatio' : 'ShrinkRatio') || 1 : 1);
          const tot = flexers.reduce((t, k) => t + ratio(k), 0) || 1;
          for (const k of flexers) { k[M] = Math.max(0, k[M] + free * ratio(k) / tot); k.flexSized = true; }
          free = mainLen - sum();
        }
        let pos = 0, between = gap;
        const n = line.length;
        if (free > 0.5 && /^Space/.test(flex)) {
          if (flex === 'SpaceBetween') { if (n > 1) between = gap + free / (n - 1); else pos = free / 2; }
          else if (flex === 'SpaceAround') { between = gap + free / n; pos = free / n / 2; }
          else { between = gap + free / (n + 1); pos = free / (n + 1); }
        } else pos = alignOff(free, ...mainAl);
        for (const k of line) {
          const ila = (fi(k) && mp(fi(k), 'ItemLineAlignment') !== 'Automatic' && mp(fi(k), 'ItemLineAlignment')) || mp(lay, 'ItemLineAlignment') || 'Automatic';
          if (ila === 'Stretch') { k[C] = lineCross[li]; k.flexSized = true; }
          const room = lineCross[li] - k[C];
          const off = ila === 'Start' ? 0 : ila === 'End' ? room : ila === 'Center' ? room / 2 : ila === 'Stretch' ? 0 : alignOff(room, ...crossAl);
          k[MP] = box[MP] + pos; k[CP] = box[CP] + cc + off;
          pos += k[M] + between;
          k.layout = 'list';
        }
        cc += lineCross[li] + gap;
      });
    } else {
      const cs = mp(lay, 'CellSize'), cp = mp(lay, 'CellPadding');
      const cw = udim([cs[0], cs[1]], box.w), ch = udim([cs[2], cs[3]], box.h);
      const px = udim([cp[0], cp[1]], box.w), py = udim([cp[2], cp[3]], box.h);
      const horiz = mp(lay, 'FillDirection') !== 'Vertical', max = +mp(lay, 'FillDirectionMaxCells') || 0;
      let per = horiz ? Math.floor((box.w + px) / (cw + px)) : Math.floor((box.h + py) / (ch + py));
      per = Math.max(1, max ? Math.min(max, per) : per);
      const n = order.length, lines = Math.ceil(n / per), used = Math.min(n, per);
      const bw = horiz ? used * cw + (used - 1) * px : lines * cw + (lines - 1) * px;
      const bh = horiz ? lines * ch + (lines - 1) * py : used * ch + (used - 1) * py;
      const ox = box.x + alignOff(box.w - bw, ha, 'Left', 'Right'), oy = box.y + alignOff(box.h - bh, va, 'Top', 'Bottom');
      order.forEach((k, i) => {
        const a = i % per, b = Math.floor(i / per);
        const col = horiz ? a : b, row = horiz ? b : a;
        k.w = cw; k.h = ch; k.x = ox + col * (cw + px); k.y = oy + row * (ch + py); k.layout = 'grid';
      });
    }
  }

  // recoloca los hijos de un nodo con UIListLayout / UIGridLayout (el editor lo llama antes de pintar)
  function relayout(n) {
    const lay = modOf(n, 'UIGridLayout') || modOf(n, 'UIListLayout');
    if (!lay) { for (const k of n.children || []) if (k.layout) delete k.layout; return; }
    layoutKids(n.children || [], lay, contentBox(n, n.w, n.h));
    for (const k of n.children || []) { k.x = r2(k.x); k.y = r2(k.y); }
  }

  // ---------------------------------------------------------------- importar (rbxui -> escena)
  let seq = 0;
  const nid = () => 'r' + (Date.now() % 1e6).toString(36) + (seq++).toString(36);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function importNode(inst, box) {
    const cls = inst.ClassName;
    const kidsIn = inst.children || [];
    const mods = kidsIn.filter((c) => isMod(c.ClassName)).map(clone);
    const extras = kidsIn.filter((c) => !isMod(c.ClassName) && !GUI.has(c.ClassName)).map(clone);
    const p = { ...(inst.props || {}) };
    const { w, h } = sizeFor(inst, mods, box);
    const A = p.AnchorPoint || [0, 0], P = p.Position || [0, 0, 0, 0];
    const n = { id: nid(), name: inst.Name || cls, type: typeOf(cls), rbxClass: cls, props: p, mods, extras,
      x: r2(box.x + udim([P[0], P[1]], box.w) - A[0] * w), y: r2(box.y + udim([P[2], P[3]], box.h) - A[1] * h), w: r2(w), h: r2(h) };
    n.orig = { Size: p.Size || null, Position: p.Position || null };
    delete p.Size; delete p.Position;
    if (p.Rotation) n.rot = +p.Rotation;
    delete p.Rotation;
    for (const k of ['interactions', 'buttonFx', 'attributes']) if (inst[k]) n[k] = clone(inst[k]);
    const cb = contentBox(n, w, h);
    n.children = kidsIn.filter((c) => GUI.has(c.ClassName)).map((c) => importNode(c, cb));
    const lay = modOf(n, 'UIGridLayout') || modOf(n, 'UIListLayout');
    if (lay) layoutKids(n.children, lay, cb);
    for (const k of n.children) { k.x = r2(k.x); k.y = r2(k.y); k.geo0 = { x: k.x, y: k.y, w: k.w, h: k.h, pw: cb.w, ph: cb.h }; }
    return n;
  }

  function screenToScene(sg) {
    const design = { ...DESIGN_DEF, ...(sg.design || {}) };
    const box = { x: 0, y: 0, w: design.width, h: design.height };
    const props = { ...(sg.props || {}) };
    const scene = { name: sg.Name || 'Screen', native: true, stage: { w: design.width, h: design.height }, design, gui: { props },
      nodes: [] };
    if (sg.attributes) scene.gui.attributes = clone(sg.attributes);
    const kids = sg.children || [];
    scene.gui.mods = kids.filter((c) => isMod(c.ClassName)).map(clone);
    scene.gui.extras = kids.filter((c) => !isMod(c.ClassName) && !GUI.has(c.ClassName)).map(clone);
    scene.nodes = kids.filter((c) => GUI.has(c.ClassName)).map((c) => importNode(c, box));
    for (const k of scene.nodes) k.geo0 = { x: k.x, y: k.y, w: k.w, h: k.h, pw: box.w, ph: box.h };
    return scene;
  }

  function validate(doc) {
    if (typeof doc === 'string') doc = JSON.parse(doc);
    if (!doc || typeof doc !== 'object') throw new Error('JSON vacío');
    if (doc.ClassName === 'ScreenGui') doc = { format: 'rbxui', version: 1, name: doc.Name, screens: [doc] };
    if (Array.isArray(doc)) doc = { format: 'rbxui', version: 1, screens: doc };
    if (!Array.isArray(doc.screens) || !doc.screens.length) throw new Error('falta "screens" (lista de ScreenGui)');
    const warn = [];
    const walk = (n, path) => {
      if (!n.ClassName) warn.push(`${path}: sin ClassName`);
      const names = new Set();
      for (const c of n.children || []) {
        const nm = c.Name || c.ClassName;
        if (names.has(nm) && !isMod(c.ClassName)) warn.push(`${path}.${nm}: nombre repetido entre hermanos`);
        names.add(nm); walk(c, path + '.' + nm);
      }
    };
    for (const s of doc.screens) { if (s.ClassName !== 'ScreenGui') warn.push(`${s.Name}: la raíz debe ser ScreenGui`); walk(s, s.Name || 'ScreenGui'); }
    return { doc, warn };
  }
  function docToScenes(input) { const { doc, warn } = validate(input); return { scenes: doc.screens.map(screenToScene), warn, name: doc.name }; }

  // ---------------------------------------------------------------- exportar (escena -> rbxui)
  function udimOut(v, len, o) {
    if (!Array.isArray(o)) return [0, r2(v)];
    const s = +o[0] || 0, off = +o[1] || 0;
    if (s !== 0 && off === 0 && len) return [r4(v / len), 0];
    return [s, r2(v - s * len)];
  }
  const same = (a, b) => Math.abs(a - b) < 0.01;
  function exportNode(n, box, ctx) {
    const props = {};
    const p = n.props || {};
    const A = p.AnchorPoint || [0, 0];
    const g = n.geo0, untouched = g && same(g.x, n.x) && same(g.y, n.y) && same(g.w, n.w) && same(g.h, n.h) && same(g.pw, box.w) && same(g.ph, box.h);
    if (!(n.layout === 'grid')) {
      if (untouched && n.orig && n.orig.Size) props.Size = n.orig.Size;
      else { const o = n.orig && n.orig.Size; const sx = udimOut(n.w, box.w, o && [o[0], o[1]]), sy = udimOut(n.h, box.h, o && [o[2], o[3]]); props.Size = [sx[0], sx[1], sy[0], sy[1]]; }
    } else if (n.orig && n.orig.Size) props.Size = n.orig.Size;
    if (!n.layout) {
      if (untouched && n.orig && n.orig.Position) props.Position = n.orig.Position;
      else {
        const px = n.x - box.x + A[0] * n.w, py = n.y - box.y + A[1] * n.h;
        if (ctx.top && ctx.autoScale) props.Position = [r4(px / box.w), 0, r4(py / box.h), 0];
        else { const o = n.orig && n.orig.Position; const a = udimOut(px, box.w, o && [o[0], o[1]]), b = udimOut(py, box.h, o && [o[2], o[3]]); props.Position = [a[0], a[1], b[0], b[1]]; }
      }
    } else if (n.orig && n.orig.Position) props.Position = n.orig.Position;
    Object.assign(props, p);
    if (n.rot) props.Rotation = n.rot;
    const out = { ClassName: n.rbxClass, Name: n.name || n.rbxClass, props };
    for (const k of ['interactions', 'buttonFx', 'attributes']) if (n[k] && (Array.isArray(n[k]) ? n[k].length : Object.keys(n[k]).length)) out[k] = clone(n[k]);
    const cb = contentBox(n, n.w, n.h);
    const kids = [...(n.mods || []).map(clone), ...(n.children || []).map((c) => exportNode(c, cb, { autoScale: ctx.autoScale })), ...(n.extras || []).map(clone)];
    if (kids.length) out.children = kids;
    return out;
  }
  function sceneToScreen(scene) {
    const d = { ...DESIGN_DEF, ...(scene.design || {}), width: scene.stage.w, height: scene.stage.h };
    const box = { x: 0, y: 0, w: scene.stage.w, h: scene.stage.h };
    const sg = { ClassName: 'ScreenGui', Name: scene.name, props: clone((scene.gui && scene.gui.props) || {}), design: d };
    if (scene.gui && scene.gui.attributes) sg.attributes = clone(scene.gui.attributes);
    const kids = [...((scene.gui && scene.gui.mods) || []).map(clone), ...scene.nodes.map((n) => exportNode(n, box, { top: true, autoScale: d.autoScale })),
      ...((scene.gui && scene.gui.extras) || []).map(clone)];
    if (kids.length) sg.children = kids;
    return sg;
  }
  const scenesToDoc = (scenes, name) => ({ format: 'rbxui', version: 1, name: name || scenes[0]?.name || 'UI', screens: scenes.map(sceneToScreen) });

  // ---------------------------------------------------------------- assets
  // imagen: "rbxassetid://N" (se busca en el mapa local) o ruta local relativa a rbxui/ ("assets/studs/X.png")
  const ASSETS = { byId: {}, byPath: {} };
  function setAssets(map) {         // map: { "assets/studs/X.png": "rbxassetid://N" }
    ASSETS.byPath = { ...map }; ASSETS.byId = {};
    for (const [p, id] of Object.entries(map)) ASSETS.byId[String(id).replace(/\D/g, '')] = p;
  }
  function imageUrl(src, base = '../') {
    if (!src) return '';
    const s = String(src);
    const m = /^(?:rbxassetid:\/\/|rbxasset:\/\/|https?:\/\/www\.roblox\.com\/asset\/\?id=)(\d+)/.exec(s);
    if (m) { const p = ASSETS.byId[m[1]]; return p ? base + p : ''; }
    if (/^figma-image:/.test(s)) return '';                     // imagen de Figma sin bytes (hueco)
    if (/^(https?:|data:)/.test(s)) return s;
    return base + s.replace(/^\.?\/?(\.\.\/)*/, '');
  }
  const assetIdFor = (src) => { const s = String(src || ''); if (/^rbxassetid:\/\//.test(s)) return s; return ASSETS.byPath[s.replace(/^\.?\/?(\.\.\/)*/, '')] || null; };

  // ---------------------------------------------------------------- render nativo (DOM)
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function richHtml(s) {
    const tags = [];
    let out = esc(s).replace(/&lt;br\s*\/?&gt;/gi, '\n');
    out = out.replace(/&lt;(\/?)(b|i|u|s|font|stroke|uppercase|smallcaps|mark|sc|uc)((?:\s+[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*&gt;/gi, (all, close, tag, attrs) => {
      tag = tag.toLowerCase();
      if (close) return tag === 'font' || tag === 'mark' || tag === 'stroke' || tag === 'uppercase' || tag === 'uc' || tag === 'smallcaps' || tag === 'sc' ? '</span>' : `</${tag}>`;
      const a = {}; (attrs || '').replace(/([a-z]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi, (m, k, v1, v2) => { a[k.toLowerCase()] = v1 ?? v2; });
      if (tag === 'font') {
        let st = '';
        if (a.color) { const c = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(a.color); st += `color:${c ? `rgb(${c[1]},${c[2]},${c[3]})` : a.color};`; }
        if (a.size) st += `font-size:${+a.size * TEXT_K}px;`;
        if (a.weight) st += `font-weight:${WEIGHTS[a.weight] || a.weight};`;
        if (a.transparency) st += `opacity:${1 - +a.transparency};`;
        if (a.face || a.family) {
          const fam = String(a.face || a.family).replace(/^rbxasset:\/\/fonts\/families\/(.+)\.json$/, '$1');
          st += `font-family:'${CSS_FAMILY[fam] || fam}';`;
        }
        return `<span style="${st}">`;
      }
      if (tag === 'mark') return `<span style="background:${a.color || '#ff0'}">`;
      if (tag === 'stroke') return `<span style="-webkit-text-stroke:${(+a.thickness || 1) * 2}px ${a.color || '#000'};paint-order:stroke fill">`;
      if (tag === 'uppercase' || tag === 'uc') return '<span style="text-transform:uppercase">';
      if (tag === 'smallcaps' || tag === 'sc') return '<span style="font-variant:small-caps">';
      return `<${tag}>`;
    });
    void tags;
    return out;
  }

  // CSS de la caja (fondo, contorno, esquinas, recorte) de un nodo nativo
  function cornerRad(n) {
    const cr = modOf(n, 'UICorner');
    return cr ? Math.min(udim(mp(cr, 'CornerRadius'), Math.min(n.w, n.h)), Math.min(n.w, n.h) / 2) : 0;
  }
  // UIStroke de borde con LineJoinMode Miter sobre un UICorner: Roblox pinta el contorno como un cuadrado relleno
  // del color del trazo detrás del relleno redondeado (comprobado en Studio). Devuelve ese trazo o null.
  function miterStroke(n) {
    if (!cornerRad(n)) return null;
    return modsOf(n, 'UIStroke').find((s) => mp(s, 'LineJoinMode') === 'Miter' && (+mp(s, 'Thickness') || 0) > 0
      && !(mp(s, 'ApplyStrokeMode') === 'Contextual' && TEXT.has(n.rbxClass))) || null;
  }
  function fillCss(n) {
    const bt = +prop(n, 'BackgroundTransparency'), bg = hex(prop(n, 'BackgroundColor3'));
    if (bt >= 1) return '';
    const grad = modOf(n, 'UIGradient');
    return grad ? `background:${gradCss(grad, bg, 1 - bt)};` : `background:${rgba(bg, 1 - bt)};`;
  }

  function boxCss(n) {
    const cls = n.rbxClass;
    let css = '';
    const bt = +prop(n, 'BackgroundTransparency');
    const rad = cornerRad(n);
    const miter = miterStroke(n);
    if (miter) css += `background:${rgba(hex(mp(miter, 'Color')), 1 - (+mp(miter, 'Transparency') || 0))};`;
    else { css += fillCss(n); if (rad) css += `border-radius:${r2(rad)}px;`; }
    const sh = [];
    for (const s of modsOf(n, 'UIStroke')) {
      const mode = mp(s, 'ApplyStrokeMode');
      if (mode === 'Contextual' && TEXT.has(cls)) continue;
      if ((s.children || []).some((g) => g.ClassName === 'UIGradient')) continue;   // lo pinta strokeRing()
      const t = +mp(s, 'Thickness') || 0; if (!t) continue;
      const col = rgba(hex(mp(s, 'Color')), 1 - (+mp(s, 'Transparency') || 0));
      const pos = mp(s, 'BorderStrokePosition');
      if (pos === 'Inner') sh.push(`inset 0 0 0 ${t}px ${col}`);
      else if (pos === 'Center') { sh.push(`0 0 0 ${t / 2}px ${col}`); sh.push(`inset 0 0 0 ${t / 2}px ${col}`); }
      else sh.push(`0 0 0 ${t}px ${col}`);
    }
    const bs = +prop(n, 'BorderSizePixel') || 0;
    if (bs > 0 && bt < 1) sh.push(`0 0 0 ${bs}px ${rgba(hex(prop(n, 'BorderColor3')), 1 - bt)}`);
    if (sh.length) css += `box-shadow:${sh.join(',')};`;
    if (prop(n, 'ClipsDescendants') || cls === 'CanvasGroup' || cls === 'ScrollingFrame') css += 'overflow:hidden;';
    if (cls === 'CanvasGroup') css += `opacity:${1 - (+prop(n, 'GroupTransparency') || 0)};`;
    const z = +prop(n, 'ZIndex'); if (z !== 1) css += `z-index:${z};`;
    const sc = modOf(n, 'UIScale');
    if (sc && +mp(sc, 'Scale') !== 1) { const A = prop(n, 'AnchorPoint') || [0, 0]; css += `scale:${+mp(sc, 'Scale')};transform-origin:${A[0] * 100}% ${A[1] * 100}%;`; }
    return css;
  }

  function textLayer(n, doc) {
    const f = fontOf(n);
    const pad = paddingOf(n, n.w, n.h);
    const xa = prop(n, 'TextXAlignment'), ya = prop(n, 'TextYAlignment');
    const wrap = !!prop(n, 'TextWrapped') || !!prop(n, 'TextScaled');
    let text = String(prop(n, 'Text') ?? '');
    let color = hex(prop(n, 'TextColor3')), alpha = 1 - (+prop(n, 'TextTransparency') || 0);
    if (n.rbxClass === 'TextBox' && !text) { text = String(prop(n, 'PlaceholderText') || ''); color = hex(prop(n, 'PlaceholderColor3')); }
    const size = +prop(n, 'TextSize') || 14;
    const lay = doc.createElement('div');
    lay.className = 'rbx-text';
    let css = `position:absolute;left:${pad.l}px;top:${pad.t}px;right:${pad.r}px;bottom:${pad.b}px;display:flex;`
      + `align-items:${ya === 'Top' ? 'flex-start' : ya === 'Bottom' ? 'flex-end' : 'center'};`
      + `justify-content:${xa === 'Left' ? 'flex-start' : xa === 'Right' ? 'flex-end' : 'center'};`
      + `text-align:${xa === 'Left' ? 'left' : xa === 'Right' ? 'right' : 'center'};pointer-events:none;`;
    lay.style.cssText = css;
    const span = doc.createElement('span');
    let sc = `${cssFont(f)}font-size:${r2(size * TEXT_K)}px;line-height:${r2(1.12 * (+prop(n, 'LineHeight') || 1))};color:${rgba(color, alpha)};`
      + `white-space:${wrap ? 'pre-wrap' : 'pre'};overflow-wrap:normal;${wrap ? 'max-width:100%;' : ''}`
      + (prop(n, 'TextTruncate') === 'AtEnd' ? `max-width:100%;overflow:hidden;text-overflow:ellipsis;${wrap ? `display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:${Math.max(1, Math.floor(n.h / (size * TEXT_K * 1.12)))};` : ''}` : '');
    const st = modsOf(n, 'UIStroke').find((s) => mp(s, 'ApplyStrokeMode') !== 'Border');
    if (st) {
      const t = +mp(st, 'Thickness') || 0;
      if (t) sc += `-webkit-text-stroke:${r2(t * 2)}px ${rgba(hex(mp(st, 'Color')), (1 - (+mp(st, 'Transparency') || 0)) * alpha)};paint-order:stroke fill;`;
    } else if (+prop(n, 'TextStrokeTransparency') < 1) {
      sc += `-webkit-text-stroke:2px ${rgba(hex(prop(n, 'TextStrokeColor3')), 1 - +prop(n, 'TextStrokeTransparency'))};paint-order:stroke fill;`;
    }
    span.style.cssText = sc;
    if (prop(n, 'RichText')) span.innerHTML = richHtml(text); else span.textContent = text;
    lay.appendChild(span);
    // UIGradient en un texto tiñe los glifos: capa encima recortada al texto, sin contorno
    const grad = modOf(n, 'UIGradient');
    if (grad) {
      const top = span.cloneNode(true);
      top.style.webkitTextStroke = '0'; top.style.color = 'transparent';
      top.style.backgroundImage = gradCss(grad, color, alpha);
      top.style.webkitBackgroundClip = 'text'; top.style.backgroundClip = 'text';
      const wrapTop = lay.cloneNode(false); wrapTop.appendChild(top);
      lay.dataset.gradTop = '1';
      lay._top = wrapTop;
    }
    if (prop(n, 'TextScaled')) {
      lay.dataset.scaled = '1';
      const tc = modOf(n, 'UITextSizeConstraint');
      lay.dataset.max = String((tc ? +mp(tc, 'MaxTextSize') : 100) * TEXT_K);
      lay.dataset.min = String((tc ? +mp(tc, 'MinTextSize') : 1) * TEXT_K);
    }
    return lay;
  }

  function imageLayer(n, doc, base) {
    const url = imageUrl(prop(n, 'Image'), base);
    const lay = doc.createElement('div');
    lay.className = 'rbx-img';
    const st = prop(n, 'ScaleType');
    const ts = prop(n, 'TileSize') || [1, 0, 1, 0];
    const bsz = st === 'Fit' ? 'contain' : st === 'Crop' ? 'cover' : st === 'Tile' ? `${r2(udim([ts[0], ts[1]], n.w))}px ${r2(udim([ts[2], ts[3]], n.h))}px` : '100% 100%';
    const rep = st === 'Tile' ? 'repeat' : 'no-repeat', pos = st === 'Tile' ? '0 0' : 'center';   // Roblox empieza el mosaico arriba a la izquierda
    const tint = String(prop(n, 'ImageColor3') || '#FFFFFF').toUpperCase();
    let css = 'position:absolute;inset:0;pointer-events:none;';
    if (!url) {
      if (prop(n, 'Image')) css += 'background:repeating-conic-gradient(#ff00ff55 0 25%,#0000 0 50%) 0 0/12px 12px;outline:1px dashed #f0f;';
    } else if (tint !== '#FFFFFF' || modOf(n, 'UIGradient')) {
      // ImageColor3 y UIGradient multiplican el color de la imagen (su alfa se conserva con la máscara)
      const u = `url("${url}")`, g = modOf(n, 'UIGradient');
      css += `background:${u} ${pos}/${bsz} ${rep},${g ? gradCss(g, hex(tint), 1) : tint};background-blend-mode:multiply;-webkit-mask:${u} ${pos}/${bsz} ${rep};mask:${u} ${pos}/${bsz} ${rep};`;
    } else css += `background:url("${url}") ${pos}/${bsz} ${rep};`;
    const it = +prop(n, 'ImageTransparency') || 0; if (it) css += `opacity:${1 - it};`;
    const cr = modOf(n, 'UICorner'); if (cr) css += 'border-radius:inherit;';
    lay.style.cssText = css;
    if (!url && prop(n, 'Image')) lay.title = String(prop(n, 'Image'));
    return lay;
  }

  // UIStroke de borde con un UIGradient dentro (bordes con degradado o luces/sombras): anillo con el degradado, recortado con máscara
  function strokeRing(n, doc) {
    const st = modsOf(n, 'UIStroke').find((s) => mp(s, 'ApplyStrokeMode') !== 'Contextual' || !TEXT.has(n.rbxClass));
    const g = st && (st.children || []).find((x) => x.ClassName === 'UIGradient' && mp(x, 'Enabled') !== false);
    const t = st ? +mp(st, 'Thickness') || 0 : 0;
    if (!g || !t) return null;
    const pos = mp(st, 'BorderStrokePosition'), out = pos === 'Inner' ? 0 : pos === 'Center' ? t / 2 : t;
    const rad = cornerRad(n), alpha = 1 - (+mp(st, 'Transparency') || 0);
    const r = doc.createElement('div');
    r.className = 'rbx-ring';
    r.style.cssText = `position:absolute;inset:${-out}px;padding:${t}px;box-sizing:border-box;pointer-events:none;border-radius:${rad ? r2(rad + out) + 'px' : 0};`
      + `background:${gradCss(g, hex(mp(st, 'Color')), alpha)};-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;`;
    return r;
  }
  // crea el elemento de un nodo nativo (sin hijos ni posición: eso lo hace render.js)
  function nativeEl(n, doc, opts = {}) {
    const el = doc.createElement('div');
    el.className = 'rbx rbx-' + n.rbxClass;
    el.dataset.cssBox = boxCss(n);
    if (miterStroke(n)) {
      const f = doc.createElement('div');
      f.className = 'rbx-fill';
      f.style.cssText = `position:absolute;inset:0;pointer-events:none;border-radius:${r2(cornerRad(n))}px;${fillCss(n)}`;
      el.appendChild(f);
    }
    if (IMAGE.has(n.rbxClass)) el.appendChild(imageLayer(n, doc, opts.base || '../'));
    const ring = strokeRing(n, doc); if (ring) el.appendChild(ring);
    if (TEXT.has(n.rbxClass)) { const t = textLayer(n, doc); el.appendChild(t); if (t._top) el.appendChild(t._top); }
    return el;
  }
  // TextScaled: el mayor tamaño que cabe (se llama con el árbol ya en el documento)
  function fitScaled(rootEl) {
    for (const lay of rootEl.querySelectorAll('.rbx-text[data-scaled]')) {
      const spans = [lay.firstChild, lay.nextSibling && lay.nextSibling.classList && lay.nextSibling.classList.contains('rbx-text') ? lay.nextSibling.firstChild : null].filter(Boolean);
      const W = lay.clientWidth, H = lay.clientHeight; if (!W || !H) continue;
      let lo = +lay.dataset.min || 1, hi = Math.min(+lay.dataset.max || 100, H * 1.3);
      const fits = (s) => { spans[0].style.fontSize = s + 'px'; return spans[0].scrollWidth <= W + 0.5 && spans[0].offsetHeight <= H + 0.5; };
      for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; }
      for (const s of spans) s.style.fontSize = lo.toFixed(2) + 'px';
    }
  }

  // ---------------------------------------------------------------- nodos nuevos desde el editor
  function makeNode(cls, over = {}) {
    const t = typeOf(cls);
    const props = {};
    if (t === 'text') Object.assign(props, { BackgroundTransparency: 1, Text: cls === 'TextBox' ? '' : 'Text', TextColor3: '#FFFFFF', TextSize: 24,
      FontFace: { family: 'Montserrat', weight: 'Heavy', style: 'Normal' } });
    if (t === 'image') Object.assign(props, { BackgroundTransparency: 1, ScaleType: 'Fit' });
    if (cls === 'Frame') Object.assign(props, { BackgroundColor3: '#31333B' });
    const n = { id: nid(), name: cls, type: t, rbxClass: cls, props, mods: [], extras: [], x: 0, y: 0, w: t === 'text' ? 160 : 100, h: t === 'text' ? 40 : 100, children: [] };
    if (t === 'text') n.mods.push({ ClassName: 'UIStroke', Name: 'UIStroke', props: { Thickness: 2.5, Color: '#000000', LineJoinMode: 'Miter' } });
    return Object.assign(n, over);
  }
  // convierte un subárbol rbxui suelto (p. ej. un componente del kit) en nodos de escena dentro de una caja w×h
  const importInto = (inst, w, h) => importNode(inst, { x: 0, y: 0, w, h });

  // ---------------------------------------------------------------- prompt para IAs
  const AI_PROMPT = `You will design Roblox interfaces for the RbxUI Studio editor. Reply with a single JSON block in
this format: {"format":"rbxui","version":1,"name":"...","screens":[ScreenGui...]}.
Each node is {"ClassName","Name","props":{...},"children":[...]} using REAL Roblox classes and
properties. Types: Color3 "#RRGGBB"; UDim2 [xs,xo,ys,yo]; UDim [s,o]; Vector2 [x,y]; enums by name;
ColorSequence [[t,"#hex"],...]; Font {"family":"Montserrat","weight":"Heavy","style":"Normal"}.
Modifiers (UICorner, UIStroke, UIGradient, UIPadding, UIListLayout (supports HorizontalFlex/VerticalFlex
SpaceBetween and Wraps), UIFlexItem, UIGridLayout, UIScale, UIAspectRatioConstraint...) go as children. Each ScreenGui has "design":{"device":"studio","width":1280,
"height":720,"autoScale":true,"background":"#3A6EA5"}.
Rules: official Roblox fonts only; UIGradient multiplies the parent's color, so set
BackgroundColor3 "#FFFFFF" on pieces with a gradient and put text in a child TextLabel; the usable
area starts 58 px below the top bar; unique names among siblings; windows opened by a button start
with "Visible":false and the button gets "interactions":[{"trigger":"click","action":"toggle",
"target":"WindowName","animation":"pop"}]; close buttons get [{"trigger":"click","action":"close",
"target":"WindowName"}]; buttons get "buttonFx":{"hover":1.06,"press":0.9}.
Images: "Image":"rbxassetid://ID" or a local path such as "assets/studs/Coin_Outline.png".
"Stud Style": square corners, black UIStroke Border 3-4 px with LineJoinMode Miter, vertical
light→dark gradient on everything colored, windows with a #31333B→#292B32 body and color only in
the 50 px header, white Montserrat Heavy text with a black Contextual UIStroke, lime = buy, pink =
Robux, red = close, no pastels or white backgrounds, little text.`;

  return { ASSET_FONTS, ensureFont, GUI, TEXT, IMAGE, BUTTON, DEFAULTS, FORCED, DESIGN_DEF, TOPBAR, FONT_URL, AI_PROMPT, isMod, typeOf, prop, mp, modOf,
    validate, docToScenes, screenToScene, relayout, sceneToScreen, scenesToDoc, importInto, makeNode, contentBox,
    setAssets, imageUrl, assetIdFor, nativeEl, fitScaled, hex };
});
