/**
 * The **terrain** object definition.
 *
 * A terrain is a diggable tile: it has hit points, a colour, and a drop. It is
 * the only object with *two* ways to state a colour — a packed `0xRRGGBB` and an
 * HSL triple — so the form has to model the choice between them explicitly with
 * a toggle, rather than guessing from which value is present. That toggle is
 * why the HSL controls are three separate numbers here and one `[h, s, l]` array
 * on the entry.
 *
 * There is no custom widget: the HSL controls, the tool list and the drop picker
 * are all generic. Recorded explicitly so "no widget" reads as a decision.
 *
 * Ground truth: `doc/doc-tech/06-registering-terrains.md`.
 */
import { listElements, listItems, listMaterialIds } from "../../../catalog.ts";
import { advField, boolField, idField, NAME_MAX, numField, textField } from "../fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";
import { HEX, hexToPacked, packedToHex, parseIdList } from "../values.ts";

// ── The schema ───────────────────────────────────────────────────────────────

/** The three HSL controls only exist while the toggle is on. */
const hslOn = (f: Record<string, string>) => f.colorHSLOn === "true";

const FIELDS: FieldSpec[] = [
    idField(),
    textField("name", "Name", "Identity", true, { maxLength: NAME_MAX }),
    textField("nameKey", "Name key (i18n)", "Identity", false, {
        placeholder: "mods|example|terrain|name",
        maxLength: 120,
    }),
    // engine type: [number, number, number] — H, S, L
    numField("colorHSLHue", "Hue", "Colour", {
        min: 0,
        max: 360,
        step: 1,
        int: true,
        when: hslOn,
    }),
    numField("colorHSLSaturation", "Saturation", "Colour", {
        min: 0,
        max: 1,
        step: 0.01,
        when: hslOn,
    }),
    numField("colorHSLLightness", "Lightness", "Colour", {
        min: 0,
        max: 1,
        step: 0.01,
        when: hslOn,
    }),
    {
        key: "colorHSLOn",
        label: "Set base HSL colour",
        kind: "bool",
        section: "Colour",
        def: "false",
        hint: "overrides the default terrain colour; H 0-360, S and L 0-1",
    },
    {
        key: "excavationRequirements",
        label: "Required tools",
        kind: "multiselect",
        section: "Tile",
        options: listItems,
        emptyHint: "add an Item first — a terrain can only require a tool that exists.",
        hint: "item ids needed to dig this terrain",
    },
    {
        // engine type: readonly { kind: string; [key: string]: unknown }[]
        key: "interactionsJson",
        label: "Tooltip interactions",
        kind: "json",
        section: "Tile",
        jsonType: "array",
        wide: true,
        hint: 'interactions shown for this terrain, e.g. [ { "kind": "…" } ]',
    },
    numField("hp", "Hit points", "Tile", { required: true, min: 1, max: 999999, def: "100" }),
    { key: "metaColor", label: "Colour", kind: "color", section: "Tile" },
    {
        key: "outputElement",
        label: "Drops",
        kind: "select",
        section: "Tile",
        options: listElements,
        hint: "element dropped when mined (empty = nothing)",
    },
    numField("outputChance", "Drop chance", "Tile", {
        min: 0,
        max: 1,
        step: 0.05,
        int: false,
        def: "1",
        when: (f) => f.outputElement !== "",
    }),
    {
        // engine: `const s = t?.materialId; if (void 0 !== s) { … throw }`
        //   must be a number, > i.A.obstacleBreakpoint, and < 150,
        //   and additionally within [obstacleBreakpoint + 1, 149]
        // `obstacleBreakpoint` turned out to be a real constant, 100
        // (`utils-worker.js/90823.js`), so the range is exactly 101–149.
        // Every value in it is an obstacle, so there are no tiers to name —
        // the picker offers the engine's own next-free id instead of
        // inviting a hand-typed collision.
        //
        // Above `flammable` on purpose. It used to sit below it, which put one
        // field on its own after "Flags" and made `sectionsFor` open a second
        // "Tile" box — the panel drew Tile, Flags, Tile for seven fields.
        key: "materialId",
        label: "Material id",
        kind: "select",
        section: "Tile",
        options: listMaterialIds,
        hint:
            "must be 101–149; every value is an obstacle, so the engine's next-free id is the safe pick",
    },
    boolField("flammable", "Flammable", "Flags"),
    // No `fog` field: `fog` is not a documented terrain property. "Water Fog"
    // and "Lava Fog" are *terrain entries*, not a per-terrain boolean, so a
    // foggy-looking terrain must be registered as its own terrain id.
    advField(),
];

// ── Round trip ───────────────────────────────────────────────────────────────

/** Stored entry → form strings, for the whole terrain. */
function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("name", read.str(e.name));
    read.put("nameKey", read.str(e.nameKey));
    // One stored `[h, s, l]` array, three controls plus the toggle. The toggle
    // is derived from the array rather than stored: a terrain either has an HSL
    // colour or it does not, and that is what its presence means. Deriving it
    // means a terrain can never end up with the toggle on and no colour, which
    // would silently paint the tile black.
    const hsl = e.colorHSL as [number, number, number] | undefined;
    if (Array.isArray(hsl) && hsl.length === 3) {
        read.put("colorHSLOn", "true");
        read.put("colorHSLHue", read.num(hsl[0]));
        read.put("colorHSLSaturation", read.num(hsl[1]));
        read.put("colorHSLLightness", read.num(hsl[2]));
    }
    // A list of item ids in a comma-separated form field.
    if (Array.isArray(e.excavationRequirements)) {
        read.put(
            "excavationRequirements",
            (e.excavationRequirements as unknown[]).join(","),
        );
    }
    read.put("interactionsJson", read.json(e.interactions));
    read.put("hp", read.num(e.hp));
    read.put("metaColor", packedToHex(e.metaColor as number | undefined));
    // One stored `output` object, two controls.
    const out = e.output as { elementType?: string | number; chance?: number } | undefined;
    read.put("outputElement", read.str(out?.elementType) ?? read.num(out?.elementType));
    read.put("outputChance", read.num(out?.chance));
    if (typeof e.flammable === "boolean") read.put("flammable", String(e.flammable));
    read.put("materialId", read.num(e.materialId));
}

/** Form strings → stored entry, for the whole terrain. */
function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("name", w.opt("name"));
    w.setStr("nameKey", w.opt("nameKey"));
    // The three HSL controls are only written when the toggle is on, so an
    // empty form cannot emit a 0,0,0 terrain colour.
    if (w.optBool("colorHSLOn")) {
        const h = w.optNum("colorHSLHue");
        const s = w.optNum("colorHSLSaturation");
        const l = w.optNum("colorHSLLightness");
        // All three or none: a partial HSL is a different colour, not a
        // half-specified one, and writing `[200]` would be a 1-tuple where the
        // engine expects 3.
        if (h !== undefined && s !== undefined && l !== undefined) {
            w.setRaw("colorHSL", [h, s, l]);
        }
    }
    const tools = parseIdList(form.excavationRequirements ?? "");
    if (tools.length > 0) w.setRaw("excavationRequirements", tools);
    const interactions = w.optJson<unknown[]>("interactionsJson");
    if (interactions) w.setRaw("interactions", interactions);
    w.setNum("hp", w.optNum("hp"));
    const hex = w.opt("metaColor");
    if (hex && HEX.test(hex)) w.setRaw("metaColor", hexToPacked(hex));
    // The element is what makes the drop real, so a chance without one is not
    // written — an `{ chance }` with no element is a drop of nothing, and it
    // would read in the editor as a drop rate the tile does not have.
    const outEl = w.opt("outputElement");
    if (outEl) {
        w.setRaw("output", { elementType: outEl, chance: w.optNum("outputChance") ?? 1 });
    }
    w.setBool("flammable", w.optBool("flammable"));
    w.setNum("materialId", w.optNum("materialId"));
}

// ── The definition ───────────────────────────────────────────────────────────

/**
 * Stored keys this form owns.
 *
 * `colorHSL`, `output` and `excavationRequirements` are listed under the keys
 * the engine reads them by, not the control names `colorHSLOn` +
 * `colorHSLHue`/`Saturation`/`Lightness`, `outputElement` + `outputChance`, or
 * the comma-separated `excavationRequirements` string. Those are ways of
 * writing them; claiming them as well would leave the real keys falling through
 * the passthrough as duplicates.
 *
 * `fog` was listed here once, claiming the form owns a field it has no control
 * for. Phase 8 found the only `.fog` in the bundle is a property of the *cell-type
 * table*, not of a terrain definition. Leaving it out means an existing stored
 * `fog` round-trips through the passthrough untouched instead of being claimed
 * and then dropped.
 */
const FORM_COVERED = [
    "name",
    "nameKey",
    "hp",
    "metaColor",
    "output",
    "flammable",
    "materialId",
    "colorHSL",
    "excavationRequirements",
    "interactions",
];

export const terrainDefinition: Definition = {
    tab: "terrains",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    // No `validate`: the HSL controls are gated by the toggle rather than by a
    // rule, and each one's own `min`/`max` is a per-field constraint the generic
    // validator already applies. Nothing here needs two fields at once.
    //
    // No `panel`, and that is a decision rather than a gap: every terrain
    // control is a text box, number box, colour well or dropdown, so the generic
    // renderer is the right one.
};
