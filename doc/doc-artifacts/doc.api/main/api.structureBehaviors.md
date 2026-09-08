> **Entry:** Main only.

# `api.structureBehaviors`

Hooks structures into conveyor/launcher sim passes.

## Methods

### `registerConveyorType(structureId, options): void`

| Param | Type | Description |
|---|---|---|
| `structureId` | `string` | Structure type id |
| `options.runWith` | `"left" \| "right"` | Which belt run group |

```js
api.structureBehaviors.registerConveyorType("myMod.belt", { runWith: "right" });
```

### `registerLauncherType(definition): void`

| Field | Type | Description |
|---|---|---|
| `upType` | `string` | Structure id for up launcher |
| `leftType` | `string` | Left |
| `rightType` | `string` | Right |
| `velocity` | `{ x, y }` | Launch velocity (cells/sec style) |
| `softDropVelocity` | `{ x, y }` | Softer trajectory |
| `runTickSharedBufferKey` | `string` optional | SAB key for tick scheduling |

```js
api.structureBehaviors.registerLauncherType({
  upType: "myMod.launcherUp",
  leftType: "myMod.launcherLeft",
  rightType: "myMod.launcherRight",
  velocity: { x: 0, y: -44.4 },
  softDropVelocity: { x: 0, y: -30 },
});
```
