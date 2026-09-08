> **Entry:** Main only.

# `api.settings`

Player settings.

## Methods

### `get(fieldId): any`
### `getAll(): object`
### `onChange(callback): unsubscribe`

| Param | Type | Description |
|---|---|---|
| `callback` | `(values) => void` | Fires when settings change |

```js
const unsub = api.settings.onChange((values) => {
  applySettings(values);
});
```
