> **Entry:** Main only.

# `api.progression`

### `complete(spec): void`

| Spec | Description |
|---|---|
| `{ domain: "tutorial", grantNormalUnlocks?: boolean }` | Complete tutorial flow |
| `{ domain: "objective", id: string }` | Complete a named objective |

```js
api.progression.complete({ domain: "objective", id: "myMod.objective1" });
```
