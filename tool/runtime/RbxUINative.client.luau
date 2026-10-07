-- RbxUINative (rbxui): comportamiento de las UIs nativas que crea studio/rbxbuild.mjs. Va en StarterPlayerScripts.
-- Solo REFERENCIA la UI de StarterGui (regla UI permanente); lee los atributos que puso el constructor:
--   ScreenGui  RbxUI_Native, RbxUI_AutoScale, RbxUI_DesignW/H, RbxUI_HidePaths ("StudUI.HUD.Buttons,...": se ocultan mientras esté Enabled)
--   Botón      RbxUI_Hover / RbxUI_Press (escala), RbxUI_Interactions (JSON: [{trigger="click", action="toggle|open|close", target, animation}])
-- La escala final de cada objeto = autoescala * animación de ventana * efecto de botón (un solo UIScale por objeto).

local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local RunService = game:GetService("RunService")
local HttpService = game:GetService("HttpService")
local Lighting = game:GetService("Lighting")
local ContentProvider = game:GetService("ContentProvider")

local pg = Players.LocalPlayer:WaitForChild("PlayerGui")

---------------------------------------------------------------- escala compuesta
local state = setmetatable({}, { __mode = "k" })
local function st(o)
	local s = state[o]
	if not s then
		s = { base = 1, anim = 1, fx = 1, tok = {} }
		state[o] = s
	end
	return s
end
local function apply(o)
	local sc = o:FindFirstChildWhichIsA("UIScale")
	local s = state[o]
	if sc and s then sc.Scale = s.base * s.anim * s.fx end
end
local function tweenField(o, field, to, t, style, dir)
	local s = st(o)
	local tok = {}
	s.tok[field] = tok
	local from, t0 = s[field], os.clock()
	local conn
	conn = RunService.RenderStepped:Connect(function()
		if s.tok[field] ~= tok then conn:Disconnect() return end
		local a = math.clamp((os.clock() - t0) / t, 0, 1)
		s[field] = from + (to - from) * TweenService:GetValue(a, style or Enum.EasingStyle.Quad, dir or Enum.EasingDirection.Out)
		apply(o)
		if a >= 1 then conn:Disconnect() end
	end)
end

---------------------------------------------------------------- desenfoque de fondo
local blur = Lighting:FindFirstChild("RbxUIBlur")
if not blur then
	blur = Instance.new("BlurEffect") -- efecto de cámara, no estructura de UI
	blur.Name = "RbxUIBlur"
	blur.Size = 0
	blur.Parent = Lighting
end

---------------------------------------------------------------- ventanas
local openWins = {}
local function anyOpen() for w in openWins do if w.Parent then return true end end return false end

local function closeWin(w, fast)
	if not w.Visible then openWins[w] = nil return end
	openWins[w] = nil
	local t = fast and 0.08 or 0.12
	tweenField(w, "anim", 0.85, t, Enum.EasingStyle.Quad, Enum.EasingDirection.In)
	if not anyOpen() then TweenService:Create(blur, TweenInfo.new(0.12), { Size = 0 }):Play() end
	task.delay(t, function()
		if not openWins[w] then
			w.Visible = false
			st(w).anim = 1
			apply(w)
		end
	end)
end

local function openWin(w, anim)
	for o in openWins do if o ~= w then closeWin(o, true) end end
	openWins[w] = true
	w.Visible = true
	local s = st(w)
	s.anim = anim == "none" and 1 or 0.78
	apply(w)
	tweenField(w, "anim", 1, 0.2, Enum.EasingStyle.Back)
	TweenService:Create(blur, TweenInfo.new(0.15), { Size = 14 }):Play()
end

local function findTarget(from, name)
	local gui = from:FindFirstAncestorWhichIsA("ScreenGui")
	local t = gui and gui:FindFirstChild(name, true)
	if t then return t end
	for _, g in pg:GetChildren() do
		if g:IsA("ScreenGui") then
			local x = g:FindFirstChild(name, true)
			if x then return x end
		end
	end
end
-- ventana = ancestro cuyo padre es el ScreenGui
local function windowOf(o)
	local cur = o
	while cur and cur.Parent and not cur.Parent:IsA("ScreenGui") do cur = cur.Parent end
	return cur
end

local function run(btn, it)
	local action = it.action or "toggle"
	local w = it.target and findTarget(btn, it.target) or (action == "close" and windowOf(btn))
	if not w or not w:IsA("GuiObject") then
		warn("[RbxUINative] destino no encontrado:", it.target, "desde", btn:GetFullName())
		return
	end
	if action == "close" then closeWin(w)
	elseif action == "open" then openWin(w, it.animation)
	elseif w.Visible and openWins[w] then closeWin(w)
	else openWin(w, it.animation) end
end

---------------------------------------------------------------- botones
local hooked = setmetatable({}, { __mode = "k" })
local function hookButton(b)
	if hooked[b] or not b:IsA("GuiButton") then return end
	local hover, press = b:GetAttribute("RbxUI_Hover"), b:GetAttribute("RbxUI_Press")
	local raw = b:GetAttribute("RbxUI_Interactions")
	if not hover and not raw then return end
	hooked[b] = true
	hover, press = hover or 1, press or 1
	local list = {}
	if raw then
		local ok, v = pcall(HttpService.JSONDecode, HttpService, raw)
		if ok and type(v) == "table" then list = v end
	end
	local inside = false
	b.MouseEnter:Connect(function() inside = true tweenField(b, "fx", hover, 0.12) end)
	b.MouseLeave:Connect(function() inside = false tweenField(b, "fx", 1, 0.12) end)
	b.MouseButton1Down:Connect(function() tweenField(b, "fx", press, 0.08) end)
	b.MouseButton1Up:Connect(function() tweenField(b, "fx", inside and hover or 1, 0.12, Enum.EasingStyle.Back) end)
	b.Activated:Connect(function()
		if not inside then tweenField(b, "fx", 1, 0.12, Enum.EasingStyle.Back) end
		for _, it in list do
			if (it.trigger or "click") == "click" then run(b, it) end
		end
	end)
end

---------------------------------------------------------------- autoescala (diseño 1280x720 -> pantalla real)
local function autoScale(gui)
	if gui:GetAttribute("RbxUI_AutoScale") == false then return end
	local W, H = gui:GetAttribute("RbxUI_DesignW") or 1280, gui:GetAttribute("RbxUI_DesignH") or 720
	local function upd()
		local a = gui.AbsoluteSize
		if a.Y <= 0 then return end
		local f = math.min(a.X / W, a.Y / H)
		for _, c in gui:GetChildren() do
			if c:IsA("GuiObject") then
				st(c).base = f
				apply(c)
			end
		end
	end
	gui:GetPropertyChangedSignal("AbsoluteSize"):Connect(upd)
	gui.ChildAdded:Connect(function() task.defer(upd) end)
	upd()
end

---------------------------------------------------------------- ocultar HUD original mientras la UI está activa
local function hidePaths(gui)
	local raw = gui:GetAttribute("RbxUI_HidePaths")
	if type(raw) ~= "string" or raw == "" then return end
	local function sync()
		for path in raw:gmatch("[^,]+") do
			local cur = pg
			for part in path:gmatch("[^%.]+") do
				cur = cur and cur:FindFirstChild(part)
			end
			if cur and cur:IsA("GuiObject") then cur.Visible = not gui.Enabled end
		end
	end
	gui:GetPropertyChangedSignal("Enabled"):Connect(sync)
	pg.ChildAdded:Connect(function() task.wait(1) sync() end)
	task.spawn(function()
		while gui.Parent do sync() task.wait(2) end
	end)
end

---------------------------------------------------------------- arranque
local function setup(gui)
	if not gui:IsA("ScreenGui") or gui:GetAttribute("RbxUI_Native") ~= true or hooked[gui] then return end
	hooked[gui] = true
	autoScale(gui)
	hidePaths(gui)
	local imgs = {}
	for _, d in gui:GetDescendants() do
		hookButton(d)
		if (d:IsA("ImageLabel") or d:IsA("ImageButton")) and d.Image ~= "" then table.insert(imgs, d) end
	end
	gui.DescendantAdded:Connect(hookButton)
	task.spawn(function() ContentProvider:PreloadAsync(imgs) end)
end

for _, g in pg:GetChildren() do setup(g) end
pg.ChildAdded:Connect(function(g) task.defer(setup, g) end)
