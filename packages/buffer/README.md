# @sandmd/buffer

Versioned JSON state shared through a memory buffer. `JsonBuffer<T>` stores a
plain TypeScript record inside a shared `Uint8Array`, so the main thread and
worker threads can read the same state, and any write bumps a stored version so
other readers can tell — and pull — when it changed.

It is the recommended "config store" for mods: button values, toggles,
counters, and any cross-thread state the control structures (`@sandmd/controls`)
act on. A long-term copy is persisted to the game's local storage on save.

## Install / import

```ts
import { JsonBuffer } from "@sandmd/buffer";
```

## Quick start

```ts
interface GameConfig { volume: number; muted: boolean }

const cfg = new JsonBuffer<GameConfig>(
  "my-mod",
  "gameConfig",
  { volume: 1, muted: false },
);

cfg.setPath("volume", 0.5);
cfg.commit(); // writes JSON into the shared buffer + bumps the version

cfg.subscribe((state) => console.log("updated", state));
console.log(cfg.getPath("volume")); // 0.5
```

## API

### Constructor

`new JsonBuffer<T>(modId, key, defaultRecord?, assertShape?)`

| arg | meaning |
|---|---|
| `modId` | your mod id, used only for logging |
| `key` | unique key for the shared buffers + long-term storage |
| `defaultRecord?` | seed value used if nothing is stored yet |
| `assertShape?` | `(value: T) => void` guard run on every `commit()`; throw to reject a bad state |

### Reading

- `get()` — pull latest remote changes, then return the cached record
- `getPath(path)` — read one dot/bracket path, e.g. `"players[0].score"`
- `listPaths(maxDepth = 8, includeContainers = true)` — walk every field with
  its path, inferred kind (`bool`/`number`/`string`/`array`/`object`), label and
  current value. Arrays are summarized as a stable `"players[]"` template.
- `remoteVersion()` / `version()` — remote vs. locally-seen buffer versions
- `hasUpdate()` — whether a newer version exists remotely

### Writing

- `setPath(path, value)` — set a value, creating intermediate objects/arrays
- `addToPath(path, value?)` — append to the array at `path` (creates the array,
  or clones the shape of an existing element when no value is given)
- `replace(next)` — swap in a whole new record
- `commit()` — validate (`assertShape`), encode to the buffer, bump the version,
  notify subscribers

### Sync

- `pull()` — adopt remote changes if the version differs (returns `T | null`)
- `subscribe(fn)` — called after each `commit()`/`pull()`; returns an unsubscribe fn

## How it's working ?

`JsonBuffer<T>` is a small **versioned JSON mailbox** riding on top of the game's
shared-memory buffer registry (`sandkit.api.shared.buffers`). The trick is to
separate *"what version is there"* from *"what data is there"* into two buffers.

### Two shared buffers per key

Every `JsonBuffer` allocates two fixed-size shared buffers on first use
(`ensureBuffer`, in `sand.ts`):

| buffer key | typed array | purpose |
|---|---|---|
| `${key}:ver` | `Int32Array` of length 1 | a monotonic **version counter** |
| `${key}:json` | `Uint8Array` of 64 KiB | the **payload**, JSON-encoded |

Both are registered with `sandkit.api.shared.buffers`, so **any `JsonBuffer`
created with the same `key` — on the main thread *or* in a worker — sees the
same two memory regions.** That is the whole trick: no message passing, no IPC,
just different JavaScript objects pointing at the same bytes.

### The local cache + version gate

Each instance keeps a plain JS object as its working copy:

```
this.cache        // the record you call setPath()/getPath() on
this.localVersion // the version this instance last read
```

It can also read the remote counter at any time:

```
remoteVersion()   // this.versionView[0] -> what is "published" in the buffer
localVersion      // what this instance last saw
```

The key invariant: **the payload is only re-decoded when the version counter
changed.** Checking a single `Int32` is nearly free; decoding JSON is not. This
is what makes cheap cross-thread sync possible.

### Lifecycle walkthrough

1. **Construction** allocates/attaches the two buffers and reads
   `remoteVersion()`.
2. **If a version already exists** (`remoteVersion() > 0`): someone before us
   committed, so we decode the payload from `${key}:json` and set
   `localVersion` to match. We are now in sync.
3. **If nothing was committed yet** (`remoteVersion() === 0`): this is a brand
   new (or multi-instance "writer") buffer. We fall back to:
   - the **long-term copy** in `sandkit.api.storage.local`, if any, else
   - the **`defaultRecord`** passed to the constructor, else
   - an empty `{}`.
   We set `localVersion = -1` (so we know we hold a *pending un-published*
   state) and immediately `commit()` it to seed the buffer.

### commit() — publish

`commit()` is the only way a local mutation becomes visible to everyone:

```
commit():
  assertShape(cache)            # optional validation; throw to reject
  encodeJsonInBuffer(dataView)  # JSON.stringify -> UTF-8 bytes into :json
  localVersion = remoteVersion() + 1   # bump the shared counter
  notify()                      # fire local subscribers
```

Because the bump happens on the *shared* counter, the new version is instantly
visible to every other instance sharing the key.

### pull() / get() — read

`pull()` compares the shared counter to `localVersion`:

```
pull():
  remote = remoteVersion()
  if remote === localVersion: return null   # nothing new
  cache = decodeJson(dataView)              # re-decode once
  localVersion = remote
  notify()
  return cache
```

Every read helper (`get`, `getPath`, `listPaths`) calls `pull()` first, so a
read is *always* fresh without you having to remember to sync manually — and it
short-circuits when nothing changed.

### Codec layout (`utils/codec.ts`)

`${key}:json` is a simple UTF-8 blob (zero-filled slot):

```
[ utf-8 JSON bytes ... ][ 0 0 0 ... (empty tail) ]
```

- `encodeJsonInBuffer` fills the buffer with zeros, writes `JSON.stringify`
  output, and warns (does not throw) if the record exceeds the 64 KiB slot —
  **keep records reasonable** and design your schema accordingly.
- `decodeJson` slices at the first zero byte (a sentinel for "rest is empty")
  and `JSON.parse`s it.

### Persistence

The shared buffer is **short-lived memory**. On `store:save` the instance calls
`commit()` again + `save()`, copying its cache into
`sandkit.api.storage.local`. On next launch the constructor's *no-version-yet*
branch re-reads that stored copy and re-seeds the buffer. So:

```
shared buffer (fast, cross-thread)  <-- live state
local storage (durable)             <-- saved each "store:save"
```

### Mental model recap

```
Storage (durable)                 Shared memory (live)
    │                                  ▲
    │ save() on store:save             │ ensureBuffer on {key}:ver / {key}:json
    ▼                                  │
 cache  ── commit() ──────────────►  {key}:ver  (version counter)
    ▲                                 │
    └── pull()/get() ◄─────────────  {key}:json (UTF-8 JSON)
```

## Example

See [`exemple/main.ts`](./exemple/main.ts) for five worked entry points:
lifecycle, dot/bracket paths + introspection, subscriptions, `assertShape`
validation, and two buffers staying in sync over one shared key.

## What can be planned next ?

A loose, non-blocking roadmap of improvements this design naturally suggests —
keep [How it's working](#how-its-working-) as-is for now, and grow toward the
items below when a real mod actually needs them.

- **Path-scoped subscriptions** — today `subscribe(fn)` fires on *any* change.
  A useful next step: `subscribePath("players[].name", fn)` so listeners only
  wake for the keys they care about.

- **Binary (schema) encoding** — swap `JSON.stringify` for a compact
  columnar/typed codec bound to the record's shape. Dramatically smaller
  payloads and faster decode for hot numeric fields; current codec is the
  simplest thing that works.

- **Growable / chunked buffering** — the fixed 64 KiB slot truncates oversized
  records. Options: segmented buffers (a header + N chunks) or spilling large
  blobs to storage and keeping only a pointer in the shared buffer.

- **Version fencing & conflict policy** — `localVersion = remoteVersion() + 1`
  is a blind last-writer-wins bump. Next step: compare-and-swap semantics so two
  writers can detect a conflicting commit and merge or retry instead of silently
  overwriting.

- **Transactions / batched commits** — a `begin()/commit()` scope that runs
  several `setPath` calls and publishes a *single* version bump + notification.

- **Push, not poll** — today readers discover changes by calling `pull()` (or a
  read helper). A future event channel (`worker:update:post`, or a
  `sandkit.api.events` emission) could let the *writer* wake readers, removing
  sync latency and the per-read counter check.

- **Schema versioning & migration** — store a `schemaVersion` in the record and
  auto-migrate old stored copies on construction (`assertShape` already gives a
  hook to validate *before* commit).

- **Multiple named namespaces per key** — or a small registry of sub-keys, so a
  single `JsonBuffer` can back several logical stores without key-plumbing leaks.

- **Worker integration polish** — align `createWorkerTick` (from
  `@sandmd/controls`) with these buffers: a `WorkerRecord` adapter wrapping a
  `JsonBuffer` (`getPath`/`setPath`/`commit`/`sync`) so worker ticks read/write
  the same shared state cleanly.
