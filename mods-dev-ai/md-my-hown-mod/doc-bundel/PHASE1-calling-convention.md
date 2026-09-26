# Phase 1 — Calling convention

Date: 2026-09-26
Tools: `tools/extract-public-api.ts`, `tools/extract-public-api.test.ts`
Artefacts: `PUBLIC-API.md`, `public-api.json`, `mod-api-calls.json`

## The question, answered

**Does the caller pass the engine context, or does the host bind it?**

The host binds it. Proven from the shipped composer in
`__bundel/bund/extra-mod-worker.js`:

```js
V = (e, t, r = "__anonymous") => {
    …
    const n = ((e, t, r) => {
        const o = e;                       // ← the engine context, captured once
        return L({ …, structures: R, … });
    })(e, t, r);

    const a = L({ api: l.FH, get state() { return e; } });
    return L({ apiVersion: 1, get state() { return e }, api: n, engine: a, enums: B });
};
```

`const o = e` is the engine context; every public member is an arrow that closes
over `o` and passes it down:

```js
createAtCell: (x, y, t) =>
    l.FH.world.isCellEmpty(o, x, y) && l.FH.elements.createAt(o, x, y, t)
```

That is the whole of it. `engine.api.elements.createAt(ctx, x, y, t)` has four
parameters; `api.elements.createAt(x, y, t)` has three. **The context is not a
parameter you can supply, and the mod is not missing one.**

The mod loader, same file line 706:

```js
new Function("__sandkit", `"use strict";\nconst sandkit = __sandkit;\nreturn (async () => {\n${n.source}\n})();\n//# sourceURL=${i}`)
```

`const sandkit = __sandkit` — a **free variable**, exactly as
`src/global.d.ts` says. The mod's `declare const sandkit` is the correct
pattern; its `globalThis.sandkit` fallback is dead code, because the loader
throws on an undefined `sandkit` before any of that runs.

`L` is `e => Object.freeze(e)`. There is no `Proxy`, so nothing is lazily
fabricated — but a missing namespace is `undefined`, not an empty object, so
`api.foo?.bar?.()` quietly no-ops rather than failing loudly.

## Two corrections to Phase 0

**1. `structureBehaviors` and `gameConfig` are not missing from the runtime.**
They are absent from the *bundle I have*, which turns out to be a **worker**
bundle, not the main thread. Proof: its 21 namespaces are exactly the worker
typings' 21, name for name.

```
collector constants effects elements events fire grid hooks lights main
maps patterns player random shared structures terrains ui utils worker world
```

`apiVersion` appears in `extra-mod-worker.js` and nowhere else in `__bundel`.
The **main-thread** composer for the 60-namespace public api is not in the
extracted bundle at all. The Phase 0 "drift" was an artefact of comparing
main-thread typings against a worker build.

**2. The withdrawn claim was right to withdraw, but not for the reason I gave.**
`elements.getIdFromType` — which I called a wrong name — does not exist
publicly, but `getTypeFromId` *and* `getIdByType` both do, and `catalog.ts`
already tries `getIdByType` first, falling back to `getIdFromType` through
`safe()`. The mod is defensively written on purpose.

## The two layers

The biggest source of apparent errors is that the mod has two layers sharing
one name:

| Layer | File | Signature |
|---|---|---|
| host handle | `src/api.ts` — `export const api = sandkit.api as any` | public, context-free |
| wrapper | `src/packages/mysandkit.ts` — `export const api = { … }` | its own |

The wrapper injects the mod id, so `store.ts` calling
`api.storage.set(KEY, v)` is **correct** — the wrapper's `set` adds `MOD_ID`
before calling `g()?.api?.storage?.set?.(MOD_ID, key, value)`.

I "fixed" that first, got eight type errors, and reverted it. The checker now
resolves which `api` a file means from its import.

## Public index

72 namespaces (60 top-level + 12 nested), 300 members, 75 types with 395
fields, 103 aliases. The 75 types match the 75 `export interface` declarations
in the source exactly.

The public api **nests**: `api.structures.recipes.register`,
`api.structures.processing.register`, `api.storage.local`, `api.ui.overlays`,
`api.player.inventory`, `api.signals.targets`, `api.worker.buffers`. A checker
resolving only two segments reports all of those as missing.

## Mod reconciliation

91 host call sites, 17 wrapper calls correctly excluded.

| result | count |
|---|---|
| unknown namespace | **0** |
| unknown method | **0** |
| too few arguments | **0** |
| capability-probed (`?.` guarded, absent in typings) | 14 |
| reached through a local alias | 2 |

The mod's api usage is sound. The 14 probes are deliberate build-compatibility
fallbacks (`structures.getRegisteredTypes`, `items.getAll`, `sprites.list`, …),
each wrapped in `safe()` — the author was working against api versions that
differ from the typings.

One real fix: `registerStructureBehavior` guessed `registerConveyor` and
`registerLauncher`. The documented names are `registerConveyorType(structureId,
options?)` and `registerLauncherType(definition)`. It now calls those, keeping
the old names as a guarded fallback so an older build still degrades to a
warning rather than a crash.

## Five parser bugs, all silent

Each produced plausible output rather than an error, which is why 13 tests now
pin them:

1. an **unanchored** regex captured identifiers from the wrong offset
2. **paren-less arrows** (`name: e => …`) were classed as values — 56 hidden
3. **nested namespaces** lost their parent when a child closed
4. **generic calls** (`api.storage.get<T>(k)`) were never matched at all
5. **`=>` in a return type** was counted as a closing bracket, driving depth
   to −1 so `events.on` swallowed `events.emit`

Number 4 also hid something bigger: the mod's real host calls are written
`g()?.api?.x?.y?.(…)`, and the `?.` separators were rejected — so **every host
call in the wrapper was being skipped entirely**.

## Open

- The main-thread composer is still unlocated. The worker one is a faithful
  template for it, but the main thread's 60 namespaces and the exact
  pre-binding there remain inferred from the typings, not observed.
- `structureBehaviors` is now believed to be real; it should be confirmed by
  loading the game.
- Phase 3's object graph can be built from `PUBLIC-API.md` with real field
  lists rather than from guessing at the bundle.

## Next

Phase 2 — the object graph, from the 75 typed interfaces rather than from
guessing at the bundle.

