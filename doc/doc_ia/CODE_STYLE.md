# CODE_STYLE — SandustyMod Reference

This document distills the conventions currently in use across the
`@sandmd/*` packages so future development follows the same patterns.
It is **derived from real code**, not aspirational rules:

- `packages/catalogue/src/strucutre/*` — data model + structure factory
- `packages/catalogue/src/list/*` — catalogue + selection controller
- `packages/catalogue/src/picker/*` — overlay / UI-agnostic picker
- `packages/buffer/src/**` — shared-buffer JSON store + path utilities

Use this as a checklist when writing new code in the workspace.

---

## 0. Ground rules (from `deno.json`)

The repo is a **Deno workspace** (no `package.json`). `deno fmt` / `deno lint`
are the source of truth for mechanical formatting.

```jsonc
// deno.json (root)
"workspace": ["./packages/*", "./mods/*"],
"fmt": { "useTabs": false, "lineWidth": 100, "indentWidth": 4 },
"lint": { "rules": { "tags": ["recommended"] } }
```

- **4-space indentation, no tabs** (matches `deno fmt` `indentWidth: 4`).
- Line width target **100 columns**.
- Run `deno fmt` and `deno lint` before finishing a change.

> ⚠️ Known drift: `packages/buffer/src/**` is currently formatted with
> **2-space** indent. This predates the repo-wide 4-space setting. New code
> must use 4 spaces per `deno.json`; normalizing `buffer` is a follow-up.

---

## 1. Package layout

Each package is a self-contained Deno package with an explicit name and a
top-level `index.ts` acting as the **public barrel / re-export surface**.

```text
packages/<name>/
  deno.json            # {"name":"@sandmd/<name>","exports":"./src/index.ts"}
  src/
    index.ts           # barrel: re-exports only the public API
    <feature>/         # one folder per concern
      index.ts         # optional sub-barrel
      types.ts         # types for that concern
      <impl>.ts        # implementations
```

`deno.json` example (note `lib` for DOM/Canvas types where needed):

```jsonc
{
  "name": "@sandmd/catalogue",
  "exports": "./index.ts",
  "compilerOptions": { "lib": ["deno.window", "dom"] }
}
```

**Import naming** — packages are consumed by their `@sandmd/<name>` name;
internal relative imports always carry the explicit `.ts` extension:

```ts
import { CatalogueItem } from "@sandmd/catalogue";   // cross-package, no extension
import { CatalogueItem } from "./types.ts";          // relative, WITH .ts
```

---

## 2. Imports & global `sandkit`

- Use `import type { ... }` when importing **only types**:

  ```ts
  import type { BuildEventMap, BuildEventName } from "./types.ts";
  ```

  (When a symbol is used as both a value and a type, prefer a plain import
  and let the compiler sort it out, as seen in `strucutre`.)

- Interaction with the engine goes through the **global `sandkit` API**
  (`sandkit.api.*`) with **no import**; side-effect import only the types
  package once so the global is visible to tooling:

  ```ts
  import "@sandmd/sandkit";   // pull in global `sandkit` type declarations
  ```

- Always guard engine access defensively (the API may be absent):

  ```ts
  if (!sandkit.api.rendering?.getDrawPositionAtCell) return false;
  if (!sandkit.api.storage) return;
  ---

## 3. Types

### 3.1 String-literal unions for closed sets

```ts
export type AlignMode = "floor" | "wall" | "center";
export type BuildEventName = "select" | "place" | "remove" | "category" | "mirror";
```

### 3.2 Interfaces with **grouped, labeled comments**

Fields are ordered by concern and each group is introduced with a comment:

```ts
export interface CatalogueItem {
    // Basic info
    id: string;
    label: string;
    description: string;
    category: string;
    // Sprite
    width: number;
    height: number;
    filePath: string;
    spriteId?: string;
    // Sprite alignment and mirroring
    align?: AlignMode;
    isMirrored?: boolean;
    // Data for structure copyData and defaultData…
    data?: Record<string, unknown>;
}
```

- Optional fields use `?`, **never** confusing `| undefined` or `null` unions.
- Use `Record<string, unknown>` for open/loose data bags.
- Mark interface members `readonly` when they must not be reassigned:

  ```ts
  export interface BuildList {
      readonly modId: string;
      readonly catalogueItems: CatalogueItem[];
      getSelected(): CatalogueItem | undefined;
      on<K extends BuildEventName>(name: K, handler: BuildListener<K>): () => void;
  }
  ```

### 3.3 Event maps + generic listeners

Model event payloads as a map type, then derive the listener signature
from it via a generic constraint:

```ts
export interface BuildEventMap {
    select:   { item: CatalogueItem; mirrored: boolean };
    place:    PlacedPayload;
    remove:   PlacedPayload;
    category: { categoryId: string };
    mirror:   { mirrored: boolean };
}

export type BuildListener<K extends BuildEventName = BuildEventName> =
    (event: BuildEventMap[K]) => void;
```

---

## 4. Functions & implementations

### 4.1 Export pure helpers at module top level

Small, focused functions are exported directly with a descriptive name:

```ts
export function itemIdFromType(modId: string, type: string): string | null {
    const prefix = `${modId}:cItem:`;
    if (!type.startsWith(prefix)) return null;
    let id = type.slice(prefix.length);
    if (id.endsWith(MIRROR_SUFFIX)) id = id.slice(0, -MIRROR_SUFFIX.length);
    return id;
}
```

- **Guard clauses / early returns** before doing work.
- Return `null` (not a bare `undefined`) to signal "not found".
- Use template literals for string construction, never `+` concatenation.

### 4.2 Factories returning closures or objects

Public APIs are built as **factory functions** that return a closure /
object, so callers get an instance with a tiny method surface:

```ts
export const buildCustumDraw = (item: CatalogueItem) => {
    // …captures `item`…
    return (_state: unknown, structure: { x: number; y: number; … }) => {
        const ctx = render?.ctx;
        if (!ctx || !sandkit.api.rendering?.getDrawPositionAtCell) return false;
        if (!item.spriteId) return false;
        // …
        return true;
    };
};
```

```ts
export const createBuildList = (options: BuildListOptions): BuildList => {
    const catalogueItems = options.catalogueItems.slice();   // defensive copy
    // …
    const list: BuildList = { /* method-shorthand implementations */ };
    return list;
};
```

Notes:
- **Method shorthand** in object literals (`getSelected() { … }`) for the
  returned API; use `getSelected: () => x` only for one-liner getters.
- Mutate captured **closure state** (`let selectedId`, `let mirrored`), and
  re-parse/filter inputs into copies rather than aliasing caller arrays.
---

## 5. Events / listeners

- Keep listeners in a per-event `Set`, indexed by a mapped type:

  ```ts
  const listeners: { [K in BuildEventName]: Set<BuildListener<K>> } = {
      select: new Set(), place: new Set(), /* … */ mirror: new Set(),
  };

  const emit = <K extends BuildEventName>(name: K, event: BuildEventMap[K]) => {
      for (const h of listeners[name]) {
          try { (h as BuildListener<K>)(event); }
          catch (err) { console.error("[panel-build-list]", name, err); }
      }
  };
  ```

- **Subscribe returns an unsubscribe closure** — let the caller tear down so
  no `dispose()` bookkeeping is required:

  ```ts
  on(name, handler) {
      const set = listeners[name] as Set<BuildListener<typeof name>>;
      set.add(handler);
      return () => set.delete(handler);
  }
  ```

  The `buffer` package does the same with `subscribe()`:

  ```ts
  subscribe(fn: any) {
      this.listeners.add(fn);
      return () => this.listeners.delete(fn);
  }
  ```

- Guard each handler in `try/catch` so one bad listener never breaks the loop.
- Log with a **bracket tag** prefix for greppability:
  `console.error("[panel-build-list]", name, err);`
  `console.warn("[picker-overlay] could not restore selection", err);`

---

## 6. Classes & state

`buffer` shows the class style for stateful, sync-driven objects:

- Definite-assignment `!` for views/fields set in the constructor.
- Typed view fields (`Int32Array`, `Uint8Array`) for raw shared buffers.
- A `Set` of listeners + an arrow-field `notify` that fans out together:

  ```ts
  private listeners = new Set<(state: T) => void>();
  private notify = () => { for (const fn of this.listeners) fn(this.cache); };
  ```

- Default parameter values on public methods:

  ```ts
  public listPaths(maxDepth: number = 8, includeContainers: boolean = true) { … }
  ```

- Keep sync/public methods light; delegate real work to private helpers
  (`readFromBuffer`, `commit`, `save`).

---

## 7. Constants & naming

| Kind | Convention | Example |
|------|------------|---------|
| Files / folders | `camelCase` | `createBuildList.ts`, `json-buffer.ts`, `utils/` |
| Module-level constants | `UPPER_SNAKE_CASE` | `MIRROR_SUFFIX`, `DEFAULT_SPRITE_PX_PER_TILE`, `DEFAULT_MAX_BYTES` |
| Function / vars | `camelCase` | `buildCustumDraw`, `selectedId`, `itemIdFromType` |
| Interface / type alias | `PascalCase` | `CatalogueItem`, `AlignMode`, `BuildListOptions` |
| Storage keys | dotted `"scope.name"` | `"picker.selected"`, `"picker.mirror"` |

Group related constants at the top of a file, with a blank line between
declarations and use:

```ts
---

## 8. Comments & docs

- **`/** JSDoc */`** on every exported function/interface and on non-obvious
  behavior — describe *intent and edge cases*, not just what it does:

  ```ts
  /**
   * Append to the array at `path`. If `value` is null/undefined, a default
   * item is generated … it clones the shape of the array's first existing
   * element with every primitive reset to its zero value …
   */
  export function addToPath(root: any, path: string, value?: unknown): number { … }
  ```

- **`//` single-line comments** for short in-code notes, guards and "why"
  explanations.
- **File-header comment** for a file's purpose / usage contract:

  ```ts
  /**
   * BuildList — selection + catalogue, no cost logic.
   *
   * Events: select, place, remove, category, mirror.
   * Call notifyPlace / notifyRemove from the game when a structure is
   * actually built or demolished (sandkit events, or the playground grid).
   */
  ```

- Use `// section` dividers (`// --`, `// core`, `// assert`) sparingly to mark
  phases inside a long function.

---

## 9. Idioms & do's / don'ts

**Prefer / use:**
- Optional chaining `?.` and nullish coalescing `??`:
  `def.categoryKey ?? "misc"`, `opts.renderSize ?? { width: 16, height: 16 }`.
- Spread for shallow merge/defaulting of option bags:
  ```ts
  defaultData: { ...(opts.defaultData ?? {}) },
  buildModes: def.buildModes ?? [{ type: "single" }],
  ```
- Conditional spread for optional object keys:
  ```ts
  ...(def.nameKey ? { nameKey: def.nameKey } : {}),
  ...(def.order != null ? { order: def.order } : {}),
  ```
- `Array.from({ length: y }, () => Array(x).fill(0))` for grid shapes.
- `find`/`filter`/`reduce`/`some` over raw loops for simple collection work.
- `deepClone` via `JSON.parse(JSON.stringify(v))` for plain-data cloning.

**Avoid / do not:**
- `var`, inferred `any` on public APIs, unused imports (keep `deno lint` clean).
- Mutating caller-owned arrays/objects — copy defensively (`.slice()`).
- Returning `undefined` where the caller expects a value — use `null`.
- Uncaught async surprises — wrap engine-touching reads/writes in `try/catch`.
- New 2-space indentation (see §0) and string `+` concatenation.

---

## 10. Barrel (`index.ts`) pattern

Public surface is an explicit list of `export` statements — no fluff:

```ts
// packages/buffer/src/index.ts
export { JsonBuffer } from "./json-buffer.ts";

// packages/catalogue/src/list/index.ts
export type { CatalogueCategory } from "./types.ts";
export type { BuildList } from "./createBuildList.ts";
export { createBuildList } from "./createBuildList.ts";
export { persistSelection, restorePickerState } from "./persistence.ts";
```

Type-only re-exports use `export type { … }`; value exports use `export { … }`.
Comment out (rather than explode) internal types that are not yet public.

---

## 11. Structure of a new feature

1. **`src/<feature>/types.ts`** — unions, interfaces, event maps, options.
2. **`src/<feature>/<impl>.ts`** — pure helpers + factory returning the API.
3. **`src/<feature>/persistence.ts`** (if state) — storage get/set with guards.
4. **`src/<feature>/index.ts`** — barrel re-exporting only public symbols.
5. **`src/index.ts`** — top-level barrel including the feature.
6. `deno fmt` + `deno lint`; keep it green.

---

## 12. Known pitfalls

- The `strucutre/` folder name is **misspelled** (should be `structure/`).
  Do not *introduce* new misspellings; renaming the folder is a separate
  refactor so imports stay untouched here.
- `buffer`'s 2-space indentation and the `utils/codec copy.ts` duplicate are
  known debt — new files must not copy them.