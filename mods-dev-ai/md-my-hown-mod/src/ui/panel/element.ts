/**
 * The **element** list panel — what one element row says about itself.
 *
 * An element is the clearest case for a real list rather than a list of names,
 * and it is the case the shared renderer cannot do alone. Two things are true of
 * an element that are true of nothing else in the panel:
 *
 *  - **it has a colour**, and it is the one thing about an element a user
 *    recognises faster than its name;
 *  - **the engine may know more than we do**. For a game element the host holds
 *    a real definition — density, matter type, flammability — for something this
 *    mod never declared, and there is nowhere else in the panel to see it.
 *
 * So the row is drawn here rather than by the shared fallback, and the density
 * shown is the *engine's* number for a game row and the config's for a mod row.
 * Those are the same field with different provenance, and the detail says which:
 * a user comparing their own element to Sand needs to know they are reading the
 * engine's value, not a stale copy of their own.
 *
 * Ground truth: `doc/doc-artifacts/doc.api/shared/api.elements.md`.
 */
import type { DefinitionList, ListRenderCtx, ListRow } from "../definition/types.ts";
import { discoverElements } from "../../catalog.ts";
import { brief, type DetailSpec, disclosureMark, originTag, renderDetail } from "./list.ts";
import * as S from "../styles.ts";

/** The value to read for a field, from the engine's definition or the entry. */
function field(ctx: ListRenderCtx, key: string): unknown {
    return ctx.row.native?.[key] ?? ctx.row.entry?.[key];
}

/** The row line: swatch, name, and the matter type — a closed word, where density is noise. */
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

/**
 * The expanded detail.
 *
 * Curated, in the order a person asks about an element: what it is made of,
 * how it behaves, how it moves, how long it lives. Everything the engine's own
 * definition carries beyond this — a field added in a later build — is listed
 * after it rather than dropped, which is the point of the catch-all.
 *
 * `visibleInPicker` is shown because it decides the "hidden" filter, and an
 * element that is not in the picker looks broken to anyone who has not read the
 * source. The engine's own `hidden` flag is not shown: `HIDDEN_FIELD` points the
 * elements filter at `visibleInPicker`, so it was a second switch for one
 * decision and nothing acted on it.
 */
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
            // The variant count, not the raw array: `[142,200,255,255]` four
            // times over is a payload, not a fact a person reads.
            pick: (s) => {
                const c = s.colors as { variants?: unknown[] } | unknown[] | undefined;
                const n = Array.isArray(c) ? c.length : (c as { variants?: unknown[] })?.variants
                    ?.length;
                return typeof n === "number" ? `${n} variant${n === 1 ? "" : "s"}` : c;
            },
        },
    ],
    // `elementType` is the engine's numeric handle: real, but the id already
    // names the object and a number here reads as a bug.
    skip: ["elementType", "matterTypes", "matterTypeNames", "dataFieldCount"],
};

function infoRender(ctx: ListRenderCtx): unknown {
    return renderDetail(ctx.h as never, ctx, DETAILS);
}

/** Search text beyond id and name. The key name is searched too, not just its value. */
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
