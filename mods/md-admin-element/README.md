# MdAdmin

A tiny dev helper. Just a main thread, nothing else.

On load it:

1. **Opens the DevTools console** — `window.electron.openDevTools()` (the game is
   an Electron app, so DevTools is "the console").
2. **Injects a panel** (toggle: **Alt+L**, `api.ui.inject`) that lists every
   registered element with a best-effort link to the owning mod — the part of
   the element id before the `:`.

Element ids are like `astro.seeds:astro-seed`, so the reported mod is
`astro.seeds`. Built-in elements have no namespace and are shown as
`(built-in)`.

## Removing elements

Mod-added elements (and any "ghost" elements a previously-removed mod left in
the save) carry a **Remove** button. Removing deletes the element from the live
registry (`sandkit.mods.elements` / `sandkit.state.sandkit.mods.elements`).

Removal is **persistent**: the element ids are remembered in mod storage
(`api.storage`, key `removedElements`) and the scrub is re-applied on every load
— at init, on `game:ready`, and every 2 s — so removed elements do **not** come
back when you reload the game.

- **`Remove N`** — remove every currently mod-registered element.
- **`Reset`** — forget all remembered removals (restore them).

## Build

```
deno task check      # type-check src/main.ts
deno task build      # bundle main.js + copy modinfo into build/ and the game folder
```