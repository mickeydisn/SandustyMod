import type { DefinitionList, ListRenderCtx, ListRow } from "../definition/types.ts";
import { discoverStructures } from "../../catalog.ts";
import { brief, type DetailSpec, disclosureMark, originTag, renderDetail } from "./list.ts";
import * as S from "../styles.ts";

function field(ctx: ListRenderCtx, key: string): unknown {
    return ctx.row.native?.[key] ?? ctx.row.entry?.[key];
}

function gridOf(v: unknown): number[][] | null {
    if (!Array.isArray(v) || !v.length) return null;
    const out: number[][] = [];
    for (const line of v) {
        if (!Array.isArray(line) || !line.length) return null;

        if (!line.every((c) => c === 0 || c === 1)) return null;
        out.push(line as number[]);
    }

    const w = out[0].length;
    if (!out.every((r) => r.length === w)) return null;
    return out;
}

const FOOTPRINT_CELLS = 4;

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

function inlineRender(ctx: ListRenderCtx): unknown {
    const { h, row } = ctx;
    const grid = gridOf(field(ctx, "shape"));
    const category = brief(field(ctx, "category"));
    return h(
        "div",
        { style: S.rowHead },
        disclosureMark(h, ctx),
        footprint(h, grid),
        h("span", { style: S.rowTitle, title: row.label }, row.label),
        h("span", { style: S.rowId }, row.id),
        category ? h("span", { style: S.rowFact }, category) : null,
        originTag(h, row),
    );
}

const DETAILS: DetailSpec = {
    fields: [
        {
            key: "shape",
            label: "Footprint",

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

    skip: ["shape", "buildModes", "registerOptions", "type", "structureType"],
};

function infoRender(ctx: ListRenderCtx): unknown {
    return renderDetail(ctx.h as never, ctx, DETAILS);
}

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
