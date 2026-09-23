# Channel Pads

TypeScript port of `hood.channel-pads`. **Ten pads. Ten channels. Two of each.**

Walk onto a linked pad and you fold to its twin. A third pad on the same channel is refused with a
toast.

## Rules

| Rule     | Behaviour                                                                      |
| -------- | ------------------------------------------------------------------------------ |
| Channels | `0`–`9`, each a separate structure in the build menu                           |
| Cap      | **2 pads per channel**                                                         |
| Over cap | `api.hooks.intercept("building:place")` cancels + `api.ui.toast`               |
| Link     | Second pad of a channel paints both as “linked”                                |
| Travel   | Player colliding with a pad cell → `api.player.setPositionAtWorld` at the twin |
| Cooldown | `1600 ms`, plus “skip until you walk off the landing pad”                      |
| Unpair   | Demolish one pad → remaining pad goes idle                                     |

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

## Sprites

Each `pad-{n}.png` is two 16×16 frames:

- index `0` — idle, dim ring
- index `1` — linked, bright ring

`setSpritesheetIndex(structure, linked ? 1 : 0)` on every relink.

## Tune

| Constant           | Default | Meaning                 |
| ------------------ | ------- | ----------------------- |
| `CHANNELS`         | `10`    | Channels `0..9`         |
| `MAX_PER_CHANNEL`  | `2`     | Hard cap                |
| `COOLDOWN_MS`      | `1600`  | Jump lockout            |
| `STEP_INTERVAL_MS` | `50`    | Collision poll interval |

## Layout

| File               | Responsibility                                                 |
| ------------------ | -------------------------------------------------------------- |
| `src/main.ts`      | Entry point: i18n, sprite loads, register calls.               |
| `src/constants.ts` | Mod id, channels, cap, cooldown, palette, i18n keys, pad ids.  |
| `src/types.ts`     | Local typing for the sandkit API surface this mod uses.        |
| `src/api.ts`       | Typed API handle + shared helpers (`toast`, `listChannel`, …). |
| `src/state.ts`     | Runtime state (last jump per channel, skip-until-leave).       |
| `src/world.ts`     | Cell/world math, landing search and the teleport itself.       |
| `src/pads.ts`      | Paint/relink a channel, i18n and pad registration.             |
| `src/hooks.ts`     | Place limit, placed/removed lifecycle, step trigger.           |

## Build

```
deno task check      # type-check src/main.ts
deno task build      # bundle main.js, copy modinfo + assets + i18n into build/ and the game folder
```

`i18n/en.json` mirrors the strings registered at runtime and is shipped for reference; runtime
registration in `pads.ts` is authoritative.
