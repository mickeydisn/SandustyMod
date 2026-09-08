> **Entry:** Main only. Official: [sandkit.html](https://sandustry.com/sandkit.html).

# `api.resources`

Player resources (gold, energy, fluxite, …).

## Methods

### `collectFluxiteAtCell(cellX, cellY): void`
Collects fluxite resource at cell if present.

### `refresh(resourceId): void`
Forces UI/state refresh for a resource id.

| Param | Type | Description |
|---|---|---|
| `resourceId` | `string` | Resource key |

### `adjustEnergy(amount, options?): void`
Alias: `updateEnergy`.

| Param | Type | Description |
|---|---|---|
| `amount` | `number` | Delta (positive or negative) |
| `options.deferUi` | `boolean` optional | Defer UI refresh |

```js
api.resources.adjustEnergy(100, { deferUi: true });
```
