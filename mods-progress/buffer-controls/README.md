# Buffer Controls

`buffer-control` · v1.0.0 · **progress**

A self-contained demo of **`@sandmd/buffer-controls`**: it exposes a JSON record as a set of
**placeable structures** plus a hotbar **picker**, so a player can edit each field in-world.

The mod itself is configuration only — all generic wiring (catalogue, structure registers, value
refresh, picker) lives in the workspace package. `src/main.ts` declares which fields to expose,
which sprites to use, and the picker labels, then makes a single `registerBufferControls()` call.

## Features

- One placeable structure per declared field (`CONFIG_FIELDS` in `src/configSchema.ts`): a
  **number** stepper, a **bool** toggle, with inc/dec (and `×` variants) actions.
- Build-menu entry **“Buffer Controls”** that opens the variable picker.
- Picker tabs/categories, persist-selection, path scan (`maxDepth: 8`, containers included).
- A 32-slot `uint8` buffer schema (`BUF_LENGTH`) plus a `JSON_BUF_LENGTH` (2048 B) string buffer for
  column-force entries, with `JSON_COUNTER_INDEX` (slot 7) as the write/refresh change signal.
- Buffer is persisted and reloaded (`storage: { persist: true, load: true }`).

## Package dependencies

| Package                   | Used for                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------- |
| `@sandmd/sandkit`         | Global `sandkit` declaration.                                                          |
| `@sandmd/buffer-controls` | `registerBufferControls`, `BufferControlsField` — the whole buffer→structure pipeline. |
| `@sandmd/modkit`          | `findOrphanedObjects`, `pruneStaleBuildings` — boot-time leftovers pass.               |
| `@sandmd/shared`          | `TElementType` for column-force match lists.                                           |

## Sandkit API used

Almost everything is done **through `@sandmd/buffer-controls`** (structures register, sprites load,
picker + build list, value refresh). Directly, the mod only reads `sandkit.state` (debug dump in
`openDevTools`) and uses `console`/Electron DevTools.

## Settings

Uses the shared settings pattern (see `mods-dev` / `mods-progress`): `configSchema` in
`modinfo.json` → typed `SETTINGS` → `readSettings` / `onSettingsChange` from `@sandmd/modkit`
(pub mods read `api.settings` directly). Disabling a mod runs a prune/orphan/storage cleanup
over everything prefixed with its id.

Per-key values for this mod:
[`doc/doc_ia/MOD_SETTINGS.md`](../../doc/doc_ia/MOD_SETTINGS.md#buffer-controls).

---

Layout and build details for every mod live in
[`doc/doc_ia/MOD_LAYOUT.md`](../../doc/doc_ia/MOD_LAYOUT.md) and
[`doc/doc_ia/MOD_BUILD.md`](../../doc/doc_ia/MOD_BUILD.md).
