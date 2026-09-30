/**
 * Thin wrappers around sandkit.api — full field forwarding for every register path.
 */
import { compileExcavationProfile } from "../handler/excavation-option/index.ts";
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
import { compileEntryProcess } from "../handler/custom-process/index.ts";
// The placement rules, shared with the panel. Imported here rather than
// re-derived so the boot-time guard and the save-time guard are one function.
import { placementConfigPayload, placementConfigProblem } from "../config/placement.ts";

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
        /** Reveal a registered element in the discovery catalogue. Without it the element simulates but is never discovered. */
        addElementToDiscoveries(elementType: number) {
            try {
                const d = g()?.api?.discoveries;
                if (d?.addElement) d.addElement(elementType);
                else d?.addElementByType?.(elementType);
            } catch (e) {
                console.error(`${LOG} discoveries.addElement failed`, e);
            }
        },
        /**
         * Resolve an element id to its numeric type.
         *
         * The engine spells this `getTypeById`. `getTypeFromId` was the older
         * `@deprecated` name; it is no longer probed, so a build that has only
         * the old spelling resolves nothing and says so by returning undefined
         * rather than silently working against a name the engine will drop.
         */
        getTypeById(id: string): number | undefined {
            try {
                return g()?.api?.elements?.getTypeById?.(id);
            } catch {
                return undefined;
            }
        },
        // ── Reads ────────────────────────────────────────────────────────────
        //
        // These exist in the host API but were missing here, so every caller
        // reached for them through `?.` and silently got `undefined` — a panel
        // showing no game objects, with nothing thrown and nothing logged. The
        // shape matches `md-admin-element`, which is the working reference for
        // reading back what the engine has registered.

        /**
         * Every registered element type, as the numbers the registry uses.
         *
         * The one enumeration of elements that exists. Returns `[]` rather than
         * throwing when the host build lacks it, because "no elements" and "this
         * build cannot tell us" should look the same to a list screen.
         */
        getRegisteredTypes(): number[] {
            try {
                return g()?.api?.elements?.getRegisteredTypes?.() ?? [];
            } catch (e) {
                console.warn(`${LOG} elements.getRegisteredTypes failed`, e);
                return [];
            }
        },
        /** The engine's own definition for an element type, or undefined. */
        getDefinitionByType(t: number): Record<string, unknown> | undefined {
            try {
                return g()?.api?.elements?.getDefinitionByType?.(t) as
                    | Record<string, unknown>
                    | undefined;
            } catch (e) {
                console.warn(`${LOG} elements.getDefinitionByType failed`, t, e);
                return undefined;
            }
        },
        /** The id string for an element type — never a guess, unlike the enum name. */
        getIdByType(t: number): string | undefined {
            try {
                return g()?.api?.elements?.getIdByType?.(t) as string | undefined;
            } catch (e) {
                console.warn(`${LOG} elements.getIdByType failed`, t, e);
                return undefined;
            }
        },
        /** The engine's display name for an element type. */
        getNameByType(t: number): string | undefined {
            try {
                return g()?.api?.elements?.getNameByType?.(t) as string | undefined;
            } catch (e) {
                console.warn(`${LOG} elements.getNameByType failed`, t, e);
                return undefined;
            }
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
             *
             * Calls `unlockById`, not `unlockByType`: the latter is `@deprecated`
             * in both engine type sets. The boolean is ours, not the engine's, so
             * renaming the engine call costs nothing and keeps the `apply.ts`
             * warning working.
             */
            unlockById(structureId: string): boolean {
                try {
                    const fn = g()?.api?.player?.buildings?.unlockById;
                    if (typeof fn !== "function") return false;
                    fn(structureId);
                    return true;
                } catch (e) {
                    console.error(`${LOG} player.buildings.unlockById failed`, structureId, e);
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
        /**
         * Every structure type the engine currently offers, as a set of
         * `StructureRef` — a number, or an id string.
         *
         * There is no "list everything registered" call for structures, so this
         * is the enumeration, and it is why a structure row may end up as a bare
         * id when the definition behind it cannot be read.
         */
        getAvailableTypes(): Set<number | string> {
            try {
                return g()?.api?.structures?.getAvailableTypes?.() ?? new Set();
            } catch (e) {
                console.warn(`${LOG} structures.getAvailableTypes failed`, e);
                return new Set();
            }
        },
        /**
         * The engine's definition for a structure ref.
         *
         * Accepts a string ref as well as a number. The engine wants a *type*
         * here and a string is the kind of argument that throws rather than
         * returning nothing, which is why this catches instead of the caller.
         */
        getDefinitionByType(ref: number | string): Record<string, unknown> | undefined {
            try {
                return (g()?.api?.structures?.getDefinitionByType?.(ref) ?? undefined) as
                    | Record<string, unknown>
                    | undefined;
            } catch (e) {
                console.warn(`${LOG} structures.getDefinitionByType failed`, ref, e);
                return undefined;
            }
        },
        /** The id string for a structure type. */
        getIdByType(t: number): string | undefined {
            try {
                return g()?.api?.structures?.getIdByType?.(t) as string | undefined;
            } catch (e) {
                console.warn(`${LOG} structures.getIdByType failed`, t, e);
                return undefined;
            }
        },
        /**
         * The numeric type for an id string.
         *
         * Probed, not assumed: the mod's own `HandlerAction.md` records a
         * `getTypeFromId` that did not exist on `projectiles`, and the structure
         * namespace has been through the same rename (`getTypeFromId` /
         * `getTypeById`). Falls back to the id so a caller that only wants a
         * usable ref still gets one.
         */
        getTypeById(id: string): number | string {
            try {
                const s = g()?.api?.structures as
                    | {
                        getTypeFromId?: (a: string) => number;
                        getTypeById?: (a: string) => number;
                    }
                    | undefined;
                return s?.getTypeFromId?.(id) ?? s?.getTypeById?.(id) ?? id;
            } catch (e) {
                console.warn(`${LOG} structures.getTypeById failed`, id, e);
                return id;
            }
        },
        /**
         * Count structures of one type that exist right now.
         *
         * A `count`, not a list, because the only caller wants a number and an
         * array of every generator in the world would be a large allocation to
         * throw away. Returns `null` — not `0` — when the call is unavailable,
         * so a caller can tell "there are none" from "we could not look", which
         * are very different answers for a cap that is about to block a player.
         */
        countOfType(ref: number | string): number | null {
            try {
                const fn = g()?.api?.structures?.forEachOfType as
                    | ((a: number | string, b: () => void) => unknown)
                    | undefined;
                if (typeof fn !== "function") return null;
                let n = 0;
                fn(ref, () => {
                    n++;
                });
                return n;
            } catch (e) {
                console.warn(`${LOG} structures.forEachOfType failed`, ref, e);
                return null;
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
        /**
         * Every registered item id.
         *
         * Not in the published API types, so it may be absent on some builds —
         * hence `[]` rather than a throw, and hence the mod registry above as the
         * fallback a list screen should really use first.
         */
        getRegisteredIds(): string[] {
            try {
                return (g()?.api?.items?.getRegisteredIds?.() ?? []) as string[];
            } catch (e) {
                console.warn(`${LOG} items.getRegisteredIds failed`, e);
                return [];
            }
        },
        /** The engine's definition for an item id. */
        getDefinitionById(id: string): Record<string, unknown> | undefined {
            try {
                return (g()?.api?.items?.getDefinitionById?.(id) ?? undefined) as
                    | Record<string, unknown>
                    | undefined;
            } catch (e) {
                console.warn(`${LOG} items.getDefinitionById failed`, id, e);
                return undefined;
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
        /** The id string for a terrain type. */
        getIdByType(t: number): string | undefined {
            try {
                return g()?.api?.terrains?.getIdByType?.(t) as string | undefined;
            } catch (e) {
                console.warn(`${LOG} terrains.getIdByType failed`, t, e);
                return undefined;
            }
        },
        /** The engine's definition for a terrain type. */
        getDefinitionByType(t: number): Record<string, unknown> | undefined {
            try {
                return g()?.api?.terrains?.getDefinitionByType?.(t) as
                    | Record<string, unknown>
                    | undefined;
            } catch (e) {
                console.warn(`${LOG} terrains.getDefinitionByType failed`, t, e);
                return undefined;
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
        /**
         * A transient message for the player.
         *
         * `(message, options?)` — the optional second argument is simply omitted
         * rather than passed as `{}`. `GAME_AUDIT.md` records this as a 1-of-2
         * arity match, and the audit's own advice is to omit the argument it
         * cannot fill. An empty object is *also* accepted by the engine, so
         * either is safe; omitting is the one the audit verified.
         */
        toast(message: string): void {
            try {
                (g()?.api?.ui?.toast as ((m: string) => void) | undefined)?.(message);
            } catch (e) {
                // A toast that throws must never take down whatever asked for it
                // — the one caller here is a placement-limit refusal, where the
                // cancel has already happened and losing the message is
                // recoverable but losing the hook is not.
                console.warn(`${LOG} ui.toast failed`, message, e);
            }
        },
    },
    /**
     * The engine's hook system.
     *
     * `intercept` returns the engine's own unsubscribe, passed through
     * unchanged, so a caller can detach and re-install — which is the only way
     * a rule driven by a config can actually *change* when the config is
     * re-applied. `apply.ts` reaches into `globalThis` for the same calls; that
     * duplication is left alone here rather than folded in, because it is not
     * what this change is about.
     */
    hooks: {
        intercept(
            id: string,
            fn: (args: never, context: { cancel?: () => void }) => unknown,
            opts?: Record<string, unknown>,
        ): unknown {
            try {
                return g()?.api?.hooks?.intercept?.(id, fn, opts);
            } catch (e) {
                console.error(`${LOG} hooks.intercept failed`, id, e);
                return undefined;
            }
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

/** The matter type as a number. Never a string: `enums[v]` reverse-maps to the name, which the worker's table cannot find. */
function resolveMatterType(v: string | number | undefined): number | undefined {
    if (v === undefined || v === null) return undefined;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
        const lower = v.trim().toLowerCase();
        if (lower in MATTER_MAP) return MATTER_MAP[lower];
        // A number written as text, which a hand-edited config can hold.
        if (/^\d+$/.test(lower)) return Number(lower);
        const enums = g()?.enums?.MatterType;
        if (enums) {
            const cap = v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
            // Only a *number* is a valid answer. `enums[name]` is the number for
            // a name, but `enums["8"]` is the string "Powder" — see above.
            const viaEnum = enums[cap];
            if (typeof viaEnum === "number") return viaEnum;
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
        // This was a *direct* call, not optional-chained, so probing a name the
        // engine has since dropped would have thrown here rather than degrading.
        // Only the current spelling is called, and an unresolved id is passed
        // through unchanged so the engine gets whatever the author wrote.
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

/** Resolve a terrain id to its cell type when the runtime knows it, else pass it through. */
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

/** Stands in for a definition that carries no colour at all. */
const NEUTRAL_VARIANT: [number, number, number, number] = [204, 204, 204, 255];

/** The single variant to use when the definition declares none: the map colour, or neutral grey. */
function variantFromMetaColor(metaColor: unknown): [number, number, number, number] {
    if (typeof metaColor !== "number" || !Number.isFinite(metaColor)) return NEUTRAL_VARIANT;
    const packed = Math.max(0, Math.min(0xffffff, Math.floor(metaColor)));
    return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255, 255];
}

/**
 * Engine-shaped element fields from a stored entry, shared with the
 * `updateDefinition` path so both normalise identically.
 */
export function normalizeElementPatch(entry: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...entry };
    const mt = resolveMatterType(entry.matterType as string | number | undefined);
    if (mt !== undefined) out.matterType = mt;
    const rawColors = entry.colors as { variants?: unknown } | number[][] | undefined;
    const rawVariants = Array.isArray(rawColors) ? rawColors : rawColors?.variants;
    if (Array.isArray(rawVariants) && rawVariants.length > 0) {
        out.colors = Array.isArray(rawColors)
            ? { variants: rawVariants }
            : { ...rawColors, variants: rawVariants };
    } else if (entry.metaColor !== undefined) {
        out.colors = { variants: [variantFromMetaColor(entry.metaColor)] };
    }
    if (typeof entry.getExtraProps !== "function") delete out.getExtraProps;
    return out;
}

function normalizeElement(def: ElementConfig): Record<string, unknown> {
    const id = String(def.id);
    const name = def.name ?? id;
    const nameKey = def.nameKey ?? `elements|${id}|name`;
    const out: Record<string, unknown> = { ...def, id, name, nameKey };
    const mt = resolveMatterType(def.matterType as string | number | undefined);
    if (mt !== undefined) out.matterType = mt;
    // An element with no colour variants must still be given one, and the
    // variant to use is the map colour — the two are the same information, so
    // reading one and writing the other is not a second thing to remember.
    //
    // The engine does *not* do this fallback for us. `register` is guarded —
    // `t.colors && scheme.colors.add(type, t.colors)` (bundel.js/46781.js:1290) —
    // so a definition without `colors` never gets a colour-scheme entry at all,
    // and the renderer then hits its own default: `[255, 0, 0, 255]`
    // (bundel.js/26508.js:114-117). The element comes out bright red.
    const rawColors = def.colors as { variants?: unknown } | number[][] | undefined;
    const rawVariants = Array.isArray(rawColors) ? rawColors : rawColors?.variants;
    if (Array.isArray(rawVariants) && rawVariants.length > 0) {
        out.colors = Array.isArray(rawColors)
            ? { variants: rawVariants }
            : { ...rawColors, variants: rawVariants };
    } else {
        // A bare array has no other keys to keep; an object may carry scheme
        // options the renderer reads alongside the variants
        // (`variantFromDataField1`, `variantFromVelocity`), and seeding the
        // variants must not cost the author those.
        out.colors = Array.isArray(rawColors) || !rawColors
            ? { variants: [variantFromMetaColor(def.metaColor)] }
            : { ...rawColors, variants: [variantFromMetaColor(def.metaColor)] };
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
    // actions"), but it is a *function* — JSON can only name a process, so the
    // stored list is compiled here. A Consumable is skipped on purpose: ItemType
    // has a Consumable member but ActionType does not, so the engine can never
    // dispatch a use action to one.
    const compiled = compileEntryProcess(def as Record<string, unknown>, "itemAction");
    if (compiled.source.kind !== "none" && !isConsumable) {
        if (compiled.skipped.length) {
            console.warn(
                `[md-my-hown-mod] item ${id}: unknown action ${compiled.skipped.join(", ")}`,
            );
        }
        out.handleAction = compiled.fn as never;
        // Keep the program in the payload for the panel's "used by" scan. Under the
        // reference model that is the **id**, not the steps — a copy here would be the
        // very duplication this feature removes, and it would go stale the moment the
        // process was edited. A legacy array is passed through as-is because that is
        // genuinely all it has.
        if (compiled.source.kind === "process") out.processId = compiled.source.id;
        else if (compiled.source.kind === "legacy") out.actions = compiled.source.refs;
        out.options = {
            ...(typeof def.options === "object" ? def.options : {}),
            itemId: id,
            itemType: def.itemType ?? "Mod",
        };
    } else {
        // No process, or one the engine can never dispatch. Drop the keys that
        // name one so a `Consumable` does not reach the game holding one.
        //
        // The pre-split spellings are listed by name rather than read from
        // `actionRefsOf`, because they are not interpreted any more — they are
        // only refused. An entry that still carries one is not a process, but it
        // would otherwise pass through the passthrough and be handed to the
        // engine as a field it has no meaning for.
        for (const k of ["actions", "handlerKey", "onUpgradeKey"]) delete out[k];
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
 * Recipe body per machine. See `doc/doc-artifacts/doc.api/shared/api.recipes.md`:
 *   planterBox → { input, output, chance? }   shaker → { input, outputsAbove[], outputsBelow[] }
 *   kineticPress → { input, minimumDownwardVelocity, outputs[] }   others → { input, outputs[] }
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
        machine = String(r.structureType ?? machine);
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
    const { id, handlerKey: _hk, ...rest } = p as
        & Record<string, unknown>
        & ProcessingConfig;
    const { structureType } = rest as { structureType?: string };
    if (structureType === undefined) {
        console.warn(`${LOG} processing ${id}: missing structureType`);
        return;
    }
    if (typeof rest.process !== "function") {
        console.warn(
            `${LOG} processing ${id}: process() not a function (JSON cannot store callbacks). Skip.`,
        );
        return;
    }
    // The engine signature is `register(id, definition)` — the **id is a label for
    // the registration**, and `structureType` belongs inside the definition.
    //
    // This used to be `register(structureType, rest)`, which reads plausibly and
    // is wrong twice over: it passed the structure type where the id belongs, and
    // destructured `structureType` *out* of `rest`, so the definition the engine
    // received had no `structureType` at all. The engine then threw
    //     Structure "undefined" must be registered before its processing.
    // and the tick never ran. Offline tests missed it because the stubbed
    // `processing.register` never looks at the definition.
    api.structures.processing.register(id ?? `${structureType}:process`, rest);
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
        const { id: _id, ...rest } = def as Record<string, unknown>;
        // `onUpgrade` is a real top-level field of `upgrades.register` and the
        // engine reads it — a callback, like `ItemDefinition.handleAction`. The mod
        // stores a *reference* to a process; a config still on the old `onUpgradeKey`
        // spelling holds no program at all, and all 7 upgrade actions are then
        // unreachable in-game. That is the author's entry to fix, not a silent gap
        // this layer should paper over.
        const compiled = compileEntryProcess(rest, "upgrade");
        if (compiled.skipped.length) {
            console.warn(`${LOG} upgrade ${def.id}: unknown action ${compiled.skipped.join(", ")}`);
        }
        g()?.api?.upgrades?.register?.({ ...rest, onUpgrade: compiled.fn });
    } catch (e) {
        console.error(`${LOG} upgrades.register failed`, def.id, e);
    }
}

/**
 * `input.registerBinding(bindingId, defaultKeys, definition)`. The engine's
 * `handlers` is a function pair JSON cannot hold, so keys are stored and
 * compiled here.
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
        // `power` and `options` come from the chosen **ExcavationOption** when there
        // is one, and from the entry's own fields when there is not. The option owns
        // exactly those two keys and nothing else, which is why `pattern` and
        // `terrainRules` below are read straight off the entry: a preset has no
        // opinion about the shape of a dig or what sandstone becomes. See
        // `../handler/excavation-option/compile.ts`.
        const { patch, key, problem } = compileExcavationProfile(def as Record<string, unknown>);
        if (problem) {
            console.warn(`${LOG} excavation profile ${id}: ${problem} — using the stored power`);
        } else if (key) {
            console.log(`${LOG} excavation profile ${id}: power and flags from ${key}`);
        }
        const payload: Record<string, unknown> = {
            power: patch.power ?? power,
            options: patch.options ?? options,
            pattern,
        };
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

/** Register one structure behaviour. This build exposes the split API; the grouped name is probed first. */
export function registerStructureBehavior(
    def: import("../constants.ts").StructureBehaviorConfig,
): void {
    try {
        const api = g()?.api;
        if (!api) {
            console.warn(`${LOG} sandkit api unavailable`);
            return;
        }
        const kind = String(def.kind || "").toLowerCase();
        const payload = def.definition ?? def;
        const grouped = (api as { structureBehaviors?: Record<string, unknown> })
            .structureBehaviors;
        if (kind === "conveyor") {
            const id = String((payload as { id?: string })?.id ?? def.id);
            // The engine forwards `options` to the workers untouched, so it is
            // passed through whole rather than picked apart here.
            const options = (payload as { options?: unknown })?.options ?? payload;
            if (typeof grouped?.registerConveyorType === "function") {
                (grouped.registerConveyorType as (a: string, b: unknown) => void)(
                    id,
                    options,
                );
            } else if (typeof api.conveyors?.registerType === "function") {
                api.conveyors.registerType(id, options);
            } else {
                console.warn(`${LOG} no conveyor registration method`, def.id);
            }
        } else if (kind === "launcher") {
            if (typeof grouped?.registerLauncherType === "function") {
                (grouped.registerLauncherType as (a: unknown) => void)(payload);
            } else if (typeof api.launchers?.registerType === "function") {
                api.launchers.registerType(payload);
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

/**
 * Register one structure's **placement hotbar fields**.
 *
 * `structures.registerPlacementConfig({ structureId, fields })` — the widgets the
 * player adjusts while holding the building, before placing it.
 *
 * Two things are worth stating because both are ways this call silently fails,
 * and both have already happened to a mod that shipped them:
 *
 * 1. **The payload is `{ structureId, fields }` and nothing else.** There is no
 *    `maxCount`. The engine's body (bundel 88861) opens with
 *    `if (!t.structureId || !t.fields.length) throw …` — so a call carrying
 *    `{ structureId, maxCount }` throws, and a `try {} catch {}` around it turns
 *    that into a config that does not exist and a player who sees no widget and
 *    no reason. Hence the pre-flight below: nothing reaches the engine unchecked.
 *
 * 2. **The check is `structureId` + a non-empty `fields`, not a count.** A
 *    placement config is the hotbar field list. It does not cap how many of a
 *    structure may be placed — the engine's `maxCount` is gated behind
 *    `structureType === GloomEmitter` (bundel 5251) and is unreachable from a mod.
 *
 * The rules themselves live in `../config/placement.ts` and are shared with the
 * panel, so a save the panel accepts and a boot the game accepts cannot disagree.
 */
export function registerPlacementConfig(
    def: import("../constants.ts").PlacementConfigConfig,
): void {
    const problem = placementConfigProblem(def);
    if (problem) {
        // The engine's own wording, so the boot log and the panel read alike.
        console.error(`${LOG} placement config "${def?.id ?? "?"}" rejected: ${problem}`);
        return;
    }
    try {
        const api = g()?.api;
        if (!api) {
            console.warn(`${LOG} sandkit api unavailable`);
            return;
        }
        const structures = api.structures as {
            registerPlacementConfig?: (definition: unknown) => unknown;
        } | undefined;
        if (typeof structures?.registerPlacementConfig !== "function") {
            console.warn(`${LOG} no registerPlacementConfig on this build`, def.id);
            return;
        }
        structures.registerPlacementConfig(placementConfigPayload(def));
    } catch (e) {
        // Reachable: the engine throws *after* its own checks on anything the
        // pre-flight does not model, and a partial registration can throw too.
        console.error(`${LOG} placement config failed`, def.id, e);
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
