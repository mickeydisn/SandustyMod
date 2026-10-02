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
import {
    ELEMENT_DATA_SLOTS,
    type ElementDataField,
    elementFieldsToRecord,
    elementRecordToFields,
} from "../data-fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldContext, FieldSpec } from "../types.ts";

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

export function seedVariantFromMapColor(mapColorHex: string | undefined): string {
    return mapColorHex && HEX.test(mapColorHex) ? `${mapColorHex}ff` : "#ccccccff";
}

const isFlammableOn = (f: Record<string, string>) => f.flammableOn === "true";
const isCollectableOn = (f: Record<string, string>) => f.collectableOn === "true";

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

        hint: "the number the collector stores. required — gold is 2",
    },
];

const DATA_FIELDS: FieldSpec[] = [
    {
        key: "dataFieldsJson",
        label: "Data fields",
        kind: "json",
        section: "Data",
        jsonType: "array",
        wide: true,
        hint: `per-cell values a process can read and write — up to ${ELEMENT_DATA_SLOTS} slots. ` +
            'Each row: { "name": "temperature", "slot": 2, "default": 20 }. ' +
            "`name` is your label only; the engine stores the number in `slot` " +
            "(1–4) and reads it back with getDataFieldAtCell / setDataFieldAtCell.",
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

    boolField("visibleInPicker", "Visible in picker", "Behaviour", "true"),
    ...FLAMMABLE_FIELDS,
    ...COLLECTABLE_FIELDS,
    ...DATA_FIELDS,
    advField(),
];

const FLAGS = ["isTransportable", "isGrabbable", "visibleInPicker"];

function matterTypeToForm(v: unknown): string | undefined {
    if (typeof v === "string") return v;
    if (typeof v === "number" && Number.isFinite(v)) {
        return MATTER_NAME_BY_VALUE[v] ?? String(v);
    }
    return undefined;
}

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

    const colors = e.colors as { variants?: number[][] } | number[][] | undefined;
    read.put("colorsJson", read.json(Array.isArray(colors) ? colors : colors?.variants));
    for (const k of FLAGS) {
        if (typeof e[k] === "boolean") read.put(k, String(e[k]));
    }
    readFlammable(e.flammable, read);
    readCollectable(e.collectable, read);

    read.put("dataFieldsJson", read.json(elementRecordToFields(e.defaultDataFields)));
}

function readFlammable(raw: unknown, read: EntryReader): void {
    if (typeof raw !== "object" || raw === null) return;

    read.put("flammableOn", "true");
    const f = raw as {
        outputElementId?: string;
        outputChance?: number;
        fireInheritsDuration?: boolean;
        duration?: number | number[];
    };
    read.put("flammableOutputId", read.str(f.outputElementId));
    read.put("flammableOutputChance", read.num(f.outputChance));

    if (f.fireInheritsDuration) read.put("flammableInheritsDuration", "true");

    if (Array.isArray(f.duration)) {
        read.put("flammableDurationMin", read.num(f.duration[0]));
        read.put("flammableDurationMax", read.num(f.duration[1]));
    } else {
        read.put("flammableDurationMin", read.num(f.duration));
    }
}

function readCollectable(raw: unknown, read: EntryReader): void {
    if (typeof raw !== "object" || raw === null) return;
    read.put("collectableOn", "true");
    read.put("collectableValue", read.num((raw as { value?: number }).value));
}

function formToEntry(_form: Record<string, string>, w: EntryWriter): void {
    w.setStr("name", w.opt("name"));
    w.setStr("description", w.opt("description"));
    w.setStr("descriptionKey", w.opt("descriptionKey"));
    w.setStr("matterType", w.opt("matterType"));
    w.setNum("density", w.optNum("density"));
    w.setNum("horizontalSpeed", w.optNum("horizontalSpeed"));
    w.setNum("duration", w.optNum("duration"));

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
    writeElementDataFields(w);
}

function writeElementDataFields(w: EntryWriter): void {
    const rows = w.optJson<ElementDataField[]>("dataFieldsJson");
    if (!rows?.length) {
        w.del("defaultDataFields");
        return;
    }

    const { record, problems } = elementFieldsToRecord(rows);
    if (problems.length) return;
    w.setRaw("defaultDataFields", record);
}

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

    const dMin = w.optNum("flammableDurationMin");
    const dMax = w.optNum("flammableDurationMax");
    if (dMin !== undefined && dMax !== undefined) f.duration = [dMin, dMax];
    else if (dMin !== undefined) f.duration = dMin;
    else if (dMax !== undefined) f.duration = dMax;
    w.setRaw("flammable", f);
}

function writeCollectable(w: EntryWriter): void {
    if (!w.optBool("collectableOn")) {
        w.del("collectable");
        return;
    }
    const value = w.optNum("collectableValue");
    w.setRaw("collectable", value === undefined ? {} : { value });
}

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

    if (form.collectableOn === "true" && !form.collectableValue?.trim()) {
        errors.collectableValue = "required — without a value the collector skips this element";
    }
    validateElementDataFields(form, errors);
}

function validateElementDataFields(
    form: Record<string, string>,
    errors: Record<string, string>,
): void {
    const raw = form.dataFieldsJson?.trim();
    if (!raw) return;
    let rows: ElementDataField[];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            errors.dataFieldsJson = "a list of { name, slot, default } rows";
            return;
        }
        rows = parsed as ElementDataField[];
    } catch {
        return;
    }
    const { problems } = elementFieldsToRecord(rows);
    if (!problems.length) return;

    const reasons = problems.map((p) => `row ${p.row + 1}: ${p.reason}`);
    errors.dataFieldsJson = reasons.join("; ");
}

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

                onClick: () => write([...swatches, seedVariantFromMapColor(form.metaColor)]),
            },
            "+ variant from map colour",
        ),
    );
}

function renderField(ctx: FieldContext): unknown {
    if (ctx.field.kind !== "colorVariants") return null;
    return renderColorVariants(ctx);
}

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
    "visibleInPicker",
    "dataFieldsJson",
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
