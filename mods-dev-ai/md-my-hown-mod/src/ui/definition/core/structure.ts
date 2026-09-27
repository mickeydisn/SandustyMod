/**
 * The **structure** object definition.
 *
 * A structure is the most constrained object the panel authors and the one with
 * the most of its own vocabulary: a 4×4 footprint grid, a *list* of build modes
 * (where the engine throws on `spanTiles` off a line mode), a block-grid
 * reference, and an unlock-node relation that the field itself cannot explain.
 * All of that is structure-only, so all of it lives here — the schema, the two
 * widgets the generic form renderer has no idea how to draw, the shape codecs,
 * and the save path that has to undo the form's flattening.
 *
 * Ground truth: `doc/doc-tech/09-structures-register.md`.
 */
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
import type {
    Definition,
    EntryReader,
    EntryWriter,
    FieldContext,
    FieldSpec,
    PanelContext,
} from "../types.ts";

// ── The 4×4 footprint ────────────────────────────────────────────────────────
// The engine normalises an unknown structure id to a 4×4 block when no shape is
// given, and rejects anything that is not exactly 4 rows of 4 zeros and ones.
// So this is not a general grid editor with a size setting — it is one shape.

const SHAPE_SIZE = 4;

/** A full 4×4 grid of `fill`. */
export function emptyShape(fill: 0 | 1 = 0): number[][] {
    return Array.from({ length: SHAPE_SIZE }, () => Array<number>(SHAPE_SIZE).fill(fill));
}

/** Coerce any stored shape into a valid 4×4 0/1 matrix. Bad input is clamped, not rejected. */
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

/** Serialise for the form field (compact one-row-per-line JSON). */
export function shapeToText(raw: unknown): string {
    return JSON.stringify(normalizeShape(raw));
}

/** Human summary shown under the grid. */
export function describeShape(raw: unknown): string {
    const grid = normalizeShape(raw);
    const filled = grid.flat().filter((v) => v === 1).length;
    if (filled === 0) return "empty (0 of 16 cells)";
    if (filled === 16) return "solid 4×4 block (16 of 16 cells)";
    return `custom — ${filled} of 16 cells occupied`;
}

/** 4×4 footprint field: visual grid editor instead of a raw JSON textarea. */
function shapeField(): FieldSpec {
    return {
        key: "shapeJson",
        label: "Shape (4×4)",
        kind: "shape",
        section: "Placement",
        wide: true,
        // A new structure starts as a solid block, matching the engine default.
        // Stated as a field default rather than a special case in formDefaults,
        // so the shape rule is next to the field it applies to.
        def: shapeToText(emptyShape(1)),
        hint: "1 = occupied cell, 0 = empty. Use the buttons for solid / empty / clear.",
    };
}

// ── Build modes ──────────────────────────────────────────────────────────────

/**
 * Turn the build-modes editor's text into engine `buildModes[]`.
 *
 * Two things the engine cares about, which a naive pass-through gets wrong:
 *
 *  - `spanTiles` is only legal on a `"line"` mode. The engine's own validator
 *    throws `TypeError` otherwise, so it is dropped here rather than at load
 *    time, where the user would only find out by reloading the game.
 *  - `directions` belongs to each mode, but the form shows one set of direction
 *    checkboxes, so it is written onto every mode.
 *
 * An unparseable value yields `[]` and the field's own error reports the bad
 * JSON. Guessing here would overwrite the user's text with something else.
 */
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

// ── Hover tooltip ────────────────────────────────────────────────────────────

/** Build a `StructureTooltipHover` from the controls, or `undefined` when no key is set. */
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

/** Can the `tooltipHover` controls express this object? If not, the raw box is shown. */
export function tooltipHoverIsComplete(raw: string | undefined): boolean {
    const obj = parseObjectOrUndefined(raw);
    if (!obj) return true; // nothing stored, nothing to warn about
    const msg = (obj as { dataFieldMessage?: Record<string, unknown> }).dataFieldMessage;
    if (!msg) return false;
    if (typeof msg.message === "string") return false; // a literal, not a key
    const fields = Array.isArray(msg.fields) ? msg.fields : [];
    if (fields.length !== 1) return false; // the form has exactly one field row
    const only = fields[0] as Record<string, unknown>;
    if ("valueLabels" in only || "valueKeys" in only) return false;
    return Object.keys(only).every((k) => ["field", "param", "fallback"].includes(k));
}

// ── The schema ───────────────────────────────────────────────────────────────

/**
 * Every structure field, in panel order.
 *
 * Order is layout as well as content: `sectionsFor` groups consecutive fields by
 * their `section`, so moving one field here moves a section boundary.
 */
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
        // engine type: Record<string, string | number>
        key: "descriptionParamsJson",
        label: "Description parameters",
        kind: "json",
        section: "Identity",
        jsonType: "object",
        wide: true,
        hint: 'values interpolated into the description, e.g. { "count": 3 }',
    },
    {
        // The engine compares this against exactly one string,
        // `"allOrNothing"`. It was a text box, so a typo read as `undefined`
        // and silently behaved as "per cell" — a switch wearing a text box's
        // clothes. See catalog.listLinkedClearance.
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
        section: "Build menu",
        required: true,
        options: listStructureCategories,
        def: "blocks",
        hint: "grouping in the build window",
    },
    numField("order", "Order", "Build menu", {
        min: 0,
        max: 9999,
        hint: "sort inside the category",
    }),
    {
        // engine: `ot(t.buildModes)` → `Array.isArray(e) && e.forEach(rt)`,
        // and `rt` throws `spanTiles` unless `type === "line"`. The engine
        // takes a LIST and a structure may legitimately have several (a
        // line mode for dragging a run, plus a single mode for one node).
        // The form held exactly one, so extra modes were dropped on save
        // without a word. Now it is a real repeating list.
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
    shapeField(),
    // The menu-visibility lever. `alwaysUnlocked` is gone: the engine reads it in
    // exactly one place, iterating a `const` literal of the *vanilla* structures,
    // which has no assignment site a mod id can enter. The **unlock node** is the
    // lever instead — an entry the author names and edits: an "always" node says
    // the same thing, legibly and shared between structures.
    //
    // **This flag is mod-layer, not an engine field.** A scan of all 762 bundle
    // chunks found no menu-visibility option for structures at all — the only
    // `hidden` in the engine is a CSS property and `isHidden` is React's. An
    // earlier comment here said the build menu "does honour" it and cited
    // bundel.js 7493921.js; that file does not exist in this bundle and the name
    // appears nowhere in it, so both the claim and the citation were wrong. What
    // the flag actually does is filter the mod's own list — see `HIDDEN_FIELD` in
    // ../../panel/list.ts, which reads it under this name.
    //
    // It used to be spelled `hideFromBuildMenu`. That spelling is still honoured
    // as a fallback so existing configs keep filtering as their author intended,
    // but new writes use this one.
    boolField(
        "hideFromBuildMenu",
        "Hide from build menu",
        "Flags",
        "false",
        "unhide to list it — a structure with no unlock tech is available from the start",
    ),
    {
        // Every structure names a node, so the picker never offers an empty
        // "— none —": "available from the start" is a *node you can see and
        // edit*, not an absent field that quietly means the same thing.
        //
        // The current value is re-added when it is not in the list, so a link to
        // a deleted node survives the round trip as a visible "(missing node)"
        // option rather than silently reverting the structure.
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
        key: "rejectWhenBlocked",
        label: "Reject when blocked",
        kind: "bool",
        section: "Placement",
        hint: "refuse placement if any footprint cell is occupied",
    },
    {
        // engine type: StructureTooltipHover — { type: "custom", dataFieldMessage }
        key: "tooltipHoverJson",
        label: "Hover tooltip",
        kind: "json",
        section: "Render",
        jsonType: "object",
        wide: true,
        hint: "custom tooltip driven by structure data fields",
    },
    {
        // engine type: StructureVariant[] — { id: StructureRef; angles: number[] }[]
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
        // engine: registerStructureType(blockGridType ?? id), then
        // registerStructureTypeAlias(id, blockGridType) when it differs.
        //
        // Not a grid *setting* — it names which block grid the structure
        // joins. Two real uses, and the second is the one that bites:
        //
        //  1. Share one grid with another structure (value = its id).
        //  2. Give a LARGE structure its own grid by setting it to its own
        //     id. `__scraped-mods/workshop/3791498201` documents this: a
        //     20x20 Resource Silo omitted it and behaved as a 1-cell unit
        //     with a hover tooltip that only resolved at the origin cell.
        //     "Every reference mod that omitted blockGridType only ever used
        //     shapes up to 8x8." So above 8x8 it is not optional.
        //
        // Left empty is only safe for a small structure.
        key: "blockGridType",
        label: "Block grid type",
        kind: "select",
        section: "Grid",
        // Not filtered by the id being edited, unlike the "share with
        // another" pickers: setting this to the structure's OWN id is the
        // documented fix for a large footprint, so it must be offered.
        options: listStructures,
        emptyHint:
            "no other structures exist yet — save this one first, then pick its own id from the list.",
        hint:
            "leave empty only for a footprint of 8x8 or smaller. Above that, set this to the structure's OWN id: without it a large structure places as a single 1-cell unit and its hover tooltip only resolves at the origin cell. Point it at a DIFFERENT structure to share that structure's grid instead.",
    },
    {
        // `draw` is a callback: `T(id, fn)`, called as
        // `fn(session, instance, {tilemap, ctx, useTilemap, placing, opts})`,
        // where returning `false` falls through to the normal sprite render.
        // It cannot be stored as JSON, so the config holds a key that
        // apply.ts resolves. This was previously a free JSON box that
        // nothing ever read, so a value set here did nothing at all.
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
        // engine: !1 === t.copyData && (t.skipCopyData = !0) — setting copyData
        // to false is enough, so this is offered as the clearer spelling
        key: "skipCopyData",
        label: "Skip data copy",
        kind: "bool",
        section: "Grid",
        def: "false",
        hint:
            "do not copy grid data on placement (the engine also sets this when copyData is false)",
    },
    {
        // engine deep-clones: t.defaultData = JSON.parse(JSON.stringify(...)),
        // then on placement `instance.data = clone(defaultData)`. So this is
        // the data object every placed copy starts with — NOT anything to do
        // with elements, which is what the old label suggested. The hover
        // tooltip reads it back through dataField1..4.
        key: "defaultDataJson",
        label: "Data for each placed copy",
        kind: "json",
        section: "Grid",
        jsonType: "object",
        wide: true,
        hint:
            "the data object every placed copy starts with; the hover tooltip reads dataField1..4 back out of it. Unrelated to elements.",
    },
    advField(),
];

// ── Round trip ───────────────────────────────────────────────────────────────

/** Stored entry → form strings, for the whole structure. */
function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("name", read.str(e.name));
    read.put("description", read.str(e.description));
    read.put("descriptionKey", read.str(e.descriptionKey));
    read.put("descriptionParamsJson", read.json(e.descriptionParams));
    read.put("linkedClearance", read.str(e.linkedClearance));
    read.put("categoryKey", read.str(e.categoryKey));
    read.put("order", read.num(e.order));
    // The whole list round-trips. A single-mode form, plus loose dirH/dirV/dirD
    // booleans, loses every mode after the first.
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
    // `alwaysUnlocked` is deliberately absent. The control was removed (the
    // engine ignores it on a mod structure — `apply.ts` reads it only while
    // iterating a literal of the *vanilla* structures), and the unlock node
    // replaced it. Listing it here or reading it into the form would claim
    // ownership the panel no longer has, and the stored value would be dropped
    // on the next edit instead of falling into the passthrough.
    // The hidden flag, under the one name the entry uses, always into the live
    // form key. A config still carrying the brief `hiddenFromTheMenu` spelling
    // is not honoured: that name existed for one build of this mod, and reading
    // it here meant an entry that had not been touched in a long time reported
    // a visibility choice the current form would then rewrite.
    if (typeof e.hideFromBuildMenu === "boolean") {
        read.put("hideFromBuildMenu", String(e.hideFromBuildMenu));
    }
    if (typeof e.disallowPick === "boolean") read.put("disallowPick", String(e.disallowPick));
    // Read in full, including a link to a node that no longer exists: a
    // dangling node is resolved to "available from the start" at apply time, so
    // dropping it here would silently repair the structure behind the user's
    // back. It stays visible and repairable instead.
    read.put("unlockNode", read.str(e.unlockNode));
    if (typeof e.rejectWhenBlocked === "boolean") {
        read.put("rejectWhenBlocked", String(e.rejectWhenBlocked));
    }
    read.put("tooltipHoverJson", read.json(e.tooltipHover));
    // Split the documented shape into controls, keeping the object so an
    // unrepresentable one (valueLabels, a literal message, several field
    // rows) is still recoverable.
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
}

/** Form strings → stored entry, for the whole structure. */
function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("name", w.opt("name"));
    w.setStr("description", w.opt("description"));
    w.setStr("descriptionKey", w.opt("descriptionKey"));
    w.setStr("linkedClearance", w.opt("linkedClearance"));
    const descriptionParams = w.optJson<Record<string, unknown>>("descriptionParamsJson");
    if (descriptionParams) w.setRaw("descriptionParams", descriptionParams);
    w.setBool("rejectWhenBlocked", w.optBool("rejectWhenBlocked"));
    // Rebuild the documented shape from the controls, unless the stored object
    // held something they cannot express — then keep it verbatim.
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
    // Directions live on every mode; the booleans drive the first one.
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
    // Omitted means "available from the start" at apply time, so an empty
    // picker is a valid save and is not written as an empty string.
    w.setStr("unlockNode", w.opt("unlockNode"));
    const image = w.opt("imageName");
    if (image) w.setRaw("render", { imageName: image });
    w.setStr("blockGridType", w.opt("blockGridType"));
    w.setBool("skipCopyData", w.optBool("skipCopyData"));
    const drawKey = w.opt("drawKey") ?? "default";
    if (drawKey !== "default") w.setStr("drawKey", drawKey);
    const defaultData = w.optJson<Record<string, unknown>>("defaultDataJson");
    if (defaultData) w.setRaw("defaultData", defaultData);
}

/** Rules no single field can express: the engine throws on `spanTiles` off a line mode. */
function validate(form: Record<string, string>, errors: Record<string, string>): void {
    if (errors.buildModesJson) return; // its own error already explains it
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
        // the json control reports the parse error
    }
}

/** Parse a 4×4 matrix from text; returns null when not exactly 4 rows of 4. */
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

/** Validate one structure-only field kind. The 4×4 rule lives here: only a structure has a shape. */
function validateField(field: FieldSpec, value: string): string | undefined {
    if (field.kind !== "shape") return undefined;
    return parseShape(value) === null
        ? `must be a ${SHAPE_SIZE}×${SHAPE_SIZE} grid of 0 or 1`
        : undefined;
}

// ── The section panel ────────────────────────────────────────────────────────

/** 4×4 footprint editor, since the engine only accepts a 4×4 matrix of 0/1. */
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

/**
 * `buildModes[]` editor — one row per build mode.
 *
 * The engine takes a **list** (`Array.isArray(e) && e.forEach(rt)`) and a
 * structure may have several: a line mode for dragging out a pipe run plus a
 * single mode for dropping one node. A single-mode form drops the rest on save —
 * silently, leaving a structure that behaves in a way the form never describes.
 *
 * `spanTiles` is per-row because the engine validates it per mode and throws:
 * `rt` rejects `spanTiles` on any `type` other than `"line"`.
 */
function renderBuildModes(ctx: FieldContext): unknown {
    const { h, field, value, locked } = ctx;
    let rows: Record<string, unknown>[] = [];
    try {
        const parsed = JSON.parse(value || "[]");
        if (Array.isArray(parsed)) rows = parsed;
    } catch {
        // raw value stays; validation reports it
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
                                    // spanTiles is meaningless off a line mode, and
                                    // leaving it behind would make the engine throw
                                    // on register.
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

/** The unlock relation, said in words. The picker names the node but not its kind or cost. */
function renderHeader(ctx: PanelContext): unknown {
    return ctx.h(
        "div",
        { key: "unlock-row", style: S.unlockRow },
        ctx.h("span", { style: S.unlockText }, unlockLine(ctx.form, ctx.cfg)),
    );
}

/** The control for a structure-only field kind, or `null` for the generic ones the panel already draws. */
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

// ── The definition ───────────────────────────────────────────────────────────

/**
 * Stored keys this form owns.
 *
 * Everything else round-trips through the passthrough, so a key the engine
 * understands but this form has no control for survives an edit instead of being
 * dropped. `render` and `imageName` are both listed because the stored shape is
 * `render.imageName` and the form drives the sprite from one control; `draw` and
 * `spanTiles` are the *engine* spellings of `drawKey` and the mode list, listed
 * so a config carrying either is claimed rather than carried twice.
 */
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
    // A structure must name an unlock node, so a new one starts on the built-in
    // default rather than on nothing. Without this the required field opens
    // empty and blocks the first save on a rule the author never chose —
    // "available from the start" is a decision, and this is where it is pre-made
    // rather than assumed.
    onNewEntry: (form) => {
        form.unlockNode = DEFAULT_UNLOCK_NODE;
    },
    panel: { renderField, renderHeader },
};
