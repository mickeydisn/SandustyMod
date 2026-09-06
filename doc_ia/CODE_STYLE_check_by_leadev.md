# CODE_STYLE_check_by_leadev — Lead-Dev Code-StYLE Audit

This is a **hands-on, senior/lead-developer review** of the actual code in
the three areas — not general advice. It goes file by file, calls out what a
lead dev would keep, and flags what they'd **reject** or send back, with the
file + line and a concrete fix for each.

**Scope audited:**
- `packages/catalogue/src/strucutre/*`
- `packages/catalogue/src/list/*`
- `packages/buffer/src/**`

Read this alongside `CODE_STYLE.md` (the rules) and `CODE_STYLE_review.md`
(the merge filter). This document is the **concrete evidence** that those
docs are justified.

---

## Verdict (TL;DR)

**Approve-in-principle with mandatory fixes.** The architecture is sound,
the API shapes (types → helpers → factory → barrel) are clean, and the code
is pleasantly readable. There is **no over-engineering** in these packages —
those files follow the "simple/boring" bar already.

But a senior dev would **block** the buffer package merge on one real bug and
the naming drift, and would **request changes** on the catalogue package for
dead code, magic strings and leftover debug noise.

Rating per file:

| Area | Verdict |
|------|---------|
| `catalogue/src/strucutre/types.ts` | ✅ Keep |
| `catalogue/src/strucutre/buildCustumDraw.ts` | ✅ Keep (rename later) |
| `catalogue/src/strucutre/buildDefinitiont.ts` | ⚠️ Fix: dead code |
| `catalogue/src/list/*` | ⚠️ Fix: magic string, dead exports |
| `buffer/src/json-buffer.ts` | 🔴 Fix: real bug + PR noise |
| `buffer/src/utils/*` | ⚠️ Fix: doc/code mismatch, debug logs |

---

## 1. What a lead dev would KEEP (the good stuff)

Do not touch these — they are the house style and worth protecting:

- **Types-first.** `types.ts` holding unions + interfaces + event maps, and
  the generic listener derived from the map (`types.ts`) — clean, no bloat.
- **Factories return a small object**, methods as shorthand, closure state
  (`createBuildList`). No `class` where a closure is enough.
- **Subscribe returns an unsubscribe closure** in both `createBuildList` and
  `json-buffer` — no `dispose()` bookkeeping to forget. Copy this everywhere.
- **Defensive engine guards** (`if (!sandkit.api.storage) return;`) and
  try/catch around engine access in `persistence.ts`. Exactly right.
- **Pure exported helpers** in `paths.ts` / `codec.ts` with clear JSDoc and
  real edge-case handling (empty-array templates, `[]` segments). Good work.
- **Barrels** are just re-exports. `buffer/src/index.ts` is one clean line.

---

## 2. 🔴 Blocking — must fix before merge

### 2.1 Bug: `hasUpdate()` returns `undefined`, not a boolean
`packages/buffer/src/json-buffer.ts:92-94`

```ts
public hasUpdate = () => {
  this.remoteVersion() !== this.localVersion;   // expression … with no return
};
```

The block body **discards** the comparison, so `hasUpdate()` is always
`undefined` (falsy). Every caller treats "never has an update" as true.
(The built artifact `mods/buffer-controls/build/main.js` copies the bug.)

**Fix — drop the braces so the arrow returns the expression:**
```ts
public hasUpdate = () => this.remoteVersion() !== this.localVersion;
```

**Rule for the whole repo:** an arrow that must return a value is written
with an *expression body*. Only use `{ … }` when side-effects + no return
are intended. (Compare with `isMirrored: () => mirrored` — that one is right.)

---

## 3. 🟠 Major — request changes

### 3.1 Naming drift — misspellings are public API surface
- `catalogue/src/strucutre/` → should be `structure/`
- `buildCustumDraw.ts` → `buildCustomDraw`
- `buildDefinitiont.ts` → `buildDefinition.ts`
- `buffer/src/utils/codec copy.ts` → a **stray copy** with a space in the
  filename, double-maintenance of `codec.ts`. Delete it.

A lead dev resents these because every typo is now a permanent import path /
class name that future code must faithfully reproduce. **Do not introduce
new misspellings**. Renaming is a separate, commit-in-isolation refactor
(imports are internal, so it's low-risk).

### 3.2 `~mirrored` magic string instead of the constant
`packages/catalogue/src/list/createBuildList.ts:158,172`

```ts
mirrored: type ? type.endsWith("~mirrored") : mirrored,   // line 158
mirrored: type.endsWith("~mirrored"),                     // line 172
```

`MIRROR_SUFFIX` is defined one line 19 **in the same file** and already used
in `typeOfCatalogueItem`/`itemIdFromType`. Inline the constant:

```ts
mirrored: type ? type.endsWith(MIRROR_SUFFIX) : mirrored,
```

**Rule:** a constant that exists and is being maintained must not be re-written
as a raw literal right next to its own declaration.

### 3.3 Dead code: `_shapeFull`
`packages/catalogue/src/strucutre/buildDefinitiont.ts:26`

```ts
const _shapeFull = [[1,1,1,1],[1,1,1,1],[1,1,1,1],[1,1,1,1]];
```

Declared, never used (`_shapeEmpty` is the one that matters). Dead code is a
review reject — someone reads it and assumes it's load-bearing.

### 3.4 Doc says one thing, code does another
`packages/buffer/src/utils/codec.ts:22-23`

```ts
/** Encode `value` as JSON into `view`. Throws if it doesn't fit in maxBytes. */
export function encodeJsonInBuffer(buf, value) {
  if (bytes.length > buf.length) {
    console.error("Force config too big — buffer truncated");   // does NOT throw
  }
  buf.fill(0);
  buf.set(bytes.subarray(0, buf.length));                       // silent truncation
```

The JSDoc says **throws**; the code **logs and truncates** — which silently
corrupts data. Either throw (`throw new Error(...)`) or fix the comment and
make truncation an explicit, call-site-visible decision. Silent data loss is
worse than a crash.

---

## 4. 🟡 Minor — clean-up on the way out

- **Commented-out exports** — `list/index.ts:3-7` leaves five types commented
  out. Delete the dead comments; the barrel should be honest about what's public.
- **Public `any`** — `json-buffer.ts:24` `subscribe(fn: any)`. Type it:
  `subscribe(fn: (state: T) => void)`. (Inside `paths.ts` `any` for dynamic
  key access is OK — that's not the same smell.)
- **Leftover debug logging** — `codec.ts:13` `"=====> ReadJson Buffer"`,
  `json-buffer.ts:60,129` `"STORAGE Get/set"`, `sand.ts:22`
  `"Create a new Buffer"`. Debug prints are fine in a scratch script; they
  don't belong in a shipped package. Keep only the tagged error paths
  (`[panel-build-list]`, `"readJsonString failed"`).
- **Mixed logging API + tags** — `persistence.ts` uses `console.warn`,
  `createBuildList.ts` uses `console.error`; the same builder feature is tagged
  `[picker-overlay]` in one file and `[panel-build-list]` in another. Pick one,
  standardize tags so logs are greppable.
- **Inconsistent `sandkit` import** — some files `import "@sandmd/sandkit"`
  (`createBuildList.ts`, `json-buffer.ts`, `sand.ts`), others rely on the
  global with no side-effect import (`persistence.ts`, `buildCustumDraw.ts`).
  Import it once in every module that touches `sandkit.*` so tooling sees the type.
- **Mixed visibility in `JsonBuffer`** — `modId`/`key` are public with no
  explicit modifier while `defaultRecord`/`assertShape` are `private`. Be
  deliberate: either `public` + `private` markers everywhere or default
  ---

## 5. 🟢 Nits (would-not-block, noted for polish)

- `codec.ts:4` exports `readLength`, but it's only used by the deleted
  `codec copy.ts` — it's currently dead in the live package. Keep only if a
  consumer exists.
- `json-buffer.ts:20` `private listeners = new Set<(state: T) => void>()` is
  the only *generic-typed* listener; `subscribe(fn: any)` drops that type.
  Same fix as §4 — it's the reason the `any` survived.
- Inline getters like `getCategory: () => category` vs method shorthand
  `getSelected() { … }` mix two styles in one object. Prefer method shorthand
  for all accessors (matches `CODE_STYLE.md §4.2`).
- `idItemFromType`/`typeOfCatalogueItem` — the `cItem:` prefix literal is
  repeated; a shared `PREFIX = `${modId}:cItem:`` const would keep the
  contract in one place. Optional.

---

## 6. Senior-dev signature (what "approved" means here)

> **Verdict: Request changes → then approve.**
>
> - **Blocking (1):** fix `hasUpdate` to actually return a boolean. This is
>   the only true bug — everything else is clean-up.
> - **Must (3.x):** remove dead code, stop hand-writing `"~mirrored"` next to
>   `MIRROR_SUFFIX`, and reconcile the "throws vs truncates" contract in the
>   codec. These take minutes and remove real trapdoors for the next dev.
> - **Should (4.x):** delete debug prints, standardize log tags, type
>   `subscribe`, and be consistent about `sandkit` imports and visibility.
> - **Nits (5):** optional, batch them into a cleanup commit — don't churn
>   the diff for them.
>
> The lack of **over-engineering** is the standout positive. These packages
> are small, readable, and follow one shape. Fix the above and I'd sign off.

---

## 7. How this stays true across docs

| Doc | Role | Use it when… |
|-----|------|--------------|
| `CODE_STYLE.md` | The **rules** (format, naming, idioms) | Writing new code |
| `CODE_STYLE_review.md` | The **merge filter** (simple, minimal, not over-engineered) | Reviewing a diff |
| `CODE_STYLE_check_by_leadev.md` (this) | The **audit evidence** — concrete, line-level findings | Catch-up / refactor sprints, onboarding a lead dev, prior-works cleanup |

This document is a snapshot against the current tree. When the listed fixes
land, the checklist in `CODE_STYLE_review.md` is the reminder that keeps them
from creeping back.