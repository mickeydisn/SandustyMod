# Shared APIs (Main + Worker)

These namespaces appear on **both** entries in [sandkit.html](https://sandustry.com/sandkit.html), but **method lists are not identical**.

## How to read each doc

Every shared doc has a **Main vs Worker** table:

| Symbol | Meaning |
|---|---|
| yes | Available on that entry |
| — | Not listed / not available |
| WhenIdle | Main-only deferred alias |

### Rules of thumb

| Concern | Where |
|---|---|
| `register` / `updateDefinition` for types | **Main** |
| Grid **writes** that depend on reads | Main: `api.grid.mutate` · Worker: direct (immediate) |
| Structure **build/remove/register** | **Main** |
| Structure **query / updateData / spritesheet** | Both |
| Player **inventory / movement set** | **Main** |
| Player **position get / collision** | Both |
| `api.ui` beyond `toast` | **Main** (worker: toast only) |

## Docs in this folder

| API | Diff summary |
|---|---|
| [grid](api.grid.md) | `mutate` Main-only; excavate both |
| [elements](api.elements.md) | register Main-only; swap/move Worker extras |
| [terrains](api.terrains.md) | register Main-only |
| [structures](api.structures.md) | register/build/remove Main-only |
| [player](api.player.md) | inventory/movement Main-only |
| [fire](api.fire.md) | almost same |
| [effects](api.effects.md) | distortion/laser Main-heavy |
| [events](api.events.md) / [hooks](api.hooks.md) | different event catalogs |
| [collector](api.collector.md) | same |
| [maps](api.maps.md) | start/artifacts Main-only; getActive both |
| [lights](api.lights.md) | temporary both; persistent Main |
| [patterns](api.patterns.md) | same |
