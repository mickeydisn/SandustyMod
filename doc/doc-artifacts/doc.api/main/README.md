# Main entry APIs

`manifest.entry` (e.g. `main.js`) — full client API including UI, Pixi, input, signals interactables, tech, items, etc.

Official: [https://sandustry.com/sandkit.html](https://sandustry.com/sandkit.html) → **Main entry**.

## Rules

- Grid mutations are **deferred** (reads may see old cells until flush).
- Use `api.grid.mutate(writer => …)` for state-dependent grid writes.
- `sandkit.react` is available here only.

## Docs in this folder

Main-only (or primarily main) namespaces. APIs also on the worker live under [../shared/](../shared/).
