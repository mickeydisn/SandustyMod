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
import { brief, type DetailSpec, disclosureMark, originTag, renderDetail } from "./list.ts";
import * as S from "../styles.ts";

/** Read a field from the engine's definition, falling back to the mod's entry. */
function field(ctx: ListRenderCtx, key: string): unknown {
    return ctx.row.native?.[key] ?? ctx.row.entry?.[key];
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
 *
 * The type-conditional set is kept — a Tool's excavation profile is noise on a
 * Weapon, and showing it anyway teaches the user nothing — but the *rest* of the
 * definition is not filtered through it. Anything the engine carries that the
 * table does not name is listed after the curated rows, so a new field appears
 * rather than being dropped for want of a table entry.
 */
function infoRender(ctx: ListRenderCtx): unknown {
    const src = ctx.row.native ?? ctx.row.entry ?? {};
    const type = brief(src.itemType);
    const spec: DetailSpec = {
        fields: fieldsFor(type).map(([label, key]) => ({ key, label })),
        // `sprite` is an `{ id, type }` object and the row already shows the
        // sprite id; `process` is the compiled handler, not a readable fact.
        skip: ["sprite", "process", "handlerKey", "actions"],
    };
    return renderDetail(ctx.h as never, ctx, spec);
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
