
import type { DefinitionList, ListRenderCtx, ListRow } from "../definition/types.ts";
import { discoverElements } from "../../catalog.ts";
import { brief, type DetailSpec, disclosureMark, originTag, renderDetail } from "./list.ts";
import * as S from "../styles.ts";


function field(ctx: ListRenderCtx, key: string): unknown {
    return ctx.row.native?.[key] ?? ctx.row.entry?.[key];
}


function inlineRender(ctx: ListRenderCtx): unknown {
    const { h, row } = ctx;
    const matter = brief(field(ctx, "matterType"));
    return h(
        "div",
        { style: S.rowHead },
        disclosureMark(h, ctx),
        h("span", { style: { ...S.rowSwatch, background: row.color ?? "#5a6478" } }),
        h("span", { style: S.rowTitle, title: row.label }, row.label),
        h("span", { style: S.rowId }, row.id),
        matter ? h("span", { style: S.rowFact }, matter) : null,
        originTag(h, row),
    );
}


const DETAILS: DetailSpec = {
    fields: [
        { key: "matterType", label: "Matter" },
        { key: "density", label: "Density" },
        { key: "materialId", label: "Material" },
        { key: "duration", label: "Lifetime" },
        {
            key: "durationRandom",
            label: "Lifetime variance",
            pick: (s) =>
                typeof s.durationRandom === "object" && s.durationRandom
                    ? Object.entries(s.durationRandom as Record<string, unknown>)
                        .map(([k, v]) => `${k} ${brief(v)}`)
                        .join(", ")
                    : s.durationRandom,
        },
        { key: "isGrabbable", label: "Grabbable" },
        { key: "isTransportable", label: "Transportable" },
        { key: "collectable", label: "Collectable" },
        { key: "flammable", label: "Flammable" },
        { key: "visibleInPicker", label: "In picker" },
        { key: "defaultDataFields", label: "Data fields" },
        { key: "metaColor", label: "Map colour" },
        {
            key: "colors",
            label: "Colours",
            
            
            pick: (s) => {
                const c = s.colors as { variants?: unknown[] } | unknown[] | undefined;
                const n = Array.isArray(c) ? c.length : (c as { variants?: unknown[] })?.variants
                    ?.length;
                return typeof n === "number" ? `${n} variant${n === 1 ? "" : "s"}` : c;
            },
        },
    ],
    
    
    skip: ["elementType", "matterTypes", "matterTypeNames", "dataFieldCount"],
};

function infoRender(ctx: ListRenderCtx): unknown {
    return renderDetail(ctx.h as never, ctx, DETAILS);
}


function searchText(row: ListRow): string {
    const src = row.native ?? row.entry ?? {};
    return ["matterType", "density", "flammable", "isGrabbable", "collectable"]
        .map((k) => `${k} ${brief(src[k])}`)
        .join(" ");
}

export const elementList: DefinitionList = {
    discover: () => discoverElements(),
    inlineRender,
    infoRender,
    searchText,
};
