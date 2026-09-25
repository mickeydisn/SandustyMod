# Astro Seeds

`astro.seeds` · v3.1.0 · **progress**

A small Sandustry mod that adds an **astro seed family**: a seed that matures over a liquid into a
crystal, and powders that cluster together in water via column forces.

The core loop is **seed → grow → crystallise**:

1. Drop an **Astro Seed** into a liquid.
2. It drifts, ages, and after enough maturity it **crystallises**.
3. Burn the resulting crystal with **fire** to turn it back into a **powder**.
4. The powders (**Astro Gold / Astro Copper**) drift and interact in water via column forces
   (attraction/repulsion between the two families).

Everything is driven by two catalogues, one per thread, under `src/config/`: `elementMain/`
(registration) and `elementWorker/` (simulation), with `elementShared/` holding the ids, keys, types
and resolved `ElementType` map both bundles use.

## Elements (registered)

| Element                   | Density | Matter | Role    | How to get it                                |
| ------------------------- | ------: | ------ | ------- | -------------------------------------------- |
| **Astro Void Seed**       |      90 | Powder | Reagent | Reaction: `seed` + `void petal`              |
| **Astro Seed**            |     145 | Static | Seed    | Reaction: `astro void seed` + `florinol`     |
| **Astro Gold Crystal**    |     200 | Static | Crystal | Astro Seed maturing in **liquid gold**       |
| **Astro Copper Crystal**  |       0 | Static | Crystal | Astro Seed maturing in **liquid copper**     |
| **Astro Water Crystal**   |       0 | Static | Crystal | Panel/creative placement (no worker profile) |
| **Astro Gold Powder**     |     145 | Powder | Seed    | Burn **gold crystal** with fire              |
| **Astro Copper Powder**   |     145 | Powder | Seed    | Burn **copper crystal** with fire            |
| **Astro Water Powder**    |     280 | Powder | Reagent | Burn **water crystal** with fire             |
| **Astro GC Alloy Powder** |     145 | Powder | Seed    | Registered powder (no reaction yet)          |

Element ids are `${MOD_ID}:<slug>`, e.g. `astro.seeds:astro-seed`. The catalogue lives in
`src/config/elementMain/catalogue.ts` (`ASTRO_ELEMENTS`); each entry is
`{ spec: AstroElementSpec, reactions: ReactionSpec[] }`. `ASTRO_REACTIONS` and
`ASTRO_ELEMENT_BY_KEY` are derived views over that list.

### Contact reactions

| Input A              | Input B    | Output A            | Output B |
| -------------------- | ---------- | ------------------- | -------- |
| `seed` (vanilla)     | void petal | Astro Void Seed     | —        |
| Astro Void Seed      | florinol   | Astro Seed          | —        |
| Astro Gold Crystal   | fire       | Astro Gold Powder   | fire     |
| Astro Copper Crystal | water      | Astro Copper Powder | water    |
| Astro Water Crystal  | fire       | Astro Water Powder  | fire     |

Vanilla keys the catalogue references (`liquidGold`, `liquidCopper`, `florinol`, `voidPetal`,
`seedBase`, `fire`, `water`, `sand`, `empty`) are resolved through alias lists in
`elementShared/resolve.ts`.

## Simulation profiles (worker)

`config/elementWorker/` lists one `Profile` per seed/liquid pair as plain `Move` / `Grow` /
`Crystallization` action calls — no spec DSL and no generic factory:

| File                        | Profiles                                                          |
| --------------------------- | ----------------------------------------------------------------- |
| `elementWorker/inWater.ts`  | Astro Seed, Astro Gold Powder, Astro Copper Powder in water       |
| `elementWorker/inGold.ts`   | Astro Seed, Astro Gold Powder, Astro Copper Powder in liquid gold |
| `elementWorker/inCopper.ts` | Astro Seed in liquid copper                                       |

`catalogue.ts` flattens those into `ASTRO_PROFILES` (7 active profiles), which `worker/build.ts`
hands to `buildElementWorker`. `elementWorker/keys.ts` turns catalogue keys into numeric element
types and expands the special `"empty"` / `"structure"` match keys (`"structure"` = every registered
`MatterType.Static` element).

## Tech node

A research node **Astro Seeds** (cost `4500`) is registered as a child of `SteamTurbine` (falling
back to `KineticPress`), through `buildElementMain`'s `tech` config.

## Live profile config (buffer-controls)

Every profile knob is exposed in-game: `buildMain()` registers a `JsonBuffer` record through
`@sandmd/buffer-controls`, one placeable structure per `P.<profileId>.<knob>`, with its own art, tag
and picker category. The worker observes the same buffer and reads it live through `live.ts`, so
changes apply in real time. `profileRuntime.ts` is the single source of truth:
`PROFILE_KNOBS × PROFILES → PROFILE_FIELDS` (record, sprites, tabs and validation are all derived).

## Package dependencies

| Package                           | Used for                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `@sandmd/sandkit`                 | Global `sandkit` declaration (`api`, `enums`, `react`, `state`).                                      |
| `@sandmd/modkit`                  | `findOrphanedObjects`, `pruneStaleBuildings` — boot-time leftovers pass.                              |
| `@sandmd/element-profiles/main`   | `buildElementMain` — i18n, element + discovery registration, reactions, optional tech node.           |
| `@sandmd/element-profiles/worker` | `buildElementWorker`, `Move`, `Grow`, `Crystallization` — worker actions + `element:update` dispatch. |
| `@sandmd/element-profiles/shared` | `Profile`, `ElementSpec`, `ReactionSpec`, `Ctx`, … (engine-free vocabulary).                          |
| `@sandmd/buffer-controls`         | `registerBufferControls` — turns `PROFILE_FIELDS` into placeable config structures + picker.          |
| `@sandmd/buffer`                  | `JsonBuffer` handle handed to the live config reader.                                                 |
| `@sandmd/shared`                  | `MatterType`, `TElementType`, `DirectionName`.                                                        |

The main bundle imports **`element-profiles/main`** (never the worker actions); the worker bundle
imports **`element-profiles/worker`**. `element-profiles/shared` is safe on both threads.

## Sandkit API used

| Area           | Calls                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Elements       | `elements.register`, `elements.getTypeFromId`, `elements.getDefinitionByType` (worker), `discoveries.addElementByType` |
| Events         | `events.on("element:update")` (installed by the package), `events.on("game:ready")`                                    |
| UI             | `ui.toast`                                                                                                             |
| Tech           | `tech.registerNode` (via `buildElementMain`)                                                                           |
| i18n           | `i18n.register` (`<id>                                                                                                 |
| Storage/Buffer | `JsonBuffer` shared buffer (`astro-seeds:profileConfig`) read by the worker                                            |

## Settings

Uses the shared settings pattern (see `mods-dev` / `mods-progress`): `configSchema` in
`modinfo.json` → typed `SETTINGS` → `readSettings` / `onSettingsChange` from `@sandmd/modkit`
(pub mods read `api.settings` directly). Disabling a mod runs a prune/orphan/storage cleanup
over everything prefixed with its id.

Per-key values for this mod:
[`doc/doc_ia/MOD_SETTINGS.md`](../../doc/doc_ia/MOD_SETTINGS.md#astro-seeds).

---

Layout and build details for every mod live in
[`doc/doc_ia/MOD_LAYOUT.md`](../../doc/doc_ia/MOD_LAYOUT.md) and
[`doc/doc_ia/MOD_BUILD.md`](../../doc/doc_ia/MOD_BUILD.md).
