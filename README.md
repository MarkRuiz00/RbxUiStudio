<p align="center"><img src="tool/studio/brand/logo-128.png" width="96" alt="RbxUiStudio logo"></p>

<h1 align="center">RbxUiStudio</h1>

<p align="center"><b>Teach any AI to design great Roblox UI — and build it as real Instances.</b><br>
A skill (knowledge pack) + <b>RbxUI Studio</b>, a "Figma for AI" editor with an MCP server and a Roblox Studio plugin.</p>

<p align="center">
<a href="#install">Install</a> · <a href="SKILL.md">SKILL.md</a> · <a href="roblox-ui/README.md">Fundamentals</a> · <a href="estilos/README.md">Styles</a> · <a href="ejemplos/README.md">Examples</a> · <a href="checklist.md">Checklist</a> · <a href="#español">Español</a>
</p>

![Before / after](docs/before-after.png)

## What it is

AIs write Roblox UI badly: pixel offsets that break on phones, flat colors, no hierarchy, text you can't read. This repo fixes that from both sides:

- **Knowledge** (`SKILL.md` + docs): engine fundamentals verified against [create.roblox.com/docs](https://create.roblox.com/docs) (UDim2, AnchorPoint, constraints, layouts, 9-slice, safe area, text, TweenService…), style guides of top games (simulator, cartoony, stud, minimal), a final checklist, and curated textures/sunbursts from [ui-resources.com](https://ui-resources.com) with author credit.
- **Tool** ([`tool/`](tool/README.md)): RbxUI Studio. The AI writes a JSON tree of **real Roblox Instances** (`rbxui`), previews it exactly as Roblox lays it out, iterates on the render, and installs it in Studio with one call — images uploaded, no API key. Paste designs from Figma and they become editable Instances.
- **Examples** ([`ejemplos/`](ejemplos/README.md)): 8 complete, validated UIs with the design reasoning behind each.

![Examples](docs/examples-gallery.png)

## Install

### 1. The tool (RbxUI Studio)

```bash
git clone https://github.com/<you>/RbxUiStudio.git
cd RbxUiStudio/tool
npm install
npm start                      # editor at http://localhost:5170/
node ../tools/ui-resources.mjs fetch --examples   # textures used by the examples
```

Node.js 20+ and Google Chrome (or `npm run browser` for Playwright's Chromium). Details: [tool/README.md](tool/README.md).

### 2. The skill

**Claude Code** — install the skill and the MCP server:

```bash
git clone https://github.com/<you>/RbxUiStudio.git ~/.claude/skills/rbxui-studio
claude mcp add -s user rbxui -- node ~/.claude/skills/rbxui-studio/tool/studio/mcp.mjs
```

(The editor's **MCP** button can also register it for Claude Code, Claude Desktop and Cursor.)

**Claude.ai / Claude Desktop** — zip this folder and upload it as a custom skill (Settings → Capabilities → Skills; ⚠️ menu names may change). Add the MCP server to `claude_desktop_config.json` to let Claude build in the editor:

```json
{ "mcpServers": { "rbxui": { "command": "node", "args": ["/absolute/path/RbxUiStudio/tool/studio/mcp.mjs"] } } }
```

**Other agents (Cursor, Codex, Gemini CLI, Copilot…)** — point your rules/`AGENTS.md` at `SKILL.md` ("Before designing Roblox UI, read SKILL.md and follow it") and add the same MCP server. Agents without MCP can still use the copy-paste flow: [rbxui/without-mcp.md](rbxui/without-mcp.md).

### 3. Roblox Studio

Editor → **Studio** → install the **RbxUI Connect** plugin, open your place, allow HTTP to localhost. Then `rbxui_studio_install` puts the UI in `StarterGui`.

## How an AI uses it

```
read SKILL.md → rbxui_design_guide → write rbxui JSON → rbxui_put_scene → rbxui_render → fix → … → rbxui_studio_install
```

Every engine fact links to the official docs; anything unconfirmed is marked **⚠️ unverified**. `tools/validate.mjs` checks UIs against the official Roblox API (classes, writable properties, enum names, value shapes) generated from [Roblox/creator-docs](https://github.com/Roblox/creator-docs).

## Repo map

| Path | |
|---|---|
| [SKILL.md](SKILL.md) | Entry point: golden rules + workflow |
| [roblox-ui/](roblox-ui/README.md) | Engine fundamentals |
| [estilos/](estilos/README.md) | Style guides + [resources](estilos/resources.md) (ui-resources.com index) |
| [rbxui/](rbxui/README.md) | How to do everything in rbxui |
| [ejemplos/](ejemplos/README.md) | Example UIs (JSON + notes + renders) |
| [checklist.md](checklist.md) | Final verification |
| [tool/](tool/README.md) | RbxUI Studio (editor, MCP, plugin, runtime) |
| [tools/](tools/) | `validate.mjs`, `ui-resources.mjs`, `build-roblox-api.mjs` |

## Contributing

Wanted: new example UIs, style guides for more genres (horror, anime, tycoon, obby), fact fixes with doc links, translations, and tool improvements (9-slice preview, more Figma features).
Read [CONTRIBUTING.md](CONTRIBUTING.md) — the short version: verify facts against the official docs, run `node tools/validate.mjs examples`, never commit third-party art (link it with credit).

## License

[MIT](LICENSE) © 2026 RbxUiStudio. Third-party resources linked from `estilos/resources.md` belong to their authors. Roblox API data derived from Roblox/creator-docs (CC BY 4.0). Roblox is a trademark of Roblox Corporation; this project is not affiliated with Roblox.

---

## Español

**RbxUiStudio** enseña a cualquier IA a diseñar interfaces de Roblox de calidad y a construirlas como Instances reales con **RbxUI Studio**, nuestro editor tipo "Figma para IA".

- **Qué incluye:** la skill (`SKILL.md` + guías en inglés: fundamentos verificados con la documentación oficial de Roblox, estilos de juegos top, checklist, recursos de ui-resources.com con crédito a sus autores), la herramienta RbxUI Studio (editor, servidor MCP, plugin de Roblox Studio) y 8 ejemplos completos validados.
- **Instalar la herramienta:** `cd tool && npm install && npm start` → <http://localhost:5170/>. Requiere Node 20+ y Chrome.
- **Instalar la skill en Claude Code:** clona el repo en `~/.claude/skills/rbxui-studio` y registra el MCP con `claude mcp add -s user rbxui -- node <ruta>/tool/studio/mcp.mjs` (o con el botón **MCP** del editor).
- **Claude.ai / otros agentes:** sube la carpeta como skill o apunta tus reglas a `SKILL.md`; sin MCP puedes copiar y pegar el JSON en el editor.
- **Roblox Studio:** botón **Studio** del editor → instalar el plugin **RbxUI Connect** → la IA instala la UI en `StarterGui` y sube las imágenes sin API key.
- **Contribuir:** lee [CONTRIBUTING.md](CONTRIBUTING.md). Hechos con enlace a la doc oficial, ejemplos que pasen `node tools/validate.mjs examples`, y nada de arte de terceros dentro del repo.

La interfaz del editor está en español; la documentación de la skill, en inglés para llegar a más gente.
