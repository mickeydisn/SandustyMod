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
import { brief, type DetailSpec, disclosureMark, originTag, renderDetail } from "./list.ts";
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
const DETAILS: DetailSpec = {
    fields: [
        // `hp` and `hitPoints` are the same fact under two names, engine-side and
        // config-side. `hp` wins because that is the engine's spelling, and a row
        // showing the engine's value is the reason this block exists.
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
            // A hue is not a colour a person can act on; the packed value is
            // shown instead, which is what the swatch above is drawn from.
            pick: (s) => s.colorHSL ?? s.metaColor,
        },
    ],
    // `hitPoints` is the config-side spelling of `hp`; `colorPattern` and
    // `colorGradient` are render payloads, not facts to read.
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
