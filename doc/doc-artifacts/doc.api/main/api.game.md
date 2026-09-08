> **Entry:** Main only.

# `api.game`

Session lifecycle.

## Methods

### `start(options?): void`

Starts / enters the game session.

| Param | Type | Default | Description |
|---|---|---|---|
| `options` | `object` | `{}` | Optional flags |
| `options.skipIntro` | `boolean` | `false` | Skip intro sequence when true |

```js
api.game.start({ skipIntro: true });
```
