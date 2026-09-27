/**
 * The **item** list panel.
 *
 * An item is the one object here whose list is mostly about a *kind*: a tool, a
 * weapon, a gadget and a building are four different things that happen to
 * share an `items` array, and an item's `itemType` is what decides which. So the
 * type leads the row, because "which of mine are weapons" is the first question
 * and the answer should not need a click.
 *
 * The type is also what decides the rest of the row. A weapon has a projectile
 * and damage; a tool has an excavation profile and a dig power; neither is
 * meaningful for the other. Rather than draw every field and let the
 * irrelevant ones sit there empty, the detail draws the fields that belong to
 * the row's own type — so a weapon row shows its projectile and a tool row shows
 * its profile, and neither shows the other's blanks.
 *
 * Ground truth: `doc/doc-tech/07-registering-items.md`.
 */
import type { DefinitionList, ListRenderCtx, ListRow } from "../definition/types.ts";
import { discoverItems } from "../../catalog.ts";
import { disclosureMark, originTag } from "../list-panel.ts";
import * as S from "../styles.ts";

/** Read a field from the engine's definition, falling back to the mod's entry. */
function field(ctx: ListRenderCtx, key: string): unknown {
    return ctx.row.native?.[key] ?? ctx.row.entry?.[key];
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

/**
 * Which fields are worth showing, per item type.
 *
 * Keyed by the type string the engine uses, and matched on a *prefix* so that
 * `weaponGun` and `weaponMelee` both land under the weapon set. An unknown type
 * falls back to the common set rather than to nothing: a row that shows the
 * shared fields is still useful, and showing nothing looks like a failure.
 */
const BY_TYPE: Record<string, [string, string][]> = {
    tool: [
        ["Dig power", "digPower"],
        ["Excavation", "excavationProfileId"],
        ["Cooldown", "cooldown"],
        ["Durability", "maxDurability"],
    ],
    weapon: [
        ["Projectile", "projectileId"],
        ["Damage", "damage"],
        ["Cooldown", "cooldown"],
        ["Ammo", "ammoType"],
        ["Durability", "maxDurability"],
    ],
    building: [
        ["Places", "places"],
        ["Category", "category"],
        ["Hit points", "hitPoints"],
    ],
    gadget: [["Cooldown", "cooldown"], ["Charges", "charges"]],
};

/** Shown for any type not in the table above. */
const COMMON: [string, string][] = [
    ["Type", "itemType"],
    ["Stack size", "maxStackSize"],
    ["Cooldown", "cooldown"],
    ["Sprite", "sprite"],
];

/** The field set for a row, chosen by its type. */
function fieldsFor(itemType: string): [string, string][] {
    const t = itemType.trim().toLowerCase();
    if (!t) return COMMON;
    for (const [prefix, fields] of Object.entries(BY_TYPE)) {
        if (t === prefix || t.startsWith(prefix)) return fields;
    }
    return [[...COMMON[0]], ...COMMON.slice(1)];
}

/** Name, id, and the type as the leading fact. */
function inlineRender(ctx: ListRenderCtx): unknown {
    const { h, row } = ctx;
    const type = brief(field(ctx, "itemType"));
    return h(
        "div",
        { style: S.rowHead },
        disclosureMark(h, ctx),
        h("span", { style: S.rowTitle, title: row.label }, row.label),
        h("span", { style: S.rowId }, row.id),
        type ? h("span", { style: S.rowFact, title: "Item type" }, type) : null,
        originTag(h, row),
    );
}

/**
 * The expanded detail: the fields that belong to *this* item's type.
 *
 * `itemType` is always shown, even when the type-specific set already implies
 * it, because a row whose type is missing from its own detail is a row the user
 * has to open the form to understand.
 */
function infoRender(ctx: ListRenderCtx): unknown {
    const { h, row } = ctx;
    const type = brief(field(ctx, "itemType"));
    const rows: [string, string][] = [];
    for (const [label, key] of fieldsFor(type)) {
        const s = brief(field(ctx, key));
        if (s) rows.push([label, s]);
    }
    if (!rows.length) return null;
    return h(
        "div",
        { style: S.rowDetail },
        h(
            "div",
            { style: S.detailNote },
            row.origin === "game"
                ? "The engine's own values for this item."
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

/** Type and cooldown are searchable, so "which of mine are weapons" works. */
function searchText(row: ListRow): string {
    const src = row.native ?? row.entry ?? {};
    return [brief(src.itemType), brief(src.cooldown), brief(src.ammoType)].join(" ");
}

export const itemList: DefinitionList = {
    discover: () => discoverItems(),
    inlineRender,
    infoRender,
    searchText,
};
