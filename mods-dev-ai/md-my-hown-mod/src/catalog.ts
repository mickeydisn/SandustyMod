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
    const opts = enumOpts("MatterType");
    if (opts.length) return opts;
    return [
        { value: "powder", label: "powder" },
        { value: "liquid", label: "liquid" },
        { value: "gas", label: "gas" },
        { value: "solid", label: "solid" },
        { value: "static", label: "static" },
        { value: "particle", label: "particle" },
        { value: "slushy", label: "slushy" },
        { value: "wisp", label: "wisp" },
    ];
}

export function listBuildModes(): Opt[] {
    const opts = enumOpts("BuildMode");
    if (opts.length) return opts;
    return [
        { value: "Linear", label: "Linear" },
        { value: "Rectangular", label: "Rectangular" },
    ];
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
