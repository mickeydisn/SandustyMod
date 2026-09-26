/**
 * Thin wrappers around sandkit.api — full field forwarding for every register path.
 */
import {
    type ContactReactionConfig,
    type ElementConfig,
    type InteractionConfig,
    type ItemConfig,
    LOG,
    MOD_ID,
    type ProcessingConfig,
    type RecipeConfig,
    type StructureConfig,
} from "../constants.ts";
import { resolveAnyHandler } from "../hooks/handlers.ts";

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
        /**
         * Resolve an element id to its numeric type.
         *
         * The engine spells this `getTypeById`; `getTypeFromId` is the
         * `@deprecated` spelling kept for older builds. The current name is
         * tried first, so a build that drops the old one still works.
         */
        getTypeById(id: string): number | undefined {
            try {
                return g()?.api?.elements?.getTypeById?.(id) ??
                    g()?.api?.elements?.getTypeFromId?.(id);
            } catch {
                return undefined;
            }
        },
        /** @deprecated kept for callers written against the old name. */
        getTypeFromId(id: string): number | undefined {
            return this.getTypeById(id);
        },
    },
    /**
     * The only route from a mod structure into the build menu.
     *
     * The build menu lists `player.buildings`, and the engine reads
     * `alwaysUnlocked` in exactly one place — iterating a `const` literal of the
     * *vanilla* structures (bundel.js 5251.js, `Ue`) that nothing ever writes to.
     * A mod-registered id never enters it, so the flag on its own is inert and
     * this call is what actually puts a structure in front of the player.
     *
     * Proxied defensively: `player` is a main-thread API and may be absent when
     * the mod loads in a worker, and a missing unlock is not worth an exception.
     */
    player: {
        buildings: {
            /**
             * Returns whether the engine call actually happened.
             *
             * The proxy exists whether or not the underlying API does, so a void
             * return would let a missing engine API look like a successful unlock —
             * the same silent no-op that made this bug hard to find in the first
             * place. `apply.ts` uses this to warn once instead.
             */
            unlockByType(structureId: string): boolean {
                try {
                    const fn = g()?.api?.player?.buildings?.unlockByType;
                    if (typeof fn !== "function") return false;
                    fn(structureId);
                    return true;
                } catch (e) {
                    console.error(`${LOG} player.buildings.unlockByType failed`, structureId, e);
                    return false;
                }
            },
            /**
             * Undo an unlock. This is what makes gating *retractable*.
             *
             * A structure that was force-unlocked on an earlier apply is still in
             * `player.buildings` after the author ticks "Unlocked by", so without
             * this the gate would not take effect until the game was reloaded —
             * the change would look like it had been ignored. Best-effort: on a
             * fresh game the id is not in the list and this is a no-op.
             */
            removeById(structureId: string): boolean {
                try {
                    const fn = g()?.api?.player?.buildings?.removeById;
                    if (typeof fn !== "function") return false;
                    fn(structureId);
                    return true;
                } catch (e) {
                    console.error(`${LOG} player.buildings.removeById failed`, structureId, e);
                    return false;
                }
            },
        },
    },
    structures: {
        /** Patch a registered structure in place (api.structures.updateDefinition). */
        updateDefinition(
            idOrType: string | number,
            partial: Record<string, unknown>,
            options?: { useRawShape?: boolean },
        ): void {
            try {
                g()?.api?.structures?.updateDefinition?.(idOrType, partial, options);
            } catch (e) {
                console.error(`${LOG} structures.updateDefinition failed`, idOrType, e);
            }
        },
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
        addVariant(base: string | number, variant: unknown, options?: unknown): void {
            try {
                const fn = g()?.api?.structures?.addVariant ??
                    g()?.api?.structures?.registerVariant;
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
        /** Patch a registered item in place (api.items.updateDefinition). */
        updateDefinition(idOrType: string | number, partial: Record<string, unknown>): void {
            try {
                g()?.api?.items?.updateDefinition?.(idOrType, partial);
            } catch (e) {
                console.error(`${LOG} items.updateDefinition failed`, idOrType, e);
            }
        },
    },
    /** Patch a registered definition in place. */
    tech: {
        updateDefinition(id: string, partial: Record<string, unknown>): void {
            try {
                g()?.api?.tech?.updateDefinition?.(id, partial);
            } catch (e) {
                console.error(`${LOG} tech.updateDefinition failed`, id, e);
            }
        },
    },
    terrains: {
        updateDefinition(idOrType: string | number, partial: Record<string, unknown>): void {
            try {
                g()?.api?.terrains?.updateDefinition?.(idOrType, partial);
            } catch (e) {
                console.error(`${LOG} terrains.updateDefinition failed`, idOrType, e);
            }
        },
    },
    upgrades: {
        updateDefinition(
            itemId: string,
            upgradeId: string,
            partial: Record<string, unknown>,
        ): void {
            try {
                g()?.api?.upgrades?.updateDefinition?.(itemId, upgradeId, partial);
            } catch (e) {
                console.error(`${LOG} upgrades.updateDefinition failed`, itemId, upgradeId, e);
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
    solid: 1,
    liquid: 2,
    particle: 3,
    gas: 4,
    static: 5,
    slushy: 6,
    wisp: 7,
    powder: 8,
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

function resolveElementRef(
    v: string | number | null | undefined,
): string | number | null | undefined {
    if (v === null) return null;
    if (v === undefined) return undefined;
    if (typeof v === "number") return v;
    if (typeof v === "string") {
        // `getTypeFromId` is marked `@deprecated` in favour of `getTypeById`, and
        // this was a *direct* call — not optional-chained — so a rename would
        // have thrown here. The facade tries the current name first and keeps
        // the old one as a fallback for older builds.
        const t = api.elements.getTypeById?.(v);
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

/**
 * Resolve a stored terrain id to its numeric cell type when the runtime knows it.
 *
 * `terrainRules[].cellType` is a `TerrainRef = TerrainType | TerrainId`, so a plain
 * string id is already accepted — we only upgrade it to a numeric handle when we
 * can, and otherwise pass the id through unchanged.
 */
function resolveTerrainRef(
    v: string | number | null | undefined,
): string | number | null | undefined {
    if (v === null || v === undefined) return v;
    if (typeof v === "number") return v;
    const t = g()?.api?.terrains?.getTypeById?.(v);
    return t !== undefined && t !== null ? t : v;
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

/** ItemType.Consumable — labelled in the hotbar but never given a use action. */
function isConsumableType(v: string | number | undefined): boolean {
    if (v === "Consumable" || v === "consumable") return true;
    if (typeof v === "number") return v === g()?.enums?.ItemType?.Consumable;
    return false;
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
        ...def,
        id,
        name,
        nameKey,
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
    const isConsumable = isConsumableType(def.itemType ?? def.type);
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

    // `handleAction` is a real slot on ItemDefinition ("Handles item use
    // actions"), but it is a *function* — JSON can only name one, so resolve the
    // stored handlerKey here. A Consumable is skipped on purpose: ItemType has a
    // Consumable member but ActionType does not, so the engine can never
    // dispatch a use action to one.
    const handlerKey = typeof def.handlerKey === "string" ? def.handlerKey : "";
    if (handlerKey && !isConsumable) {
        const fn = resolveAnyHandler(handlerKey);
        if (typeof fn === "function") {
            out.handleAction = fn;
            // Keep the name in the payload for the panel's "used by" scan.
            out.handlerKey = handlerKey;
            out.options = {
                ...(typeof def.options === "object" ? def.options : {}),
                itemId: id,
                itemType: def.itemType ?? "Mod",
            };
        } else {
            console.warn(
                `[md-my-hown-mod] item ${id}: unknown handlerKey "${handlerKey}" — registering without a use action`,
            );
        }
    } else if (handlerKey) {
        delete out.handlerKey;
        delete out.options;
    }

    const i18n: Record<string, string> = {};
    if (typeof name === "string") i18n[nameKey] = name;
    if (typeof def.description === "string") i18n[String(out.descriptionKey)] = def.description;
    registerI18n(i18n);
    return out;
}

/** The 8 machine ids accepted by api.structures.recipes.register. */
const RECIPE_MACHINES = new Set([
    "planterBox",
    "shaker",
    "kineticPress",
    "condenser",
    "steamDryer",
    "synthesizer",
    "snowmaker",
    "smelter",
]);

/**
 * Shape the recipe body exactly like the machine expects
 * (doc/doc-artifacts/doc.api/shared/api.recipes.md):
 *   planterBox   → { input, output, chance? }
 *   shaker       → { input, outputsAbove[], outputsBelow[] }
 *   kineticPress → { input, minimumDownwardVelocity, outputs[] }
 *   others       → { input, outputs[] }
 */
function resolveRecipeBody(r: RecipeConfig, machine: string): Record<string, unknown> {
    const body: Record<string, unknown> = { ...r };
    delete body.id;
    delete body.kind;
    delete body.structureType;
    delete body.structureId;
    delete body.chance;

    const mapOut = (arr: unknown) => {
        if (!Array.isArray(arr)) return [];
        return arr
            .filter((o) => o && typeof o === "object")
            .map((o: any) => ({
                elementType: resolveElementRef(o.elementType),
                chance: typeof o.chance === "number" ? o.chance : 1,
            }));
    };

    body.input = resolveElementRef(body.input as any);

    if (machine === "planterBox") {
        body.output = resolveElementRef(body.output as any);
        const ch = Number((r as any).chance);
        if (Number.isFinite(ch)) body.chance = ch;
        delete body.outputs;
        delete body.outputsAbove;
        delete body.outputsBelow;
        delete body.minimumDownwardVelocity;
        return body;
    }
    if (machine === "shaker") {
        delete body.output;
        delete body.outputs;
        delete body.minimumDownwardVelocity;
        body.outputsAbove = mapOut((body as any).outputsAbove);
        body.outputsBelow = mapOut((body as any).outputsBelow);
        return body;
    }

    delete body.output;
    delete body.outputsAbove;
    delete body.outputsBelow;
    body.outputs = mapOut((body as any).outputs);
    if (machine === "kineticPress") {
        const mv = Number((body as any).minimumDownwardVelocity);
        body.minimumDownwardVelocity = Number.isFinite(mv) && mv >= 0 ? mv : 0;
    } else {
        delete body.minimumDownwardVelocity;
    }
    return body;
}

export function registerRecipe(r: RecipeConfig): void {
    let machine = String(r.kind || "structure");
    if (machine === "grower" || machine === "planter") machine = "planterBox";
    if (!RECIPE_MACHINES.has(machine)) {
        machine = String(r.structureType ?? r.structureId ?? machine);
    }
    if (!RECIPE_MACHINES.has(machine)) {
        console.warn(
            `${LOG} recipe ${r.id}: "${r.kind}" is not a supported machine id ` +
                `(use one of: ${[...RECIPE_MACHINES].join(", ")})`,
        );
        return;
    }
    const body = resolveRecipeBody(r, machine);
    api.structures.recipes.register(machine, body);
}

export function registerProcessing(p: ProcessingConfig): void {
    // handlerKey is a UI/code concern — never forward it to the engine.
    // The engine definition is `{ structureType, intervalMs, process }`; there is
    // no per-instance registration, so `structures.addProcessor` is not a real API
    // and is no longer called.
    const { id: _id, structureType, structureId, mode: _m, handlerKey: _hk, ...rest } = p as
        & Record<string, unknown>
        & ProcessingConfig;
    // `structureId` is accepted as a legacy alias for `structureType`.
    const target = structureType ?? structureId;
    if (target === undefined) {
        console.warn(`${LOG} processing ${p.id}: missing structureType`);
        return;
    }
    if (typeof rest.process !== "function") {
        console.warn(
            `${LOG} processing ${p.id}: process() not a function (JSON cannot store callbacks). Skip.`,
        );
        return;
    }
    api.structures.processing.register(target, rest);
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

export function registerUpgradeCategory(
    def: import("../constants.ts").UpgradeCategoryConfig,
): void {
    try {
        const { onUpgradeKey, id: _id, ...rest } = def as any;
        // The engine rejects a category that has no id and no localised name:
        //     if (!t.id || !t.name && !t.nameKey)
        //         throw new Error("Upgrade category requires an id and localized name.");
        // Dropping `id` here meant *every* category registration threw, so the
        // id is forwarded and a name is derived when the author supplied none.
        const body: Record<string, unknown> = { ...rest, id: def.id };
        if (!body.name && !body.nameKey) {
            body.name = def.id;
            body.nameKey = `upgrades|${def.id}|name`;
        }
        g()?.api?.upgrades?.registerCategory?.(body);
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

/**
 * input.registerBinding(bindingId, defaultKeys, definition) — the last of the
 * 36 config-reachable api members the mod had not wrapped.
 *
 * The engine's `handlers` is a `{ down?, up? }` pair of functions, which JSON
 * cannot express, so the mod stores handler *keys* and resolves them at apply
 * time — the same substitution already used for `getOptionsKey` on projectiles.
 *
 * `displayName` and `category` are required by the typings and are both passed
 * through verbatim; nothing is inferred.
 */
export function registerInputBinding(
    def: import("../constants.ts").InputBindingConfig,
): void {
    try {
        const input = g()?.api?.input;
        if (!input?.registerBinding) {
            console.warn(`${LOG} input.registerBinding unavailable — ${def.id} stored only`);
            return;
        }
        // a binding with neither handler would be inert; the engine still
        // accepts it, so register with an empty pair rather than skipping
        const handlers: Record<string, Function> = {};
        if (typeof def.onDownKey === "function") handlers.down = def.onDownKey;
        if (typeof def.onUpKey === "function") handlers.up = def.onUpKey;

        const definition: Record<string, unknown> = {
            displayName: def.displayName,
            category: def.category,
            handlers,
        };
        if (def.displayNameKey) definition.displayNameKey = def.displayNameKey;
        if (def.subsection) definition.subsection = def.subsection;

        input.registerBinding(
            def.id,
            def.defaultKeys ?? [],
            definition as never,
        );
    } catch (e) {
        console.error(`${LOG} input.registerBinding failed`, def.id, e);
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
        // api.energy.registerType accepts only "conductor" | "storage". Guard here so a
        // hand-edited / imported config with a bogus role is skipped loudly instead of
        // being forwarded to the engine.
        const type = def.type;
        if (type !== "conductor" && type !== "storage") {
            console.warn(
                `${LOG} energy ${def.id}: invalid type "${
                    String(type)
                }" — must be conductor|storage. Skip.`,
            );
            return;
        }
        g()?.api?.energy?.registerType?.(def.structureId, type, def.options ?? {});
    } catch (e) {
        console.error(`${LOG} energy.registerType failed`, def.id, e);
    }
}

export function registerExcavationProfile(
    def: import("../constants.ts").ExcavationProfileConfig,
): void {
    try {
        // registerProfile(id, { pattern?, power, options?, terrainRules? }) — terrainRules
        // was previously dropped on the floor, making per-terrain dig rules unreachable.
        const { id, power, pattern, options, terrainRules } = def as typeof def & {
            terrainRules?: unknown;
        };
        const payload: Record<string, unknown> = { power, pattern, options };
        if (Array.isArray(terrainRules) && terrainRules.length > 0) {
            // cellType → TerrainRef, outputElementType → ElementRef. Both accept a
            // string id, but we upgrade to numeric handles when the runtime knows them.
            payload.terrainRules = terrainRules.map((raw) => {
                const r = (raw ?? {}) as Record<string, unknown>;
                const cellType = resolveTerrainRef(
                    (r.cellType ?? r.terrainType) as string | number | undefined,
                );
                const out: Record<string, unknown> = {};
                if (cellType !== undefined && cellType !== null) out.cellType = cellType;
                if (r.damage !== undefined) out.damage = r.damage;
                const el = resolveElementRef(
                    r.outputElementType as string | number | undefined,
                );
                if (el !== undefined && el !== null) out.outputElementType = el;
                return out;
            });
        }
        g()?.api?.excavation?.registerProfile?.(id, payload);
    } catch (e) {
        console.error(`${LOG} excavation.registerProfile failed`, def.id, e);
    }
}

export function registerStructureBehavior(
    def: import("../constants.ts").StructureBehaviorConfig,
): void {
    try {
        const api = g()?.api?.structureBehaviors;
        if (!api) {
            console.warn(`${LOG} structureBehaviors API missing`);
            return;
        }
        const kind = String(def.kind || "").toLowerCase();
        const payload = def.definition ?? def;
        // Documented names are `registerConveyorType(structureId, options?)`
        // and `registerLauncherType(definition)`. Older builds are still probed
        // so a renamed api degrades to a warning rather than a crash.
        if (kind === "conveyor") {
            const id = String((payload as { id?: string })?.id ?? def.id);
            if (typeof api.registerConveyorType === "function") {
                api.registerConveyorType(
                    id,
                    (payload as { options?: unknown })?.options ?? payload,
                );
            } else if (typeof api.registerConveyor === "function") {
                api.registerConveyor(payload);
            } else {
                console.warn(`${LOG} no conveyor registration method`, def.id);
            }
        } else if (kind === "launcher") {
            if (typeof api.registerLauncherType === "function") {
                api.registerLauncherType(payload);
            } else if (typeof api.registerLauncher === "function") {
                api.registerLauncher(payload);
            } else {
                console.warn(`${LOG} no launcher registration method`, def.id);
            }
        } else {
            console.warn(`${LOG} unknown structure behavior kind`, def.kind);
        }
    } catch (e) {
        console.error(`${LOG} structureBehaviors failed`, def.id, e);
    }
}

export function registerSignal(
    def: import("../constants.ts").SignalConfig,
    handler?: Function,
): void {
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

export function registerTrigger(
    def: import("../constants.ts").TriggerConfig,
    handler?: Function,
): void {
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
