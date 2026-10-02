import type { DefinitionList, ListRenderCtx, ListRow } from "../definition/types.ts";
import { discoverTerrains } from "../../catalog.ts";
import { brief, type DetailSpec, disclosureMark, originTag, renderDetail } from "./list.ts";
import * as S from "../styles.ts";

function field(ctx: ListRenderCtx, key: string): unknown {
    return ctx.row.native?.[key] ?? ctx.row.entry?.[key];
}

function swatch(ctx: ListRenderCtx): string | undefined {
    const packed = field(ctx, "color");
    if (typeof packed === "number" && Number.isFinite(packed)) {
        const rgb = (packed >>> 0) & 0xffffff;
        return `#${rgb.toString(16).padStart(6, "0")}`;
    }
    if (typeof packed === "string" && /^#?[0-9a-fA-F]{6}/.test(packed)) {
        return packed.startsWith("#") ? packed.slice(0, 7) : `#${packed.slice(0, 6)}`;
    }
    const hsl = field(ctx, "colorHSL");
    if (Array.isArray(hsl) && hsl.length >= 3) {
        const [hh, s, l] = hsl as number[];
        if ([hh, s, l].every((n) => typeof n === "number" && Number.isFinite(n))) {
            return `hsl(${Math.round(hh * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
        }
    }

    return ctx.row.color;
}

function inlineRender(ctx: ListRenderCtx): unknown {
    const { h, row } = ctx;
    const color = swatch(ctx);
    const hp = field(ctx, "hp") ?? field(ctx, "hitPoints");
    return h(
        "div",
        { style: S.rowHead },
        disclosureMark(h, ctx),
        h("span", { style: { ...S.rowSwatch, background: color ?? "#5a6478" } }),
        h("span", { style: S.rowTitle, title: row.label }, row.label),
        h("span", { style: S.rowId }, row.id),
        typeof hp === "number"
            ? h("span", { style: S.rowFact, title: "Hit points" }, `${hp} hp`)
            : null,
        originTag(h, row),
    );
}

const DETAILS: DetailSpec = {
    fields: [
        { key: "hp", label: "Hit points" },
        { key: "materialId", label: "Material id" },
        { key: "isBuilding", label: "Counts as a building" },
        { key: "flammable", label: "Flammable" },
        { key: "noShadow", label: "No shadow" },
        { key: "fog", label: "Fog" },
        { key: "output", label: "Drops" },
        { key: "excavationRequirements", label: "Needs tools" },
        { key: "interactions", label: "Interactions" },
        {
            key: "colorHSL",
            label: "Colour",

            pick: (s) => s.colorHSL ?? s.metaColor,
        },
    ],

    skip: [
        "hitPoints",
        "colorPattern",
        "colorGradient",
        "colorHSL",
        "backgroundElementType",
        "background",
    ],
};

function infoRender(ctx: ListRenderCtx): unknown {
    return renderDetail(ctx.h as never, ctx, DETAILS);
}

function searchText(row: ListRow): string {
    const src = row.native ?? row.entry ?? {};
    return [brief(src.hp ?? src.hitPoints), brief(src.materialId), brief(src.flammable)].join(" ");
}

export const terrainList: DefinitionList = {
    discover: () => discoverTerrains(),
    inlineRender,
    infoRender,
    searchText,
};
