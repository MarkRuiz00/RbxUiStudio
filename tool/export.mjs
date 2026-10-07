// Exportador HTML -> Roblox.
//   node export.mjs shop.html            -> out/<Screen>/ (PNGs @2x, layout.json, build.luau, preview.png, compare.html)
//   node export.mjs shop.html --shot     -> solo captura de diseño (design.png) para iterar rápido
//
// Marcado en el HTML:
//   data-rbx-root data-name="X"   raíz (=ScreenGui)
//   data-rbx="frame|image|text"   nodo exportado  (image = su propio arte a PNG, sin los hijos data-rbx)
//   data-name="Nombre"            nombre de la Instance
//   data-pad="N"                  px extra alrededor (sombras/labios que se salen del rect)
import { createRequire } from 'module';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const require = createRequire(import.meta.url);
const BROWSER = require('./studio/browser.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(process.argv[2] || path.join(__dirname, 'shop.html'));
const shotOnly = process.argv.includes('--shot');
const SCALE = 2;

const browser = await BROWSER.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: SCALE });
await page.goto(pathToFileURL(file).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);

const rootName = await page.$eval('[data-rbx-root]', (e) => e.dataset.name || 'Screen');
const outDir = path.join(__dirname, 'out', rootName);
fs.rmSync(path.join(outDir, 'img'), { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, 'img'), { recursive: true });
await page.locator('[data-rbx-root]').screenshot({ path: path.join(outDir, 'design.png') });
if (shotOnly) { console.log('design.png ->', outDir); await browser.close(); process.exit(0); }

// ---- 1. árbol de layout ----
const tree = await page.evaluate(() => {
  const root = document.querySelector('[data-rbx-root]');
  const rr = root.getBoundingClientRect();
  let n = 0;
  const rgb = (s) => { const m = s.match(/[\d.]+/g) || [255, 255, 255]; return [+m[0], +m[1], +m[2]]; };
  const alphaOf = (s) => { const m = s.match(/[\d.]+/g) || []; return m.length > 3 ? +m[3] : 1; };
  const shadowOf = (cs) => { const ds = cs.filter.match(/drop-shadow\((rgba?\([^)]*\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px/);
    return ds ? { color: rgb(ds[1]), alpha: alphaOf(ds[1]), x: +ds[2], y: +ds[3] } : null; };
  const rotOf = (cs) => { const t = cs.transform; if (!t || t === 'none') return 0;
    const m = t.match(/matrix\(([^)]+)\)/); if (!m) return 0; const [a, b] = m[1].split(',').map(Number);
    return Math.round(Math.atan2(b, a) * 180 / Math.PI * 10) / 10; };
  function walk(el, parentRect, path) {
    const kids = [];
    // hijos data-rbx directos (atravesando envoltorios sin data-rbx)
    const collect = (node) => {
      for (const c of node.children) {
        if (c.dataset.rbx) kids.push(c); else collect(c);
      }
    };
    collect(el);
    const used = {};
    return kids.map((c, i) => {
      const r = c.getBoundingClientRect();
      const pad = +(c.dataset.pad || 0);
      const ccs = getComputedStyle(c);
      // texto rotado: rect sin rotar alrededor del centro + Rotation en Roblox (las imágenes hornean su rotación)
      const rot = c.dataset.rbx === 'text' ? rotOf(ccs) : 0;
      let x = r.left - pad, y = r.top - pad, w = r.width + pad * 2, h = r.height + pad * 2;
      if (rot) { w = c.offsetWidth; h = c.offsetHeight; x = r.left + r.width / 2 - w / 2; y = r.top + r.height / 2 - h / 2; }
      if (c.dataset.rbx === 'text') {
        // Roblox (Montserrat/GothamSSm): a igual TextSize los glifos salen ~14% más pequeños que en Chrome.
        // TextScaled usa el alto de la caja => la agrandamos (centrada) y damos holgura de ancho según alineación.
        const K = 1.14, KW = 1.25, al = getComputedStyle(c).justifyContent;
        const nh = h * K, nw = w * KW;
        y -= (nh - h) / 2;
        x -= al === 'flex-start' ? 0 : al === 'flex-end' ? (nw - w) : (nw - w) / 2;
        w = nw; h = nh;
      }
      let name = c.dataset.name || (c.dataset.rbx + i);
      if (used[name]) name += ++used[name]; else used[name] = 1;
      const id = 'n' + (n++);
      c.dataset.rbxId = id;
      const node = {
        id, name, kind: c.dataset.rbx, zindex: i + 1, rot, pw: parentRect.w, ph: parentRect.h,
        abs: { x: x - rr.left, y: y - rr.top, w, h },
        pos: [(x - parentRect.x) / parentRect.w, (y - parentRect.y) / parentRect.h],
        size: [w / parentRect.w, h / parentRect.h],
        aspect: w / h,
        path: path + '/' + name,
      };
      if (c.dataset.rbx === 'text') {
        const cs = getComputedStyle(c);
        node.text = c.textContent.trim();
        node.fontSize = parseFloat(cs.fontSize);
        node.color = rgb(cs.color);
        node.stroke = parseFloat(cs.webkitTextStrokeWidth) || 0;
        node.strokeColor = rgb(cs.webkitTextStrokeColor);
        node.family = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
        node.weight = parseInt(cs.fontWeight, 10) || 400;
        node.italic = cs.fontStyle === 'italic';
        node.shadow = shadowOf(cs);
        if (c.dataset.grad) node.grad = c.dataset.grad.split(',').map((h) => h.trim());
        node.strike = cs.textDecorationLine.includes('line-through');
        node.align = cs.justifyContent === 'flex-start' ? 'Left' : cs.justifyContent === 'flex-end' ? 'Right' : 'Center';
      }
      if (c.tagName === 'IMG') node.shadow = shadowOf(ccs);
      if (c.tagName === 'IMG' && +ccs.opacity < 1) node.opacity = +ccs.opacity;
      if (c.tagName === 'IMG') node.src = decodeURIComponent(new URL(c.src).pathname).replace(/^\/([A-Za-z]:)/, '$1');
      node.children = walk(c, { x, y, w, h }, node.path);
      return node;
    });
  }
  return { name: root.dataset.name, w: rr.width, h: rr.height,
           children: walk(root, { x: rr.left, y: rr.top, w: rr.width, h: rr.height }, '') };
});

// ---- 2. PNG por cada nodo image (aislado: solo su arte, sin fondo ni hijos data-rbx) ----
await page.addStyleTag({ content: `
  body.capture [data-rbx] { visibility: hidden !important; }
  body.capture [data-rbx].cap { visibility: visible !important; }
  body.capture [data-rbx].cap [data-rbx] { visibility: hidden !important; }
  body.capture [data-rbx].cap *:not([data-rbx]) { visibility: inherit; }
` });
await page.evaluate(() => document.body.classList.add('capture'));
const images = [];
const seen = {};
const flat = [];
(function f(list) { for (const n of list) { flat.push(n); f(n.children); } })(tree.children);
for (const node of flat) {
  if (node.kind !== 'image') continue;
  if (node.src) { // <img>: subir el PNG original (más nítido), dedupe por archivo
    const fname = path.basename(node.src).replace(/[^\w.-]/g, '_');
    if (!seen['src:' + node.src]) { fs.copyFileSync(node.src, path.join(outDir, 'img', fname)); seen['src:' + node.src] = fname; images.push(fname); }
    node.image = fname; continue;
  }
  // firma del arte propio (clases, icono, contenido no-rbx, tamaño) => dedupe de assets iguales
  const sig = await page.evaluate(({ id, w, h }) => {
    const el = document.querySelector(`[data-rbx-id="${id}"]`);
    const c = el.cloneNode(true);
    c.querySelectorAll('[data-rbx]').forEach((k) => k.remove());
    const html = c.innerHTML.replace(/\bg\d+\b/g, 'g');
    return [(el.getAttribute('class') || '').replace(/\bcap\b/, '').trim(), el.dataset.icon || '', el.dataset.pad || '', w, h, html].join('|');
  }, { id: node.id, w: node.abs.w, h: node.abs.h });
  const hash = crypto.createHash('sha1').update(sig).digest('hex');
  if (seen[hash]) { node.image = seen[hash]; continue; }
  await page.evaluate((id) => {
    document.querySelectorAll('.cap').forEach((e) => e.classList.remove('cap'));
    document.querySelector(`[data-rbx-id="${id}"]`).classList.add('cap');
  }, node.id);
  const fname = node.path.slice(1).replace(/\//g, '_') + '.png';
  const a = node.abs;
  const rootBox = await page.locator('[data-rbx-root]').boundingBox();
  await page.screenshot({ path: path.join(outDir, 'img', fname), omitBackground: true,
    clip: { x: rootBox.x + a.x, y: rootBox.y + a.y, width: a.w, height: a.h } });
  seen[hash] = fname;
  node.image = fname;
  images.push(fname);
}
await browser.close();
fs.writeFileSync(path.join(outDir, 'uploads.json'), JSON.stringify(images, null, 2));
// bleed de bordes + tope 1024px (evita halos negros y reescalado de Roblox)
const { execFileSync } = await import('child_process');
console.log(execFileSync('python', [path.join(__dirname, 'postimg.py'), path.join(outDir, 'img')], { encoding: 'utf8' }).trim());

fs.writeFileSync(path.join(outDir, 'layout.json'), JSON.stringify(tree, null, 2));

// ---- 3. Luau: crea Instances permanentes en StarterGui ----
const L = [];
const col = (c) => `Color3.fromRGB(${c.map(Math.round).join(',')})`;
const u2 = (a) => `UDim2.fromScale(${a[0].toFixed(4)},${a[1].toFixed(4)})`;
L.push(`-- Generado por rbxui/export.mjs desde ${path.basename(file)}. Reejecutable (reemplaza ${tree.name}).`);
L.push(`-- ASSETS: tabla nombre de PNG -> rbxassetid (rellenada tras upload_image).`);
L.push(`local ASSETS = ASSETS or {}`);
L.push(`local SG = game:GetService("StarterGui")`);
L.push(`local old = SG:FindFirstChild(${JSON.stringify(tree.name)}) if old then old:Destroy() end`);
L.push(`local gui = Instance.new("ScreenGui")`);
L.push(`gui.Name = ${JSON.stringify(tree.name)} gui.ResetOnSpawn = false gui.IgnoreGuiInset = true gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling gui.DisplayOrder = 10`);
// familia CSS -> familia Roblox (rbxasset://fonts/families/X.json)
const FONTS = { 'Montserrat': 'Montserrat', 'Fredoka': 'FredokaOne', 'Luckiest Guy': 'LuckiestGuy', 'Bangers': 'Bangers', 'Nunito': 'Nunito', 'Denk One': 'DenkOne' };
let v = 0;
function emit(node, parentVar, depth) {
  const me = 'i' + (v++);
  const isBtn = node.kind === 'image' && /Button$/.test(node.name);
  const isHit = node.kind === 'frame' && /Button$/.test(node.name); // botón sin arte (p.ej. pestaña inactiva)
  const cls = node.kind === 'text' ? 'TextLabel' : isBtn ? 'ImageButton' : isHit ? 'TextButton' : node.kind === 'image' ? 'ImageLabel' : 'Frame';
  if (isBtn) L.push(`-- botón: conecta .Activated desde tu LocalScript`);
  L.push(`local ${me} = Instance.new("${cls}")`);
  L.push(`${me}.Name = ${JSON.stringify(node.name)} ${me}.BackgroundTransparency = 1 ${me}.BorderSizePixel = 0 ${me}.ZIndex = ${node.zindex * 2}`);
  L.push(`${me}.AnchorPoint = Vector2.new(0.5, 0.5) ${me}.Position = ${u2([node.pos[0] + node.size[0] / 2, node.pos[1] + node.size[1] / 2])} ${me}.Size = ${u2(node.size)}`);
  // UIScale en piezas animables (el runtime anima Scale; nunca crea estructura)
  if (node.kind === 'image' || isHit || (depth === 0 && node.kind === 'frame')) L.push(`do local u = Instance.new("UIScale") u.Parent = ${me} end`);
  if (depth === 0 && /Window$/.test(node.name)) L.push(`${me}.Visible = false -- la abre el runtime (RbxUIController)`);
  if (node.rot) L.push(`${me}.Rotation = ${node.rot}`);
  if (isHit) L.push(`${me}.Text = "" ${me}.AutoButtonColor = false`);
  if (isBtn) L.push(`${me}.AutoButtonColor = false`);
  if (depth === 0) L.push(`do local c = Instance.new("UIAspectRatioConstraint") c.AspectRatio = ${node.aspect.toFixed(4)} c.Parent = ${me} end`);
  if (node.kind === 'image') {
    L.push(`${me}.Image = ASSETS[${JSON.stringify(node.image)}] or "" ${me}.ScaleType = Enum.ScaleType.Stretch`);
    if (node.opacity != null) L.push(`${me}.ImageTransparency = ${(1 - node.opacity).toFixed(2)}`);
  }
  if (node.kind === 'text') {
    const fam = FONTS[node.family] || 'Montserrat';
    const wt = node.weight >= 900 ? 'Heavy' : node.weight >= 800 ? 'ExtraBold' : node.weight >= 700 ? 'Bold' : node.weight >= 600 ? 'SemiBold' : 'Regular';
    L.push(`${me}.Text = ${JSON.stringify(node.text)} ${me}.FontFace = Font.new("rbxasset://fonts/families/${fam}.json", Enum.FontWeight.${wt}, Enum.FontStyle.${node.italic ? 'Italic' : 'Normal'}) ${me}.TextScaled = true ${me}.TextColor3 = ${col(node.color)}`);
    L.push(`${me}.TextXAlignment = Enum.TextXAlignment.${node.align}`);
    if (node.strike) L.push(`${me}.RichText = true ${me}.Text = ${JSON.stringify('<s>' + node.text + '</s>')}`);
    if (node.grad) {
      const h2c = (h) => { const n = parseInt(h.replace('#', ''), 16); return `Color3.fromRGB(${n >> 16 & 255},${n >> 8 & 255},${n & 255})`; };
      const ks = node.grad.map((h, k) => `ColorSequenceKeypoint.new(${(k / (node.grad.length - 1)).toFixed(3)}, ${h2c(h)})`).join(', ');
      L.push(`do local g = Instance.new("UIGradient") g.Rotation = 90 g.Color = ColorSequence.new({${ks}}) g.Parent = ${me} ${me}.TextColor3 = Color3.new(1,1,1) end`);
    }
    L.push(`do local t = Instance.new("UITextSizeConstraint") t.MaxTextSize = ${Math.round(node.fontSize * 1.6)} t.Parent = ${me} end`);
    if (node.stroke > 0) {
      // UIStroke es por fuera; el text-stroke CSS es centrado => la mitad
      L.push(`do local s = Instance.new("UIStroke") s.Thickness = ${(node.stroke / 2).toFixed(2)} s:SetAttribute("Base", ${(node.stroke / 2).toFixed(2)}) s.Color = ${col(node.strokeColor)} s.LineJoinMode = Enum.LineJoinMode.Round s.Parent = ${me} end`);
    }
  }
  L.push(`${me}.Parent = ${parentVar}`);
  if (node.kind === 'image' && node.src && node.shadow) { // sombra de icono: mismo asset teñido, detrás
    L.push(`do local sh = Instance.new("ImageLabel") sh.Name = ${JSON.stringify(node.name + 'Shadow')} sh.BackgroundTransparency = 1 sh.Image = ${me}.Image`);
    L.push(`  sh.ImageColor3 = ${col(node.shadow.color)} sh.ImageTransparency = ${(1 - node.shadow.alpha * (node.opacity ?? 1)).toFixed(2)} sh.Size = ${me}.Size sh.ZIndex = ${node.zindex * 2 - 1}`);
    L.push(`  sh.AnchorPoint = ${me}.AnchorPoint sh.Position = ${me}.Position + UDim2.fromScale(${(node.shadow.x / node.pw).toFixed(5)}, ${(node.shadow.y / node.ph).toFixed(5)}) Instance.new("UIScale").Parent = sh sh.Parent = ${parentVar} end`);
  }
  if (node.kind === 'text' && node.shadow) { // sombra sólida: clon detrás, desplazado en píxeles
    L.push(`do local sh = ${me}:Clone() sh.Name = ${JSON.stringify(node.name + 'Shadow')} sh.ZIndex = ${node.zindex * 2 - 1} sh.TextColor3 = ${col(node.shadow.color)}`);
    L.push(`  for _, k in sh:GetChildren() do if k:IsA("UIGradient") then k:Destroy() end end`);
    L.push(`  sh.Position = ${me}.Position + UDim2.fromScale(${(node.shadow.x / node.pw).toFixed(5)}, ${(node.shadow.y / node.ph).toFixed(5)}) local st = sh:FindFirstChildOfClass("UIStroke") if st then st.Color = ${col(node.shadow.color)} end sh.Parent = ${parentVar} end`);
  }
  node.children.forEach((c) => emit(c, me, depth + 1));
}
tree.children.forEach((c) => emit(c, 'gui', 0));
// escala UIStroke (px fijos) con la altura de pantalla respecto al stage de diseño
L.push(`do local ls = Instance.new("LocalScript") ls.Name = "UIScaler" ls.Source = ${JSON.stringify(
`-- Generado por rbxui: escala los UIStroke con la pantalla (diseño a ${tree.h}px de alto).
local gui = script.Parent
local function apply()
	local k = gui.AbsoluteSize.Y / ${tree.h}
	for _, s in gui:GetDescendants() do
		if s:IsA("UIStroke") and s:GetAttribute("Base") then s.Thickness = s:GetAttribute("Base") * k end
	end
end
gui:GetPropertyChangedSignal("AbsoluteSize"):Connect(apply)
apply()
`)} ls.Parent = gui end`);
L.push(`gui.Parent = SG`);
L.push(`return "${tree.name} OK"`);
fs.writeFileSync(path.join(outDir, 'build.luau'), L.join('\n'));

// ---- 4. comparación: recompone solo con PNGs + texto como lo haría Roblox ----
let html = `<!doctype html><meta charset=utf-8><link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@700&family=Montserrat:ital,wght@0,900;1,900&display=swap" rel=stylesheet>
<style>body{margin:0;background:#20242e}.s{position:relative;width:${tree.w}px;height:${tree.h}px;background:url('../../assets/ui-resources/Backgrounds/0101_Baseplate.png') center/cover;overflow:hidden}
.n{position:absolute}.n img{width:100%;height:100%;display:block}.t[data-g]{position:relative}.t[data-g]::after{content:attr(data-g);position:absolute;inset:0;display:flex;align-items:center;justify-content:inherit;-webkit-text-stroke:0;background:linear-gradient(var(--g1),var(--g2));-webkit-background-clip:text;background-clip:text;color:transparent}
.t{display:flex;align-items:center;white-space:nowrap;paint-order:stroke fill;line-height:1}</style><div class=s>`;
function comp(node) {
  const a = node.abs;
  let inner = '';
  if (node.kind === 'image') inner = `<img src="img/${node.image}"${node.opacity != null ? ` data-op="${node.opacity}"` : ''}${node.src && node.shadow ? ` style="filter:drop-shadow(${node.shadow.x}px ${node.shadow.y}px 0 rgba(${node.shadow.color},${node.shadow.alpha}))"` : ''}>`;
  if (node.kind === 'text') {
    const jc = node.align === 'Left' ? 'flex-start' : node.align === 'Right' ? 'flex-end' : 'center';
    inner = `<div class=t style="width:100%;height:100%;justify-content:${jc};font-family:'${node.family}';font-weight:${node.weight};font-style:${node.italic ? 'italic' : 'normal'};${node.shadow ? `filter:drop-shadow(${node.shadow.x}px ${node.shadow.y}px 0 rgb(${node.shadow.color}));` : ''}font-size:${node.fontSize}px;color:rgb(${node.color});-webkit-text-stroke:${node.stroke}px rgb(${node.strokeColor});${node.strike ? 'text-decoration:line-through;text-decoration-color:#ff2a3a;text-decoration-thickness:4px;' : ''}${node.grad ? `--g1:${node.grad[0]};--g2:${node.grad[node.grad.length - 1]}` : ''}"${node.grad ? ` data-g="${node.text}"` : ''}>${node.text}</div>`;
  }
  html += `<div class=n style="left:${a.x}px;top:${a.y}px;width:${a.w}px;height:${a.h}px${node.opacity != null ? `;opacity:${node.opacity}` : ''}${node.rot ? `;transform:rotate(${node.rot}deg)` : ''}">${inner}</div>`;
  node.children.forEach(comp);
}
tree.children.forEach(comp);
fs.writeFileSync(path.join(outDir, 'compare.html'), html + '</div>');

console.log(`OK ${tree.name}: ${images.length} PNG, ${flat.length} nodos -> ${outDir}`);
