-- RbxUIController (generado por rbxui): navegación + animaciones de ShopScreen / DailyScreen.
-- Solo REFERENCIA la UI que vive en StarterGui (regla UI permanente): anima UIScale, Position, Visible (los iconos quedan quietos).
-- Ajustes: atributos en ShopScreen  ->  HideLegacyHUD (bool, oculta el HUD original de StudUI mientras esta UI esté activa)

local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local Lighting = game:GetService("Lighting")

local player = Players.LocalPlayer
local pg = player:WaitForChild("PlayerGui")
local shopGui = pg:WaitForChild("ShopScreen")
local dailyGui = pg:WaitForChild("DailyScreen")
local rebirthGui = pg:WaitForChild("RebirthScreen")

-- ids de productos/pases (0 = sin configurar: solo anima)
local PRODUCTS = {
	StarterCard = { kind = "product", id = 0 },
	CashPass = { kind = "pass", id = 0 },
	VipPass = { kind = "pass", id = 0 },
	LuckPass = { kind = "pass", id = 0 },
}

local EASE_OUT = Enum.EasingDirection.Out

local function tween(o, t, props, style, dir)
	local tw = TweenService:Create(o, TweenInfo.new(t, style or Enum.EasingStyle.Quad, dir or EASE_OUT), props)
	tw:Play()
	return tw
end

local function scaleOf(o)
	return o and o:FindFirstChildOfClass("UIScale")
end

-- precarga de todas las imágenes: al abrir una ventana nada aparece a medias
task.spawn(function()
	local imgs = {}
	for _, gui in { shopGui, dailyGui, rebirthGui } do
		for _, d in gui:GetDescendants() do
			if (d:IsA("ImageLabel") or d:IsA("ImageButton")) and d.Image ~= "" then table.insert(imgs, d) end
		end
	end
	game:GetService("ContentProvider"):PreloadAsync(imgs)
end)

---------------------------------------------------------------- HUD original del juego
local function setLegacyHUD(visible)
	local stud = pg:FindFirstChild("StudUI")
	local hud = stud and stud:FindFirstChild("HUD")
	if not hud then return end
	for _, n in { "Buttons", "BottomLeft", "StarterPack" } do
		local f = hud:FindFirstChild(n)
		if f and f:IsA("GuiObject") then f.Visible = visible end
	end
end
if shopGui:GetAttribute("HideLegacyHUD") == nil then shopGui:SetAttribute("HideLegacyHUD", true) end
local function syncLegacy()
	setLegacyHUD(not (shopGui.Enabled and shopGui:GetAttribute("HideLegacyHUD") == true))
end
shopGui:GetAttributeChangedSignal("HideLegacyHUD"):Connect(syncLegacy)
shopGui:GetPropertyChangedSignal("Enabled"):Connect(syncLegacy)
task.defer(syncLegacy)
pg.ChildAdded:Connect(function(c) if c.Name == "StudUI" then task.wait(1) syncLegacy() end end)

---------------------------------------------------------------- ventanas
local windows = {
	Shop = shopGui:WaitForChild("ShopWindow"),
	Daily = dailyGui:WaitForChild("DailyWindow"),
	Rebirth = rebirthGui:WaitForChild("RebirthWindow"),
}
local openName = nil

local blur = Lighting:FindFirstChild("RbxUIBlur")
if not blur then
	local b = Instance.new("BlurEffect") -- efecto de cámara, no estructura de UI
	b.Name = "RbxUIBlur"
	b.Size = 0
	b.Parent = Lighting
	blur = b
end

local function cardsOf(win)
	local body = win:FindFirstChild("Body")
	local items = {}
	if not body then return items end
	for _, c in body:GetChildren() do
		if c:IsA("GuiObject") and scaleOf(c) and not c.Name:find("Shadow$") then table.insert(items, c) end
	end
	table.sort(items, function(a, b)
		if math.abs(a.AbsolutePosition.Y - b.AbsolutePosition.Y) > 8 then return a.AbsolutePosition.Y < b.AbsolutePosition.Y end
		return a.AbsolutePosition.X < b.AbsolutePosition.X
	end)
	return items
end

local close

local basePos = {}
for n, w in windows do basePos[n] = w.Position end

local function open(name)
	local w = windows[name]
	if not w then return end
	if openName == name then close(name) return end -- el mismo botón abre/cierra
	if openName then close(openName, true) end
	openName = name
	local s = scaleOf(w)
	w.Visible = true
	w.Position = basePos[name] + UDim2.fromScale(0, 0.04)
	tween(w, 0.2, { Position = basePos[name] }, Enum.EasingStyle.Quint)
	if s then
		s.Scale = 0.78
		tween(s, 0.2, { Scale = 1 }, Enum.EasingStyle.Back)
	end
	if blur then tween(blur, 0.15, { Size = 14 }) end
	for i, it in cardsOf(w) do
		local sc = scaleOf(it)
		if sc then
			sc.Scale = 0.7
			task.delay(0.04 + i * 0.025, function()
				if openName == name then tween(sc, 0.18, { Scale = 1 }, Enum.EasingStyle.Back) end
			end)
		end
	end
end

close = function(name, fast)
	local w = windows[name]
	if not w or not w.Visible then return end
	if openName == name then openName = nil end
	local s = scaleOf(w)
	if blur and not openName then tween(blur, 0.12, { Size = 0 }) end
	local t = fast and 0.08 or 0.12
	tween(w, t, { Position = basePos[name] + UDim2.fromScale(0, 0.03) }, Enum.EasingStyle.Quad, Enum.EasingDirection.In)
	if s then tween(s, t, { Scale = 0.85 }, Enum.EasingStyle.Quad, Enum.EasingDirection.In) end
	task.delay(t, function()
		if openName ~= name then
			w.Visible = false
			w.Position = basePos[name]
			if s then s.Scale = 1 end
		end
	end)
end

---------------------------------------------------------------- botones: hover / pulsación
local function hookButton(b)
	local s = scaleOf(b)
	if not s then return end
	local hovering = false
	b.MouseEnter:Connect(function() hovering = true tween(s, 0.12, { Scale = 1.06 }) end)
	b.MouseLeave:Connect(function() hovering = false tween(s, 0.12, { Scale = 1 }) end)
	b.MouseButton1Down:Connect(function() tween(s, 0.06, { Scale = 0.9 }) end)
	b.MouseButton1Up:Connect(function() tween(s, 0.22, { Scale = hovering and 1.06 or 1 }, Enum.EasingStyle.Back) end)
end

local function onClick(b, fn)
	b.Activated:Connect(fn)
end

for _, gui in { shopGui, dailyGui, rebirthGui } do
	for _, d in gui:GetDescendants() do
		if d:IsA("GuiButton") then hookButton(d) end
	end
end

local function find(root, path)
	local cur = root
	for part in path:gmatch("[^%.]+") do
		cur = cur and cur:FindFirstChild(part)
	end
	return cur
end

local function bind(root, path, fn)
	local b = find(root, path)
	if b and b:IsA("GuiButton") then onClick(b, fn) end
end

-- navegación
bind(shopGui, "HUDLeft.ShopButton", function() open("Shop") end)
bind(shopGui, "HUDLeft.DailyButton", function() open("Daily") end)
bind(shopGui, "HUDLeft.RebirthButton", function() open("Rebirth") end)
bind(shopGui, "HUDRight.StarterPackButton", function() open("Shop") end)
bind(shopGui, "HUDRight.X2MoneyButton", function() open("Shop") end)
bind(shopGui, "Currency.CashBar.AddButton", function() open("Shop") end)
bind(shopGui, "Currency.GemBar.AddButton", function() open("Shop") end)
bind(shopGui, "ShopWindow.Header.CloseButton", function() close("Shop") end)
bind(dailyGui, "DailyWindow.Header.CloseButton", function() close("Daily") end)
bind(rebirthGui, "RebirthWindow.Header.CloseButton", function() close("Rebirth") end)

-- pestañas: el resaltado se desliza a la pestaña pulsada
local tabs = find(shopGui, "ShopWindow.Body.Tabs")
local highlight = tabs and tabs:FindFirstChild("TabHighlight")
if tabs and highlight then
	for _, t in tabs:GetChildren() do
		if t:IsA("GuiButton") and t.Name:find("TabButton$") then
			onClick(t, function()
				tween(highlight, 0.28, { Position = t.Position }, Enum.EasingStyle.Back)
				local s = scaleOf(highlight)
				if s then s.Scale = 0.85 tween(s, 0.3, { Scale = 1 }, Enum.EasingStyle.Back) end
			end)
		end
	end
end

-- compras (solo si hay id configurado)
local MarketplaceService = game:GetService("MarketplaceService")
for cardName, info in PRODUCTS do
	local card = find(shopGui, "ShopWindow.Body." .. cardName)
	local buy = card and card:FindFirstChild("BuyButton")
	if buy and buy:IsA("GuiButton") then
		onClick(buy, function()
			if info.id == 0 then return end
			if info.kind == "pass" then
				MarketplaceService:PromptGamePassPurchase(player, info.id)
			else
				MarketplaceService:PromptProductPurchase(player, info.id)
			end
		end)
	end
end

-- reclamar: el siguiente día late
local claim = find(dailyGui, "DailyWindow.Body.ClaimButton")
if claim and claim:IsA("GuiButton") then
	onClick(claim, function()
		local day = find(dailyGui, "DailyWindow.Body.Day2")
		local s = scaleOf(day)
		if s then
			tween(s, 0.12, { Scale = 1.15 }).Completed:Once(function() tween(s, 0.35, { Scale = 1 }, Enum.EasingStyle.Back) end)
		end
	end)
end

-- Iconos: SIEMPRE quietos (sin tambaleo/latido/flotación). Solo se animan ventanas y botones.
