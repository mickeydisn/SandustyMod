export type InteractionKind =
    | "destroyer"
    | "structure"
    | "entity"
    | "flammable"
    | "meltable"
    | "freezable"
    | "custom";

export const INTERACTION_KINDS: { kind: InteractionKind; label: string; blurb: string }[] = [
    {
        kind: "structure",
        label: "Structures this element interacts with",
        blurb: "Names the machines shown in the interaction tooltip for this element.",
    },
    {
        kind: "destroyer",
        label: "Destroys specific items",
        blurb: "Removes the named items — a corrosive element that eats through a drill bit.",
    },
    {
        kind: "entity",
        label: "Affects specific entities",
        blurb: "Names entity types. There is no entity registry to list, so these are typed.",
    },
    { kind: "flammable", label: "Flammable", blurb: "This element can burn. No extra fields." },
    { kind: "meltable", label: "Meltable", blurb: "This element can be melted. No extra fields." },
    {
        kind: "freezable",
        label: "Freezable",
        blurb: "This element can be frozen. No extra fields.",
    },
    {
        kind: "custom",
        label: "Custom (handled by your own code)",
        blurb: "You decide what it means. Only the tooltip text is configurable here.",
    },
];

export const TOOLTIP_KINDS: InteractionKind[] = ["structure", "custom"];

export const DATA_FIELD_MODES: { value: string; label: string }[] = [
    { value: "", label: "Always show" },
    { value: "visibleWhen", label: "Show only when a data field equals a value" },
    { value: "crossedOutWhen", label: "Show, but crossed out, when a data field equals a value" },
];

const KNOWN = new Set([
    "kind",
    "items",
    "structures",
    "entities",
    "textKey",
    "visibleWhen",
    "crossedOutWhen",
    "onlyWhenTranslated",
]);

export function composeInteraction(
    f: Record<string, string>,
): Record<string, unknown> | undefined {
    const kind = (f.interactionKind ?? "").trim() as InteractionKind;
    if (!kind || !INTERACTION_KINDS.some((k) => k.kind === kind)) return undefined;

    const out: Record<string, unknown> = { kind };
    const idList = (key: string) => (f[key] ?? "").split(",").map((s) => s.trim()).filter(Boolean);

    if (kind === "destroyer") {
        const items = idList("destroyerItems");
        if (items.length > 0) out.items = items;
    } else if (kind === "structure") {
        const structures = idList("structures");
        if (structures.length > 0) out.structures = structures;
    } else if (kind === "entity") {
        const entities = idList("entities");
        if (entities.length > 0) out.entities = entities;
    }

    if (TOOLTIP_KINDS.includes(kind)) {
        if (f.tipTextKey?.trim()) out.textKey = f.tipTextKey.trim();
        const mode = f.tipVisibility ?? "";
        if (mode === "visibleWhen" || mode === "crossedOutWhen") {
            const field = Number(f.tipDataField);
            const equals = Number(f.tipDataFieldEquals);
            if (
                Number.isInteger(field) && field >= 1 && field <= 4 &&
                Number.isFinite(equals)
            ) {
                out[mode] = { dataField: field, equals };
            }
        }
        if (f.tipOnlyWhenTranslated === "true") out.onlyWhenTranslated = true;
    }
    return out;
}

export function splitInteraction(
    interaction: Record<string, unknown> | undefined,
): { fields: Record<string, string>; unmodelled: boolean } {
    const fields: Record<string, string> = {};
    if (!interaction || typeof interaction !== "object") return { fields, unmodelled: false };

    const kind = String(interaction.kind ?? "");
    fields.interactionKind = kind;

    const list = (key: string) =>
        Array.isArray(interaction[key])
            ? (interaction[key] as unknown[]).map(String).join(", ")
            : "";

    if (kind === "destroyer") fields.destroyerItems = list("items");
    if (kind === "structure") fields.structures = list("structures");
    if (kind === "entity") fields.entities = list("entities");

    if (TOOLTIP_KINDS.includes(kind as InteractionKind)) {
        if (typeof interaction.textKey === "string") fields.tipTextKey = interaction.textKey;
        const vis = interaction.visibleWhen as { dataField?: number; equals?: number } | undefined;
        const crossed = interaction.crossedOutWhen as
            | { dataField?: number; equals?: number }
            | undefined;
        if (vis && typeof vis.dataField === "number") {
            fields.tipVisibility = "visibleWhen";
            fields.tipDataField = String(vis.dataField);
            fields.tipDataFieldEquals = String(vis.equals ?? 0);
        } else if (crossed && typeof crossed.dataField === "number") {
            fields.tipVisibility = "crossedOutWhen";
            fields.tipDataField = String(crossed.dataField);
            fields.tipDataFieldEquals = String(crossed.equals ?? 0);
        }
        if (interaction.onlyWhenTranslated === true) fields.tipOnlyWhenTranslated = "true";
    }

    const unmodelled = Object.keys(interaction).some((k) => !KNOWN.has(k));
    return { fields, unmodelled };
}
