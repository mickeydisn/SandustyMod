> **Entry:** Main only.  
> **Object shapes:** [definitions/api.reactions.definition.md](../definitions/api.reactions.definition.md)

# `api.reactions`

| Method | Parameters | Returns |
|---|---|---|
| `registerContact(definition)` | `{ inputA, inputB, outputA, outputB, orientation? }` | `void` |

```js
api.reactions.registerContact({
  inputA: "water",
  inputB: "myMod.powder",
  outputA: "steam",
  outputB: null,
  orientation: "any", // or "stacked"
});
```

**Why:** Element–element transforms in the sim contact pipeline.
