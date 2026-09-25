/**
 * Live catalogues for form pickers: game registries + this mod's stored config.
 */
import { api, getSandkit, safe } from "./api.ts";
import { loadConfig } from "./config/store.ts";

export type Opt = { value: string; label: string; color?: string };

function sk(): any {
    return getSandkit();
}

function enumOpts(name: string): Opt[] {
    const e = sk()?.enums?.[name];
    if (!e || typeof e !== "object") return [];
    const out: Opt[] = [];
    for (const [k, v] of Object.entries(e)) {
        if (typeof k === "string" && Number.isNaN(Number(k))) {
            out.push({ value: String(v), label: `${k} (${v})` });
        }
    }
    return out.sort((a, b) => a.label.localeCompare(b.label));
}

function colorFromMeta(meta: unknown): string | undefined {
    if (typeof meta === "number" && Number.isFinite(meta)) {
        const rgb = meta > 0xffffff ? (meta >>> 0) & 0xffffff : meta & 0xffffff;
        return `#${rgb.toString(16).padStart(6, "0")}`;
    }
    if (typeof meta === "string" && /^#?[0-9a-fA-F]{6}/.test(meta)) {
        return meta.startsWith("#") ? meta.slice(0, 7) : `#${meta.slice(0, 6)}`;
    }
    return undefined;
}

/** All known element ids (vanilla + mods + our config). */
export function listElements(): Opt[] {
    const map = new Map<string, Opt>();

    // From live registry
    const types = safe(() => api.elements?.getRegisteredTypes?.(), []) ?? [];
    for (const t of types as any[]) {
        const def = safe(() => api.elements?.getDefinitionByType?.(t)) as any;
        const id =
            def?.id ??
            safe(() => api.elements?.getIdByType?.(t)) ??
            safe(() => api.elements?.getIdFromType?.(t)) ??
            String(t);
        const name =
            safe(() => api.elements?.getNameByType?.(t)) ??
            def?.name ??
            def?.nameKey ??
            id;
        map.set(String(id), {
            value: String(id),
            label: String(name),
            color: colorFromMeta(def?.metaColor),
        });
    }

    // Enum ElementType names as fallbacks
    for (const o of enumOpts("ElementType")) {
        if (!map.has(o.value)) {
            // also try lowercase name
            const name = o.label.split(" ")[0];
            map.set(name.toLowerCase(), { value: name.toLowerCase(), label: o.label });
        }
    }

    // Our stored config
    for (const el of loadConfig().elements ?? []) {
        if (el?.id) {
            map.set(el.id, {
                value: el.id,
                label: `${el.name || el.id} (config)`,
                color: typeof el.metaColor === "string" ? el.metaColor : colorFromMeta(el.metaColor),
            });
        }
    }

    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function listStructures(): Opt[] {
    const map = new Map<string, Opt>();

    // Try common discovery APIs
    const tryList = [
        () => api.structures?.getRegisteredTypes?.(),
        () => api.structures?.getAvailableTypes?.(),
        () => api.structures?.getUnlockedTypes?.(),
        () => api.structures?.getAll?.(),
    ];
    for (const fn of tryList) {
        const raw = safe(fn as any);
        if (!raw) continue;
        const arr = Array.isArray(raw) ? raw : raw instanceof Set ? [...raw] : [];
        for (const t of arr) {
            const def = safe(() => api.structures?.getDefinitionByType?.(t)) as any;
            const id =
                def?.id ??
                safe(() => api.structures?.getIdByType?.(t)) ??
                safe(() => api.structures?.getTypeName?.(t)) ??
                String(t);
            const name = def?.name ?? def?.nameKey ?? id;
            map.set(String(id), { value: String(id), label: String(name) });
        }
    }

    for (const o of enumOpts("StructureType")) {
        const name = o.label.split(" ")[0];
        if (![...map.keys()].some((k) => k === name || k === o.value)) {
            map.set(name, { value: name, label: o.label });
        }
    }

    for (const st of loadConfig().structures ?? []) {
        if (st?.id) {
            map.set(st.id, { value: st.id, label: `${st.name || st.id} (config)` });
        }
    }

    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function listItems(): Opt[] {
    const map = new Map<string, Opt>();
    const tryList = [
        () => api.items?.getRegistered?.(),
        () => api.items?.getAll?.(),
        () => api.items?.list?.(),
    ];
    for (const fn of tryList) {
        const raw = safe(fn as any);
        if (!raw) continue;
        const arr = Array.isArray(raw) ? raw : typeof raw === "object" ? Object.keys(raw) : [];
        for (const entry of arr) {
            if (typeof entry === "string") {
                map.set(entry, { value: entry, label: entry });
            } else if (entry && typeof entry === "object") {
                const id = (entry as any).id ?? String(entry);
                map.set(String(id), { value: String(id), label: (entry as any).name ?? id });
            }
        }
    }
    for (const o of enumOpts("ItemId")) {
        const name = o.label.split(" ")[0];
        map.set(name, { value: name, label: o.label });
    }
    for (const it of loadConfig().items ?? []) {
        if (it?.id) map.set(it.id, { value: it.id, label: `${it.name || it.id} (config)` });
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function listTerrains(): Opt[] {
    const map = new Map<string, Opt>();
    // Enum / known terrains
    for (const o of enumOpts("CellType")) {
        const name = o.label.split(" ")[0];
        map.set(name, { value: name, label: o.label });
    }
    for (const t of loadConfig().terrains ?? []) {
        if (t?.id) map.set(t.id, { value: t.id, label: `${t.name || t.id} (config)` });
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function listMatterTypes(): Opt[] {
    // Static lowercase names: resolveMatterType() maps them to MatterType numbers.
    // (Numeric enum strings do NOT resolve reliably — keep values lowercase.)
    return [
        { value: "solid", label: "Solid (1)" },
        { value: "liquid", label: "Liquid (2)" },
        { value: "particle", label: "Particle (3)" },
        { value: "gas", label: "Gas (4)" },
        { value: "static", label: "Static (5)" },
        { value: "slushy", label: "Slushy (6)" },
        { value: "wisp", label: "Wisp (7)" },
        { value: "powder", label: "Powder (8)" },
    ];
}

/**
 * Engine build-mode types (structures.register → buildModes[].type).
 * Verified in doc/doc-artifacts/doc.api/definitions/api.structures.definition.md
 */
export const BUILD_MODE_TYPES = [
    "single",
    "singleDirectional",
    "line",
    "rectangle",
    "rectangleDirectional",
    "launcherRectUp",
    "launcherRectSide",
] as const;

export function listBuildModeTypes(): Opt[] {
    return BUILD_MODE_TYPES.map((v) => ({ value: v, label: v }));
}

/** Legacy alias (kept so old imports keep working). */
export function listBuildModes(): Opt[] {
    return listBuildModeTypes();
}

/**
 * Built-in build-menu categories (engine list `LR`, doc-tech/13).
 * Free-form strings are allowed by the engine, but these 20 get localized labels.
 */
export const STRUCTURE_CATEGORIES = [
    "misc", "logic", "blocks", "testBlocks", "construction", "debug", "drones",
    "energy", "excavation", "logistics", "production", "tools", "transportation",
    "utility", "weapons", "economy", "fluids", "thermal", "lighting", "special",
] as const;

export function listStructureCategories(): Opt[] {
    return [...STRUCTURE_CATEGORIES].map((v) => ({ value: v, label: v }));
}

/**
 * The ONLY ids accepted by api.structures.recipes.register — anything else throws
 * "Structure recipe ID \"…\" is not supported." (doc/api/shared/api.recipes.md)
 */
export const RECIPE_MACHINES = [
    "planterBox", "shaker", "kineticPress", "condenser",
    "steamDryer", "synthesizer", "snowmaker", "smelter",
] as const;

export function listRecipeMachines(): Opt[] {
    return [
        { value: "planterBox", label: "Planter box / grower" },
        { value: "shaker", label: "Shaker (above / below)" },
        { value: "kineticPress", label: "Kinetic press (velocity)" },
        { value: "condenser", label: "Condenser" },
        { value: "steamDryer", label: "Steam dryer" },
        { value: "synthesizer", label: "Synthesizer" },
        { value: "snowmaker", label: "Snowmaker" },
        { value: "smelter", label: "Smelter" },
    ];
}

/** Contact-reaction orientation (reactions.registerContact). */
export function listContactOrientation(): Opt[] {
    return [
        { value: "any", label: "any — touch in any arrangement" },
        { value: "stacked", label: "stacked — vertical only" },
    ];
}

/**
 * Documented interceptable hooks (doc-tech/03-hooks-reference.md) + "custom".
 * Restrictive by default: users pick a real hook instead of typing anything.
 */
export const HOOK_IDS = [
    "element:move",
    "element:blocked",
    "element:move:blocked",
    "element:update",
    "element:duration",
    "element:duration:expire",
    "cell:process",
    "fire:element:burn",
    "fire:element:ignite",
    "building:place",
    "projectile:hit",
    "teleport:effect",
] as const;

export function listHookIds(): Opt[] {
    return [
        ...HOOK_IDS.map((v) => ({ value: v, label: v })),
        { value: "__custom__", label: "custom hook id (type below)" },
    ];
}

/** Sprites known to the game + this mod's config. */
export function listSpriteIds(): Opt[] {
    const map = new Map<string, Opt>();
    const tryList = [
        () => api.sprites?.getLoaded?.(),
        () => api.sprites?.getAll?.(),
        () => api.sprites?.list?.(),
        () => api.sprites?.getRegistered?.(),
    ];
    for (const fn of tryList) {
        const raw = safe(fn as any);
        if (!raw) continue;
        const arr = Array.isArray(raw) ? raw : typeof raw === "object" ? Object.keys(raw) : [];
        for (const entry of arr) {
            if (typeof entry === "string") map.set(entry, { value: entry, label: entry });
            else if (entry && typeof entry === "object") {
                const id = String((entry as any).id ?? "");
                if (id) map.set(id, { value: id, label: id });
            }
        }
    }
    for (const sp of loadConfig().sprites ?? []) {
        if (sp?.id) map.set(sp.id, { value: sp.id, label: `${sp.id} (config)` });
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Structure ids for processing / signals / energy targets (live + config). */
export function listStructureIds(): Opt[] {
    return listStructures();
}

/** Element ids + a "∅ consume (null)" sentinel — used by contact outputs. */
export function listOutputTargets(): Opt[] {
    return [{ value: "__null__", label: "∅ consume (null)" }, ...listElements()];
}

/** Code handlers usable as generic callbacks (signals, triggers, projectiles…). */
export function listAnyHandlerKeys(): Opt[] {
    try {
        const m = (globalThis as any).__mdHandlers;
        if (m?.listAnyHandlerKeys) {
            return m.listAnyHandlerKeys().map((k: string) => ({ value: k, label: k }));
        }
    } catch { /* */ }
    return listHandlerKeys();
}

/** Code handlers wired as structures.processing `process(structure, context)`. */
export function listProcessorKeys(): Opt[] {
    try {
        const m = (globalThis as any).__mdHandlers;
        if (m?.listProcessorKeys) {
            return m.listProcessorKeys().map((k: string) => ({ value: k, label: k }));
        }
    } catch { /* */ }
    return [{ value: "processorLog", label: "processorLog" }, { value: "processorNoop", label: "processorNoop" }];
}

export function listRecipeKinds(): Opt[] {
    return [
        { value: "shaker", label: "Shaker" },
        { value: "kineticPress", label: "Kinetic press" },
        { value: "grower", label: "Grower / planter" },
        { value: "smelter", label: "Smelter" },
        { value: "condenser", label: "Condenser" },
        { value: "steamDryer", label: "Steam dryer" },
        { value: "synthesizer", label: "Synthesizer" },
        { value: "snowmaker", label: "Snowmaker" },
        { value: "generic", label: "Generic / structure recipe" },
    ];
}

export function listProcessingKinds(): Opt[] {
    return [
        { value: "structure", label: "Structure processor" },
        { value: "filter", label: "Filter" },
        { value: "velociumCollector", label: "Velocium collector" },
        { value: "generic", label: "Generic" },
    ];
}

export function listHookKinds(): Opt[] {
    return [
        { value: "intercept", label: "intercept (observe)" },
        { value: "modify", label: "modify (transform)" },
    ];
}

export function listSignalKinds(): Opt[] {
    return [
        { value: "targets", label: "Signal target" },
        { value: "interactables", label: "Interactable structure" },
        { value: "senderType", label: "Sender type" },
    ];
}

export function listHandlerKeys(): Opt[] {
    try {
        const m = (globalThis as any).__mdHandlers;
        if (m?.listHandlerKeys) {
            return m.listHandlerKeys().map((k: string) => ({ value: k, label: k }));
        }
    } catch { /* */ }
    return [
        { value: "logArgs", label: "logArgs" },
        { value: "identity", label: "identity" },
        { value: "signalLog", label: "signalLog" },
        { value: "triggerLog", label: "triggerLog" },
        { value: "noop", label: "noop" },
        { value: "defaultProjectileOptions", label: "defaultProjectileOptions" },
    ];
}

export function listCurrencyTypes(): Opt[] {
    return [
        { value: "gold", label: "gold" },
        { value: "auralite", label: "auralite" },
        { value: "artifact", label: "artifact" },
        { value: "ticket", label: "ticket" },
        { value: "energy", label: "energy" },
    ];
}

export function listTechBranches(): Opt[] {
    return [
        { value: "refining", label: "refining" },
        { value: "logistics", label: "logistics" },
        { value: "exploration", label: "exploration" },
        { value: "excavation", label: "excavation" },
        { value: "alien", label: "alien" },
        { value: "tools", label: "tools" },
        { value: "heat", label: "heat" },
        { value: "electricity", label: "electricity" },
        { value: "lighting", label: "lighting" },
        { value: "fluids", label: "fluids" },
    ];
}

export type FieldType = "text" | "number" | "select" | "color" | "bool" | "textarea";

export type FieldDef = {
    key: string;
    label: string;
    type: FieldType;
    /** Options for select, or a function that returns them (live). */
    options?: Opt[] | (() => Opt[]);
    placeholder?: string;
    hint?: string;
};

export function fieldsForTab(tab: string): FieldDef[] {
    const el = () => listElements();
    const st = () => listStructures();
    const it = () => listItems();

    switch (tab) {
        case "elements":
            return [
                { key: "name", label: "Display name", type: "text", placeholder: "My Powder" },
                { key: "description", label: "Description", type: "text" },
                { key: "matterType", label: "Matter type", type: "select", options: listMatterTypes },
                { key: "density", label: "Density", type: "number", placeholder: "10" },
                { key: "metaColor", label: "Color", type: "color" },
                { key: "bodyJson", label: "Extra JSON (advanced)", type: "textarea", hint: "Optional extra fields merged on save" },
            ];
        case "structures":
            return [
                { key: "name", label: "Display name", type: "text" },
                { key: "description", label: "Description", type: "text" },
                { key: "buildMode", label: "Build mode", type: "select", options: listBuildModes },
                { key: "shapeJson", label: "Shape (JSON grid)", type: "textarea", placeholder: "[[1,1],[1,1]]", hint: "2D array of cells" },
                { key: "bodyJson", label: "Extra JSON (advanced)", type: "textarea" },
            ];
        case "items":
            return [
                { key: "name", label: "Display name", type: "text" },
                { key: "description", label: "Description", type: "text" },
                { key: "itemType", label: "Item type", type: "select", options: [
                    { value: "tool", label: "tool" },
                    { value: "weapon", label: "weapon" },
                    { value: "building", label: "building" },
                    { value: "mod", label: "mod" },
                ] },
                { key: "spriteId", label: "Sprite id", type: "text", hint: "Must match a loaded sprite" },
                { key: "bodyJson", label: "Extra JSON (advanced)", type: "textarea" },
            ];
        case "recipes":
            return [
                { key: "kind", label: "Recipe kind", type: "select", options: listRecipeKinds },
                { key: "structureId", label: "Structure", type: "select", options: st, hint: "Machine that runs this recipe" },
                { key: "inputElement", label: "Input element", type: "select", options: el },
                { key: "outputElement", label: "Output element", type: "select", options: el },
                { key: "outputChance", label: "Output chance (0–1)", type: "number", placeholder: "1" },
                { key: "bodyJson", label: "Extra JSON (advanced)", type: "textarea", hint: "Full recipe payload overrides" },
            ];
        case "processing":
            return [
                { key: "kind", label: "Processing kind", type: "select", options: listProcessingKinds },
                { key: "structureId", label: "Structure", type: "select", options: st },
                { key: "bodyJson", label: "Options JSON (advanced)", type: "textarea" },
            ];
        case "contacts":
            return [
                { key: "elementA", label: "Element A", type: "select", options: el },
                { key: "elementB", label: "Element B", type: "select", options: el },
                { key: "resultElement", label: "Result element", type: "select", options: el },
                { key: "chance", label: "Chance (0–1)", type: "number", placeholder: "1" },
                { key: "bodyJson", label: "Extra JSON (advanced)", type: "textarea" },
            ];
        case "interactions":
            return [
                { key: "elementId", label: "Target element", type: "select", options: el },
                { key: "bodyJson", label: "Interaction descriptor JSON", type: "textarea", hint: "Passed to elements.addInteractionInfo" },
            ];
        case "modifiers":
            return [
                { key: "hookId", label: "Hook id", type: "text", placeholder: "e.g. building:placed", hint: "Engine hook point name" },
                { key: "kind", label: "Kind", type: "select", options: listHookKinds },
                { key: "handlerKey", label: "Handler", type: "select", options: listHandlerKeys },
                { key: "enabled", label: "Enabled", type: "bool" },
                { key: "notes", label: "Notes", type: "text" },
            ];
        case "terrains":
            return [
                { key: "name", label: "Display name", type: "text" },
                { key: "hp", label: "HP", type: "number" },
                { key: "metaColor", label: "Color", type: "color" },
                { key: "outputElement", label: "Dig output element", type: "select", options: el },
                { key: "bodyJson", label: "Extra JSON (advanced)", type: "textarea" },
            ];
        case "techs":
            return [
                { key: "name", label: "Display name", type: "text" },
                { key: "cost", label: "Cost", type: "number" },
                { key: "currencyType", label: "Currency", type: "select", options: listCurrencyTypes },
                { key: "branch", label: "Branch", type: "select", options: listTechBranches },
                { key: "bodyJson", label: "Extra JSON (advanced)", type: "textarea" },
            ];
        case "upgrades":
            return [
                { key: "itemId", label: "Item", type: "select", options: it },
                { key: "categoryId", label: "Category id", type: "text", placeholder: "tools" },
                { key: "bodyJson", label: "Upgrade payload JSON", type: "textarea", hint: "{ id, maxLevel, costs: [] }" },
            ];
        case "projectiles":
            return [
                { key: "spriteId", label: "Sprite id", type: "text" },
                { key: "getOptionsKey", label: "getOptions handler", type: "select", options: listHandlerKeys },
                { key: "bodyJson", label: "Extra JSON (advanced)", type: "textarea" },
            ];
        case "energy":
            return [
                { key: "structureId", label: "Structure", type: "select", options: st },
                { key: "type", label: "Energy type", type: "select", options: [
                    { value: "storage", label: "storage" },
                    { value: "producer", label: "producer" },
                    { value: "consumer", label: "consumer" },
                ] },
                { key: "bodyJson", label: "Options JSON", type: "textarea" },
            ];
        case "excavation":
            return [
                { key: "power", label: "Power (0–1000)", type: "number" },
                { key: "patternJson", label: "Pattern (square grid JSON)", type: "textarea", placeholder: "[[1,1],[1,1]]" },
                { key: "bodyJson", label: "Options JSON", type: "textarea" },
            ];
        case "behaviors":
            return [
                { key: "kind", label: "Kind", type: "select", options: [
                    { value: "conveyor", label: "conveyor" },
                    { value: "launcher", label: "launcher" },
                ] },
                { key: "bodyJson", label: "Definition JSON", type: "textarea" },
            ];
        case "signals":
            return [
                { key: "kind", label: "Kind", type: "select", options: listSignalKinds },
                { key: "target", label: "Target structure / type", type: "select", options: st },
                { key: "handlerKey", label: "Handler", type: "select", options: listHandlerKeys },
            ];
        case "triggers":
            return [
                { key: "interval", label: "Interval (ticks)", type: "number", placeholder: "60" },
                { key: "handlerKey", label: "Handler", type: "select", options: listHandlerKeys },
                { key: "bodyJson", label: "Extra payload JSON", type: "textarea" },
            ];
        case "sprites":
            return [
                { key: "path", label: "Path in mod folder", type: "text", placeholder: "assets/icon.png" },
                { key: "fromMod", label: "Load from mod folder", type: "bool" },
            ];
        default:
            return [];
    }
}
