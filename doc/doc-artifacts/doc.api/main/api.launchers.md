# Sandustry API — `api.launchers`

> **Entry:** Main only (`manifest.entry`). Official: [sandkit.html](https://sandustry.com/sandkit.html).


Register directional launcher structure groups.

---

## Surface

```ts
api.launchers.registerType(launcherGroup)
```

---

## `registerType(launcherGroup)`

```ts
launcherGroup: {
  upType: string | number;       // structure type when launching up
  leftType: string | number;     // structure type when launching left
  rightType: string | number;    // structure type when launching right
  // additional fields may be present for mk2 / mod variants
}
```

### Behaviour

1. Pushes the group onto `sandkit.registeredLauncherTypes[]`.
2. Posts `RegisterLauncherType` to simulation workers (and manager) when multithreading is active.

`api.structures.isLauncherAt(cellX, cellY)` returns true for vanilla launchers **and** any cell whose structure type matches a registered group’s `upType` / `leftType` / `rightType`.

---

## Example

```js
// Register three oriented structure defs first, then:
api.launchers.registerType({
  upType: "myMod.launcherUp",
  leftType: "myMod.launcherLeft",
  rightType: "myMod.launcherRight"
});
```

---

## Notes

- Register the structure types with matching `buildModes` (vanilla uses `line` + `launcherRectUp` / `launcherRectSide`).
- Unlock via tech / `api.player.buildings.add`.
