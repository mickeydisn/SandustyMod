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
import { MOD_ID, type ModConfig } from "../constants.ts";
import { definitionFor } from "./definition/index.ts";
import {} from "./definition/fields.ts";
import { behaviorDefinition } from "./definition/behavior.ts";
import { contactDefinition } from "./definition/contact.ts";
import { elementDefinition } from "./definition/element.ts";
import { energyDefinition } from "./definition/energy.ts";
import { excavationDefinition } from "./definition/excavation.ts";
import { inputDefinition } from "./definition/input.ts";
import { interactionDefinition } from "./definition/interaction.ts";
import { itemDefinition } from "./definition/item.ts";
import { modifierDefinition } from "./definition/modifier.ts";
import { networkDefinition } from "./definition/network.ts";
import { processingDefinition } from "./definition/processing.ts";
import { projectileDefinition } from "./definition/projectile.ts";
import { recipeDefinition } from "./definition/recipe.ts";
import { signalDefinition } from "./definition/signal.ts";
import { spriteDefinition } from "./definition/sprite.ts";
import { structureDefinition } from "./definition/structure.ts";
import { terrainDefinition } from "./definition/terrain.ts";
import { techDefinition } from "./definition/tech.ts";
import { triggerDefinition } from "./definition/trigger.ts";
import { unlockNodeDefinition } from "./definition/unlock-node.ts";
import { upgradeDefinition } from "./definition/upgrade.ts";
import { upgradeCategoryDefinition } from "./definition/upgrade-category.ts";
import {
    formatIdList,
    HEX,
    parseIdList,
    readerFor,
    safeJson,
    writerFor,
} from "./definition/values.ts";

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
import { type Opt, searchLibraryAssets } from "../catalog.ts";

// ── Categories & groups ──────────────────────────────────────────────────────

export type Tab =
    | "elements"
    | "structures"
    | "items"
    | "recipes"
    | "processing"
    | "contacts"
    | "interactions"
    | "terrains"
    | "techs"
    | "upgrades"
    | "categories"
    | "unlockNodes"
    | "signals"
    | "triggers"
    | "behaviors"
    | "energy"
    | "networks"
    | "excavation"
    | "projectiles"
    | "sprites"
    | "modifiers"
    | "inputs"
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
    elements: {
        label: "Elements",
        blurb: "New simulation matter: powders, liquids, gases…",
        configKey: "elements",
    },
    structures: {
        label: "Structures",
        blurb: "Buildable machines (build menu, shape, render).",
        configKey: "structures",
    },
    items: {
        label: "Items",
        blurb: "Hotbar items: tools, weapons, consumables.",
        configKey: "items",
    },
    recipes: {
        label: "Machine recipes",
        blurb: "Input → outputs for the built-in machines.",
        configKey: "recipes",
    },
    processing: {
        label: "Processors",
        blurb: "Timed behaviour attached to a structure type.",
        configKey: "processing",
    },
    contacts: {
        label: "Contact reactions",
        blurb: "Element A + element B → two outputs.",
        configKey: "contacts",
    },
    interactions: {
        label: "Tooltips",
        blurb: "The hover text and behaviour an element or terrain shows in-game.",
        configKey: "interactions",
    },
    terrains: {
        label: "Terrains",
        blurb: "Diggable tiles: hp, colour, drop output.",
        configKey: "terrains",
    },
    unlockNodes: {
        label: "Unlock nodes",
        blurb: "What each structure is gated behind: free from the start, or behind research.",
        configKey: "unlockNodes",
    },
    techs: {
        label: "Tech nodes",
        blurb: "Research nodes: cost, branch, unlocks.",
        configKey: "techs",
    },
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
    signals: {
        label: "Signals",
        blurb: "Structure click / signal handlers.",
        configKey: "signals",
    },
    triggers: { label: "Triggers", blurb: "Interval callbacks (ticks).", configKey: "triggers" },
    behaviors: {
        label: "Behaviours",
        blurb: "Conveyor / launcher behaviour definitions.",
        configKey: "structureBehaviors",
    },
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
    excavation: {
        label: "Excavation profiles",
        blurb: "Dig power + cell pattern.",
        configKey: "excavationProfiles",
    },
    projectiles: {
        label: "Projectiles",
        blurb: "Sprite-driven projectiles and their options.",
        configKey: "projectiles",
    },
    sprites: {
        label: "Sprites",
        blurb: "Images loaded from the mod folder.",
        configKey: "sprites",
    },
    modifiers: {
        label: "Hook modifiers",
        blurb: "Intercept / modify engine hooks (code handlers).",
        configKey: "modifiers",
    },
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
    {
        key: "content",
        label: "Content",
        hint: "What the player sees in the world",
        categories: ["terrains", "elements", "structures", "items"],
    },
    {
        key: "extend",
        label: "Extend",
        hint: "Add to what the game already does",
        categories: ["interactions", "behaviors", "excavation", "projectiles", "signals"],
    },
    {
        key: "production",
        label: "Production",
        hint: "How things transform",
        categories: ["contacts", "recipes"],
    },
    {
        key: "tech",
        label: "Tech",
        hint: "Research, progression & upgrades",
        categories: ["unlockNodes", "techs", "categories", "upgrades"],
    },
    {
        key: "actions",
        label: "Actions",
        hint: "Reacting to the player and the clock",
        categories: ["triggers", "inputs", "processing", "modifiers"],
    },
    {
        key: "energy",
        label: "Energy",
        hint: "Power channels and the nodes on them",
        categories: ["networks", "energy"],
    },
    {
        key: "assets",
        label: "Assets",
        hint: "Images, and the code that paints them",
        categories: ["sprites", "draws"],
    },
    {
        key: "handlers",
        label: "Handlers",
        hint: "Every function this mod can call",
        categories: ["handlers"],
    },
    { key: "help", label: "Graph", hint: "What points at what", categories: ["help"] },
    {
        key: "data",
        label: "Data",
        hint: "Raw JSON, and a map of what you have made",
        categories: ["map", "json"],
    },
];

// ── Field specs ──────────────────────────────────────────────────────────────

export type FieldKind =
    | "text"
    | "number"
    | "bool"
    | "select"
    | "color"
    | "json"
    | "outputs"
    | "shape"
    | "library"
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
 * Colour variants, re-exported from the element definition.
 *
 * These used to live here, and are still exported from here because the tests
 * and the tools import them from `schema.ts`. They are element-only — the
 * `colors.variants` list belongs to exactly one object — so the implementation
 * moved with the rest of the element into `./definition/element.ts`.
 */
export {
    hexListToVariants,
    seedVariantFromMapColor,
    variantsToHexList,
} from "./definition/element.ts";

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
/**
 * Field lists for every tab that has not been split into its own definition.
 *
 * Empty now, and that is the end state rather than a leftover. The five tabs that
 * used to be listed here render their own body rather than a form: a handler or
 * a draw function is code the engine calls, not an entry anything creates, and
 * `json`, `map` and `help` are raw views over stored config.
 *
 * They are absent rather than explicitly empty because a tab with no definition
 * already resolves to no fields — and `fieldsFor("draws")` coming back empty is
 * the assertion that keeps a "New" button from ever appearing there.
 *
 * Kept as an empty record rather than deleted, because `fieldsFor` reads it and
 * the fallback is what makes a definition-less tab return nothing rather than
 * throw. An empty `FIELDS` is now the honest summary: every object is defined
 * elsewhere.
 */
const FIELDS: Partial<Record<Tab, FieldSpec[]>> = {};

// ── Helpers ──────────────────────────────────────────────────────────────────

// ── multiselect encoding ─────────────────────────────────────────────────────
//
// Encoding lives in `parseIdList` / `formatIdList` above; a `multiselect` field
// is a comma-separated string in the form and a real `string[]` in the entry.

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

const NUMERIC = /^-?\d+(\.\d+)?$/;

function parseJsonRaw(raw: string): { ok: boolean; value?: unknown; error?: string } {
    try {
        return { ok: true, value: JSON.parse(raw) };
    } catch (e) {
        return { ok: false, error: `invalid JSON: ${(e as Error).message}` };
    }
}

/** Validate one field against the form. Returns an error message or null. */
function validateField(f: FieldSpec, form: Record<string, string>, cat?: Tab): string | null {
    if (!isActive(f, form)) return null;
    const raw = (form[f.key] ?? "").trim();

    if (f.kind === "bool") return null;

    if (!raw) {
        // A definition may have something to say about an *empty* value too —
        // an `outputs` list that is required but empty is not merely "required",
        // it is missing its one row. So the definition is asked before the
        // generic "required", which would otherwise answer first and pre-empt it.
        const empty = cat === undefined ? undefined : definitionFor(cat)?.validateField?.(f, raw);
        if (empty !== undefined) return empty;
        return f.required ? "required" : null;
    }

    // A definition owns the validation of its own field kinds. Asked first, so
    // adding a recipe-only kind never means adding a case here.
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
        case "json": {
            const parsed = parseJsonRaw(raw);
            if (!parsed.ok) return parsed.error ?? "invalid JSON";
            if (
                f.jsonType === "object" &&
                (typeof parsed.value !== "object" || parsed.value === null ||
                    Array.isArray(parsed.value))
            ) {
                return "must be a JSON object { }";
            }
            if (f.jsonType === "array" && !Array.isArray(parsed.value)) {
                return "must be a JSON array [ ]";
            }
            // `jsonType: "matrix"` is checked by the definition that owns the
            // field — only an excavation profile's `pattern` is a matrix, and
            // the shape rules belong beside the schema that declares them.
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
    // travel with it. Nothing is left here that is not yet split out.
    definitionFor(cat)?.validate?.(form, errors);
    return errors;
}

// ── Form ⇄ entry mapping ─────────────────────────────────────────────────────
//
// The coercion helpers below used to live here and were called from each `case`
// in `formToEntry`. Every tab is a definition now, and each is handed an
// `EntryWriter` built in `./definition/values.ts` that does the same coercing —
// so these are gone rather than duplicated. Keeping a second copy would be two
// places to disagree about what an empty control means, and the writer is the
// one the definitions actually use.

/**
 * Select values carry sentinels:
 *   ""           → leave unset
 *   "__null__"   → explicit null (engine: "consume this input")
 *   "__custom__" → the companion *Custom text field supplies the value
 *
 * The sentinel vocabulary is documented here because the *fields* rely on it —
 * a `when` compares against `"__custom__"` — while the reading and writing of it
 * live with whichever object owns the pair.
 */

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
 * `putCustomOrSelect` — loading a picker/companion-box pair.
 *
 * Re-exported from `./definition/values.ts` for callers that have always
 * reached for it here. It now lives beside the three definitions that use it
 * (a tech, an unlock node, a modifier), because the read and the write have to
 * agree on `__custom__` and splitting a pair across two files is how the
 * sentinel ends up stored as a value.
 */
export { putCustomOrSelect } from "./definition/values.ts";

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
    // The definition owns this list, for the same reason it owns the fields: a
    // form that claims a key and a passthrough that carries it have to be the
    // same decision, made in the same file. Every tab is a definition now, so
    // there is no fallback table left here to disagree with one.
    const covered = new Set<string>(definitionFor(cat)?.formCovered ?? []);
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
    const num = (
        v: unknown,
    ) => (typeof v === "number" && Number.isFinite(v) ? String(v) : undefined);
    const str = (v: unknown) => (typeof v === "string" ? v : undefined);
    const json = (
        v: unknown,
    ) => (v === undefined || v === null ? undefined : JSON.stringify(v, null, 2));

    if (typeof e.id === "string") form.idSuffix = suffixOf(e.id, cat);

    switch (cat) {
        case "elements": {
            // Owned by ./definition/element.ts — see the note in formToEntry.
            elementDefinition.entryToForm?.(e, readerFor(form));
            break;
        }
        case "structures": {
            // Owned by ./definition/structure.ts — see the note in formToEntry.
            structureDefinition.entryToForm?.(e, readerFor(form));
            break;
        }
        case "items": {
            // Owned by ./definition/item.ts — see the note in formToEntry.
            itemDefinition.entryToForm?.(e, readerFor(form));
            break;
        }
        case "recipes": {
            // Owned by ./definition/recipe.ts — see the note in formToEntry.
            recipeDefinition.entryToForm?.(e, readerFor(form));
            break;
        }
        case "processing": {
            // Owned by ./definition/processing.ts — see the note in formToEntry.
            processingDefinition.entryToForm?.(e, readerFor(form));
            break;
        }
        case "contacts": {
            // Owned by ./definition/contact.ts — see the note in formToEntry.
            contactDefinition.entryToForm?.(e, readerFor(form));
            break;
        }
        case "interactions": {
            // Owned by ./definition/interaction.ts — see the note in formToEntry.
            interactionDefinition.entryToForm?.(e, readerFor(form));
            break;
        }
        case "terrains": {
            // Owned by ./definition/terrain.ts — see the note in formToEntry.
            terrainDefinition.entryToForm?.(e, readerFor(form));
            break;
        }
        case "unlockNodes": {
            // Owned by ./definition/unlock-node.ts — see the note in formToEntry.
            unlockNodeDefinition.entryToForm?.(e, readerFor(form));
            break;
        }
        case "techs": {
            // Owned by ./definition/tech.ts — see the note in formToEntry.
            techDefinition.entryToForm?.(e, readerFor(form));
            break;
        }
        case "categories": {
            // Owned by ./definition/upgrade-category.ts.
            upgradeCategoryDefinition.entryToForm?.(e, readerFor(form));
            break;
        }
        case "inputs": {
            // Owned by ./definition/input.ts — see the note in formToEntry.
            inputDefinition.entryToForm?.(e, readerFor(form));
            break;
        }
        case "upgrades": {
            put("itemId", str(e.itemId) ?? num(e.itemId));
            put("itemNameKey", str(e.itemNameKey));
            put("categoryId", str(e.categoryId));
            // UpgradeDefinition.upgrade is a nested object.
            const u = e.upgrade as
                | {
                    id?: string;
                    maxLevel?: number;
                    costs?: number[];
                    oneOff?: boolean;
                    nameKey?: string;
                }
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
            // Owned by ./definition/signal.ts — see the note in formToEntry.
            signalDefinition.entryToForm?.(e, readerFor(form));
            break;
        }
        case "triggers": {
            // Owned by ./definition/trigger.ts — see the note in formToEntry.
            triggerDefinition.entryToForm?.(e, readerFor(form));
            break;
        }
        case "behaviors": {
            // Owned by ./definition/behavior.ts — see the note in formToEntry.
            behaviorDefinition.entryToForm?.(e, readerFor(form));
            break;
        }
        case "energy": {
            // Owned by ./definition/energy.ts — see the note in formToEntry.
            energyDefinition.entryToForm?.(e, readerFor(form));
            break;
        }
        case "networks": {
            // Owned by ./definition/network.ts — see the note in formToEntry.
            networkDefinition.entryToForm?.(e, readerFor(form));
            break;
        }
        case "excavation": {
            // Owned by ./definition/excavation.ts — see the note in formToEntry.
            excavationDefinition.entryToForm?.(e, readerFor(form));
            break;
        }
        case "projectiles": {
            // Owned by ./definition/projectile.ts — see the note in formToEntry.
            projectileDefinition.entryToForm?.(e, readerFor(form));
            break;
        }
        case "sprites": {
            // Owned by ./definition/sprite.ts — see the note in formToEntry.
            spriteDefinition.entryToForm?.(e, readerFor(form));
            break;
        }
        case "modifiers": {
            // Owned by ./definition/modifier.ts — see the note in formToEntry.
            modifierDefinition.entryToForm?.(e, readerFor(form));
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
    // Every tab is a definition now, and each writes through the `EntryWriter`
    // from `writerFor` — which owns "an undefined clears the key" for all three
    // types. The local setters these replaced would have been a second copy of
    // that rule, and the definitions would not have used them anyway.
    const id = fullIdOf(form, cat);
    if (id) entry.id = id;

    switch (cat) {
        case "elements": {
            // Owned by ./definition/element.ts. Delegated rather than inlined so
            // the element's schema, its save path and its widgets are one file
            // that has to be read together to be changed correctly.
            elementDefinition.formToEntry?.(form, writerFor(form, entry));
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
            // Owned by ./definition/item.ts. Delegated rather than inlined so
            // the item's schema and its save path are one file that has to be
            // read together to be changed correctly.
            itemDefinition.formToEntry?.(form, writerFor(form, entry));
            break;
        }
        case "recipes": {
            // Owned by ./definition/recipe.ts. Delegated rather than inlined so
            // the recipe's schema, its machine-dependent output shape and its row
            // editor are one file that has to be read together.
            recipeDefinition.formToEntry?.(form, writerFor(form, entry));
            break;
        }
        case "processing": {
            // Owned by ./definition/processing.ts. Delegated rather than inlined
            // so the removed mode/structureId pair stays explained next to the
            // field that replaced it.
            processingDefinition.formToEntry?.(form, writerFor(form, entry));
            break;
        }
        case "contacts": {
            // Owned by ./definition/contact.ts. Delegated rather than inlined so
            // the "consume this input" null and the form's sentinel for it stay
            // in one file — they are a pair, and splitting them loses the meaning.
            contactDefinition.formToEntry?.(form, writerFor(form, entry));
            break;
        }
        case "interactions": {
            // Owned by ./definition/interaction.ts. Delegated rather than inlined
            // so the "keep an unmodelled descriptor verbatim" rule — which decides
            // whether a save is a rewrite — stays with the split that created it.
            interactionDefinition.formToEntry?.(form, writerFor(form, entry));
            break;
        }
        case "terrains": {
            // Owned by ./definition/terrain.ts. Delegated rather than inlined so
            // the terrain's schema, its HSL toggle and its save path are one file
            // that has to be read together to be changed correctly.
            terrainDefinition.formToEntry?.(form, writerFor(form, entry));
            break;
        }
        case "unlockNodes": {
            // Owned by ./definition/unlock-node.ts. Delegated rather than inlined
            // so the "borrowed tech owns its own definition" rule stays with the
            // `when` conditions that depend on it.
            unlockNodeDefinition.formToEntry?.(form, writerFor(form, entry));
            break;
        }
        case "techs": {
            // Owned by ./definition/tech.ts. Delegated rather than inlined so the
            // two picker/text pairs — which are a read/write contract, not two
            // fields — stay in one file with the schema that declares them.
            techDefinition.formToEntry?.(form, writerFor(form, entry));
            break;
        }
        case "categories": {
            // Owned by ./definition/upgrade-category.ts. The name-or-nameKey rule
            // moves with it, since it is a property of this object.
            upgradeCategoryDefinition.formToEntry?.(form, writerFor(form, entry));
            break;
        }
        case "inputs": {
            // Owned by ./definition/input.ts — see the note in formToEntry.
            inputDefinition.formToEntry?.(form, writerFor(form, entry));
            break;
        }
        case "upgrades": {
            // Owned by ./definition/upgrade.ts. Delegated rather than inlined so
            // the nested `upgrade` payload and the `__custom__` category rule
            // stay in one file.
            upgradeDefinition.formToEntry?.(form, writerFor(form, entry));
            break;
        }
        case "signals": {
            // Owned by ./definition/signal.ts. Delegated rather than inlined so
            // the signal's schema and its save path are one file.
            signalDefinition.formToEntry?.(form, writerFor(form, entry));
            break;
        }
        case "triggers": {
            // Owned by ./definition/trigger.ts. Delegated rather than inlined so
            // the un-rendered `triggerId` passthrough stays explained beside the
            // field that is the real identity.
            triggerDefinition.formToEntry?.(form, writerFor(form, entry));
            break;
        }
        case "behaviors": {
            // Owned by ./definition/behavior.ts. Delegated rather than inlined so
            // the split between the four named pickers and the raw payload box —
            // and the order they merge in — stays in one file.
            behaviorDefinition.formToEntry?.(form, writerFor(form, entry));
            break;
        }
        case "energy": {
            // Owned by ./definition/energy.ts — see the note in formToEntry.
            energyDefinition.formToEntry?.(form, writerFor(form, entry));
            break;
        }
        case "networks": {
            // Owned by ./definition/network.ts — see the note in formToEntry.
            networkDefinition.formToEntry?.(form, writerFor(form, entry));
            break;
        }
        case "excavation": {
            // Owned by ./definition/excavation.ts. Delegated rather than inlined
            // so the profile's schema, its pattern rules and its rule editor stay
            // in one file.
            excavationDefinition.formToEntry?.(form, writerFor(form, entry));
            break;
        }
        case "projectiles": {
            // Owned by ./definition/projectile.ts. Delegated rather than inlined so
            // the sprite control and the handler-wins-over-options rule — which is
            // a form decision and a save decision together — stay in one file.
            projectileDefinition.formToEntry?.(form, writerFor(form, entry));
            break;
        }
        case "sprites": {
            // Owned by ./definition/sprite.ts — see the note in formToEntry.
            spriteDefinition.formToEntry?.(form, writerFor(form, entry));
            break;
        }
        case "modifiers": {
            // Owned by ./definition/modifier.ts. Delegated rather than inlined so
            // the hook-id picker and its companion box stay a read/write pair.
            modifierDefinition.formToEntry?.(form, writerFor(form, entry));
            break;
        }
        default:
            break;
    }

    return entry;
}
