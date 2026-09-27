/**
 * The **terrain** list panel.
 *
 * A terrain is a diggable tile, and the two things worth seeing are its
 * **colour** — terrains are the one object the player reads by colour rather
 * than by name — and its **hit points**, which is what says whether a tool can
 * cut it at all.
 *
 * The colour is the interesting part, and it is not always where it looks. A
 * terrain may state its colour three ways: a packed `0xRRGGBB`, an HSL triple,
 * or both. The list reads all three and prefers whichever is present, because a
 * swatch that is empty for half the terrains is worse than no swatch column — it
 * makes the row look broken rather than unusual.
 *
 * Ground truth: `doc/doc-tech/06-registering-terrains.md`.
 */
import type { DefinitionList, ListRenderCtx, ListRow } from "../definition/types.ts";
import { discoverTerrains } from "../../catalog.ts";
import { disclosureMark, originTag } from "../list-panel.ts";
import * as S from "../styles.ts";

/** Read a field from the engine's definition, falling back to the mod's entry. */
function field(ctx: ListRenderCtx, key: string): unknown {
    return ctx.row.native?.[key] ?? ctx.row.entry?.[key];
}

/** `#rrggbb` from a packed int, a hex string, or an `[h,s,l]` triple. */
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
    // The stored colour is usually already normalised to `#rrggbb` on the row
    // by the discovery pass; this is the fallback for a mod entry with no
    // colour at all.
    return ctx.row.color;
}

function brief(v: unknown): string {
    if (v === undefined || v === null || v === "") return "";
    if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
    if (typeof v === "object") {
        const o = v as Record<string, unknown>;
        for (const k of ["id", "name", "type", "nameKey"]) {
            if (typeof o[k] === "string" && o[k]) return String(o[k]);
        }
        return Array.isArray(v) ? `${(v as unknown[]).length} entries` : "set";
    }
    return String(v);
}

/** Swatch, name, id, hit points — the four things that identify a terrain. */
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

/**
 * The expanded detail.
 *
 * `materialId` and `excavationRequirements` are in here rather than on the line
 * because they are the two that decide *how* a terrain is dug, and a user
 * comparing their ore against the game's is looking for exactly those.
 */
function infoRender(ctx: ListRenderCtx): unknown {
    const { h, row } = ctx;
    const rows: [string, string][] = [];
    const add = (label: string, v: unknown) => {
        const s = brief(v);
        if (s) rows.push([label, s]);
    };
    add("Hit points", field(ctx, "hp") ?? field(ctx, "hitPoints"));
    add("Material id", field(ctx, "materialId"));
    add("Flammable", field(ctx, "flammable"));
    add("Drops", field(ctx, "output"));
    add("Needs tools", field(ctx, "excavationRequirements"));
    if (!rows.length) return null;
    return h(
        "div",
        { style: S.rowDetail },
        h(
            "div",
            { style: S.detailNote },
            row.origin === "game"
                ? "The engine's own values for this terrain."
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
