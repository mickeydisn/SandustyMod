# Workers & shared buffers

```js
// Main
api.workers.setPostUpdateEnabled(true);

// Worker
const i = api.worker.getIndex();
const n = api.worker.getCount();

const counts = api.shared.buffers.ensure("myMod.counts", {
  type: "uint32",
  length: 4,
});
```

## API reference

- [api.workers](../../doc.api/main/api.workers.md)  
- [api.worker](../../doc.api/worker/api.worker.md)  
- [api.main](../../doc.api/worker/api.main.md)  
- [api.shared.buffers](../../doc.api/shared/api.shared.buffers.md)  
- [api.utils](../../doc.api/shared/api.utils.md) · [api.random](../../doc.api/shared/api.random.md)  
