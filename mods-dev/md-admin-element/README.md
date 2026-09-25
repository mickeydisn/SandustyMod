# MdAdmin — Elements (`mdadmin`)

`mdadmin` · v0.1.0 · **dev**

A tiny dev helper. Just a main thread, nothing else.

On load it:

1. **Opens the DevTools console** — `window.electron.openDevTools()` (the game is an Electron app,
   so DevTools is "the console").
2. **Injects a panel** (toggle: **Alt+L**, `api.ui.inject`) that lists every registered element with
   a best-effort link to the owning mod — the part of the element id before the `:`.

Element ids are like `astro.seeds:astro-seed`, so the reported mod is `astro.seeds`. Built-in
elements have no namespace and are shown as `(built-in)`.

## Features

- **Element listing** — every type from `api.elements.getRegisteredTypes()`, with
  `getDefinitionByType` and `getNameByType`.
- **Owner attribution** — id prefix before `:`, else `(built-in)`.
- **Removal** — mod-added elements get a **Remove** button that deletes the entry from the live
  registry (`sandkit.mods.elements` / `sandkit.state.sandkit.mods.elements`).
- **Persistent blacklist** — removed ids are stored in `api.storage` under `removedElements` and
  re-scrubbed at init, on `game:ready` and every 2 s, so removed elements don't come back on reload.
- Bulk actions: **`Remove N`** (remove everything the registry reports) and **`Reset`** (forget all
  remembered removals).

## Package dependencies

| Package           | Used for                                                                   |
| ----------------- | -------------------------------------------------------------------------- |
| `@sandmd/sandkit` | Global `sandkit` declaration (`api`, `mods`, `react`, `state`). Type-only. |

No `@sandmd/modkit` — this dev tool needs direct access to the live registries.

## Sandkit API used

| Area       | Calls                                                                                   |
| ---------- | --------------------------------------------------------------------------------------- |
| Elements   | `elements.getRegisteredTypes`, `elements.getDefinitionByType`, `elements.getNameByType` |
| UI         | `ui.inject` (panel), `ui.toast`                                                         |
| Storage    | `storage.get`, `storage.set` (`removedElements`)                                        |
| Lifecycle  | `events.on("game:ready")`                                                               |
| Registries | `sandkit.mods.elements` / `sandkit.state.sandkit.mods.elements`, `sandkit.mods.matters` |
| Host       | `sandkit.react` (panel rendering), `window.electron.openDevTools()`                     |

## How removal works

`registry.ts` reads the live mod registry from `sandkit.mods` **or** `sandkit.state.sandkit.mods`
(accepting both shapes) and deletes `elements[id]` (+ its `matters[id]`) for every remembered id.
`reapplyRemovals()` is the scrub; `loadRemoved()` / `saveRemoved()` persist the blacklist.

> Only ids still present in the registry get a per-row button. A "ghost" element left in a save by a
> mod that is no longer installed is listed (its type is still registered) but has **no** button,
> because there is nothing left to delete. Use **`Remove N`** for everything the registry does
> report.

---

Layout and build details for every mod live in
[`doc/doc_ia/MOD_LAYOUT.md`](../../doc/doc_ia/MOD_LAYOUT.md) and
[`doc/doc_ia/MOD_BUILD.md`](../../doc/doc_ia/MOD_BUILD.md).
