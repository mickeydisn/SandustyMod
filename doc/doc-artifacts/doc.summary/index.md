# Sandustry Sandkit — Documentation

Structured guide to the modding API.  
Official reference: [sandkit.html](https://sandustry.com/sandkit.html)

Technical API pages live in [`doc.api/`](../doc.api/README.md).  
Worked examples live in [`doc.exemple/`](../doc.exemple/README.md).

---

## How mods run

| Entry | Manifest field | Role |
|---|---|---|
| **Main** | `entry` (e.g. `main.js`) | UI, input, registration, signals interactables |
| **Worker** | `workerEntry` (e.g. `worker.js`) | Simulation logic; grid writes are **immediate** |

- Main grid writes are **deferred** → use `api.grid.mutate` for read+write.
- Runtime injects engine state — **do not** pass `state` yourself.
- Prefer official names (`updateData`, `createAtCell`, `interactables.register`, …).

---

## Sections

| Section | Contents |
|---|---|
| [1. Getting started](01-getting-started/index.md) | Manifest, entries, access patterns |
| [2. World & simulation](02-world-simulation/index.md) | Grid, elements, terrains, fire, patterns |
| [3. Structures & logistics](03-structures/index.md) | Buildings, processing, recipes, belts, energy, signals |
| [4. Player, items & progression](04-player-items/index.md) | Player, tools, tech, upgrades, resources |
| [5. Combat, dig & entities](05-combat-entities/index.md) | Projectiles, excavation, entities, pickups |
| [6. UI, input & presentation](06-ui-input/index.md) | Input, UI, camera, sound, rendering, i18n |
| [7. Runtime services](07-runtime/index.md) | Events, hooks, storage, config, workers, buffers |
| [8. Definitions reference](08-definitions/index.md) | Object shapes for `register(...)` |

---

## Quick links

- [API coverage audit](../doc.api/COVERAGE.md)
- [Examples (10 complex mods)](../doc.exemple/README.md)
