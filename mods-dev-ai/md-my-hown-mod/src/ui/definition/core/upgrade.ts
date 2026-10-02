import { listItems, listUpgradeCategoryIds } from "../../../catalog.ts";
import {
    PROCESS_COVERED,
    processRefField,
    readProcessRef,
    writeProcessRef,
} from "../../control/process-ref-field.ts";
import { advField, boolField, idField, numField, textField } from "../fields.ts";
import { CUSTOM } from "../values.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";

const FIELDS: FieldSpec[] = [
    idField(),
    {
        key: "itemId",
        label: "Item",
        kind: "select",
        section: "Upgrade",
        required: true,
        options: listItems,
    },
    {
        key: "categoryId",
        label: "Category",
        kind: "select",
        section: "Upgrade",
        def: "tools",
        options: listUpgradeCategoryIds,
        hint:
            "must be a category the game knows. “custom” is for one it has and we cannot list — api.upgrades has no way to read them back.",
    },
    textField("itemNameKey", "Item name key (i18n)", "Upgrade", false, {
        placeholder: "mods|example|item|name",
        maxLength: 120,
        hint: "overrides the parent item's own display name in the upgrade list",
    }),
    textField("upgradeNameKey", "Name key (i18n)", "Upgrade", false, {
        placeholder: "mods|example|upgrade|name",
        maxLength: 120,
    }),
    textField("upgradeId", "Upgrade id", "Upgrade", true, {
        def: "lvl2",
        pattern: "^[a-z0-9][a-z0-9._-]{0,31}$",
        patternMsg: "lowercase id (a-z 0-9 . _ -)",
        hint: "upgrade.id — read it back with api.upgrades.getLevelById(itemId, this)",
    }),
    numField("maxLevel", "Max level", "Upgrade", {
        required: true,
        min: 1,
        max: 100,
        def: "3",
    }),
    {
        key: "costsJson",
        label: "Costs per level",
        kind: "json",
        section: "Upgrade",
        jsonType: "array",
        required: true,
        wide: true,
        hint: "one number per level, e.g. [100, 250, 500]",
        placeholder: "[100, 250, 500]",
    },
    boolField("oneOff", "One-off", "Upgrade", "false", "can only be bought once"),
    {
        ...processRefField("runs when a level is bought", { section: "Upgrade" }),
    },
    advField(),
];

function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("itemId", read.str(e.itemId) ?? read.num(e.itemId));
    read.put("itemNameKey", read.str(e.itemNameKey));
    read.put("categoryId", read.str(e.categoryId));

    const u = e.upgrade as
        | { id?: string; maxLevel?: number; costs?: number[]; oneOff?: boolean; nameKey?: string }
        | undefined;
    read.put("upgradeId", read.str(u?.id));
    read.put("upgradeNameKey", read.str(u?.nameKey));
    read.put("maxLevel", read.num(u?.maxLevel));
    read.put("costsJson", read.json(u?.costs));
    if (typeof u?.oneOff === "boolean") read.put("oneOff", String(u.oneOff));
    readProcessRef(read, e);
}

function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("itemId", w.opt("itemId"));
    w.setStr("itemNameKey", w.opt("itemNameKey"));

    const categoryId = w.opt("categoryId");
    if (categoryId && categoryId !== CUSTOM) w.setStr("categoryId", categoryId);

    const upgrade: Record<string, unknown> = {};
    const upId = w.opt("upgradeId");
    if (upId) upgrade.id = upId;
    const nameKey = w.opt("upgradeNameKey");
    if (nameKey) upgrade.nameKey = nameKey;
    const maxLevel = w.optNum("maxLevel");
    if (maxLevel !== undefined) upgrade.maxLevel = maxLevel;
    const costs = w.optJson<number[]>("costsJson");
    if (costs) upgrade.costs = costs;
    const oneOff = w.optBool("oneOff");
    if (oneOff !== undefined) upgrade.oneOff = oneOff;
    if (Object.keys(upgrade).length > 0) w.setRaw("upgrade", upgrade);
    writeProcessRef(w);
}

const FORM_COVERED = ["itemId", "itemNameKey", "categoryId", "upgrade", ...PROCESS_COVERED];

export const upgradeDefinition: Definition = {
    tab: "upgrades",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
};
