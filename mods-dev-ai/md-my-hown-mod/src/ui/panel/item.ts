import type { DefinitionList, ListRenderCtx, ListRow } from "../definition/types.ts";
import { discoverItems } from "../../catalog.ts";
import { brief, type DetailSpec, disclosureMark, originTag, renderDetail } from "./list.ts";
import * as S from "../styles.ts";

function field(ctx: ListRenderCtx, key: string): unknown {
    return ctx.row.native?.[key] ?? ctx.row.entry?.[key];
}

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

const COMMON: [string, string][] = [
    ["Type", "itemType"],
    ["Stack size", "maxStackSize"],
    ["Cooldown", "cooldown"],
    ["Sprite", "sprite"],
];

function fieldsFor(itemType: string): [string, string][] {
    const t = itemType.trim().toLowerCase();
    if (!t) return COMMON;
    for (const [prefix, fields] of Object.entries(BY_TYPE)) {
        if (t === prefix || t.startsWith(prefix)) return fields;
    }
    return [[...COMMON[0]], ...COMMON.slice(1)];
}

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

function infoRender(ctx: ListRenderCtx): unknown {
    const src = ctx.row.native ?? ctx.row.entry ?? {};
    const type = brief(src.itemType);
    const spec: DetailSpec = {
        fields: fieldsFor(type).map(([label, key]) => ({ key, label })),

        skip: ["sprite", "process", "handlerKey", "actions"],
    };
    return renderDetail(ctx.h as never, ctx, spec);
}

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
