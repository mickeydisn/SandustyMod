import { listElements, listItems, listMaterialIds } from "../../../catalog.ts";
import { advField, boolField, idField, NAME_MAX, numField, textField } from "../fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";
import { HEX, hexToPacked, packedToHex, parseIdList } from "../values.ts";

const hslOn = (f: Record<string, string>) => f.colorHSLOn === "true";

const FIELDS: FieldSpec[] = [
    idField(),
    textField("name", "Name", "Identity", true, { maxLength: NAME_MAX }),
    textField("nameKey", "Name key (i18n)", "Identity", false, {
        placeholder: "mods|example|terrain|name",
        maxLength: 120,
    }),

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
        key: "materialId",
        label: "Material id",
        kind: "select",
        section: "Tile",
        options: listMaterialIds,
        hint:
            "must be 101–149; every value is an obstacle, so the engine's next-free id is the safe pick",
    },
    boolField("flammable", "Flammable", "Flags"),

    advField(),
];

function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("name", read.str(e.name));
    read.put("nameKey", read.str(e.nameKey));

    const hsl = e.colorHSL as [number, number, number] | undefined;
    if (Array.isArray(hsl) && hsl.length === 3) {
        read.put("colorHSLOn", "true");
        read.put("colorHSLHue", read.num(hsl[0]));
        read.put("colorHSLSaturation", read.num(hsl[1]));
        read.put("colorHSLLightness", read.num(hsl[2]));
    }

    if (Array.isArray(e.excavationRequirements)) {
        read.put(
            "excavationRequirements",
            (e.excavationRequirements as unknown[]).join(","),
        );
    }
    read.put("interactionsJson", read.json(e.interactions));
    read.put("hp", read.num(e.hp));
    read.put("metaColor", packedToHex(e.metaColor as number | undefined));

    const out = e.output as { elementType?: string | number; chance?: number } | undefined;
    read.put("outputElement", read.str(out?.elementType) ?? read.num(out?.elementType));
    read.put("outputChance", read.num(out?.chance));
    if (typeof e.flammable === "boolean") read.put("flammable", String(e.flammable));
    read.put("materialId", read.num(e.materialId));
}

function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("name", w.opt("name"));
    w.setStr("nameKey", w.opt("nameKey"));

    if (w.optBool("colorHSLOn")) {
        const h = w.optNum("colorHSLHue");
        const s = w.optNum("colorHSLSaturation");
        const l = w.optNum("colorHSLLightness");

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

    const outEl = w.opt("outputElement");
    if (outEl) {
        w.setRaw("output", { elementType: outEl, chance: w.optNum("outputChance") ?? 1 });
    }
    w.setBool("flammable", w.optBool("flammable"));
    w.setNum("materialId", w.optNum("materialId"));
}

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
};
