# UI animation with TweenService

Sources: [UI animation/tweens](https://create.roblox.com/docs/ui/animation) · [TweenService](https://create.roblox.com/docs/reference/engine/classes/TweenService) · [TweenInfo](https://create.roblox.com/docs/reference/engine/datatypes/TweenInfo)

`TweenService:Create(instance, TweenInfo, goals)` interpolates numbers, `UDim2`, `UDim`, `Color3`, `Vector2`, `Rect`, booleans, `EnumItem`s and more.
Two tweens on the **same property** cancel each other (the newest wins) — cancel/replace deliberately.

Official tips: set `AnchorPoint` before tweening position; tween to **Scale** coordinates; keep a `UIAspectRatioConstraint` when tweening size.

## Durations that feel right

| Interaction | Duration | Easing |
|---|---|---|
| Button hover grow | 0.08–0.12 s | Quad Out |
| Button press shrink | 0.05–0.08 s | Quad Out (release: Back Out) |
| Window open (pop) | 0.2–0.3 s | Back Out |
| Window close | 0.12–0.18 s | Quad In |
| Slide-in panel | 0.25–0.35 s | Quint/Exponential Out |
| Reward/coin count-up | 0.6–1.2 s | Quad Out |
| Idle pulse / shine sweep | 1–2 s, looped | Sine InOut |

(These are design conventions, not Roblox rules.)

## Patterns (LocalScript)

```lua
local TweenService = game:GetService("TweenService")

-- pop-open a window through a UIScale (scales strokes/corners too)
local function open(window: GuiObject)
	local scale = window:FindFirstChildWhichIsA("UIScale") or Instance.new("UIScale", window)
	scale.Scale = 0.8
	window.Visible = true
	TweenService:Create(scale, TweenInfo.new(0.25, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Scale = 1 }):Play()
end

-- hover/press feedback for a button
local function juice(button: GuiButton)
	local scale = button:FindFirstChildWhichIsA("UIScale") or Instance.new("UIScale", button)
	local quick = TweenInfo.new(0.1, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
	button.MouseEnter:Connect(function() TweenService:Create(scale, quick, { Scale = 1.06 }):Play() end)
	button.MouseLeave:Connect(function() TweenService:Create(scale, quick, { Scale = 1 }):Play() end)
	button.MouseButton1Down:Connect(function() TweenService:Create(scale, quick, { Scale = 0.92 }):Play() end)
	button.MouseButton1Up:Connect(function() TweenService:Create(scale, quick, { Scale = 1.06 }):Play() end)
end

-- shine sweep across a button (UIGradient.Offset)
local function shine(gradient: UIGradient)
	gradient.Offset = Vector2.new(-1, 0)
	TweenService:Create(gradient, TweenInfo.new(1.2, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, false, 1.5),
		{ Offset = Vector2.new(1, 0) }):Play()
end
```

## In RbxUI

You don't need to write the open/close/hover code: `interactions` + `buttonFx` in the JSON are executed by the bundled `RbxUINative` LocalScript (pop/slide animations through a `UIScale`). See [../rbxui/interactions.md](../rbxui/interactions.md).

## Accessibility

Keep motion short; never animate essential text continuously; respect players who find big movement uncomfortable (offer a "reduce motion" setting for loops).
