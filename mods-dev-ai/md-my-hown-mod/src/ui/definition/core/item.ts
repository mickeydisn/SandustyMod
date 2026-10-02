import { listSpriteIds, type Opt } from "../../../catalog.ts";
import { configStore } from "../../../config/store.ts";
import type { ModConfig } from "../../../constants.ts";
import {
    PROCESS_COVERED,
    processRefField,
    readProcessRef,
    writeProcessRef,
} from "../../control/process-ref-field.ts";
import {
    advField,
    boolField,
    DESC_MAX,
    idField,
    NAME_MAX,
    numField,
    textField,
} from "../fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";

function listConfigured(key: keyof ModConfig): Opt[] {
    try {
        const arr = (configStore.load()[key] ?? []) as unknown[];
        return arr
            .map((e) => (e && typeof e === "object" ? ((e as { id?: string }).id ?? "") : ""))
            .filter((id) => id)
            .map((id) => ({ value: id, label: id }));
    } catch {
        return [];
    }
}

const ITEM_TYPES: Opt[] = [
    { value: "Tool", label: "Tool (2) — digs via an excavation profile" },
    { value: "Weapon", label: "Weapon (1) — fires a projectile" },
    { value: "Consumable", label: "Consumable (3) — used up on the player" },
    { value: "Mod", label: "Mod (4) — passive / misc" },
];

const SPRITE_TYPES: Opt[] = [
    { value: "onehand", label: "onehand" },
    { value: "twohand", label: "twohand" },
    { value: "backhand", label: "backhand" },
];

const isUsable = (f: Record<string, string>) => f.itemType === "Tool" || f.itemType === "Weapon";

const FIELDS: FieldSpec[] = [
    idField(),
    textField("name", "Name", "Identity", true, { maxLength: NAME_MAX }),
    textField("description", "Description", "Identity", false, { maxLength: DESC_MAX }),
    textField("descriptionKey", "Description key (i18n)", "Identity", false, {
        placeholder: "mods|example|item|desc",
        maxLength: 120,
    }),
    {
        key: "itemType",
        label: "Item type",
        kind: "select",
        section: "Item",
        required: true,
        def: "Tool",
        options: ITEM_TYPES,
        hint: "itemType only labels the slot; behaviour comes from the fields below",
    },

    {
        key: "excavationProfileId",
        label: "Excavation profile",
        kind: "select",
        section: "Item",
        when: (f) => f.itemType === "Tool",
        options: () => listConfigured("excavationProfiles"),
        hint: "api.items excavationProfileId — what this tool digs with",
    },

    {
        key: "projectileId",
        label: "Projectile",
        kind: "select",
        section: "Item",
        when: (f) => f.itemType === "Weapon",
        options: () => listConfigured("projectiles"),
        hint: "spawned via api.projectiles.createBlueprintFromId(id)",
    },

    {
        ...processRefField("ItemDefinition.handleAction runs when the item is used", {
            section: "Item",
            when: (f) => !!f.itemType && f.itemType !== "Consumable",
        }),
    },

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

    boolField(
        "hideFromBuildMenu",
        "Hide from menu",
        "Flags",
        "false",
        "keeps this item out of the lists until the “hidden” filter is ticked",
    ),
    advField(),
];

function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("name", read.str(e.name));
    read.put("description", read.str(e.description));
    read.put("descriptionKey", read.str(e.descriptionKey));
    read.put("itemType", read.str(e.itemType) ?? read.num(e.itemType));
    read.put("cooldownMs", read.num(e.cooldown));
    read.put("energyCost", read.num(e.energyCost));
    read.put("excavationProfileId", read.str(e.excavationProfileId));
    read.put("projectileId", read.str(e.projectileId));

    readProcessRef(read, e);

    const sprite = e.sprite as { id?: string; type?: string } | undefined;
    read.put("spriteId", read.str(sprite?.id));
    read.put("spriteType", read.str(sprite?.type));

    if (typeof e.hideFromBuildMenu === "boolean") {
        read.put("hideFromBuildMenu", String(e.hideFromBuildMenu));
    }
}

function formToEntry(_form: Record<string, string>, w: EntryWriter): void {
    w.setStr("name", w.opt("name"));
    w.setStr("description", w.opt("description"));
    w.setStr("descriptionKey", w.opt("descriptionKey"));
    w.setStr("itemType", w.opt("itemType"));
    w.setNum("cooldown", w.optNum("cooldownMs"));
    w.setNum("energyCost", w.optNum("energyCost"));
    w.setStr("excavationProfileId", w.opt("excavationProfileId"));
    w.setStr("projectileId", w.opt("projectileId"));

    writeProcessRef(w, w.opt("itemType") !== "Consumable");

    w.setBool("hideFromBuildMenu", w.optBool("hideFromBuildMenu"));
    const spriteId = w.opt("spriteId");
    if (spriteId) {
        const sprite: Record<string, unknown> = { id: spriteId };
        const type = w.opt("spriteType");
        if (type) sprite.type = type;
        w.setRaw("sprite", sprite);
    }
}

const FORM_COVERED = [
    "name",
    "description",
    "descriptionKey",
    "itemType",
    "cooldown",
    "energyCost",
    "excavationProfileId",
    "projectileId",

    ...PROCESS_COVERED,
    "sprite",

    "hideFromBuildMenu",
];

export const itemDefinition: Definition = {
    tab: "items",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
};
