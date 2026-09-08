# Signals handlers & payloads

Parent: [../main/api.signals.md](../main/api.signals.md)

---

## `interactables.register(structureTypeOrId, handler)`

| Param | Type | Description |
|---|---|---|
| `structureTypeOrId` | `string` | Structure type id |
| `handler` | `(structure) => void` | Click/use callback |

**When called:** Player uses structure under cursor; demolish/marquee/signal-linker modes skipped.

```js
api.signals.interactables.register("myMod.lever", (structure) => {
  if (structure.data?.locked) return;
  structure.data.on = !structure.data.on;
  api.structures.update(structure, { propagateToWorkers: true });
});
```

---

## `targets.register(structureTypeOrId, apply)`

| Param | Type | Description |
|---|---|---|
| `structureTypeOrId` | `string` | Receiver structure type |
| `apply` | `(structure, payload) => void` | Called when incoming links change |

### `payload`

| Field | Type | Description |
|---|---|---|
| `combined` | `boolean` | True if any incoming link is on (OR) |
| `inputCount` | `number` | Number of incoming links |
| `onCount` | `number` | Incoming links currently on |

```js
api.signals.targets.register("myMod.machine", (structure, payload) => {
  api.structures.processing.setEnabledAtCell(
    structure.x, structure.y, payload.combined,
  );
});
```

---

## `registerSenderType(structureId, getOutput?)`

| Param | Type | Description |
|---|---|---|
| `structureId` | `string` | Sender type |
| `getOutput` | `(structure) => boolean` optional | Current output reader |

## `setOutputAtCell(cellX, cellY, on)`

| Param | Type | Description |
|---|---|---|
| `cellX`, `cellY` | `number` | Sender cell |
| `on` | `boolean` | Output state |
