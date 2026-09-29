# Run & Test — Sandustry (dev workflow)

How to launch the game, attach to its console from a terminal, explore the live
`sandkit.api`, and test a mod's features without clicking around the UI.

Everything here was verified against **Sandustry 0.5.6** on macOS (arm64),
game installed at `~/Library/Application Support/Steam/steamapps/common/Sandustry`.

---

## 0. TL;DR

```bash
# 1. launch the game with a debug port (Steam build)
cd ~/Library/Application\ Support/Steam/steamapps/common/Sandustry
./Sandustry.app/Contents/MacOS/Sandustry --remote-debugging-port=9222

# 2. in another terminal — stream every console line
node doc/steam/sandkit-cdp.mjs log 60000

# 3. or evaluate an expression inside the game
node doc/steam/sandkit-cdp.mjs eval 'document.title'
```

---

## 1. Launching the game

### 1.1 Normal launch (Steam)

```bash
open "steam://rungameid/2764460"
```

`2764460` is the **Sandustry** Steam App ID (read it from
`~/Library/Application Support/Steam/steamapps/appmanifest_2764460.acf`).
The game is named *Sandustry*, not "Sandusty".

### 1.2 Launch with a debug port (needed for remote console access)

Steam passes no extra arguments through the URL scheme, so start the binary
directly. **Do not prefix it with `open`** — that would swallow the flag:

```bash
cd ~/Library/Application\ Support/Steam/steamapps/common/Sandustry
./Sandustry.app/Contents/MacOS/Sandustry --remote-debugging-port=9222
```

Verify it is listening:

```bash
curl -s http://127.0.0.1:9222/json/version
# → { "Browser": "Chrome/130…", "Protocol-Version": "1.3", … }
```

### 1.3 Stopping the game

```bash
pkill -f 'steamapps/common/Sandustry'
```

> **Port release is slow.** After `pkill`, Electron keeps the listening socket
> for several seconds. If you relaunch too fast you get
> `bind() failed: Address already in use (48)` and **no debug port** — the game
> still starts, which makes it look like the flag "didn't work".
> Wait for the port to clear first:
>
> ```bash
> pkill -f 'steamapps/common/Sandustry'; sleep 8
> lsof -nP -iTCP:9222   # must print nothing
> ```
>
> If a zombie still holds it, `kill -9 <pid>` the PID shown by `lsof`, or just
> use a different port (`--remote-debugging-port=9333` + `CDP_PORT=9333`).

---

## 2. Build & deploy a mod

Mods are **plain JS bundles** in a folder under the game's user data:

```
~/Library/Application Support/sandustry/mods/<mod-id>/
├── main.js        ← bundled entry
└── modinfo.json   ← manifest (id, entry, configSchema…)
```

Each mod in this repo has a `deno.json` with the full pipeline. For
`md-admin-clean`:

```bash
cd mods-dev/md-admin-clean
deno task check   # deno check src/main.ts   — type errors
deno task build   # bundle → copy into the game folder
```

`build` is three steps, and the last one is the important one:

| Task            | Does                                                |
| --------------- | --------------------------------------------------- |
| `build:main`    | `deno bundle -o build/main.js src/main.ts`          |
| `build:modinfo` | `cp src/modinfo.json build/modinfo.json`            |
| `build:toGame`  | `cp -r build/. ~/…/sandustry/mods/md-admin-clean`   |

> ### ⚠️ The host caches mod sources at app start
>
> Editing a mod and pressing `Cmd+R` (page reload) **re-runs the OLD bundle**.
> The mod list and every mod's source are read once when the app boots, so a
> reload happily re-executes stale code with no warning.
>
> **After every `deno task build`, fully restart the app** (section 1.3 + 1.2),
> otherwise you will debug code that is not running.
>
> This is the single most common source of "my change does nothing".

---

<!-- SECTION-2-3 -->

## 3. Two ways to reach the console

### 3.1 In-game DevTools (manual, no tooling)

`md-admin-clean/src/main.ts` already contains:

```ts
function openDevTools(): void {
    const electron = (globalThis as { electron?: { openDevTools?: () => void } }).electron;
    electron?.openDevTools?.();
    console.log("GAME STATE", sandkit.state);
}
```

So while that mod is enabled, DevTools opens automatically at boot. Paste
expressions in the **Console** tab. Good for poking around by hand; bad for
scripting or for capturing output to a file.

### 3.2 Remote CDP (scriptable — recommended)

[`sandkit-cdp.mjs`](./sandkit-cdp.mjs) is a dependency-free Node client for the
Chrome DevTools Protocol. It attaches to the game's renderer, so you can
evaluate expressions and stream `console.*` output to a terminal or a file.

```bash
# stream the console for 60s
node doc/steam/sandkit-cdp.mjs log 60000

# evaluate an expression, print the result
node doc/steam/sandkit-cdp.mjs eval 'Object.keys(window).length'

# evaluate a whole file
node doc/steam/sandkit-cdp.mjs file ./scratch.js

# reload the page (does NOT reload mods — see the caching warning)
node doc/steam/sandkit-cdp.mjs reload
```

Environment variables:

| Var           | Default | Meaning                                          |
| ------------- | ------- | ------------------------------------------------ |
| `CDP_PORT`    | `9222`  | Debug port to connect to.                        |
| `CDP_WAIT_MS` | `0`     | Poll this long for the game before giving up.    |

It picks the game page automatically by skipping `devtools://` targets, so it
works even while a DevTools window is open.

### 3.3 Catch messages that only appear at boot

Mods log during startup, long before you can attach. `Runtime.enable` does
**not** replay the buffer, so a late subscriber sees nothing.

**Start the logger first, then the game:**

```bash
# terminal 1 — attaches as soon as the port opens
CDP_WAIT_MS=120000 node doc/steam/sandkit-cdp.mjs log 120000 > /tmp/game.log 2>&1 &

# terminal 2 — launch a moment later
cd ~/Library/Application\ Support/Steam/steamapps/common/Sandustry
./Sandustry.app/Contents/MacOS/Sandustry --remote-debugging-port=9222
```

Then `grep` the capture:

```bash
grep 'md-admin-clean' /tmp/game.log
## 4. Exploring the live `sandkit.api`

### 4.1 `sandkit` is NOT on `globalThis`

The host evaluates each mod with:

```js
new Function("__sandkit", `"use strict"; const sandkit = __sandkit; return (async () => { … })();`)
```

So inside a mod, `sandkit` is a **free variable in the module scope**. From the
DevTools console you will correctly get:

```
ReferenceError: sandkit is not defined
```

There is no supported way to reach it from the page. Consequence:

| Goal                          | Do this                                     |
| ----------------------------- | ------------------------------------------- |
| Use `sandkit` in a mod        | just write `sandkit` — it is ambient         |
| Introspect from the console   | **log it from a mod** and read the console  |
| Inspect the store at runtime  | log `sandkit.state` from a mod (see 4.2)    |

### 4.2 Dump the API surface from a mod

The reliable way to enumerate what the game really exposes is to print it from
inside a mod. Add a temporary probe to `md-admin-clean/src/main.ts`:

```ts
function dumpApiSurface(): void {
    const sk = sandkit as unknown as Record<string, unknown>;
    console.log(`${LOG} PROBE top-level: ${Object.keys(sk).sort().join(", ")}`);

    const api = sk.api as Record<string, unknown>;
    for (const key of Object.keys(api).sort()) {
        const ns = api[key];
        const members = ns && typeof ns === "object" ? Object.keys(ns).sort() : [];
        console.log(`${LOG} PROBE   ${key} [${members.length}]: ${members.join(", ")}`);
    }
}
```

```bash
deno task build
# restart the app (mandatory — section 2)
CDP_WAIT_MS=120000 node doc/steam/sandkit-cdp.mjs log 120000 | grep PROBE
```

> Remember to delete the probe and rebuild before committing.

### 4.3 The actual surface (Sandustry 0.5.6)

Top level — `Object.keys(sandkit)`:

```
api, apiVersion, engine, enums, react, state
```

`sandkit.api` has **60 namespaces**:

```
action, assets, authorization, blueprints, building, camera, collector,
constants, cooldown, discoveries, effects, elements, energy, entities, events,
excavation, factory, fire, game, gameConfig, grid, hooks, i18n, input, items,
lights, maps, mods, patterns, pickups, pipes, player, processing, progression,
projectiles, random, raycast, reactions, rendering, resources, scene, schedule,
settings, shared, signals, sound, sprites, storage, structureBehaviors,
structures, tech, terrains, time, tools, triggers, ui, upgrades, utils, workers,
world
```

> **There is no `api.stage`.** Verified three ways: no hit in the repo, no hit
> in the shipped typings (`__pakages/__other/sandkit/src/sandkit/api/index.d.ts`),
> and `typeof api.stage === "undefined"` at runtime.
> You probably want **`api.scene`** (`getActive()` → `MainMenu|Intro|Deploy|Game`)
> or **`sandkit.state`**.

Handy sub-namespaces:

| Path                        | Members                                        |
| --------------------------- | ---------------------------------------------- |
| `api.ui.overlays`           | `register, unregister, update`                  |
| `api.ui.regions`            | `mount, setVisible`                             |
| `api.ui.hotbar`             | `useHotbar, getBankCount, selectAction, …`      |
| `api.ui.components`         | `ActionSlot, Button, Panel`                     |
| `api.structures.processing` | `register, isEnabledAtCell, setEnabledAtCell`   |
## 5. Testing a mod's features

### 5.1 The loop

```
edit src/*.ts → deno task check → deno task build → restart the app → read the console
```

Two terminals make it comfortable:

```bash
# terminal 1 — never stops streaming
cd doc/steam && CDP_WAIT_MS=600000 node sandkit-cdp.mjs log 600000 | grep --line-buffered 'my-mod'

# terminal 2 — the edit/build/restart cycle
cd mods-dev/my-mod && deno task check && deno task build
pkill -f 'steamapps/common/Sandustry'; sleep 8
cd ~/Library/Application\ Support/Steam/steamapps/common/Sandustry
./Sandustry.app/Contents/MacOS/Sandustry --remote-debugging-port=9222
```

`grep --line-buffered` matters — without it the pipe buffers and you see
nothing until the process ends.

### 5.2 Toggling a mod at runtime

Every mod built on `md-admin-clean` reads an `enabled` flag from
`modinfo.json#configSchema` (mirrored in `constants.ts#SETTINGS`). Flip it in
**Settings → Mods** and the mod tears itself down: `teardown()` then
`runDisableCleanup(...)`, which prunes stale buildings/items, removes orphaned
placed structures and wipes its `api.storage` keys.

This is the fastest way to test that your disable path is clean — you should
see:

```
[my-mod] cleanup (config-change): prunedBuildings=0 prunedItems=0
[my-mod] storage wiped (0 key(s), 0 present)
```

A non-zero count means something your mod created is **not** covered by the
`MOD_ID` prefix convention.

### 5.3 Driving the game from a mod

Useful entry points when writing test code:

```ts
// Spawn an element and watch what happens
const sand = sandkit.api.elements.getTypeFromId(0, "sand");
sandkit.api.elements.createAtCell(sand, 100, 60);

// Paint a terrain
const dirt = sandkit.api.terrains.getTypeFromId(0, "dirt");
sandkit.api.terrains.createAtCell(dirt, 120, 60, 40);

// Read the grid
const dims = sandkit.api.grid.getDimensions();
const type = sandkit.api.elements.getTypeAtCell(100, 60);

// UI feedback — instantly visible
sandkit.api.ui.toast("hello from my-mod", {});

// Log state you want to assert on
console.log("[my-mod] store.player:", sandkit.state.store.player);
```

### 5.4 Reading a live world

`sandkit.state` is the whole store. See
[`STATE_TREE.md`](./STATE_TREE.md) for the full tree; the practical entry
points are:

```ts
sandkit.state.store.player;     // x, y, velocity, hotbar, inventory, cooldowns
sandkit.state.store.structures; // placed structures (Array)
sandkit.state.store.meta;       // tick, seed, worldName, worldId
sandkit.state.shared.sim;       // SharedArrayBuffer views (hot per-cell data)
```

> **Do not mutate `store` to "fix" things.** It is engine-owned and gets
## 6. Troubleshooting

| Symptom                                                 | Cause / fix                                                             |
| ------------------------------------------------------- | ----------------------------------------------------------------------- |
| `bind() failed: Address already in use (48)`             | old instance still holds the port — wait for `lsof` to clear (1.3)      |
| `ReferenceError: sandkit is not defined` in the console | expected — it is module-scoped; log it from a mod (4.1)                 |
| Console shows old behaviour after a rebuild             | host caches mod sources; **restart the app** (2)                        |
| `no Sandustry page found`                                | game not running with the flag, or wrong port — set `CDP_PORT`           |
| Logger attached but saw no boot logs                     | you attached too late; start the logger **first** (3.3)                  |
| Mod not loading at all                                   | check `modinfo.json` `entry` matches the filename, and `deno task check` |
| Nothing happens when toggling `enabled`                  | `main()` is guarded by `started`; make sure `teardown()` resets it       |

---

## 7. Where things live

| Path                                             | What                                                     |
| ------------------------------------------------ | -------------------------------------------------------- |
| `doc/steam/RUN_AND_TEST.md`                       | this file                                                 |
| `doc/steam/STATE_TREE.md`                         | tree of `sandkit.state`, captured from a live game       |
| `doc/steam/sandkit-cdp.mjs`                       | CDP client used throughout                               |
| `doc/doc-tech/`                                   | engine internals, hooks vs events, threading             |
| `doc/doc-artifacts/doc.api/`                      | generated API reference                                  |
| `__pakages/__other/sandkit/src/sandkit/api/*.d.ts` | shipped typings for `sandkit.api`                       |
| `packages/modkit/`                                | `readSettings`, `runCleanup`, `runDisableCleanup`, `safe` |
| `mods-dev/md-admin-clean/`                        | the mod template used by most mods in this repo          |

Upstream docs: <https://sandustry.com/sandkit.html>

> overwritten on the next tick or save load. Use `sandkit.api.*` for writes;
> treat `state` as read-only introspection.

### 5.5 Save files

| What                | Path                                                            |
| ------------------- | --------------------------------------------------------------- |
| Saves               | `~/Library/Application Support/sandustry/saves/*.save`          |
| Last played session | `~/Library/Application Support/sandustry/meta/lastPlayedGame.json` |
| Settings (per-mod)  | `~/Library/Application Support/sandustry/meta/settings.json` → `externalModSettings` |
| Mod folders         | `~/Library/Application Support/sandustry/mods/<mod-id>/`        |
| Mod save data       | `~/Library/Application Support/sandustry/mods_save/<mod-id>/`    |

`settings.json` is a quick way to check a mod's `configSchema` keys landed:

```bash
python3 -c "import json;d=json.load(open('$HOME/Library/Application Support/sandustry/meta/settings.json'));print(json.dumps(d['externalModSettings'].get('md-admin-clean'),indent=2))"
```

---

| `api.storage.local`         | `get, set, remove`                              |
| `api.shared.buffers`        | `create, ensure, get`                           |
| `api.lights.persistent`     | `createAtWorld, fadeAtWorld, removeAtWorld`     |
| `api.world.pickups`         | `spawnAtWorld, getAll, pickUp, remove`          |
| `api.player.buildings`      | `unlockById, unlockByType, removeById`          |

### 4.4 Shipped typings vs. reality

The authoritative type surface lives in:

```
__pakages/__other/sandkit/src/sandkit/api/*.d.ts
```

`global.d.ts` documents the ambient bindings (`Sandkit`, `SandkitApi`,
`SandkitState`, `RetroConsoleApi`, …). Use these types to annotate mod code and
let `deno task check` catch mistakes — but when the typings and the game
disagree, **the game wins**; confirm with a probe (4.2).

---

```

---
