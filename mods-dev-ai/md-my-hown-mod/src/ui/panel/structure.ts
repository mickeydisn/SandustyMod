/**
 * The **structure** list panel.
 *
 * A structure's most defining property is its **shape** — a 4×4 footprint grid
 * that says where it goes in the world — and it is the one object whose most
 * useful list view is genuinely a picture rather than a line of text. So the row
 * draws the footprint.
 *
 * That earns its cost because the alternative is an id and a category, which
 * cannot distinguish a 1×1 from a 4×4 conveyor at a glance. "Which of my
 * buildings is the wide one?" is a question a mod author asks constantly, and
 * answering it needs the grid.
 *
 * The shape comes from the mod's own entry. A *game* structure usually has no
 * readable definition — `structures` has no enumeration call, and
 * `getAvailableTypes()` yields a `Set<StructureRef>` whose members may be bare
 * type numbers — so a game row is drawn without a grid rather than with a wrong
 * one. A missing grid is honest; an invented one misstates the world.
 *
 * Ground truth: `doc/doc-artifacts/doc.api/shared/api.structures.md`.
 */
import type { DefinitionList, ListRenderCtx, ListRow } from "../definition/types.ts";
import { discoverStructures } from "../../catalog.ts";
import { brief, type DetailSpec, disclosureMark, originTag, renderDetail } from "./list.ts";
import * as S from "../styles.ts";

/** Read a field from the engine's definition, falling back to the mod's entry. */
function field(ctx: ListRenderCtx, key: string): unknown {
    return ctx.row.native?.[key] ?? ctx.row.entry?.[key];
}

/** `[[1,0],[0,1]]` → a drawable grid, or `null` when there is no usable shape. */
function gridOf(v: unknown): number[][] | null {
    if (!Array.isArray(v) || !v.length) return null;
    const out: number[][] = [];
    for (const line of v) {
        if (!Array.isArray(line) || !line.length) return null;
        // Anything that is not a 0/1 cell is not a footprint; a partial grid
        // would draw as a shape the engine does not have.
        if (!line.every((c) => c === 0 || c === 1)) return null;
        out.push(line as number[]);
    }
    // Ragged rows would draw as a ragged building. The engine's grid is
    // rectangular, so a ragged one means the field was misread.
    const w = out[0].length;
    if (!out.every((r) => r.length === w)) return null;
    return out;
}

/** The engine's largest footprint edge (4×4), which sizes the fixed slot. */
const FOOTPRINT_CELLS = 4;

/**
 * A tiny footprint, drawn as a grid of filled cells — in a slot of *fixed* size.
 *
 * The fixed slot is the point, and it is what makes every structure row line up.
 * A game structure usually has no readable `shape`, so with no placeholder its
 * name would start at the left edge while a modded structure's name started after
 * a grid — two rows in one list with their text at different x, and two different
 * row heights. The list looked broken rather than informative.
 *
 * So the slot is always drawn, filled or not, and the engine's 4×4 maximum sizes
 * it. A 1×1 footprint therefore sits inside a 4×4 box instead of growing the row,
 * which is what keeps the column of names straight down the screen.
 */
function footprint(h: (...a: unknown[]) => unknown, grid: number[][] | null): unknown {
    const cells = FOOTPRINT_CELLS * FOOTPRINT_CELLS;
    return h(
        "div",
        {
            style: { ...S.rowGrid, gridTemplateColumns: `repeat(${FOOTPRINT_CELLS}, 4px)` },
            title: grid
                ? `${grid.length}×${grid[0].length} footprint`
                : "no footprint readable from the game",
        },
        // The cells with no shape behind them are drawn empty rather than skipped,
        // so the box is the same size whether or not there is a shape to show.
        ...Array.from({ length: cells }, (_, i) => {
            const y = Math.floor(i / FOOTPRINT_CELLS);
            const x = i % FOOTPRINT_CELLS;
            return h("span", {
                key: `${y}:${x}`,
                style: {
                    ...S.gridCell,
                    background: grid?.[y]?.[x] === 1 ? "#9fb4d8" : "transparent",
                },
            });
        }),
    );
}

/**
 * The row line: footprint when known, then name, id, and the category.
 *
 * The category is here rather than in the detail because it is the other half of
 * the "which of mine is a conveyor" question, and answering it needs no click.
 */
function inlineRender(ctx: ListRenderCtx): unknown {
    const { h, row } = ctx;
    const grid = gridOf(field(ctx, "shape"));
    const category = brief(field(ctx, "category"));
    return h(
        "div",
        { style: S.rowHead },
        disclosureMark(h, ctx),
        // Always drawn, so every structure row's name starts at the same x — a
        // row with no footprint must not start its text further left than one
        // with a footprint.
        footprint(h, grid),
        h("span", { style: S.rowTitle, title: row.label }, row.label),
        h("span", { style: S.rowId }, row.id),
        category ? h("span", { style: S.rowFact }, category) : null,
        originTag(h, row),
    );
}

/**
 * The expanded detail: the unlock relation first, then the placement facts.
 *
 * The unlock node leads because it is the one field a structure cannot be saved
 * without, and it is a reference to *another object in this mod* — so the row
 * says which node gates it, which decides whether a player can ever build the
 * thing at all.
 */
const DETAILS: DetailSpec = {
    fields: [
        {
            key: "shape",
            label: "Footprint",
            // "2×3" reads; `[[1,1],[1,0],[1,1]]` is a payload, and the row above
            // already draws the grid.
            pick: (s) => {
                const g = gridOf(s.shape);
                return g ? `${g.length}×${g[0].length}` : s.shape;
            },
        },
        { key: "categoryKey", label: "Category" },
        { key: "unlockNode", label: "Unlock node" },
        {
            key: "buildModes",
            label: "Build modes",
            // A short list of mode types is a fact; the full objects are not.
            pick: (s) => {
                const m = s.buildModes as { type?: unknown }[] | undefined;
                if (!Array.isArray(m)) return s.buildModes;
                if (m.length === 0) return "none";
                return m.map((x) => brief(x?.type ?? x)).join(", ");
            },
        },
        { key: "hideFromBuildMenu", label: "In build menu" },
        { key: "energyType", label: "Energy type" },
        { key: "energyCapacity", label: "Energy capacity" },
        { key: "hitPoints", label: "Hit points" },
        { key: "mass", label: "Mass" },
        { key: "rotateToPlace", label: "Rotatable" },
        { key: "disallowPick", label: "Cannot be picked" },
        { key: "order", label: "Order" },
    ],
    // The shape itself is shown as a size, and the render payload is a blob.
    skip: ["shape", "buildModes", "registerOptions", "type", "structureType"],
};

function infoRender(ctx: ListRenderCtx): unknown {
    return renderDetail(ctx.h as never, ctx, DETAILS);
}

/** Category and footprint size are searchable, so "which of mine is 4 wide" works. */
function searchText(row: ListRow): string {
    const src = row.native ?? row.entry ?? {};
    const grid = gridOf(src.shape);
    return [brief(src.category), grid ? `${grid.length}x${grid[0].length}` : ""].join(" ");
}

export const structureList: DefinitionList = {
    discover: () => discoverStructures(),
    inlineRender,
    infoRender,
    searchText,
};
