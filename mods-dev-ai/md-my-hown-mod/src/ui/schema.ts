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
import {
    DATA_FIELD_MODES,
    INTERACTION_KINDS,
    TOOLTIP_KINDS,
    composeInteraction,
    splitInteraction,
} from "./interaction.ts";
import { definitionFor } from "./definition/index.ts";
import {
    advField,
    autoGraphicsKey,
    boolField,
    DESC_MAX,
    idField,
    NAME_MAX,
    numField,
    PASSTHROUGH_KEY,
    passthroughKeysOf,
    resolveAutoFill,
    spriteIdField,
    textField,
} from "./definition/fields.ts";
import {
    composeTooltipHover,
    describeShape,
    emptyShape,
    normalizeShape,
    parseBuildModes,
    shapeToText,
    structureDefinition,
} from "./definition/structure.ts";
import {
    formatIdList,
    parseIdList,
    parseObjectOrUndefined,
    readerFor,
    safeJson,
    writerFor,
} from "./definition/values.ts";
import { loadConfig } from "../config/store.ts";

/**
 * Re-exported so the panel, the tests and the doc tools keep importing these
 * from one place.
 *
 * They now live in `./definition/`, because every object definition needs them
 * and a definition must not reach back into this file to get them — that would
 * make the registry circular. The import surface does not change.
 */
export { formatIdList, parseIdList, safeJson };

/**
 * Re-exported for the same reason: these now live with the object they describe,
 * but `schema.ts` has been the panel's import address for them since long before
 * there was a `definition/` directory, and moving a file is not a reason to
 * update every caller at once.
 *
 * Re-exported from where they are *defined*, not re-declared: the 4×4 codecs and
 * the build-modes parser belong to the structure, the graphics-key derivation is
 * shared. One implementation, two names for it.
 */
export {
    composeTooltipHover,
    describeShape,
    emptyShape,
    normalizeShape,
    parseBuildModes,
    shapeToText,
} from "./definition/structure.ts";
export { autoGraphicsKey, resolveAutoFill } from "./definition/fields.ts";
export { PASSTHROUGH_KEY, passthroughKeysOf } from "./definition/fields.ts";
import {
    HANDLER_TYPE_LABELS,
    handlerTypesForKeys,
} from "../hooks/handler-registry.ts";
import {
    listAnyHandlerKeys,
    listContactOrientation,
    listCurrencyTypes,
    listDescribedProcessorKeys,
    listDrawFunctions,
    listElements,
    listEnergyNetworkOpts,
    listHandlerKeys,
    listHookIds,
    listItemActionHandlerKeys,
    listItems,
    listKeyCodes,
    listLinkedClearance,
    listMaterialIds,
    listMatterTypes,
    listOutputTargets,
    listProcessorKeys,
    listProjectileHandlerKeys,
    listRecipeMachines,
    listSignalHandlerKeys,
    listSpriteIds,
    listStructureCategories,
    listStructures,
    listTechBranches,
    listTechIds,
    listUnlockNodes,
    listUpgradeCategoryIds,
    listTriggerHandlerKeys,
    listUpgradeHandlerKeys,
    searchLibraryAssets,
    type Opt,
} from "../catalog.ts";

// ── Categories & groups ──────────────────────────────────────────────────────

export type Tab =
    | "elements" | "structures" | "items"
    | "recipes" | "processing" | "contacts" | "interactions"
    | "terrains" | "techs" | "upgrades" | "categories" | "unlockNodes"
    | "signals" | "triggers" | "behaviors" | "energy" | "networks"
    | "excavation" | "projectiles"
    | "sprites" | "modifiers" | "inputs"
    /** Catalogue of the engine's draw functions — no configKey, no storage. */
    | "draws"
    /** Registry browser — no configKey, renders its own body. */
    | "handlers"
    /** Explains the objects and their relations — no configKey. */
    | "help"
    /** Instance-level map of the stored config — no configKey. */
    | "map"
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
    interactions: {
        label: "Tooltips",
        blurb: "The hover text and behaviour an element or terrain shows in-game.",
        configKey: "interactions",
    },
    terrains: { label: "Terrains", blurb: "Diggable tiles: hp, colour, drop output.", configKey: "terrains" },
    unlockNodes: {
        label: "Unlock nodes",
        blurb: "What each structure is gated behind: free from the start, or behind research.",
        configKey: "unlockNodes",
    },
    techs: { label: "Tech nodes", blurb: "Research nodes: cost, branch, unlocks.", configKey: "techs" },
    upgrades: { label: "Upgrades", blurb: "Item upgrade levels and costs.", configKey: "upgrades" },
    categories: {
        label: "Upgrade categories",
        blurb: "Groups that upgrades appear under. The engine rejects a category with no name.",
        configKey: "upgradeCategories",
    },
    inputs: {
        label: "Input bindings",
        blurb: "Custom key bindings that appear in the game's settings.",
        configKey: "inputBindings",
    },
    signals: { label: "Signals", blurb: "Structure click / signal handlers.", configKey: "signals" },
    triggers: { label: "Triggers", blurb: "Interval callbacks (ticks).", configKey: "triggers" },
    behaviors: { label: "Behaviours", blurb: "Conveyor / launcher behaviour definitions.", configKey: "structureBehaviors" },
    energy: {
        label: "Energy interactions",
        blurb: "Attach a conductor/storage energy node to a structure.",
        configKey: "energyTypes",
    },
    networks: {
        label: "Energy networks",
        blurb: "Named energy channels. The game ships one; add the ones you need.",
        configKey: "energyNetworks",
    },
    excavation: { label: "Excavation profiles", blurb: "Dig power + cell pattern.", configKey: "excavationProfiles" },
    projectiles: { label: "Projectiles", blurb: "Sprite-driven projectiles and their options.", configKey: "projectiles" },
    sprites: { label: "Sprites", blurb: "Images loaded from the mod folder.", configKey: "sprites" },
    modifiers: { label: "Hook modifiers", blurb: "Intercept / modify engine hooks (code handlers).", configKey: "modifiers" },
    handlers: {
        label: "Handlers",
        blurb: "Every callable this mod can run — grouped by type, with scope and parameters.",
    },
    /** Draw functions the engine ships, and which structures use them. */
    draws: {
        label: "Custom draw",
        blurb: "What the engine can paint, and which of it this mod uses.",
    },
    json: { label: "JSON", blurb: "Full config: inspect, export, import." },
    help: {
        label: "Graph",
        blurb: "What points at what.",
    },
    map: {
        label: "Map",
        blurb: "A picture of the entries you have made and the links between them.",
    },
};

export interface MenuGroup {
    key: string;
    label: string;
    hint: string;
    categories: Tab[];
}

/**
 * Top-level menu: 7 groups instead of 19 flat tabs.
 *
 * `terrains` sits under Content rather than in a group of its own. It used to
 * have a "World" group that held nothing else, which is a group that costs a
 * click and explains nothing.
 *
 * `Assets`, `Handlers` and `Hooks` used to share one "Assets & hooks" bucket.
 * They are unrelated things that happen to all be defined in code: an image
 * you load, a function you call, and a hook you intercept.
 */
export const MENU_GROUPS: MenuGroup[] = [
    { key: "content", label: "Content", hint: "What the player sees in the world", categories: ["terrains", "elements", "structures", "items"] },
    { key: "extend", label: "Extend", hint: "Add to what the game already does", categories: ["interactions", "behaviors", "excavation", "projectiles", "signals"] },
    { key: "production", label: "Production", hint: "How things transform", categories: ["contacts", "recipes"] },
    { key: "tech", label: "Tech", hint: "Research, progression & upgrades", categories: ["unlockNodes", "techs", "categories", "upgrades"] },
    { key: "actions", label: "Actions", hint: "Reacting to the player and the clock", categories: ["triggers", "inputs", "processing", "modifiers"] },
    { key: "energy", label: "Energy", hint: "Power channels and the nodes on them", categories: ["networks", "energy"] },
    { key: "assets", label: "Assets", hint: "Images, and the code that paints them", categories: ["sprites", "draws"] },
    { key: "handlers", label: "Handlers", hint: "Every function this mod can call", categories: ["handlers"] },
    { key: "help", label: "Graph", hint: "What points at what", categories: ["help"] },
    { key: "data", label: "Data", hint: "Raw JSON, and a map of what you have made", categories: ["map", "json"] },
];

// ── Field specs ──────────────────────────────────────────────────────────────

export type FieldKind =
    | "text" | "number" | "bool" | "select" | "color" | "json" | "outputs" | "shape" | "library"
    /** Repeating row editor: [{ cellType, damage, outputElementType }] (excavation). */
    | "terrainRules"
    /**
     * Repeating row editor: `[{ type, spanTiles? }]` (structure build modes).
     * The form used to hold a single mode, so a structure with more than one
     * silently lost the rest.
     */
    | "buildModes"
    /**
     * Swatch list: `colors.variants`, the engine's `[[r,g,b,a], …]`. Kept as its
     * own kind because the nested tuple is exactly the shape that is painful to
     * hand-write and easy to get subtly wrong.
     */
    | "colorVariants"
    /**
     * Multiple values in one control. The form holds a comma-separated string;
     * the entry always holds a real `string[]` (or is absent when empty).
     */
    | "multiselect";

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
    /**
     * select options: a plain array, or a resolver. The resolver receives the
     * current form values so a picker can narrow by another field's value
     * (e.g. the item handler list follows the chosen `itemType`).
     */
    options?: Opt[] | ((form: Record<string, string>) => Opt[]);
    /** json: "object" | "array" | "matrix" (matrix = rectangular 0/1 grid). */
    jsonType?: "object" | "array" | "matrix";
    /** Only render / validate / save when this returns true. */
    when?: (form: Record<string, string>) => boolean;
    /** Default value for a fresh form. */
    def?: string;
    /** Full-width control (textarea / outputs editor). */
    wide?: boolean;
    /**
     * multiselect only: what to say when there is nothing to pick from yet.
     * The user is told what to create rather than being handed a text box,
     * because a reference field must not accept a typed id.
     */
    emptyHint?: string;
    /**
     * library only: when an asset is picked, also fill this other field with a
     * derived value (e.g. the graphics key `sprites:<name>`). The derived value
     * is only written when the target is empty or still holds a previous
     * auto-generated value, so it never clobbers a hand-typed key.
     */
    autoKey?: string;
    /** library only: value previously auto-written, so it can be replaced safely. */
    autoValue?: string;
}

/**
 * Colour variants: the `colors.variants` list, as swatches.
 *
 * The engine's shape is `{ colors: { variants: [[r,g,b,a], …] } }` — confirmed
 * against every workshop mod that uses it (`__scraped-mods/workshop/3790149867`,
 * `3792673946`). Each entry is a per-cell tint chosen at random, which is why
 * real mods ship four or five of them: a single flat colour looks synthetic.
 *
 * These conversions are pure so the editor, the round trip and the tests all
 * agree on one definition. Alpha is kept, not dropped: the real mods use both
 * 255 and 200, and a picker that rounded alpha to opaque would silently change
 * how a translucent liquid looks.
 */

/** `[[r,g,b,a], …]` → `["#rrggbbaa", …]`, skipping anything malformed. */
export function variantsToHexList(raw: string | undefined): string[] {
    if (!raw?.trim()) return [];
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return [];
    }
    const arr = Array.isArray(parsed)
        ? parsed
        : (parsed as { variants?: unknown } | null)?.variants;
    if (!Array.isArray(arr)) return [];
    const out: string[] = [];
    for (const row of arr) {
        if (!Array.isArray(row) || row.length < 3) continue;
        const [r, g, b, a] = row as number[];
        const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(Number(n) || 0)));
        const hex = (n: number) => clamp(n).toString(16).padStart(2, "0");
        out.push(`#${hex(r)}${hex(g)}${hex(b)}${hex(a === undefined ? 255 : a)}`);
    }
    return out;
}

/** `["#rrggbbaa", …]` → the `[[r,g,b,a], …]` the engine wants. */
export function hexListToVariants(list: string[]): [number, number, number, number][] {
    return list
        .filter((h) => /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(h))
        .map((h) => {
            const s = h.slice(1);
            return [
                parseInt(s.slice(0, 2), 16),
                parseInt(s.slice(2, 4), 16),
                parseInt(s.slice(4, 6), 16),
                s.length >= 8 ? parseInt(s.slice(6, 8), 16) : 255,
            ];
        });
}

/**
 * The variant that should be offered first.
 *
 * An element with a map colour and no variants is a perfectly good element —
 * the colour is just what every cell gets. So the first swatch is seeded from
 * the map colour rather than left to a default, which means setting `metaColor`
 * alone already looks right and the variants are a refinement on top of it
 * rather than a second thing you have to remember to set.
 */
export function seedVariantFromMapColor(mapColorHex: string | undefined): string {
    return mapColorHex && HEX.test(mapColorHex) ? `${mapColorHex}ff` : "#ccccccff";
}
function elSelect(key: string, label: string, section: string, required = false, hint?: string): FieldSpec {
    return { key, label, kind: "select", section, required, options: listElements, hint };
}

// ── Per-category field lists ────────────────────────────────────────────────

/**
 * Field lists for every tab that has not been split into its own definition.
 *
 * Partial on purpose: a tab listed here is a tab that has *not* been moved yet.
 * `fieldsFor` asks the registry first and falls back to this, so migrating a tab
 * is deleting its entry here and adding one line to the registry — and a partial
 * record is what makes that one-step move expressible in the type system rather
 * than only in someone's memory.
 */
const FIELDS: Partial<Record<Tab, FieldSpec[]>> = {
    elements: [
        idField(),
        textField("name", "Name", "Identity", true, { maxLength: NAME_MAX }),
        textField("description", "Description", "Identity", false, { maxLength: DESC_MAX }),
        textField("descriptionKey", "Description key (i18n)", "Identity", false, {
            placeholder: "mods|example|element|desc",
            maxLength: 120,
        }),
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
            // engine shape: `{ colors: { variants: [[r,g,b,a], …] } }`, confirmed
            // against every workshop mod that uses it. Each variant is a tint
            // the engine picks at random per cell, which is why shipping mods
            // list four or five — a single flat colour looks synthetic. It was a
            // raw JSON textarea, so the user hand-wrote nested tuples and had to
            // remember alpha was the fourth number.
            key: "colorsJson",
            label: "Colour variants",
            kind: "colorVariants",
            section: "Appearance",
            wide: true,
            hint:
                "one tint per cell, picked at random. With none set, every cell uses the map colour. Add four or five for a natural look.",
        },
        boolField("flammable", "Flammable", "Behaviour"),
        boolField("isTransportable", "Transportable", "Behaviour", "true", "conveyors / launchers can move it"),
        boolField("isGrabbable", "Grabbable", "Behaviour"),
        boolField("collectable", "Collectable", "Behaviour", "true", "collector value path"),
        boolField("hidden", "Hidden", "Flags"),
        boolField("visibleInPicker", "Visible in picker", "Flags", "true"),
        advField(),
    ],
    items: [
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
            key: "itemType", label: "Item type", kind: "select", section: "Item",
            required: true, def: "Tool",
            options: [
                { value: "Tool", label: "Tool (2) — digs via an excavation profile" },
                { value: "Weapon", label: "Weapon (1) — fires a projectile" },
                { value: "Consumable", label: "Consumable (3) — used up on the player" },
                { value: "Mod", label: "Mod (4) — passive / misc" },
            ],
            hint: "itemType only labels the slot; behaviour comes from the fields below",
        },
        // Only a Tool has an excavation profile.
        {
            key: "excavationProfileId", label: "Excavation profile", kind: "select", section: "Item",
            when: (f) => f.itemType === "Tool",
            options: () => listConfigured("excavationProfiles"),
            hint: "api.items excavationProfileId — what this tool digs with",
        },
        // Weapon behaviour is a projectile reference.
        {
            key: "projectileId", label: "Projectile", kind: "select", section: "Item",
            when: (f) => f.itemType === "Weapon",
            options: () => listConfigured("projectiles"),
            hint: "spawned via api.projectiles.createBlueprintFromId(id)",
        },
        // `itemType` only labels the slot; the *behaviour* is ItemDefinition.
        // handleAction, which the engine calls with an ActionType. ActionType has
        // no Consumable, so a Consumable deliberately gets no handler at all.
        {
            key: "handlerKey", label: "Use action", kind: "select", section: "Item",
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
            min: 0, max: 600000, hint: "0 = none",
            when: (f) => f.itemType === "Tool" || f.itemType === "Weapon",
        }),
        numField("energyCost", "Energy cost", "Item", {
            min: 0, max: 10000,
            when: (f) => f.itemType === "Tool" || f.itemType === "Weapon",
            hint: "energy drawn per use (api.items energyCost)",
        }),
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
            // api.structures.processing.register(id, { structureType, intervalMs, process }).
            // There is NO "single instance" mode — the definition is keyed by
            // *structure type*, so the old mode/structureId pair was invented.
            key: "structureType", label: "Structure type", kind: "select", section: "Target",
            required: true, options: listStructures,
            hint: "process() runs for every placed instance of this structure type",
        },
        numField("intervalMs", "Interval (ms)", "Timing", {
            required: true, min: 16, max: 60000, def: "1000",
            hint: "must be > 0 — how often the callback fires per instance",
        }),
        {
            key: "handlerKey", label: "Process handler", kind: "select", section: "Timing",
            required: true, options: listDescribedProcessorKeys,
            hint: "process(structure, context) is code — JSON can't store callbacks, pick a preset",
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
        // The panel used to be one free JSON box under a label that gave no clue
        // what it was for. Now it is the `kind` union from `elements.d.ts`, with
        // only the fields the chosen kind actually has.
        {
            key: "interactionKind",
            label: "What kind of interaction",
            kind: "select",
            section: "What it does",
            required: true,
            options: INTERACTION_KINDS.map((k) => ({ value: k.kind, label: k.label })),
            hint: "this is the tooltip shown when you hold a tool over this element",
        },
        {
            key: "structures",
            label: "Structures",
            kind: "multiselect",
            section: "What it does",
            options: listStructures,
            emptyHint: "add a Structure first — there is nothing this can point at yet.",
            when: (f) => f.interactionKind === "structure",
            hint: "the machines this element interacts with",
        },
        {
            key: "destroyerItems",
            label: "Items it destroys",
            kind: "multiselect",
            section: "What it does",
            options: listItems,
            emptyHint: "add an Item first — there is nothing this could destroy yet.",
            when: (f) => f.interactionKind === "destroyer",
        },
        {
            // There is no entity registry to enumerate, so unlike the two above
            // this one really is free text. It is the only reference field in the
            // form that is, and the hint says why.
            key: "entities",
            label: "Entity types",
            kind: "text",
            section: "What it does",
            when: (f) => f.interactionKind === "entity",
            placeholder: "enemy, drone",
            maxLength: 200,
            hint: "comma-separated. The engine exposes no entity list to pick from.",
        },
        textField("tipTextKey", "Tooltip text key (i18n)", "Tooltip", false, {
            placeholder: "mods|example|acid|interaction",
            maxLength: 120,
            when: (f) => TOOLTIP_KINDS.includes(f.interactionKind as never),
        }),
        {
            key: "tipVisibility",
            label: "When to show it",
            kind: "select",
            section: "Tooltip",
            options: DATA_FIELD_MODES,
            when: (f) => TOOLTIP_KINDS.includes(f.interactionKind as never),
        },
        numField("tipDataField", "Data field number", "Tooltip", {
            min: 1,
            max: 4,
            int: true,
            when: (f) =>
                TOOLTIP_KINDS.includes(f.interactionKind as never) &&
                (f.tipVisibility === "visibleWhen" || f.tipVisibility === "crossedOutWhen"),
            hint: "1–4; matches the data field a structure writes",
        }),
        numField("tipDataFieldEquals", "Equals", "Tooltip", {
            min: 0,
            max: 255,
            int: true,
            when: (f) =>
                TOOLTIP_KINDS.includes(f.interactionKind as never) &&
                (f.tipVisibility === "visibleWhen" || f.tipVisibility === "crossedOutWhen"),
        }),
        {
            key: "tipOnlyWhenTranslated",
            label: "Only if translated",
            kind: "bool",
            section: "Tooltip",
            def: "false",
            hint: "hide the label rather than showing raw text when the key has no translation",
        },
        {
            // Not offered as a control. Kept in the round trip so a stored
            // descriptor — or one with a field this form does not model —
            // survives a save byte for byte. Only rendered when the stored
            // object really does hold something this panel cannot show.
            key: "interactionJson",
            label: "Fields this panel does not show",
            kind: "json",
            section: "Advanced",
            jsonType: "object",
            wide: true,
            when: (f) => splitInteraction(parseObjectOrUndefined(f.interactionJson)).unmodelled,
            hint: "carried through untouched — edit only to set a field this panel has no control for",
        },
    ],

    terrains: [
        idField(),
        textField("name", "Name", "Identity", true, { maxLength: NAME_MAX }),
        textField("nameKey", "Name key (i18n)", "Identity", false, {
            placeholder: "mods|example|terrain|name",
            maxLength: 120,
        }),
        // engine type: [number, number, number] — H, S, L
        numField("colorHSLHue", "Hue", "Colour", {
            min: 0, max: 360, step: 1, int: true, when: (f) => f.colorHSLOn === "true",
        }),
        numField("colorHSLSaturation", "Saturation", "Colour", {
            min: 0, max: 1, step: 0.01, when: (f) => f.colorHSLOn === "true",
        }),
        numField("colorHSLLightness", "Lightness", "Colour", {
            min: 0, max: 1, step: 0.01, when: (f) => f.colorHSLOn === "true",
        }),
        {
            key: "colorHSLOn", label: "Set base HSL colour", kind: "bool", section: "Colour",
            def: "false",
            hint: "overrides the default terrain colour; H 0-360, S and L 0-1",
        },
        {
            key: "excavationRequirements", label: "Required tools", kind: "multiselect",
            section: "Tile", options: listItems,
            emptyHint: "add an Item first — a terrain can only require a tool that exists.",
            hint: "item ids needed to dig this terrain",
        },
        {
            // engine type: readonly { kind: string; [key: string]: unknown }[]
            key: "interactionsJson", label: "Tooltip interactions", kind: "json",
            section: "Tile", jsonType: "array", wide: true,
            hint: "interactions shown for this terrain, e.g. [ { \"kind\": \"…\" } ]",
        },
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
        {
            // engine: `const s = t?.materialId; if (void 0 !== s) { … throw }`
            //   must be a number, > i.A.obstacleBreakpoint, and < 150,
            //   and additionally within [obstacleBreakpoint + 1, 149]
            // `obstacleBreakpoint` turned out to be a real constant, 100
            // (`utils-worker.js/90823.js`), so the range is exactly 101–149.
            // Every value in it is an obstacle, so there are no tiers to name —
            // the picker offers the engine's own next-free id instead of
            // inviting a hand-typed collision.
            key: "materialId",
            label: "Material id",
            kind: "select",
            section: "Tile",
            options: listMaterialIds,
            hint: "must be 101–149; every value is an obstacle, so the engine's next-free id is the safe pick",
        },
        // No `fog` field: `fog` is not a documented terrain property. "Water Fog"
        // and "Lava Fog" are *terrain entries*, not a per-terrain boolean, so a
        // foggy-looking terrain must be registered as its own terrain id.
        advField(),
    ],
    unlockNodes: [
        idField(),
        textField("name", "Name", "Identity", true, { maxLength: NAME_MAX }),
        {
            // Ours, not the engine's. "always" stays mod-owned and needs no
            // research; "tech" builds a real in-game tech node at apply time.
            key: "kind",
            label: "Kind",
            kind: "select",
            section: "Identity",
            required: true,
            def: "always",
            options: [
                { value: "always", label: "always — available from the start" },
                { value: "tech", label: "tech — a real research step in the game's tech tree" },
            ],
            hint: "a tech node is a real research step in the game's tech tree",
        },
        {
            // The borrow is exclusive: an engine tech keeps its own definition,
            // so a cost typed alongside it would be a second source for the same
            // node. Rendered as a toggle because that is the decision being made
            // — build a node, or use one that is already in the tree.
            key: "useExistingTech",
            label: "Reuse an engine tech",
            kind: "bool",
            section: "Node",
            def: "false",
            hint: "off: this node builds its own tech. on: it borrows one already in the tree.",
        },
        {
            key: "techId",
            label: "Engine tech to reuse",
            kind: "select",
            section: "Node",
            when: (f) => f.kind === "tech" && f.useExistingTech === "true",
            options: (f) => listTechIds(f.idSuffix),
            emptyHint: "add a Tech first — there is nothing to borrow.",
            hint: "several nodes can sit behind the same research step",
        },
        numField("cost", "Cost", "Research", {
            min: 0, max: 999999, def: "100",
            when: (f) => f.kind === "tech" && f.useExistingTech !== "true",
        }),
        {
            key: "currencyType", label: "Currency", kind: "select", section: "Research",
            options: listCurrencyTypes,
            when: (f) => f.kind === "tech" && f.useExistingTech !== "true",
            hint: "TechDefinition.currencyType — a free string in the engine",
        },
        {
            key: "currencyTypeCustom", label: "Currency id", kind: "text", section: "Research",
            when: (f) => f.currencyType === "__custom__",
            placeholder: "coins", maxLength: 32,
            pattern: "^[a-z0-9][a-z0-9._-]{0,31}$",
            patternMsg: "lowercase id (a-z 0-9 . _ -)",
        },
        {
            key: "branch", label: "Branch", kind: "select", section: "Research",
            options: listTechBranches,
            when: (f) => f.kind === "tech" && f.useExistingTech !== "true",
            hint: "TechDefinition.branch — usually copied from the parent node",
        },
        {
            key: "branchCustom", label: "Branch id", kind: "text", section: "Research",
            when: (f) => f.branch === "__custom__",
            placeholder: "industry", maxLength: 32,
            pattern: "^[a-z0-9][a-z0-9._-]{0,31}$",
            patternMsg: "lowercase id (a-z 0-9 . _ -)",
        },
        {
            key: "parentId", label: "Parent node", kind: "select", section: "Research",
            when: (f) => f.kind === "tech" && f.useExistingTech !== "true",
            options: (f) => listTechIds(f.idSuffix),
            emptyHint: "add another Tech first — a node cannot be its own parent.",
            hint: "without one the tech is never placed in the grid and cannot be bought",
        },
        {
            key: "requires", label: "Requires", kind: "multiselect", section: "Research",
            when: (f) => f.kind === "tech" && f.useExistingTech !== "true",
            options: (f) => listTechIds(f.idSuffix),
            emptyHint: "add another Tech first — a node cannot require itself.",
            hint: "other research that must be done first",
        },
        textField("description", "Description", "Identity", false, { maxLength: DESC_MAX }),
        {
            // Read-only in the form's terms: the link lives on each structure, and
            // this is the reverse view of it. Declared so the graph can show what a
            // node holds back — see the `gatesStructures` row in relations.ts.
            key: "gatesStructures", label: "Structures it unlocks", kind: "multiselect",
            section: "Identity",
            options: listStructures,
            emptyHint: "no structure points at this node yet.",
            hint: "derived — set it on each structure, not here. Shown so you can see what rides on this node.",
        },
        advField(),
    ],
    techs: [
        idField(),
        textField("name", "Name", "Identity", true, { maxLength: NAME_MAX }),
        numField("cost", "Cost", "Research", { required: true, min: 0, max: 999999, def: "100" }),
        // `currencyType` / `branch` are plain strings in TechDefinition — there is
        // no CurrencyType or Branch enum to read. Offering a picker anyway stops
        // typos reaching the engine, while "__custom__" keeps custom values legal.
        {
            key: "currencyType", label: "Currency", kind: "select", section: "Research",
            options: listCurrencyTypes, hint: "TechDefinition.currencyType — a free string in the engine",
        },
        {
            key: "currencyTypeCustom", label: "Currency id", kind: "text", section: "Research",
            when: (f) => f.currencyType === "__custom__",
            placeholder: "coins", maxLength: 32,
            pattern: "^[a-z0-9][a-z0-9._-]{0,31}$",
            patternMsg: "lowercase id (a-z 0-9 . _ -)",
        },
        {
            key: "branch", label: "Branch", kind: "select", section: "Research",
            options: listTechBranches, hint: "TechDefinition.branch — usually copied from the parent node",
        },
        {
            key: "branchCustom", label: "Branch id", kind: "text", section: "Research",
            when: (f) => f.branch === "__custom__",
            placeholder: "industry", maxLength: 32,
            pattern: "^[a-z0-9][a-z0-9._-]{0,31}$",
            patternMsg: "lowercase id (a-z 0-9 . _ -)",
        },
        {
            key: "parentId", label: "Parent node", kind: "select", section: "Research",
            options: (f) => listTechIds(f.idSuffix),
            hint: "feeds registerNode(techId, def, { parentId }) — grids this node under a parent",
        },
        {
            key: "requires", label: "Requires", kind: "multiselect", section: "Research",
            options: (f) => listTechIds(f.idSuffix),
            emptyHint: "add another Tech first — a node cannot require itself.",
            hint: "TechDefinition.requires — a node can never require itself",
        },
        textField("description", "Description", "Research", false, {
            maxLength: DESC_MAX,
        }),
        textField("descriptionKey", "Description key (i18n)", "Research", false, {
            placeholder: "mods|example|tech|desc",
            maxLength: 120,
            hint: "used when no plain description is set",
        }),
        {
            // TechDefinition.unlocks = { structures?: string[], items?: string[] }.
            // This is the declarative route — no handler needed. It is also the
            // ONLY route: there is no per-structure "unlockedBy" field.
            key: "unlockStructures", label: "Unlocks structures", kind: "multiselect", section: "Unlocks",
            options: listStructures,
            emptyHint: "add a Structure first — or tick Always unlocked on the structure itself.",
            hint: "researching this node makes these buildable",
        },
        {
            key: "unlockItems", label: "Unlocks items", kind: "multiselect", section: "Unlocks",
            options: listItems,
            emptyHint: "add an Item first — there is nothing this node can grant yet.",
            hint: "items granted when the research completes",
        },
        advField(),
    ],
    categories: [
        idField(),
        {
            // api.upgrades.registerCategory({ id, name?, nameKey?, requirement? })
            // The engine guard is: if (!t.id || !t.name && !t.nameKey) throw
            // so at least one of `name` / `nameKey` must be set. This field is
            // not marked `required` on its own — that would reject a category
            // that supplies only a name key. The rule is enforced by the
            // cross-field check in validateForm instead.
            key: "name", label: "Display name", kind: "text", section: "Identity",
            maxLength: NAME_MAX,
            hint: "needed unless a name key is set — the engine throws without one",
        },
        textField("nameKey", "Name key (i18n)", "Identity", false, {
            placeholder: "mods|example|category|name",
            maxLength: 120,
        }),
        {
            // `upgrades.registerCategory` stores this verbatim as
            // `mods.upgradeCategories[id].requirement`, and a grep of the whole
            // repo finds nothing that reads it. No shipped mod sets it either.
            //
            // So it is offered as a tech id — the only shape a mod would
            // plausibly mean by "requirement" — but labelled as a pass-through
            // the engine stores and never uses, rather than dressed up as a
            // feature. The raw box stays as the honest escape hatch.
            key: "requirementTechId",
            label: "Requirement (stored only)",
            kind: "select",
            section: "Identity",
            options: (f) => listTechIds(f.idSuffix),
            emptyHint: "add a Tech first — there is nothing to point at.",
            hint: "the engine stores this and never reads it, so nothing happens either way. Set it only if you know your build consumes it.",
        },
        {
            key: "requirementJson",
            label: "Requirement (raw)",
            kind: "json",
            section: "Advanced",
            jsonType: "object",
            wide: true,
            when: (f) => f.requirementTechId === "__custom__",
            hint: "for a shape other than a tech id — stored verbatim, and equally unread",
        },
        advField(),
    ],
    inputs: [
        idField(),
        // api.input.registerBinding(bindingId, defaultKeys, definition)
        textField("displayName", "Display name", "Identity", true, { maxLength: NAME_MAX }),
        textField("displayNameKey", "Display name key (i18n)", "Identity", false, {
            placeholder: "mods|example|toggle",
            maxLength: 120,
            hint: "overrides the display name when set",
        }),
        textField("category", "Settings category", "Identity", true, {
            maxLength: NAME_MAX,
            def: "Mod controls",
            hint: "grouping heading in the game's settings screen",
        }),
        {
            // KeyCode is a LooseString union, so this is a picker that offers
            // suggestions rather than a closed list — chords like
            // "Control+KeyC" are valid and cannot be enumerated ahead of time.
            key: "defaultKeys", label: "Default keys", kind: "multiselect",
            section: "Binding", options: listKeyCodes,
            emptyHint: "no suggested keys are available from the host yet; the binding will start unbound.",
            hint: "chords like Control+KeyC are allowed",
        },
        {
            key: "onDownKey", label: "Press handler", kind: "select", section: "Binding",
            options: listAnyHandlerKeys,
            hint: `runs when the key goes down. ${
                typesHintFor(() => listAnyHandlerKeys())
            }`,
        },
        {
            key: "onUpKey", label: "Release handler", kind: "select", section: "Binding",
            options: listAnyHandlerKeys,
            hint: `runs when the key comes back up. ${
                typesHintFor(() => listAnyHandlerKeys())
            }`,
        },
        {
            key: "subsectionJson", label: "Subsection", kind: "json", section: "Identity",
            jsonType: "object", wide: true,
            hint: "optional settings group: { title, titleKey, description, descriptionKey }",
        },
        advField(),
    ],
    upgrades: [
        idField(),
        {
            // api.upgrades.register({ itemId, categoryId, upgrade: { id, maxLevel, costs, oneOff? } })
            // The payload is NESTED under `upgrade` — the old flat guess was wrong.
            key: "itemId", label: "Item", kind: "select", section: "Upgrade",
            required: true, options: listItems,
        },
        {
            // Not a label, a reference — which is why it is a picker and not a text
            // box whose hint told you to go and look the id up somewhere else.
            //
            // `api.upgrades.registerCategory` is write-only: there is no
            // `listCategories` to call, so the game may well hold categories we
            // have never heard of. The picker offers what we *do* know plus
            // `__custom__`, and the hint says so — an unlabelled escape hatch reads
            // as an oversight, a labelled one is a documented boundary.
            key: "categoryId", label: "Category", kind: "select", section: "Upgrade",
            def: "tools", options: listUpgradeCategoryIds,
            hint:
                "must be a category the game knows. “custom” is for one it has and we " +
                "cannot list — api.upgrades has no way to read them back.",
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
            required: true, min: 1, max: 100, def: "3",
        }),
        {
            // costs is number[] — one entry per level, priced in gold.
            key: "costsJson", label: "Costs per level", kind: "json", section: "Upgrade",
            jsonType: "array", required: true, wide: true,
            hint: "one number per level, e.g. [100, 250, 500]",
            placeholder: "[100, 250, 500]",
        },
        boolField("oneOff", "One-off", "Upgrade", "false", "can only be bought once"),
        {
            key: "onUpgradeKey", label: "On upgrade handler", kind: "select", section: "Upgrade",
            options: listUpgradeHandlerKeys,
            hint: "optional code callback run when a level is bought",
        },
        advField(),
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
            required: true, options: listSignalHandlerKeys,
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
            required: true, options: listTriggerHandlerKeys,
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
            hint: "which simulation pass this joins — there is no third one",
        },
        // The structure ids live inside `definition` because that is the shape
        // the engine wants, but each is its own control here and each is merged
        // in on the way out. A conveyor is registered against a single structure
        // (`definition.id`); a launcher against three, under exactly the names the
        // engine uses.
        {
            key: "structureId", label: "Structure", kind: "select", section: "Behaviour",
            required: true, when: (f) => f.kind !== "launcher", options: listStructures,
        },
        {
            key: "upType", label: "Up structure", kind: "select", section: "Behaviour",
            required: true, when: (f) => f.kind === "launcher", options: listStructures,
        },
        {
            key: "leftType", label: "Left structure", kind: "select", section: "Behaviour",
            required: true, when: (f) => f.kind === "launcher", options: listStructures,
        },
        {
            key: "rightType", label: "Right structure", kind: "select", section: "Behaviour",
            required: true, when: (f) => f.kind === "launcher", options: listStructures,
        },
        {
            // Whatever the engine reads that the four controls above do not name.
            // The named ids are merged in on save, and anything typed here wins
            // over them — so an unmodellable key is still expressible.
            key: "definitionJson", label: "Rest of the payload", kind: "json", section: "Behaviour",
            jsonType: "object", wide: true,
            hint: "everything else, forwarded to structureBehaviors.register*. The structure ids above are merged in; anything here wins over them.",
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
            // api.energy.registerType(structureId, type, options?) accepts exactly
            // two roles: "conductor" (forwards energy) and "storage" (holds it).
            // There is no producer/consumer role — producing or consuming energy is
            // done by a processor handler calling addAtCell / consume.
            key: "type", label: "Role", kind: "select", section: "Energy",
            required: true, def: "storage", options: [
                { value: "storage", label: "storage — holds energy (needs a capacity)" },
                { value: "conductor", label: "conductor — forwards energy, holds nothing" },
            ],
        },
        numField("capacity", "Capacity", "Energy", {
            min: 0, max: 1_000_000, def: "1000",
            when: (f) => f.type === "storage",
            hint: "max energy this node can hold (api.energy.registerType options.capacity)",
        }),
        {
            // A closed set in the engine, but one the game gives us no way to
            // enumerate — `options.energyType` is a bare string and nothing in the
            // api lists the channels. That is exactly why this is a picker over
            // *our* config plus the engine's own default: a typo here registers
            // cleanly and the node then never joins anything, looking configured
            // and doing nothing.
            key: "energyType", label: "Network", kind: "select", section: "Energy",
            options: listEnergyNetworkOpts,
            hint: "options.energyType — which network to join. The engine's default is \"power\".",
        },
        numField("priority", "Priority", "Energy", {
            min: 0, max: 1000, def: "0",
            when: () => true,
            hint: "network priority (only read by the engine if it supports it)",
        }),
        advField(),
    ],
    networks: [
        idField(),
        textField("name", "Display name", "Identity", false, {
            maxLength: DESC_MAX,
            hint: "optional — shown in this list; the engine only ever sees the id",
        }),
        advField(),
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
            key: "terrainRulesJson", label: "Terrain rules", kind: "terrainRules", section: "Profile",
            wide: true,
            hint: "per-terrain dig behaviour: which terrain matches, how much damage, what it drops",
        },
        {
            key: "optionsJson", label: "Options", kind: "json", section: "Profile",
            jsonType: "object", wide: true,
            hint: "{ fromGun?, fromDrill?, drillTierDamage? (0–1000), forceRemoveAll?, … }",
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
            options: listProjectileHandlerKeys,
            hint: "dynamic options factory (optional) — overrides the static options below",
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
            key: "path", label: "Bundled asset", kind: "library", section: "File", required: true,
            wide: true,
            autoKey: "idSuffix",
            placeholder: "search icons by name…",
            hint: "pick a PNG from assets/icons/ — the path is filled in for you",
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
    /** The handlers tab renders its own body from the typed registry. */
    handlers: [],
    json: [],
    // `draws`, `help` and `map` render their own bodies rather than a form:
    // a draw function is code the engine calls, not an entry anything creates.
    // `fieldsFor("draws")` being empty is the assertion that keeps a "New" button
    // from ever appearing there.
    draws: [],
    help: [],
    map: [],
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

// ── multiselect encoding ─────────────────────────────────────────────────────
//
// Encoding lives in `parseIdList` / `formatIdList` above; a `multiselect` field
// is a comma-separated string in the form and a real `string[]` in the entry.

/**
 * Name the handler types a slot accepts, for the slot's own hint.
 *
 * The pickers already filter to legal handlers, so the dropdown is never wrong —
 * but a short list with no explanation reads as a bug. This turns the filter
 * into a sentence, at the point where the user is actually choosing.
 */
function typesHintFor(pick: () => Opt[]): string {
    const types = handlerTypesForKeys(pick().map((o) => o.value));
    if (types.length === 0) {
        return "No handler serves this slot.";
    }
    return `Accepts: ${types.map((t) => HANDLER_TYPE_LABELS[t]).join(", ")}.`;
}

export function resolveOptions(f: FieldSpec, form: Record<string, string> = {}): Opt[] {
    if (!f.options) return [];
    try {
        return typeof f.options === "function" ? f.options(form) : f.options;
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
    // A definition that has been split out owns its own field list, so it is
    // asked first. `FIELDS` is the fallback for every tab not yet moved, which
    // is what lets the split proceed one object at a time: moving a tab is
    // deleting its entry here, and nothing else has to know.
    return definitionFor(cat)?.fields ?? FIELDS[cat] ?? [];
}

export interface Section {
    title: string;
    fields: FieldSpec[];
}

/**
 * The form's sections, with the ones that have nothing to say left out.
 *
 * A section survives only while it holds at least one field that is currently
 * active, so passing the form matters: without it every section is returned as
 * declared, which is what the docs and the reference generator want (they
 * describe the form, not one instance of it).
 *
 * The panel passes the live form so an entry carrying nothing hidden shows no
 * "Advanced" heading at all — see {@link PASSTHROUGH_KEY}.
 */
export function sectionsFor(cat: Tab, form?: Record<string, string>): Section[] {
    const out: Section[] = [];
    for (const f of fieldsFor(cat)) {
        if (form && !isActive(f, form)) continue;
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
function fullIdOf(form: Record<string, string>, cat?: Tab): string {
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

function hexToPacked(hex: string): number {
    return parseInt(hex.slice(1), 16) & 0xffffff;
}

function packedToHex(n: number | undefined): string {
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

function validateMatrix(value: unknown): string | null {
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

function validateOutputs(raw: string): string | null {
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
function validateField(f: FieldSpec, form: Record<string, string>, cat?: Tab): string | null {
    if (!isActive(f, form)) return null;
    const raw = (form[f.key] ?? "").trim();

    if (f.kind === "bool") return null;

    if (!raw) {
        if (f.required) return f.kind === "outputs" ? "add at least one output" : "required";
        return null;
    }

    // A definition owns the validation of its own field kinds. Asked first, so
    // adding a structure-only kind never means adding a case here.
    const own = cat === undefined ? undefined : definitionFor(cat)?.validateField?.(f, raw);
    if (own !== undefined) return own;

    switch (f.kind) {
        case "text":
            if (f.maxLength && raw.length > f.maxLength) return `max ${f.maxLength} characters`;
            if (f.pattern && !new RegExp(f.pattern).test(raw)) {
                return f.patternMsg ?? `must match ${f.pattern}`;
            }
            return null;
        // `library` stores a text path, but the value must be a real bundled asset
        // so a hand-edited / imported path can never point at a missing file.
        case "library": {
            const known = searchLibraryAssets("").some((a) => a.path === raw);
            return known ? null : "not a bundled asset — pick one from the list";
        }
        case "number": {
            if (!NUMERIC.test(raw)) return "must be a number";
            const n = Number(raw);
            if (f.int && !Number.isInteger(n)) return "must be a whole number";
            if (f.min !== undefined && n < f.min) return `min ${f.min}`;
            if (f.max !== undefined && n > f.max) return `max ${f.max}`;
            return null;
        }
        case "multiselect": {
            // Form value is a comma-separated list; every token must be a real
            // option so a typo cannot reach the engine as a dangling reference.
            const opts = resolveOptions(f, form);
            const tokens = parseIdList(raw);
            if (opts.length === 0) return null; // free-form list
            const bad = tokens.filter((t) => !opts.some((o) => o.value === t));
            if (bad.length > 0) return `not a listed value: ${bad.join(", ")}`;
            return null;
        }
        case "select": {
            if (raw === "__null__" || raw === "__custom__") return null;
            const opts = resolveOptions(f, form);
            if (opts.length > 0 && !opts.some((o) => o.value === raw)) {
                return "pick one of the listed values";
            }
            return null;
        }
        case "color":
            return HEX.test(raw) ? null : "use #rrggbb";
        case "outputs":
            return validateOutputs(raw);
        case "terrainRules": {
            const parsed = parseJsonRaw(raw);
            if (!parsed.ok) return parsed.error ?? "invalid JSON";
            if (!Array.isArray(parsed.value)) return "must be a JSON array [ ]";
            for (const [i, rule] of parsed.value.entries()) {
                if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
                    return `rule ${i + 1} must be an object`;
                }
                const r = rule as Record<string, unknown>;
                if (r.cellType === undefined && r.terrainType === undefined) {
                    return `rule ${i + 1}: pick a terrain`;
                }
                if (r.damage !== undefined && !Number.isFinite(Number(r.damage))) {
                    return `rule ${i + 1}: damage must be a number`;
                }
            }
            return null;
        }
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
        const err = validateField(f, form, cat);
        if (err) errors[f.key] = err;
    }
    // Cross-field rules belong to the definition that owns the object, so they
    // travel with it. What is left here is the handful of shared ones that are
    // not yet split out.
    definitionFor(cat)?.validate?.(form, errors);
    if (cat === "elements" && !errors.durationRandomMin && !errors.durationRandomMax) {
        const min = form.durationRandomMin?.trim();
        const max = form.durationRandomMax?.trim();
        if (min && max && Number(min) > Number(max)) {
            errors.durationRandomMax = "must be ≥ min";
        }
    }
    // The engine guard is `if (!t.id || !t.name && !t.nameKey) throw`, so a
    // category with neither name fails at registration with nothing to point at.
    // `name` alone is not marked required, because a name key is equally valid.
    if (cat === "categories" && !errors.name && !errors.nameKey) {
        const name = form.name?.trim();
        const nameKey = form.nameKey?.trim();
        if (!name && !nameKey) {
            errors.name = "required unless a name key is set";
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

/**
 * Load a "picker or custom text" pair into the form.
 *
 * When the stored value is not one of the picker's options (hand-edited JSON, or
 * a config saved before the picker existed) the select is switched to
 * `__custom__` and the value is moved into the companion text field, so saving
 * cannot silently drop it.
 */
function putCustomOrSelect(
    form: Record<string, string>,
    value: string | undefined,
    selectKey: string,
    customKey: string,
    options: Opt[],
): void {
    const v = (value ?? "").trim();
    if (!v) return;
    if (options.some((o) => o.value === v)) form[selectKey] = v;
    else {
        form[selectKey] = "__custom__";
        form[customKey] = v;
    }
}

/** Default form values for a fresh entry. */
/**
 * Default form values for a fresh entry.
 *
 * The two rules here are the only ones that are not just `f.def`: a checkbox with
 * no stated default is "off", and everything else is "empty". Anything richer —
 * the solid 4×4 a structure starts as — is a `def` on its own field, so a
 * "what does a new structure look like" question is answered next to the field
 * rather than in a switch keyed on its kind.
 */
export function formDefaults(cat: Tab): Record<string, string> {
    const form: Record<string, string> = {};
    for (const f of fieldsFor(cat)) {
        if (f.kind === "bool") form[f.key] = f.def ?? "false";
        else form[f.key] = f.def ?? "";
    }
    return form;
}

/**
 * The form a "+ New" opens with: field defaults, then the definition's own seed.
 *
 * A definition's seed is for a decision the author should not have to make to get
 * a first save — a structure must name an unlock node, so a new one starts on the
 * built-in default. Without it the required field opens empty and blocks the
 * first save on a rule nobody chose.
 */
export function newEntryForm(cat: Tab): Record<string, string> {
    const form = formDefaults(cat);
    definitionFor(cat)?.onNewEntry?.(form);
    return form;
}

/** Config keys each form owns; everything else round-trips via advancedJson. */
const FORM_COVERED: Partial<Record<Tab, string[]>> = {
    elements: [
        "name", "description", "descriptionKey", "matterType", "density",
        "horizontalSpeed", "duration",
        "durationRandom", "metaColor", "colors", "flammable", "isTransportable",
        "isGrabbable", "collectable", "hidden", "visibleInPicker",
    ],
    items: [
        "name", "description", "descriptionKey", "itemType", "cooldown", "energyCost",
        "excavationProfileId", "projectileId", "handlerKey", "sprite",
    ],
    recipes: [
        "kind", "input", "output", "chance", "outputs", "outputsAbove", "outputsBelow",
        "minimumDownwardVelocity",
    ],
    processing: ["mode", "structureType", "structureId", "intervalMs", "handlerKey"],
    contacts: ["inputA", "inputB", "outputA", "outputB", "orientation"],
    interactions: ["elementId", "interaction"],
    terrains: [
        "name", "nameKey", "hp", "metaColor", "output", "flammable", "materialId",
        "colorHSL", "excavationRequirements", "interactions",
        // `fog` was listed here, claiming the form owns a field it has no
        // control for. Phase 8 found the only `.fog` in the bundle is a
        // property of the *cell-type table*, not of a terrain definition.
        // Removing it means an existing stored `fog` round-trips through
        // advancedJson untouched instead of being silently claimed.
    ],
    unlockNodes: [
        "name", "description", "kind", "techId", "cost", "currencyType", "branch",
        "parentId", "requires",
    ],
    techs: [
        "name", "description", "descriptionKey",
        "cost", "currencyType", "branch", "parentId", "requires",
    ],
    upgrades: ["itemId", "itemNameKey", "categoryId", "upgrade"],
    // The engine reads `id`, `name`, `nameKey` and `requirement` on a category;
    // without `id` or a name the registration throws.
    categories: ["name", "nameKey", "requirement"],
    inputs: [
        "displayName", "displayNameKey", "category", "defaultKeys",
        "onDownKey", "onUpKey", "subsection",
    ],
    signals: ["kind", "target", "handlerKey"],
    triggers: ["triggerId", "interval", "sequentialRuns", "extra", "handlerKey"],
    // The structure ids are inside `definition`; the four controls are merged
    // into it on the way out, so it is covered even though the form key is not
    // one of them.
    behaviors: ["kind", "behaviorType", "definition"],
    energy: ["structureId", "type", "options"],
    networks: ["name"],
    excavation: ["power", "pattern", "options"],
    projectiles: ["sprite", "getOptionsKey", "options"],
    sprites: ["path", "source", "fromMod", "options"],
    modifiers: ["hookId", "kind", "handlerKey", "enabled", "notes"],
};

/**
 * The stored keys this form does *not* own, for one entry.
 *
 * Exported so the UI can name them. `advancedJson` is a round-trip escape hatch,
 * not a place to author data: anything the form does not own is carried through
 * an edit verbatim so that opening an entry can never silently delete a field
 * the engine understands but this panel does not have a control for.
 *
 * The user-facing consequence is that a form is not a complete picture of an
 * entry. Showing the count and the names makes that visible instead of leaving
 * it to be discovered after a field goes missing.
 */
export function passthroughKeys(
    cat: Tab,
    entry: Record<string, unknown>,
): string[] {
    return Object.keys(passthroughOf(cat, entry)).sort();
}

/** Extra fields not covered by the form, so Edit never silently drops them. */
function passthroughOf(cat: Tab, entry: Record<string, unknown>): Record<string, unknown> {
    // The definition owns this list once a tab has been split out, for the same
    // reason it owns the fields: a form that claims a key and a passthrough that
    // carries it have to be the same decision, made in the same file.
    const covered = new Set<string>(
        definitionFor(cat)?.formCovered ?? FORM_COVERED[cat] ?? [],
    );
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
            put("descriptionKey", str(e.descriptionKey));
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
            // Owned by ./definition/structure.ts — see the note in formToEntry.
            structureDefinition.entryToForm?.(e, readerFor(form));
            break;
        }
        case "items": {
            put("name", str(e.name));
            put("description", str(e.description));
            put("descriptionKey", str(e.descriptionKey));
            put("itemType", str(e.itemType) ?? num(e.itemType));
            if (typeof e.cooldown === "number") put("cooldownMs", num(e.cooldown));
            put("energyCost", num(e.energyCost));
            put("excavationProfileId", str(e.excavationProfileId));
            put("projectileId", str(e.projectileId));
            put("handlerKey", str(e.handlerKey));
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
            put("structureType", str(e.structureType) ?? num(e.structureType));
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
            // Split into the kind + per-kind fields, and keep the original object
            // so a descriptor the form does not fully model is still recoverable.
            const ix = splitInteraction(
                e.interaction as Record<string, unknown> | undefined,
            );
            for (const [k, v] of Object.entries(ix.fields)) put(k, v);
            put("interactionJson", json(e.interaction));
            break;
        }
        case "terrains": {
            put("name", str(e.name));
            put("nameKey", str(e.nameKey));
            const hsl = e.colorHSL as [number, number, number] | undefined;
            if (Array.isArray(hsl) && hsl.length === 3) {
                put("colorHSLOn", "true");
                put("colorHSLHue", num(hsl[0]));
                put("colorHSLSaturation", num(hsl[1]));
                put("colorHSLLightness", num(hsl[2]));
            }
            if (Array.isArray(e.excavationRequirements)) {
                put(
                    "excavationRequirements",
                    (e.excavationRequirements as unknown[]).join(","),
                );
            }
            put("interactionsJson", json(e.interactions));
            put("hp", num(e.hp));
            put("metaColor", packedToHex(e.metaColor as number | undefined));
            const out = e.output as { elementType?: string | number; chance?: number } | undefined;
            put("outputElement", str(out?.elementType) ?? num(out?.elementType));
            put("outputChance", num(out?.chance));
            if (typeof e.flammable === "boolean") put("flammable", String(e.flammable));
            put("materialId", num(e.materialId));
            break;
        }
        case "unlockNodes": {
            put("name", str(e.name));
            put("description", str(e.description));
            put("kind", str(e.kind));
            // `useExistingTech` is a form-only toggle: a node either names the
            // engine tech it borrows or does not, so the presence of `techId` is
            // the whole decision. Round-tripping it explicitly would let the
            // toggle and the id disagree.
            const techId = str(e.techId);
            if (techId) {
                put("useExistingTech", "true");
                put("techId", techId);
            } else {
                put("useExistingTech", "false");
            }
            // The rest only belong to a node that *builds* a tech. A borrowed one
            // keeps the engine's definition, so reading them would show fields
            // the save path is about to ignore.
            if (str(e.kind) === "tech" && !techId) {
                put("cost", num(e.cost));
                putCustomOrSelect(
                    form,
                    str(e.currencyType),
                    "currencyType",
                    "currencyTypeCustom",
                    listCurrencyTypes(),
                );
                putCustomOrSelect(form, str(e.branch), "branch", "branchCustom", listTechBranches());
                put("parentId", str(e.parentId));
                put("requires", formatIdList(e.requires as string[] | undefined) || undefined);
            }
            break;
        }
        case "techs": {
            put("name", str(e.name));
            put("description", str(e.description));
            put("descriptionKey", str(e.descriptionKey));
            put("cost", num(e.cost));
            // A stored value that is not in the option list (hand-edited JSON, a
            // config from before this picker existed) falls back to "__custom__"
            // so the value is preserved rather than silently dropped on save.
            // A stored value outside the picker's options (hand-edited JSON, or a
            // config saved before these pickers existed) is moved into the
            // companion custom box so saving cannot silently drop it.
            putCustomOrSelect(form, str(e.currencyType), "currencyType", "currencyTypeCustom", listCurrencyTypes());
            putCustomOrSelect(form, str(e.branch), "branch", "branchCustom", listTechBranches());
            put("parentId", str(e.parentId));
            put("requires", formatIdList(e.requires as string[] | undefined) || undefined);
            const unlocks = e.unlocks as { structures?: string[]; items?: string[] } | undefined;
            put("unlockStructures", formatIdList(unlocks?.structures) || undefined);
            put("unlockItems", formatIdList(unlocks?.items) || undefined);
            break;
        }
        case "categories": {
            put("name", str(e.name));
            put("nameKey", str(e.nameKey));
            // A plain string requirement (the only shape the picker writes) goes
            // in the select; anything else — an object from a hand-edited config,
            // or from before this picker existed — falls back to the raw box so a
            // save cannot silently drop it. Nothing reads this field, but losing
            // it anyway would be its own kind of wrong.
            const req = e.requirement;
            if (typeof req === "string") {
                putCustomOrSelect(form, req, "requirementTechId", "requirementJson", []);
            } else if (req !== undefined) {
                put("requirementTechId", "__custom__");
                put("requirementJson", json(req));
            }
            break;
        }
        case "inputs": {
            put("displayName", str(e.displayName));
            put("displayNameKey", str(e.displayNameKey));
            put("category", str(e.category));
            if (Array.isArray(e.defaultKeys)) {
                put("defaultKeys", (e.defaultKeys as unknown[]).join(","));
            }
            put("onDownKey", str(e.onDownKey));
            put("onUpKey", str(e.onUpKey));
            put("subsectionJson", json(e.subsection));
            break;
        }
        case "upgrades": {
            put("itemId", str(e.itemId) ?? num(e.itemId));
            put("itemNameKey", str(e.itemNameKey));
            put("categoryId", str(e.categoryId));
            // UpgradeDefinition.upgrade is a nested object.
            const u = e.upgrade as
                | { id?: string; maxLevel?: number; costs?: number[]; oneOff?: boolean; nameKey?: string }
                | undefined;
            put("upgradeId", str(u?.id));
            put("upgradeNameKey", str(u?.nameKey));
            put("maxLevel", num(u?.maxLevel));
            put("costsJson", json(u?.costs));
            if (typeof u?.oneOff === "boolean") put("oneOff", String(u.oneOff));
            put("onUpgradeKey", str(e.onUpgradeKey));
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
            // The named structure ids are their own controls, but they live
            // inside `definition` — so they are lifted out for the picker and
            // merged back on save. What is left over is the raw box.
            const def = (e.definition ?? {}) as Record<string, unknown>;
            put("structureId", str(def.id));
            put("upType", str(def.upType));
            put("leftType", str(def.leftType));
            put("rightType", str(def.rightType));
            const { id: _id, upType: _up, leftType: _l, rightType: _r, ...rest } = def;
            put("definitionJson", json(Object.keys(rest).length > 0 ? rest : undefined));
            break;
        }
        case "energy": {
            put("structureId", str(e.structureId));
            put("type", str(e.type));
            // Documented registerType options: capacity (storage) + energyType.
            const o = e.options as
                | { capacity?: number; energyType?: string; priority?: number }
                | undefined;
            put("capacity", num(o?.capacity));
            put("energyType", str(o?.energyType));
            put("priority", num(o?.priority));
            break;
        }
        case "networks": {
            put("name", str(e.name));
            break;
        }
        case "excavation": {
            put("power", num(e.power));
            put("patternJson", json(e.pattern));
            put("terrainRulesJson", json(e.terrainRules));
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
            setStr("descriptionKey", opt(form, "descriptionKey"));
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
            // Owned by ./definition/structure.ts. Delegated rather than inlined so
            // the structure's schema, its save path and its widgets are one file
            // that has to be read together to be changed correctly.
            structureDefinition.formToEntry?.(form, writerFor(form, entry));
            break;
        }
        case "items": {
            setStr("name", opt(form, "name"));
            setStr("description", opt(form, "description"));
            setStr("descriptionKey", opt(form, "descriptionKey"));
            setStr("itemType", opt(form, "itemType"));
            const cd = optNum(form, "cooldownMs");
            if (cd !== undefined) entry.cooldown = cd;
            setNum("energyCost", optNum(form, "energyCost"));
            setStr("excavationProfileId", opt(form, "excavationProfileId"));
            setStr("projectileId", opt(form, "projectileId"));
            // A Consumable has no ActionType to dispatch a use through, so never
            // persist a handler for one even if the form somehow carried it.
            if (opt(form, "itemType") !== "Consumable") {
                setStr("handlerKey", opt(form, "handlerKey"));
            }
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
            setStr("structureType", opt(form, "structureType"));
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
            // Re-compose from the split fields, unless the stored object held
            // something the form does not model — then keep it verbatim rather
            // than silently rewriting it into a kind it was not.
            const existing = parseObjectOrUndefined(form.interactionJson);
            const composed = composeInteraction(form);
            if (composed) {
                entry.interaction = splitInteraction(existing).unmodelled ? existing : composed;
            } else if (existing) {
                entry.interaction = existing;
            }
            break;
        }
        case "terrains": {
            setStr("name", opt(form, "name"));
            setStr("nameKey", opt(form, "nameKey"));
            // the three HSL controls are only written when the toggle is on, so
            // an empty form cannot emit a 0,0,0 terrain colour
            if (optBool(form, "colorHSLOn")) {
                const h = optNum(form, "colorHSLHue");
                const s = optNum(form, "colorHSLSaturation");
                const l = optNum(form, "colorHSLLightness");
                if (h !== undefined && s !== undefined && l !== undefined) {
                    entry.colorHSL = [h, s, l];
                }
            }
            const tools = parseIdList(form.excavationRequirements ?? "");
            if (tools.length > 0) entry.excavationRequirements = tools;
            const interactions = optJson<unknown[]>(form, "interactionsJson");
            if (interactions) entry.interactions = interactions;
            setNum("hp", optNum(form, "hp"));
            const hex = opt(form, "metaColor");
            if (hex && HEX.test(hex)) entry.metaColor = hexToPacked(hex);
            const outEl = opt(form, "outputElement");
            if (outEl) {
                entry.output = { elementType: outEl, chance: optNum(form, "outputChance") ?? 1 };
            }
            setBool("flammable", optBool(form, "flammable"));
            setNum("materialId", optNum(form, "materialId"));
            break;
        }
        case "unlockNodes": {
            setStr("name", opt(form, "name"));
            setStr("description", opt(form, "description"));
            setStr("kind", opt(form, "kind"));
            // The two modes write disjoint sets of fields, and a field read by
            // one but not written back is silent data loss. An "always" node
            // writes no research fields at all, so a stale cost from a previous
            // edit cannot survive as a second, competing source for how the
            // structure becomes available.
            const borrowing = opt(form, "kind") === "tech" &&
                optBool(form, "useExistingTech") === true;
            if (borrowing) {
                setStr("techId", opt(form, "techId"));
            } else if (opt(form, "kind") === "tech") {
                setNum("cost", optNum(form, "cost"));
                setStr(
                    "currencyType",
                    opt(form, "currencyType") === "__custom__"
                        ? opt(form, "currencyTypeCustom")
                        : opt(form, "currencyType"),
                );
                setStr(
                    "branch",
                    opt(form, "branch") === "__custom__"
                        ? opt(form, "branchCustom")
                        : opt(form, "branch"),
                );
                setStr("parentId", opt(form, "parentId"));
                const nodeRequires = parseIdList(opt(form, "requires"));
                if (nodeRequires.length > 0) entry.requires = nodeRequires;
            }
            // `gatesStructures` is derived from each structure's own
            // `unlockNode`, so it is never written from here.
            break;
        }
        case "techs": {
            setStr("name", opt(form, "name"));
            setStr("description", opt(form, "description"));
            setStr("descriptionKey", opt(form, "descriptionKey"));
            setNum("cost", optNum(form, "cost"));
            // "__custom__" on the picker means "use the companion text box".
            setStr("currencyType", opt(form, "currencyType") === "__custom__" ? opt(form, "currencyTypeCustom") : opt(form, "currencyType"));
            setStr("branch", opt(form, "branch") === "__custom__" ? opt(form, "branchCustom") : opt(form, "branch"));
            setStr("parentId", opt(form, "parentId"));
            const requires = parseIdList(opt(form, "requires"));
            if (requires.length > 0) entry.requires = requires;
            // TechDefinition.unlocks = { structures?, items? } — declarative, no
            // handler, and the only way a structure becomes unlocked.
            const unlockStructures = parseIdList(opt(form, "unlockStructures"));
            const unlockItems = parseIdList(opt(form, "unlockItems"));
            if (unlockStructures.length > 0 || unlockItems.length > 0) {
                const unlocks: Record<string, string[]> = {};
                if (unlockStructures.length > 0) unlocks.structures = unlockStructures;
                if (unlockItems.length > 0) unlocks.items = unlockItems;
                entry.unlocks = unlocks;
            }
            break;
        }
        case "categories": {
            // Mirrors the engine guard: `if (!t.id || !t.name && !t.nameKey) throw`
            setStr("name", opt(form, "name"));
            setStr("nameKey", opt(form, "nameKey"));
            const rawReq = optJson<Record<string, unknown>>(form, "requirementJson");
            const techReq = opt(form, "requirementTechId");
            if (techReq === "__custom__") {
                if (rawReq) entry.requirement = rawReq;
            } else if (techReq) {
                entry.requirement = techReq;
            } else if (rawReq) {
                entry.requirement = rawReq;
            }
            break;
        }
        case "inputs": {
            setStr("displayName", opt(form, "displayName"));
            setStr("displayNameKey", opt(form, "displayNameKey"));
            setStr("category", opt(form, "category"));
            const keys = parseIdList(form.defaultKeys ?? "");
            if (keys.length > 0) entry.defaultKeys = keys;
            setStr("onDownKey", opt(form, "onDownKey"));
            setStr("onUpKey", opt(form, "onUpKey"));
            const subsection = optJson<Record<string, unknown>>(form, "subsectionJson");
            if (subsection) entry.subsection = subsection;
            break;
        }
        case "upgrades": {
            setStr("itemId", opt(form, "itemId"));
            setStr("itemNameKey", opt(form, "itemNameKey"));
            // `__custom__` is a UI affordance, not an id. Writing it out would
            // register the upgrade under a category literally named `__custom__`,
            // which fails at runtime in a way nothing in the panel could explain.
            // The engine applies its own default when the field is absent.
            const categoryId = opt(form, "categoryId");
            if (categoryId && categoryId !== "__custom__") entry.categoryId = categoryId;
            // Build the NESTED `upgrade` object UpgradeDefinition expects.
            const upgrade: Record<string, unknown> = {};
            const upId = opt(form, "upgradeId");
            if (upId) upgrade.id = upId;
            const nameKey = opt(form, "upgradeNameKey");
            if (nameKey) upgrade.nameKey = nameKey;
            const maxLevel = optNum(form, "maxLevel");
            if (maxLevel !== undefined) upgrade.maxLevel = maxLevel;
            const costs = optJson<number[]>(form, "costsJson");
            if (costs) upgrade.costs = costs;
            const oneOff = optBool(form, "oneOff");
            if (oneOff !== undefined) upgrade.oneOff = oneOff;
            if (Object.keys(upgrade).length > 0) entry.upgrade = upgrade;
            setStr("onUpgradeKey", opt(form, "onUpgradeKey"));
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
            // The named structure ids are merged into `definition` first, so the
            // raw box wins over them: an unmodellable key stays expressible.
            const def: Record<string, unknown> = {
                ...(optJson<Record<string, unknown>>(form, "definitionJson") ?? {}),
            };
            const launcher = opt(form, "kind") === "launcher";
            const up = opt(form, "upType");
            const left = opt(form, "leftType");
            const right = opt(form, "rightType");
            const id = opt(form, "structureId");
            if (launcher) {
                if (up) def.upType = up;
                if (left) def.leftType = left;
                if (right) def.rightType = right;
            } else if (id) {
                def.id = id;
            }
            if (Object.keys(def).length > 0) entry.definition = def;
            break;
        }
        case "energy": {
            setStr("structureId", opt(form, "structureId"));
            setStr("type", opt(form, "type"));
            const options: Record<string, unknown> = {};
            const cap = optNum(form, "capacity");
            if (cap !== undefined) options.capacity = cap;
            const net = opt(form, "energyType");
            if (net) options.energyType = net;
            const prio = optNum(form, "priority");
            if (prio !== undefined) options.priority = prio;
            if (Object.keys(options).length > 0) entry.options = options;
            break;
        }
        case "networks": {
            // Panel-only: the engine reads neither field, it only ever sees the
            // id two energy types have to spell the same way to share a channel.
            setStr("name", opt(form, "name"));
            break;
        }
        case "excavation": {
            setNum("power", optNum(form, "power"));
            const pattern = optJson<number[][]>(form, "patternJson");
            if (pattern) entry.pattern = pattern;
            const rules = optJson<Record<string, unknown>[]>(form, "terrainRulesJson");
            if (rules && rules.length > 0) entry.terrainRules = rules;
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




