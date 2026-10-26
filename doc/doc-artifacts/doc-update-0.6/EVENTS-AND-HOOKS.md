# Lifecycle Events & Hooks (0.6.0)

## Core events emitted by the 0.6 loader

| Event | When it fires | Typical mod use |
|---|---|---|
| `mods:initialized` | After all external mods (and their diagnostics) have been processed | Final registration that depends on other mods being present |
| `game:ready` | Game state, rendering, and sandkit are fully constructed | Safe UI injection, toasts, one-time world changes |
| `game:started` | Simulation manager loop is running | Continuous systems, music rotation, cinematic hand-off |

Example:

```js
sandkit.api.events.on("game:ready", ({ state }) => {
  sandkit.api.ui.toast("My mod is ready");
});

sandkit.api.events.on("mods:initialized", ({ state, blueprints }) => {
  // other mods’ content is now visible
});
```

## Content registration messages (simulation side)

The main thread posts these to the simulation workers after mod loading:

- `RegisterModMatters`
- `RegisterModElements`
- `RegisterModTerrains`
- `RegisterModStructures`

Your own registrations via `sandkit.api.elements.register`, `terrains.register`, `structures.register`, etc. ultimately travel through these paths.

## Hooks

The classic hook system remains available (`sandkit.api.hooks`).  
Prefer events for one-shot lifecycle reactions and hooks for interception points that must run every tick or on specific engine calls.

## Order of major phases (simplified)

1. Asset loading & splash  
2. External mod discovery + diagnostics collection  
3. Texture overrides + provider selection applied  
4. Shader overrides applied  
5. Worldgen / external map (if new game)  
6. Store / session construction  
7. Content registration (`RegisterMod*`)  
8. `mods:initialized`  
9. Final world population, tech reconciliation, foliage  
10. `game:ready`  
11. Loading screen fade-out, UI mount  
12. Simulation manager start → `game:started`

## Migration tip

Replace any `setTimeout` / `requestAnimationFrame` polling that waited for “the game to be ready” with a listener on `game:ready` or `mods:initialized`. The new events are stable and already used by the official loader.