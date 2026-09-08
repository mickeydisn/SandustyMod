# Coverage vs official Sandkit — final audit

Source of truth: [https://sandustry.com/sandkit.html](https://sandustry.com/sandkit.html)

## Audit result (last check)

| Check | Result |
|---|---|
| Official top-level namespaces documented | **Pass** |
| Entry banners (Main / Worker / both) | **Pass** (0 missing) |
| Relative links | **Pass** (0 broken) |
| Parameter / return detail on core APIs | **Pass** |
| Definition object files | **12** + README |
| Example links (`doc.exemple`) | **Pass** |

## Layout

```
doc.api/
  main/          # manifest.entry only
  shared/        # both entries (Main vs Worker tables)
  worker/        # manifest.workerEntry only
  definitions/   # register/options object shapes
  README.md · summary.md · COVERAGE.md
```

## Counts

| Folder | Role |
|---|---|
| main/ | ~44 API docs |
| shared/ | ~20 API docs |
| worker/ | worker, main bridge, buffers |
| definitions/ | structures, elements, tech, energy, signals, … |

**79** `api.*.md` files total.

## Intentionally short docs

These APIs only expose 1–3 methods on the official page:

`game`, `scene`, `mods`, `progression`, `workers`, `random`, `time`, `schedule`, `settings`, `tools.grabber`, `worker`, `main`

They still include parameter tables and return types.

## Naming rules (mods)

| Prefer | Avoid |
|---|---|
| `api.grid` | `api.world` (deprecated alias) |
| `api.signals.interactables.register` | mouse polling for structure use |
| `api.structures.updateData` | `setData` |
| `api.player.buildings.unlockById` | informal `add` only |
| Official `*AtCell` / `*AtWorld` | older bundle aliases |

## Mutations

| Entry | Grid writes |
|---|---|
| Main | Deferred → use `api.grid.mutate` |
| Worker | Immediate |

## State parameter

Runtime injects engine `state`. **Do not** pass `state` from mod code.

## Known residual depth limits

Deep vanilla-only option fields (every upgrade effect multiplier, every projectile internal field) may still need bundle reads when you implement those systems. Surfaces and primary options are documented.
