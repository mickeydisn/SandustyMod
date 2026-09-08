# Accessing the API

`sandkit` is injected into both `entry` and `workerEntry`.

```js
const api = sandkit.api;              // stable API
const engineApi = sandkit.engine.api; // unstable escape hatch
const engineState = sandkit.engine.state;

// sandkit.apiVersion  → 1
// sandkit.enums       → BuildingClearance, Tech, Scene, …
// sandkit.react       → Main entry only (React 18)
```

## Rules of thumb

1. Never pass `state` — the facade injects it.
2. Prefer official method names from [sandkit.html](https://sandustry.com/sandkit.html).
3. Register content on **Main**; query/update instances on **Worker** when needed.

## API references

| Topic | Doc |
|---|---|
| Full API tree | [doc.api README](../../doc.api/README.md) |
| Coverage | [COVERAGE](../../doc.api/COVERAGE.md) |
| Shared vs main split | [shared README](../../doc.api/shared/README.md) · [main README](../../doc.api/main/README.md) |
