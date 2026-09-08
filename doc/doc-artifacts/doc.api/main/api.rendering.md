> **Entry:** Main only. Official: [sandkit.html](https://sandustry.com/sandkit.html).

# `api.rendering`

Screen-space helpers for overlays and `frame:render`.

## Methods

### `getDrawPositionAtWorld(worldX, worldY): { x, y }`
World pixel → draw/screen position.

### `getDrawPositionAtCell(cellX, cellY): { x, y }`
Cell → draw position.

### `getGridMetrics(): { cellSize, snapGridCellSize, ... }`

```js
const { cellSize, snapGridCellSize } = api.rendering.getGridMetrics();
```

### `getOverlayViewportSize(): size`
Overlay canvas viewport size.

### `withOverlayContext(callback): void`

| Param | Type | Description |
|---|---|---|
| `callback` | `(context) => void` | Canvas-like 2D context |

```js
api.events.on("frame:render", () => {
  const p = api.rendering.getDrawPositionAtWorld(wx, wy);
  drawMarker(p.x, p.y);
});

api.rendering.withOverlayContext((ctx) => {
  ctx.fillRect(0, 0, 16, 16);
});
```
