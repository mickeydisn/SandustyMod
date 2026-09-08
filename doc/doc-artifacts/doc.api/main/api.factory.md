> **Entry:** Main only. Official: [sandkit.html](https://sandustry.com/sandkit.html).

# `api.factory`

Factory tier and process statistics.

## Methods

### `getLevel(): number`
Current factory level/tier.

### `getProcessCount(processId): number`
How many times a process has run.

| Param | Type | Description |
|---|---|---|
| `processId` | string | One of the process ids below |

### `getProcessRate(processId): number`
Throughput/rate for a process.

### Known `processId` values
| Id | Role |
|---|---|
| `"shakeWetSand"` | Shaker wet sand |
| `"pressBurntResidue"` | Kinetic press |
| `"growFlowers"` | Grower |
| `"condenseFlorin"` | Condenser |

```js
const n = api.factory.getProcessCount("shakeWetSand");
const rate = api.factory.getProcessRate("growFlowers");
```
