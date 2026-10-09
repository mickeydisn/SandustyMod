# My Own Mod — Documentation (`md-my-hown-mod-docs`)

> **Product descriptor** for the interactive documentation website of the Sandustry mod **`md-my-hown-mod`** ("Mod School" / "My Own Mod").

A zero-dependency, static single-page docs site that explains, visualizes, and lets you draft the entire JSON config surface of its sibling mod — elements, structures, items, recipes, processing, tech, energy, signals, triggers, and the programmable `processes -> atomic actions` engine.

Open `index.html` over HTTP and you get: a clickable relation graph, guided "Start here", full Content / Systems / Programme references, and a working in-browser config editor with visual program builder.

---

## 1. Product snapshot

| Item | Value |
|---|---|
| **Name** | My Own Mod — Documentation |
| **Package dir** | `mods-dev-ai/md-my-hown-mod-docs/` |
| **Documents** | `mods-dev-ai/md-my-hown-mod/` (id `md-my-hown-mod`, display name "Mod School", v0.1.4) |
| **Kind** | Static docs web app (no build step) |
| **Stack** | Vanilla HTML + CSS + JS, no npm/deno deps at runtime |
| **Serve** | `python3 -m http.server 8080 --bind 127.0.0.1` or `deno task serve` (see `deno.json`) |
| **Entry** | `index.html` |
| **State** | Hash routing (`#graph`, `#start`, ...) + `localStorage` for sidebar + editor draft |
| **Style** | Dark blue-grey panels, gold active nav, pixel titles + readable body — mirrors the in-game panel chrome |

Sibling mod in one line: an **in-game JSON configurator for Sandustry** — you author game content from a movable/minimizable panel overlay, it persists one JSON document under storage key `config`, and on load registers everything via the `sandkit` API (sandkit v0.5.7 coverage).

## 2. Who it is for

- **Mod authors / players** using `md-my-hown-mod` who want to know "what can I put in storage JSON?" without reading TypeScript.
- **Config designers** who want to prototype a full `config` JSON in the browser (editor tab) before pasting it into the game.
- **Contributors** to the mod who need the relation map ("what points at what") and the atomic-action catalogue.

## 3. What you can do here

### Relation graph (landing, `#graph`)

Interactive SVG dependency map of ~20 node types (Elements, Terrains, Structures, Items, Contacts, Recipes, Processors, Tech/Unlock nodes, Upgrades, Triggers, Signals, Modifiers, Energy nets/nodes, Processes, Atomic actions).

- Scroll to zoom, drag canvas to pan, drag boxes to rearrange.
- **Click a box -> jumps to its docs section.**
- Toolbar: `Reset`, `Fit view`, `Connected only` checkbox.
- Logic lives in `js/graph.js` (`NODES` + `EDGES` arrays). Edge labels document the reference field, e.g. `structures -> unlockNodes : unlockNode`, `structures -> sprites : render.imageName`, `processes -> actions : steps[]`, `processes -> buffers : buffer R/W`.

### Start here (`#start`)

Onboarding for the mod:

- **Overview** — what the mod does, "no item required" callout (panel is a movable overlay, minimized to a corner chip by default).
- **Getting started** — panel navigation (Group -> Tab -> List -> Edit), attached lists vs. fixed catalogues, `id` rename warning.
- **Config shape** — the whole `ModConfig` JSON skeleton (~20 top-level arrays). Missing keys default to `[]`; legacy `actions[]` auto-migrate to derived processes.
- **The panel** — attached lists, fixed read-only catalogues (Excavation options, Projectile options), filters (search, This mod / Game owner chips, hidden toggle).

### Content types (`#content`)

"Everything you author as world content."

| Anchor | Covers | Registered via |
|---|---|---|
| `#c-elements` | New simulation matter (powders/liquids/gases/solids, density, colour, flammability) | `api.elements.register` |
| `#c-terrains` | Static/diggable ground cells (HP, drops, fog/flammable/building flags) | `api.terrains.*` |
| `#c-structures` | Buildings (id, shape `number[][]`, category, unlockNode, render, default data) + attached Placement fields / Behaviours / Signals | `api.structures.register` |
| `#c-items` | Hotbar tools/weapons/consumables + attached Excavation profiles / Projectiles / fixed option catalogues | `api.items.register` |
| `#c-sprites` | Images from mod folder (`api.sprites.load`); referenced by `render.imageName` and `sprite.id` | `api.sprites.load` |
| `#c-buffers` | Mod-global shared slots (`path`, `type`, `value`, `min/max` for numbers); R/W via `bufferRead` / `bufferWrite` / `bufferIncrement` | buffer-store |

### Systems (`#systems`)

"How content interacts at runtime." Contacts (A+B->outputs), Recipes (grower/press/smelter/... kinds), Processors (structureType + intervalMs + processId), Tech nodes, Unlock nodes (gate structures), Upgrades, Triggers, Signals, Modifiers, Input bindings, Energy networks + Energy nodes.

Each article lists core fields, example JSON, and relation chips (e.g. Structures *gated by* Unlock nodes, *hosts* Processing/Signals/Energy).

### Programme (`#handlers`)

"What this mod can run, and what it can build."

- **Processes** (`#h-processes`) — named step lists with a `scope` (`signal`, `trigger`, `processing`, `upgrade`, `modifier`, `itemAction`). Steps compose atomic actions + `if { var, then[], else[] }` branching.
- **Atomic actions** (`#h-actions`) — the full vocabulary grouped by role colour (`sense` blue, `decide` purple, `act` red, `remember` green, `feel` gold, `connect` teal, `logic` orange, `block` pink) with per-action param lists and backing `sandkit.api.*` namespace (cells, effects, elements, energy, grid, player, processors, projectiles, random, signals, structures, tech, terrains, ui, upgrades + engine/processor built-ins).
- **IDs & prefixes** (`#h-ids`) — `md-my-hown-mod` and short prefix `mdmy` mark "This mod" ownership; never reuse vanilla/other-mod ids. Storage keys: `config` (full ModConfig), `panel` (overlay position/size/minimized).

### Config editor (`#editor`)

Working prototype editor (Blockly-inspired, no Blockly dep):

- Grouped menu mirroring the in-game panel, exhaustive per-collection forms (generated from `js/schema.js`), visual Program step stack with drag-and-drop + expand/collapse.
- Live raw-JSON view per entry, entry counts, import/export.
- Draft persists to `localStorage` key `md-my-hown-mod-config` (seeded from `emptyConfig()` when absent).

---

## 4. File map

```
mods-dev-ai/md-my-hown-mod-docs/
├── README.md          <- this file (product descriptor)
├── deno.json          <- tasks: serve (python http.server :8080), serve:deno (std file_server :8080)
├── index.html         <- all content (~1047 lines): sidebar nav + 6 sections + script tags
├── css/
│   └── styles.css     <- full theme (~1693 lines, ~36 KB): panels, tables, relation chips, graph, editor
└── js/
    ├── app.js         <- (~99 lines) hash router, sidebar collapse, section switching, lazy graph/editor boot
    ├── graph.js       <- (~313 lines) NODES/EDGES, hierarchical layout, SVG render, pan/zoom/drag/click-through
    ├── editor.js      <- (~1356 lines) config draft store, collection menu, forms, program-step builder, raw JSON sync
    └── schema.js      <- (~5973 lines) exhaustive schema: MENU_GROUPS, field defs, action catalogue, emptyConfig()
```

Total docs app ~10.5k lines (mostly `schema.js` + `index.html` tables).

---

## 5. Run it

No install. Serve over HTTP (hash routing expects HTTP, not `file://`):

```bash
cd mods-dev-ai/md-my-hown-mod-docs
# option 1 (python)
python3 -m http.server 8080 --bind 127.0.0.1
# option 2 (deno)
deno task serve
# then open http://127.0.0.1:8080/
```

Deep links work via hash: `#graph`, `#start`, `#content`, `#systems`, `#handlers`, `#editor`, plus `page/anchor` form (`#content/c-structures`, `#handlers/action-bufferWrite`) and bare anchors (`#c-elements`, `#h-processes`).

## 6. Key behaviours to know

- **Routing** (`js/app.js`): `PAGE_IDS = { graph, editor, start, content, systems, handlers }`; `ANCHOR_PAGE` maps every `c-*` / `s-*` / `h-*` / `role-*` / `action-*` / `api-*` anchor to its page; unknown -> `graph`. Uses `history.replaceState`; smooth-scrolls to anchors.
- **Sidebar**: collapsible (`<<` / `>>`), persisted as `md-sidebar-collapsed = 1/0`.
- **Graph**: pure SVG string render + event delegation; node drag vs. canvas pan distinguished by target; wheel zoom clamped 0.4-2.2; `Connected only` hides isolated nodes.
- **Editor**: never touches the game — it reads/writes only its own `localStorage` draft. Copy JSON out of the raw view into the mod's `config` storage to apply in-game.
- **No backend, no fetch** — `schema.js` is inlined data; all scripts are classic `<script>` (no modules), load order: `schema.js` -> `editor.js` -> `graph.js` -> `app.js`.

## 7. Relationship to `md-my-hown-mod`

| | `md-my-hown-mod` (the mod) | `md-my-hown-mod-docs` (this site) |
|---|---|---|
| Runs in | Sandustry (Deno-bundled `build/main.js`) | Any static HTTP server / browser |
| Source of truth | `src/` (config store, register/*, handler/engine + actions, ui/panel) | `index.html` + `js/schema.js` (hand-mirrored reference) |
| Config | Real game storage (`config`, `panel`) | Browser `localStorage` draft only |
| Panel spec | `MENU.md` (Groups/Tabs/Lists/Edits) + `src/ui/schema.ts` + `src/ui/panel/attach.ts` | "Start here -> The panel" article + editor menu groups |

> If the mod adds a collection, action, or field, update **both** `index.html` (human docs + tables) **and** `js/schema.js` (MENU_GROUPS, field lists, action catalogue) here. The graph's `NODES` / `EDGES` in `js/graph.js` must gain the new relation too.

## 8. Maintenance checklist

1. **New content type / system** -> add `<article id="c-*|s-*">` in `index.html`, add `ANCHOR_PAGE` entry in `js/app.js` if needed, add node/edge in `js/graph.js`, add menu group + field defs in `js/schema.js`.
2. **New atomic action** -> add `<tr id="action-<key>">` row under the right `#api-*` table in `index.html` **and** the action entry (role, description, params, API) in `js/schema.js` (source: `md-my-hown-mod/src/handler/engine/registry/*`).
3. **New process scope** -> extend `SLOTS` in `schema.js` + editor scope filter + docs in `#h-processes`.
4. **Styling** -> `css/styles.css` only; keep `.block`, `.relations .rel-chip`, `.table-wrap`, `.callout`, `.ed-*` conventions so editor-rendered tables match hand-written ones.
5. **Verify** -> serve locally, click every nav item, click a graph node, create/edit/export one entry per collection in `#editor`, check console for errors.

## 9. Non-goals / limits

- Not a replacement for the in-game panel — it cannot register content or talk to Sandustry.
- Schema here is a **mirror**, not generated — it can drift from `md-my-hown-mod/src/**` if not updated together.
- No search index, no mobile-first layout, no backend persistence; drafts live only in the browser that made them.

---

*Generated 2026-10-06 from reading `index.html`, `css/styles.css`, `js/app.js|graph.js|editor.js|schema.js`, `deno.json`, and sibling `md-my-hown-mod/modinfo.json` + `MENU.md`.*


