// JSON rbxui -> script Luau que crea las Instances reales en Roblox Studio (sin PNG horneados).
//   node studio/rbxbuild.mjs screens/StudStyle.rbxui.json        -> out/native/<name>.build.luau (+ avisa de imágenes sin subir)
//   node studio/rbxbuild.mjs plan  screens/X.rbxui.json          -> JSON con las URLs a subir (servir rbxui/ en :8765)
//   node studio/rbxbuild.mjs record resultado_upload.json        -> guarda {url: rbxassetid} en assets/rbx_assets.json
// Instalar: execute_luau (Edit) -> ModuleScript temporal con Source = el .build.luau -> require(m)(opciones) -> destruir.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const R = require('./rbxjson.js');
const { DATA: ROOT } = require('./paths.cjs');
const MAP_FILE = path.join(ROOT, 'assets', 'rbx_assets.json');
const BASE_URL = 'http://127.0.0.1:8765';

export const loadAssets = () => (fs.existsSync(MAP_FILE) ? JSON.parse(fs.readFileSync(MAP_FILE, 'utf8')) : {});
const localPath = (s) => String(s).replace(/^\.?\/?(\.\.\/)*/, '');

// imágenes locales del documento -> rbxassetid (las que falten se listan)
export function resolveImages(doc, map = loadAssets()) {
  const missing = new Set();
  const walk = (n) => {
    const p = n.props;
    if (p) for (const k of ['Image', 'HoverImage', 'PressedImage']) {
      if (typeof p[k] !== 'string' || !p[k] || /^rbxasset/.test(p[k]) || /^https?:/.test(p[k])) continue;
      const lp = localPath(p[k]);
      if (map[lp]) p[k] = map[lp]; else { missing.add(lp); p[k] = ''; }
    }
    (n.children || []).forEach(walk);
  };
  doc.screens.forEach(walk);
  return [...missing];
}
export function imagesOf(doc) {
  const out = new Set();
  const walk = (n) => { const p = n.props; if (p) for (const k of ['Image', 'HoverImage', 'PressedImage']) if (typeof p[k] === 'string' && p[k] && !/^(rbxasset|https?:)/.test(p[k])) out.add(localPath(p[k])); (n.children || []).forEach(walk); };
  doc.screens.forEach(walk);
  return [...out];
}

const LUAU = String.raw`-- Generado por RbxUI (studio/rbxbuild.mjs) a partir de JSON rbxui. No editar: regenerar.
-- return function(opts) -> crea los ScreenGui en StarterGui (los anteriores con el mismo nombre van a ServerStorage.RbxUI_Backup)
local HttpService = game:GetService("HttpService")
local DOC = HttpService:JSONDecode([==[__DOC__]==])
local FORCED = HttpService:JSONDecode([==[__FORCED__]==])
local FONT_BASE = "rbxasset://fonts/families/"

return function(opts)
	opts = opts or {}
	local parentGui = opts.parent or game:GetService("StarterGui")
	local warns, count = {}, 0
	local function warnf(...) table.insert(warns, string.format(...)) end

	local function colorSeq(v)
		if type(v) == "string" then return ColorSequence.new(Color3.fromHex(v)) end
		local kp = {}
		for _, k in v do table.insert(kp, ColorSequenceKeypoint.new(k[1], Color3.fromHex(k[2]))) end
		return ColorSequence.new(kp)
	end
	local function numSeq(v)
		if type(v) == "number" then return NumberSequence.new(v) end
		local kp = {}
		for _, k in v do table.insert(kp, NumberSequenceKeypoint.new(k[1], k[2], k[3] or 0)) end
		return NumberSequence.new(kp)
	end
	local function conv(cur, v)
		local t = typeof(cur)
		if t == "Color3" then return Color3.fromHex(v)
		elseif t == "UDim2" then return UDim2.new(v[1], v[2], v[3], v[4])
		elseif t == "UDim" then return UDim.new(v[1], v[2])
		elseif t == "Vector2" then return Vector2.new(v[1], v[2])
		elseif t == "Vector3" then return Vector3.new(v[1], v[2], v[3])
		elseif t == "Rect" then return Rect.new(v[1], v[2], v[3], v[4])
		elseif t == "NumberRange" then return type(v) == "number" and NumberRange.new(v) or NumberRange.new(v[1], v[2])
		elseif t == "ColorSequence" then return colorSeq(v)
		elseif t == "NumberSequence" then return numSeq(v)
		elseif t == "EnumItem" then
			local ok, e = pcall(function() return cur.EnumType[v] end)
			if ok and e then return e end
			return Enum[tostring(cur.EnumType)][v]
		elseif t == "Font" then
			local fam = tostring(v.family or "SourceSansPro")
			if not fam:find("rbxasset") then fam = FONT_BASE .. fam .. ".json" end
			return Font.new(fam, Enum.FontWeight[v.weight or "Regular"], Enum.FontStyle[v.style or "Normal"])
		end
		return v
	end
	local function set(inst, k, v)
		local ok, cur = pcall(function() return inst[k] end)
		if not ok then warnf("%s.%s: propiedad desconocida", inst:GetFullName(), k) return end
		local ok2, err = pcall(function() inst[k] = conv(cur, v) end)
		if not ok2 then warnf("%s.%s = %s: %s", inst.Name, k, HttpService:JSONEncode(v), tostring(err)) end
	end
	local function setProps(inst, props)
		if not props then return end
		-- FontFace antes que Font (legado) y el resto después
		if props.FontFace ~= nil then set(inst, "FontFace", props.FontFace) end
		for k, v in props do if k ~= "FontFace" then set(inst, k, v) end end
	end
	local function attr(inst, k, v)
		if type(v) == "table" then v = HttpService:JSONEncode(v) end
		pcall(function() inst:SetAttribute(k, v) end)
	end

	-- ventanas destino de interacciones (necesitan UIScale para animarse)
	local targets = {}
	local function scan(n)
		for _, it in n.interactions or {} do if it.target then targets[it.target] = true end end
		for _, c in n.children or {} do scan(c) end
	end
	for _, s in DOC.screens do scan(s) end

	local function ensureScale(inst)
		if inst:IsA("GuiObject") and not inst:FindFirstChildWhichIsA("UIScale") then
			local s = Instance.new("UIScale") -- modificador para animar (no estructura)
			s.Name = "FxScale"
			s.Parent = inst
		end
	end

	local function build(n, parent, top)
		local ok, inst = pcall(Instance.new, n.ClassName)
		if not ok then warnf("%s (%s): clase no válida, se omite", tostring(n.Name), tostring(n.ClassName)) return end
		count += 1
		if inst:IsA("GuiObject") then setProps(inst, FORCED.GuiObject) end
		setProps(inst, FORCED[n.ClassName])
		setProps(inst, n.props)
		inst.Name = n.Name or n.ClassName
		for k, v in n.attributes or {} do attr(inst, k, v) end
		if n.interactions then attr(inst, "RbxUI_Interactions", n.interactions) end
		if n.buttonFx then
			attr(inst, "RbxUI_Hover", n.buttonFx.hover or 1.06)
			attr(inst, "RbxUI_Press", n.buttonFx.press or 0.9)
		end
		for _, c in n.children or {} do build(c, inst, false) end
		if n.buttonFx or targets[inst.Name] or top then ensureScale(inst) end
		inst.Parent = parent
		return inst
	end

	local backup = game:GetService("ServerStorage"):FindFirstChild("RbxUI_Backup")
	if not backup then
		backup = Instance.new("Folder")
		backup.Name = "RbxUI_Backup"
		backup.Parent = game:GetService("ServerStorage")
	end
	local built = {}
	for _, s in DOC.screens do
		local old = parentGui:FindFirstChild(s.Name)
		if old then
			if backup:FindFirstChild(s.Name) then old:Destroy() else old.Parent = backup end
		end
		local gui = Instance.new("ScreenGui")
		count += 1
		setProps(gui, FORCED.ScreenGui)
		setProps(gui, s.props)
		gui.Name = s.Name
		local d = s.design or {}
		attr(gui, "RbxUI_Native", true)
		attr(gui, "RbxUI_AutoScale", d.autoScale ~= false)
		attr(gui, "RbxUI_DesignW", d.width or 1280)
		attr(gui, "RbxUI_DesignH", d.height or 720)
		for k, v in s.attributes or {} do attr(gui, k, v) end
		for _, c in s.children or {} do build(c, gui, d.autoScale ~= false and true or false) end
		gui.Parent = parentGui
		table.insert(built, s.Name)
	end
	return string.format("RbxUI: %d instancias en %s%s", count, table.concat(built, ", "),
		#warns > 0 and ("\nAVISOS (" .. #warns .. "):\n" .. table.concat(warns, "\n")) or "")
end
`;

export function buildLuau(input, map) {
  const { doc } = R.validate(JSON.parse(JSON.stringify(input)));
  const missing = resolveImages(doc, map);
  const esc = (s) => { if (s.includes(']==]')) throw new Error('el JSON contiene "]==]"'); return s; };
  const src = LUAU.replace('__DOC__', () => esc(JSON.stringify(doc))).replace('__FORCED__', () => esc(JSON.stringify(R.FORCED)));
  return { src, missing, doc };
}

// ---------------------------------------------------------------- CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [a, b] = process.argv.slice(2);
  const readDoc = (f) => R.validate(JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8'))).doc;
  if (a === 'plan') {
    const map = loadAssets();
    const todo = imagesOf(readDoc(b)).filter((p) => !map[p]);
    for (const p of todo) if (!fs.existsSync(path.join(ROOT, p))) console.error('no existe: ' + p);
    console.log(JSON.stringify(todo.filter((p) => fs.existsSync(path.join(ROOT, p))).map((p) => `${BASE_URL}/${p}`)));
    console.error(`# ${todo.length} por subir (servir: cd rbxui && python -m http.server 8765 --bind 127.0.0.1)`);
  } else if (a === 'record') {
    const map = loadAssets();
    const res = JSON.parse(fs.readFileSync(path.resolve(b), 'utf8'));
    for (const [url, id] of Object.entries(res)) map[decodeURIComponent(url.replace(BASE_URL + '/', ''))] = String(id).startsWith('rbxassetid://') ? id : 'rbxassetid://' + String(id).replace(/\D/g, '');
    fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 1));
    console.log(`rbx_assets.json: ${Object.keys(map).length} imágenes`);
  } else {
    const file = a;
    const doc = readDoc(file);
    const { src, missing } = buildLuau(doc);
    const out = path.join(ROOT, 'out', 'native');
    fs.mkdirSync(out, { recursive: true });
    const name = String(doc.name || path.basename(file).replace(/\.rbxui\.json$|\.json$/, '')).replace(/[^\w-]/g, '');
    fs.writeFileSync(path.join(out, name + '.build.luau'), src);
    console.log(`out/native/${name}.build.luau (${(src.length / 1024).toFixed(1)} KB)`);
    if (missing.length) console.log(`AVISO: ${missing.length} imágenes sin subir (quedan vacías): ${missing.join(', ')}`);
  }
}
