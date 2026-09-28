/**
 * The **upgrade** object definition.
 *
 * An upgrade levels up an item: the item, the screen category it is listed
 * under, and a *nested* `upgrade` payload holding the id, the level cap, the
 * per-level costs and the one-off flag. The nesting is the whole reason this is
 * not a flat form — the old flat guess was wrong, and getting it wrong means the
 * upgrade registers with no payload at all.
 *
 * One rule is worth naming because it is invisible in the schema: `categoryId`
 * is written only when it is a real category. `__custom__` is a picker
 * affordance, and persisting it would register the upgrade under a category
 * literally named `__custom__` — which fails at runtime in a way nothing in the
 * panel could explain. The engine applies its own default when the key is absent.
 *
 * Ground truth: `doc/doc-artifacts/doc.api/shared/api.upgrades.md`.
 */
import { listItems, listUpgradeCategoryIds } from "../../../catalog.ts";
import {
    PROCESS_COVERED,
    processRefField,
    readProcessRef,
    writeProcessRef,
} from "../process-ref-field.ts";
import { advField, boolField, idField, numField, textField } from "../fields.ts";
import { CUSTOM } from "../values.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";

// ── The schema ───────────────────────────────────────────────────────────────

const FIELDS: FieldSpec[] = [
    idField(),
    {
        // api.upgrades.register({ itemId, categoryId, upgrade: { id, maxLevel, costs, oneOff? } })
        // The payload is NESTED under `upgrade` — a flat guess would be wrong.
        key: "itemId",
        label: "Item",
        kind: "select",
        section: "Upgrade",
        required: true,
        options: listItems,
    },
    {
        // Not a label, a reference — which is why it is a picker and not a text
        // box whose hint told you to go and look the id up somewhere else.
        //
        // `api.upgrades.registerCategory` is write-only: there is no
        // `listCategories` to call, so the game may well hold categories we have
        // never heard of. The picker offers what we *do* know plus `__custom__`,
        // and the hint says so — an unlabelled escape hatch reads as an oversight,
        // a labelled one is a documented boundary.
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
        // costs is number[] — one entry per level, priced in gold.
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
        // The stored key for this is `actions`, the same list every other process
        // uses. A config written under the old `onUpgradeKey` spelling is read as
        // no process at all.
        ...processRefField("runs when a level is bought", { section: "Upgrade" }),
    },
    advField(),
];

// ── Round trip ───────────────────────────────────────────────────────────────

/** Stored entry → form strings, for the whole upgrade. */
function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("itemId", read.str(e.itemId) ?? read.num(e.itemId));
    read.put("itemNameKey", read.str(e.itemNameKey));
    read.put("categoryId", read.str(e.categoryId));
    // One stored `upgrade` object, five controls.
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

/** Form strings → stored entry, for the whole upgrade. */
function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("itemId", w.opt("itemId"));
    w.setStr("itemNameKey", w.opt("itemNameKey"));
    // `__custom__` is a UI affordance, not an id. Writing it out would register
    // the upgrade under a category literally named `__custom__`, which fails at
    // runtime in a way nothing in the panel could explain. The engine applies
    // its own default when the field is absent.
    const categoryId = w.opt("categoryId");
    if (categoryId && categoryId !== CUSTOM) w.setStr("categoryId", categoryId);
    // Build the NESTED `upgrade` object UpgradeDefinition expects.
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

// ── The definition ───────────────────────────────────────────────────────────

/**
 * Stored keys this form owns.
 *
 * `upgrade` is the stored key; `upgradeId`, `upgradeNameKey`, `maxLevel` and
 * `costsJson` are the *controls* for it and are deliberately absent, so the real
 * key does not also fall through the passthrough as a duplicate.
 */
const FORM_COVERED = ["itemId", "itemNameKey", "categoryId", "upgrade", ...PROCESS_COVERED];

export const upgradeDefinition: Definition = {
    tab: "upgrades",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    // No `validate` and no `panel`: every control is a text box, a number, a
    // dropdown or a JSON area.
    //
    // The one thing a person could get wrong that no single field can catch is
    // the `costs` list being shorter than `maxLevel`. It is deliberately *not*
    // asserted here: the engine prices the levels that exist, so a short list is
    // a valid upgrade with fewer levels, not a broken one. Recorded rather than
    // assumed.
};
