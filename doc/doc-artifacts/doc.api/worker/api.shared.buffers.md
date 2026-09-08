# Shared — `api.shared.buffers`

> **Entry:** Worker (`manifest.workerEntry`). Official: [sandkit.html](https://sandustry.com/sandkit.html).


Available on **Main** and **Worker** entries.

```ts
api.shared.buffers.ensure(key, { type, length })  // alias: create
api.shared.buffers.get(key)
```

```js
const counts = api.shared.buffers.ensure("myMod.counts", {
  type: "uint32",
  length: 4,
});
```

Used for cross-thread counters and launcher `runTickSharedBufferKey`.

Official: [sandkit.html](https://sandustry.com/sandkit.html).
