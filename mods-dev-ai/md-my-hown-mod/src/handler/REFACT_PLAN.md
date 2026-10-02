# handler refactor plan

Goal: make `src/handler/` follow the same rules as `src/register/`, so that reading an
action means reading exactly one file and nothing in the package contradicts anything else.

## Status

**All four phases are done.** `deno check` pass, `deno bundle` pass, lint 100 (unchanged from
before this work), and every exported table, accessor and `HANDLER_META` entry verified
value-identical to a snapshot taken before any edit.

| phase | state |
| --- | --- |
| 1 — one record per action | **done** |
| 2 — delete what phase 1 makes dead | **done** (the `var` entry never existed — §1.2; `handler/test/` never existed either) |
| 3 — geometry merge | **done** — `positions.ts` folded into `position.ts`, one importer updated |
| 4 — collapse the import surface | **done** — debug global extracted; 14 files repointed at the barrel |

| | before | after |
| --- | --- | --- |
| `core/action-class.ts` | 919 lines, 4 tables | 128 lines, probe only |
| `core/action-facts.ts` | — | 287 lines, one record per action |
| the four tables | 4 × ~150 key-value lines | 1 typed record, compile-checked |
| `core/positions.ts` | 104 lines | merged (317 in `position.ts`) |
| debug global | inline in the barrel | `core/debug-handle.ts`, 49 lines |
| deep imports from outside the package | 26 | **0** |
| package total | 41 files / 8701 lines | 42 files / 8258 lines |

Two things phases 2–4 turned up that the plan did not predict, both recorded below:
the barrel was **missing 17 symbols** that deep importers depended on (§ Phase 4), and the
`handler/test/` directory this plan proposed deleting **does not exist** (§1.4).

This document is the plan, not the work. Nothing below has been applied yet.

## 1. What is wrong today

41 files, 8701 lines. Size is not the real problem — the real problem is that **the same
94 actions are described in two unrelated files**, so nothing can tell you whether they agree.

| file | lines | what it is |
| --- | --- | --- |
| `core/handler-registry.ts` | 1667 | 1160 lines of table data, 18 functions |
| `core/action-class.ts` | 919 | 4 parallel tables, 7 functions |
| `actions/element/index.ts` | 627 | 20 actions |
| `actions/structure/index.ts` | 503 | 16 actions |
| `actions/terrain/index.ts` | 370 | 12 actions |
| `actions/motion/index.ts` | 261 | 9 actions |

### 1.1 The central defect: one action, two declarations

Measured, not estimated — by importing the modules and comparing key sets, which is the only
way to be sure (regex over the source miscounts, because entries are written both inline as
`{ key: "noop", ... }` and across several lines, and a naive pass picks up param names too):

- `handler-registry.ts` declares **94** handler keys (`DECLARED_META`, via `HANDLER_META`).
- `action-class.ts` describes **94** keys in each of `ACTION_CLASSES`, `ACTION_EFFECTS` and
  `ACTION_DOMAINS`, and **62** in `ACTION_APIS`.
- `actions/index.ts` defines **94** actions in `ALL_ACTIONS`.

All four sets are **currently equal** — the duplication was real, but the tables had not
actually drifted. That is worth stating plainly: the defect is the *absence of a guarantee*,
not a live bug. Nothing would have caught the next edit.

To add one action you edit up to five places in two directories, and TypeScript cannot catch a
mistake in any of them — all four tables are `Record<string, X>`, so a missing key is a silent
`undefined` at runtime.

`ACTION_APIS` is the worst case: it has **62 keys against 94** in the other three. The 32
api-free actions (`noop`, `math`, `compare`, `identity`, all the `energy*`, all the
`processor*`, all the `trigger*`, the buffer trio, the logging trio) are not missing by
accident, but nothing records that. A reader cannot tell "no api" from "forgotten".

### 1.2 A claim that did not survive checking

An earlier draft of this plan claimed a "stale `var` entry" at `handler-registry.ts:1358`.
**That was wrong.** Line 1358 is a *param* named `var` inside `BLOCK_META` — the `if` block's
variable binding, not a handler entry. The tables have never disagreed; the duplication was
the problem all along, and inventing a live bug to justify the fix would have been the easy
way to sell it.

The finding that replaced it is better anyway: all four key sets are provably equal today, so
what phase 1 had to deliver was a *guarantee*, not a repair.

### 1.3 The four tables should be one record per action

`action-class.ts` holds `ACTION_CLASSES` (class), `ACTION_APIS` (engine namespace),
`ACTION_EFFECTS` (effect), `ACTION_DOMAINS` (domain). Same 94 keys, four objects, kept in
sync by hand. Every `xxxOf(key)` accessor exists only to look a key up in one of them.

### 1.4 Secondary issues

- `core/position.ts` and `core/positions.ts` are one letter apart, hold different concepts
  (`Position` value vs. a `Positions` walker), and have exactly one importer each.
- `core/index.ts` re-exports ~90 symbols from 9 files, then built a `globalThis.__mdHandlers`
  debug blob inline, and 26 imports from outside the package reached past the barrel into
  `core/handler-registry.ts` (14 files) and seven other internals.
- The barrel was **missing 17 symbols** those deep importers needed. It looked complete, so
  nobody could tell which route was the intended one.
- ~~`handler/test/` contains no files.~~ — **the directory does not exist.** This line was
  written from a listing that no longer reflects the tree; there is nothing to clean up.

## 2. Target shape

Same philosophy as `register/`: **one object per file, one table per object, no
abstraction in the middle.**

```
src/handler/
  actions/                 one file per action group, each the single source of truth
    sense/  decide/  act/  remember/  buffer/
    feel/   connect/  element/  motion/  structure/  terrain/  logic/
  core/
    action-facts.ts          the per-action record: one entry, all classification facts
    action-class.ts          the dep probe (measures, so it stays a function)
    position.ts              geometry: Position/Range, plus the Positions walker
    debug-handle.ts          globalThis.__mdHandlers, dev-only
    handler-registry.ts      DECLARED_META + the panel-facing lookups
    index.ts                 the barrel — the only supported entry point
  custom-process/          unchanged
  projectile-option/       unchanged
  excavation-option/       unchanged
```

The rule that makes this work, in the spirit of `core/` in `register/`:

> An action is declared once, next to its implementation. Everything else is **derived**
> from that declaration — never a second hand-written table.

## 3. Work items

### Phase 1 — one record per action (the real fix) — **DONE**

Replaced the four tables with one record per action in `core/action-facts.ts`. What landed,
and the two places the implementation differed from the sketch below:

```ts
// core/action-facts.ts — as built
export interface ActionFacts {
    readonly cls: HandlerActionClass;   // was ACTION_CLASSES[key]
    readonly api: string;               // was ACTION_APIS[key], "" when engine-free
    readonly effect: ActionEffect;      // was ACTION_EFFECTS[key]
    readonly domain: ActionDomain;      // was ACTION_DOMAINS[key]
    readonly options?: Record<string, unknown>;  // was VALID_OPTIONS[key]
}

export const ACTION_FACTS: Record<ActionKey, ActionFacts> = { /* 94 lines, one per action */ };
```

Two corrections to the original sketch, both forced by the code:

- **It is not `core/meta/record.ts`.** A new directory for one file is not the `register/`
  shape; the record sits beside the registry it serves. The `core/meta/` idea was dropped.
- **`signature`, `role`, `params` and `slots` were left where they are.** `signature` and
  `role` already come from the action definitions and `FOLDERS`, and `params`/`slots` live in
  `DECLARED_META` with ~30 entries of real UI text each. Folding them in would have moved
  hundreds of lines of panel copy for no new guarantee — the duplication that matters is the
  *classification* facts, and those are now in one place. `DECLARED_META` stays as it is.

**The key part — where the guarantee comes from.** `keyof typeof ALL_ACTIONS` is just `string`
(`ALL_ACTIONS` is built by looping, so its keys widen), which would have given no
exhaustiveness at all. The union is instead derived from `FOLDERS`, which required dropping its
`: readonly Folder[]` annotation — that annotation widened every `defs` to `Record<string,
ActionDef>` and erased the literal keys. A `satisfies readonly Folder[]` clause keeps the same
validation without the widening:

```ts
type DefKeys<T> = T extends { defs: infer D } ? keyof D & string : never;
const FOLDERS = [ ... ] as const satisfies readonly Folder[];
export type ActionKey = DefKeys<(typeof FOLDERS)[number]>;
```

Both directions now fail to compile, each confirmed by deliberately breaking the file:

- delete a record → `TS2741 Property 'noop' is missing ... but required in type 'ActionFactsTable'`
- add a record for a key that is not an action → `TS2353 'notARealAction' does not exist in type 'ActionFactsTable'`

`VALID_OPTIONS` is now derived from the record rather than hand-listed. `measureActionDeps`
and `classFromDeps` stay functions in `action-class.ts` — they *call* actions with a spy, which
is a measurement, not a table.

### Phase 2 — delete what Phase 1 makes dead — **MOSTLY DONE**

- `ACTION_CLASSES` / `ACTION_APIS` / `ACTION_EFFECTS` / `ACTION_DOMAINS` as writable tables.
  **Done — all four deleted.** The accessors (`actionClassOf`, `effectOf`, `domainOf`,
  `apiOf`) now read the record. `action-class.ts` fell 919 → 128 lines.
- ~~The stale `key: "var"` entry~~ — **no such entry existed** (§1.2). Nothing to delete.
- ~~`handler/test/`~~ — **the directory does not exist.** This plan proposed deleting an
  empty `test/` folder on the strength of a directory listing from an earlier session; it
  is not in the tree. Nothing was removed.
- **Runtime assertion — done.** `auditFacts()` in `action-facts.ts` runs once at import and
  reports (does not throw) a record that is internally inconsistent: `cls: "api"` with no
  `api` namespace, or an `api` on a class that makes no engine call. The compile-time key
  check cannot see this, and the rule is a convention rather than a law, so a warning is
  the right severity. Verified silent on the real 94 records, and confirmed to fire by
  flipping one `cls` to `"api"` and watching it report.

### Phase 3 — geometry merge — **DONE**

`core/positions.ts` (104 lines) folded into `core/position.ts` (211 → 317). One importer
(`actions/logic/index.ts`) repointed; `positions.ts` deleted. No symbol collisions — checked
the two files' top-level names before merging.

The plan proposed moving both to a new `core/geometry/` directory. **That was dropped**: a
directory holding one file is the same mistake as the `core/meta/` idea rejected in phase 1.
`Positions` is a `Range` with methods on it, so one file states that relationship instead of
hiding it behind a one-letter filename difference.

### Phase 4 — collapse the import surface — **DONE**

- The `globalThis.__mdHandlers` blob moved to `core/debug-handle.ts` (49 lines), imported by
  the barrel for its side effect only. Verified the global still carries all **19** fields
  with the same contents. Removing the dev handle is now a one-file delete.
- **14 files repointed** at `handler/index.ts`. Deep imports from outside the package: 26 → **0**.
- The barrel was **missing 17 symbols** that deep importers had been reaching past it for —
  `HANDLER_SLOT_LABELS`, `HANDLER_TYPE_LABELS`, `TAB_TO_CALL_SITE`, `canBind`, `createContext`,
  `refsIn`, `scopeSeedNames`, `isBlock`, `BLOCK_KEY`, and eight more. This is the concrete
  cost of the deep-import pattern: the barrel looked complete but was not, so nobody could
  tell whether a given symbol *should* be there. All 17 are now exported, so the barrel is
  the real surface and a missing export is a compile error instead of a silent deep import.
- `custom-process/`, `projectile-option/`, `excavation-option/` were left alone, as planned.

Two process notes for whoever does the next one of these. My first repoint pass dropped the
`../` prefix and produced 12 files importing a bare `"handler/index.ts"`; `deno check` caught
it immediately and `git checkout` restored them. The rewrite was redone with a regex that
captures the relative depth. Second, moving the debug block out left its now-unused imports
orphaned in the barrel — a leftover this codebase already had 300+ of (the `squelched 321
whitespace errors` warning during lint), which is why lint is a real signal here and not just
a formality.

## 4. Ordering and safety

Phases 1–3 are independent of each other and of the `register/` refactor, but they must land
in order: 2 depends on 1, 3 and 4 are independent.

The registry is the widest contract in the codebase — 14 files outside the package imported
it directly, and the panel builds its whole handler UI from it. The sequence used:

1. Land the new derived record **alongside** the old tables.
2. Re-point one consumer at a time; run `deno check` after each.
3. Delete the old table only once nothing references it.

Verification per phase, matching what was used for `register/`:

```
deno check src/main.ts
deno bundle -o /tmp/main.js src/main.ts
deno lint src
```

Plus a temporary harness asserting:

- the derived record has **94** entries, the same key set as `DECLARED_META` has today;
- every key resolves `cls`, `effect`, and `domain` to a defined value (no `undefined`);
- `api` is `""` for exactly the 32 engine-free actions, and non-empty for the other 62 —
  this is the assertion that guards against drift in either direction;
- every `slots` value is one of the declared `HandlerSlot`s.

**This harness was built and run; it is what the work was accepted on.** It snapshotted all 15
exported tables, every per-key accessor, and all 94 `HANDLER_META` entries *before* any edit,
then re-derived the same shape after and diffed order-insensitively. All 15 sections matched,
and they still match after phases 2–4. A first pass reported 6 differences that were purely
table key *ordering* — which is why the comparison is order-insensitive: ordering in a lookup
table is not behaviour.

## 5. What is deliberately not changing

- The `actions/*/index.ts` group split. The 12 groups match the editor's categories, which
  is the domain; inventing a new grouping would be churn.
- `DECLARED_META` and the `runtime/` internals (`process.ts`, `scope.ts`, `apply.ts`,
  `context.ts`, `refs.ts`). Already one-concern-per-file.
- The `__mdHandlers` blob's contents — only its location.
- `custom-process/`, `projectile-option/`, `excavation-option/` — 350 / 208 / 245 lines,
  single-purpose, already one file per concern.
- Any engine-facing behaviour. Every change here is about where a fact is written, never
  what it says.

## 6. Risk

Low, and mostly mechanical. The genuine hazards:

- **Silent behaviour change if a fact is dropped.** Mitigated by asserting the record has
  the same 94 keys and the same values per key as the tables did before, before deleting
  anything.
- **`unreachableHandlers` / `scanHandlerUsage` depend on the meta tables.** These are
  panel-facing; a dropped key makes an action look unused. Covered by the same assertion.
- **Wide import surface — this one was real.** 14 files imported `handler-registry.ts`
  directly, and the barrel was missing 17 symbols they relied on, so "add it to the barrel"
  and "import around the barrel" were both normal here. The barrel is now complete, so a
  symbol that should be exported and is not is a compile error rather than an invitation to
  reach past it again.

