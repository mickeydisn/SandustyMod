> **Entry:** Main only. Official: [sandkit.html](https://sandustry.com/sandkit.html).

# `api.storage`

Persistent mod data (save-backed) and browser `localStorage`.

## Methods

### `ensure(modId): void`
Creates the mod’s storage namespace if missing.

| Param | Type | Description |
|---|---|---|
| `modId` | `string` | Usually your manifest `id` |

### `get(modId, key): any`
### `set(modId, key, value): void`
### `remove(modId, key): void`

| Param | Type | Description |
|---|---|---|
| `modId` | `string` | Namespace |
| `key` | `string` | Entry key |
| `value` | any | JSON-serializable recommended |

### `local.get(key)` / `local.set(key, value)` / `local.remove(key)`
Browser localStorage helpers (not necessarily in save file).

```js
api.storage.ensure("author.myMod");
api.storage.set("author.myMod", "score", 10);
api.storage.local.set("author.myMod.volume", 0.8);
```
