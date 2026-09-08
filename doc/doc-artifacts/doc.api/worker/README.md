# Worker entry APIs

`manifest.workerEntry` (e.g. `worker.js`) receives `sandkit` with a **worker-safe** facade.

Official reference: [https://sandustry.com/sandkit.html](https://sandustry.com/sandkit.html) → **Worker entry**.

## Rules

- Grid mutations (`elements`, `terrains`, …) are **immediate** on the worker.
- Prefer this entry for simulation logic (reactions, per-tick process, element moves).
- No Pixi / React (`sandkit.react` is main-only).
- Many main-only namespaces are absent here.

## Also available (documented under `shared/`)

`elements`, `terrains`, `structures`, `world`/`grid`, `fire`, `effects`, `events`, `hooks`, `collector`, `player`, `maps`, `patterns`, `random`, `utils`, `constants`, …

Worker method names often use official `*AtCell` / `*AtWorld` suffixes.

## Worker-oriented stubs in this folder

| Doc | API |
|---|---|
| [api.worker.md](api.worker.md) | Worker transport helpers |
| [api.main.md](api.main.md) | Worker → main bridge |
| [api.shared.buffers.md](api.shared.buffers.md) | SAB helpers (also on main) |
