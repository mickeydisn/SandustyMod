> **Entry:** Main only. Official: [sandkit.html](https://sandustry.com/sandkit.html).

# `api.sound`

## Methods

### `play(soundId, options?): void`
### `playActive(soundId, options?): void`
Plays a one-shot or “active” looping-style sound.

| Param | Type | Description |
|---|---|---|
| `soundId` | `string` | Sound asset id |
| `options` | `object` optional | Volume, bus, attenuation fields |

### `playLayers(layers, options?): void`
Plays layered sounds.

### `calculateDistanceOptionsAtWorld(worldX, worldY, baseVolume?): object`
Builds options for distance-based attenuation.

| Param | Type | Description |
|---|---|---|
| `worldX`, `worldY` | `number` | World pixels |
| `baseVolume` | `number` optional | Base volume scale |

### `stopBySoundId(soundId): void` (alias `stopById`)
### `stopActive(): void` / `stopAll(): void`

```js
const opt = api.sound.calculateDistanceOptionsAtWorld(wx, wy, 1);
api.sound.play("myMod.click", opt);
```
