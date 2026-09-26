/**
 * The **item** object definition.
 *
 * An item is something the player holds and uses — a tool, a weapon, a
 * consumable. Its defining property is that almost every field is *conditional*
 * on one other: a Tool digs via an excavation profile, a Weapon fires a
 * projectile, and a Consumable has no use action at all because the engine's
 * `ActionType` has no Consumable. So the schema here is mostly a set of `when`
 * predicates over `itemType`, and the rule that follows from the same fact —
 * never persisting a handler for a Consumable — belongs with them.
 *
 * There is no custom widget: every control is a generic text box, number box or
 * dropdown. That is the case this file exists to make explicit, because "no
 * widget" should be a decision recorded in one place rather than an absence
 * noticed later.
 *
 * Ground truth: `doc/doc-tech/07-registering-items.md`.
 */
import { listItemActionHandlerKeys, listSpriteIds, type Opt } from "../../catalog.ts";
import { loadConfig } from "../../config/store.ts";
import type { ModConfig } from "../../constants.ts";
import {
    advField,
    DESC_MAX,
    idField,
    NAME_MAX,
    numField,
    textField,
    typesHintFor,
} from "./fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "./types.ts";

/**
 * Config entries of a category, as picker options.
 *
 * The ids of this mod's own `excavationProfiles` and `projectiles` — categories
 * with no host registry to enumerate, so the only source of options is what is
 * already stored. Wrapped in a try/catch because `options` runs on every render
 * and storage can throw; a picker that throws takes the whole panel with it.
 */
function listConfigured(key: keyof ModConfig): Opt[] {
    try {
        const arr = (loadConfig()[key] ?? []) as unknown[];
        return arr
            .map((e) => (e && typeof e === "object" ? ((e as { id?: string }).id ?? "") : ""))
            .filter((id) => id)
            .map((id) => ({ value: id, label: id }));
    } catch {
        return [];
    }
}

/** Item types, with the engine's own numbering so the mapping is checkable. */
const ITEM_TYPES: Opt[] = [
    { value: "Tool", label: "Tool (2) — digs via an excavation profile" },
    { value: "Weapon", label: "Weapon (1) — fires a projectile" },
    { value: "Consumable", label: "Consumable (3) — used up on the player" },
    { value: "Mod", label: "Mod (4) — passive / misc" },
];

/** Hand-held sprite poses. */
const SPRITE_TYPES: Opt[] = [
    { value: "onehand", label: "onehand" },
    { value: "twohand", label: "twohand" },
    { value: "backhand", label: "backhand" },
];

/** True for the types the player actively uses, which are the ones with a cost. */
const isUsable = (f: Record<string, string>) => f.itemType === "Tool" || f.itemType === "Weapon";

// ── The schema ───────────────────────────────────────────────────────────────

const FIELDS: FieldSpec[] = [
    idField(),
    textField("name", "Name", "Identity", true, { maxLength: NAME_MAX }),
    textField("description", "Description", "Identity", false, { maxLength: DESC_MAX }),
    textField("descriptionKey", "Description key (i18n)", "Identity", false, {
        placeholder: "mods|example|item|desc",
        maxLength: 120,
    }),
    {
        // sandkit.enums.ItemType: Weapon=1, Tool=2, Consumable=3, Mod=4.
        // `resolveItemType` maps these names to the numeric enum at register time.
        key: "itemType",
        label: "Item type",
        kind: "select",
        section: "Item",
        required: true,
        def: "Tool",
        options: ITEM_TYPES,
        hint: "itemType only labels the slot; behaviour comes from the fields below",
    },
    // Only a Tool has an excavation profile.
    {
        key: "excavationProfileId",
        label: "Excavation profile",
        kind: "select",
        section: "Item",
        when: (f) => f.itemType === "Tool",
        options: () => listConfigured("excavationProfiles"),
        hint: "api.items excavationProfileId — what this tool digs with",
    },
    // Weapon behaviour is a projectile reference.
    {
        key: "projectileId",
        label: "Projectile",
        kind: "select",
        section: "Item",
        when: (f) => f.itemType === "Weapon",
        options: () => listConfigured("projectiles"),
        hint: "spawned via api.projectiles.createBlueprintFromId(id)",
    },
    // `itemType` only labels the slot; the *behaviour* is
    // ItemDefinition.handleAction, which the engine calls with an ActionType.
    // ActionType has no Consumable, so a Consumable deliberately gets no handler.
    {
        key: "handlerKey",
        label: "Use action",
        kind: "select",
        section: "Item",
        when: (f) => !!f.itemType && f.itemType !== "Consumable",
        options: (f) => listItemActionHandlerKeys(f.itemType),
        // The dropdown is already filtered to the item type, so saying so
        // explains a short list instead of leaving it looking broken.
        hint: `becomes ItemDefinition.handleAction. ${
            typesHintFor(() => listItemActionHandlerKeys())
        } A Consumable gets none, because ActionType has no Consumable.`,
    },
    // Cooldown + energy apply to anything the player actively uses.
    numField("cooldownMs", "Cooldown (ms)", "Item", {
        min: 0,
        max: 600000,
        hint: "0 = none",
        when: isUsable,
    }),
    numField("energyCost", "Energy cost", "Item", {
        min: 0,
        max: 10000,
        when: isUsable,
        hint: "energy drawn per use (api.items energyCost)",
    }),
    {
        key: "spriteId",
        label: "Sprite",
        kind: "select",
        section: "Sprite",
        required: true,
        options: listSpriteIds,
        hint: "required by the engine — add it in Assets & hooks → Sprites",
    },
    {
        key: "spriteType",
        label: "Sprite type",
        kind: "select",
        section: "Sprite",
        required: true,
        def: "onehand",
        options: SPRITE_TYPES,
    },
    advField(),
];

// ── Round trip ───────────────────────────────────────────────────────────────

/** Stored entry → form strings, for the whole item. */
function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("name", read.str(e.name));
    read.put("description", read.str(e.description));
    read.put("descriptionKey", read.str(e.descriptionKey));
    read.put("itemType", read.str(e.itemType) ?? read.num(e.itemType));
    read.put("cooldownMs", read.num(e.cooldown));
    read.put("energyCost", read.num(e.energyCost));
    read.put("excavationProfileId", read.str(e.excavationProfileId));
    read.put("projectileId", read.str(e.projectileId));
    // Read in full, including for a Consumable. The control is hidden in that
    // case, so the stored value would otherwise vanish from the form and be
    // dropped on the next save — a switch back to "Tool" would silently lose
    // the handler the author had chosen. The *save* path is where the
    // Consumable rule belongs; hiding is not the same as forgetting.
    read.put("handlerKey", read.str(e.handlerKey));
    // One stored `sprite` object, two controls.
    const sprite = e.sprite as { id?: string; type?: string } | undefined;
    read.put("spriteId", read.str(sprite?.id));
    read.put("spriteType", read.str(sprite?.type));
}

/**
 * Form strings → stored entry, for the whole item.
 *
 * `_form` is unused: every read goes through the writer, which already carries
 * the form. The parameter stays because the `Definition` contract has one
 * signature — a definition that needs a raw form value the writer does not
 * expose (`structure` reads `form.tooltipHoverJson` for that) has to be able to
 * ask for it. An item simply does not.
 */
function formToEntry(_form: Record<string, string>, w: EntryWriter): void {
    w.setStr("name", w.opt("name"));
    w.setStr("description", w.opt("description"));
    w.setStr("descriptionKey", w.opt("descriptionKey"));
    w.setStr("itemType", w.opt("itemType"));
    w.setNum("cooldown", w.optNum("cooldownMs"));
    w.setNum("energyCost", w.optNum("energyCost"));
    w.setStr("excavationProfileId", w.opt("excavationProfileId"));
    w.setStr("projectileId", w.opt("projectileId"));
    // A Consumable has no ActionType to dispatch a use through, so never persist
    // a handler for one — even though the form still holds the previous value so
    // switching back to a Tool restores it.
    if (w.opt("itemType") !== "Consumable") {
        w.setStr("handlerKey", w.opt("handlerKey"));
    }
    const spriteId = w.opt("spriteId");
    if (spriteId) {
        const sprite: Record<string, unknown> = { id: spriteId };
        const type = w.opt("spriteType");
        if (type) sprite.type = type;
        w.setRaw("sprite", sprite);
    }
}

// ── The definition ───────────────────────────────────────────────────────────

/**
 * Stored keys this form owns.
 *
 * `sprite` and `cooldown` are listed under the keys the engine reads them by,
 * not the control names `spriteId` + `spriteType` and `cooldownMs`. The controls
 * are ways of writing them; claiming the control names as well would leave the
 * real keys falling through the passthrough as duplicates.
 */
const FORM_COVERED = [
    "name",
    "description",
    "descriptionKey",
    "itemType",
    "cooldown",
    "energyCost",
    "excavationProfileId",
    "projectileId",
    "handlerKey",
    "sprite",
];

export const itemDefinition: Definition = {
    tab: "items",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    // No `validate`: every rule an item has is either a per-field constraint
    // (which `validateField` already applies) or a consequence of `itemType`,
    // which the schema's `when` predicates and the save path above already
    // enforce. There is nothing a single field cannot express.
    //
    // No `panel` either, and that is a decision rather than a gap: an item's
    // controls are all text boxes, numbers and dropdowns, so the generic
    // renderer is the right one. Declaring the absence here means a later
    // "why doesn't items have its own widget?" question has a recorded answer.
};
