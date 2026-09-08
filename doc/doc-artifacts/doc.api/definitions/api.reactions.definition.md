# Contact reaction definition

Parent: [../main/api.reactions.md](../main/api.reactions.md)

## `registerContact(definition)`

```ts
{
  inputA: string | number;             // element id/type
  inputB: string | number;
  outputA: string | number | null;
  outputB: string | number | null;
  orientation?: "any" | "stacked";
}
```

```js
api.reactions.registerContact({
  inputA: "water",
  inputB: "examplePowder",
  outputA: "steam",
  outputB: null,
  orientation: "any",
});
```
