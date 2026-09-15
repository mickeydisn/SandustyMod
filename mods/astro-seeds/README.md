# Astro Seeds

A small Sandustry mod that adds an **astro seed family**: a seed that matures
over a liquid into a crystal, and powders that cluster together in water.

Everything is driven by a single element catalogue
(`src/config/catalogue.ts`). The main thread registers elements, reactions and
i18n from it; the worker thread derives its seed profiles and simulation hooks
from it. There is **no second source of truth** and no config buffer — all
behaviour is baked in from the catalogue at build time.

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

The worker runs one profile per seed type. A profile pairs a **seed** with a
**liquid** and a **crystal**, then defines its **move → grow → crystallise**
pipeline:

- **Astro Seed in gold** — drifts (side/down), ages continuously (grow age 40),
  grows a **disk** of **Astro Gold Crystal**.
- **Astro Seed in copper** — drifts (side/down), grows on floor/wall/air/crystal
  and is blocked by water (grow age 10), grows a **cross** of **Astro Copper
  Crystal**.
- **Astro Gold Powder in water** — drifts and uses column forces: broadly
  repelled (−80), mildly repelled by its own kind (−10), strongly attracted to
  copper (+90). No grow / crystallise phase.
- **Astro Copper Powder in water** — drifts and is: broadly repelled (−80),
  attracted to gold (+30), mildly repelled by its own kind (−20).

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
│   ├── ids.ts              # MOD_ID, VERSION, ASTRO_FIELD (age/vx/vy cell fields)
│   ├── keys.ts             # TVanillaElementKey / TAddedElementKey / TElementKey
│   ├── util.ts             # `spec()` — builds an engine id from a slug
│   ├── catalogue.ts        # ★ ASTRO_ELEMENTS + ASTRO_REACTIONS (single source)
│   └── elementConf/        # one AstroElementConfig object per element
│
├── element/
│   └── types.ts            # shared config types (spec, reaction, profile, …)
│
├── main/
│   └── build.ts            # main builder: i18n, elements, reactions, tech
│
├── worker/
│   ├── build.ts            # worker builder: seed hooks + dispatch
│   └── elementProfileFactory.ts  # declarative ProfileSpec → () => Profile
│
└── shared/
    ├── resolve.ts          # ElementType map (vanilla aliases + astro ids)
    └── utils.ts            # `safe()` helper
```

### The catalogue is the single source of truth

`config/catalogue.ts` lists the eight `AstroElementConfig<TElementKey>` entries
in `ASTRO_ELEMENTS`. Each entry carries everything about one element:

```ts
{
    spec: { key, slug, name, description, colors, density, metaColor, matterType, … },
    reactions: ReactionSpec[],   // contact reactions by key
    profiles?: ProfileSpec[],    // worker seed profiles (move → grow → crystallise)
}
```

`ASTRO_REACTIONS` and `ASTRO_ELEMENT_BY_KEY` are derived views over the same
list. **To add an element: create one `elementConf` file and add it to
`ASTRO_ELEMENTS`** — registration, i18n, discovery and any seed profiles follow
automatically.

### Two builders, two threads

Both entries are one-line calls to a builder:

- **`main/build.ts`** (`buildMain`) — registers i18n strings, every element +
  discovery unlock, all contact reactions, and the tech node. Resolved type ids
  are stashed on the shared `ElementType` map so the worker sees the same
  numbers.
- **`worker/build.ts`** (`buildWorker`) — walks `ASTRO_ELEMENTS` for seed
  profiles, installs one `element:update` hook per distinct seed type, and
  dispatches each update to the matching `Profile` (via the shared
  `elementProfileFactory`).

### Why the keys/types live where they do

`config/keys.ts` holds the element-key union types, and `element/types.ts` holds
the shared config types (including the profile types). This keeps `catalogue.ts`
free of self-referencing imports — each `elementConf` file only needs `keys`,
`types` and the `spec()` helper, so there's no import-order hazard between the
catalogue and the modules that read it.

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