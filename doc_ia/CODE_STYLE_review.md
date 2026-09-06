# CODE_STYLE_review — Simplicity & Clean-Code Review

This is the **review side** of `doc_ia/CODE_STYLE.md`. The style doc says
*how code is formatted and shaped*; this doc is the filter that decides
*what is worth merging*. It is deliberately opinionated and short:

> **Good code here is clean, simple, and boring.** Not clever. Not extensible
> "just in case". Not a framework. If a change makes the codebase easier to
> read and harder to break, it ships. Otherwise it doesn't.

Use this as a pre-merge checklist on every diff.

---

## 0. The three questions that decide everything

Before discussing a single line, a reviewer asks:

1. **Can a new person understand this in 30 seconds?**
2. **Does it do the minimum needed for the task — nothing more?**
3. **If we deleted it tomorrow, would anyone miss it?**

If the answer to any is "no", stop and simplify before nitpicking style.

---

## 1. Is it simpler? (the priority rule)

Optimize for **lines removed**, not lines added.

- Prefer the smallest change that satisfies the requirement.
- Every new file, interface, option, or abstraction must earn its keep:
  it stays **only if** it removes complexity elsewhere.

**Ask:**
- Is there a *different* requirement this abstraction is anticipating? If it
  isn't used by the current task, cut it. Don't "prepare for the future".
- Am I adding a **2nd way to do a thing** that already exists? Two ways to do
  the same thing is a bug farm. Reuse the existing helper instead.
- Would a **plain function** do instead of a class/factory/interface chain?

**Over-engineering smells to reject:**
- Generic code with zero current callers (`Options<T>` with no `T` users).
- A `Base*`/interface for something with exactly **one** implementation.
- Config/flag parameters that nothing passes a non-default value to.
- "Framework-izing" three lines of logic into a registry/dispatcher.
- Deep inheritance/super-classes to avoid one `if` statement.

---

## 2. Is it readable top-to-bottom?

- **The happy path reads like a sentence.** Guards first, then the work,
  then the return. No nested spaghetti:
  ```ts
  // good
  if (!ctx) return false;
  if (!item.spriteId) return false;
  doTheWork();
  return true;

  // bad
  if (ctx) { if (item.spriteId) { doTheWork(); return true; } }
  return false;
  ```
- **Short.** A function should fit on one screen. If it doesn't, it's
  probably doing more than one job — split it into named helpers.
- **Names say what, not how.** `setSelected` or `itemIdFromType` are good.
  `handleEventX` or `process` are not.
---

## 3. Is it in charge of only one thing?

One file, one job. Follow the existing split:

| Concern | Where it lives |
|---------|----------------|
| Types / interfaces | `types.ts` |
| Pure helpers + factory | `<name>.ts` |
| Persistence (storage get/set) | `persistence.ts` |
| Public surface | `index.ts` (barrel only) |

- **No UI/logic in `types.ts`.** Types are declarations, not behavior.
- **No business rules in `index.ts`.** Barrels re-export, they don't compute.
- An imported symbol must be **used** — unused imports/helpers are cut on review.

---

## 4. Is it honest about its cost? (fail fast, don't fake it)

- **Guard engine access explicitly.** Never assume `sandkit.api.*` exists:
  ```ts
  if (!sandkit.api.storage) return;
  ```
- **Wrap engine reads/writes in `try/catch`** and log with a bracket tag,
  exactly like `persistence.ts` — don't let a storage hiccup kill a placement.
- **Return `null` (not a bare `undefined`, not `false`) when a value is
  genuinely not found.** Keep the contract visible in the signature:
  ```ts
  function itemIdFromType(modId: string, type: string): string | null
  ```
- **Don't silently swallow.** If you catch, log why; a bare `catch {}` hides bugs.

---

## 5. Is it free of cleverness?

Overturned rules — these are **rejected on review** even if they work:

- **Variable count minimisation games** (`x`, `t`, `tmp` jumping through types).
- **One-liners that need a comment to explain.** If it needs a comment to be
  understood, write the clear 3-line version instead.
- **Micro-optimisations** before profiling. `.slice()` on a tiny array,
  `Array.from({length})` grids — fine. Reusing buffers for readability's sake
  — fine. Hand-rolled parsing when a clear loop reads better — not worth it.
- **Over-inlining** — do not collapse six things into one expression to save
  a line; that trades columns for comprehension.
---

## 6. Is naming honest & consistent?

Match `CODE_STYLE.md §7` exactly — no new personal style:

- `camelCase` files/functions/vars — `createBuildList.ts`, `buildCustumDraw`.
- `UPPER_SNAKE_CASE` module constants — `MIRROR_SUFFIX`, `DEFAULT_MAX_BYTES`.
- `PascalCase` interfaces/types — `CatalogueItem`, `BuildListOptions`.
- Booleans read as questions: `isMirrored`, `hasUpdate` (seen in `buffer`).
- Constant used **twice or more** → hoist it to a named const. Used once → keep inline.

---

## 7. Does it keep the barrier low?

Simple code is easy to test and easy to delete.

- **Prefer pure, exported functions** (easy to reason about, no environment)
  over methods that reach into globals. Push side-effects (storage, engine)
  to thin wrappers like `persistence.ts` does.
- **Factory + returned object** (the project's established shape) over `new`
  + mutable public fields. Callers get a small, explicit surface.
- **Subscribe returns an unsubscribe closure** — no `dispose()` to forget.
- If a function has **no pure core** and can't be reasoned about in isolation,
  that's a warning it's too tangled — refactor it into a pure part + a thin glue part.

---

## 8. Review checklist (paste-friendly)

Run this on every change. All boxes should be "yes".

- [ ] Does it solve the task with the **minimum** change? (no speculative futures)
- [ ] No new abstraction with **zero current callers**?
- [ ] No `Base*`/interface/registry for a **single** implementation?
- [ ] Reads top-to-bottom as a sentence (guards → work → return)?
- [ ] Fits on one screen; each function does **one** job?
- [ ] No unused imports / unused helpers?
- [ ] `sandkit.api.*` guarded + engine calls in `try/catch` with tagged logs?
- [ ] Uses `null` for "not found"; no bare `undefined` aliases in signatures?
- [ ] No clever one-liners that need comments to be understood?
- [ ] No `any` on public APIs (prefer `unknown` + narrowing)?
- [ ] Naming matches the style tables + reads like a boolean (is/has)?
- [ ] Reuses existing helpers instead of adding a parallel way to do the same?
- [ ] `deno fmt` clean (4-space) and `deno lint` green?

---

## 9. "Ship it / work on it" quick test

- **SHIP** — you can read it in one pass, it changes one thing, a new dev gets it.
- **WORK ON IT** — you had to squint at a name, a 15-line idea melted into a 4-line
  mess, or you found a `// TODO` placeholder for "in the future we'll need…".
- **REJECT** — you can't say in one sentence what it does, or it's solving a
  problem this task doesn't have.

---

## 10. The last filter

When in doubt, ask the author one question:

> **"What does this buy us today, and what would break if we cut it?"**

If the answer is "nothing today" or "nothing would break", cut it.

Simple code here doesn't mean less capable — it means **easier to read,
easier to fix, easier to delete**. That's the bar for review.