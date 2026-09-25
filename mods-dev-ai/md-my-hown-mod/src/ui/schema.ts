/**
 * md-my-hown-mod — declarative form schema.
 *
 * One source of truth per category:
 *   - which fields exist (grounded in the real sandkit definition objects)
 *   - how they are constrained (required / range / pattern / enum)
 *   - how they map form ⇄ stored config entry
 *
 * Ground truth references:
 *   doc/doc-artifacts/doc.api/definitions/*.md        (register() object shapes)
 *   doc/doc-artifacts/doc.api/shared/api.recipes.md   (legal machine ids)
 *   doc/doc-tech/08-registering-elements.md           (element + contact reaction)
 *   doc/doc-tech/09-structures-register.md            (structure definition)
 *   doc/doc-tech/13-struct-interaction-and-categories.md (build categories)
 *   doc/doc-tech/03-hooks-reference.md                (hook ids)
 */
import { MOD_ID, type ModConfig, type RecipeOutputEntry } from "../constants.ts";
import { loadConfig } from "../config/store.ts";
import {
    listAnyHandlerKeys,
    listBuildModeTypes,
    listContactOrientation,
    listElements,
    listHandlerKeys,
    listHookIds,
    listItems,
    listMatterTypes,
    listOutputTargets,
    listProcessorKeys,
    listRecipeMachines,
    listSpriteIds,
    listStructureCategories,
    listStructures,
    type Opt,
} from "../catalog.ts";

// ── Categories & groups ──────────────────────────────────────────────────────

export type Tab =
    | "elements" | "structures" | "items"
    | "recipes" | "processing" | "contacts" | "interactions"
    | "terrains" | "techs" | "upgrades"
    | "signals" | "triggers" | "behaviors" | "energy" | "excavation" | "projectiles"
    | "sprites" | "modifiers"
    | "json";

export interface CategoryMeta {
    label: string;
    blurb: string;
    /** Storage key inside ModConfig (`json` has none). */
    configKey?: keyof ModConfig;
}

export const CATEGORY_META: Record<Tab, CategoryMeta> = {
    elements: { label: "Elements", blurb: "New simulation matter: powders, liquids, gases…", configKey: "elements" },
    structures: { label: "Structures", blurb: "Buildable machines (build menu, shape, render).", configKey: "structures" },
    items: { label: "Items", blurb: "Hotbar items: tools, weapons, consumables.", configKey: "items" },
    recipes: { label: "Machine recipes", blurb: "Input → outputs for the built-in machines.", configKey: "recipes" },
    processing: { label: "Processors", blurb: "Timed behaviour attached to a structure type.", configKey: "processing" },
    contacts: { label: "Contact reactions", blurb: "Element A + element B → two outputs.", configKey: "contacts" },
    interactions: { label: "Element ↔ structure", blurb: "Extra interaction info attached to an element.", configKey: "interactions" },
    terrains: { label: "Terrains", blurb: "Diggable tiles: hp, colour, drop output.", configKey: "terrains" },
    techs: { label: "Tech nodes", blurb: "Research nodes: cost, branch, unlocks.", configKey: "techs" },
    upgrades: { label: "Upgrades", blurb: "Item upgrade levels and costs.", configKey: "upgrades" },
    signals: { label: "Signals", blurb: "Structure click / signal handlers.", configKey: "signals" },
    triggers: { label: "Triggers", blurb: "Interval callbacks (ticks).", configKey: "triggers" },
    behaviors: { label: "Behaviours", blurb: "Conveyor / launcher behaviour definitions.", configKey: "structureBehaviors" },
    energy: { label: "Energy types", blurb: "Attach storage/producer/consumer to a structure.", configKey: "energyTypes" },
    excavation: { label: "Excavation profiles", blurb: "Dig power + cell pattern.", configKey: "excavationProfiles" },
    projectiles: { label: "Projectiles", blurb: "Sprite-driven projectiles and their options.", configKey: "projectiles" },
    sprites: { label: "Sprites", blurb: "Images loaded from the mod folder.", configKey: "sprites" },
    modifiers: { label: "Hook modifiers", blurb: "Intercept / modify engine hooks (code handlers).", configKey: "modifiers" },
    json: { label: "JSON", blurb: "Full config: inspect, export, import." },
};

export interface MenuGroup {
    key: string;
    label: string;
    hint: string;
    categories: Tab[];
}

/** Top-level menu: 6 groups instead of 19 flat tabs. */
export const MENU_GROUPS: MenuGroup[] = [
    { key: "content", label: "Content", hint: "What exists in the game", categories: ["elements", "structures", "items"] },
    { key: "production", label: "Production", hint: "How things transform", categories: ["recipes", "processing", "contacts", "interactions"] },
    { key: "world", label: "World", hint: "Map, research, progression", categories: ["terrains", "techs", "upgrades"] },
    { key: "systems", label: "Systems", hint: "Logic & machine wiring", categories: ["signals", "triggers", "behaviors", "energy", "excavation", "projectiles"] },
    { key: "assets", label: "Assets & hooks", hint: "Images and engine hooks", categories: ["sprites", "modifiers"] },
    { key: "data", label: "Data", hint: "Raw JSON", categories: ["json"] },
];

export function groupOfCategory(cat: Tab): MenuGroup {
    return MENU_GROUPS.find((g) => g.categories.includes(cat)) ?? MENU_GROUPS[0];
}

// ── Field specs ──────────────────────────────────────────────────────────────

export type FieldKind = "text" | "number" | "bool" | "select" | "color" | "json" | "outputs";

export interface FieldSpec {
    key: string;
    label: string;
    kind: FieldKind;
    section: string;
    required?: boolean;
    hint?: string;
    placeholder?: string;
    /** Number constraints. */
    min?: number;
    max?: number;
    step?: number;
    int?: boolean;
    /** Text constraints. */
    maxLength?: number;
    pattern?: string;
    patternMsg?: string;
    /** select options (plain array or lazily resolved). */
    options?: Opt[] | (() => Opt[]);
    /** json: "object" | "array" | "matrix" (matrix = rectangular 0/1 grid). */
    jsonType?: "object" | "array" | "matrix";
    /** Only render / validate / save when this returns true. */
    when?: (form: Record<string, string>) => boolean;
    /** Default value for a fresh form. */
    def?: string;
    /** Full-width control (textarea / outputs editor). */
    wide?: boolean;
}

const ID_PATTERN = "^[a-z0-9][a-z0-9._-]{0,62}$";
const ID_MSG = "lowercase letters, digits, . _ - (max 63)";
const SPRITE_ID_PATTERN = "^[a-z0-9][a-z0-9._-]{0,62}(:[a-z0-9][a-z0-9._-]{0,62})?$";
const SPRITE_ID_MSG = "key, or namespace:key — e.g. sprites:crusher";
const NAME_MAX = 64;
const DESC_MAX = 200;

function idField(): FieldSpec {
    return {
        key: "idSuffix", label: "Id", kind: "text", section: "Identity", required: true,
        pattern: ID_PATTERN, patternMsg: ID_MSG,
        hint: `stored as ${MOD_ID}:<id>`,
        placeholder: "my-thing",
    };
}

/**
 * Sprite ids are engine graphics keys ("sprites:crusher"), not mod-namespaced
 * ids — so this field accepts an optional "namespace:key" and is stored verbatim.
 */
function spriteIdField(): FieldSpec {
    return {
        key: "idSuffix", label: "Graphics key", kind: "text", section: "Identity", required: true,
        pattern: SPRITE_ID_PATTERN, patternMsg: SPRITE_ID_MSG,
        hint: "used by render.imageName / item.sprite",
        placeholder: "sprites:crusher",
    };
}

function advField(): FieldSpec {
    return {
        key: "advancedJson", label: "Extra fields (JSON)", kind: "json", section: "Advanced",
        jsonType: "object", wide: true,
        hint: "Merged first — engine fields not covered by the form (see README).",
        placeholder: "{ }",
    };
}

function boolField(key: string, label: string, section: string, def = "false", hint?: string): FieldSpec {
    return { key, label, kind: "bool", section, def, hint };
}

function textField(
    key: string, label: string, section: string,
    required = false, extra: Partial<FieldSpec> = {},
): FieldSpec {
    return { key, label, kind: "text", section, required, maxLength: DESC_MAX, ...extra };
}

function numField(
    key: string, label: string, section: string,
    extra: Partial<FieldSpec> = {},
): FieldSpec {
    return { key, label, kind: "number", section, step: 1, int: true, ...extra };
}

function elSelect(key: string, label: string, section: string, required = false, hint?: string): FieldSpec {
    return { key, label, kind: "select", section, required, options: listElements, hint };
}

// ── Per-category field lists ────────────────────────────────────────────────

const FIELDS: Record<Tab, FieldSpec[]> = {
    elements: [
        idField(),
        textField("name", "Name", "Identity", true, { maxLength: NAME_MAX }),
        textField("description", "Description", "Identity", false, { maxLength: DESC_MAX }),
        {
            key: "matterType", label: "Matter type", kind: "select", section: "Physics",
            required: true, options: listMatterTypes, def: "powder",
            hint: "How the element behaves in the simulation",
        },
        numField("density", "Density", "Physics", {
            required: true, min: 0, max: 1000, def: "100",
            hint: "sink / float weight — 0–1000",
        }),
        numField("horizontalSpeed", "Horizontal speed", "Physics", {
            min: 0, max: 1000, step: 0.1, int: false,
            hint: "optional lateral spread",
        }),
        numField("duration", "Lifetime (s)", "Physics", {
            min: 0, max: 3600, step: 0.1, int: false,
            hint: "empty = permanent",
        }),
        numField("durationRandomMin", "Lifetime min (s)", "Physics", {
            min: 0, max: 3600, step: 0.1, int: false, when: (f) => f.duration !== "",
        }),
        numField("durationRandomMax", "Lifetime max (s)", "Physics", {
            min: 0, max: 3600, step: 0.1, int: false, when: (f) => f.duration !== "",
        }),
        {
            key: "metaColor", label: "Map colour", kind: "color", section: "Appearance",
            hint: "packed 0xRRGGBB (minimap / inspector)",
        },
        {
            key: "colorsJson", label: "Colour variants", kind: "json", section: "Appearance",
            jsonType: "array", wide: true,
            hint: "[[r,g,b,a], …] each 0–255",
            placeholder: "[[120, 200, 255, 255], [90, 160, 220, 255]]",
        },
        boolField("flammable", "Flammable", "Behaviour"),
        boolField("isTransportable", "Transportable", "Behaviour", "true", "conveyors / launchers can move it"),
        boolField("isGrabbable", "Grabbable", "Behaviour"),
        boolField("collectable", "Collectable", "Behaviour", "true", "collector value path"),
        boolField("hidden", "Hidden", "Flags"),
        boolField("visibleInPicker", "Visible in picker", "Flags", "true"),
        advField(),
    ],
    structures: [
        idField(),
        textField("name", "Name", "Identity", true, { maxLength: NAME_MAX }),
        textField("description", "Description", "Identity", false, { maxLength: DESC_MAX }),
        {
            key: "categoryKey", label: "Build category", kind: "select", section: "Build menu",
            required: true, options: listStructureCategories, def: "blocks",
            hint: "grouping in the build window",
        },
        numField("order", "Order", "Build menu", { min: 0, max: 9999, hint: "sort inside the category" }),
        {
            key: "buildModeType", label: "Build mode", kind: "select", section: "Placement",
            required: true, options: listBuildModeTypes, def: "single",
        },
        numField("spanTiles", "Span (tiles)", "Placement", {
            min: 1, max: 64, when: (f) => f.buildModeType !== "single",
        }),
        boolField("dirH", "Horizontal", "Placement", "true", "placement directions"),
        boolField("dirV", "Vertical", "Placement", "true"),
        boolField("dirD", "Diagonal", "Placement", "false"),
        {
            key: "shapeJson", label: "Shape", kind: "json", section: "Placement",
            jsonType: "matrix", wide: true,
            hint: "rows of 1 = occupied, 0 = empty; empty = 1×1",
            placeholder: "[[1, 1], [1, 1]]",
        },
        {
            key: "unlockedBy", label: "Unlocked by", kind: "select", section: "Flags",
            options: listStructures, hint: "unlock granted by another structure id",
        },
        boolField("alwaysUnlocked", "Always unlocked", "Flags"),
        boolField("hideFromBuildMenu", "Hide from build menu", "Flags"),
        boolField("disallowPick", "Disallow pick", "Flags"),
        {
            key: "imageName", label: "Sprite", kind: "select", section: "Render",
            options: listSpriteIds, hint: "render.imageName (load a sprite first)",
        },
        advField(),
    ],
    items: [
        idField(),
        textField("name", "Name", "Identity", true, { maxLength: NAME_MAX }),
        textField("description", "Description", "Identity", false, { maxLength: DESC_MAX }),
        {
            key: "itemType", label: "Item type", kind: "select", section: "Item",
            required: true, def: "Tool",
            options: [
                { value: "Tool", label: "Tool" },
                { value: "Weapon", label: "Weapon" },
                { value: "Consumable", label: "Consumable" },
                { value: "Mod", label: "Mod" },
            ],
        },
        numField("cooldownMs", "Cooldown (ms)", "Item", { min: 0, max: 600000, hint: "0 = none" }),
        numField("energyCost", "Energy cost", "Item", { min: 0, max: 10000 }),
        {
            key: "excavationProfileId", label: "Excavation profile", kind: "select", section: "Item",
            options: () => listConfigured("excavationProfiles"),
            hint: "used when the item digs",
        },
        {
            key: "spriteId", label: "Sprite", kind: "select", section: "Sprite",
            required: true, options: listSpriteIds,
            hint: "required by the engine — add it in Assets & hooks → Sprites",
        },
        {
            key: "spriteType", label: "Sprite type", kind: "select", section: "Sprite",
            required: true, def: "onehand",
            options: [
                { value: "onehand", label: "onehand" },
                { value: "twohand", label: "twohand" },
                { value: "backhand", label: "backhand" },
            ],
        },
        advField(),
    ],

    recipes: [
        idField(),
        {
            key: "machine", label: "Machine", kind: "select", section: "Recipe",
            required: true, options: listRecipeMachines, def: "smelter",
            hint: "only these 8 ids are accepted by the engine",
        },
        elSelect("input", "Input element", "Recipe", true),
        {
            key: "outputElement", label: "Output element", kind: "select", section: "Outputs",
            required: true, options: listElements, when: (f) => f.machine === "planterBox",
        },
        numField("outputChance", "Output chance", "Outputs", {
            min: 0, max: 1, step: 0.05, int: false, def: "1",
            when: (f) => f.machine === "planterBox",
        }),
        {
            key: "outputs", label: "Outputs (element + chance)", kind: "outputs", section: "Outputs",
            required: true, wide: true,
            when: (f) => f.machine !== "planterBox" && f.machine !== "shaker",
            hint: "chance 0–1, max 255 rows",
        },
        {
            key: "outputsAbove", label: "Outputs above", kind: "outputs", section: "Outputs",
            required: true, wide: true, when: (f) => f.machine === "shaker",
            hint: "dropped on top of the shaker",
        },
        {
            key: "outputsBelow", label: "Outputs below", kind: "outputs", section: "Outputs",
            required: true, wide: true, when: (f) => f.machine === "shaker",
            hint: "dropped below the shaker",
        },
        numField("minVelocity", "Min downward velocity", "Outputs", {
            required: true, min: 0, max: 10000, def: "20",
            when: (f) => f.machine === "kineticPress",
            hint: "cells per second the input must fall at",
        }),
        advField(),
    ],
    processing: [
        idField(),
        {
            key: "mode", label: "Attach to", kind: "select", section: "Target",
            required: true, def: "type", options: [
                { value: "type", label: "structure type (all of them)" },
                { value: "instance", label: "single placed instance" },
            ],
        },
        {
            key: "structureType", label: "Structure type", kind: "select", section: "Target",
            required: true, options: listStructures, when: (f) => f.mode === "type",
        },
        {
            key: "structureId", label: "Structure instance", kind: "select", section: "Target",
            required: true, options: listStructures, when: (f) => f.mode === "instance",
        },
        numField("intervalMs", "Interval (ms)", "Timing", {
            required: true, min: 16, max: 60000, def: "1000",
        }),
        {
            key: "handlerKey", label: "Process handler", kind: "select", section: "Timing",
            required: true, options: listProcessorKeys,
            hint: "process() is code — JSON can't store callbacks, pick a preset",
        },
        advField(),
    ],
    contacts: [
        idField(),
        elSelect("inputA", "Input A", "Reaction", true),
        elSelect("inputB", "Input B", "Reaction", true),
        {
            key: "outputA", label: "Output A", kind: "select", section: "Reaction",
            required: true, options: listOutputTargets,
            hint: "what input A becomes (∅ = consumed)",
        },
        {
            key: "outputB", label: "Output B", kind: "select", section: "Reaction",
            required: true, options: listOutputTargets,
            hint: "what input B becomes (∅ = consumed)",
        },
        {
            key: "orientation", label: "Orientation", kind: "select", section: "Reaction",
            required: true, def: "any", options: listContactOrientation,
        },
    ],
    interactions: [
        idField(),
        elSelect("elementId", "Element", "Target", true),
        {
            key: "interactionJson", label: "Interaction descriptor", kind: "json", section: "Target",
            required: true, jsonType: "object", wide: true,
            hint: "read by the structure's processor — shape is per structure (doc-tech/08)",
            placeholder: "{ \"kind\": \"…\" }",
        },
    ],

    terrains: [
        idField(),
        textField("name", "Name", "Identity", true, { maxLength: NAME_MAX }),
        numField("hp", "Hit points", "Tile", { required: true, min: 1, max: 999999, def: "100" }),
        { key: "metaColor", label: "Colour", kind: "color", section: "Tile" },
        {
            key: "outputElement", label: "Drops", kind: "select", section: "Tile",
            options: listElements, hint: "element dropped when mined (empty = nothing)",
        },
        numField("outputChance", "Drop chance", "Tile", {
            min: 0, max: 1, step: 0.05, int: false, def: "1",
            when: (f) => f.outputElement !== "",
        }),
        boolField("flammable", "Flammable", "Flags"),
        boolField("fog", "Fog", "Flags"),
        advField(),
    ],
    techs: [
        idField(),
        textField("name", "Name", "Identity", true, { maxLength: NAME_MAX }),
        numField("cost", "Cost", "Research", { required: true, min: 0, max: 999999, def: "100" }),
        textField("currencyType", "Currency", "Research", false, {
            placeholder: "coins", pattern: "^[a-z0-9][a-z0-9._-]{0,31}$",
            patternMsg: "lowercase id (a-z 0-9 . _ -)",
        }),
        textField("branch", "Branch", "Research", false, {
            placeholder: "industry", pattern: "^[a-z0-9][a-z0-9._-]{0,31}$",
            patternMsg: "lowercase id (a-z 0-9 . _ -)",
        }),
        textField("requires", "Requires (comma ids)", "Research", false, {
            placeholder: "tech-a, tech-b",
            hint: "prerequisite tech ids",
        }),
        advField(),
    ],
    upgrades: [
        idField(),
        {
            key: "itemId", label: "Item", kind: "select", section: "Upgrade",
            required: true, options: listItems,
        },
        textField("categoryId", "Category id", "Upgrade", true, {
            def: "tools", pattern: "^[a-z0-9][a-z0-9._-]{0,31}$",
            patternMsg: "lowercase id (a-z 0-9 . _ -)",
        }),
        {
            key: "upgradeJson", label: "Upgrade payload", kind: "json", section: "Upgrade",
            required: true, jsonType: "object", wide: true,
            hint: "{ id, maxLevel, costs: [100, 250], oneOff? }",
            placeholder: "{ \"id\": \"lvl2\", \"maxLevel\": 3, \"costs\": [100, 250, 500] }",
        },
    ],
    signals: [
        idField(),
        {
            key: "kind", label: "Kind", kind: "select", section: "Signal",
            required: true, def: "interactables", options: [
                { value: "interactables", label: "interactables — structure click" },
                { value: "targets", label: "targets — signal receiver" },
                { value: "senderType", label: "senderType — signal sender" },
            ],
        },
        {
            key: "target", label: "Target structure", kind: "select", section: "Signal",
            required: true, options: listStructures,
        },
        {
            key: "handlerKey", label: "Handler", kind: "select", section: "Signal",
            required: true, options: listAnyHandlerKeys,
            hint: "code callback — without it the entry is stored but never attached",
        },
    ],
    triggers: [
        idField(),
        numField("interval", "Interval (ticks)", "Timing", {
            required: true, min: 1, max: 100000, def: "60",
        }),
        numField("sequentialRuns", "Runs per fire", "Timing", { min: 1, max: 1000, def: "1" }),
        {
            key: "handlerKey", label: "Handler", kind: "select", section: "Timing",
            required: true, options: listAnyHandlerKeys,
        },
        {
            key: "extraJson", label: "Extra payload", kind: "json", section: "Timing",
            jsonType: "object", wide: true, placeholder: "{ }",
        },
    ],

    behaviors: [
        idField(),
        {
            key: "kind", label: "Kind", kind: "select", section: "Behaviour",
            required: true, def: "conveyor", options: [
                { value: "conveyor", label: "conveyor" },
                { value: "launcher", label: "launcher" },
            ],
        },
        {
            key: "definitionJson", label: "Definition", kind: "json", section: "Behaviour",
            required: true, jsonType: "object", wide: true,
            hint: "forwarded to structureBehaviors.register*",
            placeholder: "{ }",
        },
    ],
    energy: [
        idField(),
        {
            key: "structureId", label: "Structure", kind: "select", section: "Energy",
            required: true, options: listStructures,
        },
        {
            key: "type", label: "Role", kind: "select", section: "Energy",
            required: true, def: "storage", options: [
                { value: "storage", label: "storage" },
                { value: "producer", label: "producer" },
                { value: "consumer", label: "consumer" },
            ],
        },
        numField("priority", "Priority", "Energy", { min: 0, max: 1000, def: "0" }),
        boolField("excludeFromNetwork", "Exclude from network", "Energy"),
    ],
    excavation: [
        idField(),
        numField("power", "Power", "Profile", { required: true, min: 0, max: 1000, def: "10" }),
        {
            key: "patternJson", label: "Pattern", kind: "json", section: "Profile",
            required: true, jsonType: "matrix", wide: true,
            hint: "cells removed per dig — 1 = dug, 0 = kept",
            placeholder: "[[1, 1], [1, 1]]",
        },
        {
            key: "optionsJson", label: "Options", kind: "json", section: "Profile",
            jsonType: "object", wide: true,
            hint: "{ fromGun?, fromDrill?, drillTierDamage?, … }",
            placeholder: "{ \"fromDrill\": true }",
        },
    ],
    projectiles: [
        idField(),
        {
            key: "spriteId", label: "Sprite", kind: "select", section: "Look",
            required: true, options: listSpriteIds,
        },
        {
            key: "getOptionsKey", label: "Options handler", kind: "select", section: "Look",
            options: listAnyHandlerKeys,
            hint: "dynamic options factory (optional)",
        },
        {
            key: "optionsJson", label: "Static options", kind: "json", section: "Look",
            jsonType: "object", wide: true, when: (f) => f.getOptionsKey === "",
            hint: "{ speed?, rotateWithVelocity?, tint?, … }",
            placeholder: "{ \"speed\": 10 }",
        },
    ],
    sprites: [
        spriteIdField(),
        {
            key: "path", label: "Path", kind: "text", section: "File", required: true,
            placeholder: "assets/icon.png",
            pattern: "^assets\\/[A-Za-z0-9._\\-\\/]+\\.(png|jpg|jpeg|webp|gif)$",
            patternMsg: "assets/<file>.png (inside the mod folder)",
        },
        boolField("fromMod", "Load from mod folder", "File", "true"),
    ],
    modifiers: [
        idField(),
        {
            key: "hookId", label: "Engine hook", kind: "select", section: "Hook",
            required: true, options: listHookIds,
            hint: "documented hooks only — see doc-tech/03",
        },
        textField("hookCustom", "Custom hook id", "Hook", true, {
            when: (f) => f.hookId === "__custom__",
            pattern: "^[a-z][a-z0-9]*(:[a-zA-Z0-9]+)+$",
            patternMsg: "e.g. element:update",
        }),
        {
            key: "kind", label: "Mode", kind: "select", section: "Hook",
            required: true, def: "intercept", options: [
                { value: "intercept", label: "intercept — observe, can cancel" },
                { value: "modify", label: "modify — transform the value" },
            ],
        },
        {
            key: "handlerKey", label: "Code handler", kind: "select", section: "Hook",
            required: true, options: listHandlerKeys,
            hint: "defined in src/hooks/handlers.ts",
        },
        boolField("enabled", "Enabled", "Hook", "true"),
        textField("notes", "Notes", "Hook", false, { maxLength: 120 }),
    ],
    json: [],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Config entries of a category (for pickers that only exist in our config). */
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

export function resolveOptions(f: FieldSpec): Opt[] {
    if (!f.options) return [];
    try {
        return typeof f.options === "function" ? f.options() : f.options;
    } catch {
        return [];
    }
}

export function isActive(f: FieldSpec, form: Record<string, string>): boolean {
    try {
        return f.when ? f.when(form) : true;
    } catch {
        return true;
    }
}

export function fieldsFor(cat: Tab): FieldSpec[] {
    return FIELDS[cat] ?? [];
}

export interface Section {
    title: string;
    fields: FieldSpec[];
}

export function sectionsFor(cat: Tab): Section[] {
    const out: Section[] = [];
    for (const f of fieldsFor(cat)) {
        const last = out[out.length - 1];
        if (last && last.title === f.section) last.fields.push(f);
        else out.push({ title: f.section, fields: [f] });
    }
    return out;
}

/**
 * Form id → stored id.
 * Sprite entries use engine graphics keys, which are stored verbatim; every
 * other category is namespaced with the mod id.
 */
export function fullIdOf(form: Record<string, string>, cat?: Tab): string {
    const suffix = (form.idSuffix ?? "").trim();
    if (!suffix) return "";
    if (cat === "sprites") return suffix;
    return suffix.includes(":") ? suffix : `${MOD_ID}:${suffix}`;
}

function suffixOf(id: string, cat?: Tab): string {
    if (cat === "sprites") return id;
    return id.startsWith(`${MOD_ID}:`) ? id.slice(MOD_ID.length + 1) : id;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const NUMERIC = /^-?\d+(\.\d+)?$/;

export function hexToPacked(hex: string): number {
    return parseInt(hex.slice(1), 16) & 0xffffff;
}

export function packedToHex(n: number | undefined): string {
    if (typeof n !== "number" || !Number.isFinite(n)) return "";
    const rgb = n > 0xffffff ? (n >>> 0) & 0xffffff : n & 0xffffff;
    return `#${rgb.toString(16).padStart(6, "0")}`;
}

function parseJsonRaw(raw: string): { ok: boolean; value?: unknown; error?: string } {
    try {
        return { ok: true, value: JSON.parse(raw) };
    } catch (e) {
        return { ok: false, error: `invalid JSON: ${(e as Error).message}` };
    }
}

export function validateMatrix(value: unknown): string | null {
    if (!Array.isArray(value) || value.length === 0) return "must be a non-empty array of rows";
    const width = Array.isArray(value[0]) ? value[0].length : -1;
    if (width <= 0) return "rows must be non-empty arrays";
    for (const row of value) {
        if (!Array.isArray(row)) return "every row must be an array";
        if (row.length !== width) return "rows must all be the same length";
        for (const cell of row) {
            if (cell !== 0 && cell !== 1) return "cells must be 0 or 1";
        }
    }
    return null;
}

export function validateOutputs(raw: string): string | null {
    const parsed = parseJsonRaw(raw);
    if (!parsed.ok) return parsed.error ?? "invalid JSON";
    const rows = parsed.value;
    if (!Array.isArray(rows)) return "must be an array of { elementType, chance }";
    if (rows.length === 0) return "add at least one output";
    if (rows.length > 255) return "max 255 outputs";
    for (const row of rows) {
        if (!row || typeof row !== "object") return "rows must be objects";
        const r = row as { elementType?: unknown; chance?: unknown };
        if (typeof r.elementType !== "string" || !r.elementType.trim()) {
            return "every row needs an element";
        }
        if (typeof r.chance !== "number" || !Number.isFinite(r.chance) || r.chance < 0 || r.chance > 1) {
            return "chance must be a number 0–1";
        }
    }
    return null;
}

/** Validate one field against the form. Returns an error message or null. */
export function validateField(f: FieldSpec, form: Record<string, string>): string | null {
    if (!isActive(f, form)) return null;
    const raw = (form[f.key] ?? "").trim();

    if (f.kind === "bool") return null;

    if (!raw) {
        if (f.required) return f.kind === "outputs" ? "add at least one output" : "required";
        return null;
    }

    switch (f.kind) {
        case "text": {
            if (f.maxLength && raw.length > f.maxLength) return `max ${f.maxLength} characters`;
            if (f.pattern && !new RegExp(f.pattern).test(raw)) {
                return f.patternMsg ?? `must match ${f.pattern}`;
            }
            return null;
        }
        case "number": {
            if (!NUMERIC.test(raw)) return "must be a number";
            const n = Number(raw);
            if (f.int && !Number.isInteger(n)) return "must be a whole number";
            if (f.min !== undefined && n < f.min) return `min ${f.min}`;
            if (f.max !== undefined && n > f.max) return `max ${f.max}`;
            return null;
        }
        case "select": {
            if (raw === "__null__" || raw === "__custom__") return null;
            const opts = resolveOptions(f);
            if (opts.length > 0 && !opts.some((o) => o.value === raw)) {
                return "pick one of the listed values";
            }
            return null;
        }
        case "color":
            return HEX.test(raw) ? null : "use #rrggbb";
        case "outputs":
            return validateOutputs(raw);
        case "json": {
            const parsed = parseJsonRaw(raw);
            if (!parsed.ok) return parsed.error ?? "invalid JSON";
            if (
                f.jsonType === "object" &&
                (typeof parsed.value !== "object" || parsed.value === null || Array.isArray(parsed.value))
            ) {
                return "must be a JSON object { }";
            }
            if (f.jsonType === "array" && !Array.isArray(parsed.value)) return "must be a JSON array [ ]";
            if (f.jsonType === "matrix") return validateMatrix(parsed.value);
            return null;
        }
        default:
            return null;
    }
}

/** All errors for a form (empty object = valid). */
export function validateForm(cat: Tab, form: Record<string, string>): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const f of fieldsFor(cat)) {
        const err = validateField(f, form);
        if (err) errors[f.key] = err;
    }
    if (cat === "elements" && !errors.durationRandomMin && !errors.durationRandomMax) {
        const min = form.durationRandomMin?.trim();
        const max = form.durationRandomMax?.trim();
        if (min && max && Number(min) > Number(max)) {
            errors.durationRandomMax = "must be ≥ min";
        }
    }
    return errors;
}

// ── Form ⇄ entry mapping ─────────────────────────────────────────────────────

/** Coerce an optional form string to a trimmed string ("" → undefined). */
function opt(form: Record<string, string>, key: string): string | undefined {
    const v = (form[key] ?? "").trim();
    return v === "" ? undefined : v;
}

/** Coerce an optional form string to a number. Invalid → undefined. */
function optNum(form: Record<string, string>, key: string): number | undefined {
    const v = (form[key] ?? "").trim();
    if (v === "" || !NUMERIC.test(v)) return undefined;
    return Number(v);
}

/** Coerce an optional form string to a boolean ("true" → true). */
function optBool(form: Record<string, string>, key: string): boolean | undefined {
    const v = (form[key] ?? "").trim();
    if (v === "") return undefined;
    return v === "true";
}

/**
 * Select values carry sentinels:
 *   ""           → leave unset
 *   "__null__"   → explicit null (engine: "consume this input")
 *   "__custom__" → the companion *Custom text field supplies the value
 */
function optSel(form: Record<string, string>, key: string): string | number | null | undefined {
    const v = (form[key] ?? "").trim();
    if (v === "" || v === "__custom__") return undefined;
    if (v === "__null__") return null;
    return v;
}

/** Parse an optional JSON textarea. Empty/invalid → undefined. */
function optJson<T>(form: Record<string, string>, key: string): T | undefined {
    const v = (form[key] ?? "").trim();
    if (v === "") return undefined;
    try {
        return JSON.parse(v) as T;
    } catch {
        return undefined; // validation already blocked Save
    }
}

/** Default form values for a fresh entry. */
export function formDefaults(cat: Tab): Record<string, string> {
    const form: Record<string, string> = {};
    for (const f of fieldsFor(cat)) {
        form[f.key] = f.kind === "bool" ? (f.def ?? "false") : (f.def ?? "");
    }
    return form;
}

/** Config keys each form owns; everything else round-trips via advancedJson. */
const FORM_COVERED: Partial<Record<Tab, string[]>> = {
    elements: [
        "name", "description", "matterType", "density", "horizontalSpeed", "duration",
        "durationRandom", "metaColor", "colors", "flammable", "isTransportable",
        "isGrabbable", "collectable", "hidden", "visibleInPicker",
    ],
    structures: [
        "name", "description", "categoryKey", "order", "buildModes", "spanTiles",
        "dirH", "dirV", "dirD", "shape", "unlockedBy", "alwaysUnlocked",
        "hideFromBuildMenu", "disallowPick", "render", "imageName",
    ],
    items: ["name", "description", "itemType", "cooldown", "energyCost", "excavationProfileId", "sprite"],
    recipes: [
        "kind", "input", "output", "chance", "outputs", "outputsAbove", "outputsBelow",
        "minimumDownwardVelocity",
    ],
    processing: ["mode", "structureType", "structureId", "intervalMs", "handlerKey"],
    contacts: ["inputA", "inputB", "outputA", "outputB", "orientation"],
    interactions: ["elementId", "interaction"],
    terrains: ["name", "hp", "metaColor", "output", "flammable", "fog"],
    techs: ["name", "cost", "currencyType", "branch", "requires"],
    upgrades: ["itemId", "categoryId", "upgrade"],
    signals: ["kind", "target", "handlerKey"],
    triggers: ["triggerId", "interval", "sequentialRuns", "extra", "handlerKey"],
    behaviors: ["kind", "behaviorType", "definition"],
    energy: ["structureId", "type", "options"],
    excavation: ["power", "pattern", "options"],
    projectiles: ["sprite", "getOptionsKey", "options"],
    sprites: ["path", "source", "fromMod", "options"],
    modifiers: ["hookId", "kind", "handlerKey", "enabled", "notes"],
};

/** Extra fields not covered by the form, so Edit never silently drops them. */
function passthroughOf(cat: Tab, entry: Record<string, unknown>): Record<string, unknown> {
    const covered = new Set<string>(FORM_COVERED[cat] ?? []);
    covered.add("id");
    const rest: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(entry)) {
        if (covered.has(k)) continue;
        if (v === undefined || v === null) continue;
        if (typeof v === "function") continue; // never round-trip code callbacks
        rest[k] = v;
    }
    return rest;
}

/** Stored entry → form strings (round-trips the full entry). */
export function entryToForm(cat: Tab, entry: Record<string, unknown>): Record<string, string> {
    const form = formDefaults(cat);
    const e = entry ?? {};
    const put = (k: string, v: string | undefined) => {
        if (v !== undefined) form[k] = v;
    };
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? String(v) : undefined);
    const str = (v: unknown) => (typeof v === "string" ? v : undefined);
    const json = (v: unknown) => (v === undefined || v === null ? undefined : JSON.stringify(v, null, 2));

    if (typeof e.id === "string") form.idSuffix = suffixOf(e.id, cat);

    switch (cat) {
        case "elements": {
            put("name", str(e.name));
            put("description", str(e.description));
            put("matterType", str(e.matterType) ?? num(e.matterType));
            put("density", num(e.density));
            put("horizontalSpeed", num(e.horizontalSpeed));
            put("duration", num(e.duration));
            const dr = e.durationRandom as { min?: number; max?: number } | undefined;
            put("durationRandomMin", num(dr?.min));
            put("durationRandomMax", num(dr?.max));
            put("metaColor", packedToHex(e.metaColor as number | undefined));
            const colors = e.colors as { variants?: number[][] } | number[][] | undefined;
            put("colorsJson", json(Array.isArray(colors) ? colors : colors?.variants));
            for (
                const k of [
                    "flammable",
                    "isTransportable",
                    "isGrabbable",
                    "collectable",
                    "hidden",
                    "visibleInPicker",
                ]
            ) {
                if (typeof e[k] === "boolean") put(k, String(e[k]));
            }
            break;
        }
        case "structures": {
            put("name", str(e.name));
            put("description", str(e.description));
            put("categoryKey", str(e.categoryKey));
            put("order", num(e.order));
            const modes = (Array.isArray(e.buildModes) ? e.buildModes : []) as Record<string, unknown>[];
            const m0 = (modes[0] ?? {}) as { type?: string; spanTiles?: number; directions?: string[] };
            put("buildModeType", str(m0.type));
            put("spanTiles", num(e.spanTiles ?? m0.spanTiles));
            const dirs = Array.isArray(m0.directions) ? m0.directions : [];
            if (dirs.includes("horizontal")) put("dirH", "true");
            if (dirs.includes("vertical")) put("dirV", "true");
            if (dirs.includes("diagonal")) put("dirD", "true");
            put("shapeJson", json(e.shape));
            put("unlockedBy", str(e.unlockedBy));
            for (const k of ["alwaysUnlocked", "hideFromBuildMenu", "disallowPick"]) {
                if (typeof e[k] === "boolean") put(k, String(e[k]));
            }
            const render = e.render as { imageName?: string } | undefined;
            put("imageName", str(render?.imageName) ?? str(e.imageName));
            break;
        }
        case "items": {
            put("name", str(e.name));
            put("description", str(e.description));
            put("itemType", str(e.itemType) ?? num(e.itemType));
            if (typeof e.cooldown === "number") put("cooldownMs", num(e.cooldown));
            put("energyCost", num(e.energyCost));
            put("excavationProfileId", str(e.excavationProfileId));
            const sprite = e.sprite as { id?: string; type?: string } | undefined;
            put("spriteId", str(sprite?.id));
            put("spriteType", str(sprite?.type));
            break;
        }
        case "recipes": {
            put("machine", str(e.kind));
            put("input", str(e.input) ?? num(e.input));
            put("outputElement", str(e.output) ?? num(e.output));
            put("outputChance", num(e.chance));
            put("outputs", json(e.outputs));
            put("outputsAbove", json(e.outputsAbove));
            put("outputsBelow", json(e.outputsBelow));
            put("minVelocity", num(e.minimumDownwardVelocity));
            break;
        }
        case "processing": {
            put("mode", str(e.mode));
            put("structureType", str(e.structureType) ?? num(e.structureType));
            put("structureId", str(e.structureId) ?? num(e.structureId));
            put("intervalMs", num(e.intervalMs));
            put("handlerKey", str(e.handlerKey));
            break;
        }
        case "contacts": {
            put("inputA", str(e.inputA) ?? num(e.inputA));
            put("inputB", str(e.inputB) ?? num(e.inputB));
            put("outputA", e.outputA === null ? "__null__" : str(e.outputA) ?? num(e.outputA));
            put("outputB", e.outputB === null ? "__null__" : str(e.outputB) ?? num(e.outputB));
            put("orientation", str(e.orientation));
            break;
        }
        case "interactions": {
            put("elementId", str(e.elementId) ?? num(e.elementId));
            put("interactionJson", json(e.interaction));
            break;
        }
        case "terrains": {
            put("name", str(e.name));
            put("hp", num(e.hp));
            put("metaColor", packedToHex(e.metaColor as number | undefined));
            const out = e.output as { elementType?: string | number; chance?: number } | undefined;
            put("outputElement", str(out?.elementType) ?? num(out?.elementType));
            put("outputChance", num(out?.chance));
            for (const k of ["flammable", "fog"]) {
                if (typeof e[k] === "boolean") put(k, String(e[k]));
            }
            break;
        }
        case "techs": {
            put("name", str(e.name));
            put("cost", num(e.cost));
            put("currencyType", str(e.currencyType));
            put("branch", str(e.branch));
            put("requires", Array.isArray(e.requires) ? e.requires.join(", ") : str(e.requires));
            break;
        }
        case "upgrades": {
            put("itemId", str(e.itemId) ?? num(e.itemId));
            put("categoryId", str(e.categoryId));
            put("upgradeJson", json(e.upgrade));
            break;
        }
        case "signals": {
            put("kind", str(e.kind));
            put("target", str(e.target));
            put("handlerKey", str(e.handlerKey));
            break;
        }
        case "triggers": {
            put("interval", num(e.interval));
            put("sequentialRuns", num(e.sequentialRuns));
            put("handlerKey", str(e.handlerKey));
            put("extraJson", json(e.extra));
            break;
        }
        case "behaviors": {
            put("kind", str(e.kind));
            put("definitionJson", json(e.definition));
            break;
        }
        case "energy": {
            put("structureId", str(e.structureId));
            put("type", str(e.type));
            const o = e.options as { priority?: number; excludeFromNetwork?: boolean } | undefined;
            put("priority", num(o?.priority));
            if (typeof o?.excludeFromNetwork === "boolean") {
                put("excludeFromNetwork", String(o.excludeFromNetwork));
            }
            break;
        }
        case "excavation": {
            put("power", num(e.power));
            put("patternJson", json(e.pattern));
            put("optionsJson", json(e.options));
            break;
        }
        case "projectiles": {
            const sprite = e.sprite as { id?: string } | undefined;
            put("spriteId", str(sprite?.id));
            put("getOptionsKey", str(e.getOptionsKey));
            put("optionsJson", json(e.options));
            break;
        }
        case "sprites": {
            put("path", str(e.path));
            if (typeof e.fromMod === "boolean") put("fromMod", String(e.fromMod));
            break;
        }
        case "modifiers": {
            const hook = str(e.hookId) ?? "";
            // A hook id outside the documented list round-trips via the custom box.
            if (hook && !listHookIds().some((o) => o.value === hook)) {
                form.hookId = "__custom__";
                put("hookCustom", hook);
            } else {
                put("hookId", hook || undefined);
            }
            put("kind", str(e.kind));
            put("handlerKey", str(e.handlerKey));
            put("notes", str(e.notes));
            if (typeof e.enabled === "boolean") put("enabled", String(e.enabled));
            break;
        }
        default:
            break;
    }

    // Whatever the form does not own is preserved verbatim.
    const rest = passthroughOf(cat, e);
    if (Object.keys(rest).length > 0) form.advancedJson = JSON.stringify(rest, null, 2);
    return form;
}

/** Form strings → stored config entry (ready for the store's upsert). */
export function formToEntry(
    cat: Tab,
    form: Record<string, string>,
): Record<string, unknown> & { id?: string } {
    // advancedJson is merged FIRST so real form fields always win.
    const entry: Record<string, unknown> = {
        ...(optJson<Record<string, unknown>>(form, "advancedJson") ?? {}),
    };
    const setNum = (k: string, v: number | undefined) => {
        if (v !== undefined) entry[k] = v;
    };
    const setStr = (k: string, v: string | undefined) => {
        if (v !== undefined) entry[k] = v;
    };
    const setBool = (k: string, v: boolean | undefined) => {
        if (v !== undefined) entry[k] = v;
    };
    const id = fullIdOf(form, cat);
    if (id) entry.id = id;

    switch (cat) {
        case "elements": {
            setStr("name", opt(form, "name"));
            setStr("description", opt(form, "description"));
            setStr("matterType", opt(form, "matterType"));
            setNum("density", optNum(form, "density"));
            setNum("horizontalSpeed", optNum(form, "horizontalSpeed"));
            setNum("duration", optNum(form, "duration"));
            const dMin = optNum(form, "durationRandomMin");
            const dMax = optNum(form, "durationRandomMax");
            if (dMin !== undefined || dMax !== undefined) {
                entry.durationRandom = { min: dMin ?? 0, max: dMax ?? dMin ?? 0 };
            }
            const hex = opt(form, "metaColor");
            if (hex && HEX.test(hex)) entry.metaColor = hexToPacked(hex);
            const colors = optJson<number[][]>(form, "colorsJson");
            if (colors) entry.colors = { variants: colors };
            for (
                const k of [
                    "flammable",
                    "isTransportable",
                    "isGrabbable",
                    "collectable",
                    "hidden",
                    "visibleInPicker",
                ]
            ) {
                setBool(k, optBool(form, k));
            }
            break;
        }
        case "structures": {
            setStr("name", opt(form, "name"));
            setStr("description", opt(form, "description"));
            setStr("categoryKey", opt(form, "categoryKey"));
            setNum("order", optNum(form, "order"));
            const type = opt(form, "buildModeType");
            if (type) {
                const dirs: string[] = [];
                if (optBool(form, "dirH")) dirs.push("horizontal");
                if (optBool(form, "dirV")) dirs.push("vertical");
                if (optBool(form, "dirD")) dirs.push("diagonal");
                const mode: Record<string, unknown> = { type };
                if (dirs.length > 0) mode.directions = dirs;
                const span = optNum(form, "spanTiles");
                if (span !== undefined) mode.spanTiles = span;
                entry.buildModes = [mode];
            }
            const shape = optJson<number[][]>(form, "shapeJson");
            if (shape) entry.shape = shape;
            setStr("unlockedBy", opt(form, "unlockedBy"));
            setBool("alwaysUnlocked", optBool(form, "alwaysUnlocked"));
            setBool("hideFromBuildMenu", optBool(form, "hideFromBuildMenu"));
            setBool("disallowPick", optBool(form, "disallowPick"));
            const image = opt(form, "imageName");
            if (image) entry.render = { imageName: image };
            break;
        }
        case "items": {
            setStr("name", opt(form, "name"));
            setStr("description", opt(form, "description"));
            setStr("itemType", opt(form, "itemType"));
            const cd = optNum(form, "cooldownMs");
            if (cd !== undefined) entry.cooldown = cd;
            setNum("energyCost", optNum(form, "energyCost"));
            setStr("excavationProfileId", opt(form, "excavationProfileId"));
            const spriteId = opt(form, "spriteId");
            if (spriteId) {
                const sprite: Record<string, unknown> = { id: spriteId };
                const t = opt(form, "spriteType");
                if (t) sprite.type = t;
                entry.sprite = sprite;
            }
            break;
        }
        case "recipes": {
            setStr("kind", opt(form, "machine"));
            setStr("input", opt(form, "input"));
            setStr("output", opt(form, "outputElement"));
            setNum("chance", optNum(form, "outputChance"));
            const outs = optJson<RecipeOutputEntry[]>(form, "outputs");
            if (outs) entry.outputs = outs;
            const above = optJson<RecipeOutputEntry[]>(form, "outputsAbove");
            if (above) entry.outputsAbove = above;
            const below = optJson<RecipeOutputEntry[]>(form, "outputsBelow");
            if (below) entry.outputsBelow = below;
            setNum("minimumDownwardVelocity", optNum(form, "minVelocity"));
            break;
        }
        case "processing": {
            setStr("mode", opt(form, "mode"));
            setStr("structureType", opt(form, "structureType"));
            setStr("structureId", opt(form, "structureId"));
            setNum("intervalMs", optNum(form, "intervalMs"));
            setStr("handlerKey", opt(form, "handlerKey"));
            break;
        }
        case "contacts": {
            setStr("inputA", opt(form, "inputA"));
            setStr("inputB", opt(form, "inputB"));
            const oa = optSel(form, "outputA");
            if (oa !== undefined) entry.outputA = oa;
            const ob = optSel(form, "outputB");
            if (ob !== undefined) entry.outputB = ob;
            setStr("orientation", opt(form, "orientation"));
            break;
        }
        case "interactions": {
            setStr("elementId", opt(form, "elementId"));
            const interaction = optJson<Record<string, unknown>>(form, "interactionJson");
            if (interaction) entry.interaction = interaction;
            break;
        }
        case "terrains": {
            setStr("name", opt(form, "name"));
            setNum("hp", optNum(form, "hp"));
            const hex = opt(form, "metaColor");
            if (hex && HEX.test(hex)) entry.metaColor = hexToPacked(hex);
            const outEl = opt(form, "outputElement");
            if (outEl) {
                entry.output = { elementType: outEl, chance: optNum(form, "outputChance") ?? 1 };
            }
            setBool("flammable", optBool(form, "flammable"));
            setBool("fog", optBool(form, "fog"));
            break;
        }
        case "techs": {
            setStr("name", opt(form, "name"));
            setNum("cost", optNum(form, "cost"));
            setStr("currencyType", opt(form, "currencyType"));
            setStr("branch", opt(form, "branch"));
            const req = opt(form, "requires");
            if (req) {
                entry.requires = req.split(",").map((s) => s.trim()).filter(Boolean);
            }
            break;
        }
        case "upgrades": {
            setStr("itemId", opt(form, "itemId"));
            setStr("categoryId", opt(form, "categoryId"));
            const up = optJson<Record<string, unknown>>(form, "upgradeJson");
            if (up) entry.upgrade = up;
            break;
        }
        case "signals": {
            setStr("kind", opt(form, "kind"));
            setStr("target", opt(form, "target"));
            setStr("handlerKey", opt(form, "handlerKey"));
            break;
        }
        case "triggers": {
            setStr("triggerId", opt(form, "triggerId"));
            setNum("interval", optNum(form, "interval"));
            setNum("sequentialRuns", optNum(form, "sequentialRuns"));
            setStr("handlerKey", opt(form, "handlerKey"));
            const extra = optJson<Record<string, unknown>>(form, "extraJson");
            if (extra) entry.extra = extra;
            break;
        }
        case "behaviors": {
            setStr("kind", opt(form, "kind"));
            const def = optJson<Record<string, unknown>>(form, "definitionJson");
            if (def) entry.definition = def;
            break;
        }
        case "energy": {
            setStr("structureId", opt(form, "structureId"));
            setStr("type", opt(form, "type"));
            const options: Record<string, unknown> = {};
            const prio = optNum(form, "priority");
            if (prio !== undefined) options.priority = prio;
            const exNet = optBool(form, "excludeFromNetwork");
            if (exNet !== undefined) options.excludeFromNetwork = exNet;
            if (Object.keys(options).length > 0) entry.options = options;
            break;
        }
        case "excavation": {
            setNum("power", optNum(form, "power"));
            const pattern = optJson<number[][]>(form, "patternJson");
            if (pattern) entry.pattern = pattern;
            const options = optJson<Record<string, unknown>>(form, "optionsJson");
            if (options) entry.options = options;
            break;
        }
        case "projectiles": {
            const spriteId = opt(form, "spriteId");
            if (spriteId) entry.sprite = { id: spriteId };
            setStr("getOptionsKey", opt(form, "getOptionsKey"));
            const options = optJson<Record<string, unknown>>(form, "optionsJson");
            if (options) entry.options = options;
            break;
        }
        case "sprites": {
            setStr("path", opt(form, "path"));
            setBool("fromMod", optBool(form, "fromMod"));
            break;
        }
        case "modifiers": {
            setStr("hookId", opt(form, "hookCustom") ?? opt(form, "hookId"));
            setStr("kind", opt(form, "kind"));
            setStr("handlerKey", opt(form, "handlerKey"));
            setStr("notes", opt(form, "notes"));
            setBool("enabled", optBool(form, "enabled"));
            break;
        }
        default:
            break;
    }

    return entry;
}




