/**
 * The handler/action registries.
 *
 * Every callable in here is a **HandlerAction** — an atomic unit of behaviour with
 * the canonical `(payload, ctx, options)` signature. A *process* is the ordered list
 * of them that an object runs, and it is compiled in `./process.ts`; nothing in this
 * file is a process.
 *
 * The `import type` below is worth a note: `process.ts` imports this file, so a
 * *value* import would be a real cycle. A type import is erased at compile time, so
 * the one type this file needs from its own dependent costs nothing at runtime.
 */
import type { HandlerActionFn } from "./process.ts";

/**
 * What the `CODE_HANDLERS` wrapper is for.
 *
 * There used to be three types for one idea — `AnyHandler` (`…args: unknown[]`),
 * this one, and `ProcessHandler` (a named three-arg signature) — and nothing said
 * which a given entry was. `CODE_HANDLERS` values stay `{ kind, fn }` because the
 * **modifier** slot genuinely needs to know whether it intercepts or rewrites: that
 * is not an action detail, it is the engine's own two modes. The `fn` inside is an
 * action like any other.
 */
export type CodeHandler =
    | { kind: "intercept"; fn: HandlerActionFn }
    | { kind: "modify"; fn: HandlerActionFn };

/**
 * Registry of live callbacks. Keys are stable strings used in JSON config.
 * Example config entry:
 *   { "id": "…", "hookId": "someHook", "kind": "intercept", "handlerKey": "logArgs" }
 */
export const CODE_HANDLERS: Record<string, CodeHandler> = {
    /** Generic logger for intercept hooks — useful while discovering hook names. */
    logArgs: {
        kind: "intercept",
        fn: (args, ctx) => {
            console.log("[md-my-hown-mod:modifier] intercept", args, ctx);
        },
    },

    /** Pass-through modify — returns args unchanged (probe that modify is wired). */
    identity: {
        kind: "modify",
        fn: (args) => args,
    },

    /**
     * Example: log building:placed-style payloads if hooked under a matching hookId.
     * Replace / extend with real game hook names as you discover them.
     */
    logBuildingPayload: {
        kind: "intercept",
        fn: (args) => {
            try {
                const a = args as Record<string, unknown> | null;
                console.log("[md-my-hown-mod:modifier] building-ish", a);
            } catch {
                console.log("[md-my-hown-mod:modifier] building-ish (raw)", args);
            }
        },
    },
};

/** Generic callbacks for signals / triggers / projectile getOptions / upgrade onUpgrade. */
export const ANY_HANDLERS: Record<string, HandlerActionFn> = {
    signalLog: (payload, _ctx, extra) => {
        console.log("[md-my-hown-mod:signal]", payload, extra);
    },
    triggerLog: (payload, _ctx, extra) => {
        console.log("[md-my-hown-mod:trigger]", payload, extra);
    },
    /**
     * The seven projectile presets — including `defaultProjectileOptions` — used to
     * sit here, typed as `HandlerActionFn`s and called with none of the three
     * arguments. They are `ProjectileOptionFn`s now, in
     * `./projectile-option/registry.ts`: they take parameters and their *return* is
     * the projectile's config. A test asserts none of the seven resolve from here.
     */
    noop: () => undefined,

    // ── Structure interactions (signals) ─────────────────────────────────────
    /** Reports what the clicked structure is, without changing anything. */
    structureInspect: (structure) => {
        const s = structure as Record<string, unknown> | null;
        if (!s) return;
        console.log(
            "[md-my-hown-mod:signal] structure",
            JSON.stringify({ type: s.type, x: s.x, y: s.y, data: s.data }, null, 2),
        );
    },
    /**
     * Reads a per-instance data field off the clicked structure.
     * `extra` is the signal entry's stored options, e.g. { field: "charge" }.
     */
    structureReadData: (structure, _ctx, extra) => {
        const s = structure as { data?: Record<string, unknown> } | null;
        const field = (extra as { field?: string } | null)?.field;
        if (!s?.data || !field) return;
        console.log(`[md-my-hown-mod:signal] data.${field} =`, s.data[field]);
    },
    /** Writes a per-instance data field on the clicked structure. */
    structureWriteData: (structure, _ctx, extra) => {
        const s = structure as { data?: Record<string, unknown> } | null;
        const o = extra as { field?: string; value?: unknown } | null;
        if (!s || !o?.field) return;
        if (!s.data) s.data = {};
        s.data[o.field] = o.value;
    },

    // ── Timed effects (triggers) ─────────────────────────────────────────────
    /** Walks the cells around the tick position and reports element types. */
    triggerScan: (payload, _ctx, extra) => {
        const p = payload as { x?: number; y?: number } | null;
        if (!p) return;
        console.log(`[md-my-hown-mod:trigger] scan near ${p.x},${p.y}`, extra);
    },
    /** Reports the tick counter, to verify a trigger's interval is firing. */
    triggerTick: (payload) => {
        console.log("[md-my-hown-mod:trigger] tick", payload);
    },

    // ── Projectiles ──────────────────────────────────────────────────────────
    // The seven projectile presets that lived here have moved to
    // `./projectile-option/registry.ts`. They are **options**, not actions: the
    // engine calls `getOptions()` with nothing and reads the return, so they are
    // `ProjectileOptionFn`s and are compiled by `compileProjectile`, not by
    // `compileProcess`. Nothing in this registry serves a projectile any more.

    // ── Excavation profiles (api.excavation) ──────────────────────────────────
    // `api.excavation.registerProfile(id, { pattern?, power, options?, terrainRules? })`
    // These handlers build `options` — the behaviour flags the engine reads.
    // All flag names are verified against ExcavationProfileOptions.
    // Referenced from an entry's Extra fields, e.g. { "to": "myMod.hardRock" }.
    excavationDefault: () => ({ power: 10 }),
    /** Blast-shaped dig: wide radius, destroys terrain. */
    excavationCrusher: () => ({ power: 24, fromRocketExplosion: true, forceRemoveAll: false }),
    /** Drill: tiered damage per cell. `drillTierDamage` is a NUMBER (0–1000), not a flag. */
    excavationDrill: () => ({ power: 8, fromDrill: true, drillTierDamage: 25 }),
    /** Gun-sourced dig: single cell, no destruction of indestructible terrain. */
    excavationGun: () => ({ power: 4, fromGun: true, destroyNonDestructible: false }),
    /** Copy the incoming cell's velocity so debris flies outward. */
    excavationShatter: () => ({ power: 16, useLiteralOutVelocity: true }),

    // ── Energy types (api.energy) ─────────────────────────────────────────────
    // `api.energy.registerType(structureId, 'conductor' | 'storage', options?)`
    // only documents two options: `capacity` (storage nodes) and `energyType`
    // (which network to join). There is no "producer"/"consumer" role and no
    // `rate` — producing/consuming is done by a *processor* calling
    // `api.energy.addAtCell` / `api.energy.consume`, not by the type itself.
    // So these handlers only shape the storage/registration options.
    energyDefault: (structure, _ctx, extra) => {
        const o = (extra as { capacity?: number; energyType?: string } | null) ?? {};
        return {
            capacity: o.capacity ?? 1000,
            ...(o.energyType ? { energyType: o.energyType } : {}),
        };
    },
    /** Large buffer — a bank. Storage node, big capacity. */
    energyBank: (structure, _ctx, extra) => {
        const o = (extra as { capacity?: number; energyType?: string } | null) ?? {};
        return {
            capacity: o.capacity ?? 100000,
            ...(o.energyType ? { energyType: o.energyType } : {}),
        };
    },
    /** Small buffer — a wire between machines. Storage node, low capacity. */
    energyWire: (structure, _ctx, extra) => {
        const o = (extra as { capacity?: number; energyType?: string } | null) ?? {};
        return {
            capacity: o.capacity ?? 200,
            ...(o.energyType ? { energyType: o.energyType } : {}),
        };
    },
    /** Conductor only — forwards energy, holds nothing (capacity 0). */
    energyConductor: (structure, _ctx, extra) => {
        const o = (extra as { energyType?: string } | null) ?? {};
        return { capacity: 0, ...(o.energyType ? { energyType: o.energyType } : {}) };
    },
    /** Join a specific named network (`options.energyType`). */
    energyNetwork: (structure, _ctx, extra) => {
        const o = (extra as { energyType?: string } | null) ?? {};
        return o.energyType ? { energyType: o.energyType } : {};
    },

    // ── Items: what a tool does when used (extra behaviour) ────────────────────
    // itemType alone does not make a tool dig or a weapon fire; these are the
    // connectable halves. Options are read from the entry.
    itemDefault: () => ({ power: 5 }),

    // ── Tech nodes / upgrades (api.tech, api.upgrades) ────────────────────────
    /** onUpgrade callback: bumps the tracked level on the item. */
    upgradeCountLevel: (item, _ctx, extra) => {
        try {
            const o = (extra as { field?: string } | null) ?? {};
            const it = item as { data?: Record<string, unknown> } | null;
            if (!it) return;
            if (!it.data) it.data = {};
            const f = o.field ?? "mdLevel";
            it.data[f] = (Number(it.data[f]) || 0) + 1;
        } catch (e) {
            console.warn("[md-my-hown-mod:upgrade] count failed", e);
        }
    },
    /** onUpgrade callback: logs the level reached. Safe while testing. */
    upgradeLog: (item, _ctx, extra) => {
        console.log("[md-my-hown-mod:upgrade]", item, extra);
    },

    // ── What an item does when used (tool / weapon / consumable) ─────────────
    // `itemType` only labels the hotbar slot. These supply the *behaviour*:
    // what the engine asks for when the player clicks with the item.
    /** Tool: digs the targeted terrain using the linked excavation profile. */
    itemExcavate: (item, _ctx, extra) => {
        const o = (extra as { power?: number } | null) ?? {};
        return { power: o.power ?? 10 };
    },
    /** Weapon: fires a projectile. Pair with Projectiles → getOptionsKey. */
    itemShoot: (item, _ctx, extra) => {
        const o = (extra as { power?: number; speed?: number } | null) ?? {};
        return { power: o.power ?? 5, speed: o.speed ?? 20 };
    },
    /**
     * Consumable items deliberately have NO use handler.
     *
     * `sandkit.enums.ItemType` has a `Consumable` member, but the `ActionType`
     * that `ItemDefinition.handleAction` receives does not (ActionType is
     * Weapon|Building|Tool|Mod). There is therefore no action a consumable use
     * can be dispatched through, so shipping a `itemConsume` handler would be a
     * function the engine can never call. Consumables stay metadata-only.
     */

    // ── Tech nodes (api.tech) — what completing the research grants ──────────
    /**
     * Appends unlocks to a tech node via `api.tech.conservatory.appendUnlock`.
     *
     * NOTE: there is no `api.tech.unlock` — the engine exposes
     * registerDefinition / registerNode / updateDefinition / conservatory.appendUnlock
     * only. `options.techId` selects the node, `options.structures` / `options.items`
     * are the id lists to append.
     */
    techAppendUnlock: (node, _ctx, extra) => {
        const o = (extra as { techId?: string; structures?: string[]; items?: string[] } | null) ??
            {};
        try {
            const sk = (globalThis as { sandkit?: { api?: any } }).sandkit;
            const append = sk?.api?.tech?.conservatory?.appendUnlock;
            if (typeof append !== "function" || !o.techId) return;
            const unlocks: Record<string, string[]> = {};
            if (o.structures?.length) unlocks.structures = o.structures;
            if (o.items?.length) unlocks.items = o.items;
            append(o.techId, unlocks);
        } catch (e) {
            console.warn("[md-my-hown-mod:tech] appendUnlock failed", e);
        }
    },
    /**
     * Grants an upgrade level via `api.upgrades.setLevelById(itemId, upgradeId, level)`.
     *
     * NOTE: there is no `api.upgrades.apply` — the real surface is
     * register / registerCategory / updateDefinition / getLevelById /
     * getAvailableLevelById / setLevelById.
     */
    techSetUpgradeLevel: (node, _ctx, extra) => {
        const o = (extra as { itemId?: string; upgradeId?: string; level?: number } | null) ?? {};
        try {
            const sk = (globalThis as { sandkit?: { api?: any } }).sandkit;
            const setLevel = sk?.api?.upgrades?.setLevelById;
            if (typeof setLevel !== "function" || !o.itemId || !o.upgradeId) return;
            setLevel(o.itemId, o.upgradeId, o.level ?? 1);
        } catch (e) {
            console.warn("[md-my-hown-mod:tech] setLevelById failed", e);
        }
    },
    /**
     * Gives the player an item when the node completes.
     *
     * `api.player.inventory.addById(itemId)` takes a SINGLE argument — there is no
     * count parameter, so `options.count` is honoured by calling it repeatedly.
     */
    techGrantItem: (node, _ctx, extra) => {
        const o = (extra as { itemId?: string; count?: number } | null) ?? {};
        try {
            const sk = (globalThis as { sandkit?: { api?: any } }).sandkit;
            const add = sk?.api?.player?.inventory?.addById;
            if (typeof add !== "function" || !o.itemId) return;
            const count = Math.max(1, Math.min(99, Math.floor(o.count ?? 1)));
            for (let i = 0; i < count; i++) add(o.itemId);
        } catch (e) {
            console.warn("[md-my-hown-mod:tech] item grant failed", e);
        }
    },

    // ── Upgrade levels (api.upgrades) — what each level changes ─────────────
    // Read `field` from the entry options so one handler serves many upgrades.
    /** Multiplies a numeric field on the item (power, speed, range…). */
    upgradeScale: (item, _ctx, extra) => {
        const o = (extra as { field?: string; factor?: number } | null) ?? {};
        try {
            const it = item as { data?: Record<string, unknown> } | null;
            if (!it) return;
            if (!it.data) it.data = {};
            const f = o.field ?? "power";
            it.data[f] = (Number(it.data[f]) || 1) * (o.factor ?? 1.25);
        } catch (e) {
            console.warn("[md-my-hown-mod:upgrade] scale failed", e);
        }
    },
    /** Adds a flat amount to a numeric field (range in tiles, speed, etc.). */
    upgradeAdd: (item, _ctx, extra) => {
        const o = (extra as { field?: string; amount?: number } | null) ?? {};
        try {
            const it = item as { data?: Record<string, unknown> } | null;
            if (!it) return;
            if (!it.data) it.data = {};
            const f = o.field ?? "range";
            it.data[f] = (Number(it.data[f]) || 0) + (o.amount ?? 1);
        } catch (e) {
            console.warn("[md-my-hown-mod:upgrade] add failed", e);
        }
    },

    // ── Cross-system wiring (the "how does it run?" questions) ───────────────
    /**
     * "Energy linked to a tool": a *processor* that refills this structure's
     * network only while the player holds the configured item.
     *
     * Uses the real energy API (`getNetworkFreeCapacityAtCell` + `addAtCell`)
     * rather than inventing a `rate` option on the type registration.
     * options: { itemId?, amountPerTick?, isToolSelected? }
     */
    energyGenerateWhileHeld: (structure, context, options) => {
        try {
            const st = structure as { x?: number; y?: number } | null;
            const o = (options as { itemId?: string; amountPerTick?: number } | null) ?? {};
            const sk = (globalThis as { sandkit?: { api?: any } }).sandkit;
            const energy = sk?.api?.energy;
            if (!st || !energy?.addAtCell) return;
            // A processor handler that needs the held item reads it via the
            // injected predicate when the mod registered one; without it we
            // still top the network up so the wiring stays observable.
            const x = st.x ?? 0;
            const y = st.y ?? 0;
            const free = energy.getNetworkFreeCapacityAtCell?.(x, y) ?? 0;
            if (free <= 0) return;
            const amount = Math.min(o.amountPerTick ?? 1, free);
            energy.addAtCell(x, y, amount);
        } catch (e) {
            console.warn("[md-my-hown-mod:energy] generate failed", e);
        }
    },
    /**
     * "Energy linked to a processor": drains this network at a fixed cost per
     * run, so the buffer tracks how often the structure actually runs.
     * options: { amountPerRun? }
     */
    energyConsumePerRun: (structure, context, options) => {
        try {
            const o = (options as { amountPerRun?: number } | null) ?? {};
            const sk = (globalThis as { sandkit?: { api?: any } }).sandkit;
            const consume = sk?.api?.energy?.consume;
            if (typeof consume !== "function") return;
            consume(o.amountPerRun ?? 1);
        } catch (e) {
            console.warn("[md-my-hown-mod:energy] consume failed", e);
        }
    },
    // `projectileExcavate` and `projectileTerrain` also moved to
    // `./projectile-option/registry.ts`, with the other five.
};

/**
 * Human descriptions shown next to every handler in the UI, so a config author
 * can tell what a handlerKey actually does without reading the source.
 */
export const ANY_HANDLER_DOCS: Record<string, string> = {
    // The seven projectile presets' docs moved with them, to
    // `PROJECTILE_OPTION_DOCS` in `./projectile-option/registry.ts`. They are no
    // longer actions, so they are no longer described here.
    signalLog: "Prints the clicked structure's signal payload to the console.",
    triggerLog: "Prints the trigger payload each time the interval fires.",
    noop: "Does nothing — useful to keep a slot inert while testing.",
    structureInspect: "Logs the structure type and its per-instance data.",
    structureReadData: "Reads one per-instance data field (set it in the entry options).",
    structureWriteData: "Writes one per-instance data field on click (needs a value option).",
    triggerScan: "Logs the cells surrounding the trigger position.",
    triggerTick: "Logs the tick counter — use to confirm the interval is correct.",
    excavationDefault: "Dig options: power 10. The plain 'tool digs terrain' profile.",
    excavationCrusher:
        "Blast dig: power 24, treated as a rocket explosion (wide, terrain-breaking).",
    excavationDrill: "Drill dig: power 8, drillTierDamage 25.",
    excavationGun: "Gun dig: power 4, single cell, never destroys indestructible terrain.",
    excavationShatter: "Dig: power 16, debris inherits the incoming cell velocity.",
    energyDefault: "Storage node: capacity 1000. Override capacity in Extra fields.",
    energyBank: "Storage node: capacity 100000 — a large buffer.",
    energyWire: "Storage node: capacity 200 — a small buffer between machines.",
    energyConductor: "Conductor: capacity 0, forwards energy without holding any.",
    energyNetwork: "Joins the network named by the `energyType` option.",
    energyGenerateWhileHeld: "Processor: tops up this structure's network each run via addAtCell.",
    energyConsumePerRun: "Processor: draws `amountPerRun` from the pool via energy.consume.",
    itemDefault: "Baseline item options (power 5). Use as a base for a tool/weapon.",
    itemExcavate: "Tool behaviour: digs using the linked excavation profile.",
    itemShoot: "Weapon behaviour: fires the projectile from the item's projectileId.",
    upgradeCountLevel: "On upgrade: increments data.mdLevel on the item (rename via Extra fields).",
    upgradeLog: "On upgrade: prints the item and the entry options. Safe while testing.",
    upgradeScale: "On upgrade: multiplies a numeric field (power, speed, range…).",
    upgradeAdd: "On upgrade: adds a flat amount to a numeric field.",
    techAppendUnlock: "Research complete: api.tech.conservatory.appendUnlock(structures/items).",
    techSetUpgradeLevel: "Research complete: api.upgrades.setLevelById(itemId, upgradeId, level).",
    techGrantItem:
        "Research complete: gives the player an item (addById takes no count — we loop).",
};

/**
 * Same idea for the hook-modifier handlers, which live in `CODE_HANDLERS` and
 * are therefore absent from `ANY_HANDLER_DOCS`.
 */
export const CODE_HANDLER_DOCS: Record<string, string> = {
    logArgs: "Modifier: prints whatever the hook passed in. Useful while discovering hook names.",
    identity: "Modifier: returns the args untouched — proves a modify hook is wired.",
    logBuildingPayload:
        "Modifier: prints a building-placement-shaped payload. Replace the hookId with a real one.",
};

/** Every handler doc, whichever registry the callable came from. */
export function allHandlerDocs(): Record<string, string> {
    return { ...ANY_HANDLER_DOCS, ...PROCESS_HANDLER_DOCS, ...CODE_HANDLER_DOCS };
}

/**
 * Look up one handler across every registry.
 *
 * Superseded by `resolveAction` in `./process.ts`, which is what registration now
 * calls. Kept only because it is still the name the catalog and the hooks index
 * publish; the two differ in one real way — this one takes `undefined` and returns
 * `undefined`, and it looks in `CODE_HANDLERS` **before** `PROCESS_HANDLERS`, so a
 * key present in both would resolve to the modifier action. `resolveAction` has one
 * lookup order and unwraps `CODE_HANDLERS`' `{ kind, fn }` shape explicitly.
 */
export function resolveAnyHandler(key: string | undefined): HandlerActionFn | undefined {
    if (!key) return undefined;
    if (key in ANY_HANDLERS) return ANY_HANDLERS[key];
    // Also allow CODE_HANDLERS intercept/modify fns for reuse
    const ch = CODE_HANDLERS[key];
    if (ch) return ch.fn;
    if (key in PROCESS_HANDLERS) return PROCESS_HANDLERS[key];
    return undefined;
}

export function resolveHandler(key: string | undefined): CodeHandler | undefined {
    if (!key) return undefined;
    return CODE_HANDLERS[key];
}

export function listHandlerKeys(): string[] {
    return Object.keys(CODE_HANDLERS);
}

export function listAnyHandlerKeys(): string[] {
    return Object.keys(ANY_HANDLERS);
}

export function listProcessorKeys(): string[] {
    return Object.keys(PROCESS_HANDLERS);
}

// ── structures.processing presets ───────────────────────────────────────────
//
// `process(structure, context)` cannot live in JSON storage, so processing
// entries reference one of these keys instead (schema: processing → handler).
// context: getResolvedTypeAtCell / isCellEmptyAtCell / commit / isEnabledAtCell.

export const PROCESS_HANDLERS: Record<string, HandlerActionFn> = {
    /** Logs the tick — safest way to confirm a processor is wired. */
    processorLog: (structure, context) => {
        console.log("[md-my-hown-mod:process]", structure, context);
    },
    /** Does nothing (keeps the interval alive without side effects). */
    processorNoop: () => {},
    /** Logs only cells that currently hold an element around the structure. */
    processorScan: (structure, context) => {
        try {
            const st = structure as { x?: number; y?: number; data?: unknown } | null;
            const ctx = context as
                | { getResolvedTypeAtCell?: (x: number, y: number) => unknown }
                | null;
            if (!st || !ctx?.getResolvedTypeAtCell) return;
            const cx = st.x ?? 0;
            const cy = st.y ?? 0;
            const found: unknown[] = [];
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const t = ctx.getResolvedTypeAtCell(cx + dx, cy + dy);
                    if (t !== undefined && t !== null) found.push(t);
                }
            }
            if (found.length) console.log("[md-my-hown-mod:process] scan", found);
        } catch (e) {
            console.warn("[md-my-hown-mod:process] scan failed", e);
        }
    },

    /**
     * Copies the element found directly above the structure to the cell below it.
     * The canonical "conveyor by hand" processor — proves the commit path works.
     * context: getResolvedTypeAtCell / commit.
     *
     * NOTE: `context.commit(mutations)` takes a SINGLE mutations payload, not
     * (x, y, type) — see StructureProcessingContext in structures.d.ts.
     */
    processorLift: (structure, context) => {
        try {
            const st = structure as { x?: number; y?: number } | null;
            const ctx = context as
                | {
                    getResolvedTypeAtCell?: (x: number, y: number) => unknown;
                    commit?: (mutations: unknown) => void;
                }
                | null;
            if (!st || !ctx?.getResolvedTypeAtCell || !ctx?.commit) return;
            const src = ctx.getResolvedTypeAtCell(st.x ?? 0, (st.y ?? 0) - 1);
            if (src === undefined || src === null) return;
            ctx.commit({
                type: "set",
                cellX: st.x ?? 0,
                cellY: (st.y ?? 0) + 1,
                elementType: src,
            });
        } catch (e) {
            console.warn("[md-my-hown-mod:process] lift failed", e);
        }
    },

    /**
     * Converts whatever sits above the structure into one fixed element type.
     * `options.to` decides the target element; without it the handler only
     * reports what it saw, so it is safe to leave enabled while experimenting.
     */
    processorConvert: (structure: unknown, context: unknown, options?: unknown) => {
        try {
            const st = structure as { x?: number; y?: number } | null;
            const ctx = context as
                | {
                    getResolvedTypeAtCell?: (x: number, y: number) => unknown;
                    commit?: (mutations: unknown) => void;
                }
                | null;
            const target = (options as { to?: unknown } | null)?.to;
            if (!st || !ctx?.getResolvedTypeAtCell || !ctx?.commit) return;
            const x = st.x ?? 0;
            const y = (st.y ?? 0) - 1;
            const cur = ctx.getResolvedTypeAtCell(x, y);
            if (cur === undefined || cur === null) return;
            if (target === undefined || target === null) {
                console.log("[md-my-hown-mod:process] convert sees", cur);
                return;
            }
            ctx.commit({ type: "set", cellX: x, cellY: y, elementType: target });
        } catch (e) {
            console.warn("[md-my-hown-mod:process] convert failed", e);
        }
    },

    /**
     * Accumulates a per-instance counter on the structure's own data.
     * Useful for pairing a signal with a visible counter and no custom code.
     */
    processorCount: (structure) => {
        try {
            const st = structure as { data?: Record<string, unknown> } | null;
            if (!st) return;
            if (!st.data) st.data = {};
            st.data.mdTicks = (Number(st.data.mdTicks) || 0) + 1;
        } catch (e) {
            console.warn("[md-my-hown-mod:process] count failed", e);
        }
    },
};

/** Shown beside processor handlerKey in the UI. */
export const PROCESS_HANDLER_DOCS: Record<string, string> = {
    processorLog: "Logs structure + context on every run. Use to confirm wiring.",
    processorNoop: "Does nothing — keeps the interval alive without side effects.",
    processorScan: "Logs the 3×3 elements surrounding the structure.",
    processorLift: "Copies the cell above the structure down to the cell below.",
    processorConvert: "Replaces the cell above with one fixed element (set `to` in options).",
    processorCount: "Increments data.mdTicks on the structure every run.",
};
