> **Entry:** Main only. Official: [sandkit.html](https://sandustry.com/sandkit.html).

# `api.cooldown`

Shared ready-gate for tools/items.

## Methods

### `start(cooldown): void`
Alias: `check(cooldown, durationOverrideMs?)`.

| Param | Type | Description |
|---|---|---|
| `cooldown` | `object` | Mutable cooldown state owned by the item/tool |

Marks the cooldown as consumed / starts the timer.

### `isReady(cooldown, durationOverrideMs?): boolean`

| Param | Type | Description |
|---|---|---|
| `cooldown` | `object` | Same object passed to `start` |
| `durationOverrideMs` | `number` optional | Override default duration |

**Returns:** `true` if elapsed time allows another use.

```js
if (api.cooldown.isReady(cooldown)) {
  // fire tool
  api.cooldown.start(cooldown);
}
```
