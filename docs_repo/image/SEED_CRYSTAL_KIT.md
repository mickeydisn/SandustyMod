# Seed–Crystal Kit v2.1

All three steps are **function lists** (same style as moves).

## MOVE
`Move.side|up|down|contactSink(chanceOrFn)`

## FORM (age ops — each may add Δ age with its own rate)
| Op | Meaning |
|----|---------|
| `Form.ageAlways()` | +1 every tick |
| `Form.ageOnAir(rate)` | empty neighbour |
| `Form.ageOnFloor(rate)` | solid **below** only |
| `Form.ageOnWall(rate)` | solid on **sides** (not floor-only) |
| `Form.ageOnCrystal(rate)` | own crystal neighbour |
| `Form.ageOnSurround(rate, minCount)` | ≥N liquid neighbours (deep in pool) |
| `Form.blockOnWater()` | blocks further aging |
| `Form.instantChance(rate)` | try grow at age 0 |

## GROW
`Grow.disk|cross|ring|column|single` — replace liquid only; abort keeps seed + age reset.

## Profile shape
```js
{
  id, seedType, liquidType, crystalType, ageField, growAge,
  moves: [ Move.side(...), ... ],
  form:  [ Form.ageOnFloor(...), Form.ageOnWall(...), ... ],
  grow:  [ Grow.disk(...) ],
}
```
