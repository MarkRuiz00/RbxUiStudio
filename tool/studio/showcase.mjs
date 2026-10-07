// Copia estática de las pantallas nativas para verlas en el móvil (Artifact privado de claude.ai).
//   node studio/showcase.mjs  ->  out/showcase/index.html  +  out/showcase/files.json (imágenes a publicar junto a la página)
// La página lleva en línea rbxjson.js + render.js (el mismo renderizador del editor) y los JSON de las escenas;
// las imágenes van como archivos publicados con la misma ruta relativa (assets/…). Los botones funcionan como en «Probar».
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const R = require('./rbxjson.js');
const { CODE, DATA: ROOT } = require('./paths.cjs');
const OUT = path.join(ROOT, 'out', 'showcase');
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

// ---------------------------------------------------------------- escenas + imágenes que usan
const assetMap = fs.existsSync(path.join(ROOT, 'assets/rbx_assets.json')) ? readJson(path.join(ROOT, 'assets/rbx_assets.json')) : {};
const byId = {};
for (const [p, id] of Object.entries(assetMap)) byId[String(id).replace(/\D/g, '')] = p;
const files = new Set(['assets/ui-resources/Backgrounds/0101_Baseplate.png', 'studio/brand/logo-128.png', 'studio/brand/mascot_error.png', 'studio/brand/mascot_empty.png']);
const usedMap = {};
const scenes = fs.readdirSync(path.join(ROOT, 'screens')).filter((f) => f.endsWith('.scene.json')).sort()
  .map((f) => readJson(path.join(ROOT, 'screens', f))).filter((sc) => sc.native);
for (const sc of scenes) {
  const walk = (n) => {
    for (const k of ['Image', 'HoverImage', 'PressedImage']) {
      const v = n.props && n.props[k];
      if (typeof v !== 'string' || !v || /^(https?:|figma-image)/.test(v)) continue;
      const m = /^(?:rbxassetid:\/\/|rbxasset:\/\/)(\d+)/.exec(v);
      const rel = m ? byId[m[1]] : v.replace(/^\.?\/?(\.\.\/)*/, '');
      if (rel && fs.existsSync(path.join(ROOT, rel))) { files.add(rel); if (m) usedMap[rel] = assetMap[rel]; }
    }
    (n.children || []).forEach(walk);
  };
  sc.nodes.forEach(walk);
}
const kb = [...files].reduce((t, f) => t + fs.statSync(path.join(ROOT, f)).size, 0) / 1024;

// ---------------------------------------------------------------- página
const inline = (src) => src.replace(/<\/script/gi, '<\\/script');
const js = (f) => inline(fs.readFileSync(path.join(CODE, 'studio', f), 'utf8'));
const data = JSON.stringify({ scenes, assets: usedMap, built: new Date().toISOString() }).replace(/</g, '\\u003c');
const today = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

const html = `<title>Pantallas Steal And Grow</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap">
<link rel="stylesheet" href="${R.FONT_URL}">
<style>
:root {
  --ground: #0f0f1a; --surface: #181828; --raised: #22223a; --line: rgba(150,140,255,.16);
  --text: #ecebff; --muted: #9b99bf; --accent: #7b6bff; --accent-2: #2fd6ff; --accent-ink: #ffffff;
  --glow: 0 18px 50px -18px rgba(90,70,255,.55); --brand: linear-gradient(135deg, #b84dff, #6a3cff 38%, #2d7bff 68%, #2fd6ff);
  --display: 'Fredoka', 'Nunito', system-ui, sans-serif; --body: 'Nunito', system-ui, 'Segoe UI', sans-serif; --mono: 'JetBrains Mono', ui-monospace, Consolas, monospace;
  color-scheme: dark;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) { --ground: #f3f2fb; --surface: #ffffff; --raised: #eceaf9; --line: rgba(60,50,160,.14);
    --text: #1b1a33; --muted: #5f5d80; --accent: #5a4bf0; --accent-2: #0a9ccc; --glow: 0 18px 44px -20px rgba(60,40,200,.35); color-scheme: light; }
}
:root[data-theme="light"] { --ground: #f3f2fb; --surface: #ffffff; --raised: #eceaf9; --line: rgba(60,50,160,.14);
  --text: #1b1a33; --muted: #5f5d80; --accent: #5a4bf0; --accent-2: #0a9ccc; --glow: 0 18px 44px -20px rgba(60,40,200,.35); color-scheme: light; }
html { background: var(--ground); }
body { background: var(--ground); color: var(--text); font: 15px/1.5 var(--body); padding-inline: 16px; padding-block: 14px 40px; -webkit-font-smoothing: antialiased; }
.wrap { max-width: 1040px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
button { font: inherit; color: inherit; cursor: pointer; }
button:focus-visible, [tabindex]:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 2px; }

/* cabecera */
.top { display: flex; align-items: center; gap: 12px; }
.top img { width: 44px; height: 44px; filter: drop-shadow(0 6px 14px rgba(90,70,255,.45)); }
.top h1 { margin: 0; font: 700 22px/1.1 var(--display); letter-spacing: -.01em; text-wrap: balance; }
.top p { margin: 2px 0 0; color: var(--muted); font-size: 13px; }
.badge { margin-left: auto; font: 600 11px/1 var(--mono); padding: 7px 9px; border-radius: 999px; background: var(--raised); color: var(--muted); white-space: nowrap; }

/* pestañas de pantallas */
.tabs { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
.tabs::-webkit-scrollbar { display: none; }
.tab { flex: none; display: flex; flex-direction: column; align-items: flex-start; gap: 1px; padding: 9px 14px; border-radius: 14px; border: 1px solid var(--line);
  background: var(--surface); transition: background-color .15s, border-color .15s, transform .12s; }
.tab b { font: 600 15px/1.2 var(--display); }
.tab small { font: 500 11px/1.3 var(--mono); color: var(--muted); }
.tab[aria-selected="true"] { background: var(--brand); border-color: transparent; color: #fff; box-shadow: var(--glow); }
.tab[aria-selected="true"] small { color: rgba(255,255,255,.8); }
.tab:active { transform: scale(.97); }

/* pantalla del juego */
.device { position: relative; border-radius: 18px; overflow: hidden; background: #0a0a12; box-shadow: var(--glow), 0 0 0 1px var(--line); touch-action: manipulation; }
.scaler { position: absolute; left: 0; top: 0; width: 1280px; height: 720px; transform-origin: 0 0; }
.stage { position: relative; width: 1280px; height: 720px; overflow: hidden; }
.stage.native { background: url('assets/ui-resources/Backgrounds/0101_Baseplate.png') center/cover; }
.stage.layer.native { background: none; }
/* como en Roblox: solo los botones reciben el toque; los marcos transparentes no tapan lo de debajo */
#stage .stage, #stage .stage * { pointer-events: none; }
#stage [data-fx], #stage [data-fx] * { pointer-events: auto; }
.rbx { box-sizing: border-box; }
.stage [data-fx] { cursor: pointer; transition: scale .12s ease-out; -webkit-tap-highlight-color: transparent; }
@media (hover: hover) { .stage [data-fx]:hover { scale: var(--hover, 1.06); } }
.stage [data-fx]:active { scale: var(--press, .9); transition-duration: .06s; }
@keyframes rbx-pop { from { scale: .78; } 60% { scale: 1.03; } to { scale: 1; } }
.rbx-pop { animation: rbx-pop .2s ease-out; }
.dim { position: absolute; inset: 0; background: rgba(8,10,24,.28); backdrop-filter: blur(5px); animation: fade .2s ease-out; }
@keyframes fade { from { opacity: 0; } }
.topbar { position: absolute; left: 0; top: 0; width: 1280px; height: 58px; pointer-events: none; display: flex; align-items: center; gap: 14px; padding: 0 16px;
  box-sizing: border-box; background: linear-gradient(rgba(0,0,0,.42), rgba(0,0,0,.18)); }
.topbar i { width: 42px; height: 42px; border-radius: 12px; background: rgba(20,20,30,.62); display: grid; place-items: center; color: #fff; font: 700 20px/1 var(--body); font-style: normal; }
.topbar span { font: 600 14px/1 var(--mono); color: rgba(255,255,255,.7); }
.hint { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 13px; }
.hint::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: #9cf01e; box-shadow: 0 0 10px #9cf01e; flex: none; }

/* controles */
.controls { display: flex; flex-wrap: wrap; gap: 8px; }
.btn { display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 14px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface);
  font-weight: 700; transition: background-color .15s, transform .12s; }
.btn:active { transform: scale(.96); }
.btn.primary { background: var(--brand); color: #fff; border-color: transparent; box-shadow: var(--glow); }
.btn[aria-pressed="true"] { background: var(--raised); border-color: var(--accent); }
.btn svg { width: 18px; height: 18px; flex: none; }

/* ventanas + ficha */
.cols { display: grid; grid-template-columns: 1.1fr 1fr; gap: 16px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; padding: 16px; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.card h2 { margin: 0; font: 600 17px/1.2 var(--display); }
.card > p { margin: 0; color: var(--muted); font-size: 13px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--raised); font-weight: 700; font-size: 14px; }
.chip i { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); font-style: normal; }
.chip[aria-pressed="true"] { border-color: #9cf01e; }
.chip[aria-pressed="true"] i { background: #9cf01e; box-shadow: 0 0 8px #9cf01e; }
.spec { display: grid; grid-template-columns: auto 1fr; gap: 8px 14px; margin: 0; }
.spec dt { color: var(--muted); font-size: 13px; }
.spec dd { margin: 0; font: 600 13px/1.4 var(--mono); font-variant-numeric: tabular-nums; text-align: right; overflow-wrap: anywhere; }

/* estados */
.state { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; padding: 18px; }
.state img { width: 180px; filter: drop-shadow(0 12px 22px rgba(60,40,200,.35)); }
.state b { font: 600 17px/1.3 var(--display); }
.state p { margin: 0; color: var(--muted); max-width: 40ch; }

footer { color: var(--muted); font-size: 12px; text-align: center; padding-top: 4px; }

/* pantalla completa (o su sustituto: fija y girada si el móvil está en vertical) */
body.full { overflow: hidden; }
body.full .device { position: fixed; inset: 0; border-radius: 0; z-index: 50; box-shadow: none; }
.exit { position: fixed; right: 12px; top: calc(12px + env(safe-area-inset-top, 0px)); z-index: 60; }
@media (max-width: 720px) { .cols { grid-template-columns: 1fr; } .badge { display: none; } .top h1 { font-size: 20px; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }
</style>

<div class="wrap">
  <header class="top">
    <img src="studio/brand/logo-128.png" alt="">
    <div><h1>Steal And Grow</h1><p>Pantallas hechas en RbxUI Studio · toca los botones para probarlas</p></div>
    <span class="badge">1280 × 720 · Roblox</span>
  </header>

  <nav class="tabs" id="tabs" role="tablist" aria-label="Pantallas"></nav>

  <section>
    <div class="device" id="device">
      <div class="scaler" id="scaler"><div class="stage" id="stage"></div><div class="topbar" id="topbar"><i>≡</i><i>☺</i><span>Barra superior de Roblox · 58 px</span></div></div>
    </div>
  </section>
  <div class="hint">Los botones abren y cierran las ventanas como en el juego (una ventana a la vez).</div>

  <div class="controls">
    <button class="btn primary" id="b-full" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>Pantalla completa</button>
    <button class="btn" id="b-reset" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>Reiniciar</button>
    <button class="btn" id="b-bar" type="button" aria-pressed="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18"/></svg>Barra de Roblox</button>
  </div>

  <div class="cols">
    <section class="card"><h2>Ventanas</h2><p>Ábrelas directamente, sin buscar su botón.</p><div class="chips" id="wins"></div></section>
    <section class="card"><h2>Ficha de la pantalla</h2><dl class="spec" id="spec"></dl></section>
  </div>
  <footer>Copia estática del ${today}. Para editar las pantallas, abre RbxUI Studio en el PC.</footer>
</div>
<button class="btn exit" id="b-exit" type="button" hidden>✕ Salir</button>

<script>${js('rbxjson.js')}</script>
<script>${js('render.js')}</script>
<script>
(() => {
  const DATA = ${data};
  const R = window.RBXJson, $ = (s) => document.querySelector(s);
  R.setAssets(DATA.assets || {});
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const walk = (list, fn) => { for (const n of list || []) { fn(n); walk(n.children, fn); } };
  // vistas: «Juego» = todas las pantallas del juego a la vez (como el PlayerGui, por DisplayOrder) + cada pantalla suelta
  const order = (a, b) => ((+((a.gui && a.gui.props && a.gui.props.DisplayOrder) || 0)) - (+((b.gui && b.gui.props && b.gui.props.DisplayOrder) || 0)));
  const gameScenes = DATA.scenes.filter((sc) => !sc.design || !sc.design.background || sc.design.background === 'baseplate').sort(order);
  const count = (list) => { let n = 0; walk(list, () => n++); return n; };
  const VIEWS = [];
  if (gameScenes.length > 1) VIEWS.push({ key: 'juego', label: 'Juego', sub: gameScenes.length + ' pantallas', scenes: gameScenes });
  for (const sc of DATA.scenes) VIEWS.push({ key: sc.name, label: sc.name.replace(/Screen$/, ''), sub: count(sc.nodes) + ' capas', scenes: [sc] });
  const S = { i: 0, vis: {}, open: [], bar: true };
  try { const k = localStorage.getItem('sag-view'); const j = VIEWS.findIndex((v) => v.key === k); if (j >= 0) S.i = j; } catch (e) {}
  const view = () => VIEWS[S.i];
  const allNodes = () => view().scenes.flatMap((sc) => sc.nodes);

  // pestañas
  const tabs = $('#tabs');
  VIEWS.forEach((v, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tab'; b.setAttribute('role', 'tab');
    b.innerHTML = '<b>' + esc(v.label) + '</b><small>' + esc(v.sub) + '</small>';
    b.onclick = () => { S.i = i; S.vis = {}; S.open = []; try { localStorage.setItem('sag-view', v.key); } catch (e) {} show(); };
    tabs.appendChild(b);
  });

  // escala del escenario al ancho disponible (y girado en pantalla completa si el móvil está en vertical)
  const device = $('#device'), scaler = $('#scaler');
  function layout() {
    const sc = view().scenes[0], W0 = sc.stage.w, H0 = sc.stage.h;
    scaler.style.width = W0 + 'px'; scaler.style.height = H0 + 'px';
    if (document.body.classList.contains('full')) {
      const W = innerWidth, H = innerHeight, portrait = H > W;
      const k = portrait ? Math.min(H / W0, W / H0) : Math.min(W / W0, H / H0);
      scaler.style.transform = portrait
        ? 'translate(' + ((W + H0 * k) / 2) + 'px,' + ((H - W0 * k) / 2) + 'px) rotate(90deg) scale(' + k + ')'
        : 'translate(' + ((W - W0 * k) / 2) + 'px,' + ((H - H0 * k) / 2) + 'px) scale(' + k + ')';
      device.style.height = '';
      return;
    }
    const k = device.clientWidth / W0;
    scaler.style.transform = 'scale(' + k + ')';
    device.style.height = (H0 * k) + 'px';
  }
  new ResizeObserver(layout).observe(device);
  addEventListener('resize', layout);

  // render + interacciones (como «Probar» del editor; el destino se busca en todas las pantallas, como hace el runtime en el PlayerGui)
  const stage = $('#stage');
  const findByName = (nm) => { let r = null; walk(allNodes(), (n) => { if (!r && n.name === nm) r = n; }); return r; };
  const chainOf = (id) => { const out = []; const f = (list, acc) => { for (const n of list || []) { const a = acc.concat(n); if (n.id === id) { out.push(...a); return true; } if (f(n.children, a)) return true; } return false; }; f(allNodes(), []); return out; };
  const visOf = (n) => (n.id in S.vis ? S.vis[n.id] : R.prop(n, 'Visible') !== false);
  function render(pop) {
    stage.innerHTML = '';
    stage.className = 'stage';
    const map = {};
    view().scenes.forEach((src, li) => {
      const sc = JSON.parse(JSON.stringify(src));
      walk(sc.nodes, (n) => { if (n.id in S.vis) { n.props = n.props || {}; n.props.Visible = S.vis[n.id]; } });
      const layer = document.createElement('div');
      layer.className = 'stage' + (li ? ' layer' : '');
      layer.style.cssText = 'position:absolute;inset:0';
      stage.appendChild(layer);
      try { Object.assign(map, RBXRender.renderScene(sc, layer, { editor: true, play: true, base: './' })); }
      catch (e) { layer.innerHTML = '<div class="state" style="height:100%;justify-content:center;background:var(--surface)"><img src="studio/brand/mascot_error.png" alt=""><b>No se pudo pintar ' + esc(src.name) + '</b><p>' + esc(e.message) + '</p></div>'; }
    });
    walk(allNodes(), (n) => {
      const el = map[n.id];
      if (!el || !(n.buttonFx || n.interactions)) return;
      el.dataset.fx = '1';
      el.style.setProperty('--hover', n.buttonFx ? n.buttonFx.hover : 1);
      el.style.setProperty('--press', n.buttonFx ? n.buttonFx.press : 1);
      el.addEventListener('click', (e) => { e.stopPropagation(); press(n); });
    });
    // desenfoque detrás de la ventana abierta (el runtime pone un BlurEffect)
    for (const id of S.open) {
      const el = map[id];
      if (el && el.parentNode && el.parentNode.classList.contains('stage')) { const d = document.createElement('div'); d.className = 'dim'; el.parentNode.insertBefore(d, el); }
      if (el && id === pop) el.classList.add('rbx-pop');
    }
    document.fonts.ready.then(() => R.fitScaled(stage));
    paintWins();
  }
  function act(t, action, animation) {
    const show = action === 'open' ? true : action === 'close' ? false : !visOf(t);
    if (show) { for (const id of S.open) if (id !== t.id) S.vis[id] = false; S.open = [t.id]; }
    else S.open = S.open.filter((id) => id !== t.id);
    S.vis[t.id] = show;
    return show && animation !== 'none' ? t.id : null;
  }
  function press(n) {
    let pop = null;
    for (const it of n.interactions || []) {
      const t = it.target ? findByName(it.target) : it.action === 'close' ? chainOf(n.id)[0] : null;
      if (!t) continue;
      pop = act(t, it.action || 'toggle', it.animation) || pop;
    }
    render(pop);
  }

  // ventanas: destinos de interacciones (en una pantalla suelta, también sus ventanas que empiezan ocultas)
  function targets() {
    const names = new Set();
    walk(allNodes(), (n) => { for (const it of n.interactions || []) if (it.target) names.add(it.target); });
    if (view().scenes.length === 1) for (const n of allNodes()) if (R.prop(n, 'Visible') === false) names.add(n.name);
    return [...names].map(findByName).filter(Boolean);
  }
  function paintWins() {
    const box = $('#wins'); box.innerHTML = '';
    const list = targets();
    if (!list.length) { box.innerHTML = '<div class="state" style="padding:4px"><img src="studio/brand/mascot_empty.png" alt="" style="width:110px"><p>Esta pantalla no tiene ventanas que se abran con botones.</p></div>'; return; }
    for (const t of list) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.setAttribute('aria-pressed', String(visOf(t)));
      b.innerHTML = '<i></i>' + esc(t.name);
      b.onclick = () => render(act(t, 'toggle', 'pop'));
      box.appendChild(b);
    }
  }
  function paintSpec() {
    const v = view(), sc = v.scenes[0];
    let layers = 0, buttons = 0, texts = 0, images = 0; const fonts = new Set();
    walk(allNodes(), (n) => {
      layers++;
      if (n.buttonFx || n.interactions || /Button$/.test(n.rbxClass || '')) buttons++;
      if (/^Text/.test(n.rbxClass || '')) { texts++; const f = n.props && n.props.FontFace; if (f) fonts.add(String(f.family).replace('rbxassetid://', 'id ') + ' ' + (f.weight || '')); }
      if (/^Image/.test(n.rbxClass || '')) images++;
    });
    const rows = [[v.scenes.length > 1 ? 'ScreenGuis' : 'ScreenGui', v.scenes.map((x) => x.name).join(', ')], ['Diseño', sc.stage.w + ' × ' + sc.stage.h + ' px'], ['Barra de Roblox', '58 px arriba'],
      ['Autoescala', (sc.design && sc.design.autoScale === false) ? 'no' : 'UIScale por pantalla'], ['Capas', layers], ['Botones', buttons],
      ['Textos', texts], ['Imágenes', images], ['Ventanas', targets().length], ['Fuentes', [...fonts].slice(0, 4).join(' · ') || '—']];
    $('#spec').innerHTML = rows.map((r) => '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>').join('');
  }
  function show() {
    [...tabs.children].forEach((b, i) => b.setAttribute('aria-selected', String(i === S.i)));
    tabs.children[S.i] && tabs.children[S.i].scrollIntoView({ block: 'nearest', inline: 'center' });
    // pantalla suelta sin nada visible (una ventana que se abre desde otra pantalla): se abre para verla
    let pop = null;
    if (view().scenes.length === 1 && !allNodes().some((n) => R.prop(n, 'Visible') !== false)) { const t = allNodes()[0]; if (t) pop = act(t, 'open', 'pop'); }
    layout(); render(pop); paintSpec();
  }

  // controles
  $('#b-reset').onclick = () => { S.vis = {}; S.open = []; render(); };
  const bar = $('#b-bar');
  bar.onclick = () => { S.bar = !S.bar; bar.setAttribute('aria-pressed', String(S.bar)); $('#topbar').hidden = !S.bar; };
  function full(on) {
    document.body.classList.toggle('full', on); $('#b-exit').hidden = !on;
    if (on && device.requestFullscreen) device.requestFullscreen().catch(() => {});
    if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    layout();
  }
  $('#b-full').onclick = () => full(true);
  $('#b-exit').onclick = () => full(false);
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && document.body.classList.contains('full')) full(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('full')) full(false); });

  if (!VIEWS.length) {
    device.outerHTML = '<div class="state"><img src="studio/brand/mascot_empty.png" alt=""><b>Aún no hay pantallas</b><p>Crea una en RbxUI Studio y vuelve a publicar esta copia.</p></div>';
    return;
  }
  show();
})();
</script>
`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), html);
fs.writeFileSync(path.join(OUT, 'files.json'), JSON.stringify([...files].sort(), null, 1));
console.log(`out/showcase/index.html (${(html.length / 1024).toFixed(0)} KB) · ${scenes.length} pantallas · ${files.size} archivos (${kb.toFixed(0)} KB)`);
