-- RbxUI Connect — plugin de Roblox Studio para RbxUI Studio (editor de UIs en http://localhost:5170/studio/).
-- Se instala desde el editor (ventana «Roblox Studio» → Instalar plugin) en %LOCALAPPDATA%\Roblox\Plugins\RbxUIConnect.lua.
--
-- Qué hace (long-poll a /api/studio/poll; cada trabajo se responde en /api/studio/result):
--   install  -> crea las Instances del JSON rbxui (build.luau vía ModuleScript temporal) + LocalScript RbxUINative; se puede Deshacer
--   upload   -> sube las imágenes locales que faltan como assets Image (EditableImage + AssetService:CreateAssetAsync, sin API key)
--   export   -> ScreenGui de Studio -> JSON rbxui (para editarlo en el editor)
--   list     -> ScreenGuis que hay en StarterGui
-- La UI del widget es del plugin (no del juego): se construye aquí con Instance.new.
local PLUGIN_VERSION = "1.0.0"

local RunService = game:GetService("RunService")
if not RunService:IsEdit() then return end

local HttpService = game:GetService("HttpService")
local ChangeHistoryService = game:GetService("ChangeHistoryService")
local AssetService = game:GetService("AssetService")
local StudioService = game:GetService("StudioService")
local Selection = game:GetService("Selection")
local StarterGui = game:GetService("StarterGui")
local ServerStorage = game:GetService("ServerStorage")
local StarterPlayer = game:GetService("StarterPlayer")
local Players = game:GetService("Players")

local SID = HttpService:GenerateGUID(false)
local alive = true
local url = tostring(plugin:GetSetting("RbxUI_Url") or "http://localhost:5170")
local enabled = plugin:GetSetting("RbxUI_Enabled") ~= false
local autoSync = plugin:GetSetting("RbxUI_Auto") == true

---------------------------------------------------------------- HTTP
local function enc(s) return HttpService:UrlEncode(tostring(s)) end
local function request(method, path, body)
	local opts = { Url = url .. path, Method = method }
	if body ~= nil then
		opts.Headers = { ["Content-Type"] = "application/json" }
		opts.Body = HttpService:JSONEncode(body)
	end
	local ok, res = pcall(HttpService.RequestAsync, HttpService, opts)
	if not ok then return nil, tostring(res) end
	local data = nil
	pcall(function() data = HttpService:JSONDecode(res.Body) end)
	if not res.Success then
		return nil, (data and data.error) or string.format("HTTP %d", res.StatusCode)
	end
	return data or res.Body, nil
end

---------------------------------------------------------------- base64 -> buffer (píxeles RGBA)
local B64 = {}
do
	local chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
	for i = 1, 64 do B64[string.byte(chars, i)] = i - 1 end
end
local function b64decode(s)
	local n = #s
	local pad = 0
	if string.sub(s, -2) == "==" then pad = 2 elseif string.sub(s, -1) == "=" then pad = 1 end
	local outLen = (n // 4) * 3 - pad
	local out = buffer.create(outLen)
	local o = 0
	for i = 1, n - 3, 4 do
		local a, b, c, d = string.byte(s, i, i + 3)
		local v = bit32.bor(bit32.lshift(B64[a] or 0, 18), bit32.lshift(B64[b] or 0, 12), bit32.lshift(B64[c] or 0, 6), B64[d] or 0)
		if o < outLen then buffer.writeu8(out, o, bit32.rshift(v, 16)) end
		if o + 1 < outLen then buffer.writeu8(out, o + 1, bit32.band(bit32.rshift(v, 8), 255)) end
		if o + 2 < outLen then buffer.writeu8(out, o + 2, bit32.band(v, 255)) end
		o += 3
		if i % 600000 == 1 then task.wait() end -- no congelar Studio con imágenes grandes
	end
	return out
end

---------------------------------------------------------------- JSON rbxui <- Instances (exportar)
local GUI = { Frame = true, TextLabel = true, TextButton = true, TextBox = true, ImageLabel = true, ImageButton = true,
	ScrollingFrame = true, CanvasGroup = true, ViewportFrame = true, VideoFrame = true }
local function concat(...)
	local out = {}
	for _, t in { ... } do for _, v in t do table.insert(out, v) end end
	return out
end
local COMMON = { "AnchorPoint", "AutomaticSize", "BackgroundColor3", "BackgroundTransparency", "BorderColor3", "BorderSizePixel", "ClipsDescendants",
	"LayoutOrder", "Position", "Rotation", "Size", "SizeConstraint", "Visible", "ZIndex", "Active", "Selectable" }
local TEXT = { "Text", "TextColor3", "TextSize", "FontFace", "TextScaled", "TextWrapped", "TextXAlignment", "TextYAlignment", "TextTransparency",
	"TextStrokeColor3", "TextStrokeTransparency", "RichText", "LineHeight", "TextTruncate", "MaxVisibleGraphemes" }
local IMAGE = { "Image", "ImageColor3", "ImageTransparency", "ScaleType", "SliceCenter", "SliceScale", "TileSize", "ImageRectOffset", "ImageRectSize", "ResampleMode" }
local PROPS = {
	Frame = COMMON, ViewportFrame = COMMON, VideoFrame = COMMON,
	CanvasGroup = concat(COMMON, { "GroupTransparency", "GroupColor3" }),
	ScrollingFrame = concat(COMMON, { "CanvasSize", "AutomaticCanvasSize", "ScrollingDirection", "ScrollBarThickness", "ScrollBarImageColor3",
		"ScrollBarImageTransparency", "ElasticBehavior", "ScrollingEnabled", "VerticalScrollBarInset", "HorizontalScrollBarInset" }),
	TextLabel = concat(COMMON, TEXT),
	TextButton = concat(COMMON, TEXT, { "AutoButtonColor", "Modal" }),
	TextBox = concat(COMMON, TEXT, { "PlaceholderText", "PlaceholderColor3", "ClearTextOnFocus", "MultiLine", "TextEditable" }),
	ImageLabel = concat(COMMON, IMAGE),
	ImageButton = concat(COMMON, IMAGE, { "AutoButtonColor", "HoverImage", "PressedImage", "Modal" }),
	UICorner = { "CornerRadius" },
	UIStroke = { "Color", "Thickness", "Transparency", "ApplyStrokeMode", "LineJoinMode", "Enabled", "BorderStrokePosition" },
	UIGradient = { "Color", "Transparency", "Rotation", "Offset", "Enabled" },
	UIPadding = { "PaddingTop", "PaddingBottom", "PaddingLeft", "PaddingRight" },
	UIListLayout = { "FillDirection", "Padding", "HorizontalAlignment", "VerticalAlignment", "SortOrder", "Wraps", "HorizontalFlex", "VerticalFlex", "ItemLineAlignment" },
	UIGridLayout = { "CellSize", "CellPadding", "FillDirection", "FillDirectionMaxCells", "SortOrder", "StartCorner", "HorizontalAlignment", "VerticalAlignment" },
	UIScale = { "Scale" },
	UIAspectRatioConstraint = { "AspectRatio", "AspectType", "DominantAxis" },
	UISizeConstraint = { "MinSize", "MaxSize" },
	UITextSizeConstraint = { "MinTextSize", "MaxTextSize" },
	UIFlexItem = { "FlexMode", "GrowRatio", "ShrinkRatio", "ItemLineAlignment" },
	ScreenGui = { "DisplayOrder", "Enabled", "IgnoreGuiInset", "ResetOnSpawn", "ZIndexBehavior", "ScreenInsets" },
}
-- siempre se escriben (el constructor de rbxui los fuerza distinto de Instance.new)
local ALWAYS = { BorderSizePixel = true, AutoButtonColor = true, ResetOnSpawn = true, ZIndexBehavior = true, ScreenInsets = true }
local r4 = function(x) return math.round(x * 10000) / 10000 end

local function encode(v)
	local t = typeof(v)
	if t == "Color3" then return "#" .. string.upper(v:ToHex())
	elseif t == "UDim2" then return { r4(v.X.Scale), v.X.Offset, r4(v.Y.Scale), v.Y.Offset }
	elseif t == "UDim" then return { r4(v.Scale), v.Offset }
	elseif t == "Vector2" then return { r4(v.X), r4(v.Y) }
	elseif t == "Rect" then return { v.Min.X, v.Min.Y, v.Max.X, v.Max.Y }
	elseif t == "NumberRange" then return { v.Min, v.Max }
	elseif t == "EnumItem" then return v.Name
	elseif t == "ColorSequence" then
		local out = {}
		for _, k in v.Keypoints do table.insert(out, { r4(k.Time), "#" .. string.upper(k.Value:ToHex()) }) end
		return out
	elseif t == "NumberSequence" then
		local kp = v.Keypoints
		if #kp == 2 and kp[1].Value == kp[2].Value and kp[1].Envelope == 0 then return r4(kp[1].Value) end
		local out = {}
		for _, k in kp do table.insert(out, k.Envelope ~= 0 and { r4(k.Time), r4(k.Value), r4(k.Envelope) } or { r4(k.Time), r4(k.Value) }) end
		return out
	elseif t == "Font" then
		local fam = v.Family
		local short = string.match(fam, "^rbxasset://fonts/families/(.+)%.json$")
		return { family = short or fam, weight = v.Weight.Name, style = v.Style.Name }
	elseif t == "number" then return r4(v)
	elseif t == "boolean" or t == "string" then return v
	end
	return nil
end

local defaults = {}
local function defaultOf(cls)
	if defaults[cls] == nil then
		local ok, inst = pcall(Instance.new, cls)
		defaults[cls] = ok and inst or false
	end
	return defaults[cls] or nil
end

local exported = 0
local function serialize(inst)
	local cls = inst.ClassName
	local list = PROPS[cls]
	if not list then return nil end
	if cls == "UIScale" and inst.Name == "FxScale" then return nil end -- lo añade el constructor para animar
	exported += 1
	local def = defaultOf(cls)
	local props = {}
	for _, k in list do
		local ok, v = pcall(function() return inst[k] end)
		if ok and v ~= nil then
			local e = encode(v)
			if e ~= nil then
				local same = false
				if def and not ALWAYS[k] then
					local ok2, dv = pcall(function() return def[k] end)
					if ok2 then same = HttpService:JSONEncode(encode(dv)) == HttpService:JSONEncode(e) end
				end
				if not same then props[k] = e end
			end
		end
	end
	local node = { ClassName = cls, Name = inst.Name, props = props }
	-- atributos: los de RbxUI vuelven a su forma; el resto se conservan
	local attrs = {}
	for k, v in inst:GetAttributes() do
		if k == "RbxUI_Interactions" and type(v) == "string" then
			pcall(function() node.interactions = HttpService:JSONDecode(v) end)
		elseif k == "RbxUI_Hover" then node.buttonFx = node.buttonFx or {}; node.buttonFx.hover = v
		elseif k == "RbxUI_Press" then node.buttonFx = node.buttonFx or {}; node.buttonFx.press = v
		elseif not string.match(k, "^RbxUI_") and (type(v) == "string" or type(v) == "number" or type(v) == "boolean") then attrs[k] = v
		end
	end
	if next(attrs) then node.attributes = attrs end
	local kids = {}
	for _, c in inst:GetChildren() do
		local s = serialize(c)
		if s then table.insert(kids, s) end
	end
	if #kids > 0 then node.children = kids end
	return node
end

local function screenDoc(guis)
	exported = 0
	local screens = {}
	for _, g in guis do
		local s = serialize(g)
		if s then
			s.props.Enabled = nil
			local a = g:GetAttributes()
			s.design = { width = a.RbxUI_DesignW or 1280, height = a.RbxUI_DesignH or 720, autoScale = a.RbxUI_AutoScale == true, background = "baseplate" }
			local keep = {}
			for k, v in a do
				if not (k == "RbxUI_Native" or k == "RbxUI_AutoScale" or k == "RbxUI_DesignW" or k == "RbxUI_DesignH") then keep[k] = v end
			end
			s.attributes = next(keep) and keep or nil
			table.insert(screens, s)
		end
	end
	return { format = "rbxui", version = 1, name = guis[1] and guis[1].Name or "Studio", screens = screens }
end

---------------------------------------------------------------- trabajos
local log -- se define con la UI

local function setSource(scr, src)
	local ok = pcall(function()
		game:GetService("ScriptEditorService"):UpdateSourceAsync(scr, function() return src end)
	end)
	if not ok then scr.Source = src end
end

local HANDLERS = {}

HANDLERS.install = function(p)
	local rec = ChangeHistoryService:TryBeginRecording("RbxUI: instalar " .. table.concat(p.screens or {}, ", "))
	local ok, res = pcall(function()
		local m = Instance.new("ModuleScript")
		m.Name = "RbxUI_Build"
		m.Source = p.src
		m.Parent = ServerStorage
		local okReq, fn = pcall(require, m)
		m:Destroy()
		if not okReq then error("el script de construcción falló: " .. tostring(fn)) end
		local msg = fn({})
		-- LocalScript de comportamiento (autoescala, ventanas, botones)
		local sps = StarterPlayer:FindFirstChildOfClass("StarterPlayerScripts") or StarterPlayer:WaitForChild("StarterPlayerScripts")
		local ls = sps:FindFirstChild("RbxUINative")
		if not ls then
			ls = Instance.new("LocalScript")
			ls.Name = "RbxUINative"
			ls.Parent = sps
		end
		if p.runtime then setSource(ls, p.runtime) end
		return msg
	end)
	if rec then ChangeHistoryService:FinishRecording(rec, ok and Enum.FinishRecordingOperation.Commit or Enum.FinishRecordingOperation.Cancel) end
	if not ok then error(res, 0) end
	local sel = {}
	for _, n in p.screens or {} do local g = StarterGui:FindFirstChild(n); if g then table.insert(sel, g) end end
	if #sel > 0 then Selection:Set(sel) end
	log("Instalado: " .. table.concat(p.screens or {}, ", "), "ok")
	return { message = tostring(res) }
end

HANDLERS.upload = function(p, job)
	local ids, errors = {}, {}
	local total = #p.items
	for i, it in p.items do
		log(string.format("Subiendo %d/%d: %s", i, total, it.name), "busy")
		local px, err = request("GET", "/api/studio/pixels?path=" .. enc(it.path))
		if not px then
			errors[it.path] = err
		else
			local ok, result, id = pcall(function()
				local img = AssetService:CreateEditableImage({ Size = Vector2.new(px.w, px.h) })
				img:WritePixelsBuffer(Vector2.zero, Vector2.new(px.w, px.h), b64decode(px.data))
				local r, assetId = AssetService:CreateAssetAsync(img, Enum.AssetType.Image, { Name = it.name, Description = "RbxUI Studio" })
				img:Destroy()
				return r, assetId
			end)
			if ok and result == Enum.CreateAssetResult.Success and id then
				ids[it.path] = id
				request("POST", "/api/studio/progress", { seq = job.seq, path = it.path, id = id, done = i, total = total, message = it.name })
			else
				errors[it.path] = ok and tostring(result) or tostring(result)
				request("POST", "/api/studio/progress", { seq = job.seq, done = i, total = total, message = "falló " .. it.name })
			end
		end
		task.wait(0.15)
	end
	local nOk, nErr = 0, 0
	for _ in ids do nOk += 1 end
	for _ in errors do nErr += 1 end
	log(string.format("Imágenes subidas: %d%s", nOk, nErr > 0 and (" · fallaron " .. nErr) or ""), nErr > 0 and "warn" or "ok")
	return { ids = ids, errors = errors, message = string.format("%d subidas, %d fallos", nOk, nErr) }
end

HANDLERS.list = function()
	local guis = {}
	for _, g in StarterGui:GetChildren() do
		if g:IsA("ScreenGui") then
			table.insert(guis, { name = g.Name, count = #g:GetDescendants(), native = g:GetAttribute("RbxUI_Native") == true, enabled = g.Enabled })
		end
	end
	return { guis = guis, place = game.Name }
end

HANDLERS.export = function(p)
	local guis = {}
	local seen = {}
	local function addGui(g)
		if g and g:IsA("ScreenGui") and not seen[g] then seen[g] = true; table.insert(guis, g) end
	end
	if p.selection then
		for _, s in Selection:Get() do addGui(s:IsA("ScreenGui") and s or s:FindFirstAncestorWhichIsA("ScreenGui")) end
		if #guis == 0 then error("Selecciona un ScreenGui (o algo dentro de uno) en el Explorador", 0) end
	else
		for _, n in p.names or {} do
			local g = StarterGui:FindFirstChild(n)
			if not g then error("No hay un ScreenGui «" .. n .. "» en StarterGui", 0) end
			addGui(g)
		end
	end
	local doc = screenDoc(guis)
	log(string.format("Enviado al editor: %s (%d instancias)", doc.name, exported), "ok")
	return { doc = doc, count = exported }
end

local queue = {}
local busy = false
local setBusy

local function runJob(job)
	local h = HANDLERS[job.type]
	busy = true
	setBusy(true, job.type)
	local ok, res = pcall(function()
		if not h then error("trabajo desconocido: " .. tostring(job.type), 0) end
		return h(job.payload or {}, job)
	end)
	busy = false
	setBusy(false)
	if ok then
		request("POST", "/api/studio/result", { seq = job.seq, ok = true, data = res, message = type(res) == "table" and res.message or nil })
	else
		log(tostring(res), "err")
		request("POST", "/api/studio/result", { seq = job.seq, ok = false, message = tostring(res) })
	end
end

---------------------------------------------------------------- UI del widget
local toolbar = plugin:CreateToolbar("RbxUI")
local button = toolbar:CreateButton("RbxUI Connect", "Conectar Roblox Studio con el editor RbxUI Studio", "")
button.ClickableWhenViewportHidden = true
local widget = plugin:CreateDockWidgetPluginGui("RbxUIConnect", DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Right, false, false, 320, 460, 260, 320))
widget.Title = "RbxUI Connect"
widget.Name = "RbxUIConnect"
button:SetActive(widget.Enabled)
button.Click:Connect(function() widget.Enabled = not widget.Enabled end)
widget:GetPropertyChangedSignal("Enabled"):Connect(function() button:SetActive(widget.Enabled) end)

-- colores del tema de Studio (claro / oscuro), repintados al cambiar de tema
local paintAuto = nil
local themed = {}
local function themeColor(color, modifier)
	local ok, c = pcall(function()
		return settings().Studio.Theme:GetColor(Enum.StudioStyleGuideColor[color], modifier and Enum.StudioStyleGuideModifier[modifier] or nil)
	end)
	return ok and c or nil
end
local function paintOne(t)
	local c = themeColor(t[3], t[4])
	if c and t[1].Parent ~= nil then t[1][t[2]] = c end
end
local function theme(inst, prop, color, modifier)
	local t = { inst, prop, color, modifier }
	table.insert(themed, t)
	local c = themeColor(color, modifier)
	if c then inst[prop] = c end
end
settings().Studio.ThemeChanged:Connect(function()
	for i = #themed, 1, -1 do
		local t = themed[i]
		if t[1].Parent == nil and t[1] ~= widget then table.remove(themed, i) else paintOne(t) end
	end
	if paintAuto then paintAuto() end
end)

local BRAND = ColorSequence.new({ ColorSequenceKeypoint.new(0, Color3.fromHex("B84DFF")), ColorSequenceKeypoint.new(0.45, Color3.fromHex("6A3CFF")),
	ColorSequenceKeypoint.new(0.75, Color3.fromHex("2D7BFF")), ColorSequenceKeypoint.new(1, Color3.fromHex("2FD6FF")) })
local FONT = Font.new("rbxasset://fonts/families/BuilderSans.json", Enum.FontWeight.Medium)
local FONT_B = Font.new("rbxasset://fonts/families/BuilderSans.json", Enum.FontWeight.Bold)

local function new(cls, props, kids)
	local i = Instance.new(cls)
	for k, v in props do if k ~= "Parent" then i[k] = v end end
	for _, k in kids or {} do k.Parent = i end
	if props.Parent then i.Parent = props.Parent end
	return i
end
local function corner(r) return new("UICorner", { CornerRadius = UDim.new(0, r) }) end
local function pad(t, s)
	return new("UIPadding", { PaddingTop = UDim.new(0, t), PaddingBottom = UDim.new(0, t), PaddingLeft = UDim.new(0, s or t), PaddingRight = UDim.new(0, s or t) })
end

local root = new("ScrollingFrame", { Name = "Root", Size = UDim2.fromScale(1, 1), BorderSizePixel = 0, ScrollBarThickness = 5, CanvasSize = UDim2.new(),
	AutomaticCanvasSize = Enum.AutomaticSize.Y, ScrollingDirection = Enum.ScrollingDirection.Y, Parent = widget },
	{ pad(10), new("UIListLayout", { Padding = UDim.new(0, 8), SortOrder = Enum.SortOrder.LayoutOrder }) })
theme(root, "BackgroundColor3", "MainBackground")
theme(root, "ScrollBarImageColor3", "ScrollBar")

local function label(parent, text, size, order, bold, color)
	local l = new("TextLabel", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, Text = text,
		TextSize = size, FontFace = bold and FONT_B or FONT, TextXAlignment = Enum.TextXAlignment.Left, TextWrapped = true, LayoutOrder = order, Parent = parent })
	theme(l, "TextColor3", color or "MainText")
	return l
end
local function btn(parent, text, order, primary, width)
	local b = new("TextButton", { Size = UDim2.new(width or UDim.new(1, 0), UDim.new(0, 30)), Text = text, TextSize = 14, FontFace = FONT_B,
		AutoButtonColor = true, LayoutOrder = order, BorderSizePixel = 0, Parent = parent }, { corner(6) })
	if primary then
		b.BackgroundColor3 = Color3.new(1, 1, 1)
		b.TextColor3 = Color3.new(1, 1, 1)
		new("UIGradient", { Color = BRAND, Parent = b })
	else
		theme(b, "BackgroundColor3", "Button")
		theme(b, "TextColor3", "ButtonText")
		local s = new("UIStroke", { ApplyStrokeMode = Enum.ApplyStrokeMode.Border, Thickness = 1, Parent = b })
		theme(s, "Color", "Border")
	end
	return b
end
local function card(order)
	local f = new("Frame", { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, LayoutOrder = order, BorderSizePixel = 0, Parent = root },
		{ corner(8), pad(10), new("UIListLayout", { Padding = UDim.new(0, 6), SortOrder = Enum.SortOrder.LayoutOrder }) })
	theme(f, "BackgroundColor3", "Titlebar")
	return f
end

-- cabecera
local head = new("Frame", { Size = UDim2.new(1, 0, 0, 44), BackgroundTransparency = 1, LayoutOrder = 1, Parent = root })
local logo = new("TextLabel", { Size = UDim2.fromOffset(34, 34), Position = UDim2.fromOffset(0, 5), Text = "a", TextSize = 26, FontFace = FONT_B,
	TextColor3 = Color3.new(1, 1, 1), BackgroundColor3 = Color3.new(1, 1, 1), Parent = head }, { corner(9), new("UIGradient", { Color = BRAND, Rotation = 45 }) })
local _ = logo
local title = new("TextLabel", { Position = UDim2.fromOffset(44, 4), Size = UDim2.new(1, -44, 0, 20), BackgroundTransparency = 1, Text = "RbxUI Connect",
	TextSize = 17, FontFace = FONT_B, TextXAlignment = Enum.TextXAlignment.Left, Parent = head })
theme(title, "TextColor3", "MainText")
local dot = new("Frame", { Position = UDim2.fromOffset(44, 29), Size = UDim2.fromOffset(8, 8), BorderSizePixel = 0, BackgroundColor3 = Color3.fromRGB(140, 140, 150), Parent = head }, { corner(4) })
local statusL = new("TextLabel", { Position = UDim2.fromOffset(58, 24), Size = UDim2.new(1, -58, 0, 18), BackgroundTransparency = 1, Text = "Buscando RbxUI Studio…",
	TextSize = 13, FontFace = FONT, TextXAlignment = Enum.TextXAlignment.Left, TextTruncate = Enum.TextTruncate.AtEnd, Parent = head })
theme(statusL, "TextColor3", "SubText")

-- escenas
local cScenes = card(2)
label(cScenes, "Escenas del editor", 14, 1, true)
local sceneList = new("Frame", { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1, LayoutOrder = 2, Parent = cScenes },
	{ new("UIListLayout", { Padding = UDim.new(0, 4), SortOrder = Enum.SortOrder.LayoutOrder }) })
local hintScenes = label(cScenes, "Conéctate para ver las escenas.", 12, 3, false, "SubText")
local bInstallAll = btn(cScenes, "Instalar todas en StarterGui", 4, true)
local autoRow = new("TextButton", { Size = UDim2.new(1, 0, 0, 22), BackgroundTransparency = 1, Text = "", LayoutOrder = 5, Parent = cScenes })
local autoBox = new("Frame", { Size = UDim2.fromOffset(16, 16), Position = UDim2.fromOffset(0, 3), BorderSizePixel = 0, Parent = autoRow }, { corner(4) })
local autoTick = new("Frame", { Size = UDim2.fromOffset(8, 8), Position = UDim2.fromOffset(4, 4), BorderSizePixel = 0, BackgroundColor3 = Color3.new(1, 1, 1), Parent = autoBox }, { corner(2) })
local autoL = new("TextLabel", { Position = UDim2.fromOffset(24, 0), Size = UDim2.new(1, -24, 1, 0), BackgroundTransparency = 1, TextSize = 13, FontFace = FONT,
	Text = "Instalar solo al guardar en el editor", TextXAlignment = Enum.TextXAlignment.Left, Parent = autoRow })
theme(autoL, "TextColor3", "MainText")
paintAuto = function()
	autoTick.Visible = autoSync
	autoBox.BackgroundColor3 = autoSync and Color3.fromHex("6A3CFF") or themeColor("InputFieldBackground") or Color3.fromRGB(60, 60, 60)
end
paintAuto()

-- acciones
local cAct = card(3)
label(cAct, "Acciones", 14, 1, true)
local bPull = btn(cAct, "Editar la selección en RbxUI", 2, false)
local bUpload = btn(cAct, "Subir imágenes que faltan", 3, false)
local bOpen = btn(cAct, "Refrescar", 4, false)
label(cAct, "«Editar la selección» manda el ScreenGui seleccionado al editor como escena nativa.", 12, 5, false, "SubText")

-- actividad
local cLog = card(4)
label(cLog, "Actividad", 14, 1, true)
local logBox = new("Frame", { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1, LayoutOrder = 2, Parent = cLog },
	{ new("UIListLayout", { Padding = UDim.new(0, 3), SortOrder = Enum.SortOrder.LayoutOrder }) })

-- conexión
local cCfg = card(5)
label(cCfg, "Servidor del editor", 14, 1, true)
local urlBox = new("TextBox", { Size = UDim2.new(1, 0, 0, 28), Text = url, TextSize = 13, FontFace = FONT, ClearTextOnFocus = false, LayoutOrder = 2,
	TextXAlignment = Enum.TextXAlignment.Left, BorderSizePixel = 0, Parent = cCfg }, { corner(6), pad(4, 8) })
theme(urlBox, "BackgroundColor3", "InputFieldBackground")
theme(urlBox, "TextColor3", "MainText")
local bToggle = btn(cCfg, enabled and "Desconectar" or "Conectar", 3, false)
label(cCfg, "RbxUI Connect " .. PLUGIN_VERSION .. " · la primera vez Studio pide permiso HTTP para localhost: acéptalo.", 11, 4, false, "DimmedText")

local logN = 0
local COLORS = { ok = Color3.fromRGB(34, 211, 122), err = Color3.fromRGB(255, 90, 61), warn = Color3.fromRGB(255, 196, 112), busy = Color3.fromRGB(140, 125, 255) }
log = function(text, kind)
	logN += 1
	local row = new("Frame", { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1, LayoutOrder = -logN, Parent = logBox })
	new("Frame", { Size = UDim2.fromOffset(6, 6), Position = UDim2.fromOffset(0, 6), BorderSizePixel = 0, BackgroundColor3 = COLORS[kind or ""] or Color3.fromRGB(120, 120, 130), Parent = row }, { corner(3) })
	local l = new("TextLabel", { Position = UDim2.fromOffset(12, 0), Size = UDim2.new(1, -12, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1,
		Text = os.date("%H:%M:%S") .. "  " .. text, TextSize = 12, FontFace = FONT, TextWrapped = true, TextXAlignment = Enum.TextXAlignment.Left, Parent = row })
	theme(l, "TextColor3", kind == "err" and "ErrorText" or "MainText")
	local rows = {}
	for _, c in logBox:GetChildren() do if c:IsA("Frame") then table.insert(rows, c) end end
	if #rows > 12 then
		table.sort(rows, function(a, b) return a.LayoutOrder < b.LayoutOrder end)
		for i = 13, #rows do rows[i]:Destroy() end
	end
	if kind == "err" or kind == "warn" then warn("[RbxUI Connect] " .. text) end
end

local connected = false
local lastErr = ""
local function setStatus(ok, text)
	connected = ok
	dot.BackgroundColor3 = busy and COLORS.busy or ok and COLORS.ok or Color3.fromRGB(140, 140, 150)
	statusL.Text = text or (ok and "Conectado a RbxUI Studio" or "Buscando RbxUI Studio…")
end
setBusy = function(on, what)
	dot.BackgroundColor3 = on and COLORS.busy or connected and COLORS.ok or Color3.fromRGB(140, 140, 150)
	statusL.Text = on and ("Trabajando: " .. tostring(what)) or (connected and "Conectado a RbxUI Studio" or statusL.Text)
end

local function call(method, path, body, okMsg)
	task.spawn(function()
		local r, err = request(method, path, body)
		if not r then log(tostring(err), "err") elseif okMsg then log(okMsg, "ok") end
	end)
end
local function refreshScenes()
	local list, err = request("GET", "/api/scenes-meta")
	for _, c in sceneList:GetChildren() do if c:IsA("Frame") then c:Destroy() end end
	if not list then hintScenes.Text = "Sin conexión: " .. tostring(err); hintScenes.Visible = true; return end
	local n = 0
	for i, s in list do
		if s.native then
			n += 1
			local row = new("Frame", { Size = UDim2.new(1, 0, 0, 28), BackgroundTransparency = 1, LayoutOrder = i, Parent = sceneList })
			local l = new("TextLabel", { Size = UDim2.new(1, -86, 1, 0), BackgroundTransparency = 1, Text = s.name, TextSize = 14, FontFace = FONT,
				TextXAlignment = Enum.TextXAlignment.Left, TextTruncate = Enum.TextTruncate.AtEnd, Parent = row })
			theme(l, "TextColor3", "MainText")
			local b = btn(row, "Instalar", 1, true, UDim.new(0, 80))
			b.Position = UDim2.new(1, -80, 0, 0)
			b.Size = UDim2.fromOffset(80, 26)
			b.Activated:Connect(function()
				log("Instalando " .. s.name .. "…", "busy")
				call("POST", "/api/studio/install?names=" .. enc(s.name))
			end)
		end
	end
	hintScenes.Visible = n == 0
	hintScenes.Text = n == 0 and "No hay escenas nativas en el editor." or ""
end

bInstallAll.Activated:Connect(function()
	task.spawn(function()
		local list = request("GET", "/api/scenes-meta")
		if not list then log("Sin conexión con el editor", "err") return end
		local names = {}
		for _, s in list do if s.native then table.insert(names, s.name) end end
		if #names == 0 then log("No hay escenas nativas", "warn") return end
		log("Instalando " .. table.concat(names, ", ") .. "…", "busy")
		local r, err = request("POST", "/api/studio/install?names=" .. enc(table.concat(names, ",")) .. "&doc=RbxUI")
		if not r then log(tostring(err), "err") end
	end)
end)
bPull.Activated:Connect(function() call("POST", "/api/studio/pull", nil) end)
bUpload.Activated:Connect(function()
	task.spawn(function()
		local list = request("GET", "/api/scenes-meta")
		if not list then log("Sin conexión con el editor", "err") return end
		local names = {}
		for _, s in list do if s.native then table.insert(names, s.name) end end
		local r, err = request("POST", "/api/studio/upload?names=" .. enc(table.concat(names, ",")))
		if not r then log(tostring(err), "err") elseif r.uploaded == 0 and next(r.failed or {}) == nil then log("No falta ninguna imagen", "ok") end
	end)
end)
bOpen.Activated:Connect(function() task.spawn(refreshScenes) end)
autoRow.Activated:Connect(function()
	autoSync = not autoSync
	plugin:SetSetting("RbxUI_Auto", autoSync)
	paintAuto()
	log(autoSync and "Las escenas se instalarán solas al guardar en el editor" or "Instalación automática desactivada", "ok")
end)
urlBox.FocusLost:Connect(function()
	local v = string.gsub(urlBox.Text, "/+$", "")
	if v ~= url then url = v; plugin:SetSetting("RbxUI_Url", url); log("Servidor: " .. url, "ok") end
end)
bToggle.Activated:Connect(function()
	enabled = not enabled
	plugin:SetSetting("RbxUI_Enabled", enabled)
	bToggle.Text = enabled and "Desconectar" or "Conectar"
	if not enabled then setStatus(false, "Desconectado"); request("POST", "/api/studio/bye", { sid = SID }) end
end)

---------------------------------------------------------------- bucles: long-poll + trabajador
local userId = 0
pcall(function() userId = StudioService:GetUserId() end)
local userName = ""
task.spawn(function() pcall(function() userName = Players:GetNameFromUserIdAsync(userId) end) end)

task.spawn(function()
	while alive do
		if #queue > 0 then runJob(table.remove(queue, 1)) else task.wait(0.1) end
	end
end)

task.spawn(function()
	local wasConnected = false
	while alive do
		if not enabled then task.wait(1) else
			local q = string.format("/api/studio/poll?sid=%s&place=%s&placeId=%d&user=%s&userId=%d&version=%s&auto=%s",
				SID, enc(game.Name), game.PlaceId, enc(userName), userId, PLUGIN_VERSION, autoSync and "1" or "0")
			local data, err = request("GET", q)
			if data then
				if not wasConnected then
					wasConnected = true
					setStatus(true)
					log("Conectado a RbxUI Studio (" .. url .. ")", "ok")
					task.spawn(refreshScenes)
				end
				for _, job in data.jobs or {} do table.insert(queue, job) end
			else
				if wasConnected or lastErr ~= err then
					wasConnected = false
					lastErr = tostring(err)
					local hint = string.find(lastErr, "Http", 1, true) and " · acepta el permiso HTTP del plugin" or " · abre RbxUI Studio"
					setStatus(false, "Sin conexión" .. hint)
					log("Sin conexión: " .. lastErr, "warn")
				end
				task.wait(3)
			end
		end
	end
end)

plugin.Unloading:Connect(function()
	alive = false
	pcall(function() request("POST", "/api/studio/bye", { sid = SID }) end)
end)
