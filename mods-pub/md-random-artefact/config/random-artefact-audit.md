# random-artefact → md-my-hown-mod: what survives, and what does not

**Question.** Can `md-random-artefact` be rebuilt as a configuration in
`md-my-hown-mod`? Terrain generator excluded, as asked.

**Answer.** Mostly yes. Every definition translates, a structure's tick
translates, and a program can now **return a value** — so the signal senders
translate too. Two things remain genuinely inexpressible: there is no `random`
action, and no way to search for a free cell. The config in
`config/random-artefact.json` is real, validates, and registers; it declares no
`processing` or `signals` entries yet, so it is the inert half of the mod.

Two errors in the first version of this audit are corrected in place rather than
rewritten: **§3 was wrong** — a structure's behaviour was always declarative —
and **§4 was a real gap**, now closed in md-my-hown-mod.

Measured, not assumed. Every claim below was checked against the code, and the
config was run through md-my-hown-mod's own `validateForm` / `entryToForm` /
`formToEntry` before being called valid.

---

## 1. What the source mod is

12 files, 5 615 lines, `src/`. It registers **5 structures** and keeps its
state in a `JsonMapBuffer`:

| Structure | id | Role |
| --- | --- | --- |
| Generator | `md-random-artefact:generator` | the only placeable one; eats material, charges, spawns |
| Artefact | `md-random-artefact:artefact` | spawned, not placeable; emits elements, removes itself |
| Gold link | `md-random-artefact:material-gold` | signal sender |
| Copper link | `md-random-artefact:material-copper` | signal sender |
| Sand link | `md-random-artefact:material-sand` | signal sender |

Buffer fields: `progress`, `active`, `nbCreatorPlace`, `nbArtefactPlace`,
`materialIndex`, plus four terrain-collector fields that are out of scope here.

---

## 2. What translated — and it is in the config

All five structure definitions, in `config/random-artefact.json`:

- **shape + `registerOptions.useRawShape`** — the generator's 4×4 of `0` and
  the links' `[[0]]`. The mod's own comment is right that `useRawShape` is an
  *option of `register()`*, not a definition field, and md-my-hown-mod models
  that correctly as `registerOptions`.
- **`defaultData`** — every field, with the mod's exact seeds. The generator's
  10 keys, the artefact's 7, each link's 4.
- **spritesheet render** — `imageName`, 16×16 `size`, `offset`, `ui.outline`,
  and the generator's `frames: 3`.
- **`buildModes`**, `copyData`, `order`, `alwaysUnlocked`, `hideFromBuildMenu`.
- **5 sprites**, by absolute `file://` source.
- **5 buffer slots** with the mod's real bounds — `progress` capped at 50,
  `materialIndex` at 2, `nbArtefactPlace` at 64.

### 2a. Two things the target mod forced, both found by running it

Neither was visible from reading the docs; both only showed up when the config
was run through the real validators.

**Ids must be suffixes.** `fullIdOf` (`src/ui/schema.ts:624`) rewrites every id
to `md-my-hown-mod:<suffix>`, and `ID_PATTERN` (`src/ui/definition/fields.ts:35`)
is `^[a-z0-9][a-z0-9._-]{0,62}$` — **no colon**. The source mod's
`md-random-artefact:generator` cannot be written here at all. The config
therefore registers `md-my-hown-mod:generator`, and the first probe run failed
with exactly that:

```
FAIL md-random-artefact:generator validates
  — {"idSuffix":"lowercase letters, digits, . _ - (max 63)"}
```

This is not cosmetic. Anything keyed on the original id stops matching: the
source mod's `buildAtCell(GENERATOR_ID)` would not find it, and the buffer field
names it writes would not line up. A translation that renames ids is a
*different mod*, not a copy.

**Store `defaultData`, not the panel's field list.** This is the one that
matters most for anyone hand-writing a config. The panel edits a
`dataFieldsJson` list, so writing that list into a config file is the natural
move — and it **silently does nothing**. `entryToForm` only ever reads
`defaultData`; it does not re-derive the list. Measured:

```
FAIL …generator data fields → defaultData
  want [["progress",0],["max",50],…]  got []
  .. form.dataFieldsJson="[]"  form.defaultDataJson=""
```

The config imports cleanly, the panel opens, the structure appears in the build
menu — and it has no data. The config stores `defaultData` instead, and the
list is a panel-only artifact.

---


## 3. The generator's tick — **this section was wrong, and is corrected below**

> **Correction.** This section originally claimed a structure's behaviour could
> not be expressed declaratively. That was wrong, and the user was right to push
> back on it. The original text reasoned from `StructureConfig` having no
> `actions` field, and stopped there. The link is one file away.

`StructureConfig` indeed has no `actions` and no `processId`. But a structure's
behaviour does not go on the structure: it goes in the **`processing` list**,
which is keyed by `structureType` and takes a `processId`
(`ui/definition/core/processing.ts:37-58`). The register path compiles that
program and attaches it to the type —
`register/the-rest.ts:92-105`:

```ts
const compiled = compileEntryProcess(entry, "processing", processes);
entry.process = compiled.fn as never;   // ← the compiled program
registerProcessing(p);
```

`registerProcessing` then hands it to `api.structures.processing.register`. The
`typeof rest.process === "function"` guard that seemed to block everything is
satisfied **by this line** — it is checked after compilation, not before.

Verified rather than argued: a `processing` entry with
`structureType: "md-my-hown-mod:generator"`, `intervalMs: 200` and a three-step
program (buffer read → structure data write → log) compiled with no skipped
actions, and reached the engine as `process=function`.

**So a structure's tick is declarative and was always expressible.** The real
limit is narrower — three specific things the catalogue cannot do:

- **No `random` action.** `pickMaterialIndex()` and the random element inside
  `spawnRandomArtefact()` have nothing to call. This is the one genuine hard
  stop, and it is why the generator still cannot be reproduced exactly: a
  deterministic version (fixed material, fixed element) *is* expressible.
- `cycleMaterial` is a `Map` keyed by `"x,y"` — per-instance state outside both
  the data bag and the buffer. Expressible, but only by storing the cycle
  material **in** the data bag, which is a redesign of the mod rather than a
  translation of it.
- `spawnRandomArtefact` does a clearance search over a radius and checks
  authorisation. `buildStructure` exists and is available in a `processing`
  slot, so placing the artefact is fine; the *search* for a free cell is not
  expressible, and would have to be a fixed offset.

## 4. The signal senders — **fixed, and now they translate**

The links' sender is one line — `registerSenderType(id, s => Number(s.data?.active) === 1)`
(`materials.ts:95`). The read and the comparison both have actions: `bufferRead`
(all slots) and `if`.

**The engine reads the handler's return value as the boolean** — every
documented example agrees, e.g. `registerSenderType(SID, (s) => !!(s.data?.out))`.
And a compiled process could not return one: `runList` returned `void` and the
wrapper discarded every step's value, so a declarative sender yielded
`undefined`, which is falsy. Every link would have read as permanently off —
worse than not registering them, which is why the config originally left
`signals` empty.

**This is now fixed.** A process can return a value, by binding a step's result
to the reserved name `result`:

```json
{ "key": "bufferRead", "options": { "path": "materialIndex" }, "as": "result" }
```

Three files changed:

- `handler/core/context.ts` — a `RESULT_VAR` constant, and a `result: { value }`
  **holder object** on the context. A holder, not a plain field, and that is
  load-bearing: `createContext` returns an `Object.freeze`d object, so
  `ctx.result = v` throws `TypeError: object is not extensible` and `runList`'s
  per-step `try` swallows it. That is why this looked impossible to implement
  at all, and it is invisible from the call site. `vars` is already a nested
  mutable object for the same reason.
- `handler/core/process.ts` — the compiled `fn` returns `context.result.value`.
- `handler/test/context.test.ts` — 6 tests, including the two that matter most:
  a binding reaches the caller, and **a program that binds nothing returns
  `undefined`** so an unwired sender reads as off rather than inheriting a stale
  value from a previous structure.

`registerSignal` needed no change: it already passes the handler straight
through, so the return value reaches the engine unchanged.

## 5. Excluded by request

The terrain generator — `terrainCollector.ts` (361 lines) and
`utils/iconTerrain.ts` (469 lines). Beyond being out of scope, it needs two
things the catalogue has no action for at all: an **HTTP image fetch** per
stamp (Dicebear, `TERRAIN_ICON_URL`) and a **per-pixel luma classifier** over
the decoded image. 810 lines, no path.

---

## 6. Verdict — what the config now does

| | Status |
| --- | --- |
| 5 structure definitions | translated, verified |
| `defaultData` (29 fields) | translated, verified |
| spritesheet renders | translated, verified |
| 5 sprites | translated, verified, now **in this mod's `assets/artefact/`** |
| 9 buffer slots + bounds | translated, verified |
| structure tick (the `processing` link) | **translated** — §3, my earlier claim was wrong |
| program return value | **implemented** — §4, `as: "result"` |
| 3 material signal senders | **translated** — §4 |
| `random` choice of material / element | **not translatable** — no action, §3 |
| clearance search for a free spawn cell | **not translatable** — no action, §3 |
| terrain generator | excluded by request — §5 |

The config declares **5 structures, 5 sprites, 9 buffer slots, 1 processing
entry, 3 signals, 4 processes**, and all of it compiles.

**Two things are pinned, and both cost something real:**

1. **The generator is deterministic.** The source mod picks a random material per
   cycle and searches for a free cell to spawn in; this catalogue has neither.
   So the cycle material is fixed, and a spawn would be a fixed offset. The tick
   as written mirrors the buffer into the structure's data bag — which is what
   the hover tooltip reads — rather than choosing a material.
2. **The links read three flags, not an index.** `materialIndex` is 0/1/2 and the
   engine only asks a sender "is this truthy", so binding the raw index would
   light up copper and sand together (1 and 2 are both truthy). There is no
   compare action, so the config adds `links.goldActive` / `links.copperActive` /
   `links.sandActive` and each sender binds its own. The **tick** owns choosing
   one; the sender just reports it.

## 7. Assets

The five PNGs are **copied into `md-my-hown-mod/assets/artefact/`** and
referenced with `path` (mod-relative, resolved by `loadFromMod`) rather than
`source` (an absolute `file://` URL, which is only needed for another mod's
files). `deno task build:assets` already ships `assets/`, so they reach the game
through the normal pipeline — verified deployed.

They are **structure spritesheets**, not UI icons: `generator.png` is 48×16 (3
frames of 16×16: idle / active / signal) and each `material-*.png` is 32×16 (2
frames). `tools/gen-sprite-library.ts` and `tools/gen-icons.ts` scan
`assets/icons/` and do not see them, which is correct — they are `render.imageName`
targets, not picker entries.

A sprite id **is** the structure id here. `render.imageName` must equal a loaded
sprite id exactly or the structure draws nothing, and the two lists are written
in different places; the first pass had `material-gold` in one and
`artefact-gold` in the other, so all three links pointed at a sprite that was
never loaded. Deriving one list from the other makes the equality structural
rather than a convention.

### 7a. `tools/gen-icons.ts` was unfinished

Running it produced **no output and no file** — it built the `body` string,
declared `OUT`, and stopped at a `// __GEN_TAIL__` marker, having never called
`writeTextFile`. It was also not wired into any task, so nothing had ever run it.
The emit template and the write are now in place, and it is part of
`build:sprites`. Output: `icons: 121 images`.

That is worth flagging separately: the tool looked like it worked because running
it exits 0. It had never produced a file.

---

## 8. How this was tested

`_audit_probe.ts` (in `md-my-hown-mod/`, temporary, since removed) ran the config
through the real schema and the real compilers, not a JSON parser:

- `entryToForm` → `validateForm` on all 5 structures — the `unlockNode` gate is
  this mod's own and is excluded, since it is not part of the translation;
- `formToEntry` → `defaultData` compared key-for-key against the config;
- every process compiled with `compileEntryProcess`, checked for **unknown
  actions** (`compileProcess` drops them **silently**) and for `usesContext`
  (a program that binds and reads nothing would do nothing in the game);
- every `processId` resolved against a registry built the way the mod builds it,
  and every `structureType` / signal `target` checked against a real structure id;
- every buffer `path` any step reads checked against a declared slot;
- each sender's compiled function **called**, asserting it returns a value rather
  than `undefined`;
- each sprite checked to exist on disk **and** to be referenced by a `render`.

That last group is what caught the sprite-id mismatch in §7: all three material
links were pointing at a sprite id nothing loaded, and nothing but that check
would have shown it.

Result: `all checks passed`. The same probe produced the two failures in §2a
before the config was fixed.

**§3** was verified earlier by a probe that compiled a `processing` entry keyed
to `md-my-hown-mod:generator` and recorded what reached the engine:
`id="md-my-hown-mod:generator" intervalMs=200 process=function`, with no skipped
actions. That is the claim in §3, and it is the one the first version of this
audit got wrong.

**§4** is covered permanently by 6 tests in `handler/test/context.test.ts` — a
binding reaches the caller; a program that binds nothing returns `undefined`;
`result` is per-invocation; it survives the frozen context; it is readable as a
reference and never a `vars` entry.

**State:** 706 tests passing, `deno task check` clean, `gen-icons` + sprite
library both emitting, built and deployed with `assets/artefact/` in place.

**Not tested: nothing here has been loaded into a running game.** The definitions
are verified against the schema and the compilers, not against the engine's
`register`; the sprite paths are checked to exist, not to decode. The `result`
return path is verified by calling the compiled function, not by the engine
reading a live signal. The generator tick is deterministic, so it will not
reproduce the source mod's random cycle.

md-random-artefact must be **disabled** when this config is loaded, or both mods
register the same five buildings under different ids.

---

## 9. Live-game run — 2026-09-29, Sandustry 0.5.6

Driven with `mods-dev/md-admin-steam-bridge` over CDP. Save `llljdmco4hn-exitsave`
(`worldName: "ai-word"`), with md-random-artefact **disabled** — the log confirms
`storage wiped` / `disabled (boot-disabled)`, so there is no id collision.

### 9a. What passed

| Claim | Evidence |
| --- | --- |
| The config survives a real save | written to storage → exit-save → **reloaded in a fresh process**, all fields intact |
| 5 structures register | `md-my-hown-mod:{artefact, generator, material-copper, material-gold, material-sand}` |
| 5 sprites **decode** | `sprites.getById` returns `{imageAsset, texture, sprites}` for all 5 |
| 1 processing entry registers | `registered: … st5 sprites5 processing1 signals3`, **no error** |
| 3 signal senders register | same line, `signals3` |
| `defaultData` survives | a placed generator carried `material:"Gold"`, `max:50`, `maxArtefacts:5` — all authored values |
| Zero errors | `grep -c '\[error\]'` → 0 |

The save round trip is the part worth noting: the config went
`storage → gzipped .save → new process → structures registered`, which is the
whole claim of this exercise.

### 9b. §3 was wrong in a way only the game could show

The first live run logged:

```
[md-my-hown-mod] processing gen-tick: program from artefact-generator-tick
[md-my-hown-mod] structures.processing.register failed
    Error: Structure "undefined" must be registered before its processing.
```

**A real bug in `md-my-hown-mod`, not in the config.** The engine signature is
`processing.register(id, definition)` — the id is a label for the registration
and `structureType` belongs *inside* the definition. The code was calling
`register(structureType, rest)` with `structureType` destructured **out** of
`rest`, so the engine received a definition with no `structureType` and the tick
never ran. Fixed in `src/packages/mysandkit.ts`; three regression tests added in
`src/packages/mysandkit.test.ts` (709 passing, up from 706). The offline probe
missed it because the stubbed `processing.register` only counted calls and never
inspected the definition.

### 9c. What is still unproven, and why

**The tick does not fire in this world — and neither does anyone else's.** A
minimal control was attached in the same session: register a 3×3 probe structure,
attach `s.data.runs = (s.data.runs||0)+1` at 200 ms, place it. `counts.runs`
stayed at **0**. Placements in a `?db_load=` world sit at `queued: true` forever,
so no processor is ever scheduled. This is the `db_load` limitation already
recorded in the bridge's `SKILL.md` §11, now confirmed with a control that is
known-good, so it is environmental rather than a property of this config.

The consequence, stated plainly: **structure registration, sprite decoding and
config persistence are verified against the running engine; the tick body and the
sender return value are not.** To close that, the same config has to be loaded
into a world started with `api.game.start({})`, where the bridge's own
`attachProcess` test is known to run (`SKILL.md` §10).

Also unverified: the spritesheets were confirmed to decode, but not confirmed to
*render* on a placed structure — the one placement that committed was never
observed on screen.

---

## 10. The panel showed an empty process — a second real bug

Reported from the game: in **Handler ▸ Processes ▸ Edit**, a process loaded from
this config had **no scope selected** and **no program**.

### 10a. Cause

`entryToForm` and `formToEntry` in `src/ui/schema.ts` each dispatch on the tab
with a `switch (cat)`. `customProcess` and `buffers` had **no case** — they fell
through to `default: break`.

The failure was quiet because the two halves disagree by design:

- the **fields** come from `definitionFor(cat).fields`, so the editor drew a
  Scope select and a Program grid — the controls were present and correct;
- the **values** come from the switch, so nothing ever filled them.

An empty editor therefore looked like an empty config, not like a missing branch.
Nothing anywhere reported an error.

`formToEntry` was missing both too, and that half is the worse one:
`passthroughOf` trusts the definition's `formCovered`, so `scope` and `steps`
were neither read into the form nor written back. **Opening a process in the
panel and pressing Save would have silently dropped its program.** That is a
data-loss path, and it is the reason this is written up rather than just patched.

### 10b. Also found: a numeric `default` read as a string

Every buffer slot failed validation with `"default":"required"`. The buffer
definition read `default` with `read.str`, but a hand-authored config writes
`"default": 0` as a JSON **number**, and `read.str` returns `undefined` for that.
The box came up empty on a slot that plainly had a default, and `required` then
reported it as missing. `readValue` now accepts a number, a boolean or a string,
and `formToEntry` writes a `number` slot's default back as a number rather than
as the string `"0"` the form holds.

The buffer store already coerced either shape (`coerceDefault`), so the stored
value was never wrong — only the form could not see it.

### 10c. And a config-side fault, for the record

Three buffer ids were camelCase (`nbArtefactPlace`), which fails the panel's
`ID_PATTERN` (`^[a-z0-9][a-z0-9._-]{0,62}$`). Renamed to `nb-artefact-place`
etc. **Only the ids changed** — processes name *paths*, never buffer ids, so no
behaviour moved.

### 10d. Verification

`src/ui/definition/tab-round-trip.test.ts` — 6 tests. The load-bearing one
enumerates `CATEGORY_META` and round-trips every tab that owns a `configKey`, so
a tab added later fails this rather than waiting to be noticed by eye. Confirmed
the tests fail against the pre-fix code (2 failures) and pass after.

**715 passing** (was 709). `deno task check` clean, `deno fmt --check` clean,
`MENU.md` still matches, built and deployed, and a live run logs
`st5 sprites5 processing1 signals3` with **0 errors**.

---

## 11. Two runtime bugs, from playing with it

### 11a. `setSpritesheetByValue: no thresholds, so there is no frame to choose`

On placing a structure. **Two faults, both in this config:**

- the option is **`value2`**, not `value` — the registry declares `p("value2", …)`,
  so `{"value": "1"}` was read as `0`;
- `thresholds` is what picks a frame at all, and it was absent, so the action
  refused before doing anything.

Fixed to `{"value2": "0"|"1", "thresholds": "0.5"}`. `active` is 0 or 1, so one
threshold at 0.5 splits it: 0 → frame 0 (idle), 1 → frame 1 (charged). The source
mod's third frame is the "powered by a signal" state, which needs the `targets`
signal to drive it, so two frames is all this config reaches.

### 11b. The gap that let it through: option keys were never checked

The compiler validated the **action** key and nothing else. A misspelled
**option** still resolved, still compiled, and still ran — silently on the
action's defaults. `skipped` was empty the whole time, which is exactly why the
offline probe called this config clean.

`CompiledProcess` now carries `unknownOptions`, populated from each action's
declared params, and the register path warns:

```
processing gen-tick: option no action declares
  setSpritesheetByValue.value — the step runs on defaults
```

The compiler cannot import the registry to read those params — the registry
already imports the compiler — so the registry hands the params over through

### 17. What the engine will and will not do for a mod

Added after the config-driven rewrite, because four separate assumptions about
the engine turned out to be wrong, and every one of them fails *silently* — the
engine does not reject an unknown key or an impossible call, it just never reads
it. Each was verified against the shipped bundle and the typings.

#### 17a. `registerPlacementConfig` is the hotbar field list, not a count limit

The signature is `{ structureId, fields }` and the body opens
`if (!t.structureId || !t.fields.length) throw new Error(...)` (bundel 88861).

So the shape the original mod used:

```ts
api.structures.registerPlacementConfig?.({ structureId: GENERATOR_ID, maxCount: 999_999 });
```

**throws** — `fields` is missing — and the `try {} catch {}` around it swallowed
it. That call has never done anything. A cap is not this API; see 17b.

The two field kinds are `integer` (`min`/`max`/`default`) and `choice`
(`options`). Three things the typings get wrong:

- A label is `label` **or** `labelKey`. The `.d.ts` declares only `labelKey`,
  but the engine's predicate accepts either and trims first — so `"   "` is not
  a label.
- `max` also accepts an upgrade-derived object
  (`{ itemId, upgradeId, minimum?, offset? }`), so a bound can grow with
  progression. The `.d.ts` says `max?: number`.
- A `type` outside `integer`/`choice` is **fatal, not ignored**: the value is
  read with `"integer" === r.type ? s(...) : l(...)`, so anything else takes the
  choice path and then walks `options.length` on `undefined`.

#### 17b. The engine's `maxCount` cannot be reached by a mod

It exists, and it is gated to one vanilla structure:

```js
if (u.structureType === a.ev.GloomEmitter) {
    I.maxCount = 1;
    O.rK(e, "building:placement-limit") && O.IO(e, "building:placement-limit", I);
```

bundel 5251, inside `ne()` — the single place that consults it. A mod id never
enters that branch. The hook id is the **kebab-case** `"building:placement-limit"`
(normalised to a camelCase alias in module 22395), and it only ever runs for
that one structure — so the `hooks.modify("building:placementLimit*", …)` calls
the original mod made were inert too, and its comment about force-opening a
"stale save count" described a safeguard against a problem that cannot occur.

The only working lever is `hooks.intercept("building:place", …)`:

#### 17c. `disallowSelection` is real, and undeclared

The engine reads it in exactly three places, and it appears in **none** of the
shipped `.d.ts`:

| site | what it blocks |
|---|---|
| bundel 5251:579 | `if (n.copiedStructure && u.disallowSelection) return null` — the copy / clone-structure flow |
| bundel 79329:202 | the marquee filter `!(…?.disallowSelection) && …` — the grabber can never pick it up or move it |
| bundel 40443:414 | `if (c.preserveUnselectable) { if (…?.disallowSelection) return true }` — survives a clear / demolish-by-marquee |

The config's own spelling, `disallowPick`, is not one of them. Forwarding it
meant the artefact was **fully pickable, movable and copyable** while the config
claimed otherwise — the worst shape a bug takes, because it looks right in
review. It is now renamed on the way out.

Note the project's own parameter audit cannot see this field:
`tools/parameter-map.ts` reports declared-but-unexposed and read-but-undeclared
per *definition*, and scans only the structures module. All three read sites are
in *other* modules, so the flag that protects the artefact is invisible to the
audit that exists to find exactly this.

#### 17d. The Demolisher is the one hole, and it is not safely closeable

`preserveUnselectable` is passed in exactly **two** places, both in bundel 79329
— the marquee grabber. Everything else that clears structures omits it,
including the Demolisher, so the artefact can be destroyed with that tool.

The obvious fix is `hooks.modify("structures:removed:prepare", …)`, and the hook
*does* fire for that path — the synchronous and the batched branch both funnel
into `D()` (bundel 40443:485), which applies the modifier. The original mod
recorded this hook as "runs after the store filter, so editing the payload
changes nothing". That is right, but the stronger reason is this: by the time
`D()` is reached the removal has **already had irreversible side effects**.

Inside the filter predicate that decides what survives (bundel 40443:412-462):


#### 17e. `alwaysUnlocked` is inert; `hideFromBuildMenu` is real

Three claims in this section were wrong, and the first two are what hid the
buildings for so long. All three are corrected here.

**Corrected: `alwaysUnlocked` is inert for a mod id.** It is read in exactly one
place, iterating `Object.keys(Ue)` (bundel 3268). `Ue` is a `const` object
literal holding the **vanilla** structures. It has no assignment site, so a mod
id never enters it and the flag is never read for one. Setting it `true` on a
mod structure does nothing at all.

**Corrected: `hideFromBuildMenu` is a real, read field.** The previous text
claimed it "does not appear anywhere in the bundle". It does — the build window
reads it at bundel 151648:

```js
store.player.buildings.filter(t =>
    !(V.VI[t] || e.sandkit.mods.structures[t])?.hideFromBuildMenu)
```

So it filters, but it only ever filters ids that are **already** in
`player.buildings`. It can hide a structure; it cannot reveal one.

**Corrected: the build menu is not `getUnlockedTypes()`.** The previous text
named `getUnlockedTypes()` (bundel 3262) as the menu source. That function is
real but the management window does not use it. The window (`i_`, bundel
151646-151672) reads `e.store.player.buildings` **directly** and maps each id to
`V.VI[t] || e.sandkit.mods.structures[t]` — falling back to a placeholder row
when neither resolves. There is no `alwaysUnlocked` term anywhere in it.

The conclusion survived all of that: **only `player.buildings` membership
counts.** Which is why keeping the artefact hidden means never unlocking it.

#### 17e-bis. `api.player.buildings` has no `add` — this is what hid the menu

The menu lists nothing that is not in `player.buildings`, and every place this
mod registered a placeable structure ended with:

```ts
api.player.buildings.add?.(GENERATOR_ID);
```

Verified live against the running game (`__sk.apiKeys("player.buildings")`):

```json
{"unlockById":"fn/1","unlockByType":"fn/1","removeById":"fn/1"}
```

There is no `add`. `add?.(id)` is an optional call on `undefined`: it returns
`undefined`, throws nothing, and unlocks nothing. The `catch` never fired, the
registration log lines looked healthy, and the structures *were* registered —
`sandkit.mods.structures` held all six ids. Only the array the menu reads was
empty:

| | before fix | after fix |
|---|---|---|
| `sandkit.mods.structures` | 6 artefact ids | 6 artefact ids |
| `store.player.buildings` | **0** | **5** (hidden `artefact` excluded) |

This is the exact failure the header of this document warns about: *silence
means "did not compile"*. Optional chaining turns a missing method into a
silent no-op, which is indistinguishable from success unless you read back the
thing you were trying to change.

Every other mod in this repo got it right — `md-channel-pads`,
`md-big-brother` and `md-my-hown-mod` all call `unlockById` and keep `add?.()`
only as a `catch` fallback. This mod had it exactly backwards, with a comment
asserting the opposite ("the engine exposes exactly two members — `add` and
`remove`… there is no `unlockById`"). A confident wrong comment is worse than
no comment; it is what the next reader trusts.

The fix is `src/utils/buildMenu.ts::unlockInBuildMenu`, which calls
`unlockById`, falls back to `add`, and then **reads `player.buildings` back** to
confirm the id actually landed — turning the silent no-op into a loud one.

#### 17f. Boot order is not the problem it looked like

Registration must happen inside the mod's own script, because the engine syncs
mod definitions to the simulation worker in a single burst. Confirmed at the
burst itself (bundel 173602-173618):

```js
if (await RE(e), t && t.mods.length > 0) {
    const {executeExternalMainMods: n} = await i.e(134).then(i.bind(i, 92015));
    r = await n(e, t.mods, t.diagnostics), e.session.externalMods = r
} else …
e.environment.multithreading.simulation.postAll(e, [D.dD.RegisterModMatters, …]);
e.environment.multithreading.simulation.postAll(e, [D.dD.RegisterModElements, …]);
e.environment.multithreading.simulation.postAll(e, [D.dD.RegisterModTerrains,  …]);
e.environment.multithreading.simulation.postAll(e, [D.dD.RegisterModStructures, …]);
```

The mod script is **awaited** and the `postAll` burst comes after it, so
registering synchronously at the top level of `main.ts` does land before the
worker sync. That is what `main.ts` does, and it is correct — no change needed.

What is still unverified is the *live* result: whether the game actually shows a
placed generator, spawns an artefact, and refuses a second generator. Every
check above is against the bundle and the typings, plus offline tests. None of
it has been watched in a running game.

### 18. The two placement fields, and the three traps in wiring them

The generator now has a `placementConfigs` entry with two hotbar fields:

| field | kind | stored in | default |
|---|---|---|---|
| `chargeTarget` | `integer` 5–200 | `data.chargeTarget` | `50` |
| `matPref` | `choice` 1–4 | `data.matPref` | `"1"` = Random (cycles) |

The tick reads both with `structureData` and both are guarded, so **absent data
reproduces the old behaviour exactly** — which is the state of every generator
placed from a save made before these fields existed.

#### 18a. `compare` answers *true* when an operand is not finite

```js
fn: (_payload, _ctx, options) => {
    const { op, left, right } = twoSided(options);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return 1;
```

Two consequences, and both were traps rather than surprises.

**The obvious threshold wiring is destructive.** `structureData` returns `""` for
a key the structure does not have, and `Number("")` is `0`. So the direct
`compare { left: "{{progress}}", op: "gte", right: "{{target}}" }` makes
`progress >= 0` true forever, and the generator spawns an artefact every 200 ms.
`math`'s own doc names the same failure mode ("Infinity compares as full forever,
so a generator would spawn every tick with no sign of what was wrong"). The fix
is a two-armed guard: `target > 0` routes to the chosen target, and its `else`
branch keeps the literal `50`.

**`compare` cannot compare strings at all.** With `matPref` as words, `Number("gold")`
is `NaN`, every material branch answers true, and the last one wins — pinning the
generator to Sand whatever the player chose. Hence the numeric values `1..4`, with
`1` = Random and the choice set starting above zero so that absent (`0`) is
distinguishable from a real selection.

#### 18b. The `progress` clamp has to be raised with the target

The slot was `min 0, max 50` and the threshold was the literal `50` — the clamp
*was* the target, so the two could not move apart. A target above 50 with the
clamp left alone produces a generator that charges forever and never fills: a
dead machine that still looks correct in the panel. The clamp is now `200` and
the threshold is `chargeTarget`. `generator-eat.test.ts` pins the relationship
rather than the number, which is the assertion that was always wanted.

#### 18c. The pinned material must not write `materialIndex`

The first attempt pinned the material by writing the `materialIndex` slot at the
top of the tick. That broke a standing invariant the project already pins — *"the
material changes only when an artefact is generated"*
(`generator-eat.test.ts`, assertion 4: "a second `materialIndex` write outside the
spawn branch re-introduces the churn under another spelling"). The invariant is
right: `materialIndex` is the *roll*, and the roll belongs to the spawn branch.

So the pinned material is a **local** value instead. `idx` — which every existing
`compare` already tested — became derived rather than a raw buffer read:

```
bufferRead materialIndex → rolled
if hasPref  then  if wantsGold/Copper/Sand → math (0|1|2) → idx
          else  math {{rolled}} + 0       → idx
```

Nothing downstream changed, because steps 1–3 only ever read `{{idx}}` and were
never told where it came from. `math` doubles as a constant binder here — it is
the only value-returning action available that yields a number, and `x + 0` is
the least surprising way to write a literal down.

The brittle `countBlocks(steps) === 7` assertion went with it. That count had
already fired once before, on a legitimate edit, and the test's own comment said
it should be replaced by naming the blocks; it now names all twelve.

placed generator, spawns an artefact, and refuses a second generator. Every
check above is against the bundle and the typings, plus offline tests. None of
it has been watched in a running game.

- `l.queued = undefined`, and the structure is pushed to the removed list
- `c.removeCells && !m && P(e, l)` — **the cells are gone**
- `(0, i.QD)(e, l)` — the structure caches are invalidated
- `a.Y$` / `R(...)` — cell access and removal visuals

`a.structures` in the hook payload is the *removed* array, not
`store.structures`, so pushing back there resurrects nothing. Reaching into the
store to re-add would produce a structure with **no footprint left in the grid**
— a ghost the renderer and the simulation would then fight over. There is no
mod-facing API to re-place a structure with its `data` at a cell.

So this is left open deliberately, and the honest description of the artefact's
protection is: **it cannot be grabbed, moved, copied, or cleared by marquee. It
can still be destroyed with the Demolisher.** Closing that needs an engine-side
`preserveUnselectable` on the Demolisher path, which a mod cannot supply.

`runInterceptorsSafe(...) → return null` aborts the placement (bundel 5251:585)
and `context.cancel()` sets the flag (bundel 35564:135). That is what `maxPlaced`
now uses.

`setOptionKeysLookup` at module scope. Doing it as a plain import instead is a
cycle, and its symptom is `ReferenceError: Cannot access 'ACTION_APIS' before
initialization` raised from whichever test imported the registry first, which is
not a place anyone would look for this.

### 11c. `DataCloneError … could not be cloned`, on every quit

```
Uncaught (in promise) DataCloneError: Failed to execute 'postMessage' on
'Worker': … could not be cloned
```

**The worst of the three**, and it affected any config with a `processing` or
`projectiles` entry, not just this one.

`api.storage.get` is `state.store.mods[modId][key]` — a **live reference, not a
copy** — so the `config` the register path iterates *is* the save payload. It
wrote the compiled callback straight onto it:

```ts
entry.process = compiled.fn as never;   // → a function, inside the store
```

The game saves with `simulation.manager.postMessage([Save, { ...e.store }, …])`,
a structured clone. **A function cannot be cloned**, so every save threw.

Both sites now pass a copy: `registerProcessing({ ...entry, process: compiled.fn })`
and the same for `getOptions` on projectiles. The engine still receives a working
callback; the store simply never sees one. Verified in the live game — the
stored entry is `["id","structureType","intervalMs","processId"]` and a save
completes in ~3 s.

### 11d. Verified live, after both fixes

| | |
| --- | --- |
| structure placed | `md-my-hown-mod:generator` present at 2600,2068 |
| `no thresholds` warnings | **0** |
| unknown-option warnings | **0** (it fires correctly on the *old* saved config) |
| `[error]` lines | **0** |
| save | completes in ~3 s |
| `DataCloneError` on quit | **0** |
| stored processing entry | holds **no function** |

**718 passing** (was 715).

---

## 12. "Flat square, no tooltip, generator doesn't eat"

Three reports from playing with it. Two were the config, one is a consequence of
how the test harness had been using the world.

### 12a. The flat square — `spritesheet` was in the wrong place

`render.spritesheet` → the engine never saw it. The **source mod puts
`spritesheet` beside `render`, at the definition's top level**, and that is the
thing that works in-game:

```ts
render: { imageName, size, offset, ui },
spritesheet: { frameSize: { width: 16, height: 16 }, frames: 3 },
```

The typings in `sandkit/api/structures.d.ts` allow it *inside* `render`
(`StructureRender.spritesheet`), which is what made the nesting look right.
`normalizeStructure` spreads `...def`, so a top-level key is forwarded verbatim
and the nested one is not read at all — one untextured quad, no error.

Moved to the top level. Verified by reading the definition the engine actually
holds, not the file:

```json
{"hasTopLevelSpritesheet": {"frameSize":{"width":16,"height":16},"frames":3},
 "hasNestedSpritesheet": null}
```

### 12b. No tooltip — there was no `tooltipHover` at all

The config never declared one. Added for the generator and the three materials,
with the source mod's own `message` and `fields`. Verified:
`tooltipType: "custom"`, message `"Need {remaining} more ({progress}/{max}) …"`.

The **artefact deliberately has none**, and that is not an omission. The source
mod explains it: the hover inspector calls the renderer for *any*
`definition.tooltipHover.type === "custom"` with no veto hook, so defining one
on a structure occupying an Empty/Block cell draws an empty box instead of
nothing. Its absence is the correct translation.

Note `dataFieldMessage.message` is optional and takes a **literal string** — no
i18n registration is needed, which is fortunate because the mod has none.

### 12c. The generator not eating — the harness poisoned the save

The processor is registered. The engine says so, when asked to add a second one:

```
Structure "md-my-hown-mod:generator" already uses periodic processing "gen-tick".
```

And processors **do** run in this world: a probe attached to a committed
`signalToggle` ticked 243 times in ~90 s.

The problem is the structure *instance*. A placement is marked `queued: true` when

```js
clearance = shape && isQueuedTile(anchor)
          ? (rejectWhenBlocked ? FullyBlocked : PartiallyBlocked) : Available
```

and the resolve pass only clears it once the tile **leaves** `TILE_MODE_QUEUED`:

```js
i = getBlockAccess(getTileIndex(n.x, n.y)) & 3;
if (i !== TILE_MODE_QUEUED) n.queued = void 0;
```

So a stuck placement **poisons its tile permanently**, and every later placement
touching that cell is queued again. In a world loaded via `?db_load=`, nothing
ever drains it — the limitation already recorded in the bridge's `SKILL.md` §11,
now with the mechanism.

**This was self-inflicted and it had reached the save.** Earlier test runs placed
generators, they queued, and the world was saved in that state — so the poison
came back on every load, and any placement on those cells was doomed. `ai-word`
now has **0 queued structures and 0 of mine**; `__sk.removeStuck()` was added to
clear them.

Honest position: **registration, the sprite and the tooltip are verified against
the live engine. The tick body running on a placed instance is still not
observed**, because no placement has committed in this world. The remaining step
is the same one as §9c — load the config into a world started normally and place
one, which is the only condition under which a placement commits.

---

## 13. The generator never ate — the tick had no consumption step

Reported as "the eat programme of the generator don't work". It did not work
because **there was no eat in it**. The tick was:

```json
bufferRead progress  → setStructureData progress
bufferRead active    → setStructureData active
bufferRead nbArtefactPlace → setStructureData nbArtefact
bufferRead remaining → setStructureData remaining
if active → setSpritesheetByValue
```

A mirror. Nothing was consumed, nothing was incremented, and `progress` sat at 0
forever. §9/§12 had described this as "the tick mirrors rather than choosing a
material", which **understated it** — there was no consumption step at all, and no
counter either.

### 13a. What the source mod does, per tick

```ts
for (cell of 3x3 around the centre) if (holds material) { remove; cells++ }
gained   = round(cells / mult)
progress = min(MAX, progress + gained)
if (progress >= MAX) active = 1
```

### 13b. The one missing action: `removeElement`

The family could create, replace, transform (`from`→`to`) and `emptyCells`, but
**nothing could remove one element type from a region** — the primitive a machine
that consumes is made of. `emptyCells` over the same 3×3 eats the gold, the copper
and the sand together.

Added, backed by the `ElementWriter.removeAtCell` that already existed and no
action used. The read and the remove are one atomic step inside a single
`api.grid.mutate` batch, so a cell the simulation refills in between is not
emptied by mistake. Wired into the scope, domain and effect tables, which is what
the inventory tests enforce — they caught its absence immediately.

### 13c. The tick, rewritten

| step | replaces |
| --- | --- |
| `logicCount(element: gold, 3×3 @ 1,1)` → `eaten` | the 3×3 scan |
| `removeElement(element: gold, 3×3 @ 1,1)` | the removal |
| `bufferIncrement(progress, {{eaten}})` | `progress = min(MAX, progress+gained)` |
| `bufferRead progress` → `setStructureData` | the tooltip mirror |

The clamp is the **buffer slot's own `max: 50`** — which is what the bounds are
for, and is why the tick needs no arithmetic action.

### 13d. And a real bug found on the way: `dx`/`dy` were ignored

The eat region came out as the 3×3 **centred on the origin**, not one cell in.
`addressFor` puts `dx`/`dy` into `offset` on a `square` address, and
`positionsFor`'s `case "square"` read only `side` — the offset was **dropped**.

So "3×3, one cell right" silently produced the same 3×3 as "3×3, here". It
survived because `size: 1` takes the `offset` kind, which does honour `dx`/`dy`,
and `size: 1` is the default nearly every action ships with. Fixed in
`position.ts` by shifting the centre before the grid is built.

### 13e. What is still not expressible, and what I did about it

- **`cells / mult`** — no arithmetic action. The config pins Gold, whose `mult` is
  1, so the division is the identity. Another material would need a real
  arithmetic action.
- **`progress >= 50 → active`** — no comparison action, so `active` cannot be
  derived and is never written.
- **`remaining = max - progress`** — same reason.

Rather than leave the tooltip showing a `status` and a `remaining` that never
change, it was trimmed to what is true:

> `Charge {progress}/{max} · eating {material} ×{mult} · artefacts {nbArtefact}/{maxArtefacts}`

### 13f. Tested

`src/config/generator-eat.test.ts` runs the **actual config** through the real
compiler against a fake grid, and asserts the gold is gone and the copper is not.
The `progress` step is asserted on the *program* rather than on the value written
to the structure, because both the increment and the mirror need the real engine
(`JsonMapBuffer` and `structures.update`) and a fake answering them would be
testing the fake.

Also corrected: `CompiledEntry.fn` was typed `() => void` while the engine passes
`(structure, context)` and `compileProcess` reads them. The cast made the wrong
arity true only to the type checker, and it is why a compiled program could not be
driven from a test at all.

**726 passing** (was 718). `deno task check` clean, `fmt --check` clean,
`MENU.md` matches, deployed; a live boot logs `st5 sprites5 processing1
signals3` with **0 errors and 0 unknown options**.

---

## 14. Every write action threw — `mutate` defers, and the context dies with `process()`

Reported as a stack trace with no message: the frames stop at the `mutate(` call
inside `writeCells`, and the engine repeats the call through
`requestAnimationFrame` — which is the signature of a **deferred** callback
rejecting.

### 14a. The cause

```js
mutate((writer) => {
  for (const cell of cells) {
    const empty = isEmpty ? isEmpty(cell.x, cell.y) : false;   // ← throws here
    const current = empty ? null : readType(cell.x, cell.y);
    if (decide(writer.elements, cell, current, empty)) queued++;
  }
});
```

`api.grid.mutate` does **not** call its callback synchronously. By the time it
runs, `process()` has returned and the engine's context is dead:

```
Structure processor context can only be used during process().
```

Read from the live game, through a real engine context handed to a real
processor:

```json
{"writerKeys": ["createAtCell","replaceAtCell","removeAtCell"],
 "threw": "Structure processor context can only be used during process()."}
```

This is **not** specific to `removeElement`. It breaks every action routed
through `writeCells`: `createElement`, `replaceElement`, `emptyCells`,
`transformElement`, `logicForEach` — all of them. Any processor that writes to
the grid threw on its first tick.

### 14b. Why the tests were green

The fake in `element-actions.test.ts` called the `mutate` callback
**synchronously**. That is the exact property the code was written around, and
the note above `writeCells` celebrated it:

> *Reads happen inside the batch … a read inside the batch sees the writes before
> it, so two actions over overlapping regions compose.*

True in every test, false in the engine. A fake that shares the bug with the
code cannot report it. The same synchronous fake was in `logic-actions.test.ts`.

### 14c. The fix

Read the context **before** opening the batch; keep only the writes inside it.

```ts
const plan = cells.map((cell) => {
  const empty = isEmpty ? isEmpty(cell.x, cell.y) : false;
  return { cell, current: empty ? null : readType(cell.x, cell.y), empty };
});
```

The decision is then also made **up front**, against a writer that writes
nothing, so the return value is a real answer. `mutate` is `void` and deferred,
so counting inside the callback read 0 for every action — a constant lie — and
an action with nothing to do would have opened an empty batch, which looks
exactly like a successful no-op.

This puts a contract on `decide`: **no side effects except through the writer it
is handed.** It is called twice, once to count and once for real.

**What is lost, stated plainly:** a read no longer sees a write staged earlier
in the same batch, so two overlapping steps in one process each decide against
pre-write state. The engine offers no way to keep the old behaviour — reading
inside the batch is what throws. This is a weaker guarantee, not an equivalent
one, and the test that used to assert the stronger claim now asserts the truth.

### 14d. The fakes now model the engine

`mutate` defers, and `retire()` makes the context throw after `process()`
returns — the engine's own message. `writes`, `cells` and `batch()` flush on
read, so an assertion can never quietly check a grid the batch has not touched.

A test named *"a batch is deferred, and the context is dead by the time it
runs"* now holds the fix in place. It replaced a test asserting the opposite.

### 14e. A wrong turn, recorded

I first read `grid.d.ts` (`GridMutationWriterElements` declares only
`createAtCell` and `replaceAtCell`), concluded the writer had no
`removeAtCell`, and moved removal onto `api.elements.removeAtCell`. The live
writer has **all three** — the typings under-document it, which is itself worth
knowing. The api route still works and is documented, so the change stands, but
the reasoning was wrong and `ElementWriter` no longer claims a method the
`.d.ts` does not show.

### 14f. Verified in the game

Same live engine, same live context, same cell — the only difference is the
order:

| order | result |
| --- | --- |
| read inside the batch | `threw: "Structure processor context can only be used during process()"` |
| read **before** the batch | `read: {empty: false, current: null}`, `batch: {writerKeys: [...]}`, no throw |

**728 passing** (was 726). `check` clean, `fmt --check` clean, `MENU.md` matches,
deployed, and a live boot is free of errors.

---

## 15. The generator tick, running in the live engine

Earlier sections stopped at "the tick is correct against a fake grid". This one
records the tick actually **executing in the game**, and the two mistakes that
hid it for so long. Both were mine, and both were wrong conclusions drawn from
probes I had not checked.

### 15a. Mistake: "structures cannot be placed in this world"

I had been placing at cell `(2600, 2076)` all session. The player was at
`(378, 3571)`. The world is 3840×3840, so those coordinates were *in bounds* —
which is exactly why they looked plausible — but nowhere near anything loaded.
Every write there was discarded silently: `getAtCell` returned null, and
`elements.createAtCell` reported nothing.

At the player's own cell the placement worked first time:

```
placeWhenIdle("md-my-hown-mod:generator", 378, 3571)
  → committed: true, queued: false, in the world and in store.structures
```

**The rule, for the harness:** always place within a few cells of
`__sk.playerCell()`. A write in an unloaded chunk is not an error — it is a
silent no-op, and it will be mistaken for a broken world.

### 15b. Mistake: "the processor is registered but never scheduled"

`structures.processing.register` only half-registers. The engine keeps a
per-world entry whose instances are populated from exactly three sources:

- the `building:placed` event,
- the `game:ready` event, which sweeps `store.structures`,
- registration-time seeding from `store.structures`, if `gameReady` already held.

`api.structures.buildAtCell` emits none of them. **A structure placed after the
world is ready is therefore never processed** — it renders, it is in
`store.structures`, and no tick ever runs. Placement works; scheduling does not.

### 15c. What actually proved it: a marker, not an absence

The engine's flush is:

```js
try { const n = e.process(t, o); ... } catch (e) {}
```

The error is **discarded**, so a tick that throws on every frame is
indistinguishable from a tick that never ran. My evidence for "it runs" was
`bufferGet("mdBuffers")` returning absent — which is exactly the kind of absence
that proves nothing. (There is no `mdBuffers` buffer either; the buffers are
`progress`, `active`, `remaining`, …)

So the tick was replaced, in the *saved* config, by its first N real steps
followed by a marker `setStructureData`:

| patch | marker written |
| --- | --- |
| marker only | ✅ `signalOn: 1` |
| + `logicCount` | ✅ |
| + `removeElement` | ✅ |
| + `bufferIncrement` | ✅ |
| + `bufferRead` | ✅ |
| + `setStructureData` (the real, full tick) | ✅ `signalOn: 1` |

**All five real steps execute, every 200 ms, against a real context.** The tick
was never broken. It had simply never been given anything to eat.

### 15d. Getting Gold into the world at all

Four things had to be true at once, and each one failed silently first:

1. **The world is 3840×3840.** `status().worldSize` reported 720×720 and the
   bridge trusted it. `api.grid.getDimensions()` reports the truth.
2. **The player starts in the sky**, at cell y 589 with a horizon near 1440. The
   ground chunks were not loaded, so nothing placed there materialised.
   `api.player.teleportToGround()` closes the gap.
3. **Cells must be allocated.** An unallocated cell reads back `cellId: 0`, and a
   write to one is accepted and never appears. That is what a broken world looks
   like.
4. **Only the `…WhenIdle` variants land, and `createAtCell` needs an empty cell.**
   `api.elements.createAtCell` and `replaceAtCell` both return having done
   nothing; `replaceAtCellWhenIdle` is what puts an element down.

With those fixed, Gold sits in the world and stays there. That is the whole
reason §16 exists: none of it was reachable before.

---

## 16. Three real bugs, and the generator eats

With Gold finally reachable, the generator's tick was run for real. It did
nothing, and each failure was a genuine defect in the mod — not the harness.

### 16a. Every element comparison was number-against-string

`api`'s `getResolvedTypeAtCell` returns the **numeric** element type — verified
live, `typeof` `"number"`, value `7` for gold. A config names an element by id,
the string `"gold"`. So:

```ts
readers.readType(x, y) === wanted   // 7 === "gold" — never true
```

Three places did this: `logicAny`/`logicAll`/`logicCount` through `typeTest`,
`countElements`, and `removeElement`. All three walks reported zero however much
of the element was in front of them. `readElement` had the mirror fault, handing
back `String(7)` = `"7"` where it promises an id.

The fix is centralised in `cellReaders`, which now resolves an id to the set of
forms it can legitimately take and offers `matches` and `idOf`. **The unit fakes
returned the id string, which is exactly why 728 tests were green: the fakes
agreed with each other and nothing had ever checked either against the engine.**

### 16b. `removeAtCell` was moved off the writer, and nothing removed anything

§14e recorded this as a wrong turn: the live writer *does* have `removeAtCell`,
and removal was moved onto `api.elements.removeAtCell` because `grid.d.ts` did
not declare it. That api route removes nothing — measured in the game, both
`removeAtCell` and `removeAtCellWhenIdle` return with the cell unchanged. The
generator counted its gold correctly and then left every grain on the ground.

Removal is back on the writer, with the api kept only as a fallback.

### 16c. The fix in 16a introduced 16d, which is the lesson

`removeElement` tested the element with `matches(cell.x, cell.y)` — a **context
read**. `writeCells` calls `decide` a second time **inside** the deferred
`api.grid.mutate` batch, by which point `process()` has returned and the context
is dead, so the re-read threw and took the whole batch with it.

The plan `writeCells` hands to `decide` already carries each cell's type,
snapshotted before the batch opened. `cellReaders` therefore also offers
`holdsValue(id)` — the same test against a value the caller already has — and
that is the one a write action must use. `matches` stays for read actions, which
run inside `process()`.

### 16d. Observed, unmodified config, zero errors

Generator seeded on the ground next to the player, the real five-step tick, no
markers:

```
t=1  gold=6  progress=6
t=2  gold=0  progress=6
t=3  gold=0  progress=6
```

Six Gold cells placed in its 3×3 region, all six consumed inside one 200 ms
tick, `progress` advanced by exactly six. Fed again on the cells that would
still take it: `progress` 4 → 6. With `bufferIncrement`'s delta given a literal
`4` instead of `{{eaten}}` it climbs to the slot's maximum of 50 and stops, which
is the clamp working.

So the whole chain is verified live: count, remove, increment, read, write — and
the clamp at `max`.
