# MCP tools

Server: `tool/studio/mcp.mjs` (stdio JSON-RPC, no dependencies; starts the editor server if needed). Tool descriptions are in Spanish; arguments are below.

## Design

| Tool | Arguments | Use |
|---|---|---|
| `rbxui_status` | — | Is the editor open? Open scene, selection, scenes, examples, logo folders |
| `rbxui_design_guide` | `examples`: `marked` (default) \| `all` \| `none` \| `id,id` | **Read first.** Format spec + house style + the user's reference UIs ("study notes") with a technique summary each |
| `rbxui_list_scenes` | — | All scenes (`native: true` = rbxui) |
| `rbxui_get_scene` | `names`: `"A,B"` | Scenes as one rbxui document |
| `rbxui_put_scene` | `rbxui`: document (object or JSON text), `open`: bool (default true) | Create/replace scenes; the open editor updates live. Returns `warnings` |
| `rbxui_render` | `name`, `scale`: 1\|2 | PNG of a saved scene as the editor paints it — **look at it after every change** |

## Live editor

| Tool | Arguments | Use |
|---|---|---|
| `rbxui_open_scene` | `name`, `save` | Open a scene in the user's editor |
| `rbxui_editor_selection` | — | What the user has selected, as rbxui ("fix this button") |
| `rbxui_editor_insert` | `nodes`: [rbxui nodes], `stage`: bool | Insert into the open scene (inside the selected container), unsaved so the user reviews it |

## References

| Tool | Arguments | Use |
|---|---|---|
| `rbxui_list_examples` / `rbxui_get_example` | — / `id` | The user's reference UIs (usually pasted from Figma) |
| `rbxui_add_example` | `name`, `desc`, `tags`, `rbxui` | Save a design as a reference |
| `rbxui_list_logos` | `folder` | User-uploaded logos; paths `assets/logos/…` work as `Image` |

## Roblox Studio (needs the RbxUI Connect plugin)

| Tool | Arguments | Use |
|---|---|---|
| `rbxui_studio_status` | — | Connected place, user, plugin version |
| `rbxui_studio_install` | `names`, `doc`, `upload` (default true) | Upload missing images, create Instances in `StarterGui` + `RbxUINative` LocalScript. Undoable (Ctrl+Z) |
| `rbxui_studio_upload_images` | `names` | Only upload local images (no API key: done by the plugin) |
| `rbxui_studio_list_guis` | — | ScreenGuis in StarterGui |
| `rbxui_studio_pull` | `names` (optional; default = Studio selection) | Bring an existing ScreenGui into the editor as rbxui — great for redesigns |
| `rbxui_build` | `names`, `doc` | Write `out/native/<doc>.build.luau` (a module that builds the UI) and list images still to upload |

## Recommended loop

1. `rbxui_status` → know if the editor/Studio are there.
2. `rbxui_design_guide` → read the format and the user's examples; follow their style if present.
3. Write the whole screen; `rbxui_put_scene`.
4. `rbxui_render` → compare with the intent and the [checklist](../checklist.md); fix; repeat (2–4 iterations is normal).
5. Optionally re-render at a phone size: set `design.width/height` to e.g. `844 × 390`, put, render.
6. `rbxui_studio_install` (or `rbxui_build`) when the user approves.
