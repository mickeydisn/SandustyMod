> **Entry:** Main + Worker.  
> **Deprecated alias of `api.grid`.** Prefer [api.grid.md](api.grid.md).

# `api.world`

Official Sandkit marks `api.world` as a **deprecated alias** of `api.grid`.

## Use instead

| Instead of | Prefer |
|---|---|
| `api.world.getDimensions()` | `api.grid.getDimensions()` |
| `api.world.mutate(...)` | `api.grid.mutate(...)` |
| `api.world.isCellEmptyAtCell` | `api.grid.isCellEmptyAtCell` |
| `api.world.excavateAtCell` | `api.grid.excavateAtCell` |
| `api.world.runWhenSimulationIdle` | `api.grid.mutate` |

## Related surfaces that stayed under world-like names

| API | Doc |
|---|---|
| Pickups | [../main/api.pickups.md](../main/api.pickups.md) (`api.world.pickups`) |
| Lights | [api.lights.md](api.lights.md) |

Full method matrices: [api.grid.md](api.grid.md).
