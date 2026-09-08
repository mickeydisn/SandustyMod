> **Entry:** Main only. Official: [sandkit.html](https://sandustry.com/sandkit.html).

# `api.time`

Simulation clocks.

## Methods

### `getElapsedMs(): number`
Alias: `getTimeMs`. Milliseconds since session start (or engine clock).

### `getTick(): number`
Current simulation tick index.

```js
const t = api.time.getElapsedMs();
const tick = api.time.getTick();
```
