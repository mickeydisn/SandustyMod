/**
 * Thin wrappers around sandkit.api — full field forwarding for every register path.
 */
import {
    LOG,
    MOD_ID,
    type ElementConfig,
    type StructureConfig,
    type ItemConfig,
    type RecipeConfig,
    type ProcessingConfig,
    type ContactReactionConfig,
    type InteractionConfig,
} from "../constants.ts";

declare const sandkit: any;
const g = () => {
    try {
        if (typeof sandkit !== "undefined" && sandkit) return sandkit;
    } catch { /* */ }
    return (globalThis as any).sandkit ?? (globalThis as any).__sandkit;
};

export const api = {
    get raw() {
        return g()?.api;
    },
    get enums() {
        return g()?.enums;
    },
    get react() {
        return g()?.react;
    },
    toast(msg: string, opts?: Record<string, unknown>) {
        try {
            g()?.api?.ui?.toast?.(msg, opts ?? {});
        } catch { /* ignore */ }
    },
    storage: {
        ensure() {
            g()?.api?.storage?.ensure?.(MOD_ID);
        },
        get<T = unknown>(key: string, fallback?: T): T | undefined {
            try {
                g()?.api?.storage?.ensure?.(MOD_ID);
                const v = g()?.api?.storage?.get?.(MOD_ID, key);
                return (v === undefined || v === null) ? fallback : (v as T);
            } catch {
                return fallback;
            }
        },
        set(key: string, value: unknown) {
            try {
                g()?.api?.storage?.ensure?.(MOD_ID);
                g()?.api?.storage?.set?.(MOD_ID, key, value);
            } catch (e) {
                console.warn(`${LOG} storage.set failed`, key, e);
            }
        },
        remove(key: string) {
            try {
                g()?.api?.storage?.remove?.(MOD_ID, key);
            } catch { /* ignore */ }
        },
    },
    elements: {
        register(def: ElementConfig): { elementType?: number } | undefined {
            try {
                return g()?.api?.elements?.register?.(normalizeElement(def));
            } catch (e) {
                console.error(`${LOG} elements.register failed`, def.id, e);
                return undefined;
            }
        },
        updateDefinition(idOrType: string | number, partial: Record<string, unknown>) {
            try {
                g()?.api?.elements?.updateDefinition?.(idOrType, partial);
            } catch (e) {
                console.error(`${LOG} elements.updateDefinition failed`, e);
            }
        },
        addInteractionInfo(idOrType: string | number, interaction: unknown) {
            try {
                g()?.api?.elements?.addInteractionInfo?.(idOrType, interaction);
            } catch (e) {
                console.error(`${LOG} elements.addInteractionInfo failed`, e);
            }
        },
        getTypeFromId(id: string): number | undefined {
            try {
                return g()?.api?.elements?.getTypeFromId?.(id)
                    ?? g()?.api?.elements?.getTypeById?.(id);
            } catch {
                return undefined;
            }
        },
    },
    structures: {
        register(def: StructureConfig): void {
            try {
                const { registerOptions, ...body } = normalizeStructure(def);
                const opts = registerOptions ?? def.registerOptions;
                if (opts) {
                    g()?.api?.structures?.register?.(body, opts);
                } else {
                    g()?.api?.structures?.register?.(body);
                }
            } catch (e) {
                console.error(`${LOG} structures.register failed`, def.id, e);
            }
        },
        recipes: {
            register(structureType: string | number, recipe: Record<string, unknown>): void {
                try {
                    const st = resolveStructureType(structureType);
                    g()?.api?.structures?.recipes?.register?.(st, recipe);
                } catch (e) {
                    console.error(`${LOG} structures.recipes.register failed`, e);
                }
            },
        },
        processing: {
            register(structureType: string | number, def: Record<string, unknown>): void {
                try {
                    const st = resolveStructureType(structureType);
                    g()?.api?.structures?.processing?.register?.(st, def);
                } catch (e) {
                    console.error(`${LOG} structures.processing.register failed`, e);
                }
            },
        },
        addProcessor(structureId: string | number, def: Record<string, unknown>): void {
            try {
                g()?.api?.structures?.addProcessor?.(structureId, def);
            } catch (e) {
                console.error(`${LOG} structures.addProcessor failed`, e);
            }
        },
        addVariant(base: string | number, variant: unknown, options?: unknown): void {
            try {
                const fn = g()?.api?.structures?.addVariant ?? g()?.api?.structures?.registerVariant;
                fn?.(base, variant, options);
            } catch (e) {
                console.error(`${LOG} structures.addVariant failed`, e);
            }
        },
    },
    items: {
        register(def: ItemConfig): void {
            try {
                g()?.api?.items?.register?.(normalizeItem(def));
            } catch (e) {
                console.error(`${LOG} items.register failed`, def.id, e);
            }
        },
    },
    processing: {
        registerGrower(def: Record<string, unknown>): void {
            try {
                g()?.api?.processing?.registerGrower?.(def);
            } catch (e) {
                console.error(`${LOG} processing.registerGrower failed`, e);
            }
        },
        registerShaker(def: Record<string, unknown>): void {
            try {
                g()?.api?.processing?.registerShaker?.(def);
            } catch (e) {
                console.error(`${LOG} processing.registerShaker failed`, e);
            }
        },
        registerKineticPress(def: Record<string, unknown>): void {
            try {
                g()?.api?.processing?.registerKineticPress?.(def);
            } catch (e) {
                console.error(`${LOG} processing.registerKineticPress failed`, e);
            }
        },
    },
    reactions: {
        registerContact(def: Record<string, unknown>): void {
            try {
                g()?.api?.reactions?.registerContact?.(def);
            } catch (e) {
                console.error(`${LOG} reactions.registerContact failed`, e);
            }
        },
    },
    ui: {
        overlays: {
            register(zone: string, id: string, component: unknown, opts?: Record<string, unknown>) {
                try {
                    {
                        // API expects (zone, id, renderFn). If a component is passed, wrap it.
                        const React = g()?.react;
                        const render = typeof component === "function" && component.length === 0
                            ? component
                            : () => (React ? React.createElement(component as any) : null);
                        g()?.api?.ui?.overlays?.register?.(zone, id, render);
                    }
                } catch (e) {
                    console.error(`${LOG} ui.overlays.register failed`, id, e);
                }
            },
            unregister(zone: string, id: string) {
                try {
                    g()?.api?.ui?.overlays?.unregister?.(zone, id);
                } catch { /* ignore */ }
            },
        },
    },
    events: {
        on(name: string, cb: (...args: any[]) => void): (() => void) | void {
            try {
                return g()?.api?.events?.on?.(name, cb);
            } catch {
                return undefined;
            }
        },
    },
    i18n: {
        register(locale: string, map: Record<string, string>) {
            try {
                g()?.api?.i18n?.register?.(locale, map);
            } catch { /* ignore */ }
        },
    },
};

const MATTER_MAP: Record<string, number> = {
    solid: 1, liquid: 2, particle: 3, gas: 4, static: 5, slushy: 6, wisp: 7, powder: 8,
};

function resolveMatterType(v: string | number | undefined): number | undefined {
    if (v === undefined || v === null) return undefined;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
        const lower = v.toLowerCase();
        if (lower in MATTER_MAP) return MATTER_MAP[lower];
        const enums = g()?.enums?.MatterType;
        if (enums) {
            if (v in enums) return enums[v];
            const cap = v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
            if (cap in enums) return enums[cap];
        }
    }
    return MATTER_MAP.powder;
}

function resolveElementRef(v: string | number | null | undefined): string | number | null | undefined {
    if (v === null) return null;
    if (v === undefined) return undefined;
    if (typeof v === "number") return v;
    if (typeof v === "string") {
        const t = api.elements.getTypeFromId(v);
        return t !== undefined ? t : v;
    }
    return v;
}

function resolveStructureType(v: string | number): string | number {
    if (typeof v === "number") return v;
    const enums = g()?.enums?.StructureType;
    if (typeof v === "string" && enums && v in enums) return enums[v];
    return v;
}

function resolveItemType(v: string | number | undefined): number | string {
    if (typeof v === "number") return v;
    const enums = g()?.enums?.ItemType;
    if (typeof v === "string" && enums) {
        if (v in enums) return enums[v];
        const cap = v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
        if (cap in enums) return enums[cap];
    }
    return enums?.Mod ?? "Mod";
}

function registerI18n(map: Record<string, string>) {
    if (Object.keys(map).length) api.i18n.register("en", map);
}

function normalizeElement(def: ElementConfig): Record<string, unknown> {
    const id = String(def.id);
    const name = def.name ?? id;
    const nameKey = def.nameKey ?? `elements|${id}|name`;
    const out: Record<string, unknown> = { ...def, id, name, nameKey };
    const mt = resolveMatterType(def.matterType as string | number | undefined);
    if (mt !== undefined) out.matterType = mt;
    if (Array.isArray(def.colors)) {
        out.colors = { variants: def.colors };
    } else if (def.colors && typeof def.colors === "object") {
        out.colors = def.colors;
    }
    if (typeof def.getExtraProps !== "function") delete out.getExtraProps;
    if (def.description && !def.descriptionKey) {
        out.descriptionKey = `elements|${id}|description`;
    }
    const i18n: Record<string, string> = {};
    if (typeof name === "string") i18n[nameKey] = name;
    if (typeof def.description === "string") i18n[String(out.descriptionKey)] = def.description;
    registerI18n(i18n);
    return out;
}

function normalizeStructure(def: StructureConfig): Record<string, unknown> & {
    registerOptions?: { useRawShape?: boolean };
} {
    const id = String(def.id);
    const name = def.name ?? id;
    const nameKey = def.nameKey ?? `structures|${id}|name`;
    const out: Record<string, unknown> = {
        ...def, id, name, nameKey,
        categoryKey: def.categoryKey ?? "blocks",
        buildModes: def.buildModes ?? [{ type: "single" }],
        variants: def.variants ?? [{ id, angles: [0] }],
    };
    if (typeof def.draw !== "function") delete out.draw;
    if (def.description && !def.descriptionKey) {
        out.descriptionKey = `structures|${id}|description`;
    }
    const i18n: Record<string, string> = {};
    if (typeof name === "string") i18n[nameKey] = name;
    if (typeof def.description === "string") i18n[String(out.descriptionKey)] = def.description;
    registerI18n(i18n);
    const registerOptions = def.registerOptions;
    delete out.registerOptions;
    return { ...out, registerOptions };
}

function normalizeItem(def: ItemConfig): Record<string, unknown> {
    const id = String(def.id);
    const name = def.name ?? id;
    const nameKey = def.nameKey ?? `items|${id}|name`;
    const itemType = resolveItemType(def.itemType ?? def.type);
    const out: Record<string, unknown> = { ...def, id, name, nameKey, itemType, type: itemType };
    if (!out.sprite || typeof out.sprite !== "object" || !(out.sprite as any).id) {
        out.sprite = {
            id: `${id}-sprite`,
            type: (def.sprite as any)?.type ?? "onehand",
            ...(typeof def.sprite === "object" ? def.sprite : {}),
        };
        if (!(out.sprite as any).id) (out.sprite as any).id = `${id}-sprite`;
    }
    if (def.description && !def.descriptionKey) {
        out.descriptionKey = `items|${id}|description`;
    }
    const i18n: Record<string, string> = {};
    if (typeof name === "string") i18n[nameKey] = name;
    if (typeof def.description === "string") i18n[String(out.descriptionKey)] = def.description;
    registerI18n(i18n);
    return out;
}

function resolveRecipeBody(r: RecipeConfig): Record<string, unknown> {
    const body: Record<string, unknown> = { ...r };
    delete body.id;
    delete body.kind;
    delete body.structureType;
    body.input = resolveElementRef(body.input as any);
    body.output = resolveElementRef(body.output as any);
    const mapOut = (arr: unknown) => {
        if (!Array.isArray(arr)) return arr;
        return arr.map((o: any) => ({ ...o, elementType: resolveElementRef(o.elementType) }));
    };
    if (body.outputs) body.outputs = mapOut(body.outputs);
    if (body.outputsAbove) body.outputsAbove = mapOut(body.outputsAbove);
    if (body.outputsBelow) body.outputsBelow = mapOut(body.outputsBelow);
    return body;
}

export function registerRecipe(r: RecipeConfig): void {
    const kind = String(r.kind || "structure").toLowerCase().replace(/[_-]/g, "");
    const body = resolveRecipeBody(r);
    if (kind === "grower" || kind === "planterbox") {
        api.processing.registerGrower(body);
        return;
    }
    if (kind === "shaker") {
        api.processing.registerShaker(body);
        return;
    }
    if (kind === "kineticpress") {
        api.processing.registerKineticPress(body);
        return;
    }
    const st = r.structureType ?? r.kind;
    if (st) {
        api.structures.recipes.register(st as string | number, body);
    } else {
        console.warn(`${LOG} recipe ${r.id}: no structureType/kind target`);
    }
}

export function registerProcessing(p: ProcessingConfig): void {
    const mode = p.mode ?? (p.structureType ? "type" : "instance");
    const { id: _id, structureType, structureId, mode: _m, ...rest } = p;
    if (mode === "type") {
        const target = structureType ?? structureId;
        if (target === undefined) {
            console.warn(`${LOG} processing ${p.id}: missing structureType`);
            return;
        }
        if (typeof rest.process !== "function") {
            console.warn(`${LOG} processing ${p.id}: process() not a function (JSON cannot store callbacks). Skip.`);
            return;
        }
        api.structures.processing.register(target, rest);
        return;
    }
    const target = structureId ?? structureType;
    if (target === undefined) {
        console.warn(`${LOG} processing ${p.id}: missing structureId`);
        return;
    }
    if (typeof rest.process !== "function") {
        console.warn(`${LOG} processing ${p.id}: process() missing — skip addProcessor`);
        return;
    }
    api.structures.addProcessor(target, rest);
}

export function registerContact(c: ContactReactionConfig): void {
    api.reactions.registerContact({
        inputA: resolveElementRef(c.inputA),
        inputB: resolveElementRef(c.inputB),
        outputA: resolveElementRef(c.outputA),
        outputB: resolveElementRef(c.outputB),
        orientation: c.orientation,
    });
}

export function registerInteraction(ix: InteractionConfig): void {
    const el = resolveElementRef(ix.elementId);
    if (el === undefined || el === null) {
        console.warn(`${LOG} interaction ${ix.id}: bad elementId`);
        return;
    }
    api.elements.addInteractionInfo(el as string | number, ix.interaction);
}

// ── Extra register surfaces ────────────────────────────────────────────────

export function registerTerrain(def: import("../constants.ts").TerrainConfig): void {
    try {
        const id = String(def.id);
        const out: Record<string, unknown> = { ...def, id };
        if (def.name && !def.nameKey) out.nameKey = `terrains|${id}|name`;
        g()?.api?.terrains?.register?.(out);
    } catch (e) {
        console.error(`${LOG} terrains.register failed`, def.id, e);
    }
}

export function registerTech(def: import("../constants.ts").TechConfig): void {
    try {
        const id = String(def.id);
        const { parentId, preferredPosition, ...body } = def as any;
        const apiTech = g()?.api?.tech;
        if (!apiTech) return;
        if (typeof apiTech.registerDefinition === "function") {
            apiTech.registerDefinition(id, body);
        } else if (typeof apiTech.addDefinition === "function") {
            apiTech.addDefinition(id, body);
        }
        if (parentId != null && typeof apiTech.registerNode === "function") {
            try {
                apiTech.registerNode(id, body, { parentId, preferredPosition });
            } catch (e) {
                console.warn(`${LOG} tech.registerNode failed`, id, e);
            }
        }
    } catch (e) {
        console.error(`${LOG} tech.register failed`, def.id, e);
    }
}

export function registerUpgradeCategory(def: import("../constants.ts").UpgradeCategoryConfig): void {
    try {
        const { onUpgradeKey, id: _id, ...rest } = def as any;
        g()?.api?.upgrades?.registerCategory?.(rest);
    } catch (e) {
        console.error(`${LOG} upgrades.registerCategory failed`, def.id, e);
    }
}

export function registerUpgrade(def: import("../constants.ts").UpgradeConfig): void {
    try {
        const { onUpgradeKey, id: _id, ...rest } = def as any;
        g()?.api?.upgrades?.register?.(rest);
    } catch (e) {
        console.error(`${LOG} upgrades.register failed`, def.id, e);
    }
}

export function registerProjectile(def: import("../constants.ts").ProjectileConfig): void {
    try {
        const out: Record<string, unknown> = { ...def };
        // getOptions is required by engine — synthesize from static options if needed
        if (typeof out.getOptions !== "function") {
            const opts = def.options ?? {};
            out.getOptions = () => ({ ...opts });
        }
        if (!out.sprite || !(out.sprite as any).id) {
            out.sprite = { id: `${def.id}-sprite`, ...(def.sprite as object || {}) };
        }
        g()?.api?.projectiles?.register?.(out);
    } catch (e) {
        console.error(`${LOG} projectiles.register failed`, def.id, e);
    }
}

export function registerEnergyType(def: import("../constants.ts").EnergyTypeConfig): void {
    try {
        g()?.api?.energy?.registerType?.(def.structureId, def.type, def.options ?? {});
    } catch (e) {
        console.error(`${LOG} energy.registerType failed`, def.id, e);
    }
}

export function registerExcavationProfile(def: import("../constants.ts").ExcavationProfileConfig): void {
    try {
        const { id, power, pattern, options } = def;
        g()?.api?.excavation?.registerProfile?.(id, { power, pattern, options });
    } catch (e) {
        console.error(`${LOG} excavation.registerProfile failed`, def.id, e);
    }
}

export function registerStructureBehavior(def: import("../constants.ts").StructureBehaviorConfig): void {
    try {
        const api = g()?.api?.structureBehaviors;
        if (!api) {
            console.warn(`${LOG} structureBehaviors API missing`);
            return;
        }
        const kind = String(def.kind || "").toLowerCase();
        const payload = def.definition ?? def;
        if (kind === "conveyor" && typeof api.registerConveyor === "function") {
            api.registerConveyor(payload);
        } else if (kind === "launcher" && typeof api.registerLauncher === "function") {
            api.registerLauncher(payload);
        } else if (typeof api.register === "function") {
            api.register(payload);
        } else {
            // best-effort: try both common names
            api.registerConveyor?.(payload);
            api.registerLauncher?.(payload);
            console.warn(`${LOG} structureBehaviors: forwarded generically for`, def.id);
        }
    } catch (e) {
        console.error(`${LOG} structureBehaviors failed`, def.id, e);
    }
}

export function registerSignal(def: import("../constants.ts").SignalConfig, handler?: Function): void {
    try {
        const kind = String(def.kind || "targets").toLowerCase();
        const sig = g()?.api?.signals;
        if (!sig) return;
        if (!handler) {
            console.warn(`${LOG} signal ${def.id}: no handler — stored only`);
            return;
        }
        if (kind === "targets") {
            sig.targets?.register?.(def.target, handler);
        } else if (kind === "interactables") {
            sig.interactables?.register?.(def.target, handler);
        } else if (kind === "sendertype" || kind === "sender") {
            sig.registerSenderType?.(def.target, handler);
        } else {
            console.warn(`${LOG} signal ${def.id}: unknown kind ${def.kind}`);
        }
    } catch (e) {
        console.error(`${LOG} signals.register failed`, def.id, e);
    }
}

export function registerTrigger(def: import("../constants.ts").TriggerConfig, handler?: Function): void {
    try {
        const tid = def.triggerId || def.id;
        if (!handler) {
            console.warn(`${LOG} trigger ${def.id}: no handler — stored only`);
            return;
        }
        g()?.api?.triggers?.register?.(tid, {
            interval: def.interval ?? 60,
            sequentialRuns: def.sequentialRuns ?? 1,
            extra: def.extra ?? {},
            callback: handler,
        });
    } catch (e) {
        console.error(`${LOG} triggers.register failed`, def.id, e);
    }
}

export async function registerSprite(def: import("../constants.ts").SpriteConfig): Promise<void> {
    try {
        const sprites = g()?.api?.sprites;
        if (!sprites) return;
        const opts = def.options ?? {};
        if (def.path && (def.fromMod !== false)) {
            await sprites.loadFromMod?.(def.id, def.path, opts);
        } else if (def.source || def.path) {
            await sprites.load?.(def.id, def.source ?? def.path, opts);
        } else {
            console.warn(`${LOG} sprite ${def.id}: need path or source`);
        }
    } catch (e) {
        console.error(`${LOG} sprites.load failed`, def.id, e);
    }
}
