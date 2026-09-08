> **Entry:** Main only.  
> Official: [sandkit.html](https://sandustry.com/sandkit.html)  
> **Payloads:** [definitions/api.signals.definition.md](../definitions/api.signals.definition.md)

# `api.signals`

Wireable structure signals: player **interact** (click/use), **senders**, **receivers**, and link state.

Not available on Worker entry.

---

## Methods

| Method | Signature | Returns |
|---|---|---|
| `interactables.register` | `(structureTypeOrId, handler)` | `void` |
| `targets.register` | `(structureTypeOrId, apply)` | `void` |
| `registerSenderType` | `(structureId, getOutput?)` | `void` |
| `setOutputAtCell` | `(cellX, cellY, on: boolean)` | `void` |

Engine also has internal link helpers (`set`/`setAll`/`getCombinedAt`/…) used by vanilla logic structures.

---

## `interactables.register(structureTypeOrId, handler)`

**Why:** Official way to handle player click/use on a structure. Replaces mouse polling.

```ts
handler: (structure: Structure) => void
```

**How it runs:** Engine intercepts `action:intercept` when the player uses the cell under the cursor. Skips demolish, marquee, and signal-linker modes. Looks up handler by `structure.type`, invokes it, cancels default action. Also drives hover highlight unless `data.locked` or `interactable:suppressHover` intercept blocks it.

```js
api.signals.interactables.register("myMod.lever", (structure) => {
  if (structure.data?.locked) return;
  structure.data.on = !structure.data.on;
  api.structures.update(structure, { propagateToWorkers: true });
  api.signals.setOutputAtCell(structure.x, structure.y, structure.data.on);
});
```

---

## `targets.register(structureTypeOrId, apply)`

**Why:** Called when incoming signal links to this structure type change.

```ts
apply: (structure, payload) => void
payload: {
  combined: boolean;   // true if any incoming link is on
  inputCount: number;
  onCount: number;
}
```

```js
api.signals.targets.register("myMod.machine", (structure, payload) => {
  api.structures.processing.setEnabledAtCell(
    structure.x,
    structure.y,
    payload.combined,
  );
});
```

**When:** After signals session init. Throws if callback is not a function / session missing.

---

## `registerSenderType(structureId, getOutput?)`

Marks type as a signal source for link mode.

```ts
getOutput?: (structure) => boolean
```

```js
api.signals.registerSenderType("myMod.sensor", (s) => s.data.charge >= s.data.threshold);
```

## `setOutputAtCell(cellX, cellY, on)`

Drives outgoing link state from a sender cell (call when data changes).

---

## Execution flow

1. Register structure type (Main)  
2. `registerSenderType` and/or `targets.register` and/or `interactables.register`  
3. Player links structures in-game with signal linker tool  
4. Interactables respond to use; targets respond to graph updates; senders publish via `setOutputAtCell` / `getOutput`
