/**
 * The **element** object definition.
 *
 * An element is new simulation matter — a powder, liquid or gas the engine
 * simulates. It is the widest tab in the panel and the one with the most
 * element-only vocabulary: a `[[r,g,b,a], …]` colour-variant list (the engine
 * picks one per cell, so a single flat colour looks synthetic), a packed
 * `0xRRGGBB` minimap colour, and a *randomised* lifetime expressed as two
 * numbers that only mean anything together.
 *
 * All of that is element-only, so all of it lives here — the schema, the swatch
 * editor, the colour codecs, and the save path that re-wraps the form's flat
 * strings back into the engine's nested `{ variants: [...] }` and
 * `{ min, max }` objects.
 *
 * Ground truth: `doc/doc-tech/08-registering-elements.md`.
 */
import { listElements, listMatterTypes, MATTER_NAME_BY_VALUE } from "../../../catalog.ts";
import * as S from "../../styles.ts";
import {
    advField,
    boolField,
    DESC_MAX,
    idField,
    NAME_MAX,
    numField,
    textField,
} from "../fields.ts";
import { HEX, hexToPacked, packedToHex } from "../values.ts";
import type { Definition, EntryReader, EntryWriter, FieldContext, FieldSpec } from "../types.ts";

// ── Colour variants ───────────────────────────────────────────────────────────
// The engine shape is `{ colors: { variants: [[r,g,b,a], …] } }`, confirmed
// against every workshop mod that uses it. Each variant is a tint the engine
// picks at random per cell, which is why shipping mods list four or five.
//
// These conversions are pure so the editor, the round trip and the tests all
// agree on one definition. Alpha is kept, not dropped: the real mods use both
// 255 and 200, and a picker that rounded alpha to opaque would silently change
// how a translucent liquid looks.

/** `[[r,g,b,a], …]` → `["#rrggbbaa", …]`, skipping anything malformed. */
export function variantsToHexList(raw: string | undefined): string[] {
    if (!raw?.trim()) return [];
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return [];
    }
    const arr = Array.isArray(parsed)
        ? parsed
        : (parsed as { variants?: unknown } | null)?.variants;
    if (!Array.isArray(arr)) return [];
    const out: string[] = [];
    for (const row of arr) {
        if (!Array.isArray(row) || row.length < 3) continue;
        const [r, g, b, a] = row as number[];
        const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(Number(n) || 0)));
        const hex = (n: number) => clamp(n).toString(16).padStart(2, "0");
        out.push(`#${hex(r)}${hex(g)}${hex(b)}${hex(a === undefined ? 255 : a)}`);
    }
    return out;
}

/** `["#rrggbbaa", …]` → the `[[r,g,b,a], …]` the engine wants. */
export function hexListToVariants(list: string[]): [number, number, number, number][] {
    return list
        .filter((h) => /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(h))
        .map((h) => {
            const s = h.slice(1);
            return [
                parseInt(s.slice(0, 2), 16),
                parseInt(s.slice(2, 4), 16),
                parseInt(s.slice(4, 6), 16),
                s.length >= 8 ? parseInt(s.slice(6, 8), 16) : 255,
            ];
        });
}

/**
 * The variant that should be offered first.
 *
 * An element with a map colour and no variants is a perfectly good element —
 * the colour is just what every cell gets. So the first swatch is seeded from
 * the map colour rather than left to a default, which means setting `metaColor`
 * alone already looks right and the variants are a refinement on top of it
 * rather than a second thing you have to remember to set.
 */
export function seedVariantFromMapColor(mapColorHex: string | undefined): string {
    return mapColorHex && HEX.test(mapColorHex) ? `${mapColorHex}ff` : "#ccccccff";
}

// ── The schema ───────────────────────────────────────────────────────────────

/** The parent toggles for the two nested objects, as the `when` gates read them. */
const isFlammableOn = (f: Record<string, string>) => f.flammableOn === "true";
const isCollectableOn = (f: Record<string, string>) => f.collectableOn === "true";

/**
 * `flammable`, as the engine actually stores it.
 *
 * This used to be a plain checkbox, and that was wrong in a way nothing
 * reported. The engine's fire pass reads the value like this:
 *
 * ```js
 * p = e => builtin[e]?.flammable || null        // truthiness gate
 * m = (env, x, y, type, s) => {
 *   if ("object" == typeof s) { … }             // ← and a shape gate
 * }
 * ```
 *
 * So `flammable: true` passes the first gate and is then thrown away by the
 * second: the element burns and never leaves a residue, no matter what the
 * config asked for. The field has to hold an **object**.
 *
 * ## The toggle is the object's presence
 *
 * `|| null` means `{}` is truthy, so an empty object *is* flammable — it burns
 * with no residue, which is a real setting, not an absence. The checkbox
 * therefore maps to "is the key there", not "are its sub-values set":
 *
 *   off            → the key is absent
 *   on, no sub-set → `{}` — burns, leaves nothing behind
 *   on, sub-set    → the object, with only the keys that were filled in
 *
 * A saved `true` is read back as on. It could never have worked, but it is
 * visible in a hand-edited config and silently turning it into "off" would be
 * a second wrong answer to the same question.
 */
const FLAMMABLE_FIELDS: FieldSpec[] = [
    {
        key: "flammableOn",
        label: "Flammable",
        kind: "bool",
        section: "Flammable",
        hint: "burns when fire or flame passes over it. Turn on to reveal what it leaves behind",
    },
    {
        key: "flammableOutputId",
        label: "Leaves behind",
        kind: "select",
        section: "Flammable",
        when: isFlammableOn,
        options: listElements,
        // A blank is not the same as no output. The engine guards on
        // `if (outputElementId)`, so leaving this empty means the cell burns and
        // nothing is written — the residue is the default, not a zero chance.
        hint: "the element written over the burnt cell. empty = nothing is left",
    },
    {
        key: "flammableOutputChance",
        label: "Output chance",
        kind: "number",
        section: "Flammable",
        when: isFlammableOn,
        min: 0,
        max: 1,
        step: 0.05,
        // Not 1. The engine writes `chance: outputChance ?? 0.25`, so an
        // omitted chance is a **quarter** of cells, not all of them.
        hint: "0–1. engine default 0.25, not 1",
    },
    {
        key: "flammableInheritsDuration",
        label: "Spawned fire inherits duration",
        kind: "bool",
        section: "Flammable",
        when: isFlammableOn,
        hint: "copies this cell's remaining lifetime onto the fire it spawns",
    },
    {
        key: "flammableDurationMin",
        label: "Fire lifetime min (s)",
        kind: "number",
        section: "Flammable",
        when: isFlammableOn,
        min: 0,
        max: 3600,
        step: 0.05,
        hint: "empty = the engine's own fire lifetime",
    },
    {
        key: "flammableDurationMax",
        label: "Fire lifetime max (s)",
        kind: "number",
        section: "Flammable",
        when: isFlammableOn,
        min: 0,
        max: 3600,
        step: 0.05,
        hint: "with min, picks a random lifetime in between",
    },
];

/**
 * `collectable`, as the engine actually stores it.
 *
 * Also a plain checkbox before, and also silently wrong. Both the main thread
 * and every worker build the collector's lookup table the same way:
 *
 * ```js
 * const n = mod?.collectable
 * if (mod?.elementType != null && n?.value != null) table.set(mod.elementType, n.value)
 * ```
 *
 * `n?.value` on a boolean is `undefined`, so the element is never added to the
 * table and the collector walks straight past it. Vanilla gold is
 * `collectable: { value: 2 }` — an object holding the number.
 *
 * `value` is required, not decorative: the guard is `!= null`, so a bare `{}`
 * collects nothing. Hence the validation below rather than a silent no-op.
 */
const COLLECTABLE_FIELDS: FieldSpec[] = [
    {
        key: "collectableOn",
        label: "Collectable",
        kind: "bool",
        section: "Collectable",
        hint: "the collector will take this. Turn on to set what it is worth",
    },
    {
        key: "collectableValue",
        label: "Collector value",
        kind: "number",
        section: "Collectable",
        when: isCollectableOn,
        min: 0,
        step: 1,
        int: true,
        // Vanilla gold is 2, and the table stores the number verbatim, so this is
        // a weight rather than a "yes". A blank value collects nothing at all.
        hint: "the number the collector stores. required — gold is 2",
    },
];

const FIELDS: FieldSpec[] = [
    idField(),
    textField("name", "Name", "Identity", true, { maxLength: NAME_MAX }),
    textField("description", "Description", "Identity", false, { maxLength: DESC_MAX }),
    textField("descriptionKey", "Description key (i18n)", "Identity", false, {
        placeholder: "mods|example|element|desc",
        maxLength: 120,
    }),
    {
        key: "matterType",
        label: "Matter type",
        kind: "select",
        section: "Physics",
        required: true,
        options: listMatterTypes,
        def: "powder",
        hint: "How the element behaves in the simulation",
    },
    numField("density", "Density", "Physics", {
        required: true,
        min: 0,
        max: 1000,
        def: "100",
        hint: "sink / float weight — 0–1000",
    }),
    numField("horizontalSpeed", "Horizontal speed", "Physics", {
        min: 0,
        max: 1000,
        step: 0.1,
        int: false,
        hint: "optional lateral spread",
    }),
    numField("duration", "Lifetime (s)", "Physics", {
        min: 0,
        max: 3600,
        step: 0.1,
        int: false,
        hint: "empty = permanent",
    }),
    numField("durationRandomMin", "Lifetime min (s)", "Physics", {
        min: 0,
        max: 3600,
        step: 0.1,
        int: false,
        when: (f) => f.duration !== "",
    }),
    numField("durationRandomMax", "Lifetime max (s)", "Physics", {
        min: 0,
        max: 3600,
        step: 0.1,
        int: false,
        when: (f) => f.duration !== "",
    }),
    {
        key: "metaColor",
        label: "Map colour",
        kind: "color",
        section: "Appearance",
        hint: "packed 0xRRGGBB (minimap / inspector)",
    },
    {
        // It was a raw JSON textarea, so the user hand-wrote nested tuples and
        // had to remember alpha was the fourth number. `renderColorVariants`
        // draws the list it should have been.
        key: "colorsJson",
        label: "Colour variants",
        kind: "colorVariants",
        section: "Appearance",
        wide: true,
        hint:
            "one tint per cell, picked at random. Add four or five for a natural look. With none set, every cell takes the map colour.",
    },
    boolField(
        "isTransportable",
        "Transportable",
        "Behaviour",
        "true",
        "conveyors / launchers can move it",
    ),
    boolField("isGrabbable", "Grabbable", "Behaviour"),
    boolField("hidden", "Hidden", "Flags"),
    boolField("visibleInPicker", "Visible in picker", "Flags", "true"),
    ...FLAMMABLE_FIELDS,
    ...COLLECTABLE_FIELDS,
    advField(),
];

/**
 * The behaviour flags, read and written as a group.
 *
 * `flammable` and `collectable` are **not** here. They used to be, and the
 * group is booleans end to end — `typeof e[k] === "boolean"` on the way in,
 * `setBool` on the way out. Both of those are quietly lossy for an object: the
 * read skipped it entirely, and because both keys are in `FORM_COVERED` the
 * passthrough that would otherwise have carried them dropped them too, so a
 * hand-written `collectable: { value: 2 }` did not survive a save. They are
 * handled by their own round trip now.
 */
const FLAGS = ["isTransportable", "isGrabbable", "hidden", "visibleInPicker"];

// ── Round trip ───────────────────────────────────────────────────────────────

/**
 * A stored matter type as the text the picker offers.
 *
 * The stored value is often a *number* — a hand-written config, or anything that
 * round-tripped through the engine — but the dropdown only offers lowercase
 * names. Showing a bare `8` leaves the select with nothing selected, and saving
 * that form then stores the **text** `"8"`, which is a different value with a
 * different meaning: `resolveMatterType("8")` must not hand the engine the string
 * `"Powder"`, which matches no entry in the worker's matter table, or the
 * element stops moving entirely. Numbers are therefore read back as names, so
 * the form is always a valid selection and the round trip is stable.
 */
function matterTypeToForm(v: unknown): string | undefined {
    if (typeof v === "string") return v;
    if (typeof v === "number" && Number.isFinite(v)) {
        return MATTER_NAME_BY_VALUE[v] ?? String(v);
    }
    return undefined;
}

/** Stored entry → form strings, for the whole element. */
function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("name", read.str(e.name));
    read.put("description", read.str(e.description));
    read.put("descriptionKey", read.str(e.descriptionKey));
    read.put("matterType", matterTypeToForm(e.matterType));
    read.put("density", read.num(e.density));
    read.put("horizontalSpeed", read.num(e.horizontalSpeed));
    read.put("duration", read.num(e.duration));
    const dr = e.durationRandom as { min?: number; max?: number } | undefined;
    read.put("durationRandomMin", read.num(dr?.min));
    read.put("durationRandomMax", read.num(dr?.max));
    read.put("metaColor", packedToHex(e.metaColor as number | undefined));
    // Stored as `{ variants: [...] }`, but a hand-written config may hold the
    // bare array — both are read, and the form always shows the bare form.
    const colors = e.colors as { variants?: number[][] } | number[][] | undefined;
    read.put("colorsJson", read.json(Array.isArray(colors) ? colors : colors?.variants));
    for (const k of FLAGS) {
        if (typeof e[k] === "boolean") read.put(k, String(e[k]));
    }
    readFlammable(e.flammable, read);
    readCollectable(e.collectable, read);
}

/**
 * `flammable` → the parent toggle and the four controls behind it.
 *
 * Both shapes the field has ever held are read. An object is the real one; a
 * bare `true` is what the old checkbox wrote, and reading it as "on, nothing
 * configured" keeps a hand-edited config from flipping to off on load.
 */
function readFlammable(raw: unknown, read: EntryReader): void {
    if (raw === undefined || raw === null) return;
    // `!!raw` rather than a type test: `{}` is flammable, and so is a legacy
    // `true`. Both mean "the key is present".
    read.put("flammableOn", "true");
    if (typeof raw !== "object") return;
    const f = raw as {
        outputElementId?: string;
        outputChance?: number;
        fireInheritsDuration?: boolean;
        duration?: number | number[];
    };
    read.put("flammableOutputId", read.str(f.outputElementId));
    read.put("flammableOutputChance", read.num(f.outputChance));
    // Read as a flag, not a lifted boolean: the two are not interchangeable
    // here, and `put` only writes when given a value.
    if (f.fireInheritsDuration) read.put("flammableInheritsDuration", "true");
    // The engine reads either a fixed lifetime or a `[min, max]` pair and picks
    // a random one, so the pair is two controls rather than a JSON box.
    if (Array.isArray(f.duration)) {
        read.put("flammableDurationMin", read.num(f.duration[0]));
        read.put("flammableDurationMax", read.num(f.duration[1]));
    } else {
        read.put("flammableDurationMin", read.num(f.duration));
    }
}

/** `collectable` → the parent toggle and its value. A legacy `true` reads as on. */
function readCollectable(raw: unknown, read: EntryReader): void {
    if (raw === undefined || raw === null) return;
    read.put("collectableOn", "true");
    if (typeof raw === "object") {
        read.put("collectableValue", read.num((raw as { value?: number }).value));
    }
}

/**
 * Form strings → stored entry, for the whole element.
 *
 * `_form` is unused: every read goes through the writer, which already carries
 * the form. The parameter stays because the `Definition` contract has one
 * signature — a definition that needs a raw form value the writer does not
 * expose (`structure` reads `form.tooltipHoverJson` for that) has to be able to
 * ask for it. An element simply does not.
 */
function formToEntry(_form: Record<string, string>, w: EntryWriter): void {
    w.setStr("name", w.opt("name"));
    w.setStr("description", w.opt("description"));
    w.setStr("descriptionKey", w.opt("descriptionKey"));
    w.setStr("matterType", w.opt("matterType"));
    w.setNum("density", w.optNum("density"));
    w.setNum("horizontalSpeed", w.optNum("horizontalSpeed"));
    w.setNum("duration", w.optNum("duration"));
    // The form has two numbers; the engine has one object. A half-filled pair
    // is not dropped — it becomes a fixed lifetime at the value given, which is
    // what a single number meant before the min/max pair existed.
    const dMin = w.optNum("durationRandomMin");
    const dMax = w.optNum("durationRandomMax");
    if (dMin !== undefined || dMax !== undefined) {
        w.setRaw("durationRandom", { min: dMin ?? 0, max: dMax ?? dMin ?? 0 });
    }
    const hex = w.opt("metaColor");
    if (hex && HEX.test(hex)) w.setRaw("metaColor", hexToPacked(hex));
    const colors = w.optJson<number[][]>("colorsJson");
    if (colors) w.setRaw("colors", { variants: colors });
    for (const k of FLAGS) w.setBool(k, w.optBool(k));
    writeFlammable(w);
    writeCollectable(w);
}

/**
 * The five controls → one `flammable` object, or no key at all.
 *
 * Three states, matching the three the engine distinguishes:
 *
 *   off            → nothing written. `del`, not `setRaw(undefined)` — a key
 *                    left behind holding `{}` would still be flammable, because
 *                    the engine's gate is truthiness.
 *   on, no sub-set → `{}`. Burns and leaves nothing behind, which is what the
 *                    checkbox means and is not the same as off.
 *   on, sub-set    → only the keys that were filled in, so an untouched chance
 *                    is omitted and the engine's own `?? 0.25` applies.
 */
function writeFlammable(w: EntryWriter): void {
    if (!w.optBool("flammableOn")) {
        w.del("flammable");
        return;
    }
    const f: Record<string, unknown> = {};
    const id = w.opt("flammableOutputId");
    if (id) f.outputElementId = id;
    const chance = w.optNum("flammableOutputChance");
    if (chance !== undefined) f.outputChance = chance;
    if (w.optBool("flammableInheritsDuration")) f.fireInheritsDuration = true;
    // One number is a fixed lifetime; two are the `[min, max]` the engine
    // samples. A half-filled pair collapses to the single value it does have,
    // the same rule `durationRandom` uses, rather than becoming a range with a
    // missing end.
    const dMin = w.optNum("flammableDurationMin");
    const dMax = w.optNum("flammableDurationMax");
    if (dMin !== undefined && dMax !== undefined) f.duration = [dMin, dMax];
    else if (dMin !== undefined) f.duration = dMin;
    else if (dMax !== undefined) f.duration = dMax;
    w.setRaw("flammable", f);
}

/**
 * The two controls → one `collectable` object.
 *
 * `value` is written whenever the toggle is on and a number was given, and
 * `validate` blocks the on-but-blank case, because the collector's guard is
 * `!= null`: a `{}` that reached the game would look configured and collect
 * nothing.
 */
function writeCollectable(w: EntryWriter): void {
    if (!w.optBool("collectableOn")) {
        w.del("collectable");
        return;
    }
    const value = w.optNum("collectableValue");
    w.setRaw("collectable", value === undefined ? {} : { value });
}

/**
 * Rules no single field can express.
 *
 * The lifetime is stored as `{ min, max }` and the engine picks per cell, so a
 * max below the min is a range with nothing in it. Neither number is wrong on
 * its own, which is why this cannot live on either field.
 */
function validate(form: Record<string, string>, errors: Record<string, string>): void {
    if (!errors.durationRandomMax && !errors.flammableDurationMax) {
        const min = form.durationRandomMin?.trim();
        const max = form.durationRandomMax?.trim();
        if (min && max && Number(min) > Number(max)) {
            errors.durationRandomMax = "must be ≥ min";
        }
        const fMin = form.flammableDurationMin?.trim();
        const fMax = form.flammableDurationMax?.trim();
        if (fMin && fMax && Number(fMin) > Number(fMax)) {
            errors.flammableDurationMax = "must be ≥ min";
        }
    }
    // A collectable with no value is the trap the engine sets for us: the
    // collector's guard is `value != null`, so the element is left out of the
    // table entirely and the collector walks past it as if it were ordinary
    // matter. It would save cleanly and do nothing, so it is blocked here.
    if (form.collectableOn === "true" && !form.collectableValue?.trim()) {
        errors.collectableValue = "required — without a value the collector skips this element";
    }
}

// ── The section panel ────────────────────────────────────────────────────────

/**
 * Colour-variant swatches — one row per `colors.variants` entry.
 *
 * The engine shape is a nested array of RGBA tuples, which as a raw textarea
 * meant hand-counting brackets and remembering that alpha is a fourth number.
 * Every workshop mod that uses this ships four or five variants
 * (`__scraped-mods/workshop/3790149867`), so the common case is a list, and a
 * list deserves a list control.
 */
function renderColorVariants(ctx: FieldContext): unknown {
    const { h, field, value, locked, form, setField } = ctx;
    const swatches = variantsToHexList(value);
    const write = (next: string[]) => setField(field.key, JSON.stringify(hexListToVariants(next)));

    return h(
        "div",
        null,
        swatches.length === 0
            ? h(
                "div",
                { style: S.hintBelow },
                "No variants — every cell will take the map colour, which is fine for most elements.",
            )
            : null,
        ...swatches.map((hexValue, i) =>
            h(
                "div",
                { key: `cv-${i}`, style: S.outputsRow },
                h("input", {
                    type: "color",
                    value: hexValue.slice(0, 7),
                    disabled: locked,
                    title: `variant ${i + 1}`,
                    style: {
                        width: 40,
                        height: 26,
                        border: "none",
                        background: "transparent",
                        cursor: locked ? "default" : "pointer",
                    },
                    onChange: (e: { target: { value: string } }) => {
                        const next = [...swatches];
                        // A colour input has no alpha, so the swatch keeps
                        // whatever alpha it already had.
                        next[i] = e.target.value + hexValue.slice(7);
                        write(next);
                    },
                }),
                h(
                    "span",
                    { style: { ...S.hint, fontFamily: "monospace" } },
                    hexValue,
                ),
                h(
                    "button",
                    {
                        type: "button",
                        style: { ...S.btnDanger, opacity: locked ? 0.5 : 1 },
                        disabled: locked,
                        title: "remove this variant",
                        onClick: () => write(swatches.filter((_, j) => j !== i)),
                    },
                    "✕",
                ),
            )
        ),
        h(
            "button",
            {
                type: "button",
                style: S.btn,
                disabled: locked,
                // Seed from the map colour so a new variant is a variation on
                // what the element already looks like, not a random new hue.
                onClick: () => write([...swatches, seedVariantFromMapColor(form.metaColor)]),
            },
            "+ variant from map colour",
        ),
    );
}

/**
 * The control for whichever element-only kind this field is, or `null` for the
 * generic ones the panel already knows how to draw.
 *
 * Returning `null` rather than owning every field is what lets the element
 * screen use the same text box, number box and dropdown as every other screen.
 */
function renderField(ctx: FieldContext): unknown {
    if (ctx.field.kind !== "colorVariants") return null;
    return renderColorVariants(ctx);
}

// ── The definition ───────────────────────────────────────────────────────────

/**
 * Stored keys this form owns.
 *
 * `colors` and `durationRandom` are listed under the keys the engine reads them
 * by, not under the form keys `colorsJson` / `durationRandomMin` +
 * `durationRandomMax`. Those are the *controls* for them; claiming the control
 * names would leave the real keys falling through the passthrough as
 * duplicates of keys the form already writes.
 */
const FORM_COVERED = [
    "name",
    "description",
    "descriptionKey",
    "matterType",
    "density",
    "horizontalSpeed",
    "duration",
    "durationRandom",
    "metaColor",
    "colors",
    "flammable",
    "isTransportable",
    "isGrabbable",
    "collectable",
    "hidden",
    "visibleInPicker",
];

export const elementDefinition: Definition = {
    tab: "elements",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    validate,
    panel: { renderField },
};
