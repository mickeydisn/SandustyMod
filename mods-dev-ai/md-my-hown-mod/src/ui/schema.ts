
import { TAB_TO_CALL_SITE } from "../handler/index.ts";
import { resolveProjectileOption } from "../handler/processing/projectile-option/index.ts";
import { currentProcessRegistry, processProblem } from "../handler/processing/custom-process/index.ts";
import { resolveExcavationOption } from "../handler/processing/excavation-option/index.ts";
import { MOD_ID, type ModConfig } from "../constants.ts";
import { definitionFor } from "./definition/index.ts";

import {
    formatIdList,
    HEX,
    parseIdList,
    readerFor,
    safeJson,
    writerFor,
} from "./definition/values.ts";


export { formatIdList, parseIdList, safeJson };


export {
    composeTooltipHover,
    describeShape,
    emptyShape,
    normalizeShape,
    parseBuildModes,
    shapeToText,
} from "./definition/core/structure.ts";
export { autoGraphicsKey, resolveAutoFill } from "./definition/fields.ts";
export { PASSTHROUGH_KEY, passthroughKeysOf } from "./definition/fields.ts";
import { type Opt, searchLibraryAssets } from "../catalog.ts";



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
    
    | "placementConfigs"
    | "energy"
    | "networks"
    | "buffers"
    | "excavation"
    | "projectiles"
    | "sprites"
    | "modifiers"
    | "inputs"
    
    | "draws"
    
    | "spriteEditor"
    
    | "action"
    
    | "projectileOption"
    
    | "excavationOption"
    
    | "customProcess"
    
    | "upgradeAction"
    
    | "help"
    
    | "map"
    | "json";

export interface CategoryMeta {
    label: string;
    blurb: string;
    
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
    placementConfigs: {
        label: "Placement fields",
        blurb: "Sliders and pickers the player adjusts while holding a building. " +
            "Not a limit on how many may be placed.",
        configKey: "placementConfigs",
    },
    
    
    
    
    
    
    energy: {
        label: "Interactions",
        blurb: "Attach a conductor/storage energy node to a structure.",
        configKey: "energyTypes",
    },
    networks: {
        label: "Networks",
        blurb: "Named energy channels. The game ships one; add the ones you need.",
        configKey: "energyNetworks",
    },
    buffers: {
        label: "Buffer",
        
        
        
        
        
        blurb: "Shared slots every process in this mod can read and write.",
        configKey: "buffers",
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
    action: {
        label: "Actions",
        blurb: "Every callable this mod can run as part of a process.",
    },
    projectileOption: {
        label: "Projectile options",
        blurb: "Functions that build a projectile's spawn-time options.",
    },
    excavationOption: {
        label: "Excavation options",
        blurb: "Functions that build an excavation profile's power and dig flags.",
    },
    customProcess: {
        label: "Processes",
        blurb: "Your own named handlers, built by combining actions once and used anywhere.",
        configKey: "processes",
    },
    upgradeAction: {
        label: "Upgrade actions",
        blurb: "The actions an upgrade can run — and nothing else can.",
    },
    
    draws: {
        label: "Custom draw",
        blurb: "What the engine can paint, and which of it this mod uses.",
    },
    spriteEditor: {
        label: "Sprite editor",
        blurb: "Draw a sprite pixel by pixel and save it as a game asset.",
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


export const MENU_GROUPS: MenuGroup[] = [
    {
        key: "content",
        label: "Content",
        hint: "What the player sees in the world",
        
        
        
        
        
        categories: ["terrains", "elements", "structures", "items", "buffers"],
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
        categories: ["techs", "upgrades"],
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
        categories: ["sprites", "spriteEditor", "draws"],
    },
    {
        key: "handlers",
        label: "Handlers",
        
        
        
        hint: "What this mod can run, and what it can build",
        categories: ["action", "customProcess"],
    },
    { key: "help", label: "Graph", hint: "What points at what", categories: ["help"] },
    {
        key: "data",
        label: "Data",
        hint: "Raw JSON, and a map of what you have made",
        categories: ["map", "json"],
    },
];



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
    
    | "terrainRules"
    
    | "buildModes"
    
    | "colorVariants"
    
    | "multiselect"
    
    | "projectileOption"
    
    | "excavationOption"
    
    | "processRef"
    
    | "program";

export interface FieldSpec {
    key: string;
    label: string;
    kind: FieldKind;
    section: string;
    required?: boolean;
    hint?: string;
    placeholder?: string;
    
    min?: number;
    max?: number;
    step?: number;
    int?: boolean;
    
    maxLength?: number;
    pattern?: string;
    patternMsg?: string;
    
    options?: Opt[] | ((form: Record<string, string>) => Opt[]);
    
    jsonType?: "object" | "array" | "matrix";
    
    when?: (form: Record<string, string>) => boolean;
    
    def?: string;
    
    wide?: boolean;
    
    emptyHint?: string;
    
    autoKey?: string;
    
    autoValue?: string;
}


export {
    hexListToVariants,
    seedVariantFromMapColor,
    variantsToHexList,
} from "./definition/core/element.ts";













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
    
    
    
    
    return definitionFor(cat)?.fields ?? [];
}


export function sectionsToReveal(
    sections: Section[],
    errors: Record<string, string>,
): Set<string> {
    const out = new Set<string>();
    for (const sec of sections) {
        if (sec.fields.some((f) => errors[f.key])) out.add(sec.title);
    }
    return out;
}

export interface Section {
    title: string;
    fields: FieldSpec[];
}


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


function validateField(f: FieldSpec, form: Record<string, string>, cat?: Tab): string | null {
    if (!isActive(f, form)) return null;
    const raw = (form[f.key] ?? "").trim();

    if (f.kind === "bool") return null;

    if (!raw) {
        
        
        
        
        const empty = cat === undefined ? undefined : definitionFor(cat)?.validateField?.(f, raw);
        if (empty !== undefined) return empty;
        return f.required ? "required" : null;
    }

    
    
    const own = cat === undefined ? undefined : definitionFor(cat)?.validateField?.(f, raw);
    if (own !== undefined) return own;

    switch (f.kind) {
        case "processRef": {
            
            
            if (!raw.trim()) return null;
            
            
            
            
            const slot = TAB_TO_CALL_SITE[cat ?? ""];
            if (!slot) return null; 
            return processProblem(currentProcessRegistry(), raw, slot) ?? null;
        }
        case "projectileOption":
        
        
        
        
        
        
        
        
        
        case "excavationOption": {
            if (!raw.trim()) return null; 
            if (f.kind === "projectileOption") {
                if (!resolveProjectileOption(raw)) return `unknown projectile option: ${raw}`;
            } else if (!resolveExcavationOption(raw)) {
                return `unknown excavation option: ${raw}`;
            }
            return null;
        }
        case "text":
            if (f.maxLength && raw.length > f.maxLength) return `max ${f.maxLength} characters`;
            if (f.pattern && !new RegExp(f.pattern).test(raw)) {
                return f.patternMsg ?? `must match ${f.pattern}`;
            }
            return null;
        
        
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
            
            
            const opts = resolveOptions(f, form);
            const tokens = parseIdList(raw);
            if (opts.length === 0) return null; 
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
            
            
            
            return null;
        }
        default:
            return null;
    }
}


export function validateForm(cat: Tab, form: Record<string, string>): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const f of fieldsFor(cat)) {
        const err = validateField(f, form, cat);
        if (err) errors[f.key] = err;
    }
    
    
    definitionFor(cat)?.validate?.(form, errors);
    return errors;
}










function optJson<T>(form: Record<string, string>, key: string): T | undefined {
    const v = (form[key] ?? "").trim();
    if (v === "") return undefined;
    try {
        return JSON.parse(v) as T;
    } catch {
        return undefined; 
    }
}


export { putCustomOrSelect } from "./definition/values.ts";



export function formDefaults(cat: Tab): Record<string, string> {
    const form: Record<string, string> = {};
    for (const f of fieldsFor(cat)) {
        if (f.kind === "bool") form[f.key] = f.def ?? "false";
        else form[f.key] = f.def ?? "";
    }
    return form;
}


export function newEntryForm(cat: Tab): Record<string, string> {
    const form = formDefaults(cat);
    definitionFor(cat)?.onNewEntry?.(form);
    return form;
}



export function passthroughKeys(
    cat: Tab,
    entry: Record<string, unknown>,
): string[] {
    return Object.keys(passthroughOf(cat, entry)).sort();
}


function passthroughOf(cat: Tab, entry: Record<string, unknown>): Record<string, unknown> {
    
    
    
    
    const covered = new Set<string>(definitionFor(cat)?.formCovered ?? []);
    covered.add("id");
    const rest: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(entry)) {
        if (covered.has(k)) continue;
        if (v === undefined || v === null) continue;
        if (typeof v === "function") continue; 
        rest[k] = v;
    }
    return rest;
}


export function entryToForm(cat: Tab, entry: Record<string, unknown>): Record<string, string> {
    const form = formDefaults(cat);
    const e = entry ?? {};

    if (typeof e.id === "string") form.idSuffix = suffixOf(e.id, cat);

    definitionFor(cat)?.entryToForm?.(e, readerFor(form));

    // Anything the form does not cover rides along untouched, so editing an
    // entry never silently drops a key the editor happens not to know about.
    const rest = passthroughOf(cat, e);
    if (Object.keys(rest).length > 0) form.advancedJson = JSON.stringify(rest, null, 2);
    return form;
}


export function formToEntry(
    cat: Tab,
    form: Record<string, string>,
): Record<string, unknown> & { id?: string } {
    
    const entry: Record<string, unknown> = {
        ...(optJson<Record<string, unknown>>(form, "advancedJson") ?? {}),
    };
    
    
    
    
    const id = fullIdOf(form, cat);
    if (id) entry.id = id;

    definitionFor(cat)?.formToEntry?.(form, writerFor(form, entry));
    return entry;
}
