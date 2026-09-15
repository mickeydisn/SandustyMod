# MdAdmin

A tiny dev helper. Just a main thread, nothing else.

On load it:

1. **Opens the DevTools console** — `window.electron.openDevTools()` (the game is
   an Electron app, so DevTools is "the console").
2. Waits **1 second** for the element registry to settle.
3. **Prints every registered element** to the console, with a best-effort link
   to the owning mod — the part of the element id before the `:`.

Element ids are like `astro.seeds:astro-seed`, so the reported mod is
`astro.seeds`. Built-in elements have no namespace and are shown as
`(built-in)`.

## Build

```
deno task check      # type-check src/main.ts
deno task build      # bundle main.js + copy modinfo into build/ and the game folder
```