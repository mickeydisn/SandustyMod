# Astro Seeds

A small Sandustry mod that adds an **astro seed family**: a seed that matures
over a liquid into a crystal, and powders that cluster together in water.

Everything is driven by two catalogues, one per thread, under `src/config/`:

- **`elementShared/`** — ids, element keys, shared types and the resolved
  `ElementType` map (used by both bundles).
- **`elementMain/`** — the *registration* catalogue: what the engine must be
  told (spec, colors, physics, contact reactions). Read by `main/build.ts`.
- **`elementWorker/`** — the *simulation* catalogue: the `Profile` list built
  directly from the `Move` / `Grow` / `Crystallization` actions. Read by
  `worker/build.ts`.

Profiles call the real actions directly — there is no spec DSL and no generic
factory in between. The only mod-supplied data is the two catalogues; both
builders come from the `@sandmd/element-profiles` package, and the main bundle
imports `@sandmd/element-profiles/main` (never the worker actions).

---

## 1. What it does

The core loop is **seed → grow → crystallise**:

1. Drop an **Astro Seed** into a liquid.
2. It drifts, ages, and after enough maturity it **crystallises**.
3. Burn the resulting crystal with **fire** to turn it back into a **powder**.
4. The powders (**Astro Gold / Astro Copper**) drift and interact in water via
   column forces (attraction/repulsion between the two families).

### The elements

| Element | Density | Matter | Role | How to get it |
|---------|--------:|--------|------|---------------|
| Astro Void Seed | 90 | Powder | Reagent | Craft: **seed** + **void petal** |
| Astro Seed | 145 | Static | Seed | Craft: **void seed** + **florinol** |
| Astro Gold Crystal | 200 | Static | Crystal | Astro Seed maturing in **liquid gold** |
| Astro Copper Crystal | 0 | Static | Crystal | Astro Seed maturing in **liquid copper** |
| Astro Water Crystal | 0 | Static | Crystal | *(creative only)* |
| Astro Gold Powder | 145 | Powder | Seed | Burn **gold crystal** with fire |
| Astro Copper Powder | 145 | Powder | Seed | Burn **copper crystal** with fire |
| Astro Water Powder | 280 | Powder | Reagent | Burn **water crystal** with fire |

### Contact reactions

| Input A | Input B | Output A | Output B |
|---------|---------|----------|----------|
| seed | void petal | Astro Void Seed | — |
| Astro Void Seed | florinol | Astro Seed | — |
| Astro Gold Crystal | fire | Astro Gold Powder | fire |
| Astro Copper Crystal | fire | Astro Copper Powder | fire |
| Astro Water Crystal | fire | Astro Water Powder | fire |

### Seed profiles

`config/elementWorker/` lists one `Profile` per seed/liquid pair. A profile
pairs a **seed** with a **liquid** and a **crystal**, then defines its
**move → grow → crystallise** pipeline as plain action calls:

| File | Profiles |
|------|----------|
| `elementWorker/inWater.ts` | Astro Seed, Astro Gold Powder, Astro Copper Powder in water |
| `elementWorker/inGold.ts` | Astro Seed, Astro Gold Powder, Astro Copper Powder in liquid gold |
| `elementWorker/inCopper.ts` | Astro Seed in liquid copper |

`elementWorker/catalogue.ts` flattens those into `ASTRO_PROFILES`, which
`worker/build.ts` consumes directly. Catalogue keys are resolved to numeric
element types by the small helper in `elementWorker/keys.ts`, which also
expands the special `"empty"` / `"structure"` match keys.

> `Astro Water Powder` is marked as a seed but has no profile, so it isn't driven
> by the worker loop — it exists for the crystal→powder reaction.

---

## 2. Tech

A research node **Astro Seeds** (cost `4500`) is registered as a child of
`SteamTurbine` (falling back to `KineticPress` if that enum is absent).

---

## 3. Project layout

```
src/
├── modinfo.json            # manifest (id, entries, version)
├── main.ts                 # thin main-thread entry → buildMain()
├── worker.ts               # thin worker-thread entry → buildWorker()
│
├── config/
│   ├── elementShared/      # shared vocabulary (both bundles)
│   │   ├── ids.ts          # MOD_ID, VERSION, ASTRO_FIELD (age/vx/vy fields)
│   │   ├── keys.ts         # TVanillaElementKey / TAddedElementKey / TElementKey
│   │   ├── types.ts        # AstroElementSpec (extends package ElementSpec)
│   │   ├── util.ts         # `spec()` id builder + `safe()`
│   │   └── resolve.ts      # ElementType map (vanilla aliases + astro ids)
│   │
│   ├── elementMain/        # registration catalogue (main bundle)
│   │   ├── types.ts        # AstroElementMain = spec + reactions
│   │   ├── astro*.ts       # one entry per element
│   │   └── catalogue.ts    # ★ ASTRO_ELEMENTS + ASTRO_REACTIONS
│   │
│   └── elementWorker/      # simulation catalogue (worker bundle)
│       ├── keys.ts         # key → type helpers (+ "empty"/"structure")
│       ├── inWater.ts      # water profiles
│       ├── inGold.ts       # liquid-gold profiles
│       ├── inCopper.ts     # liquid-copper profiles
│       └── catalogue.ts    # ★ ASTRO_PROFILES (the worker's profile list)
│
├── main/
│   └── build.ts            # thin: buildElementMain(catalogue + tech) + toast
│
└── worker/
    └── build.ts            # thin: buildElementWorker(ASTRO_PROFILES) + log
```

> The generic parts (registration, reactions, tech node, hook install + dispatch)
> live in the workspace package **`packages/element-profiles`** — see its README.
> The mod's builders are thin wrappers that pass in the catalogues and add the
> mod's own UI touch (welcome toast).

### Two catalogues, one per thread

`config/elementMain/catalogue.ts` lists the eight `AstroElementMain<TElementKey>`
entries in `ASTRO_ELEMENTS`. Each entry carries the registration data for one
element:

```ts
{
    spec: { key, slug, name, description, colors, density, metaColor, matterType, … },
    reactions: ReactionSpec[],   // contact reactions by key
}
```

`ASTRO_REACTIONS` and `ASTRO_ELEMENT_BY_KEY` are derived views over that list.
**To add an element: create one `elementMain` file and add it to
`ASTRO_ELEMENTS`** — registration, i18n and discovery follow automatically.

Worker behaviour is declared separately in `config/elementWorker` as real
`Profile` objects (see above). Keeping the two catalogues apart is what lets the
main bundle stay free of the simulation actions.

### Builders live in the package

The generic work is in **`packages/element-profiles`**, which exposes one entry
point per thread:

| Entry point | Used by | Contents |
|-------------|---------|----------|
| `@sandmd/element-profiles/shared` | both | engine-free types (`Profile`, `ElementSpec`, `ReactionSpec`, …) + `resolveNum` / `safe` |
| `@sandmd/element-profiles/main` | `main/build.ts` | `buildElementMain` — i18n, elements + discoveries, reactions, tech node |
| `@sandmd/element-profiles/worker` | `worker/build.ts`, `elementWorker/*` | `Move` / `Grow` / `Crystallization`, `runProfile`, `buildElementWorker` |

This mod's builders are therefore thin:

- **`main/build.ts`** (`buildMain`) — calls `buildElementMain` with
  `ASTRO_ELEMENTS`, the pre-resolved `ElementType` map (for the vanilla keys the
  reactions reference) and the tech node config, then mirrors the returned ids
  and shows the welcome toast.
- **`worker/build.ts`** (`buildWorker`) — calls
  `buildElementWorker(ASTRO_PROFILES)`; the package installs one
  `element:update` hook per distinct seed type and dispatches each update to the
  first matching `Profile` (seed type + nearby liquid).

### Why the keys/types live where they do

`config/elementShared/keys.ts` holds the element-key union types and
`elementShared/types.ts` extends the package's `ElementSpec` with the astro
catalogue extras (`slug`, `toolboxLabel`, `isSeed`, `isCrystal`). Each
`elementMain` file only needs `keys`, `types`, `spec()` and `safe()`, so there is
no import-order hazard between the catalogue and the modules that read it.
`elementWorker/keys.ts` is the only place that turns those keys into numeric
element types.

---

## 4. Build & install

Deno workspace: `mods/astro-seeds` is a workspace member. Tasks (in `deno.json`):

| Task | What it does |
|------|--------------|
| `deno task build:main` | Bundle `src/main.ts` → `build/main.js` |
| `deno task build:worker` | Bundle `src/worker.ts` → `build/worker.js` |
| `deno task build:modinfo` | Copy `src/modinfo.json` → `build/` |
| `deno task build:toGame` | Copy `build/` into the game's mods folder |
| `deno task build` | All of the above, in order |
| `deno task check` | Type-check `src/main.ts` + `src/worker.ts` |
| `deno lint src` | Lint the source |

---

## 5. Configuration

There is no in-game panel and no runtime config buffer. The only setting is the
standard `enabled` boolean in `modinfo.json` (`default: true`). All element and
profile behaviour is fixed by `ASTRO_ELEMENTS`; edit the catalogue and rebuild to
change it.