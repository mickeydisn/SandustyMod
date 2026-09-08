> **Entry:** Main + Worker.

# `api.utils`

Geometry helpers.

## Methods

### `getDistance(a, b): number`
Distance between two points `{x,y}`.

### `getDirection(a, b): direction`
Unit direction from a → b.

### `getAngle(a, b): number`
Angle in radians from a → b.

### `getCoordinatesBetweenCells(c1, c2): cell[]`
Bresenham-style cells along the segment.

### `getCoordinatesBetweenPoints(p1, p2): point[]`
Points along the segment.

| Param | Type | Description |
|---|---|---|
| `a`, `b`, `c1`, `c2`, `p1`, `p2` | `{ x, y }` | Cell or world points per method |
