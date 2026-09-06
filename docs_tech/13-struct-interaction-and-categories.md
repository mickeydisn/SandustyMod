# Struct questions — `categoryKey` and interacting with a placed structure

Two FAQ answers from the `structures.register` docs (`09-structures-register.md`
and `10-ui-overlays.md`), drilled down and verified against the bundle.

> Verified at `__bundel/bundel.js`: category resolution **151301-151321** (`HR`
> / `BR` / the known-categories set), the build-window group-by at **151643**,
> structure click routing via the `action:start` / `action:intercept` hook
> (**63314-63334**), hover highlight **63461-63480**, live read APIs
> **52594-52615**, and the `interactable:suppressHover` hook.

---

## PART A — `categoryKey: "blocks"`: do you have to register it?

**No. `categoryKey` is a free-form string — you can put anything there, and it is
used verbatim** (you do **not** have to register/whitelist a category first).

The engine's resolver `HR(categoryKey, category)` (151301-151319):

```ts
HR = (categoryKey, category) => {
  if (categoryKey) return categoryKey;        // <-- used AS-IS, no validation
  if (!category) return "misc";
  // else: derive from a built-in category i18n key or the category enum id
  return category;                            // fallback
}
```

Because `categoryKey` short-circuits at the first line, whatever string you pass
becomes the entry's `categoryKey` untouched.

### Known categories → localized label + built-in order

The engine keeps a fixed list of built-in categories (151299-151300):

```ts
const LR = ["misc","logic","blocks","testBlocks","construction","debug","drones",
  "energy","excavation","logistics","production","tools","transportation",
  "utility","weapons","economy","fluids","thermal","lighting","special"];
const zR = new Set(LR);
```

When a structure's `categoryKey` is in `zR`, the build menu resolves its label
from the built-in i18n (`BR`, 151320-151321):

```ts
BR = cat => zR.has(cat)
  ? i18n(`ui|management|category|${cat}`)   // localized, built-in
  : cat;                                     // raw string fallback
```

So the vanilla ids (`blocks`, `logistics`, `production`, `fluids`, `lighting`,
`logic`, `economy`, `special`, `energy`, `thermal`, `misc`, …) get **localized
labels and the built-in ordering** (the `NR`/`DR` order lists).

### Brand-new category → you can use it, but localize yourself

If you pass `"icons"` (a category not in `LR`), the build menu **still groups by
it** and shows the **raw string `"icons"`** as the label (fallback branch above).
To get a translated label, register i18n **for the same key the resolver uses**,
i.e. `ui|management|category|icons`:

```ts
sandkit.api.i18n.register("en", { "ui|management|category|icons": "Icons" });
```

> The `sandustry-icons` mod **doesn't even set a custom category** — every icon
> uses the built-in `"blocks"` (register.ts). If you want your own tab, the
> pattern is: pick any string, register its `ui|management|category|<key>` i18n,
> and it appears as a real category (ordering defaults to the end/new-tab
> position unless a built-in one special-cases it).

### `hideFromBuildMenu` still applies

Regardless of the category, a structure only *shows* in the menu if it is
**unlocked** and doesn't have `hideFromBuildMenu: true` (151648) — see the lock
recipe in `10-ui-overlays.md` §5.2 for the "one hub row" trick.

---

## PART B — how a player interacts with a placed structure

There are three interaction surfaces, each useful for different things:
**click-to-activate**, **hover tooltip / highlight**, and **signals-style
model wiring**.

### B1. Click → `action:start` (alias `action:intercept`) hook

The canonical "user clicked on a structure in the world" entry point. The engine
routes **every world-left-click** through the `action:start` intercept hook
(bundle 63314-63334; `hooks.d.ts:438-439, 508-510`):

```ts
sandkit.api.hooks.intercept("action:start", (e, payload, cancel) => {
  // payload.cellX / payload.cellY  -> clicked cell (signal mod reads these)
  const structure = sandkit.api.structures.getAtCell(payload.cellX, payload.cellY);
  if (!structure || structure.type !== MY_TYPE) return;   // not ours
  // do your interaction (toggle, open panel, set data…)
  cancel.cancel();                                        // suppress default (dig/build)
}, { /* guard? */ });
```

Key facts:

| Fact | Source |
|---|---|
| Hook is **cancelable** — call `cancel.cancel()` to swallow the default action (dig / build / empty-click). | 63333 `n.cancel()` |
| Payload carries `cellX`/`cellY` at runtime (the typing is loose `action?: {...} & Record`, but the signal mod reads `t.cellX, t.cellY`). | 63328 |
| Read the clicked structure with `api.structures.getAtCell(x, y)` → `{ x, y, type, data }` or null. | 52594 |
| `action:start` is the non-deprecated name; `action:intercept` is its alias. | `hooks.d.ts:508-510` |

> `structures.getAtCell` is the mod-facing way to interrogate a placed structure
> (`sandkit.api.structures.getAtCell(e, x, y)` — 52594). It returns the cell's
> structure with live `data`, which is what you read/mutate in interactions.

### B2. Hover → `tooltipHover` (see 12) + hover highlight

- **Data tooltip**: put `tooltipHover` on the def to show a live message/icon
  readout while the cursor hovers it — full schema in `12-structures-tooltipHover.md`.
- **Hover highlight box**: the engine draws a white outline around structures
  that have a registered **interactable handler** in the signals module, unless
  vetoed by the `interactable:suppressHover` hook (63461-63480):

```ts
sandkit.api.hooks.intercept("interactable:suppressHover", (e, payload, cancel) => {
  if (payload.type === MY_TYPE) cancel.cancel();   // we WANT the box too
});
```

(payload: `{ type, structure }`, 63465-63467.)

### B3. Playable toggle & model wiring — `signals.registerInteractable` + `t.data`

The signals module offers a ready "click to toggle/act" pattern for structures
that keep boolean state in `data` (vanilla uses it for the Signal Switch,
128524-128541):

```ts
sandkit.api.signals.registerInteractable(MY_TYPE, (state, structure) => {
  if (structure.data?.locked) return;
  structure.data = { ...structure.data, defaultOpen: !structure.data?.defaultOpen };
  sandkit.api.signals.setAll({ x: structure.x, y: structure.y }, on);
});
```

Additional signal tools (exposed via the same module, 63275-63285):

| API | purpose |
|---|---|
| `signals.registerInteractable(type, handler)` | click handler for that structure type (wired to the `action:start` hook internally) |
| `signals.registerSenderType / registerReceiverType` | fan-in/out model wiring for your type |
| `signals.set / setAll / getCombinedAt / getOnCountAt` | read/write link state on placed structures |

### B4. React to placement / removal — events

For "what to do when a structure you placed is placed / demolished", subscribe
to the events (used also by the catalogue list, `controller.ts:164-177`):

```ts
sandkit.api.events.on("building:placed",  (p) => { /* p.structure, p.x, p.y   */ });
sandkit.api.events.on("building:removed", (p) => { /* p.structureId, p.x, p.y */ });
sandkit.api.events.on("structures:moved", (p) => { /* p.moved, p.failedToPlace*/ });
```

`events.d.ts:215-237` documents the payload shapes.

### B5. Keyboard around your action

If your interaction is tied to an **active build tool** (like the deco picker),
watch `action:changed` (see `11-action-events-and-picker-without-timer.md`) and
read `api.action.getSelected()` / `getActive()` (`action.d.ts:15-21`) instead of
intercepting raw clicks — that's the layer where "I'm holding structure X" lives.

---

## Quick decision table

| Goal | Use |
|---|---|
| Click on my placed structure → do something | `hooks.intercept("action:start", …)` + `structures.getAtCell` + `cancel()` |
| Show a dynamic readout on hover | `tooltipHover` (doc 12) |
| Draw a hover outline / veto it | `interactable:suppressHover` hook (B2) |
| Simple click-toggle stored in `data` | `signals.registerInteractable` (B3) |
| Know when my structure is placed/dug up | `building:placed` / `building:removed` / `structures:moved` |
| Overlay/panel that stays open while tool active | overlay (`ui.overlays`) driven by `action:changed` (docs 10-11) |