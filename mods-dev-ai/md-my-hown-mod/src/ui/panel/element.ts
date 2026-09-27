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
import { disclosureMark, originTag } from "../list-panel.ts";
import * as S from "../styles.ts";

/** The value to read for a field, from the engine's definition or the entry. */
function field(ctx: ListRenderCtx, key: string): unknown {
    return ctx.row.native?.[key] ?? ctx.row.entry?.[key];
}

/** A short, human-readable value: numbers trimmed, objects summarised. */
function brief(v: unknown): string {
    if (v === undefined || v === null || v === "") return "";
    if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
    if (typeof v === "object") {
        const o = v as Record<string, unknown>;
        // A nested payload's one identifying key, not its whole shape.
        for (const k of ["id", "name", "type", "nameKey"]) {
            if (typeof o[k] === "string" && o[k]) return String(o[k]);
        }
        return Array.isArray(v) ? `${(v as unknown[]).length} entries` : "set";
    }
    return String(v);
}

/**
 * The row line: swatch, name, and the matter type as the one fact worth showing
 * before the user clicks.
 *
 * Matter type rather than density because it is the only element property that
 * is always a short closed word. Density is a number whose interesting range
 * depends on the unit, and a four-digit number in a list row is noise.
 */
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
 * Reads the engine's definition first and falls back to the mod's own entry, so
 * the same fields are shown for both origins. `hidden` and `visibleInPicker` are
 * included deliberately: an element that is hidden is invisible in-game but
 * still perfectly editable here, and a user who cannot tell why their element
 * does not appear in a picker will assume the mod is broken.
 */
function infoRender(ctx: ListRenderCtx): unknown {
    const { h, row } = ctx;
    const rows: [string, string][] = [];
    const add = (label: string, v: unknown) => {
        const s = brief(v);
        if (s) rows.push([label, s]);
    };
    add("Matter", field(ctx, "matterType"));
    add("Density", field(ctx, "density"));
    add("Flammable", field(ctx, "flammable"));
    add("Grabbable", field(ctx, "isGrabbable"));
    add("Transportable", field(ctx, "isTransportable"));
    add("Collectable", field(ctx, "collectable"));
    add("Hidden", field(ctx, "hidden"));
    add("In picker", field(ctx, "visibleInPicker"));
    if (!rows.length) return null;
    return h(
        "div",
        { style: S.rowDetail },
        h(
            "div",
            { style: S.detailNote },
            row.origin === "game"
                ? "The engine's own values for this element."
                : "The values this mod stores. Saved by editing the row.",
        ),
        ...rows.map(([k, v]) =>
            h(
                "div",
                { key: k, style: S.detailLine },
                h("span", { style: S.detailKey }, k),
                h("span", { style: S.detailVal }, v),
            )
        ),
    );
}

/**
 * Search text beyond the id and name.
 *
 * The matter type and the flags are in here so that searching "powder" or
 * "flammable" finds the elements that have them. Without it the filter only
 * matches names, and a user looking for "which of mine are flammable?" gets
 * nothing — the one question the list is best placed to answer.
 */
function searchText(row: ListRow): string {
    const src = row.native ?? row.entry ?? {};
    return ["matterType", "density", "flammable", "isGrabbable", "collectable", "hidden"]
        .map((k) => brief(src[k]))
        .join(" ");
}

export const elementList: DefinitionList = {
    discover: () => discoverElements(),
    inlineRender,
    infoRender,
    searchText,
};
