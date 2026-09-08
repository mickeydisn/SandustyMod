> **Entry:** Main + Worker — methods differ.  
> **Object shapes:** [definitions/api.terrains.definition.md](../definitions/api.terrains.definition.md)

# `api.terrains`

Solid world cells (dirt, stone, ice, …) distinct from fluid/powder **elements**.

---

## Availability

| Method | Main | Worker | Returns |
|---|:---:|:---:|---|
| `register(definition)` | ✓ | — | `void` |
| `updateDefinition(...)` | ✓ | — | `void` |
| `getTypeById` / `getIdByType` / `getDefinitionByType` | ✓ | ✓ | type / id / config |
| `getTypeAtCell(cx, cy)` | ✓ | ✓ | type \| null |
| `getDataAtCell(cx, cy)` | ✓ | ✓ | `{ hitPoints, hp, … } \| null` |
| `isAtCell` / `isTypeAtCell` / `isCellIdTerrain` | ✓ | ✓ | `boolean` |
| `createAtCell` / `replaceAtCell` / `removeAtCell` | ✓ | ✓ | `void` |
| `damageAtCell(cx, cy, damage)` | ✓ | ✓ | `void` |
| `meltAtCell(cx, cy)` | ✓ | ✓ | `void` |
| `setHitPointsAtCell` / `setHpAtCell` | ✓ | ✓ | `void` |

---

## Behavior notes (from worker facade)

- **`createAtCell`:** only if `world.isCellEmpty` (worker).  
- **`removeAtCell`:** only if cell id is terrain.  
- **`getDataAtCell`:** returns terrain data with `hitPoints` mirrored from `hp`.

```js
api.terrains.damageAtCell(cx, cy, 10);
const data = api.terrains.getDataAtCell(cx, cy);
if (data && data.hitPoints <= 0) { /* destroyed by engine */ }
```

Register new terrains on **Main** only; respect `materialId` / obstacle breakpoint rules when setting material ids.
