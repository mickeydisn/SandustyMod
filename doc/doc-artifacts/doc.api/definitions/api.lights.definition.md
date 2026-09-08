# Light options

Parent: [../shared/api.lights.md](../shared/api.lights.md)

## Temporary / VFX `createAtWorld(wx, wy, options?)`

```ts
{
  brightness?: number;
  size?: number;
  color?: [r, g, b, a] | number;
  durationTicks?: number;              // alias: duration
  durationMs?: number;
  proximityFade?: boolean | number;
}
```

```js
api.lights.temporary.createAtWorld(wx, wy, {
  durationMs: 250,
  brightness: 1.5,
  size: 80,
});
```

## Persistent

```ts
api.lights.persistent.createAtWorld(wx, wy, { brightness: 1, size: 80 });
api.lights.persistent.fadeAtWorld(wx, wy, durationMs?);
```
