# `tooltipHover` — the structure's hover tooltip (full schema`

`tooltipHover` is an optional field on a `structures.register` definition. It
**does not replace** the regular name/description tooltip — it is an *extra*
hover-only gizmo that can show your structure's live data (energy, temp,
signals…) as a richer tooltip. It's read by the engine every frame the cursor
hovers a structure.

> Verified against the bundle: the structure defs at **3096, 113748,
> 127392, 127592, 127947, 131464-131548, 134166**; the custom tooltip
> renderer at **42209-42265**; the hover detector at **56427 / 57483**.
> `TooltipData` types in `sandkit` (`ui.d.ts:278-287`).

---

## 1. When it runs

On every hover the engine probes the structure under the cursor, and if its
definition has `tooltipHover` it calls the renderer (bundle 56427 / 57483):

```ts
const C = def.tooltipHover;
if (S && "custom" === C.type) (0, f.rw)(e, S, C);   // -> render tooltip
```

Only `type: "custom"` goes through this renderer. Other `type` values
(like the Filter's `"filter"`) are discriminated by their **own** subsystems
(see §5) and won't reach this code path.

The renderer produces a **tooltip data object** (a message / icon+value) that
the host shows near the cursor — like the vanilla `descriptionKey` tooltip,
but **dynamic** (live data substituted each hover tick).

---

## 2. The full `tooltipHover` object — top level

| Field | Type | Meaning |
|---|---|---|
| `type` | `"custom"` \| `"filter"` | discriminates which renderer branch (only `"custom"` uses §3-§4; `"filter"` is vanilla‑reserved, §5). |
| `showForItemIds` | `string[]` | **optional gate**: only render when the **active held item id** is in this list (e.g. show the thermal readout only while holding Flamethrower/Cryoblaster — 113750). Vanilla confirms `type:"custom"` + this gate (57483-57486). |
| `dataFieldMessage` | object | live **message** with a template + substituted data fields (§3). |
| `dataFieldIconValue` | object | icon + a live number (§4). |
| `messageKey` / `message` / `messageParams` | string / object | a static i18n message (no live fields — plain tooltip-too, 42255-42261). |
| `getTooltipData` | `fn (state, structure) => TooltipData` | **escape hatch**: return any tooltip data object you like, computed from the structure's live state (42262-42264). |
| `opts`/other custom fields | – | ignored by the built‑in renderer; use `getTooltipData` to emit your own shapes instead. |

The renderer checks these **in order** (its priority, 42211-42264):

1. `dataFieldMessage` → `{ type: "message", text }` (§3)
2. `dataFieldIconValue` → `{ type: "iconValue", iconPath, value }` (§4)
3. `messageKey`/`message` (+ `messageParams`) → `{ type: "message", text }`
4. `getTooltipData(...)` or → your own tooltip data

If none match / the getter returns falsy** → no tooltip (the default description tooltip is shown).

---

## 3. `dataFieldMessage` — message with live data fields**

```ts
dataFieldMessage: {
  messageKey: "mods|energyStorage|tooltip",      // or `message:` literal text
  fields: [
    { param: "current", field: "storedEnergy", round: true, fallback: 0 },
    { param: "max",    field: "maxEnergy",    fallback: 200 },
  ],
}
```

| Field | Type | Meaning |
|---|---|---|
| `messageKey` | `string` | i18n key whose value contains `{param}` placeholders |
| `message` | `string` | direct text fallback (used when no `messageKey`) |
| `fields` | `array` | **the live-data substitutions** |
| `fields[].param` | `string` | the placeholder name substituted into the message (`{current}` → value) |
| `fields[].field` | `string` | which `structure.data[field]` to read |
| `fields[].round` | `boolean` | round the numeric value (`Math.round` ) |
| `fields[].fallback` | `any` | used if `data[field]` is undefined (default 0) |
| `fields[].valueKeys` | `Record<string, any>` | optional **enum→label** key remap (42218) |
| `fields[].valueLabels` | `Record<string, any>` | optional label remap — together `valueKeys`/`valueLabels` turn raw ids into localized labels (42220-42223) |

The renderer collects each field into `{ param: resolvedValue }` and passes it
as substitution params to the message (42211-42236). You can also use a **single**
field form without the `fields` array: `{ messageKey, field, param?:, round?: }`
(42228-42235).

---

## 4. `dataFieldIconValue` — icon + live number

```ts
dataFieldIconValue: {
  field: "temperature",
  iconPath: "mods/thermal_icon.png",
  round: true,
}
→ produces `{ type: "iconValue", iconPath: "mods/thermal_icon.png", value: 640 }`
```

| Field | Type | Meaning |
|---|---|---|
| `field` | `string` | which `structure.data[field]` to read |
| `iconPath` | `string` | asset path to the icon shown next to the number |
| `round` | `boolean` | round the value (`Math.round` ) |

Vanilla uses exactly this for the Thermal Relay (113748-113755). It renders as a
small **icon + number** readout tied to the frame tick (re-evaluated each hover).

---

## 5. `type: "filter"` — the vanilla Filter special case

Some built-in structures carry `tooltipHover: { type: "filter" }`
(FilterRight/FilterLeft/Shaker/etc, e.g. 3096-3103, 131465-134167). That type is
**not** fed to the custom renderer (§1) — it is reserved so the Filter's **own**
config hover (the filter-settings box) is enabled when you hover a Filter while
holding the trowel/filter-items. It's a discriminator, **not** a message schema;
you can't add text/colour to it.

---

## 6. Can you put a `ui`, change the color, or show arbitrary React? — no

`tooltipHover`'s custom branch is **data-driven only**. The renderer returns one
of the fixed tooltip data shapes the host can draw:

| shape | produced by |
|---|---|
| `{ type: "message", text }` | `dataFieldMessage`, `messageKey/message` |
| `{ type: "iconValue", iconPath, value }` | `dataFieldIconValue` |
| *(any other)* | your `getTooltipData(state, structure)` |

`TooltipData` in `sandkit` only models message tooltips (see `ui.d.ts:281-287`);
the renderer builds the two shapes above. There is **no colour/background/style
field** in the schema — styling is owned by the host tooltip component. If you
need a fully custom panel (buttons, coloured swatches, live charts), that's out
of scope for `tooltipHover`:

- use **`getTooltipData`** only for small data-driven readouts the host can draw;
- use an **overlay / region mount** (see `docs_tech/10-ui-overlays.md`) for a
  full custom UI, positioning it where you want, and show/hide it on hover or
  click via `structures.getAtCell` + `frame:render`/`action:changed`.

Bottom line — *`tooltipHover` = dynamic data readout*; *overlay = arbitrary UI*.

---

## 7. Complete working example (message with live data)

```ts
sandkit.api.structures.register({
  id: "myMod:energyCore",
  ...
  defaultData: { storedEnergy: 0, maxEnergy: 500 },
  tooltipHover: {
    type: "custom",
    dataFieldMessage: {
      messageKey: "mods|myMod|energyTooltip",   // "{current} / {max} ⚡"
      fields: [
        { param: "current", field: "storedEnergy", round: true, fallback: 0 },
        { param: "max",    field: "maxEnergy",   round: true, fallback: 500 },
      ],
    },
  },
});
// i18n:
// sandkit.api.i18n.register("en", { "mods|myMod|energyTooltip": "{current} / {max}" });
```

Icon+value variant, gated to a held item:

```ts
tooltipHover: {
  type: "custom",
  showForItemIds: ["myMod:reader"],
  dataFieldIconValue: { field: "storedEnergy", iconPath: "mods/energy_icon.png", round: true },
}
```

Arbitrary tooltip data via the escape hatch:

```ts
tooltipHover: {
  type: "custom",
  getTooltipData(state, structure) {
    return { type: "iconValue", iconPath: "mods/heat.png", value: structure.data.temp * 2 };
  },
}
```