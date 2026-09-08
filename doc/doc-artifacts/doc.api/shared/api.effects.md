> **Entry:** Main + Worker — methods differ.

# `api.effects`

| Method | Main | Worker | Returns |
|---|:---:|:---:|---|
| `createAtWorld` / `createEffectAtWorld` | ✓ | ✓ | `void` |
| `createParticlesAtWorld(wx, wy, options?)` | ✓ | ✓ | `void` |
| `createDistortionWaveAtWorld` | ✓ | — | `void` |
| `createLaserAtWorld` | ✓ | — | `void` |
| `createLightAtWorld` (alias path) | ✓ | ✓ | `{ lightId, index }` |

Prefer **`api.lights.temporary.createAtWorld`** for lights (official).

```js
api.effects.createParticlesAtWorld(wx, wy, { count: 8 });
```

Worker may post visual effects toward main for Pixi rendering.
