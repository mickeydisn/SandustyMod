# PLAN — config is the only source of truth; the UI never applies it

## The rule this plan enforces

> The panel **reads and writes the config. Nothing else.**
> The config is read **once**, when the mod script runs.
> Everything in `src/register/` runs **only** from that one read, at boot.

That is the whole design. Everything below is either removing the machinery that
existed only to contradict this rule, or cleaning up what it leaves behind.

## Why (the evidence, so this is not a matter of taste)

1. **The engine syncs once.** `bundel.js:173616-173619` posts `RegisterModMatters`,
   `RegisterModElements`, `RegisterModTerrains`, `RegisterModStructures` to the
   simulation worker in a *single burst*, right after the mod script returns. Every
   `register` call only writes the main thread's copy — none of them post.
2. **The worker's `updateDefinition` is a guarded merge** —
   `const l = m5[type]; l && Object.assign(l, patch)`. It cannot create a type the
   worker was never given.
3. **Re-registering does not update, it forks.** A type is
   `max(builtIn, modMax) + 1`, so a second `register` of a live id mints a *new*
   type and orphans the old one. That was the crash.
4. So Apply could never mean what its button said. It was a config write plus a
   best-effort push that was *silently* incomplete for 4 of ~24 categories and
   impossible for the rest.

**Today the Apply button is the only thing keeping the running game and the config
in sync at all — and it cannot do it.** Removing it makes the behaviour honest
rather than merely tidier.

---

## Phase 1 — cut the UI's write path to the engine

- [x] **1.1** Remove the Apply button and `applyNow` from `src/ui/panel.ts`.
- [x] **1.2** Remove `applyConfig(loadConfig())` from the entry-save path
  (`panel.ts:574`) and from the remove path (`panel.ts:603`).
- [x] **1.3** Remove the `updateEntry` / `registersLive` / `live` branching from
  the save handler; the toast becomes unconditional: *saved, takes effect on
  reload*.
- [x] **1.4** Remove `reapplyFromStorage()` from the JSON import path
  (`panel.ts:1279`); relabel **"Import & apply"** → **"Import"**.
- [x] **1.5** Delete the `applyNow` comment block (`panel.ts:1396-1419`) — it
  documents a function that no longer exists.
- [x] **1.6** Remove the now-unused imports of `applyConfig`, `updateEntry`,
  `registersLive`, `reapplyFromStorage`, `snapshotRegistered`, `staleAfter`
  (`panel.ts:66-72`).
- [x] **1.7** Verify **no** `src/ui/**` file imports from `src/register/**`.
      This is the boundary. It must hold.

## Phase 2 — delete the machinery that existed only to support Apply

- [x] **2.1** Delete `updateEntry` + the `UPDATABLE` map from `src/register/apply.ts`.
- [x] **2.2** Delete `reapplyFromStorage`.
- [x] **2.3** Delete `staleAfter` and `clearRegistrationCache`.
      (Clear exists only to force re-registration — the thing that crashes.)
- [x] **2.4** Delete `snapshotRegistered` from `registry.ts`.
- [x] **2.5** Keep `pendingChanges` only if the panel still shows a reload banner;
      otherwise delete it and the banner with it.
- [x] **2.6** Delete `__resetBootWindowForTests` **or** keep it and make sure the
      tests that use it still have a reason to.
- [x] **2.7** Update `src/register/apply.test.ts` — most of it tests deleted
      behaviour. Keep only what still describes reality.

## Phase 3 — make "read once at boot" structural, not a convention

- [x] **3.1** Freeze the config at boot: `src/register/index.ts` exports one
      `registerAll()`, which is the *only* caller of every `register*` function.
- [x] **3.2** `main.ts` calls `registerAll()` and nothing else. It must not
      import `applyConfig` at all.
- [x] **3.3** The dynamic `import("./register/apply.ts")` in `startEnabled` goes
      away — it existed to defer registration past boot, which is the bug.
- [x] **3.4** Close the boot window *inside* `registerAll` rather than by
      `main.ts`, so no caller can forget it. Prefer this.

## Phase 4 — comment diet (this is the "clean code" ask)

Current: 34,757 lines, comment-heavy in exactly the places that were hard-won.
The rule: **a comment explains *why*, never *what*.** Restate the code, or delete it.

- [x] **4.1** `src/register/*.ts` — collapse the multi-paragraph essays. Keep the
      engine citations (`bundel.js:173616-173619`, the guarded merge, the type
      formula) in **one** place, `registry.ts`, and let the category modules link
      to it instead of re-arguing it four times.
- [x] **4.2** `src/ui/panel.ts` — remove comments that narrate a removed feature
      (every "Apply" note) and any that restate the line below them.
- [x] **4.3** Delete comments describing a bug that can no longer happen. Once the
      UI cannot re-register, three paragraphs about the crash it caused are history,
      not documentation. Keep **one** sentence at the guard that prevents it.
- [x] **4.4** `src/catalog.ts`, `src/constants.ts`, `src/ui/definition/types.ts`
      (64% comments) — trim narration, keep the verified engine facts.
- [x] **4.5** `engine-api.generated.d.ts` is generated by `tools/gen-reference.ts` ("do not edit"). Not hand-edited. 348 comment lines are out of scope by design.
      so, regenerate and stop hand-editing it.

## Phase 5 — structure and verification

- [x] **5.1** All registration lives in `src/register/`. Move any stray
      `api.*.register` call found elsewhere — excluding `src/tool.ts`, which
      registers the *tool* itself rather than mod content. Verify and document why
      it stays.
- [x] **5.2** `deno check src/main.ts` clean.
- [x] **5.3** `deno test -A src/` green, and the count is **lower** than 396 —
      if it is not, dead code is still being tested.
- [x] **5.4** Fix the pre-existing type error in
      `src/ui/test/action-list-control.test.ts` (`cfg: {}` vs `ModConfig`) so
      fully-checked `deno test` runs.
- [x] **5.5** Rebuild and deploy.
- [ ] **5.6** Manual: restart the game, confirm the boot log registers all
      worker-scoped categories, then confirm edit + reload is the *only* path to a
      change — which is the intended behaviour, not a regression.

---

## Explicitly out of scope

- Editing the config mid-session and expecting the running world to change. That is
  the point of the change, not an oversight.
- Anything in `__bundel/` (the engine) or in other mods.

## Risk to name up front

**A user who edits mid-session and watches nothing change may file this as a
regression.** The mitigation is honest UI copy, not a hidden apply:

> Saved. Reload the game to apply.

shown on every save. If the banner still exists (2.5), keep it persistent. The
alternative — a button that lies — is what is being removed.

- [x] **3.5** Add a test: after boot, **no** `register*` call can be made from
      anywhere. Assert via the boot window being closed by construction.
