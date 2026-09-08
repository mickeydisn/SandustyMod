# Tech definition objects

Parent: [../main/api.tech.md](../main/api.tech.md)

## `registerDefinition(techId, definition)`

```ts
{
  name?: string;
  nameKey?: string;
  description?: string;
  descriptionKey?: string;
  cost?: number;
  // branch / icon / unlocks may exist on full definitions
}
```

```js
api.tech.registerDefinition("exampleTech", {
  name: "Example research",
  nameKey: "mods|example|techName",
  descriptionKey: "mods|example|techDescription",
  cost: 100,
});
```

## `registerNode(techId, definition, options)`

```ts
options: {
  parentId: string;                    // tree parent
  preferredPosition?: { x: number; y: number } | any;
}
```

## `conservatory.appendUnlock(techId, unlocks)`

```ts
unlocks: {
  structures?: string[];
  items?: string[];
}
```

```js
api.tech.conservatory.appendUnlock(sandkit.enums.Tech.SignalDevices, {
  structures: ["exampleSensor"],
});
```
