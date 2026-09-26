# Sandkit api index

Generated from `__bundel/modules/bundel.js/46781.js` by `tools/extract-api.ts`. **This is the Phase 0 oracle** — the mod is verified against this, not against the `.d.ts` files.

| metric | value |
|---|---|
| namespaces | 62 |
| total entries | 393 |
| functions | 343 |
| re-exports | 48 |
| plain values | 2 |
| take a context first arg | 156 |
| can `throw` | 14 |

**`ctx` column** is `y` when the first parameter is the engine context object carrying `.sandkit` / `.session` / `.store` / `.shared`. That is the calling-convention question Phase 1 has to settle.

## Namespaces

- `action` — 3 entries
- `authorization` — 6 entries
- `building` — 4 entries
- `camera` — 3 entries
- `collector` — 5 entries
- `config` — 1 entries
- `constants` — 1 entries
- `conveyors` — 1 entries
- `cooldown` — 2 entries
- `debug` — 1 entries
- `discoveries` — 2 entries
- `drones` — 2 entries
- `effects` — 6 entries
- `elements` — 43 entries
- `energy` — 7 entries
- `events` — 1 entries
- `excavation` — 2 entries
- `extend` — 1 entries
- `factory` — 9 entries
- `fire` — 2 entries
- `game` — 3 entries
- `grid` — 2 entries
- `hooks` — 15 entries
- `i18n` — 18 entries
- `input` — 11 entries
- `items` — 9 entries
- `launchers` — 1 entries
- `maps` — 4 entries
- `matters` — 3 entries
- `misc` — 1 entries
- `patterns` — 2 entries
- `pipes` — 4 entries
- `player` — 14 entries
- `processing` — 3 entries
- `progression` — 1 entries
- `projectiles` — 5 entries
- `queue` — 6 entries
- `random` — 2 entries
- `raycast` — 1 entries
- `reactions` — 1 entries
- `rendering` — 8 entries
- `resources` — 3 entries
- `scene` — 1 entries
- `schedule` — 1 entries
- `shadows` — 3 entries
- `signals` — 1 entries
- `sound` — 7 entries
- `sprites` — 4 entries
- `storage` — 7 entries
- `structures` — 36 entries
- `tech` — 8 entries
- `teleportZones` — 7 entries
- `terrains` — 15 entries
- `tools` — 5 entries
- `triggers` — 1 entries
- `ui` — 27 entries
- `upgrades` — 6 entries
- `utils` — 6 entries
- `wall` — 4 entries
- `workerLocal` — 4 entries
- `workers` — 10 entries
- `world` — 21 entries

## action

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `getActive` | `e` |  |  | 1160 |  (0, Y.h3)(e) |
| `getSelected` | `e` |  |  | 1162 |  (0, Y.m0)(e) |
| `setCustomData` | `(e, t)` | y |  | 1164 | { e.session.action.customData = t } |

## authorization

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `canGrab` | `(e, t, n)` |  |  | 1918 | (0, fe.NH)(e, t, n) |
| `canBuild` | `(e, t, n)` |  |  | 1920 | (0, fe.hJ)(e, t, n) |
| `canUseTool` | `(e, t, n=!1)` |  |  | 1922 | (0, fe.Ie)(e, t, n) |
| `canUseToolAt` | `(e, t, n, r=!1)` |  |  | 1924 | (0, fe.no)(e, t, n, r) |
| `getZoneIdAt` | `(e, t, n)` |  |  | 1926 | (0, fe.lD)(e, t, n) |
| `getPlayerZoneId` | `e` |  |  | 1928 |  (0, fe.vG)(e) |

## building

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `getSnappedCellPosition` | `(e, t)` |  |  | 3821 | (0, A.Pm)(e, t) |
| `isBlockedByTerrainOrElements` | `(e, t, n)` |  |  | 3823 | (0, A.lp)(e, t, n) |
| `cancelPlacement` | `e` |  |  | 3825 |  { (0, A.IV)(e) } |
| `selectStructure` | `(e, t)` | y |  | 3830 | ( (e, t) => { if (!A.VI[t]) return null; if ((0, J.L5)(e)) return null; const n = (e => { var t; const n = A.V |

## camera

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `snapToPlayer` | `e` |  |  | 4114 |  { (0, ne.Tr)(e) } |
| `setFocusAtWorld` | `(e, t, n)` |  |  | 4119 | { (0, ne.t5)(e, t, n) } |
| `releaseFocusToPlayer` | `(e, t=0)` | y |  | 4124 | { t > 0 ? (0, ne.kt)(e, { x: e.session.camera.x, y: e.session.camera.y }, t) : (0, ne.Tr)(e) } |

## collector

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `getValueFromElementType` | `(e, t)` |  |  | 2447 | { ct \|\| (ct = bt(e)); return ct.get(t) \|\| 0 } |
| `getValueFromCellId` | `(e, t)` | y |  | 2452 | { const n = l.on.getElementIndexFromCellId(t) , o = e.shared.sim.elementData.type[n]; let a = $t.collector.get |
| `isCellCollectable` | `(e, t)` |  |  | 2459 | $t.collector.getValueFromCellId(e, t) > 0 |
| `isCellCollectableForSprite` | `(e, t)` | y |  | 2460 | { const n = l.on.getElementIndexFromCellId(t) , o = e.shared.sim.elementData.type[n] , a = t => (ct \|\| (ct = |
| `notifyPickup` | `(e, t, n)` | y |  | 2470 | { const r = l.on.getCellId(e.shared.sim, t, n); (0, c.oM)(e, r, t, n, "deduct") } |

## config

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `config` | — |  |  | 4447 | Object.assign( (e, t) => (0, ve.pE)(e, t), { getLegacy: () => i.A, set: (e, t) => (0, ve.Nk)(e, t) }) |

## constants

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `PHYSICS` | — |  |  | 1169 | re-export → `ae.J8` |

## conveyors

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `registerType` | `(e, t, n)` |  |  | 2672 | { var o, a, i; (null === (o = e.environment) \|\| void 0 === o ? void 0 : o.context) !== r.bF.Worker && (0, E. |

## cooldown

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `check` | `(e, t, n)` | y |  | 1057 | (0, le.v)(e.store, t, n) |
| `isReady` | `(e, t, n)` | y |  | 1059 | (0, le.i)(e.store, t, n) |

## debug

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `register` | `(e, t, n)` | y |  | 3554 | { e.sandkit.mods.debug \|\| (e.sandkit.mods.debug = {}), e.sandkit.mods.debug[t] = { id: t, items: n }, (0, H. |

## discoveries

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `addElement` | `(e, t)` | y |  | 4454 | { e.store.discoveries \|\| (e.store.discoveries = { elements: [], terrains: [] }), e.store.discoveries.element |
| `addTerrain` | `(e, t)` | y |  | 4462 | { e.store.discoveries \|\| (e.store.discoveries = { elements: [], terrains: [] }), e.store.discoveries.terrain |

## drones

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `spawn` | `(e, t, n, r, o, a)` |  |  | 1063 | (0, oe.kw)(e, t, n, r, o, a) |
| `kill` | `(e, t)` |  |  | 1065 | { (0, oe.vd)(e, t) } |

## effects

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `createDistortionWave` | `(e, t, n, o={})` | y |  | 3208 | { var i; if ((null === (i = e.environment) \|\| void 0 === i ? void 0 : i.context) === r.bF.Worker) return; co |
| `createLaser` | `(e, t, n, r, o, i={})` | y |  | 3250 | { const {width: s=1, brightness: l=1, color: c=16711680, glow: d=!0} = i , u = new a.A1g; return u.blendMode = |
| `createLight` | `(e, t, n, o={})` |  |  | 3264 | { var a; const {brightness: i=1, duration: s=300, durationMs: l, size: c=300, color: d=[1, 0, 0, 1], decay: u, |
| `removeLight` | `(e, t)` |  |  | 3293 | { (0, h.b_)(e, t) } |
| `createParticles` | `(e, t, n, o={})` |  |  | 3298 | { var a; if ((null === (a = e.environment) \|\| void 0 === a ? void 0 : a.context) === r.bF.Worker) return voi |
| `createEffect` | `(e, t, n, o, a={})` |  |  | 3331 | { var i; (null === (i = e.environment) \|\| void 0 === i ? void 0 : i.context) !== r.bF.Worker ? (0, ke.E)(e,  |

## elements

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `getRegisteredTypes` | `e` | y |  | 1256 |  { var t; const n = new Set , o = []; for (const e in r.RJ) { const t = r.RJ[e]; "number" == typeof t && w.m5[ |
| `register` | `(e, t)` | y |  | 1275 | { const n = (e => { const t = Object.values(r.RJ).filter(e => "number" == typeof e) , n = Object.values(e.sand |
| `updateDefinition` | `(e, t, n)` | y |  | 1303 | { var r, o; let a, i; if ("string" == typeof t) { if (i = e.sandkit.mods.elements[t], !i) return; a = i.elemen |
| `addInteractionInfo` | `(e, t, n)` |  |  | 1323 | { const r = "string" == typeof t ? $t.elements.getElementTypeFromId(e, t) : t , o = w.m5[r]; if (!o) return; c |
| `getElementTypeFromId` | `(e, t)` | y | yes | 1334 | { it \|\| (it = (e => { const t = Object.create(null); return Object.keys(r.RJ).forEach(e => { isNaN(Number(e) |
| `getElementIdFromType` | `(e, t)` | y |  | 1354 | { var n; return st \|\| (st = (e => { var t; const n = new Map , o = Object.keys(r.RJ); for (let e = 0; e < o. |
| `getName` | `(e, t)` | y |  | 1378 | { var n, r; const o = w.m5[t]; if (o) { const e = (0, we.mG)(o); if (e && !e.startsWith("[MISSING:") && !e.sta |
| `removeAt` | `(e, t, n, o)` | y |  | 1396 | { var a; const i = l.on.getCellId(e.shared.sim, t, n) , s = l.on.isCellIdElement(i) , u = s ? l.on.getResolved |
| `removeAtDeferred` | `(e, t, n, o)` | y |  | 1414 | { var a; const i = e => { const r = l.on.getCellId(e.shared.sim, t, n); l.on.isCellIdElement(r) && $t.elements |
| `createAt` | `(e, t, n, o, a)` | y |  | 1425 | { var i, s, f, h; if (o === r.RJ.Particle) return; const p = (0, w.n)(o, t, n); (null == a ? void 0 : a.data)  |
| `replaceAt` | `(e, t, n, r, o)` | y |  | 1465 | { const a = e.shared.sim , i = l.on.getCellId(a, t, n); if (l.on.isCellIdElement(i) \|\| l.on.isCellIdDamagedT |
| `getElementTypeAtPos` | `(e, t, n)` |  |  | 1486 | (0, g.QC)(e, t, n) |
| `getResolvedTypeAtPos` | `(e, t, n)` | y |  | 1488 | l.on.getResolvedTypeAtPosition(e.shared.sim, t, n) |
| `getMatterTypeAtPos` | `(e, t, n)` | y |  | 1489 | { var o, a; const i = e.shared.sim , s = l.on.getCellId(i, t, n); if (!l.on.isCellIdElement(s)) return null; c |
| `getResolvedTypeFromCellId` | `(e, t)` | y |  | 1512 | l.on.getResolvedTypeFromCellId(e.shared.sim, t) |
| `getInfoAtPos` | `(e, t, n)` | y |  | 1513 | l.on.getInfoAtPosition(e.shared.sim, t, n) |
| `isTypeAt` | `(e, t, n, r)` |  |  | 1514 | (0, g.QC)(e, t, n) === r |
| `isFreeFalling` | `(e, t, n)` | y |  | 1516 | { const r = e.shared.sim , o = l.on.getCellId(r, t, n); if (l.on.isCellIdElement(o)) { const e = l.on.getEleme |
| `findFreePositionInStructure` | `(e, t, n, r)` | y |  | 1526 | { const o = []; for (let e = 0; e < r; e++) for (let a = 0; a < r; a++) o.push({ x: t + a, y: n + e }); for (l |
| `move` | `(e, t, n, r, o)` | y |  | 1544 | { const a = l.on.getCellId(e.shared.sim, t, n); if (!l.on.isCellIdElement(a)) return !1; const i = l.on.getEle |
| `moveAtSimulationIdle` | `(e, t, n, o, a, i)` | y |  | 1561 | { var s; if ((null === (s = e.environment) \|\| void 0 === s ? void 0 : s.context) !== r.bF.Main) return !1; c |
| `teleport` | `(e, t, n, o, a)` | y |  | 1582 | { var i; const s = e => { const r = l.on.getCellId(e.shared.sim, t, n); if (!l.on.isCellIdElement(r)) return;  |
| `getVelocity` | `(e, t, n)` | y |  | 1603 | { const r = e.shared.sim , o = l.on.getCellId(r, t, n); if (!l.on.isCellIdElement(o)) return null; const a = l |
| `setVelocity` | `(e, t, n, r)` | y |  | 1615 | { const o = e.shared.sim , a = l.on.getCellId(o, t, n); if (!l.on.isCellIdElement(a)) return !1; const i = l.o |
| `addParticleVelocity` | `(e, t, n, o, a)` | y |  | 1627 | { const i = e.shared.sim , s = l.on.getCellId(i, t, n); if (!l.on.isCellIdElement(s)) return !1; const c = l.o |
| `convertToParticle` | `(e, t, n, o)` | y |  | 1667 | { const a = e.shared.sim , i = l.on.getCellId(a, t, n); if (!l.on.isCellIdElement(i)) return !1; const s = l.o |
| `convertFromParticle` | `(e, t, n)` | y |  | 1678 | { const o = e.shared.sim , a = l.on.getCellId(o, t, n); if (!l.on.isCellIdElement(a)) return !1; const i = l.o |
| `swap` | `(e, t, n, r, o)` | y |  | 1689 | { const a = l.on.getCellId(e.shared.sim, t, n) , i = l.on.getCellId(e.shared.sim, r, o); if (!l.on.isCellIdEle |
| `getDataField` | `(e, t, n, r)` | y |  | 1708 | { const o = e.shared.sim , a = l.on.getCellId(o, t, n); if (!l.on.isCellIdElement(a)) return null; const i = l |
| `setDataField` | `(e, t, n, r, o)` | y |  | 1717 | { const a = e.shared.sim , i = l.on.getCellId(a, t, n); if (!l.on.isCellIdElement(i)) return !1; const s = l.o |
| `getDataField1` | `(e, t, n)` |  |  | 1727 | $t.elements.getDataField(e, t, n, 1) |
| `setDataField1` | `(e, t, n, r)` |  |  | 1728 | $t.elements.setDataField(e, t, n, 1, r) |
| `getDataField2` | `(e, t, n)` |  |  | 1729 | $t.elements.getDataField(e, t, n, 2) |
| `setDataField2` | `(e, t, n, r)` |  |  | 1730 | $t.elements.setDataField(e, t, n, 2, r) |
| `getDataField3` | `(e, t, n)` |  |  | 1731 | $t.elements.getDataField(e, t, n, 3) |
| `setDataField3` | `(e, t, n, r)` |  |  | 1732 | $t.elements.setDataField(e, t, n, 3, r) |
| `getDataField4` | `(e, t, n)` |  |  | 1733 | $t.elements.getDataField(e, t, n, 4) |
| `setDataField4` | `(e, t, n, r)` |  |  | 1734 | $t.elements.setDataField(e, t, n, 4, r) |
| `refreshColorAt` | `(e, t, n)` | y |  | 1735 | { const r = e.shared.sim , o = l.on.getCellId(r, t, n); (0, U.RP)(e, t + n * e.shared.mapData.width, o, t, n), |
| `markMovementBlocked` | `(e, t)` | y |  | 1743 | { const n = e.shared.sim.elementData; n.velocityY[t] = n.minVelocityY[t], n.isFreeFalling[t] = 0; const r = n. |
| `getConfig` | `e` |  |  | 1751 |  w.m5[e] |
| `setPhysics` | `(e, t, n, r)` | y |  | 1752 | { const o = e.shared.sim , a = l.on.getCellId(o, t, n); if (l.on.isCellIdElement(a)) { const e = l.on.getEleme |
| `setDuration` | `(e, t, n, r, o)` | y |  | 1761 | { const a = e.shared.sim , i = l.on.getCellId(a, t, n); if (!l.on.isCellIdElement(i)) return !1; const s = l.o |

## energy

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `registerType` | `(e, t, n, r)` | y |  | 3031 | { var o; e.sandkit.mods.energy \|\| (e.sandkit.mods.energy = {}), e.sandkit.mods.energy[t] = { type: n, option |
| `add` | `(e, t, n, r, o)` |  |  | 3048 | { if (jt) return _t(e, t, n, r, o, { qx: [], qy: [], visited: new Set, parent: new Map }); jt = !0; try { retu |
| `addBatch` | `(e, t, n)` |  |  | 3064 | { if (Pt) return It(e, t, n, Et()); Pt = !0; try { return It(e, t, n, Ft) } finally { Pt = !1 } } |
| `getNetwork` | `(e, t, n)` | y |  | 3075 | { var r, o; const a = [] , i = new Set , s = [{ x: t, y: n }]; for (; s.length > 0; ) { const t = s.shift() ,  |
| `getNetworkFreeCapacity` | `(e, t, n)` | y |  | 3123 | function(e, t, n) { var r, o, a, i; let s = 0; const l = new Set , c = new Set , d = [{ x: t, y: n }]; for (;  |
| `consumeExcludingNetwork` | `(e, t, n, r)` | y |  | 3157 | { const o = function(e, t, n) { var r, o; const a = new Set , i = new Set , s = [{ x: t, y: n }]; for (; s.len |
| `consume` | `(e, t, n)` |  |  | 3185 | Nt(e, t, !1, void 0, null == n ? void 0 : n.allOrNothing) |

## events

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `events` | — |  |  | 2476 | re-export → `C.A` |

## excavation

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `registerProfile` | `(e, t, n)` |  |  | 2650 | { (0, pe.t9)(e, t, n) } |
| `prepare` | `(e, t, n, r, o, a, i, s, l, c, d)` |  |  | 2655 | (0, pe.ir)(e, t, n, r, o, a, i, s, l, c, d) |

## extend

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `extend` | `(e, t, n)` |  |  | 4470 | { $t[t] = n } |

## factory

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `getLevel` | `e` |  |  | 3704 |  (0, X.PW)(e) |
| `flushDeferredLevelUps` | `(e, t)` |  |  | 3706 | { (0, X.G1)(e, t) } |
| `canUnlockNextTier` | `e` |  |  | 3711 |  (0, X.AN)(e) |
| `unlockNextTier` | `e` |  |  | 3713 |  (0, X.UP)(e) |
| `addViabilityGold` | `(e, t)` |  |  | 3715 | { (0, X.nS)(e, t) } |
| `getProcessCount` | `(e, t)` |  |  | 3720 | (0, X.pP)(e, t) |
| `getProcessRate` | `(e, t)` |  |  | 3722 | (0, X.Is)(e, t) |
| `recordProcess` | `(e, t, n=1)` |  |  | 3724 | { (0, X.r2)(e, t, n) } |
| `ensureProcessAtLeast` | `(e, t, n)` |  |  | 3729 | { (0, X.UQ)(e, t, n) } |

## fire

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `canBurnElementAt` | `(e, t, n)` |  |  | 1774 | (0, Se.L$)(e, t, n) |
| `burnElementAt` | `(e, t, n)` |  |  | 1776 | (0, Se.Z6)(e, t, n) |

## game

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `start` | `(e, t)` | y |  | 4198 | { (null == t ? void 0 : t.skip) && (e.session.music.engine.stop(), e.session.ui.introScreen.visible = !1, (0,  |
| `save` | `(e, t, n)` | y |  | 4209 | ((0, ce.ZB)(e, { type: n ? "existing" : "new", name: t, id: n }), e.session.saving.id) |
| `load` | `(e, t)` |  |  | 4216 | { const n = new URL(window.location.href); n.search = "", n.searchParams.set("db_load", t), window.location.hr |

## grid

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `iterateRect` | `(e, t, n, r, o, a)` |  |  | 3016 | { for (let e = 0; e < o; e++) for (let o = 0; o < r; o++) a(t + o, n + e) } |
| `iterateCircle` | `(e, t, n, r, o)` |  |  | 3022 | { const a = Math.ceil(r) , i = r * r; for (let e = -a; e <= a; e++) for (let r = -a; r <= a; r++) r * r + e *  |

## hooks

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `intercept` | — |  |  | 3887 | re-export → `be.Zc` |
| `modify` | — |  |  | 3888 | re-export → `be.JP` |
| `offInterceptor` | — |  |  | 3889 | re-export → `be.nd` |
| `offModifier` | — |  |  | 3890 | re-export → `be.tt` |
| `offAll` | — |  |  | 3891 | re-export → `be.H7` |
| `runInterceptors` | — |  |  | 3892 | re-export → `be.iv` |
| `runInterceptorsSafe` | — |  |  | 3893 | re-export → `be.Z$` |
| `applyModifiers` | — |  |  | 3894 | re-export → `be.pB` |
| `applyModifiersSafe` | — |  |  | 3895 | re-export → `be.IO` |
| `hasInterceptors` | — |  |  | 3896 | re-export → `be.$E` |
| `hasGuardedInterceptors` | — |  |  | 3897 | re-export → `be.NY` |
| `hasModifiers` | — |  |  | 3898 | re-export → `be.rK` |
| `hasGuardedModifiers` | — |  |  | 3899 | re-export → `be.Bo` |
| `countInterceptors` | — |  |  | 3900 | re-export → `be.O_` |
| `countModifiers` | — |  |  | 3901 | re-export → `be.SV` |

## i18n

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `t` | `(e, t)` |  |  | 4395 | (0, we.t)(e, t) |
| `register` | `(e, t)` |  |  | 4397 | { (0, we.od)(e, t) } |
| `getLocale` | `()` |  |  | 4402 | (0, we.JK)() |
| `hasTranslation` | `(e, t)` |  |  | 4404 | (0, we.GX)(e, t) |
| `setLocale` | `e` |  |  | 4406 |  { await (0, we.xS)(e) } |
| `getLanguages` | `()` |  |  | 4411 | s.filter(e => e.enabled) |
| `formatNumber` | `(e, t)` |  |  | 4412 | (0, we.ZV)(e, t) |
| `getAvailableLocales` | `()` |  |  | 4414 | (0, we.Be)() |
| `key` | `(...e)` |  |  | 4416 | e.join("\|") |
| `getName` | `e` |  |  | 4417 |  (0, we.mG)(e) |
| `getDescription` | `e` |  |  | 4419 |  (0, we.fY)(e) |
| `translatable` | `(e, t)` |  |  | 4421 | ({ __translatable: !0, key: e, fallback: t }) |
| `setGlobal` | `(e, t)` |  |  | 4426 | { (0, we.UF)(e, t) } |
| `getGlobal` | `e` |  |  | 4431 |  (0, we.mS)(e) |
| `clearGlobal` | `e` |  |  | 4433 |  { (0, we.VS)(e) } |
| `getGlobals` | `()` |  |  | 4438 | (0, we.tU)() |
| `formatKeyForDisplay` | `e` |  |  | 4440 |  (0, we.QY)(e) |
| `syncKeyBindings` | `e` |  |  | 4442 |  { (0, we.Yw)(e) } |

## input

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `registerKeyBinding` | `(e, t, n, o)` | y |  | 3938 | { var a; e.sandkit.keyBindings[t] = Object.assign(Object.assign({}, o), { defaultKeys: [...n] }), e.session.se |
| `getMouseCellPosition` | `e` | y |  | 3957 |  ({ x: e.session.input.mouse.cellPosition.x, y: e.session.input.mouse.cellPosition.y }) |
| `getMouseWorldPosition` | `e` | y |  | 3961 |  ({ x: e.session.input.mouse.worldPosition.x, y: e.session.input.mouse.worldPosition.y }) |
| `getBoundKeys` | `(e, t)` | y |  | 3965 | { var n, r, o; const a = e.session.settings.keyBindings; if ((null === (n = null == a ? void 0 : a[t]) \|\| vo |
| `getDisplayKey` | `(e, t, n="")` |  |  | 3974 | { const r = $t.input.getBoundKeys(e, t); return r.length > 0 ? (0, we.QY)(r[0]) : n } |
| `triggerBinding` | `(e, t)` |  |  | 3980 | { (0, Ae.tX)(e, t) } |
| `pressBinding` | `(e, t)` |  |  | 3985 | { (0, Ae.Ve)(e, t) } |
| `releaseBinding` | `(e, t)` |  |  | 3990 | { (0, Ae.$E)(e, t) } |
| `resetMouseState` | `e` | y |  | 3995 |  { (0, ie.t$)(e.session.soundEngine), e.session.input.mouse.clicked = !1, e.session.input.mouse.pressed = !1,  |
| `isCtrlHeld` | `e` | y |  | 4003 |  { const t = e.session.input.keys; return t.ControlLeft === r.$T.Down \|\| t.ControlLeft === r.$T.Pressed \|\| |
| `isAltHeld` | `e` | y |  | 4008 |  { const t = e.session.input.keys; return t.AltLeft === r.$T.Down \|\| t.AltLeft === r.$T.Pressed \|\| t.AltRi |

## items

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `commitUse` | — |  |  | 2478 | re-export → `ye.YM` |
| `endUse` | — |  |  | 2479 | re-export → `ye.CN` |
| `spriteMounts` | — |  |  | 2480 | Ut |
| `getRegisteredIds` | `e` | y |  | 2481 |  { const t = (0, xe.getBuiltInItemIds)().slice() , n = e.sandkit.mods.items; for (const e in n) t.push(e); ret |
| `register` | `(e, t)` | y |  | 2490 | { xt(t, t.itemType === r.SP.Weapon ? "weapons" : t.itemType === r.SP.Tool ? "tools" : "items", t.id); const n  |
| `updateDefinition` | `(e, t, n)` | y |  | 2535 | { const o = e.sandkit.mods.items[t]; o && (xt(n, o.itemType === r.SP.Weapon ? "weapons" : o.itemType === r.SP. |
| `create` | `(e, t)` | y |  | 2541 | Object.assign({ id: t, itemType: r.SP.Mod }, e.sandkit.mods.items[t].cooldown ? { cooldown: { last: 0 } } : {} |
| `getActive` | `e` |  |  | 2549 |  (0, Y.oM)(e) |
| `isActive` | `(e, t, n)` |  |  | 2551 | { const r = (0, Y.oM)(e); return !!r && (void 0 === n \|\| r.itemType === n) && r.id === t } |

## launchers

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `registerType` | `(e, t)` | y |  | 3002 | { var n, o, a, i, s; e.sandkit.registeredLauncherTypes \|\| (e.sandkit.registeredLauncherTypes = []), e.sandki |

## maps

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `getArtifactLocations` | `e` | y |  | 4137 |  { var t, n; const o = [] , a = null === (n = null === (t = $t.prefabData) \|\| void 0 === t ? void 0 : t.getA |
| `getActive` | `e` | y |  | 4162 |  (0, Ye.UD)(e.store.world.externalMap) |
| `getAvailable` | `()` |  |  | 4164 | (0, Ye.M_)() |
| `start` | `(e, t)` | y |  | 4166 | { if (e.store.scene.active !== r.Z5.MainMenu \|\| "string" != typeof t) return !1; const n = (0, Ye.M_)(); let |

## matters

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `register` | `(e, t)` | y |  | 1206 | { var n; e.sandkit.mods.matters \|\| (e.sandkit.mods.matters = {}); const o = (e => { var t, n; const o = Obje |
| `getMatterTypeFromId` | `(e, t)` | y | yes | 1242 | { var n, r, o; const a = null === (o = null === (r = null === (n = e.sandkit) \|\| void 0 === n ? void 0 : n.m |
| `runSolidUpdate` | `(e, t, n, r, o, a, i)` |  |  | 1250 | { (0, k.h)(e, t, n, r, o, a, i) } |

## misc

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `register` | `(e, t)` | y |  | 3011 | { e.sandkit.mods.misc[t.id] = t } |

## patterns

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `createCircle` | `e` |  |  | 3565 |  { const t = Array(e).fill(0).map( () => Array(e).fill(0)) , n = Math.floor(e / 2) , r = n; for (let o = 0; o  |
| `excavate` | `(e, t, n, o, a, i, s={}, l)` |  |  | 3578 | { var c; (null === (c = e.environment) \|\| void 0 === c ? void 0 : c.context) !== r.bF.Worker ? (0, y.DN)(e,  |

## pipes

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `isAt` | `(e, t, n)` |  |  | 4183 | (0, x.MX)(e, t, n) |
| `isEnabledAt` | `(e, t, n)` |  |  | 4185 | (0, x.Nn)(e, t, n) |
| `getConnectedVentsAt` | `(e, t, n)` |  |  | 4187 | (0, x.no)(e, t, n) |
| `setEnabledAt` | `(e, t, n, o)` |  | yes | 4189 | { var a; if ((null === (a = e.environment) \|\| void 0 === a ? void 0 : a.context) === r.bF.Worker) throw new  |

## player

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `getPosition` | `e` | y |  | 4014 |  { var t, n; return (null === (t = e.store) \|\| void 0 === t ? void 0 : t.player) ? { x: e.store.player.x, y: |
| `setPosition` | `(e, t, n)` | y |  | 4028 | { e.store.player.x = t, e.store.player.y = n } |
| `setVelocity` | `(e, t, n)` | y |  | 4033 | { e.store.player.velocity.x = t, e.store.player.velocity.y = n } |
| `setMovementSpeedMultiplier` | `(e, t)` | y |  | 4038 | { e.session.movementSpeedMultiplier = t } |
| `setMovementMode` | `(e, t)` |  |  | 4042 | (0, ee.SK)(e, t) |
| `isOnGround` | `e` |  |  | 4044 |  (0, ee.E4)(e) |
| `teleportToGround` | `e` |  |  | 4046 |  { (0, ee.qw)(e) } |
| `has` | `(e, t)` | y |  | 4052 | { var n; const r = e.store.player.inventory; for (let e = 0; e < r.length; e++) if ((null === (n = r[e]) \|\|  |
| `add` | `(e, t)` | y | yes | 4061 | { const n = "number" == typeof t ? (0, xe.createBuiltInItemById)(e, t) : $t.items.create(e, t); if (!n) throw  |
| `add` | `(e, t)` | y |  | 4070 | { e.store.player.buildings.includes(t) \|\| e.store.player.buildings.push(t) } |
| `remove` | `(e, t)` | y |  | 4074 | { const n = e.store.player.buildings; let o = !1; for (let e = n.length - 1; e >= 0; e--) { const r = n[e]; r  |
| `isCollidingWithCell` | `(e, t, n)` |  |  | 4087 | { const r = $t.player.getPosition(e) , o = t * i.A.cellSize , a = n * i.A.cellSize; return r.x < o + i.A.cellS |
| `isWithinRadius` | `(e, t, n, r)` |  |  | 4094 | { const o = $t.player.getPosition(e) , a = t * i.A.cellSize + i.A.cellSize / 2 - (o.x + i.A.playerSize.width / |
| `isPositionClear` | `(e, t, n)` | y |  | 4101 | { const r = Math.floor(t / i.A.cellSize) , o = Math.ceil((t + i.A.playerSize.width) / i.A.cellSize) , a = Math |

## processing

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `registerGrower` | `(e, t)` |  |  | 2659 | { Ke(e, Ie, t) } |
| `registerShaker` | `(e, t)` |  |  | 2663 | { Ke(e, Ne, t) } |
| `registerKineticPress` | `(e, t)` |  |  | 2667 | { Ke(e, De, t) } |

## progression

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `complete` | `(e, t)` |  |  | 4224 | (0, _.H)(e, t) |

## projectiles

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `register` | `(e, t)` | y |  | 2558 | { e.sandkit.mods.projectiles[t.id] = t } |
| `createBlueprint` | `(e, t)` | y |  | 2562 | { const n = e.sandkit.mods.projectiles[t] , o = n.getOptions(); return o.texture = e.sandkit.graphics[n.sprite |
| `remove` | `(e, t)` |  |  | 2573 | { (0, p.sE)(e, t) } |
| `getAll` | `e` | y |  | 2578 |  e.store.projectiles |
| `spawn` | `(e, t, n, r, o)` |  |  | 2579 | (0, p.ZF)(e, t, n, r, o) |

## queue

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `registerHandler` | `(e, t)` |  |  | 3344 | { nt[e] = t } |
| `enqueue` | `(e, t, n={}, r=0, o)` | y |  | 3348 | { const a = e.store.meta.time + Math.max(0, r); e.store.queue \|\| (e.store.queue = []), o && e.store.queue.fi |
| `enqueueInTicks` | `(e, t, n={}, r=0, o)` | y |  | 3360 | { e.store.queue \|\| (e.store.queue = []); const a = (e.store.meta.tick \|\| 0) + Math.max(0, Math.floor(r)) , |
| `enqueueSkipTick` | `(e, t, n={}, r)` |  |  | 3374 | { $t.queue.enqueueInTicks(e, t, n, 1, r) } |
| `removeByKey` | `(e, t)` | y |  | 3378 | { e.store.queue && (e.store.queue = e.store.queue.filter(e => e.key !== t)) } |
| `process` | `e` | y |  | 3382 |  { var t; if ((null === (t = e.environment) \|\| void 0 === t ? void 0 : t.context) === r.bF.Worker) return; i |

## random

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `int` | `(e, t)` |  |  | 3678 | b.A.getRandomIntBetween(e, t) |
| `float` | `(e, t)` |  |  | 3679 | b.A.getRandomFloatBetween(e, t) |

## raycast

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `cast` | `(e, t, n, r, o)` | y |  | 3188 | { const a = i.A.cellSize / 2 , s = Math.ceil(o / a); for (let o = 0; o < s; o++) { const s = o * a , c = t + M |

## reactions

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `registerContact` | `(e, t)` |  |  | 2644 | { (0, Me.Aw)(e, t) } |

## rendering

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `getDrawPos` | `(e, t, n)` |  |  | 3754 | (0, K.By)(e, t, n) |
| `getCellDrawPos` | `(e, t, n)` |  |  | 3756 | (0, K.By)(e, t * i.A.cellSize, n * i.A.cellSize) |
| `getGridMetrics` | `()` |  |  | 3758 | ({ cellSize: i.A.cellSize, snapGridCellSize: i.A.snapGridCellSize }) |
| `getOverlayViewportSize` | `e` | y |  | 3762 |  { var t, n; const r = null !== (n = null === (t = e.session.view) \|\| void 0 === t ? void 0 : t.zoom) && voi |
| `withOverlayContext` | `(e, t)` | y |  | 3771 | { const n = e.session.rendering.overlayContext; n.save(); try { return t(n) } finally { n.restore() } } |
| `stepVideoZoom` | `(e, t)` | y |  | 3781 | { const n = (0, et.RV)(e.session.settings.videoZoom); if (e.store.scene.active !== r.Z5.Game \|\| e.session.wi |
| `register` | `e` |  |  | 3805 |  { (0, ge.f5)(e) } |
| `warmup` | `(e, t, n)` | y |  | 3810 | { const r = new a.dJT(t,n); e.session.rendering.pixi.app.stage.filters = [...e.session.rendering.pixi.app.stag |

## resources

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `collectFluxiteAtCell` | `(e, t, n)` |  |  | 3682 | { (0, y.nY)(e, t, n) } |
| `refresh` | `(e, t)` |  |  | 3687 | { "gold" === t ? (0, c.wq)(e) : (0, H.Aq)(e, r.JU.Resources) } |
| `updateEnergy` | `(e, t, n)` | y |  | 3693 | { var o; (null === (o = e.shared) \|\| void 0 === o ? void 0 : o.energy) ? (Atomics.add(e.shared.energy, 0, t) |

## scene

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `getActive` | `e` | y |  | 4134 |  e.store.scene.active |

## schedule

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `nextTick` | `(e, t)` |  |  | 3338 | { (0, Z.U)(e, t) } |

## shadows

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `refresh` | `(e, t, n)` |  |  | 2414 | { (0, Q.We)(e, t, n) } |
| `refreshRadius` | `(e, t, n, r=8)` | y |  | 2419 | { const o = e.store.world.size.width , a = e.store.world.size.height , i = Math.max(0, Math.floor(r)); for (le |
| `refreshRect` | `(e, t, n, r, o, a=8)` | y |  | 2432 | { const i = e.store.world.size.width , s = e.store.world.size.height , l = Math.max(0, Math.floor(a)) , c = Ma |

## signals

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `register` | `(e, t, n)` | y | yes | 2682 | { ( (e, t, n) => { var r; if ("function" != typeof n) throw new TypeError("Signal target apply callback is req |

## sound

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `play` | `(e, t, n)` | y |  | 1071 | { var r, o, a, i; let s = n \|\| {}; if (s.position) { const {x: t, y: n} = s.position , l = null !== (r = s.b |
| `stop` | `(e, t)` | y |  | 1097 | { (0, ie.wr)(e.session.soundEngine, t) } |
| `stopAll` | `e` | y |  | 1102 |  { (0, ie.i4)(e.session.soundEngine) } |
| `playActive` | `(e, t, n)` | y |  | 1107 | { var r; let o = n \|\| {}; if (o.position) { const {x: t, y: n} = o.position , a = null !== (r = o.baseVolume |
| `stopActive` | `e` | y |  | 1128 |  { (0, ie.t$)(e.session.soundEngine) } |
| `playLayers` | `(e, t, n)` |  |  | 1133 | { var r; if ((null == n ? void 0 : n.rateLimitKey) && (null == n ? void 0 : n.rateLimitMs)) { const e = Date.n |
| `calculateDistanceOptions` | `(e, t, n, r=1)` |  |  | 1156 | (0, se.WS)(e, t, n, r) |

## sprites

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `load` | `(e, t, n, r={})` | y |  | 2583 |  { const {imageAsset: i} = await (0, o.u)("flare", { path: n }); let s = i.image; if (void 0 !== r.tint) { con |
| `get` | `(e, t)` | y |  | 2622 | e.sandkit.graphics[t] |
| `hideAllPlayerModSprites` | `e` | y |  | 2623 |  { Object.values(e.sandkit.graphics).forEach(e => { e.sprites && e.sprites.forEach(e => { e.visible = !1 } ) } |
| `rotatePlayerModSprites` | `(e, t)` | y |  | 2633 | { Object.values(e.sandkit.graphics).forEach(e => { e.sprites && e.sprites.forEach(e => { e.rotation = t } ) }  |

## storage

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `ensure` | `(e, t)` | y |  | 3904 | (e.store.mods \|\| (e.store.mods = {}), e.store.mods[t] \|\| (e.store.mods[t] = {}), e.store.mods[t]) |
| `get` | `(e, t, n)` |  |  | 3907 | $t.storage.ensure(e, t)[n] |
| `set` | `(e, t, n, r)` |  |  | 3908 | { $t.storage.ensure(e, t)[n] = r } |
| `remove` | `(e, t, n)` |  |  | 3912 | { delete $t.storage.ensure(e, t)[n] } |
| `get` | `e` |  |  | 3917 |  { const t = localStorage.getItem(e); if (null === t) return null; try { return JSON.parse(t) } catch (e) { re |
| `set` | `(e, t)` |  |  | 3928 | { localStorage.setItem(e, JSON.stringify(t)) } |
| `remove` | `e` |  |  | 3932 |  { localStorage.removeItem(e) } |

## structures

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `getWeightedRecipe` | `(e, t, n)` |  |  | 2705 | (0, Me.us)(t, n) |
| `selectWeightedOutput` | `(e, t)` |  |  | 2707 | (0, Me.p1)(e, t) |
| `register` | `(e, t, n)` |  |  | 2709 | { Ke(e, t, n) } |
| `isEnabledAt` | `(e, t, n)` |  |  | 2714 | (0, E.isProcessingEnabledAt)(t, n) |
| `setEnabledAt` | `(e, t, n, o)` |  | yes | 2716 | { var a; if ((null === (a = e.environment) \|\| void 0 === a ? void 0 : a.context) === r.bF.Worker) throw new  |
| `register` | `(e, t, n)` | y | yes | 2724 | { if (!n \|\| void 0 === A.VI[n.structureType] && void 0 === e.sandkit.mods.structures[n.structureType]) throw |
| `addProcessor` | `(e, t, n)` |  |  | 2734 | { const r = Xe(e, String(t), { structureType: t, intervalMs: n.intervalMs, process: n.process }).periodic; $t. |
| `register` | `(e, t, n)` | y |  | 2746 | { var o; ot(t.buildModes); const a = t.id , i = t.draw; xt(t, "structures", a), void 0 !== t.defaultData && (t |
| `updateDefinition` | `(e, t, n, o)` | y |  | 2772 | { const a = A.VI[t]; if (!a) return; ot(n.buildModes); const i = Object.assign({}, n); delete i.blockGridType, |
| `getAtCell` | `(e, t, n)` |  |  | 2799 | (0, p.TR)(e, t, n) |
| `forEachOfType` | `(e, t, n)` | y |  | 2801 | { const r = "string" == typeof t ? $t.structures.resolveTypeName(t) : t , o = e.store.structures; if (o) { for |
| `registerPlacementConfig` | `(e, t)` |  |  | 2822 | { (0, N.X1)(e, t), (0, H.Aq)(e, r.JU.HotbarOverlays) } |
| `isType` | `(e, t)` |  |  | 2829 | { if (!e) return !1; const n = $t.structures.resolveTypeName(t); return e.type === n } |
| `resolveTypeName` | `e` |  |  | 2836 |  { if ("string" != typeof e) return e; let t = wt.get(e); if (void 0 === t) { const n = kt[e.toLowerCase()]; t |
| `hasBuiltAtCell` | `(e, t, n)` |  |  | 2848 | 0 !== (0, E.getBlockTypeAtPos)(t, n) && 1 != (3 & (0, E.getBlockAccess)((0, E.getTileIndex)(t, n))) |
| `isTypeAt` | `(e, t, n, r)` |  |  | 2852 | { const o = (0, E.getBlockTypeAtPos)(t, n); if (0 === o) return !1; const a = (0, E.getTypeFromIndex)(o); retu |
| `update` | `(e, t, n)` |  |  | 2862 | { var o, a, i; if ((null === (o = e.environment) \|\| void 0 === o ? void 0 : o.context) === r.bF.Worker) retu |
| `updateMany` | `(e, t, n)` |  |  | 2875 | { var o, a; (0, E.beginBatchWrite)(); try { for (let n = 0; n < t.length; n++) (0, p.V6)(e, t[n]) } finally {  |
| `setData` | `(e, t, n, r)` |  |  | 2890 | { t.data = Object.assign(Object.assign({}, t.data \|\| {}), n), $t.structures.update(e, t, r) } |
| `setSpritesheetIndex` | `(e, t, n)` |  |  | 2895 | { var r; const o = Math.max(0, Math.floor(n)); (null === (r = t.data) \|\| void 0 === r ? void 0 : r.spriteInd |
| `setSpritesheetIndexAt` | `(e, t, n, r)` |  |  | 2902 | { const o = (0, p.TR)(e, t, n); o && $t.structures.setSpritesheetIndex(e, o, r) } |
| `mapValueToSpritesheetIndex` | `(e, t)` |  |  | 2908 | { if (!t \|\| 0 === t.length) return 0; let n = 0; for (let r = 0; r < t.length && e >= t[r]; r++) n = r; retu |
| `setSpritesheetIndexByValue` | `(e, t, n, r)` |  |  | 2917 | { const o = $t.structures.mapValueToSpritesheetIndex(n, r); $t.structures.setSpritesheetIndex(e, t, o) } |
| `setSpritesheetIndexByValueAt` | `(e, t, n, r, o)` |  |  | 2922 | { const a = (0, p.TR)(e, t, n); a && $t.structures.setSpritesheetIndexByValue(e, a, r, o) } |
| `build` | `(e, t, n, r)` |  |  | 2928 | (0, A.k1)(e, t, Object.assign({ structureType: n }, r)) |
| `removeAt` | `(e, t, n, r)` |  |  | 2932 | { (0, A.QT)(e, { x: t, y: n }, r \|\| {}) } |
| `removeBetween` | `(e, t, n, r)` |  |  | 2940 | { (0, M.Cj)(e, t, n, r \|\| {}) } |
| `removeAtPositions` | `(e, t, n)` |  |  | 2945 | { (0, M.Wf)(e, t, n \|\| {}) } |
| `beginBatchWrite` | `()` |  |  | 2950 | { (0, E.beginBatchWrite)() } |
| `endBatchWrite` | `()` |  |  | 2955 | { (0, E.endBatchWrite)() } |
| `isBlockedByPlayer` | `(e, t, n)` | y |  | 2960 | { const r = e.store.player , o = t * i.A.cellSize , a = n * i.A.cellSize , s = i.A.snapGridCellSize * i.A.cell |
| `getConfig` | `e` |  |  | 2968 |  A.VI[e] |
| `getUnlockedTypes` | `e` |  |  | 2969 |  (0, A.BM)(e) |
| `isUnlocked` | `(e, t)` |  |  | 2971 | (0, A.BM)(e).has(t) |
| `addVariant` | `(e, t, n, r)` |  |  | 2973 | { var o, a; const i = A.VI[t]; i && ((null == r ? void 0 : r.addBuildMode) && rt(r.addBuildMode), i.variants = |
| `isLauncherAt` | `(e, t, n)` | y |  | 2981 | { var o; const a = Math.floor(t / i.A.snapGridCellSize) * i.A.snapGridCellSize , s = Math.floor(n / i.A.snapGr |

## tech

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `getDefinition` | `e` |  |  | 3735 |  (0, xe.getTechDefinition)(e) |
| `updateDefinition` | `(e, t)` |  |  | 3737 | (0, xe.updateTechDefinition)(e, t) |
| `addDefinition` | `(e, t)` |  |  | 3739 | (0, xe.addTechDefinition)(e, t) |
| `appendUnlock` | `(e, t, n)` |  |  | 3742 | (0, xe.appendConservatoryUnlock)(e, t, n) |
| `registerNode` | `(e, t, n)` |  |  | 3745 | (0, xe.registerTechNode)(e, t, n) |
| `isResearched` | `(e, t)` | y |  | 3747 | !!e.store.player.tech[t] |
| `isLocked` | `(e, t)` |  |  | 3748 | (0, xe.isTechLocked)(e, t) |
| `setLocked` | `(e, t, n)` |  |  | 3750 | (0, xe.setTechLocked)(e, t, n) |

## teleportZones

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `add` | — |  |  | 4363 | re-export → `Ue.Oy` |
| `remove` | — |  |  | 4364 | re-export → `Ue.SI` |
| `getAll` | — |  |  | 4365 | re-export → `Ue.Ww` |
| `getById` | — |  |  | 4366 | re-export → `Ue.in` |
| `getAtCell` | — |  |  | 4367 | re-export → `Ue.Hs` |
| `spawnDefaultParticles` | — |  |  | 4368 | re-export → `Ue.mZ` |
| `teleportPlayerTo` | `(e, t, n, r)` | y |  | 4369 | { var o; const a = e.store.player , s = r \|\| {} , l = a.x , c = a.y , d = t * i.A.cellSize , u = n * i.A.cel |

## terrains

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `getConfig` | `e` |  |  | 1932 |  O.l2[e] |
| `getIdByType` | `(e, t)` | y |  | 1933 | { var n; return lt \|\| (lt = (e => { var t, n, o; const a = new Map , i = Object.keys(r.vZ); for (let e = 0;  |
| `register` | `(e, t)` | y | yes | 1957 | { var n, o; const a = (e => { var t, n; const o = Object.values(r.vZ).filter(e => "number" == typeof e) , a =  |
| `updateDefinition` | `(e, t, n)` | y |  | 2005 | { var r, o; let a, i; if ("string" == typeof t) { if (i = e.sandkit.mods.terrains[t], !i) return; a = i.cellTy |
| `createAt` | `(e, t, n, r, o)` |  |  | 2023 | { const a = "string" == typeof r ? $t.world.getCellTypeByName(e, r) : r , i = l.on.getCellIdFromTerrainType(a) |
| `replaceAt` | `(e, t, n, r, o)` | y |  | 2030 | { const a = e.shared.sim , i = l.on.getCellId(a, t, n); if (l.on.isCellIdElement(i) \|\| l.on.isCellIdDamagedT |
| `removeAt` | `(e, t, n, o)` | y |  | 2047 | { const a = e.shared.sim , i = l.on.getCellId(a, t, n); l.on.isCellIdDamagedTerrain(i) && (0, l.hR)(a, i), (0, |
| `getGroundCellTypeAtPos` | `(e, t, n)` |  |  | 2056 | (0, g.BQ)(e, t, n) |
| `damageTerrain` | `(e, t, n, o)` |  |  | 2058 | { var a; if ((null === (a = e.environment) \|\| void 0 === a ? void 0 : a.context) === r.bF.Worker) return voi |
| `isPosTerrainId` | `(e, t, n, r)` | y |  | 2079 | { const o = l.on.getCellId(e.shared.sim, t, n) , a = $t.world.getCellTypeByName(e, r); return l.on.getTerrainT |
| `getTerrainData` | `(e, t, n)` | y |  | 2085 | { var r; const o = l.on.getCellId(e.shared.sim, t, n); if (l.on.isCellIdUndamagedTerrain(o)) { const e = l.on. |
| `setTerrainHP` | `(e, t, n, o)` | y |  | 2106 | { const a = l.on.getCellId(e.shared.sim, t, n); if (l.on.isCellIdUndamagedTerrain(a)) { const i = l.on.getUnda |
| `isPosTerrain` | `(e, t, n)` | y |  | 2155 | { const r = l.on.getCellId(e.shared.sim, t, n); return l.on.isCellIdAnyTerrain(r) } |
| `isTerrain` | `e` |  |  | 2160 |  l.on.isCellIdAnyTerrain(e) |
| `transform` | `(e, t, n, o)` | y |  | 2161 | { var a, s, l; const c = i.A.cellSize , d = e.store.world.size.width , u = e.store.world.size.height; if ("ima |

## tools

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `setGrabberSize` | `(e, t)` | y | yes | 4310 | { var n; const o = Math.sqrt(t); if (!Number.isInteger(o) \|\| o < 1) throw new Error(`Grabber size must be a  |
| `getGrabberSize` | `e` |  |  | 4356 |  (0, J.fG)(e) |
| `isGrabberActive` | `e` |  |  | 4358 |  $t.items.isActive(e, r.Np.Grabber, r.SP.Tool) |
| `isGrabberLoaded` | — |  |  | 4359 | re-export → `J.Tz` |
| `blockSwitchIfGrabberLoaded` | — |  |  | 4360 | re-export → `J.L5` |

## triggers

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `register` | `(e, t, n)` | y |  | 3665 | { e.sandkit.mods.triggers[t] = Object.assign({}, n), e.session.triggers.find(e => e.id === t) \|\| e.session.t |

## ui

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `update` | `(e, t, n)` |  |  | 3405 | { (0, H.Aq)(e, t, n) } |
| `openPauseMenu` | `e` | y |  | 3410 |  { e.session.windows.menu.open = !0, (0, H.Aq)(e, r.JU.Menu), (0, de.v)(e), (0, ie.v0)(e) } |
| `showTooltip` | `(e, t)` |  |  | 3420 | { (0, V.DK)(e, t) } |
| `toast` | `(e, t, n)` |  |  | 3425 | { var o; (null === (o = e.environment) \|\| void 0 === o ? void 0 : o.context) !== r.bF.Worker ? (0, $.o)(e, t |
| `alert` | `(e, t, n)` | y |  | 3431 | new Promise(o => { e.session.ui.dialogs \|\| (e.session.ui.dialogs = []), e.session.ui.dialogs.push({ id: Math |
| `confirm` | `(e, t, n)` | y |  | 3444 | new Promise(o => { e.session.ui.dialogs \|\| (e.session.ui.dialogs = []), e.session.ui.dialogs.push({ id: Math |
| `prompt` | `(e, t, n, o, a, i)` | y |  | 3457 | new Promise(s => { e.session.ui.dialogs \|\| (e.session.ui.dialogs = []), e.session.ui.dialogs.push({ id: Math |
| `select` | `(e, t, n)` | y |  | 3473 | new Promise(o => { e.session.ui.dialogs \|\| (e.session.ui.dialogs = []), e.session.ui.dialogs.push({ id: Math |
| `mount` | `(e, t, n, r)` |  |  | 3490 | (0, G.e6)(e, t, n, r) |
| `setVisible` | `(e, t, n)` |  |  | 3492 | (0, G.pi)(e, t, n) |
| `ActionSlot` | — |  |  | 3496 | re-export → `q.yr` |
| `Panel` | — |  |  | 3497 | re-export → `q.c9` |
| `Button` | — |  |  | 3498 | re-export → `q.Mb` |
| `useRefresh` | `(e, t)` |  |  | 3500 | q.rX.useRefresh(e, t) |
| `useScale` | `e` |  |  | 3501 |  q.rX.useUiScale(e) |
| `useGameEvent` | `(e, t, n)` |  |  | 3502 | q.rX.useGameEvent(e, t, n) |
| `register` | `(e, t, n)` |  |  | 3504 | (0, W.nX)(e, t, n) |
| `createBankSource` | — |  |  | 3508 | re-export → `q.wh.createBankSource` |
| `selectAction` | — |  |  | 3509 | re-export → `q.wh.selectAction` |
| `getBankCount` | — |  |  | 3510 | re-export → `q.wh.getBankCount` |
| `getActiveBankIndex` | — |  |  | 3511 | re-export → `q.wh.getActiveBankIndex` |
| `getActiveSlotIndex` | — |  |  | 3512 | re-export → `q.wh.getActiveSlotIndex` |
| `getSlotKeyLabel` | — |  |  | 3513 | re-export → `q.wh.getSlotKeyLabel` |
| `useHotbar` | — |  |  | 3514 | re-export → `q.rX.useHotbar` |
| `register` | `(e, t, n, r)` |  | yes | 3517 | { if ("hotbar" !== t && "global" !== t) throw new Error(`Unknown UI overlay slot "${t}".`); let o = ft.get(e); |
| `unregister` | `(e, t, n)` |  |  | 3534 | { var r; const o = ft.get(e); if (!o) return; const a = `${t}\0${n}`; null === (r = o.get(a)) \|\| void 0 ===  |
| `update` | `(e, t)` |  |  | 3545 | { "hotbar" === t && (0, H.Aq)(e, r.JU.HotbarOverlays), "global" === t && (0, H.Aq)(e, r.JU.GlobalOverlays) } |

## upgrades

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `registerCategory` | `(e, t)` | y | yes | 4228 | { if (!t.id \|\| !t.name && !t.nameKey) throw new Error("Upgrade category requires an id and localized name.") |
| `register` | `(e, t)` | y |  | 4242 | { e.sandkit.mods.upgrading \|\| (e.sandkit.mods.upgrading = {}), e.sandkit.mods.upgrading[t.itemId] \|\| (e.sa |
| `updateDefinition` | `(e, t, n, r)` | y |  | 4262 | { var o, a, i, s, l, c; let d = null; for (const e of R.QR) for (const r of e.items) if (r.id === t) for (cons |
| `setLevel` | `(e, t, n, o)` | y |  | 4282 | { var a, i; const s = null === (i = null === (a = e.store.upgrades) \|\| void 0 === a ? void 0 : a[t]) \|\| vo |
| `getLevel` | `(e, t, n)` | y |  | 4299 | { var r, o, a; return (null === (a = null === (o = null === (r = e.store.upgrades) \|\| void 0 === r ? void 0  |
| `getAvailableLevel` | `(e, t, n)` | y |  | 4304 | { var r, o, a; return (null === (a = null === (o = null === (r = e.store.upgrades) \|\| void 0 === r ? void 0  |

## utils

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `getDistance` | — |  |  | 1049 | re-export → `b.A.getDistance` |
| `getDirection` | — |  |  | 1050 | re-export → `b.A.getDirection` |
| `getAngle` | — |  |  | 1051 | re-export → `b.A.getAngle` |
| `getCoordinatesBetweenPoints` | — |  |  | 1052 | re-export → `b.A.getCoordinatesBetweenPoints` |
| `getRandomIntBetween` | — |  |  | 1053 | re-export → `b.A.getRandomIntBetween` |
| `getRandomFloatBetween` | — |  |  | 1054 | re-export → `b.A.getRandomFloatBetween` |

## wall

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `getPaletteData` | `e` | y |  | 2397 |  e.shared.wallData.paletteData |
| `getWallDataAt` | `(e, t, n)` | y |  | 2398 | { const r = e.shared.wallData; return t < 0 \|\| t >= r.width \|\| n < 0 \|\| n >= r.height ? 0 : r.data[t + n |
| `setWallDataAt` | `(e, t, n, r)` | y |  | 2403 | { const o = e.shared.wallData; t < 0 \|\| t >= o.width \|\| n < 0 \|\| n >= o.height \|\| (o.data[t + n * o.wi |
| `getWallDataSize` | `e` | y |  | 2408 |  ({ width: e.shared.wallData.width, height: e.shared.wallData.height }) |

## workerLocal

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `getOrInit` | `(e, t, n)` | y |  | 1172 | { var o; if ((null === (o = e.environment) \|\| void 0 === o ? void 0 : o.context) !== r.bF.Worker) return n;  |
| `set` | `(e, t, n)` | y |  | 1182 | { var o; if ((null === (o = e.environment) \|\| void 0 === o ? void 0 : o.context) !== r.bF.Worker) return; co |
| `get` | `(e, t)` | y |  | 1191 | { var n; if ((null === (n = e.environment) \|\| void 0 === n ? void 0 : n.context) === r.bF.Worker) return e.s |
| `clear` | `(e, t)` | y |  | 1197 | { var n; if ((null === (n = e.environment) \|\| void 0 === n ? void 0 : n.context) !== r.bF.Worker) return; co |

## workers

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `on` | — |  |  | 3587 | re-export → `T._B.on` |
| `emit` | — |  |  | 3588 | re-export → `T._B.emit` |
| `intercept` | — |  |  | 3591 | re-export → `T.Hh.intercept` |
| `modify` | — |  |  | 3592 | re-export → `T.Hh.modify` |
| `emitToMain` | — |  |  | 3594 | re-export → `T.QL` |
| `getIdByName` | `e` |  | yes | 3596 |  (e => { const t = j[e]; if (void 0 === t) throw new Error(`Unknown WorkerMessageId name: "${e}"`); return t } |
| `postToEachThreadColumnSequentiallyAwait` | `(e, t, n)` |  |  | 3603 | { var r, o; const a = null === (o = null === (r = e.environment) \|\| void 0 === r ? void 0 : r.multithreading |
| `register` | `(e, t, n)` |  |  | 3610 | { var o, a, i; const s = n.callback.toString(); (null === (i = null === (a = null === (o = e.environment) \|\| |
| `create` | `(e, t, n)` | y | yes | 3622 | { var o, a, i, s, l, c, d; const u = { uint8: Uint8Array, uint16: Uint16Array, uint32: Uint32Array, int8: Int8 |
| `get` | `(e, t)` | y |  | 3658 | { var n, r; return null === (r = null === (n = e.shared) \|\| void 0 === n ? void 0 : n.mods) \|\| void 0 ===  |

## world

| method | params | ctx | throws | line | notes |
|---|---|---|---|---|---|
| `getDimensions` | `e` | y |  | 1780 |  ({ widthCells: e.store.world.size.width, heightCells: e.store.world.size.height }) |
| `isCellEmpty` | `(e, t, n)` | y |  | 1784 | l.on.isCellEmpty(e.shared.sim, t, n) |
| `isTerrainAt` | `(e, t, n)` | y |  | 1785 | l.on.isCellTerrain(e.shared.sim, t, n) |
| `runWhenSimulationIdle` | `(e, t)` |  |  | 1786 | { (0, v.f6)(t) } |
| `runAfterMutations` | `(e, t)` |  |  | 1791 | { (0, v.a6)(t) } |
| `getCellTypeByName` | `(e, t)` | y | yes | 1796 | { var n, o, a, i; dt \|\| (dt = ( () => { const e = new Map; return Object.keys(r.vZ).forEach(t => { isNaN(Num |
| `getCellId` | `(e, t, n)` | y |  | 1816 | l.on.getCellId(e.shared.sim, t, n) |
| `setCellId` | `(e, t, n, r)` |  |  | 1817 | { (0, g.Gz)(e, t, n, r) } |
| `reportActivityToChunk` | `(e, t, n)` | y |  | 1822 | { l.on.reportToChunkAtCellPos(e.shared.sim, t, n) } |
| `excavate` | `(e, t, n, o, a, i)` |  |  | 1826 | { var s; if ((null === (s = e.environment) \|\| void 0 === s ? void 0 : s.context) === r.bF.Worker) return voi |
| `revealFogAtCell` | `(e, t, n)` | y |  | 1841 | { var o; if ((null === (o = e.environment) \|\| void 0 === o ? void 0 : o.context) === r.bF.Worker) { const r  |
| `redrawSurroundingCells` | `(e, t, n, r)` |  |  | 1859 | { (0, y.zT)(e, t, n, r) } |
| `createLightSource` | `(e, t, n, r={})` | y |  | 1864 | { const {brightness: o=1, size: a=300, color: i=[1, 1, 1, 1], proximityFade: s, unclamped: l=!1, colorAnimatio |
| `removeLightSourcesAt` | `(e, t, n)` |  |  | 1883 | { (0, ue.se)(e, t, n) } |
| `markLightsDirty` | `()` |  |  | 1888 | { (0, ue.V9)() } |
| `fadeLightSourceAt` | `(e, t, n, r=1500)` | y |  | 1893 | { let o = !1; for (const a of e.store.world.lights) a.x === t && a.y === n && (a.fadeStartMs = e.store.meta.ti |
| `spawn` | `(e, t, n, r, o, a)` |  |  | 1904 | (0, m.zO)(e, t, n, r, o, a) |
| `destroy` | `(e, t)` |  |  | 1906 | { (0, m.oD)(e, t) } |
| `pickUp` | `(e, t)` |  |  | 1911 | (0, m.c$)(e, t) |
| `getAll` | `e` | y |  | 1913 |  e.store.worldItems |
| `getById` | `(e, t)` | y |  | 1914 | e.store.worldItems.find(e => e.id === t) |
