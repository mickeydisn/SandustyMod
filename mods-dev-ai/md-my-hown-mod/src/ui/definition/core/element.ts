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
import { listMatterTypes, MATTER_NAME_BY_VALUE } from "../../../catalog.ts";
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
    boolField("flammable", "Flammable", "Behaviour"),
    boolField(
        "isTransportable",
        "Transportable",
        "Behaviour",
        "true",
        "conveyors / launchers can move it",
    ),
    boolField("isGrabbable", "Grabbable", "Behaviour"),
    boolField("collectable", "Collectable", "Behaviour", "true", "collector value path"),
    boolField("hidden", "Hidden", "Flags"),
    boolField("visibleInPicker", "Visible in picker", "Flags", "true"),
    advField(),
];

/** The behaviour flags, read and written as a group. */
const FLAGS = [
    "flammable",
    "isTransportable",
    "isGrabbable",
    "collectable",
    "hidden",
    "visibleInPicker",
];

// ── Round trip ───────────────────────────────────────────────────────────────

/**
 * A stored matter type as the text the picker offers.
 *
 * The stored value is often a *number* — a hand-written config, or anything that
 * round-tripped through the engine — but the dropdown only offers lowercase
 * names. Showing a bare `8` leaves the select with nothing selected, and saving
 * that form then stores the **text** `"8"`, which is a different value with a
 * different meaning: `resolveMatterType("8")` used to hand the engine the string
 * `"Powder"`, which matches no entry in the worker's matter table, and the
 * element stopped moving entirely. Numbers are therefore read back as names, so
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
}

/**
 * Rules no single field can express.
 *
 * The lifetime is stored as `{ min, max }` and the engine picks per cell, so a
 * max below the min is a range with nothing in it. Neither number is wrong on
 * its own, which is why this cannot live on either field.
 */
function validate(form: Record<string, string>, errors: Record<string, string>): void {
    if (errors.durationRandomMin || errors.durationRandomMax) return;
    const min = form.durationRandomMin?.trim();
    const max = form.durationRandomMax?.trim();
    if (min && max && Number(min) > Number(max)) {
        errors.durationRandomMax = "must be ≥ min";
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
