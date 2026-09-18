# MdAdmin

A tiny dev helper. Just a main thread, nothing else.

On load it:

1. **Opens the DevTools console** — `window.electron.openDevTools()` (the game is an Electron app,
   so DevTools is "the console").
2. **Injects a panel** (toggle: **Alt+L**, `api.ui.inject`) that lists every registered element with
   a best-effort link to the owning mod — the part of the element id before the `:`.

Element ids are like `astro.seeds:astro-seed`, so the reported mod is `astro.seeds`. Built-in
elements have no namespace and are shown as `(built-in)`.

## Removing elements

Mod-added elements — the ids present in the live registry (`sandkit.mods.elements` /
`sandkit.state.sandkit.mods.elements`) — carry a **Remove** button. Removing deletes the element
from that registry.

> Only ids still present in the registry get a button. A "ghost" element left in a save by a mod
> that is no longer installed is listed (its type is still registered) but has **no** per-row
> button, because there is nothing left to delete. Use **`Remove N`** for everything the registry
> does report.

Removal is **persistent**: the element ids are remembered in mod storage (`api.storage`, key
`removedElements`) and the scrub is re-applied on every load — at init, on `game:ready`, and every 2
s — so removed elements do **not** come back when you reload the game.

- **`Remove N`** — remove every currently mod-registered element.
- **`Reset`** — forget all remembered removals (restore them).

## Layout

| File               | Responsibility                                              |
| ------------------ | ----------------------------------------------------------- |
| `src/main.ts`      | Entry point: DevTools, the Alt+L toggle, boot wiring.       |
| `src/constants.ts` | Mod id, version, storage key, panel id, toggle, log prefix. |
| `src/types.ts`     | Local typing for the admin API surface + React subset.      |
| `src/api.ts`       | Typed `sandkit` handle, React handle, `safe()` / `toast()`. |
| `src/registry.ts`  | Element registry, the removal blacklist and row building.   |
| `src/styles.ts`    | `COLORS` + panel styles.                                    |
| `src/state.ts`     | Panel open flag + the external repaint handle.              |
| `src/panel.ts`     | The injected React panel.                                   |

## Build

```
deno task check      # type-check src/main.ts
deno task build      # bundle main.js + copy modinfo into build/ and the game folder
```
