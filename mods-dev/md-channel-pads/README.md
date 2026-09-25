# Channel Pads

`md-channel-pads` · v1.0.0 · **dev**

TypeScript port of `hood.channel-pads`. **Ten pads. Ten channels. Two of each.**

Walk onto a linked pad and you fold to its twin. A third pad on the same channel is refused with a
toast.

## Features

| Rule     | Behaviour                                                                      |
| -------- | ------------------------------------------------------------------------------ |
| Channels | `0`–`9`, each a separate structure in the build menu                           |
| Cap      | **2 pads per channel**                                                         |
| Over cap | `api.hooks.intercept("building:place")` cancels + `api.ui.toast`               |
| Link     | Second pad of a channel paints both as “linked”                                |
| Travel   | Player colliding with a pad cell → `api.player.setPositionAtWorld` at the twin |
| Cooldown | `1600 ms`, plus “skip until you walk off the landing pad”                      |
| Unpair   | Demolish one pad → remaining pad goes idle                                     |

### Structures

One 1×1 structure per channel: id `${MOD}.pad.${ch}` (`md-channel-pads.pad.0` … `.pad.9`), category
`logistics`, unlocked via `player.buildings.unlockById`. `pad-{n}.png` is two 16×16 frames — index
`0` idle (dim ring), index `1` linked (bright ring) — applied through
`setSpritesheetIndex(pad, linked ? 1 : 0)`.

### Tunables (`src/constants.ts`)

| Constant           | Default | Meaning                 |
| ------------------ | ------- | ----------------------- |
| `CHANNELS`         | `10`    | Channels `0..9`         |
| `MAX_PER_CHANNEL`  | `2`     | Hard cap                |
| `COOLDOWN_MS`      | `1600`  | Jump lockout            |
| `STEP_INTERVAL_MS` | `50`    | Collision poll interval |

`CHANNEL_COLORS` holds the per-channel teleport-flash RGBA palette (10 entries + `FALLBACK_COLOR`).

## How teleport works

`api.teleportZones` is **not** a public Sandkit API. It lives on the internal `engine.api` facade
and still expects `state` as the first argument. Calling it from a mod hard-crashes.

Public path only:

```ts
api.player.setPositionAtWorld(worldX, worldY);
api.player.setVelocity(0, 0);
```

Landing is offset above / beside the dest pad (`isPositionClearAtWorld`) so the player does not
spawn inside the structure. After a jump we ignore that pad until the player leaves it, then the 1.6
s cooldown applies.

Detection is a 50 ms Main trigger:

```ts
api.player.isCollidingWithCell(pad.x, pad.y);
// or
api.player.isWithinRadiusOfCell(pad.x, pad.y, 1); // radius in cells
```

## Package dependencies

| Package           | Used for                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------ |
| `@sandmd/sandkit` | Global `sandkit` declaration and typed `api`.                                              |
| `@sandmd/shared`  | `StructureLike` type for the pad instances passed to `setSpritesheetIndex` / `updateData`. |

No `@sandmd/modkit`: the mod predates it and keeps its own `api.ts` helper (`toast`, `listChannel`,
`channelFromId`, …).

## Sandkit API used

| Area       | Calls                                                                                                                                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structures | `structures.register`, `structures.forEachOfType`, `structures.getTypeById`, `structures.isType`, `structures.updateData`, `structures.setSpritesheetIndex`, `structures.setSpritesheetIndexAtCell` |
| Player     | `player.buildings` (unlock), `player.isCollidingWithCell`, `player.isWithinRadiusOfCell`, `player.isPositionClearAtWorld`, `player.setPositionAtWorld`, `player.setPosition`, `player.setVelocity`  |
| Hooks      | `hooks.intercept("building:place")`                                                                                                                                                                 |
| Events     | `events.on("building:placed")`, `events.on("building:removed")`                                                                                                                                     |
| Triggers   | `triggers.register` (50 ms step poll)                                                                                                                                                               |
| Assets/UI  | `sprites.loadFromMod`, `ui.toast`, `i18n.register`                                                                                                                                                  |

---

Layout and build details for every mod live in
[`doc/doc_ia/MOD_LAYOUT.md`](../../doc/doc_ia/MOD_LAYOUT.md) and
[`doc/doc_ia/MOD_BUILD.md`](../../doc/doc_ia/MOD_BUILD.md).
