/**
 * md-my-hown-mod — static configuration + FULL register field reference.
 *
 * Field lists are grounded in sandustry.dev API docs (v0.5.7) and the
 * mickeydisn structures-register tech note. Anything not listed can still be
 * passed via index signatures and is forwarded to the engine.
 */
import type { SettingsSchema } from "./packages/modkit.ts";

// The stored shape of a custom process lives with the feature that compiles it, so
// `constants.ts` and the compiler cannot drift apart.
import type { CustomProcessConfig } from "./handler/custom-process/types.ts";
export const MOD_ID = "md-my-hown-mod";
export const VERSION = "0.1.4";
export const LOG = `[${MOD_ID}]`;

/**
 * Prefixes that count as *this* mod's own object ids.
 *
 * `MOD_ID` is the package name, but the config's own ids use the shorter `mdmy.`
 * prefix. Both are listed, because the alternative is a list screen that files
 * the author's own objects under "another mod" — the one misclassification a mod
 * author would notice immediately.
 *
 * Kept as an explicit list rather than derived from `MOD_ID`, so a future rename
 * is a visible edit here instead of a silent change in how every id in the panel
 * is attributed. The list screen's "This mod" filter reads this.
 */
export const OWN_ID_PREFIXES: readonly string[] = [MOD_ID, "mdmy"];

export const STORAGE_KEYS: readonly string[] = [
    "config",
    "panel",
] as const;

export const SETTINGS = {
    enabled: { type: "boolean", default: true },
    /**
     * Whether the panel opens minimized. Read by `createPanelComponent`, which
     * passes it to `loadPanelState` as the fallback for a first-ever boot.
     *
     * This only decides what a *fresh* install starts as. Once the reader has
     * clicked the chip open or shut it, their own choice is stored and wins —
     * a setting you cannot change after the first launch is a setting that
     * looks broken.
     */
    panelMinimized: { type: "boolean", default: true },
} as const satisfies SettingsSchema;

export const OVERLAY_ID = `${MOD_ID}:panel`;

/** Shown in the panel's error chip, and in the mount-failure toast. */
export const TOOL_NAME = "My Own Mod";

// ═══════════════════════════════════════════════════════════════════════════
// MatterType (sandkit.enums.MatterType)
// Solid=1 Liquid=2 Particle=3 Gas=4 Static=5 Slushy=6 Wisp=7 Powder=8
// ═══════════════════════════════════════════════════════════════════════════

export type MatterTypeName =
    | "Solid"
    | "solid"
    | "Liquid"
    | "liquid"
    | "Particle"
    | "particle"
    | "Gas"
    | "gas"
    | "Static"
    | "static"
    | "Slushy"
    | "slushy"
    | "Wisp"
    | "wisp"
    | "Powder"
    | "powder";

// ═══════════════════════════════════════════════════════════════════════════
// ELEMENT — sandkit.api.elements.register(ElementDefinition)
// Docs: https://sandustry.dev/api/elements#register
// ═══════════════════════════════════════════════════════════════════════════

export interface ElementColorVariantFromData {
    rangeMin?: number;
    rangeMax?: number;
    invert?: boolean;
    useGradient?: boolean;
}

export interface ElementColors {
    /** Array of [r,g,b,a] tuples (0–255) */
    variants?: number[][];
    variantFromDataField1?: ElementColorVariantFromData;
}

export interface ElementDurationRandom {
    min: number;
    max: number;
}

/**
 * Full element definition accepted by elements.register.
 * Functions (getExtraProps) cannot live in JSON — use defaultDataFields instead
 * for serialisable configs; advanced users can still pass functions at runtime.
 */
export interface ElementConfig {
    /** Unique string id (required). Engine assigns numeric ElementType. */
    id: string;
    /** Display name (string or translatable). Auto-registers i18n when string. */
    name?: string;
    nameKey?: string;
    description?: string;
    descriptionKey?: string;
    /**
     * Phase/behaviour class.
     * MatterType: Solid | Liquid | Particle | Gas | Static | Slushy | Wisp | Powder
     */
    matterType?: MatterTypeName | number;
    /** Simulation density (sink/float ordering). */
    density?: number;
    /** Packed 24-bit RGB integer (e.g. 0xff8ad4) for minimap / representative colour. */
    metaColor?: number;
    /** Numeric material id linking to a material shader/profile. */
    materialId?: number;
    /** Render colour scheme. */
    colors?: ElementColors | number[][];
    /** Base lifetime for transient elements (seconds). */
    duration?: number;
    durationRandom?: ElementDurationRandom;
    /** Can catch fire (boolean or richer object in some stock defs). */
    flammable?: boolean | Record<string, unknown>;
    isGrabbable?: boolean;
    isTransportable?: boolean;
    /** Hide from pickers / UI. */
    hidden?: boolean;
    /**
     * Interaction descriptors (tool reactions, growers, shakers, etc.).
     * Prefer elements.addInteractionInfo at runtime for complex cases.
     */
    interactions?: unknown[];
    /** Initial per-cell data field values, e.g. { field1: 20 }. */
    defaultDataFields?: Record<string, number | string | boolean>;
    /**
     * Callback returning extra per-cell props — NOT JSON-serialisable.
     * Omit from stored config; use only if injecting at runtime.
     */
    getExtraProps?: () => Record<string, unknown>;
    /** Passthrough for any future / undocumented engine fields. */
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// STRUCTURE — sandkit.api.structures.register(StructureDefinition)
// Docs: https://sandustry.dev/api/structures#register
// Tech: doc/docs_tech/09-structures-register.md
// ═══════════════════════════════════════════════════════════════════════════

export interface StructureBuildMode {
    /**
     * single | singleDirectional | line | launcherRectUp | launcherRectSide |
     * rectangle | rectangleDirectional
     */
    type: string;
    /** For line-like modes: horizontal | vertical | diagonal */
    directions?: string[];
    [key: string]: unknown;
}

export interface StructureVariant {
    /** Structure type id for this facing */
    id: string;
    /** Degrees this variant matches (-180…180; diagonals allowed) */
    angles: number[];
}

export interface StructureRenderUi {
    size?: { width: number; height: number };
    width?: string;
    height?: string;
    offset?: { x: number; y: number };
    objectPosition?: string;
    clipToBounds?: boolean;
    imageName?: string;
}

export interface StructureRender {
    /** Sprite id from api.sprites.load / loadFromMod */
    imageName?: string;
    size?: { width: number; height: number };
    offset?: { x: number; y: number };
    ui?: StructureRenderUi;
    /** Animated spritesheet; frameBuffer.key must exist via workers.shared */
    spritesheet?: {
        frameBuffer?: { key: string; index?: number };
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

export interface StructureConfig {
    /** Unique structure type id (required). */
    id: string;
    name?: string;
    nameKey?: string;
    description?: string;
    descriptionKey?: string;
    /**
     * Build-menu category.
     * Known: blocks | logistics | production | economy | logic | fluids |
     * lighting | special | misc | thermal
     */
    categoryKey?: string;
    /** Sort order within category. */
    order?: number;
    /**
     * Hide this structure from the build menu. Ours, not the engine's: there is no
     * engine or registry field for structure visibility, so the mod records the
     * author's intent and its own list filters on it. Nothing is written to the
     * engine that would act on it.
     */
    hideFromBuildMenu?: boolean;
    /**
     * Inert on a mod structure — the engine only reads it for vanilla ids.
     *
     * Kept in the type because it may already be in someone's config, and the
     * passthrough carries it through an edit. `apply.ts` unlocks every structure
     * regardless, so setting this changes nothing.
     *
     * @see https://github.com/.../bundel.js 5251.js — the single read site
     */
    alwaysUnlocked?: boolean;
    /**
     * Ours, not the engine's: the unlock node that gates this structure.
     *
     * Required — a structure always names a node, and the built-in "Unlock by
     * default" is what "no research needed" means rather than an empty field. The
     * engine reads the same relation off the *tech* side (`unlocks.structures`),
     * so `apply.ts` resolves the node into a real tech at registration. See
     * `src/ui/tech-link.ts`.
     */
    unlockNode?: string;
    disallowPick?: boolean;
    /** Alias structure type for the block grid. */
    blockGridType?: string;
    /**
     * 2D footprint: array of rows; 1 = occupied (→ Block unless useRawShape).
     * Default 4×4 if omitted with no render.
     */
    shape?: number[][];
    /** Placement gesture modes. Default line horizontal if empty. */
    buildModes?: StructureBuildMode[];
    variants?: StructureVariant[];
    render?: StructureRender;
    /**
     * Custom canvas draw.
     *
     * A **function**, and never JSON: the engine does `T(id, def.draw)` and the
     * render loop calls
     * `fn(session, instance, {tilemap, ctx, useTilemap, placing, opts})`.
     * Returning `false` falls through to the normal sprite render; anything
     * else means the frame was handled. The config stores `drawKey` instead and
     * `apply.ts` supplies the function.
     *
     * The parameters are untyped on purpose. Naming them makes the field parser
     * in `tools/verify.ts` read them as config keys, which they are not.
     */
    draw?: (...args: never[]) => boolean | void;
    /**
     * Which built-in `draw` to use. The stored form is a key, because `draw`
     * itself is a function and JSON cannot hold one; `apply.ts` swaps it for
     * the real function at registration time. `"default"` means no custom draw.
     */
    drawKey?: string;
    /** Default per-instance data (deep-cloned on register). */
    defaultData?: Record<string, unknown>;
    /** false → copier skips instance data (skipCopyData). Default true. */
    copyData?: boolean;
    /** Reject placement when shape overlaps existing cells. */
    rejectWhenBlocked?: boolean;
    altOriginOffsetY?: number;
    /** e.g. { type: "filter" } for hover inspector. */
    tooltipHover?: Record<string, unknown>;
    /**
     * Register options (second arg to structures.register).
     * useRawShape: keep shape cells as-is (no 1→Block normalisation).
     */
    registerOptions?: { useRawShape?: boolean };
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// ITEM — sandkit.api.items.register(ItemDefinition)
// Docs: https://sandustry.dev/api/items#register
// ═══════════════════════════════════════════════════════════════════════════

export interface ItemSprite {
    /** Graphics key — must be loaded via sprites.load (required by engine). */
    id: string;
    /** backhand | twohand | onehand */
    type?: string;
    /** Named mount preset for pivot/offset. */
    mount?: string;
    [key: string]: unknown;
}

export interface ItemConfig {
    id: string;
    /** ItemType: Weapon | Tool | Consumable | Mod (defaults Mod). */
    itemType?: "Weapon" | "Tool" | "Consumable" | "Mod" | string | number;
    /** Alias some code paths use instead of itemType. */
    type?: string | number;
    name?: string;
    nameKey?: string;
    description?: string;
    descriptionKey?: string;
    categoryKey?: string;
    /** Required by engine — omitting sprite throws. */
    sprite?: ItemSprite;
    /** Per-use cooldown tracking when set. */
    cooldown?: number | { last?: number; [key: string]: unknown };
    /**
     * Name of a handler in `src/handler/actions/`, attached as
     * `ItemDefinition.handleAction` at register time. Ignored for Consumable —
     * `ActionType` has no Consumable member, so no use action can be dispatched.
     */
    handlerKey?: string;
    /**
     * Keep this item out of the menus.
     *
     * Reuses the structure's flag name on purpose — see `HIDDEN_FIELD`. There is
     * no engine or registry field for item visibility, so this is a mod-layer
     * contract: the mod records the author's intent and its own list filters on
     * it. Nothing is written to the engine that would act on it.
     */
    hideFromBuildMenu?: boolean;
    [key: string]: unknown;
}

/** The category keys that have a hidden flag, in the `Tab` vocabulary. */
export type HiddenCategory = "elements" | "structures" | "items";

/**
 * Which config field decides visibility, per category, and in which direction.
 *
 * The two are not the same shape of question, which is why this is a table of
 * predicates rather than a table of names:
 *
 *  - **elements** — `visibleInPicker`, read **inverted**. It is the engine's own
 *    field (12 references in the bundle, and a documented modifier arg in
 *    `hooks.d.ts:609`), it defaults to `true` in the config, and the engine's
 *    own default element sets it `false` — so an element is hidden exactly when
 *    it says `visibleInPicker: false`. A plain `field === true` would call every
 *    ordinary element hidden, which is the opposite of the intent.
 *    An element's own `hidden` field is *not* this: it is not an engine field
 *    and nothing acts on it.
 *  - **structures** and **items** — `hideFromBuildMenu`, read **direct**. A field
 *    on the mod registry record (`sandkit.mods.structures[id]`), not on the
 *    engine's `getDefinitionByType` result. Items reuse the structure's name
 *    because there is no field for item visibility anywhere; the mod defines
 *    that contract and its own list filters on it.
 *
 * Terrains are absent deliberately. Their `isBuilding` is a *different* idea — a
 * cell that counts as a built wall — so treating it as hidden would hide every
 * plain terrain and show every wall.
 */
export const HIDDEN_FIELD: Partial<Record<HiddenCategory, string>> = {
    elements: "visibleInPicker",
    structures: "hideFromBuildMenu",
    items: "hideFromBuildMenu",
};

/** True when the field is set to hide, rather than to show. */
const HIDDEN_INVERTED: Partial<Record<HiddenCategory, boolean>> = {
    elements: true,
};

/** What an entry says about its visibility: hidden, visible, or silent. Only `HIDDEN_FIELD`, inverted per category. */
export function entryVisibility(
    e: Record<string, unknown>,
    cat: string,
): boolean | undefined {
    const field = HIDDEN_FIELD[cat as HiddenCategory];
    // Only an explicit boolean counts. A missing flag, or a junk value, is not a
    // statement about visibility — it is the absence of one, and the caller then
    // falls through to the row's previous state.
    //
    // This direction is not a guess. The engine builds the picker's mask from the
    // element's *matter type*, not from any stored field:
    //
    //     b = g !== es.Liquid && g !== es.Gas;   // -> y.visibleInPicker = b
    //
    // so anything that is not a liquid or a gas is offered by default, and the
    // only thing that can turn that off is a `vacuum:element:prepare` modifier.
    // Treating "no flag" as hidden inverted that default and made every solid
    // element vanish from the list, which is the opposite of the engine.
    if (field && typeof e[field] === "boolean") {
        return HIDDEN_INVERTED[cat as HiddenCategory] ? e[field] === false : e[field] === true;
    }
    return undefined;
}

/** Whether an entry of `cat` is hidden. The two-way form of `entryVisibility`. */
export function configIsHidden(e: Record<string, unknown>, cat: string): boolean {
    // Only an explicit boolean decides. An absent field is not a statement about
    // visibility, and for an element the config default of `true` is what "not
    // mentioned" means — treating absence as hidden would empty the whole list.
    return entryVisibility(e, cat) === true;
}

// ═══════════════════════════════════════════════════════════════════════════
// RECIPE — structures.recipes.register + processing.register*
// Docs: https://sandustry.dev/api/structures#recipes-register
//       https://sandustry.dev/api/processing
// ═══════════════════════════════════════════════════════════════════════════

export type RecipeKind =
    | "grower"
    | "planterBox"
    | "shaker"
    | "kineticPress"
    | "condenser"
    | "steamDryer"
    | "synthesizer"
    | "snowmaker"
    | "smelter"
    | "structure"; // generic → structures.recipes.register(structureType, …)

export interface RecipeOutputEntry {
    elementType: string | number;
    chance?: number;
}

/**
 * Recipe body shared by processing.* and structures.recipes.register.
 * Element refs may be string ids (resolved via elements.getTypeById) or numbers.
 */
export interface RecipeConfig {
    id: string;
    /**
     * grower/planterBox → processing.registerGrower
     * shaker → processing.registerShaker
     * kineticPress → processing.registerKineticPress
     * condenser|steamDryer|synthesizer|snowmaker|smelter → structures.recipes.register(kind, …)
     * structure → structures.recipes.register(structureType, …)
     */
    kind: RecipeKind | string;
    /** Required when kind is "structure" or a custom structure type id. */
    structureType?: string | number;
    /** Element consumed. */
    input?: string | number;
    /** Single output (Grower-style). */
    output?: string | number;
    /** Probability 0–1 for single output (default 1). */
    chance?: number;
    /** Multi-output list. */
    outputs?: RecipeOutputEntry[];
    outputsAbove?: RecipeOutputEntry[];
    outputsBelow?: RecipeOutputEntry[];
    /** Gate recipe on incoming particle speed (Kinetic Press). */
    minimumDownwardVelocity?: number;
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROCESSING — structures.processing.register / addProcessor
// Docs: https://sandustry.dev/api/structures#processing-register
// Note: `process` is a function → NOT JSON-serialisable.
// Stored config can hold intervalMs + structureType for documentation;
// real process callbacks must be injected by code extensions.
// ═══════════════════════════════════════════════════════════════════════════

export interface ProcessingConfig {
    id: string;
    /**
     * Structure *type* this processor runs for. The engine definition is
     * `{ structureType, intervalMs, process }` — there is no per-instance mode.
     */
    structureType?: string | number;
    /** Interval between process ticks (ms). Must be finite > 0. */
    intervalMs?: number;
    /**
     * process(structure, context) — NOT JSON-serialisable.
     * Leave undefined in stored config; attach via code if needed.
     */
    process?: (ctx: unknown, api: unknown) => void;
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTACT REACTION — reactions.registerContact
// Docs: https://sandustry.dev/api/reactions
// ═══════════════════════════════════════════════════════════════════════════

export interface ContactReactionConfig {
    id: string;
    /** First element in the contact pair (id or type). */
    inputA: string | number;
    /** Second element. */
    inputB: string | number;
    /** What inputA becomes, or null to remove. */
    outputA: string | number | null;
    /** What inputB becomes, or null to remove. */
    outputB: string | number | null;
    /** Optional orientation constraint. */
    orientation?: string;
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERACTION (elements.addInteractionInfo) — optional companion category
// ═══════════════════════════════════════════════════════════════════════════

export interface InteractionConfig {
    id: string;
    /** Element id/type to attach the interaction to. */
    elementId: string | number;
    /** Interaction descriptor (kind + payload). Shape varies by kind. */
    interaction: Record<string, unknown>;
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// TERRAIN — terrains.register
// ═══════════════════════════════════════════════════════════════════════════

export interface TerrainConfig {
    id: string;
    name?: string;
    nameKey?: string;
    description?: string;
    descriptionKey?: string;
    displayNameOverrideKey?: string;
    hp?: number;
    materialId?: number;
    metaColor?: number;
    colorHSL?: number[];
    colorPattern?: { size?: number[]; colorsHSL?: number[][][] };
    colorGradient?: { stops?: Array<{ hp: number; color: unknown }> };
    output?: { elementType?: string | number | null; chance?: number };
    background?: Record<string, unknown>;
    backgroundElementType?: string | number;
    fog?: boolean;
    flammable?: boolean;
    excavationRequirements?: string[];
    interactions?: unknown[];
    noShadow?: boolean;
    isBuilding?: boolean;
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// TECH — tech.registerDefinition / registerNode
// ═══════════════════════════════════════════════════════════════════════════

export interface TechConfig {
    id: string;
    name?: string;
    nameKey?: string;
    nameParams?: Record<string, unknown>;
    description?: string;
    descriptionKey?: string;
    descriptionParams?: Record<string, unknown>;
    cost?: number;
    currencyType?: string;
    branch?: string;
    requires?: string | string[];
    unlocks?: { structures?: string[]; items?: string[]; map?: boolean };
    icon?: { spriteName?: string; [key: string]: unknown };
    locked?: boolean;
    threshold?: number;
    radiusUnlockPx?: number;
    isElectricity?: boolean;
    electricityNodeStyle?: boolean;
    isAlien?: boolean;
    unavailable?: boolean;
    /** When set, also call tech.registerNode with placement. */
    parentId?: string;
    preferredPosition?: { row?: number; col?: number; [key: string]: unknown };
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// UPGRADES — upgrades.registerCategory / register
// onUpgrade is a function → use handlerKey into CODE_HANDLERS-style map
// ═══════════════════════════════════════════════════════════════════════════

export interface UpgradeCategoryConfig {
    id: string;
    /**
     * Display name. The engine requires `name` or `nameKey` on a category and
     * throws without one, so at least one of these two must be supplied.
     */
    name?: string;
    /** Translation key for the category name. */
    nameKey?: string;
    categoryId: string;
    itemId?: string | number;
    itemName?: string;
    itemNameKey?: string;
    requirement?: Record<string, unknown>;
    upgrade?: Record<string, unknown>;
    /** handlerKey for onUpgrade callback (code-side). */
    onUpgradeKey?: string;
    [key: string]: unknown;
}

export interface UpgradeConfig {
    id: string;
    itemId: string | number;
    categoryId: string;
    itemName?: string;
    itemNameKey?: string;
    requirement?: Record<string, unknown>;
    upgrade: {
        id: string;
        nameKey?: string;
        descriptionKey?: string;
        maxLevel?: number;
        costs?: number[];
        oneOff?: boolean;
        [key: string]: unknown;
    };
    onUpgradeKey?: string;
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROJECTILES — projectiles.register
// getOptions is a function → optionsJson stored; handlerKey can supply factory
// ═══════════════════════════════════════════════════════════════════════════

export interface ProjectileConfig {
    id: string;
    sprite: { id: string; tint?: number; [key: string]: unknown };
    /** Static options object used if no getOptionsKey. */
    options?: Record<string, unknown>;
    /** handlerKey returning options object (preferred for dynamic blueprints). */
    getOptionsKey?: string;
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// ENERGY — energy.registerType(structureId, type, options)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A named energy channel.
 *
 * This exists only in *our* config. The engine has no "register a network" call:
 * `energyTypes[].options.energyType` is a plain string, and two energy types
 * share a channel by spelling it the same. So the set of valid networks is
 * whatever the config says, plus the engine's own default, and nothing in the
 * game will tell us a name is wrong.
 *
 * That is the whole reason this is a list rather than a text box: without it, a
 * typo in `options.energyType` registers cleanly and the node simply never
 * joins a network. It looks configured and does nothing.
 */
export interface EnergyNetworkConfig {
    id: string;
    name?: string;
    [key: string]: unknown;
}

/**
 * Ours, not the engine's: what a structure is gated behind.
 *
 * Every structure names one, so "how does this become available?" always has an
 * answer with a name attached — there is no empty field that quietly means
 * "always". A node is either **mod-owned** (`kind: "always"`, granted at apply)
 * or it **builds an in-game tech node** (`kind: "tech"`), in which case the
 * fields below become a real engine tech and researching it grants the
 * structures that point here.
 *
 * `techId` borrows an existing engine tech instead of defining one, so several
 * nodes can sit behind the same research step. When set, the fields below are
 * ignored — the engine tech keeps its own definition.
 */
export interface UnlockNodeConfig {
    id: string;
    name?: string;
    description?: string;
    /** "always" = no research; "tech" = a research step is required. */
    kind: "always" | "tech";
    /** Research cost of the tech this node builds. */
    cost?: number;
    currencyType?: string;
    branch?: string;
    /** Where the built node sits in the tech grid. */
    parentId?: string;
    requires?: string[];
    /** Use this engine tech as-is instead of building one. */
    techId?: string;
    [key: string]: unknown;
}

/** What a buffer slot holds. Mirrors `FieldKind` in the buffer package's introspection. */
export type BufferValueType = "number" | "bool" | "string";

/**
 * One addressable slot in the mod's shared buffer.
 *
 * Not an engine object. Nothing calls `register()` and the game never sees it —
 * what the game *does* see is the shared `Int32Array` and the UTF-8 JSON slot that
 * `JsonMapBuffer` allocates for this path, which is why the panel can declare one
 * and have handlers read and write it on any thread.
 *
 * `min`/`max` are not decoration. A numeric path in a `JsonMapBuffer` is backed by
 * an atomic counter, and that counter is **clamped** — so an unbounded number has
 * nowhere to clamp to, and the constructor throws. They are therefore required for
 * `number` and meaningless for the other two kinds, which is why they live here
 * rather than being defaulted per type.
 */
export interface BufferEntryConfig {
    id: string;
    /**
     * The path inside the shared record, e.g. `counters.digs` or `players[0].score`.
     * Dot and bracket notation, exactly as `getPath`/`setPath` read it.
     */
    path: string;
    type: BufferValueType;
    /**
     * The seed used when the slot has never been written.
     *
     * Coerced to `type` on load rather than trusted, because the form stores it as
     * text and a hand-edited config can spell a number `"0"` or a bool `"yes"`.
     */
    default: number | boolean | string;
    /** Atomic clamp bounds. Required for `number`, ignored otherwise. */
    min?: number;
    max?: number;
    [key: string]: unknown;
}

export interface EnergyTypeConfig {
    id: string;
    /** Structure / node id this energy type attaches to. */
    structureId: string;
    /**
     * Graph role. `api.energy.registerType` accepts EXACTLY two values:
     * "conductor" (forwards energy) or "storage" (holds energy).
     * There is no producer/consumer role — generating or drawing energy is done by
     * a processor handler calling `api.energy.addAtCell` / `api.energy.consume`.
     */
    type: "conductor" | "storage" | (string & {});
    /** Documented options: `capacity` (storage) and `energyType` (network id). */
    options?: {
        capacity?: number;
        energyType?: string;
        priority?: number;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXCAVATION — excavation.registerProfile(id, definition)
// ═══════════════════════════════════════════════════════════════════════════

export interface ExcavationProfileConfig {
    id: string;
    power: number;
    pattern: number[][];
    options?: {
        fromGun?: boolean;
        fromRocketExplosion?: boolean;
        fromDrill?: boolean;
        useLiteralOutVelocity?: boolean;
        destroyNonDestructible?: boolean;
        forceRemoveAll?: boolean;
        /** Clamped to 0–1000 when set. A number, NOT a boolean flag. */
        drillTierDamage?: number;
        [key: string]: unknown;
    };
    /**
     * Per-terrain dig rules (api.excavation `terrainRules`).
     * `cellType` / `outputElementType` are runtime handles, so they are stored as
     * ids here and resolved at registration time.
     */
    terrainRules?: {
        cellType?: string | number;
        terrainType?: string | number;
        damage?: number;
        outputElementType?: string | number;
        [key: string]: unknown;
    }[];
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// STRUCTURE BEHAVIOURS — structureBehaviors (conveyor / launcher)
// Shape is loosely typed; forwarded as-is.
// ═══════════════════════════════════════════════════════════════════════════

export interface StructureBehaviorConfig {
    id: string;
    /** conveyor | launcher | other behaviour family */
    kind: string;
    behaviorType?: string;
    definition?: Record<string, unknown>;
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// SIGNALS — targets / interactables / senderType (callbacks → handlerKey)
// ═══════════════════════════════════════════════════════════════════════════

export interface SignalConfig {
    id: string;
    /** targets | interactables | senderType */
    kind: "targets" | "interactables" | "senderType" | string;
    /** Target type name / structure type / sender type id. */
    target: string;
    handlerKey?: string;
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// INPUT BINDINGS — input.registerBinding
//
//   registerBinding(bindingId, defaultKeys, definition): BindingId
//
// `KeyCode` is a LooseString union, not a closed enum: a modifier alias
// ("Shift"), a KeyboardEvent.code ("KeyO"), or a chord ("Control+KeyC") are
// all valid, so the default keys stay a free list rather than a fixed choice.
// `BindingId` is likewise LooseString over the vanilla `KeyBinding` names, so a
// custom id is legal — which is the only safe default, since reusing a vanilla
// name would replace a built-in binding.
// ═══════════════════════════════════════════════════════════════════════════

export interface InputBindingConfig {
    /** Passed as `bindingId`; also the id shown in the game's settings. */
    id: string;
    /** Required by the engine; shown in settings. */
    displayName: string;
    /** i18n key; overrides `displayName` when set. */
    displayNameKey?: string;
    /** Settings grouping. Required by the engine. */
    category: string;
    /** `defaultKeys` — KeyCode strings such as "KeyO" or "Control+KeyC". */
    defaultKeys?: string[];
    /** `handlers.down` — a handler key, resolved at apply time. */
    onDownKey?: string;
    /** `handlers.up` — a handler key, resolved at apply time. */
    onUpKey?: string;
    /** Optional settings subsection shown above the binding. */
    subsection?: {
        title?: string;
        titleKey?: string;
        description?: string;
        descriptionKey?: string;
    };
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// TRIGGERS — triggers.register (callback → handlerKey)
// ═══════════════════════════════════════════════════════════════════════════

export interface TriggerConfig {
    id: string;
    triggerId?: string;
    interval?: number;
    sequentialRuns?: number;
    extra?: Record<string, unknown>;
    handlerKey?: string;
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// SPRITES — sprites.loadFromMod / load
// ═══════════════════════════════════════════════════════════════════════════

export interface SpriteConfig {
    id: string;
    /** Path relative to mod folder (loadFromMod). */
    path?: string;
    /** Absolute / arbitrary source for sprites.load. */
    source?: string;
    options?: Record<string, unknown>;
    /** Prefer loadFromMod when path is set. */
    fromMod?: boolean;
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOKS / MODIFIERS — hooks.intercept + hooks.modify
// Docs: https://sandustry.dev/api/hooks
// Callbacks cannot live in JSON. Two modes:
//   1) handlerKey → resolved from CODE_HANDLERS registry in src/handler/
//   2) metadata-only entry (applied only when a matching code handler exists)
// ═══════════════════════════════════════════════════════════════════════════

export type HookKind = "intercept" | "modify";

export interface ModifierConfig {
    id: string;
    /** Engine hook point name (string; official list is incomplete / version-dependent). */
    hookId: string;
    /** intercept = observe; modify = transform value flowing through. */
    kind: HookKind;
    /**
     * Key into the in-mod CODE_HANDLERS map (src/handler/actions/).
     * Required for a live callback. Without it the entry is stored but not attached.
     */
    handlerKey?: string;
    /** Passed as the 3rd argument to hooks.intercept / hooks.modify. */
    options?: Record<string, unknown>;
    /** Free-form notes for the UI / JSON authors. */
    notes?: string;
    /** If false, skip apply even when handlerKey resolves. Default true. */
    enabled?: boolean;
    [key: string]: unknown;
}

export type ModConfig = {
    version: number;
    elements: ElementConfig[];
    structures: StructureConfig[];
    items: ItemConfig[];
    recipes: RecipeConfig[];
    processing: ProcessingConfig[];
    contacts: ContactReactionConfig[];
    interactions: InteractionConfig[];
    modifiers: ModifierConfig[];
    terrains: TerrainConfig[];
    techs: TechConfig[];
    upgradeCategories: UpgradeCategoryConfig[];
    upgrades: UpgradeConfig[];
    projectiles: ProjectileConfig[];
    energyTypes: EnergyTypeConfig[];
    energyNetworks: EnergyNetworkConfig[];
    /**
     * Ours, not the engine's.
     *
     * A mod-owned entry that every structure names, standing in for the two ways
     * a structure becomes available. It is a separate list from `techs` on
     * purpose: a node is the *thing a structure is gated behind*, while a tech is
     * a step in a research tree that may do more than unlock.
     */
    unlockNodes: UnlockNodeConfig[];
    excavationProfiles: ExcavationProfileConfig[];
    structureBehaviors: StructureBehaviorConfig[];
    signals: SignalConfig[];
    triggers: TriggerConfig[];
    sprites: SpriteConfig[];
    inputBindings: InputBindingConfig[];
    /**
     * The author's custom processes — the named, reusable handlers a definition
     * *references* rather than copying.
     *
     * A separate list from the definitions on purpose. A signal does not own its
     * program; it names one. That indirection is what makes "edit it once" possible,
     * and it is why `processId` is an id and not a copy of `steps` (D5).
     *
     * Re-exported from `../handler/custom-process/types.ts` rather than restated
     * here, so the compiler and the store cannot disagree about the stored shape.
     */
    processes: CustomProcessConfig[];
    /**
     * The shared buffer's slots — mod-owned, and read by `bufferWrite` /
     * `bufferRead` rather than by any `register()`.
     *
     * Separate from `structureBehaviors` and the rest on purpose: those are
     * things the engine instantiates, and this is a bag of values the author's
     * own processes agree on. A behaviour can be registered and never run; a
     * buffer slot can be written and read back by anything.
     */
    buffers: BufferEntryConfig[];
};

export const DEFAULT_CONFIG: ModConfig = {
    version: 1,
    elements: [],
    structures: [],
    items: [],
    recipes: [],
    processing: [],
    contacts: [],
    interactions: [],
    modifiers: [],
    terrains: [],
    techs: [],
    upgradeCategories: [],
    upgrades: [],
    projectiles: [],
    energyTypes: [],
    energyNetworks: [],
    unlockNodes: [],
    excavationProfiles: [],
    structureBehaviors: [],
    signals: [],
    triggers: [],
    sprites: [],
    processes: [],
    inputBindings: [],
    buffers: [],
};

export type PanelState = {
    x: number;
    y: number;
    minimized: boolean;
    width?: number;
    height?: number;
};

/** Human-readable field help shown in the panel (JSON schema hints). */
export const FIELD_HELP = {
    elements: [
        "id (required)",
        "name, nameKey, description, descriptionKey",
        "matterType: Solid|Liquid|Particle|Gas|Static|Slushy|Wisp|Powder",
        "density, metaColor (0xRRGGBB), materialId",
        "colors: { variants: [[r,g,b,a],…] } or raw [[r,g,b,a],…]",
        "duration, durationRandom: {min,max}",
        "flammable, isGrabbable, isTransportable, hidden",
        "interactions[], defaultDataFields{}",
    ],
    structures: [
        "id (required)",
        "name, nameKey, description, descriptionKey",
        "categoryKey: blocks|logistics|production|economy|logic|fluids|lighting|special|misc",
        "order, hideFromBuildMenu, disallowPick",
        "shape: number[][] (1=occupied)",
        "buildModes: [{type: single|line|rectangle|…, directions?}]",
        "variants: [{id, angles: number[]}]",
        "render: {imageName, size:{w,h}, offset?, ui?, spritesheet?}",
        "defaultData{}, copyData, rejectWhenBlocked, blockGridType",
        "registerOptions: {useRawShape?}",
    ],
    items: [
        "id (required)",
        "itemType: Weapon|Tool|Consumable|Mod",
        "name, nameKey, description, descriptionKey, categoryKey",
        "sprite: {id (required, must be loaded), type: onehand|twohand|backhand, mount?}",
        "cooldown",
    ],
    recipes: [
        "id (required)",
        "kind: grower|planterBox|shaker|kineticPress|condenser|steamDryer|synthesizer|snowmaker|smelter|structure",
        "structureType (when kind=structure or custom)",
        "input, output, chance (0–1)",
        "outputs / outputsAbove / outputsBelow: [{elementType, chance?}]",
        "minimumDownwardVelocity (kinetic press)",
    ],
    processing: [
        "id (required)",
        "structureType (processing.register) or structureId (addProcessor)",
        "intervalMs",
        "mode: type|instance",
        "NOTE: process() callback cannot be stored in JSON — attach in code",
    ],
    contacts: [
        "id (required)",
        "inputA, inputB (element ids/types)",
        "outputA, outputB (element ids/types or null to consume)",
        "orientation?",
    ],
    interactions: [
        "id (required)",
        "elementId (target element)",
        "interaction: { kind, … } descriptor for elements.addInteractionInfo",
    ],
    modifiers: [
        "id (required)",
        "hookId — engine hook point name (string)",
        "kind: intercept | modify",
        "actions: [{key, options}] — the process, ordered",
        "enabled — default true",
        "notes — free text",
        "NOTE: real callbacks live in code (handlers.ts), not in JSON",
    ],
    terrains: [
        "id, name, hp, materialId, metaColor, colorHSL, colorPattern, colorGradient",
        "output: {elementType, chance}, fog, flammable, excavationRequirements[], background",
    ],
    techs: [
        "id, cost, currencyType, branch, requires, unlocks:{structures,items,map}",
        "parentId / preferredPosition for registerNode placement",
    ],
    upgradeCategories: ["categoryId, itemId, itemNameKey, requirement:{techId}"],
    upgrades: ["itemId, categoryId, upgrade:{id,maxLevel,costs,oneOff}, actions: [{key, options}]"],
    projectiles: ["id, sprite:{id,tint}, options, option:{key, params}"],
    energyTypes: ["id, structureId, type (e.g. storage), options:{priority,excludeFromNetwork}"],
    excavationProfiles: ["id, power, pattern (square number[][]), options flags"],
    structureBehaviors: ["id, kind (conveyor|launcher), definition{}"],
    signals: ["kind: targets|interactables|senderType, target, actions: [{key, options}]"],
    triggers: ["triggerId, interval, sequentialRuns, extra, actions: [{key, options}]"],
    sprites: ["id, path (loadFromMod) or source (load), options, fromMod"],
} as const;
