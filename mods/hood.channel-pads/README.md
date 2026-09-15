# Channel Pads

Independent Sandustry mod. **Ten pads. Ten channels. Two of each.**

Walk onto a linked pad and you fold to its twin. A third pad on the same
channel is refused with a toast.

## Drop-in

```
mods/hood.channel-pads/
  modinfo.json
  main.js
  assets/pad-0.png … pad-9.png   # 32×16 (idle | linked)
  i18n/en.json
```

Copy the folder into your Sandustry mods directory. Enable it. Pads unlock
immediately under **logistics**.

No worker entry. No tech tree. No Hollow Choir dependency.

## Rules

| Rule | Behaviour |
|---|---|
| Channels | `0`–`9`, each a separate structure in the build menu |
| Cap | **2 pads per channel** |
| Over cap | `api.hooks.intercept("building:place")` cancels + `api.ui.toast` |
| Link | Second pad of a channel paints both as “linked” |
| Travel | Player colliding with a pad cell → `api.player.setPositionAtWorld` at the twin |
| Cooldown | `1600 ms`, plus “skip until you walk off the landing pad” |
| Unpair | Demolish one pad → remaining pad goes idle |

## How teleport works

`api.teleportZones` is **not** a public Sandkit API. It lives on the internal
`engine.api` facade and still expects `state` as the first argument. Calling it
from a mod hard-crashes.

Public path only:

```js
api.player.setPositionAtWorld(worldX, worldY);
api.player.setVelocity(0, 0);
```

Landing is offset above / beside the dest pad (`isPositionClearAtWorld`) so the
player does not spawn inside the structure. After a jump we ignore that pad
until the player leaves it, then the 1.6 s cooldown applies.

Detection is a 50 ms Main trigger:

```js
api.player.isCollidingWithCell(pad.x, pad.y)
// or
api.player.isWithinRadiusOfCell(pad.x, pad.y, 1)  // radius in cells
```

## Placement limit

```js
api.hooks.intercept("building:place", (payload, ctx) => {
  if (countOnChannel(payload.structureId) >= 2) {
    api.ui.toast({ key: "mods|channelPads|toast|full", params: { channel } });
    ctx.cancel();
  }
}, { structureTypes: PAD_IDS });
```

`building:place` runs **before** the structure exists, so `count >= 2` is the
third attempt.

## Sprites

Each `pad-{n}.png` is two 16×16 frames:

- index `0` — idle, dim ring
- index `1` — linked, bright ring

`setSpritesheetIndex(structure, linked ? 1 : 0)` on every relink.

## Tune

| Constant | Default | Meaning |
|---|---|---|
| `CHANNELS` | `10` | Channels `0..9` |
| `MAX_PER_CHANNEL` | `2` | Hard cap |
| `COOLDOWN_MS` | `1600` | Jump lockout |

## API surface (Main, public only)

`structures.register` · `player.buildings.unlockById` · `hooks.intercept`
· `events.on` · `player.setPositionAtWorld` · `player.setVelocity`
· `player.isCollidingWithCell` · `player.isPositionClearAtWorld`
· `ui.toast` · `lights.temporary` · `triggers.register` · `sprites.loadFromMod`
· `i18n`
