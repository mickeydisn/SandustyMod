# @sandmd/element-profiles

A generic **element-profile** simulation core plus registration builders,
reusable across Sandustry mods that model "element over a medium → grow →
crystallize → move" behaviour.

It is split by thread so each bundle only pulls what it needs:

| Entry point | Import from | Contents |
|-------------|-------------|----------|
| `@sandmd/element-profiles/shared` | either thread | engine-free types (`Profile`, `ElementSpec`, `ReactionSpec`, …) + numeric helpers |
| `@sandmd/element-profiles/main` | main entry | `buildElementMain` — i18n, element + discovery registration, contact reactions, optional tech node |
| `@sandmd/element-profiles/worker` | worker entry | `Move` / `Grow` / `Crystallization`, `runProfile`, `Grid` / `GridNear`, `buildElementWorker` |
| `@sandmd/element-profiles` | none | convenience aggregate of all three (also pulls in the worker actions) |

## Layout

```
src/
├── index.ts            # aggregate re-export
├── shared/             # engine-free
│   ├── types.ts        # Profile, Ctx, MoveFn, GrowFn, SenseMatrix, …
│   ├── element.ts      # ElementVisual, ElementSpec, ReactionSpec, ElementMain
│   ├── num.ts          # resolveNum, roll
│   └── util.ts         # safe
├── main/
│   ├── build.ts        # buildElementMain
│   └── types.ts        # config + result types
└── worker/
    ├── build.ts        # buildElementWorker
    ├── pipeline.ts     # runProfile / reduceVotes
    ├── actions/        # Move, Grow, Crystallization
    └── utils/          # Grid, Sense, Vote, GridNear
```

Nothing touches `sandkit.api` at module scope: the builders read it lazily inside
each step, so importing a module is side-effect free.

## Main side

```ts
import { buildElementMain } from "@sandmd/element-profiles/main";

const { types, techRegistered } = buildElementMain({
    elements: ASTRO_ELEMENTS, // { spec: ElementSpec, reactions: ReactionSpec[] }[]
    types: ElementType,       // pre-resolved ids for keys reactions reference
    tech: {
        id: "astro.seeds:astro-seeds",
        nameKey: "astro.seeds.tech.name",
        descriptionKey: "astro.seeds.tech.description",
        name: "Astro Seeds",
        description: "Seed–crystal profiles over liquids.",
        cost: 4500,
        parents: ["SteamTurbine", "KineticPress"],
    },
});
```

`buildElementMain` registers per element the `<id>|name` / `<id>|description`
i18n strings, the element plus its discovery, and the catalogue's contact
reactions. `types` is the resolved key → element-type map (registered ids merged
over the caller's `types`), so a mod can keep its own registry in sync.

## Worker side

```ts
import { buildElementWorker } from "@sandmd/element-profiles/worker";
import { ASTRO_PROFILES } from "./catalogue.ts";

const { seedTypes } = buildElementWorker(ASTRO_PROFILES);
```

`buildElementWorker` installs one `element:update` hook per distinct
`Profile.seedType` and dispatches each event to the first profile whose seed
matches and whose liquid is nearby — re-enabling the seed's physics, cancelling
the vanilla update and running the profile. Cells with no match go back to their
normal physics.

Profiles are plain `Profile` objects built with the real actions:

```ts
import { Crystallization, Grow, Move } from "@sandmd/element-profiles/worker";
import type { Profile } from "@sandmd/element-profiles/shared";

export const astroSeedInWater: Profile = {
    id: "astroSeed-in-water",
    seedType: ElementType.astroSeed,
    liquidType: ElementType.water,
    crystalType: ElementType.astroGoldCrystal,
    tickSpeed: 50,
    ageField: ASTRO_FIELD.AGE,
    growAge: () => 150,
    moves: [Move.side(15), Move.down(20)],
    grow: [Grow.ageOnSurround(100, 4)],
    crystallization: [Crystallization.disk(1)],
};
```
