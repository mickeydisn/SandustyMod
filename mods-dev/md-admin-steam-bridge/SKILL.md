# SKILL — Sandustry Steam Bridge

Drive a **running** Sandustry session from the terminal: load a save, read live
state, place structures, attach processors — without closing and reopening the
game.

- **Mod:** `mods-dev/md-admin-steam-bridge/` — publishes `globalThis.__sk`.
- **Tools:** `tools/` — CDP scripts that talk to the game.
- **Effect on the game: none.** It registers no content. Disable the mod and the
  global disappears.

---

## 1. Why a mod is needed at all

The host injects `sandkit` as a **parameter** of the wrapper it builds for every
mod (`external-mod-runtime.js` in the game bundle):

```js
new Function("__sandkit", `"use strict";\nconst sandkit = __sandkit;\n` +
             `return (async () => {\n${entrySource}\n})();`)
```

So `sandkit` is on neither `window` nor `globalThis`. A CDP `Runtime.evaluate`
runs in global scope and **cannot reach it** — `typeof sandkit` there is
`"undefined"`.

The bridge is a mod because only a mod has the API in scope. It hands out
closures that already hold it. That is the entire trick.

## 2. ⚠️ Never use `eval` in mod code

An earlier bridge used a direct `eval` to escape the scope. The mod then
**failed to load entirely, silently**: no `SCRIPT START`, no exception, no
console output of any kind, while every other mod loaded normally.

The entry is compiled through `new Function` under a CSP that refuses string
evaluation, and the host swallows the failure.

| Rule | Why |
| --- | --- |
| **No `eval` in a mod** | CSP-blocked; kills the whole entry with zero diagnostics |
| **`new Function` is fine** | the host itself uses it to load every mod |
| **Silence means "did not compile"** | the only symptom of a dead mod is a missing log line |

Use plain functions — they capture their scope lexically, which is all `eval`
was ever needed for here.

## 3. Build and install

```bash
cd mods-dev/md-admin-steam-bridge
deno task check
deno task build          # bundles to build/ and copies into the game's mods dir
```

`deno task build:toGame` targets
`~/Library/Application Support/sandustry/mods/md-admin-steam-bridge/`.

**The game caches mod source at startup.** A page reload re-runs the *old*
bundle — restart the app after every build, or you are debugging stale code.

## 4. Start the game with a debug port

```bash
cd mods-dev/md-admin-steam-bridge/tools

# stream the console to a file
node sandkit-cdp.mjs log 3600000 > /tmp/boot.log 2>&1 &

# launch the game
"$HOME/Library/Application Support/Steam/steamapps/common/Sandustry/Sandustry.app/Contents/MacOS/Sandustry" \
  --remote-debugging-port=9603 &
```

Wait ~30 s for the mods to load, then confirm the bridge is alive:

```bash
grep 'bridge ready' /tmp/boot.log
```

**No `bridge ready` line means the mod did not load.** Go back to §2.

## 5. Talk to the game

Every command goes through `cdp-eval.py`. It prints a JSON string — wrap the
expression in `JSON.stringify` so the result is readable.

```bash
E() { python3 tools/cdp-eval.py 9603 "$1"; }

E 'JSON.stringify(__sk.status())'
```

### Command reference

| Call | Returns |
| --- | --- |
| `__sk.status()` | scene, tick, world name, world size, player cell |
| `__sk.playerCell()` | player position in **cells** (see the warning below) |
| `__sk.worldSize()` | `{width, height}` in cells |
| `__sk.dump("session.paused")` | any dotted path under `sandkit.state` |
| `__sk.newWorld()` | `api.game.start({})` — menu only, no-op once a world is up |
| `__sk.at(x, y)` | element + structure at a cell |
| `__sk.column(x, from, count)` | rows in range that hold an element |
| `__sk.contentColumns(width, step)` | which columns hold anything |
| `__sk.register(id, shape?)` | register a structure definition |
| `__sk.place(id, x, y)` | place, and report `committed` / `queued` |
| `__sk.placeWhenIdle(id, x, y)` | same, queued for the next idle frame — see §12 |
| `__sk.attachProcess(typeId, body, intervalMs?)` | attach a processor |
| `__sk.structureTypes()` / `…Matching(filter)` | every registered structure type |
| `__sk.hasSprite(id)` / `__sk.hasSprites(ids)` | whether a graphics key really decoded |
| `__sk.storageGet(modId, key)` / `__sk.storageSet(modId, key, json)` | read/write another mod's `api.storage` |
| `__sk.bufferGet(key)` / `__sk.bufferSet(key, path, n)` | read/write a shared `JsonMapBuffer` |
| `__sk.save(saveId, name)` / `__sk.saveState()` | request an exit-save — see §12 |
| `__sk.counts` | `{runs, firstTick, lastError}` |
| `__sk.uninstall()` | delete the global |

### ⚠️ `structureTypes` returns numbers too

`getAvailableTypes()` is a `Set` whose members are **not all strings** — the
engine's own types come back as bare numbers (`11`, `12`, …). A Set also
stringifies to `{}`, so it has to be spread. `structureTypesMatching` does both;
`String(id)` first, or `id.includes(…)` throws a TypeError on a number.

### ⚠️ `api.sprites` has no `list`

The accessor for "did this texture actually load" is **`getById`**. Probing for
`sprites.list()` / `getAll()` returns nothing for *any* mod, which reads exactly
like "no sprites loaded anywhere" — a silent false negative, not an error.

### ⚠️ Player coordinates are pixels

`store.player.x/y` are **pixels**; `cellSize` is `4` in a real save. Use
`__sk.playerCell()`, never the raw values — a placement at the raw number lands
~750 cells off and silently never commits.

### ⚠️ A queued placement is not a committed one

```json
{"at":[2300,1955],"committed":false,"queued":true,"record":{"queued":true}}
```

`queued: true` means the engine accepted the placement and has not committed it.
Re-read with `__sk.at(x, y)` after a delay before concluding anything.

## 6. Load a named save

There is **no Sandkit API for saves**. `api.maps` is for maps, and
`getAvailable()` returns `[]` at the menu. Saves load via a **URL parameter**,
which is what the Continue button uses:

```bash
python3 tools/db-load.py 9603 llljdmco4hn-exitsave
```

`db_load` takes a **save id, not a display name**. Find the id:

```bash
# the save the Continue button will load
cat ~/Library/Application\ Support/sandustry/meta/lastPlayedGame.json

# or read a save's own header for its world name
strings ~/Library/Application\ Support/sandustry/saves/<id>.save | head -1
# {"id":"llljdmco4hn-exitsave",…,"worldName":"ai-word",…}
```

Verify it took — `world` should be `"ai-word"` and `scene` should be `4`:

```bash
E 'JSON.stringify(__sk.status())'
```

## 7. Find terrain before placing

A loaded save is mostly empty. Scan for the part that is not:

```bash
E 'JSON.stringify(__sk.contentColumns(3840, 100))'      # → [[2300,77],[2600,38]]
E 'JSON.stringify(__sk.column(2300, 0, 3840).slice(0,4))' # → first solid rows
```

Place just **above** the first solid row.

## 8. Full structure + process test

```bash
E 'JSON.stringify(__sk.register("probe"))'
E 'JSON.stringify(__sk.attachProcess("probe",
      "s.data.runs = (s.data.runs || 0) + 1;", 100))'
E 'JSON.stringify(__sk.place("probe", 2300, 1955))'
sleep 3
E 'JSON.stringify(__sk.counts)'
E 'JSON.stringify(__sk.at(2300, 1955))'
```

`counts.runs` climbing proves the engine is invoking the processor.
`structure.data` changing proves the callback is writing.

The engine passes `(structure, context)` to the callback, so a body written at
the terminal can act on the world **without `sandkit`**. That is why
`attachProcess` takes a body string and compiles it with `new Function`.

## 9. Other tools

| Script | Purpose |
| --- | --- |
| `cdp-focus.py <port>` | Force the page to count as focused (`Page.bringToFront` + focus emulation). Real window activation needs macOS assistive access; this does not. |
| `sandkit-cdp.mjs` | Stream the game console to stdout/file over CDP. |
| `verify-api.mjs` | Check `api` members against the `.d.ts` typings. |
| `tools/RUN_AND_TEST.md` | Longer walkthrough of the run/build/test loop. |
| `tools/STATE_TREE.md` | The shape of `sandkit.state`. |

## 10. Verified behaviour

Recorded from a live run on 2026-09-29, game 0.5.6, port 9610.

### The chain works end to end

```bash
E 'JSON.stringify(__sk.newWorld())'        # → {"ok":true}   (720×720 "Gritwaste")
E 'JSON.stringify(__sk.register("probe"))'  # → {"ok":true,"id":"probe"}
E 'JSON.stringify(__sk.attachProcess("probe",
      "s.data.runs = (s.data.runs || 0) + 1;", 100))'
                                       # → {"ok":true,"typeId":"probe","intervalMs":100}
E 'JSON.stringify(__sk.place("probe", 400, 710))'
sleep 4
E 'JSON.stringify(__sk.counts)'            # → {"runs":464,"firstTick":20281,"lastError":""}
E 'JSON.stringify(__sk.counts)'            # → {"runs":628,…}   ← still climbing
E 'JSON.stringify(__sk.at(400,710).structure.data)'  # → {"runs":157}
```

A rising `counts.runs` with an empty `lastError` proves the engine is invoking
the processor on a schedule; a rising `structure.data.runs` proves the callback
body is writing into the live structure. That is the whole loop — register,
attach, place, run, observe — with no restart.

### Placement commits only in some cells

Sweeping one column in the same world:

| y | outcome |
| --- | --- |
| 390, 500, 710, 716 | committed, `data.runs` climbing |
| 400, 600, 700 | stayed `queued: true` |

Same structure, same world, seconds apart. So a single failed placement tells you
nothing — **sweep a few cells and re-read** before drawing a conclusion. This is
the single most misleading thing about `buildAtCell`, and it is undocumented in
the typings.


## 11. Known limits

- **A `db_load` world has not been shown to settle placements.** In the
  `ai-word` save every placement stayed `queued: true` and the processor was
  never invoked, while `session.paused` was `false` and the tick advanced. The
  same code works in a world from `api.game.start({})`, and §10 shows that even
  there some cells commit and others do not — so the two are probably the same
  underlying behaviour rather than a save-specific fault. Unresolved, game-side.
- **`newWorld()` is menu-only.** A silent no-op once a world is active.
- **The bridge is debug code.** Keep it out of anything you ship; the enable
  switch removes the global entirely.

---

## 12. Persisting state written from the terminal

Two things have to be true before a `storageSet` survives: the write has to land
in `store.mods`, and the game has to save. **Neither happens on their own.**

### ⚠️ Killing the game throws the write away

`pkill` sends SIGTERM and a graceful `osascript … quit` is no better — in both
cases the renderer is gone before the save runs. The `.save` file's mtime does
not move, and the write is silently lost. Confirmed by mtime, not assumed.

### The engine's save is flag-gated

From `dist/js/bundle.js`:

```js
M = e => { if (!e.session.saving) return;
           if ("pending" !== e.session.saving.status) return; … }
```

and the requester sets

```js
e.session.saving = { name, id, type, status: "pending", onComplete, onError }
```

with `type` one of `autosave` / `quicksave` / **`exitsave`**. The path is
`state.session`, **not** `state.store.session` — `e.store` is the payload,
`e.session` sits beside it. Writing the flag into `store` leaves it at
`"pending"` forever and writes nothing.

```bash
__sk.save("llljdmco4hn-exitsave", "ai-word")   # ~3 s later the file changes
```

**Verify on the file, not on the return value.** And note the save format: a JSON
metadata line, a newline, then a **gzipped** payload.

```bash
python3 - <<'EOF'
import json, gzip
raw = open(P, "rb").read()
d = json.loads(gzip.decompress(raw[raw.find(b"\n")+1:]))
print(d["store"]["mods"]["<modId>"].keys())
EOF
```

A `grep` for a key name in the raw file finds **nothing** — the payload is
compressed. That reads exactly like "the config did not save".

### Loading a config into a mod

Mod config lives at `api.storage` key `"config"`, namespaced by mod id:

```bash
__sk.storageSet("md-my-hown-mod", "config", '<json>')   # json is a STRING
__sk.storageGet("md-my-hown-mod", "config")
```

`json` is a string because a CDP expression can only pass strings; the bridge
parses it. **Re-read after writing** — a write that reports `ok` and did not
land is exactly the failure worth catching.

### Shared buffers

`api.shared.buffers.get(key)` takes **one** argument. There is no mod id: a mod's
buffers are namespaced by its runtime, so passing a second argument silently
looks up an unrelated key and reports "absent" for a buffer that exists.

`md-my-hown-mod` allocates one buffer under the key **`mdBuffers`**, and builds it
**lazily** — the shared memory does not exist until the first `bufferRead` action
runs, so an absent buffer before the first tick is expected, not a fault.
