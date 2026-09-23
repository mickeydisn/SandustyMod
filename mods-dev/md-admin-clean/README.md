# MdAdmin Clean Tool (`md-admin-clean`)

A **clean, copy-pasteable mod template** for Sandustry. Three source files, no
boilerplate:

| File               | Responsibility                                                        |
| ------------------ | --------------------------------------------------------------------- |
| `src/modinfo.json` | Manifest + `configSchema.enabled` (the player-facing enable switch).  |
| `src/constants.ts` | `MOD_ID`, `VERSION`, `LOG`, owned `STORAGE_KEYS`, settings schema.    |
| `src/main.ts`      | `main()` (enabled) / `teardown()` (disabled) + the boot wiring.        |

Everything reusable lives in the workspace package **`@sandmd/modkit`**
(`packages/modkit`) — the mod itself has no `api.ts` / `config.ts` / `cleanup.ts`.

To start a new mod: copy the folder, rename `MOD_ID` in `constants.ts` +
`modinfo.json`, then fill in `main()` / `teardown()`.

## The enable switch

`src/modinfo.json` declares the setting the settings UI renders:

```json
"configSchema": {
    "enabled": {
        "type": "boolean",
        "default": true,
        "label": "Enabled",
        "description": "Master switch. When off, the mod prunes stale buildings/items, removes its orphaned placed objects and wipes its own storage."
    }
}
```

`src/constants.ts` mirrors it as a typed schema (keep the two in sync):

```ts
export const SETTINGS = {
    enabled: { type: "boolean", default: true },
} as const satisfies SettingsSchema;
```

Read it and react to changes with `@sandmd/modkit`:

```ts
import "@sandmd/sandkit";
import { onSettingsChange, readSettings, runDisableCleanup, safe } from "@sandmd/modkit";

applyEnabled(readSettings(MOD_ID, SETTINGS).enabled, "boot-disabled");
onSettingsChange(MOD_ID, SETTINGS, (cfg) => applyEnabled(cfg.enabled, "config-change"));
```

`readSettings` returns a fully typed object (`{ enabled: boolean }`), tolerating
string/number serialisations and the `<modId>.enabled` fallback. Numbers are
clamped to their `min`/`max`.

## Boot behaviour

| State                      | What happens                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| **Enabled**                | `main()` registers the mod content. Nothing is pruned.                                     |
| **Disabled** (at boot)     | `teardown()` + `runDisableCleanup(MOD_ID, "boot-disabled", STORAGE_KEYS)`.                  |
| **Toggled off at runtime** | `teardown()` + `runDisableCleanup(MOD_ID, "config-change", STORAGE_KEYS)`.                  |
| **Toggled on at runtime**  | `main()` (guarded by `started`, so content is never registered twice).                      |
| **Init error**             | `runDisableCleanup(MOD_ID, "init-error", STORAGE_KEYS)`.                                    |

## What "disabled" removes (`@sandmd/modkit`)

Everything this mod creates is prefixed with `MOD_ID`, so a prefix scan over the
live save finds every leftover:

| Target                     | Function                                        |
| -------------------------- | ----------------------------------------------- |
| `player.buildings` unlocks | `pruneStaleBuildings()`                         |
| `player.inventory` items   | `pruneStaleItems()`                             |
| Placed structures          | `removeOrphanedObjects()` (`removeAtCellsWhenIdle`, per-cell fallback) |
| `api.storage` keys         | `wipeModStorage()` (declared keys + host per-mod bag) |

`runCleanup(modId, reason)` is the light pass (buildings + items).
`runDisableCleanup(modId, reason, keys)` is the full pass above.

> Add every `api.storage.set(MOD_ID, key, …)` key to `STORAGE_KEYS` in
> `src/constants.ts`. `wipeModStorage` also enumerates the host's per-mod bag, so
> this list is mainly a safety net for lazily-written keys.

## Build

```sh
deno task check      # type-check src/main.ts
deno task build      # bundle main.js + copy modinfo into build/ and the game folder
```

Or just the bundle, without deploying to the game folder:

```sh
deno task build:main
deno task build:modinfo
```

The mod resolves `@sandmd/*` through the repo workspace (root `deno.json` lists
`./mods-dev/*`), so the imports work with plain `deno check` / `deno bundle`.
