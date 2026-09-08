> **Entry:** Main only. Official: [sandkit.html](https://sandustry.com/sandkit.html).

# `api.action`

Current player action mode (build, demolish, signal linker, …).

## Methods

### `getActive(): Action | null`
Currently active action object (`id` may be `"signalLinker"`, structure build, etc.).

### `getSelected(): unknown`
Currently selected build/tool selection when applicable.

### `setCustomData(data): void`

| Param | Type | Description |
|---|---|---|
| `data` | `object` | Arbitrary action custom payload |

```js
api.action.setCustomData({ mode: "example" });
```

**Note:** `api.signals.interactables` skips handling when active action is `signalLinker`.
