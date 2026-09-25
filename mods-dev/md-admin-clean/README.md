# MdAdmin Clean Tool (`md-admin-clean`)

`md-admin-clean` · v0.1.0 · **dev**

A **clean, copy-pasteable mod template** for Sandustry: enable/disable handling, typed settings and
full cleanup, with almost no boilerplate in the mod itself.

Everything reusable lives in the workspace package **`@sandmd/modkit`** (`packages/modkit`) — the
mod has no `api.ts` / `config.ts` / `cleanup.ts` of its own.

To start a new mod: copy the folder, rename `MOD_ID` in `constants.ts` + `modinfo.json`, then fill
in `main()` / `teardown()`.

## Features

- Config-driven **`enabled`** switch mirrored between `modinfo.json#configSchema` and
  `src/constants.ts#SETTINGS`.
- Boot/teardown wiring driven by `readSettings` / `onSettingsChange`.
- When disabled, a full **prune / orphan / storage cleanup** pass runs (see below).
- Idempotent re-enable: `main()` is guarded by a `started` flag so content is never registered
  twice.

## Package dependencies

| Package           | Used for                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| `@sandmd/sandkit` | Global `sandkit` declaration.                                                                    |
| `@sandmd/modkit`  | `readSettings`, `onSettingsChange`, `runCleanup`, `runDisableCleanup`, `safe`, `SettingsSchema`. |

`@sandmd/modkit` in turn uses (on this mod's behalf):

| `@sandmd/modkit` helper | Effect                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `readSettings`          | Parses `api.settings.get` into a typed `{ enabled: boolean }`, clamping numbers, tolerating string/number serialisations and the `<modId>.enabled` fallback. |
| `onSettingsChange`      | Subscribes to `api.settings.onChange` and always hands back fully parsed values.                                                                             |
| `runCleanup`            | Light pass: `pruneStaleBuildings` + `pruneStaleItems`.                                                                                                       |
| `runDisableCleanup`     | Full pass: buildings, items, placed objects (`removeOrphanedObjects`) and `api.storage` keys (`wipeModStorage`).                                             |

## The enable switch

`src/modinfo.json` declares:

```json
"configSchema": {
    "enabled": { "type": "boolean", "default": true, "label": "Enabled",
        "description": "Master switch. When off, the mod prunes stale buildings/items, removes its orphaned placed objects and wipes its own storage." }
}
```

`src/constants.ts` mirrors it as a typed schema (keep the two in sync):

```ts
export const SETTINGS = {
    enabled: { type: "boolean", default: true },
} as const satisfies SettingsSchema;
```

Read it and react to changes:

```ts
import "@sandmd/sandkit";
import { onSettingsChange, readSettings, runDisableCleanup, safe } from "@sandmd/modkit";

applyEnabled(readSettings(MOD_ID, SETTINGS).enabled, "boot-disabled");
onSettingsChange(MOD_ID, SETTINGS, (cfg) => applyEnabled(cfg.enabled, "config-change"));
```

## Boot behaviour

| State                      | What happens                                                               |
| -------------------------- | -------------------------------------------------------------------------- |
| **Enabled**                | `main()` registers the mod content. Nothing is pruned.                     |
| **Disabled** (at boot)     | `teardown()` + `runDisableCleanup(MOD_ID, "boot-disabled", STORAGE_KEYS)`. |
| **Toggled off at runtime** | `teardown()` + `runDisableCleanup(MOD_ID, "config-change", STORAGE_KEYS)`. |
| **Toggled on at runtime**  | `main()` (guarded by `started`, so content is never registered twice).     |
| **Init error**             | `runDisableCleanup(MOD_ID, "init-error", STORAGE_KEYS)`.                   |

## What "disabled" removes (`@sandmd/modkit`)

Everything this mod creates is prefixed with `MOD_ID`, so a prefix scan over the live save finds
every leftover:

| Target                     | Function                                                               |
| -------------------------- | ---------------------------------------------------------------------- |
| `player.buildings` unlocks | `pruneStaleBuildings()`                                                |
| `player.inventory` items   | `pruneStaleItems()`                                                    |
| Placed structures          | `removeOrphanedObjects()` (`removeAtCellsWhenIdle`, per-cell fallback) |
| `api.storage` keys         | `wipeModStorage()` (declared keys + host per-mod bag)                  |

> Add every `api.storage.set(MOD_ID, key, …)` key to `STORAGE_KEYS` in `src/constants.ts`.
> `wipeModStorage` also enumerates the host's per-mod bag, so this list is mainly a safety net for
> lazily-written keys.

## Sandkit API used

Via `@sandmd/modkit`: `settings.get`, `settings.onChange`, `storage.ensure/get/remove/set`,
`structures.removeAtCellsWhenIdle` / `removeAtCell`, and `sandkit.state.store.player.buildings` /
`player.inventory` / `store.structures` for the prefix scans.

---

Layout and build details for every mod live in
[`doc/doc_ia/MOD_LAYOUT.md`](../../doc/doc_ia/MOD_LAYOUT.md) and
[`doc/doc_ia/MOD_BUILD.md`](../../doc/doc_ia/MOD_BUILD.md).
