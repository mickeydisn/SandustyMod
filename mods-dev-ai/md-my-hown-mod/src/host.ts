/**
 * The engine interface: every game api call in the mod, in one place.
 *
 * ## Why this file is separate, and why it is a leaf
 *
 * The mod has one wrapper over the host, and this is it. It is deliberately the
 * only module in the api path that imports nothing from `handler/`, because the
 * dependency runs the other way too: `handler/core/types.ts` re-exports `api`
 * from here, and `handler/core/handler-registry.ts` initialises `process.ts`
 * state at load. If the wrapper imported a handler barrel, that chain closed into
 * a cycle and threw `Cannot access 'optionKeysLookup' before initialization`
 * before a single action ran.
 *
 * So the rule this file exists to enforce: **the handler may import the wrapper,
 * never the reverse.** The registration helpers that genuinely need
 * `handler/custom-process` and `handler/excavation-option` to compile a stored
 * process live in `packages/mysandkit.ts`, which is allowed those imports, and
 * nothing imports that file.
 *
 * ## The three properties every wrapper here keeps
 *
 * - **Resolved per call.** `g()` reads the injected `sandkit` on every access. It
 *   used to be captured once at import, which froze `undefined` for any host
 *   injected later and turned every call into a silent no-op.
 * - **Typed from the engine's own declarations.** Signatures mirror
 *   `packages/mysandkit/src/sandkit.ts`. Where the engine marks a member
 *   optional (`isCellEmptyAtCell?`) the wrapper answers `undefined` rather than
 *   inventing a `false` that would be indistinguishable from a real answer.
 * - **Contained.** Every call sits in a try/catch, because these run on the
 *   worker thread where an uncaught throw takes the whole structure down.
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
} from "./constants.ts";
// The placement rules, shared with the panel. Imported here rather than
// re-derived so the boot-time guard and the save-time guard are one function.
import { placementConfigPayload, placementConfigProblem } from "./config/placement.ts";
declare const sandkit: any;
export const g = () => {
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
        /**
         * The element type at a cell, as a **number**.
         *
         * The engine's signature is `getResolvedTypeAtCell(x, y): number`
         * (`elements.d.ts:71`), and the number is the *registered* type, not the
         * id string — an id-registered element and its type resolve to the same
         * number. So "is this a wall?" compares numbers, and a caller that wants
         * a name goes through `getIdByType`. Do not expect a string here.
         *
         * Wrapped because the actions needing this run on the worker thread,
         * where an uncaught throw takes the whole structure down.
         */
        getResolvedTypeAtCell(x: number, y: number): number | undefined {
            try {
                return g()?.api?.elements?.getResolvedTypeAtCell?.(x, y);
            } catch (e) {
                console.warn(`${LOG} elements.getResolvedTypeAtCell failed`, x, y, e);
                return undefined;
            }
        },
        /** The raw (unresolved) type at a cell, or `null` for an empty one. */
        getTypeAtCell(x: number, y: number): number | null {
            try {
                return g()?.api?.elements?.getTypeAtCell?.(x, y) ?? null;
            } catch (e) {
                console.warn(`${LOG} elements.getTypeAtCell failed`, x, y, e);
                return null;
            }
        },
        /** The registered type for an element id, mirroring the engine's `TElementType | null`. */
        getTypeFromId(id: string): number | null {
            try {
                return g()?.api?.elements?.getTypeFromId?.(id) ?? null;
            } catch (e) {
                console.warn(`${LOG} elements.getTypeFromId failed`, id, e);
                return null;
            }
        },
        /** Whether the cell holds exactly this type — a number compare, not a name compare. */
        isTypeAtCell(x: number, y: number, type: number): boolean {
            try {
                return g()?.api?.elements?.isTypeAtCell?.(x, y, type) === true;
            } catch (e) {
                console.warn(`${LOG} elements.isTypeAtCell failed`, x, y, e);
                return false;
            }
        },
        /**
         * The velocity vector at a cell.
         *
         * Typed as a `Vector2` — the engine's declaration widens this to
         * `Record<string, number>`, but the object it actually returns has `x`
         * and `y`, and every caller reads those two. Declaring the real shape
         * means a caller does not need a cast that would hide a future change.
         *
         * Copied per call so a caller that writes to the result cannot leak that
         * write into the next action's read.
         */
        getVelocityAtCell(x: number, y: number): { x: number; y: number } {
            try {
                const v = g()?.api?.elements?.getVelocityAtCell?.(x, y) as
                    | { x?: number; y?: number }
                    | undefined;
                return { x: v?.x ?? 0, y: v?.y ?? 0 };
            } catch (e) {
                console.warn(`${LOG} elements.getVelocityAtCell failed`, x, y, e);
                return { x: 0, y: 0 };
            }
        },
        /**
         * Move one cell's contents to another, as a single operation.
         *
         * Deliberately not a read-then-write pair: done that way inside a
         * `mutate` batch, the two cells are observable in the intermediate state.
         */
        teleportBetweenCells(
            fromX: number,
            fromY: number,
            toX: number,
            toY: number,
        ): boolean {
            try {
                return g()?.api?.elements?.teleportBetweenCells?.(
                    fromX,
                    fromY,
                    toX,
                    toY,
                ) === true;
            } catch (e) {
                console.warn(`${LOG} elements.teleportBetweenCells failed`, e);
                return false;
            }
        },
        /**
         * A free cell inside this structure's bounds, or `null`.
         *
         * `null` rather than a fabricated coordinate: a caller placing something
         * has to be able to tell "nowhere to put it" from a real cell.
         */
        findFreeCellInStructure(
            x: number,
            y: number,
            size: number,
        ): { x: number; y: number } | null {
            try {
                return g()?.api?.elements?.findFreeCellInStructure?.(x, y, size) ??
                    null;
            } catch (e) {
                console.warn(`${LOG} elements.findFreeCellInStructure failed`, e);
                return null;
            }
        },
    },
    /**
     * Grid reads, and the deferred-write batch.
     *
     * `mutate` is not optional in the engine's view: main-entry grid writes are
     * deferred, so a read+write pair that skips it never observes its own write
     * landing. It is wrapped only to contain a throw from the call *into* the
     * host — a throw inside `fn` is the engine's, and still propagates.
     */
    grid: {
        /**
         * Whether a cell holds neither element nor terrain.
         *
         * Optional in the engine's own declaration (`isCellEmptyAtCell?`), so this
         * answers `undefined` — not `false` — when the host predates it. The
         * distinction is load-bearing: callers use this to decide "is it safe to
         * write here", and a fabricated `false` would block a write that is fine.
         */
        isCellEmptyAtCell(x: number, y: number): boolean | undefined {
            try {
                return g()?.api?.grid?.isCellEmptyAtCell?.(x, y);
            } catch (e) {
                console.warn(`${LOG} grid.isCellEmptyAtCell failed`, x, y, e);
                return undefined;
            }
        },
        isTerrainAtCell(x: number, y: number): boolean {
            try {
                return g()?.api?.grid?.isTerrainAtCell?.(x, y) === true;
            } catch (e) {
                console.warn(`${LOG} grid.isTerrainAtCell failed`, x, y, e);
                return false;
            }
        },
        reportActivityAtCell(x: number, y: number): void {
            try {
                g()?.api?.grid?.reportActivityAtCell?.(x, y);
            } catch (e) {
                console.warn(`${LOG} grid.reportActivityAtCell failed`, x, y, e);
            }
        },
        mutate<T extends object>(fn: (writer: T) => void): void {
            try {
                g()?.api?.grid?.mutate?.(fn);
            } catch (e) {
                console.warn(`${LOG} grid.mutate failed`, e);
            }
        },
        /**
         * Dig one cell, filling `outVelocity` with the ejected material's motion.
         *
         * `outVelocity` is written *by* the engine, so the caller must supply the
         * object rather than receive it.
         */
        excavateAtCell(
            x: number,
            y: number,
            outVelocity: Record<string, number>,
            damage: number,
            opts?: Record<string, unknown>,
        ): void {
            try {
                g()?.api?.grid?.excavateAtCell?.(x, y, outVelocity, damage, opts ?? {});
            } catch (e) {
                console.warn(`${LOG} grid.excavateAtCell failed`, x, y, e);
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
        /**
         * The player's own inventory.
         *
         * Main-thread only, so every call here is wrapped: a worker that reaches
         * for it gets a miss rather than a thrown `TypeError` from a namespace
         * that is not there.
         */
        inventory: {
            /**
             * Add to a stack by item id, returning whether the engine call happened.
             *
             * `connect` binds against the returned boolean instead of assuming
             * success, because a void return would make a missing namespace
             * indistinguishable from a completed add.
             */
            addById(
                itemId: string,
                amount = 1,
            ): boolean {
                try {
                    g()?.api?.player?.inventory?.addById?.(itemId, amount);
                    return true;
                } catch (e) {
                    console.warn(`${LOG} player.inventory.addById failed`, itemId, e);
                    return false;
                }
            },
        },
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
        /**
         * Every structure type the mod registered.
         *
         * Types, not ids: the panel keys on the number, and a caller comparing
         * against `resolveElementRef` needs the same space.
         */
        getRegisteredTypes(): number[] {
            try {
                return g()?.api?.structures?.getRegisteredTypes?.() ?? [];
            } catch (e) {
                console.warn(`${LOG} structures.getRegisteredTypes failed`, e);
                return [];
            }
        },
        /** The types the player has unlocked, as opposed to registered. */
        getUnlockedTypes(): number[] {
            try {
                return g()?.api?.structures?.getUnlockedTypes?.() ?? [];
            } catch (e) {
                console.warn(`${LOG} structures.getUnlockedTypes failed`, e);
                return [];
            }
        },
        /**
         * The display name for a structure type.
         *
         * Accepts a **type**, matching the engine — the display name is not
         * derivable from the id, so a caller that only has an id has to resolve
         * it first.
         */
        getTypeName(t: number): string | undefined {
            try {
                return g()?.api?.structures?.getTypeName?.(t) as string | undefined;
            } catch (e) {
                console.warn(`${LOG} structures.getTypeName failed`, t, e);
                return undefined;
            }
        },
        getAll(): Record<string, unknown>[] {
            try {
                return g()?.api?.structures?.getAll?.() ?? [];
            } catch (e) {
                console.warn(`${LOG} structures.getAll failed`, e);
                return [];
            }
        },
        getRegistered(): Record<string, unknown>[] {
            try {
                return g()?.api?.structures?.getRegistered?.() ?? [];
            } catch (e) {
                console.warn(`${LOG} structures.getRegistered failed`, e);
                return [];
            }
        },
        list(): Record<string, unknown>[] {
            try {
                return g()?.api?.structures?.list?.() ?? [];
            } catch (e) {
                console.warn(`${LOG} structures.list failed`, e);
                return [];
            }
        },
        includes(idOrType: string | number): boolean {
            try {
                return g()?.api?.structures?.includes?.(idOrType) === true;
            } catch (e) {
                console.warn(`${LOG} structures.includes failed`, idOrType, e);
                return false;
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
        /** Every item definition the mod registered. */
        getRegistered(): Record<string, unknown>[] {
            try {
                return g()?.api?.items?.getRegistered?.() ?? [];
            } catch (e) {
                console.warn(`${LOG} items.getRegistered failed`, e);
                return [];
            }
        },
        getAll(): Record<string, unknown>[] {
            try {
                return g()?.api?.items?.getAll?.() ?? [];
            } catch (e) {
                console.warn(`${LOG} items.getAll failed`, e);
                return [];
            }
        },
        list(): Record<string, unknown>[] {
            try {
                return g()?.api?.items?.list?.() ?? [];
            } catch (e) {
                console.warn(`${LOG} items.list failed`, e);
                return [];
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
        /**
         * Unlocks a technology grants when it is researched.
         *
         * Named for the engine member; it lives on `tech` because that is where
         * the research graph reads its unlocks from.
         */
        conservatory: {
            /**
             * Record the unlocks a technology grants when researched.
             *
             * The second argument is a map keyed by unlock kind, not a list of
             * ids — the engine reads the keys, so an array would register nothing
             * while looking correct at the call site.
             */
            appendUnlock(techId: string, unlocks: Record<string, unknown>): void {
                try {
                    g()?.api?.tech?.conservatory?.appendUnlock?.(techId, unlocks);
                } catch (e) {
                    console.warn(`${LOG} tech.conservatory.appendUnlock failed`, techId, e);
                }
            },
        },
    },
    terrains: {
        /**
         * The terrain's data object at a cell, or `null`.
         *
         * Hit points live under `hitPoints`, and older payloads spell it `hp`.
         * Callers wanting a number should take {@link getHitPointsAtCell} rather
         * than repeating that two-key dance at every site.
         */
        getDataAtCell(x: number, y: number): Record<string, unknown> | null {
            try {
                return (g()?.api?.terrains?.getDataAtCell?.(x, y) as
                    | Record<string, unknown>
                    | null
                    | undefined) ?? null;
            } catch (e) {
                console.warn(`${LOG} terrains.getDataAtCell failed`, x, y, e);
                return null;
            }
        },
        /**
         * Hit points at a cell, or `0`.
         *
         * `0` rather than `undefined` on failure: a caller summing hit points
         * across cells wants something to add, and a cell with no terrain
         * genuinely contributes nothing to that sum.
         */
        getHitPointsAtCell(x: number, y: number): number {
            const data = api.terrains.getDataAtCell(x, y) as
                | { hitPoints?: unknown; hp?: unknown }
                | null;
            const hp = data?.hitPoints ?? data?.hp;
            return typeof hp === "number" ? hp : 0;
        },
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
        /**
         * Set an upgrade's level on an item instance.
         *
         * Takes the item **id**, not an instance: the engine looks the instance
         * up, and passing one here would silently address nothing.
         */
        setLevelById(itemId: string, upgradeId: string, level: number): void {
            try {
                g()?.api?.upgrades?.setLevelById?.(itemId, upgradeId, level);
            } catch (e) {
                console.warn(`${LOG} upgrades.setLevelById failed`, itemId, upgradeId, e);
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
    /**
     * Resolves a mod-relative asset path to something the renderer can load.
     *
     * Returns `undefined` rather than the input path on failure: a caller that
     * cannot tell a real URL from a failed lookup would draw the path itself as
     * a texture name, which fails later and much less legibly.
     */
    assets: {
        getUrl(path: string): string | undefined {
            try {
                return g()?.api?.assets?.getUrl?.(path) as string | undefined;
            } catch (e) {
                console.warn(`${LOG} assets.getUrl failed`, path, e);
                return undefined;
            }
        },
    },
    /**
     * Sprite handles for the mod's own graphics.
     *
     * Both entry points are kept because they answer different questions:
     * `load` is for a path the mod ships, `loadFromMod` for one already inside
     * a mounted mod. Neither throws — a missing sprite is a missing picture, not
     * a reason to take the structure down.
     */
    sprites: {
        load(id: string, path: string, options?: Record<string, unknown>): unknown {
            try {
                return g()?.api?.sprites?.load?.(id, path, options ?? {});
            } catch (e) {
                console.warn(`${LOG} sprites.load failed`, id, e);
                return undefined;
            }
        },
        loadFromMod(id: string, path: string, options?: Record<string, unknown>): unknown {
            try {
                return g()?.api?.sprites?.loadFromMod?.(id, path, options ?? {});
            } catch (e) {
                console.warn(`${LOG} sprites.loadFromMod failed`, id, e);
                return undefined;
            }
        },
        /**
         * The namespace sprite ids were registered under.
         *
         * Read to build panel keys, so it is a lookup and not a registration.
         * Named `namespace` because that is the engine member it forwards to.
         */
        namespace(): string | undefined {
            try {
                return g()?.api?.sprites?.namespace?.() as string | undefined;
            } catch (e) {
                console.warn(`${LOG} sprites.namespace failed`, e);
                return undefined;
            }
        },
        /** Sprite ids the mod registered. */
        getRegistered(): string[] {
            try {
                return g()?.api?.sprites?.getRegistered?.() ?? [];
            } catch (e) {
                console.warn(`${LOG} sprites.getRegistered failed`, e);
                return [];
            }
        },
        /** Sprites the engine currently holds — a wider set than registered. */
        getLoaded(): string[] {
            try {
                return g()?.api?.sprites?.getLoaded?.() ?? [];
            } catch (e) {
                console.warn(`${LOG} sprites.getLoaded failed`, e);
                return [];
            }
        },
        getAll(): string[] {
            try {
                return g()?.api?.sprites?.getAll?.() ?? [];
            } catch (e) {
                console.warn(`${LOG} sprites.getAll failed`, e);
                return [];
            }
        },
        list(): string[] {
            try {
                return g()?.api?.sprites?.list?.() ?? [];
            } catch (e) {
                console.warn(`${LOG} sprites.list failed`, e);
                return [];
            }
        },
    },
    /**
     * Cursor position, and key bindings.
     *
     * `getMouseCellPosition` is ambient rather than context-bound, which is why
     * a tool action can read the cell under the cursor without being handed a
     * `StructureProcessingContext`.
     */
    input: {
        /** The cell under the cursor, or `null` when the pointer is off-grid. */
        getMouseCellPosition(): { x: number; y: number } | null {
            try {
                return (g()?.api?.input?.getMouseCellPosition?.() as
                    | { x: number; y: number }
                    | null
                    | undefined) ?? null;
            } catch (e) {
                console.warn(`${LOG} input.getMouseCellPosition failed`, e);
                return null;
            }
        },
        registerBinding(
            bindingId: string,
            defaultKeys: readonly string[],
            definition: Record<string, unknown>,
        ): void {
            try {
                g()?.api?.input?.registerBinding?.(bindingId, defaultKeys, definition);
            } catch (e) {
                console.warn(`${LOG} input.registerBinding failed`, bindingId, e);
            }
        },
    },
    /** Publishing a signal output at a cell. The value is a **boolean** level. */
    signals: {
        setOutputAtCell(x: number, y: number, value: boolean): void {
            try {
                g()?.api?.signals?.setOutputAtCell?.(x, y, value);
            } catch (e) {
                console.warn(`${LOG} signals.setOutputAtCell failed`, x, y, e);
            }
        },
    },
    /**
     * Energy types, per structure.
     *
     * The engine accepts only `"conductor" | "storage"`, so the type is narrowed
     * here rather than accepted as a free string that would be rejected at
     * registration time with a much worse error.
     */
    energy: {
        registerType(
            structureId: string,
            type: "conductor" | "storage",
            options?: Record<string, unknown>,
        ): void {
            try {
                g()?.api?.energy?.registerType?.(structureId, type, options ?? {});
            } catch (e) {
                console.warn(`${LOG} energy.registerType failed`, structureId, e);
            }
        },
        /** Add energy at a cell on a conductor or storage structure. */
        addAtCell(x: number, y: number, amount: number): void {
            try {
                g()?.api?.energy?.addAtCell?.(x, y, amount);
            } catch (e) {
                console.warn(`${LOG} energy.addAtCell failed`, x, y, e);
            }
        },
        /**
         * Take energy out, and get back what was actually drawn.
         *
         * The result is **not** the amount requested when less was available, and
         * a caller that budgets on the request would be inventing energy the
         * structure never had.
         */
        consume(amount: number, options?: Record<string, unknown>): number {
            try {
                return g()?.api?.energy?.consume?.(amount, options ?? {}) as number;
            } catch (e) {
                console.warn(`${LOG} energy.consume failed`, amount, e);
                return 0;
            }
        },
    },
    /**
     * Particles and one-shot visual effects.
     *
     * `createParticlesAtWorld` is ambient, not context-bound, which is what lets
     * the `particles` action fire from a worker thread with no structure context.
     */
    effects: {
        createParticlesAtWorld(
            x: number,
            y: number,
            options: { count?: number; [key: string]: unknown },
        ): void {
            try {
                g()?.api?.effects?.createParticlesAtWorld?.(x, y, options);
            } catch (e) {
                console.warn(`${LOG} effects.createParticlesAtWorld failed`, x, y, e);
            }
        },
        /**
         * Whether an effect id exists.
         *
         * Used to validate a configured effect before it is played, so a
         * misspelled id is caught at registration rather than silently drawing
         * nothing at run time.
         */
        includes(effect: string): boolean {
            try {
                return g()?.api?.effects?.includes?.(effect) === true;
            } catch (e) {
                console.warn(`${LOG} effects.includes failed`, effect, e);
                return false;
            }
        },
    },
    /** A projectile blueprint from a registered id. */
    projectiles: {
        createBlueprintFromId(id: string): unknown {
            try {
                return g()?.api?.projectiles?.createBlueprintFromId?.(id);
            } catch (e) {
                console.warn(`${LOG} projectiles.createBlueprintFromId failed`, id, e);
                return undefined;
            }
        },
        /**
         * Spawn a blueprint at a world position, aimed along `angle`.
         *
         * The angle comes before the blueprint because that is the engine's
         * argument order, and a swapped pair would still type-check against a
         * loose signature while aiming every projectile sideways.
         */
        spawnAtWorld(x: number, y: number, angle: number, blueprint: unknown): void {
            try {
                g()?.api?.projectiles?.spawnAtWorld?.(x, y, angle, blueprint);
            } catch (e) {
                console.warn(`${LOG} projectiles.spawnAtWorld failed`, x, y, e);
            }
        },
    },
    /**
     * The engine's own generator.
     *
     * Present so entropy has one route: `decide` reads `api.random.int` rather
     * than calling `Math.random()`, which keeps a replayed simulation on the
     * engine's stream. Inclusive at both ends, matching the engine.
     */
    random: {
        int(min: number, max: number): number {
            try {
                return g()?.api?.random?.int?.(min, max) as number;
            } catch (e) {
                console.warn(`${LOG} random.int failed`, min, max, e);
                return min;
            }
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

export function resolveElementRef(
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
export function resolveTerrainRef(
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

/**
 * The shape {@link normalizeItem} needs back from a compiled process.
 *
 * Deliberately narrow and local rather than imported from
 * `handler/core/process.ts`: that module is exactly what this file must not
 * reach. Naming only the four fields actually read here keeps the contract
 * honest — if the compiler's real type changes, this is the one place that
 * should be looked at, and it fails to compile instead of silently widening.
 */
export interface CompiledItemAction {
    fn: unknown;
    skipped: string[];
    source:
        | { kind: "none" }
        | { kind: "process"; id: string }
        | { kind: "legacy"; refs: unknown[] };
}

let compileItemAction: ((def: Record<string, unknown>) => CompiledItemAction) | null = null;

/**
 * Install the process compiler, which only `packages/mysandkit.ts` can supply.
 *
 * `items.register` has to turn a stored process into the function that
 * `ItemDefinition.handleAction` expects, and compiling one needs
 * `handler/custom-process` — an import this leaf cannot make without closing the
 * cycle described at the top of the file. So the dependency is inverted and
 * injected at load by the one module allowed to have it.
 *
 * It is a hard error, not a fallback, when the compiler is missing: silently
 * registering an item whose `handleAction` was never attached would produce an
 * item that exists and does nothing, which is the hardest kind of bug to trace
 * back here.
 */
export function setItemActionCompiler(
    fn: (def: Record<string, unknown>) => CompiledItemAction,
): void {
    compileItemAction = fn;
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
    if (!compileItemAction) {
        throw new Error(
            `${LOG} items.register needs the process compiler; nothing called ` +
                `setItemActionCompiler. Import packages/mysandkit.ts before registering.`,
        );
    }
    const compiled = compileItemAction(def as Record<string, unknown>);
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
