# Contributing to RbxUiStudio

Thanks for helping AIs (and people) build better Roblox UI! Every kind of contribution is welcome: fixing a fact, adding a style guide, a new example UI, or improving the tool.

## Ground rules

1. **Facts must be verifiable.** Anything about the engine must match the official docs at <https://create.roblox.com/docs>
   (source: <https://github.com/Roblox/creator-docs>). Link the page you used. If you can't confirm it, write **⚠️ unverified** next to it.
2. **Examples must be valid.** Every file in `ejemplos/` must import into RbxUI Studio without warnings and render.
   Run `node tools/validate.mjs examples` (checks against the official Roblox API in `tool/studio/roblox-api.json`; with RbxUI Studio running it also renders,
   using temporary `__check_*` scenes so your own screens are never touched) and commit the updated render PNG. CI runs the same checks with `--offline`.
   Keep every text **≥ 17 px** on the 1280×720 canvas (≥ 9 px on a phone after autoscale).
3. **No third-party assets in the repo.** Link to textures/icons (e.g. ui-resources.com entries) with author credit instead of copying files.
   Only add images you made yourself and release under MIT.
4. **English** for the docs; the README also has a Spanish section. Short sentences, concrete numbers, one idea per bullet.
5. **Small PRs.** One topic per pull request, with a short "why".

## Adding an example UI

1. Design it in RbxUI Studio (or write the JSON) — one `ScreenGui` per screen, unique sibling names.
2. Save it as `ejemplos/<kebab-name>.rbxui.json`.
3. Add `ejemplos/<kebab-name>.md` with: purpose, layout decisions, palette, what to change for phones.
4. Run `node tools/validate.mjs examples`; it writes `ejemplos/renders/<kebab-name>.png`.
5. Add a row to `ejemplos/README.md`.

## Adding a game teardown (`juegos/`)

1. Look at **real gameplay** screenshots (Roblox top bar visible) from guides or wikis — not thumbnails, not fan redesigns.
2. Copy the structure of an existing file: why the game matters (dated source), screen map, visual language table,
   sampled palette (mark it approximate), signature components, steal this / avoid, sources.
3. Name fonts by what they look like plus the closest Roblox family and mark them **⚠️ unconfirmed**.
4. Never add game art, logos or screenshots to the repo — describe and link.
5. Add the game to the table in `juegos/README.md`; if it changes a shared convention, update that list too.

## Adding a style guide

Use the structure of the existing files in `estilos/`: palette (hex), typography, button sizes, menu hierarchy, motion (TweenService values), do/don't, and a reference example.

## Reporting a wrong fact

Open an issue with: the file + line, what's wrong, and the official doc link that proves it.

## Code of conduct

Be kind, assume good intent, and keep discussions about the work.
