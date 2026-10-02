import {
    listBuildModeTypes,
    listDrawFunctions,
    listLinkedClearance,
    listSpriteIds,
    listStructureCategories,
    listStructures,
    listUnlockNodes,
} from "../../../catalog.ts";
import { DEFAULT_UNLOCK_NODE, unlockLine } from "../../tech-link.ts";
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
import { parseObjectOrUndefined, safeJson } from "../values.ts";
import {
    type StructureDataField,
    structureFieldsToRecord,
    structureRecordToFields,
} from "../data-fields.ts";
import type {
    Definition,
    EntryReader,
    EntryWriter,
    FieldContext,
    FieldSpec,
    PanelContext,
} from "../types.ts";

const SHAPE_SIZE = 4;

export function emptyShape(fill: 0 | 1 = 0): number[][] {
    return Array.from({ length: SHAPE_SIZE }, () => Array<number>(SHAPE_SIZE).fill(fill));
}

export function normalizeShape(raw: unknown): number[][] {
    const grid = emptyShape(0);
    if (!Array.isArray(raw)) return grid;
    for (let y = 0; y < SHAPE_SIZE; y++) {
        const row = raw[y];
        if (!Array.isArray(row)) continue;
        for (let x = 0; x < SHAPE_SIZE; x++) {
            const v = row[x];
            grid[y][x] = v === 1 || v === "1" || v === true ? 1 : 0;
        }
    }
    return grid;
}

export function shapeToText(raw: unknown): string {
    return JSON.stringify(normalizeShape(raw));
}

export function describeShape(raw: unknown): string {
    const grid = normalizeShape(raw);
    const filled = grid.flat().filter((v) => v === 1).length;
    if (filled === 0) return "empty (0 of 16 cells)";
    if (filled === 16) return "solid 4×4 block (16 of 16 cells)";
    return `custom — ${filled} of 16 cells occupied`;
}

function shapeField(): FieldSpec {
    return {
        key: "shapeJson",
        label: "Shape (4×4)",
        kind: "shape",
        section: "Placement",
        wide: true,

        def: shapeToText(emptyShape(1)),
        hint: "1 = occupied cell, 0 = empty. Use the buttons for solid / empty / clear.",
    };
}

export function parseBuildModes(
    raw: string | undefined,
    directions: string[] = [],
): Record<string, unknown>[] {
    if (!raw?.trim()) return [];
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return [];
    }
    if (!Array.isArray(parsed)) return [];
    const out: Record<string, unknown>[] = [];
    for (const row of parsed) {
        if (!row || typeof row !== "object") continue;
        const r = row as Record<string, unknown>;
        const type = typeof r.type === "string" ? r.type.trim() : "";
        if (!type) continue;
        const mode: Record<string, unknown> = { type };
        if (directions.length > 0) mode.directions = [...directions];
        if (type === "line") {
            const span = Number(r.spanTiles);
            if (Number.isFinite(span) && span >= 1) mode.spanTiles = Math.floor(span);
        }
        out.push(mode);
    }
    return out;
}

export function composeTooltipHover(
    f: Record<string, string>,
): Record<string, unknown> | undefined {
    const messageKey = (f.tooltipMessageKey ?? "").trim();
    if (!messageKey) return undefined;
    const fieldRow: Record<string, unknown> = {};
    const field = Number(f.tooltipField);
    if (Number.isInteger(field) && field >= 1 && field <= 4) fieldRow.field = field;
    if (f.tooltipParam?.trim()) fieldRow.param = f.tooltipParam.trim();
    if (f.tooltipFallback?.trim()) fieldRow.fallback = f.tooltipFallback.trim();
    return {
        type: "custom",
        dataFieldMessage: { messageKey, fields: [fieldRow] },
    };
}

export function tooltipHoverIsComplete(raw: string | undefined): boolean {
    const obj = parseObjectOrUndefined(raw);
    if (!obj) return true;
    const msg = (obj as { dataFieldMessage?: Record<string, unknown> }).dataFieldMessage;
    if (!msg) return false;
    if (typeof msg.message === "string") return false;
    const fields = Array.isArray(msg.fields) ? msg.fields : [];
    if (fields.length !== 1) return false;
    const only = fields[0] as Record<string, unknown>;
    if ("valueLabels" in only || "valueKeys" in only) return false;
    return Object.keys(only).every((k) => ["field", "param", "fallback"].includes(k));
}

const FIELDS: FieldSpec[] = [
    idField(),
    textField("name", "Name", "Identity", true, { maxLength: NAME_MAX }),
    textField("description", "Description", "Identity", false, { maxLength: DESC_MAX }),
    textField("descriptionKey", "Description key (i18n)", "Identity", false, {
        placeholder: "mods|example|structure|desc",
        maxLength: 120,
        hint: "used when no plain description is set",
    }),
    {
        key: "descriptionParamsJson",
        label: "Description parameters",
        kind: "json",
        section: "Identity",
        jsonType: "object",
        wide: true,
        hint: 'values interpolated into the description, e.g. { "count": 3 }',
    },
    {
        key: "linkedClearance",
        label: "Linked clearance",
        kind: "select",
        section: "Placement",
        options: listLinkedClearance,
        hint: "how a multi-cell footprint is validated against the cells under it",
    },
    {
        key: "categoryKey",
        label: "Build category",
        kind: "select",
        section: "Placement",
        required: true,
        options: listStructureCategories,
        def: "blocks",
        hint: "grouping in the build window",
    },
    numField("order", "Order", "Placement", {
        min: 0,
        max: 9999,
        hint: "sort inside the category",
    }),
    {
        key: "buildModesJson",
        label: "Build modes",
        kind: "buildModes",
        section: "Placement",
        wide: true,
        hint:
            "how this is placed in the world. Span is only valid on a line mode — the engine throws otherwise.",
    },
    boolField("dirH", "Horizontal", "Placement", "true", "placement directions"),
    boolField("dirV", "Vertical", "Placement", "true"),
    boolField("dirD", "Diagonal", "Placement", "false"),
    {
        key: "rejectWhenBlocked",
        label: "Reject when blocked",
        kind: "bool",
        section: "Placement",
        hint: "refuse placement if any footprint cell is occupied",
    },
    shapeField(),

    boolField(
        "hideFromBuildMenu",
        "Hide from build menu",
        "Flags",
        "false",
        "unhide to list it — a structure with no unlock tech is available from the start",
    ),
    {
        key: "unlockNode",
        label: "Unlock node",
        kind: "select",
        section: "Flags",
        required: true,
        options: (f) => {
            const opts = listUnlockNodes();
            const cur = (f.unlockNode ?? "").trim();
            if (cur && !opts.some((o) => o.value === cur)) {
                return [...opts, { value: cur, label: `${cur} (missing node)` }];
            }
            return opts;
        },
        hint: "every structure names one — the node decides whether research is needed",
    },
    boolField("disallowPick", "Disallow pick", "Flags"),
    {
        key: "tooltipHoverJson",
        label: "Hover tooltip",
        kind: "json",
        section: "Render",
        jsonType: "object",
        wide: true,
        hint: "custom tooltip driven by structure data fields",
    },
    {
        key: "variantsJson",
        label: "Variants",
        kind: "json",
        section: "Render",
        jsonType: "array",
        wide: true,
        hint: 'rotation variants, e.g. [ { "id": "…", "angles": [0, 90] } ]',
    },
    {
        key: "imageName",
        label: "Sprite",
        kind: "select",
        section: "Render",
        options: listSpriteIds,
        hint: "render.imageName (load a sprite first)",
    },
    {
        key: "drawKey",
        label: "Custom draw",
        kind: "select",
        section: "Render",
        options: listDrawFunctions,
        def: "default",
        hint:
            "draw is a function, not data — pick a built-in. Anything typed here by hand is ignored by the game.",
    },
    {
        key: "blockGridType",
        label: "Block grid type",
        kind: "select",
        section: "Grid",

        options: listStructures,
        emptyHint:
            "no other structures exist yet — save this one first, then pick its own id from the list.",
        hint:
            "leave empty only for a footprint of 8x8 or smaller. Above that, set this to the structure's OWN id: without it a large structure places as a single 1-cell unit and its hover tooltip only resolves at the origin cell. Point it at a DIFFERENT structure to share that structure's grid instead.",
    },
    {
        key: "skipCopyData",
        label: "Skip data copy",
        kind: "bool",
        section: "Grid",
        def: "false",
        hint:
            "do not copy grid data on placement (the engine also sets this when copyData is false)",
    },
    {
        key: "defaultDataJson",
        label: "Data for each placed copy",
        kind: "json",
        section: "Grid",
        jsonType: "object",
        wide: true,
        hint:
            "the data object every placed copy starts with; the hover tooltip reads dataField1..4 back out of it. Unrelated to elements.",
    },
    {
        key: "dataFieldsJson",
        label: "Data fields",
        kind: "json",
        section: "Grid",
        jsonType: "array",
        wide: true,
        hint: "the same data, one row per key: " +
            '{ "key": "charge", "type": "number", "default": 0 }. ' +
            "Read and written in a process with structureData / setStructureData. " +
            "Used when it covers every key in the box above; otherwise the box is kept " +
            "as-is, so a nested value is never lost.",
    },
    advField(),
];

function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("name", read.str(e.name));
    read.put("description", read.str(e.description));
    read.put("descriptionKey", read.str(e.descriptionKey));
    read.put("descriptionParamsJson", read.json(e.descriptionParams));
    read.put("linkedClearance", read.str(e.linkedClearance));
    read.put("categoryKey", read.str(e.categoryKey));
    read.put("order", read.num(e.order));

    const modes = (Array.isArray(e.buildModes) ? e.buildModes : []) as Record<
        string,
        unknown
    >[];
    read.put("buildModesJson", JSON.stringify(modes));
    const m0 = (modes[0] ?? {}) as { directions?: string[] };
    const dirs = Array.isArray(m0.directions) ? m0.directions : [];
    if (dirs.includes("horizontal")) read.put("dirH", "true");
    if (dirs.includes("vertical")) read.put("dirV", "true");
    if (dirs.includes("diagonal")) read.put("dirD", "true");
    read.put("shapeJson", e.shape === undefined ? undefined : shapeToText(e.shape));

    if (typeof e.hideFromBuildMenu === "boolean") {
        read.put("hideFromBuildMenu", String(e.hideFromBuildMenu));
    }
    if (typeof e.disallowPick === "boolean") read.put("disallowPick", String(e.disallowPick));

    read.put("unlockNode", read.str(e.unlockNode) || DEFAULT_UNLOCK_NODE);
    if (typeof e.rejectWhenBlocked === "boolean") {
        read.put("rejectWhenBlocked", String(e.rejectWhenBlocked));
    }
    read.put("tooltipHoverJson", read.json(e.tooltipHover));

    {
        const th = e.tooltipHover as
            | { dataFieldMessage?: { messageKey?: string; fields?: unknown[] } }
            | undefined;
        const msg = th?.dataFieldMessage;
        read.put("tooltipMessageKey", read.str(msg?.messageKey));
        const only = Array.isArray(msg?.fields) ? msg.fields[0] : undefined;
        const f0 = (only ?? {}) as {
            field?: number;
            param?: string;
            fallback?: string;
        };
        read.put("tooltipField", read.num(f0.field));
        read.put("tooltipParam", read.str(f0.param));
        read.put("tooltipFallback", read.str(f0.fallback));
    }
    read.put("variantsJson", read.json(e.variants));
    const render = e.render as { imageName?: string } | undefined;
    read.put("imageName", read.str(render?.imageName) ?? read.str(e.imageName));
    read.put("blockGridType", read.str(e.blockGridType));
    read.put("drawKey", read.str(e.drawKey ?? "default"));
    if (typeof e.skipCopyData === "boolean") {
        read.put("skipCopyData", String(e.skipCopyData));
    }
    read.put("defaultDataJson", read.json(e.defaultData));

    read.put("dataFieldsJson", read.json(structureRecordToFields(e.defaultData)));
}

function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("name", w.opt("name"));
    w.setStr("description", w.opt("description"));
    w.setStr("descriptionKey", w.opt("descriptionKey"));
    w.setStr("linkedClearance", w.opt("linkedClearance"));
    const descriptionParams = w.optJson<Record<string, unknown>>("descriptionParamsJson");
    if (descriptionParams) w.setRaw("descriptionParams", descriptionParams);
    w.setBool("rejectWhenBlocked", w.optBool("rejectWhenBlocked"));

    const existingHover = parseObjectOrUndefined(form.tooltipHoverJson);
    const hover = composeTooltipHover(form);
    if (hover) {
        w.setRaw(
            "tooltipHover",
            tooltipHoverIsComplete(form.tooltipHoverJson) ? hover : existingHover,
        );
    } else if (existingHover) {
        w.setRaw("tooltipHover", existingHover);
    }
    const variants = w.optJson<unknown[]>("variantsJson");
    if (variants) w.setRaw("variants", variants);
    w.setStr("categoryKey", w.opt("categoryKey"));
    w.setNum("order", w.optNum("order"));

    const dirs: string[] = [];
    if (w.optBool("dirH")) dirs.push("horizontal");
    if (w.optBool("dirV")) dirs.push("vertical");
    if (w.optBool("dirD")) dirs.push("diagonal");
    const modes = parseBuildModes(w.opt("buildModesJson"), dirs);
    if (modes.length > 0) w.setRaw("buildModes", modes);
    const shape = w.optJson<number[][]>("shapeJson");
    if (shape) w.setRaw("shape", normalizeShape(shape));
    w.setBool("hideFromBuildMenu", w.optBool("hideFromBuildMenu"));
    w.setBool("disallowPick", w.optBool("disallowPick"));

    w.setStr("unlockNode", w.opt("unlockNode"));
    const image = w.opt("imageName");
    if (image) w.setRaw("render", { imageName: image });
    w.setStr("blockGridType", w.opt("blockGridType"));
    w.setBool("skipCopyData", w.optBool("skipCopyData"));
    const drawKey = w.opt("drawKey") ?? "default";
    if (drawKey !== "default") w.setStr("drawKey", drawKey);
    writeStructureDefaultData(w);
}

function writeStructureDefaultData(w: EntryWriter): void {
    const rows = w.optJson<StructureDataField[]>("dataFieldsJson");
    const box = w.optJson<Record<string, unknown>>("defaultDataJson");
    if (rows?.length) {
        const { record, problems } = structureFieldsToRecord(rows);
        if (problems.length) return;
        if (!box || Object.keys(box).every((k) => k in record)) {
            w.setRaw("defaultData", record);
            return;
        }
    }
    if (box) w.setRaw("defaultData", box);
    else w.del("defaultData");
}

function validate(form: Record<string, string>, errors: Record<string, string>): void {
    if (errors.buildModesJson) return;
    const raw = form.buildModesJson?.trim();
    if (!raw) return;
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        parsed.forEach((m: Record<string, unknown>, i: number) => {
            if (m?.spanTiles !== undefined && m?.type !== "line") {
                errors.buildModesJson = `mode ${
                    i + 1
                }: span is only valid on a line mode — the engine throws otherwise`;
            }
        });
    } catch {
    }
    validateStructureDataFields(form, errors);
}

function validateStructureDataFields(
    form: Record<string, string>,
    errors: Record<string, string>,
): void {
    const raw = form.dataFieldsJson?.trim();
    if (!raw) return;
    let rows: StructureDataField[];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            errors.dataFieldsJson = "a list of { key, type, default } rows";
            return;
        }
        rows = parsed as StructureDataField[];
    } catch {
        return;
    }
    const { problems } = structureFieldsToRecord(rows);
    if (!problems.length) return;
    errors.dataFieldsJson = problems.map((p) => `row ${p.row + 1}: ${p.reason}`).join("; ");
}

function parseShape(text: string): number[][] | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return null;
    }
    if (!Array.isArray(parsed) || parsed.length !== SHAPE_SIZE) return null;
    for (const row of parsed) {
        if (!Array.isArray(row) || row.length !== SHAPE_SIZE) return null;
        for (const v of row) if (v !== 0 && v !== 1) return null;
    }
    return parsed as number[][];
}

function validateField(field: FieldSpec, value: string): string | undefined {
    if (field.kind !== "shape") return undefined;
    return parseShape(value) === null
        ? `must be a ${SHAPE_SIZE}×${SHAPE_SIZE} grid of 0 or 1`
        : undefined;
}

function renderShape(ctx: FieldContext): unknown {
    const { h, field, value, error } = ctx;
    const grid = normalizeShape(safeJson(value) ?? emptyShape(1));
    const write = (next: number[][]) => ctx.setField(field.key, shapeToText(next));

    const cellAt = (y: number, x: number) => {
        const on = grid[y][x] === 1;
        return h(
            "button",
            {
                key: `${y}-${x}`,
                title: on
                    ? `cell ${x},${y} — occupied (click to clear)`
                    : `cell ${x},${y} — empty (click to fill)`,
                style: on ? S.shapeCellOn : S.shapeCellOff,
                onClick: () => {
                    const next = grid.map((r) => r.slice());
                    next[y][x] = on ? 0 : 1;
                    write(next);
                },
            },
            "",
        );
    };

    return h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 6 } },
        h(
            "div",
            { style: S.shapeGridBox },
            ...grid.map((_row, y) =>
                h("div", { key: y, style: S.shapeRow }, ...grid[y].map((_v, x) => cellAt(y, x)))
            ),
        ),
        h(
            "div",
            { style: { display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" } },
            h("button", { style: S.btn, onClick: () => write(emptyShape(1)) }, "Fill 4×4"),
            h("button", { style: S.btn, onClick: () => write(emptyShape(0)) }, "Clear all"),
            h("button", {
                style: S.btn,
                onClick: () => write(grid.map((r) => r.slice()).reverse()),
            }, "Flip Y"),
            h("span", { style: S.hintBelow }, describeShape(grid)),
        ),
        error ? h("div", { style: S.errorText }, error) : null,
    );
}

function renderBuildModes(ctx: FieldContext): unknown {
    const { h, field, value, locked } = ctx;
    let rows: Record<string, unknown>[] = [];
    try {
        const parsed = JSON.parse(value || "[]");
        if (Array.isArray(parsed)) rows = parsed;
    } catch {
    }
    const writeRows = (next: Record<string, unknown>[]) =>
        ctx.setField(field.key, JSON.stringify(next));
    const modes = listBuildModeTypes();

    return h(
        "div",
        null,
        rows.length === 0
            ? h(
                "div",
                { style: S.hintBelow },
                "No build modes listed — the engine places this as a single point.",
            )
            : null,
        ...rows.map((row, i) => {
            const type = String(row.type ?? "single");
            return h(
                "div",
                { key: i, style: S.outputsRow },
                h(
                    "select",
                    {
                        style: S.input,
                        title: "build mode type",
                        value: type,
                        disabled: locked,
                        onChange: (e: { target: { value: string } }) => {
                            const nextType = e.target.value;
                            writeRows(
                                rows.map((r, j) => {
                                    if (j !== i) return r;
                                    if (nextType === "line") {
                                        return { ...r, type: nextType };
                                    }

                                    const { spanTiles: _drop, ...rest } = r;
                                    return { ...rest, type: nextType };
                                }),
                            );
                        },
                    },
                    ...modes.map((o) => h("option", { key: o.value, value: o.value }, o.label)),
                ),
                type === "line"
                    ? h("input", {
                        type: "number",
                        style: S.input,
                        min: 1,
                        max: 64,
                        placeholder: "span",
                        title: "tiles per drag; the engine throws below 1",
                        value: row.spanTiles === undefined ? "" : String(row.spanTiles),
                        disabled: locked,
                        onInput: (e: { currentTarget: { value: string } }) => {
                            const raw = e.currentTarget.value.trim();
                            writeRows(
                                rows.map((r, j) => {
                                    if (j !== i) return r;
                                    if (raw === "") {
                                        const { spanTiles: _drop, ...rest } = r;
                                        return rest;
                                    }
                                    return { ...r, spanTiles: Number(raw) };
                                }),
                            );
                        },
                    })
                    : h("span", { style: S.hintBelow }, "no span"),
                h(
                    "button",
                    {
                        type: "button",
                        style: { ...S.btnDanger, opacity: locked ? 0.5 : 1 },
                        disabled: locked,
                        title: "remove this build mode",
                        onClick: () => writeRows(rows.filter((_, j) => j !== i)),
                    },
                    "✕",
                ),
            );
        }),
        h(
            "button",
            {
                type: "button",
                style: S.btn,
                disabled: locked,
                onClick: () => writeRows([...rows, { type: "single" }]),
            },
            "+ build mode",
        ),
    );
}

function renderHeader(ctx: PanelContext): unknown {
    return ctx.h(
        "div",
        { key: "unlock-row", style: S.unlockRow },
        ctx.h("span", { style: S.unlockText }, unlockLine(ctx.form, ctx.cfg)),
    );
}

function renderField(ctx: FieldContext): unknown {
    switch (ctx.field.kind) {
        case "shape":
            return renderShape(ctx);
        case "buildModes":
            return renderBuildModes(ctx);
        default:
            return null;
    }
}

const FORM_COVERED = [
    "name",
    "description",
    "categoryKey",
    "order",
    "buildModes",
    "spanTiles",
    "dirH",
    "dirV",
    "dirD",
    "shape",
    "hideFromBuildMenu",
    "disallowPick",
    "unlockNode",
    "render",
    "imageName",
    "blockGridType",
    "draw",
    "skipCopyData",
    "defaultData",
    "descriptionKey",
    "descriptionParams",
    "linkedClearance",
    "rejectWhenBlocked",
    "tooltipHover",
    "variants",
];

export const structureDefinition: Definition = {
    tab: "structures",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    validate,
    validateField,

    onNewEntry: (form) => {
        form.unlockNode = DEFAULT_UNLOCK_NODE;
    },
    panel: { renderField, renderHeader },
};
