/**
 * Apply stored JSON config → sandkit registration APIs (all categories).
 */
import { LOG, type ModConfig, type StructureConfig } from "../constants.ts";
import {
    api,
    registerContact,
    registerEnergyType,
    registerExcavationProfile,
    registerInputBinding,
    registerInteraction,
    registerProcessing,
    registerProjectile,
    registerRecipe,
    registerSignal,
    registerSprite,
    registerStructureBehavior,
    registerTech,
    registerTerrain,
    registerTrigger,
    registerUpgrade,
    registerUpgradeCategory,
} from "../packages/mysandkit.ts";
import { loadConfig } from "../config/store.ts";
import { engineTechOf, isAlwaysUnlocked, techUnlockStructureIds } from "../ui/tech-link.ts";
import {
    actionRefsOf,
    applyAllModifiers,
    compileProcess,
    detachAllModifiers,
} from "../hooks/index.ts";

/**
 * The built-in `draw` functions, keyed as they are in the config.
 *
 * `structures.register` does `T(id, def.draw)` and the render loop then calls
 * it as `fn(session, instance, {tilemap, ctx, useTilemap, placing, opts})`,
 * where returning `false` falls through to the normal sprite render. A *string*
 * would not throw — it would simply stop drawing — which is why the config
 * stores a key and this is where the key becomes a function.
 *
 * Every renderer here is written against the API a shipping mod actually uses
 * (`__scraped-mods/workshop/3791498201`): `context.ctx`, `structure.x/.y`,
 * `structure.data`, `api.rendering.getGridMetrics()` and
 * `api.rendering.getDrawPositionAtCell()`. Nothing here is guessed.
 *
 * The canvas-state reset in `safeCanvas` is not optional. That mod's comment is
 * worth quoting because it is a trap that produces no error:
 *
 *   "Tool/weapon effects can leave temporary canvas state active while custom
 *    structure draw callbacks run. If inherited, filters/compositing can make
 *    the silo sprite render solid black and keep repainting that way."
 *
 * The camera transform is deliberately NOT reset — the engine still needs it.
 */
type DrawCtx = {
    ctx?: {
        save(): void;
        restore(): void;
        strokeRect(x: number, y: number, w: number, h: number): void;
        strokeStyle: string;
        lineWidth: number;
        globalAlpha: number;
        globalCompositeOperation: string;
        filter: string;
        shadowBlur: number;
        shadowOffsetX: number;
        shadowOffsetY: number;
        shadowColor: string;
    };
    useTilemap?: boolean;
    placing?: boolean;
};

/** What a draw function needs to know about the structure it is drawing. */
export interface DrawContext {
    /** Footprint width in cells, from the registered `shape`. */
    wCells: number;
    hCells: number;
}

/**
 * Normalise the canvas state a custom draw callback inherits.
 *
 * Anything left dirty by a tool or weapon effect tints the structure, and in
 * practice renders it solid black with no error to explain why. Deliberately
 * leaves the transform alone — the engine's camera transform is still required.
 */
function safeCanvas(ctx: NonNullable<DrawCtx["ctx"]>): void {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    try {
        ctx.filter = "none";
    } catch { /* older canvas impls */ }
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowColor = "rgba(0,0,0,0)";
}

/**
 * Cell size in pixels, from the host's render API.
 *
 * Read through `api.raw`, because the mod's own `api` wrapper is a curated
 * subset of the host surface and does not carry `rendering`. Falls back to 4 —
 * the engine's own default — so a host without it still draws at the right
 * scale rather than not at all.
 */
function gridMetrics(): { cellSize: number } {
    const m = (api.raw as
        | { rendering?: { getGridMetrics?: () => { cellSize?: number } } }
        | undefined)?.rendering?.getGridMetrics?.();
    return { cellSize: m?.cellSize ?? 4 };
}

/** Top-left pixel of a cell, in world space. */
function drawPosAt(x: number, y: number): { x: number; y: number } {
    const p = (api.raw as
        | {
            rendering?: {
                getDrawPositionAtCell?: (cx: number, cy: number) => { x: number; y: number };
            };
        }
        | undefined)?.rendering?.getDrawPositionAtCell?.(x, y);
    return p ?? { x: x * 4, y: y * 4 };
}

/** Consume the frame without drawing: placed, simulates, invisible. */
const hidden = () => true;

/**
 * Stroke a 1px outline around the footprint, then let the engine draw the
 * sprite as normal.
 *
 * Returning `false` is the documented way to say "I have not handled this
 * frame", so the outline sits on top of the normal render rather than replacing
 * it. Useful for seeing a footprint's true extent, which a large structure's
 * sprite can make ambiguous.
 */
function makeOutline({ wCells, hCells }: DrawContext) {
    return (
        _session: unknown,
        structure: unknown,
        context: unknown,
    ): boolean => {
        const ctx = (context as DrawCtx | undefined)?.ctx;
        const at_cell = structure as { x?: number; y?: number } | undefined;
        if (!ctx || typeof at_cell?.x !== "number" || typeof at_cell?.y !== "number") {
            return false;
        }
        try {
            const { cellSize } = gridMetrics();
            const at = drawPosAt(at_cell.x, at_cell.y);
            safeCanvas(ctx);
            ctx.lineWidth = 1;
            ctx.strokeStyle = "rgba(120, 200, 255, 0.9)";
            ctx.strokeRect(
                at.x + 0.5,
                at.y + 0.5,
                Math.max(1, wCells * cellSize) - 1,
                Math.max(1, hCells * cellSize) - 1,
            );
            ctx.restore();
        } catch { /* never break the render loop */ }
        // false = the engine still draws the sprite underneath.
        return false;
    };
}

/**
 * Build the draw function for a stored `drawKey`.
 *
 * `default` (and anything unknown) means "no custom draw", so the key is
 * dropped rather than passed through — registering a passthrough function would
 * cost a lookup per structure per frame for no benefit.
 */
export function resolveDraw(st: StructureConfig): StructureConfig {
    // `unlockTech` is ours, not the engine's, and the engine has no use for it —
    // it reads the same relation off the *tech* as `unlocks.structures`. Stripped
    // here, in the one place every structure passes through, rather than in the
    // save path where a new caller would forget.
    const { drawKey, unlockNode: _ours, ...rest } = st;
    if (!drawKey || drawKey === "default") return rest;
    // The footprint is only known here, at registration, so it is closed over
    // rather than looked up per frame.
    //
    // `shape` is `[row][col]`: the outer array is rows, the inner is columns.
    // So the *width* in cells is `shape[0].length` and the *height* is
    // `shape.length`. Getting these the wrong way round produces an outline
    // that is right for a square footprint and silently wrong for every other
    // one, which is why the axis is spelled out here rather than left to a
    // reader.
    const shape = Array.isArray(st.shape) ? st.shape : [];
    const ctx: DrawContext = {
        wCells: Math.max(1, shape[0]?.length || 1),
        hCells: Math.max(1, shape.length || 1),
    };
    if (drawKey === "hidden") return { ...rest, draw: hidden };
    if (drawKey === "outline") return { ...rest, draw: makeOutline(ctx) };
    return rest;
}

const registered: Record<string, Set<string>> = {
    sprites: new Set<string>(),
    elements: new Set<string>(),
    structures: new Set<string>(),
    items: new Set<string>(),
    recipes: new Set<string>(),
    processing: new Set<string>(),
    contacts: new Set<string>(),
    interactions: new Set<string>(),
    modifiers: new Set<string>(),
};

export function clearRegistrationCache(): void {
    for (const s of Object.values(registered)) s.clear();
    detachAllModifiers();
}

/**
 * What this mod has registered, right now — a copy, so it survives the cache
 * being cleared.
 *
 * Needed because the engine has **no unregister** for content kinds. The only
 * `unregister` in the whole engine is `ui.unregister` for overlays; structures,
 * elements, items and the rest can only be added or replaced, never removed
 * (verified across the engine bundle and the sandkit typings). So deleting an
 * entry from the config cannot un-do the registration — the old definition stays
 * live until the game reloads, and the only honest response is to say so.
 */
export function snapshotRegistered(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const [cat, ids] of Object.entries(registered)) out[cat] = [...ids];
    return out;
}

/**
 * Ids that were registered before but are gone from `cfg` now.
 *
 * These are the ones the game is still holding. Reported rather than silently
 * ignored, because "I deleted it and it is still in the build menu" is exactly
 * the kind of thing that makes an authoring panel feel broken.
 */
export function staleAfter(
    cfg: ModConfig,
    prev: Record<string, string[]>,
): { cat: string; id: string }[] {
    const out: { cat: string; id: string }[] = [];
    for (const [cat, ids] of Object.entries(prev)) {
        // `registered` is keyed by config key already — `applyConfig` reads
        // `config.sprites`, `config.structures` and so on with the same names, so
        // there is no mapping to look up and none to get out of step.
        const list = (cfg as unknown as Record<string, unknown>)[cat];
        if (!Array.isArray(list)) continue;
        const live = new Set(
            list.map((e) => (e as { id?: unknown } | null)?.id).filter((v): v is string =>
                typeof v === "string"
            ),
        );
        for (const id of ids) if (!live.has(id)) out.push({ cat, id });
    }
    return out;
}

/**
 * Categories the engine can patch in place.
 *
 * Verified in the sandkit `.d.ts`: elements, structures, items, techs, terrains
 * and upgrades all expose `updateDefinition`. Without this, editing an *existing*
 * entry and saving was a no-op, because `applyConfig` skips any id already in
 * its registration cache — the game kept the old definition while the UI
 * reported success.
 */
type UpdateFn = (id: string, partial: Record<string, unknown>) => void;

const UPDATABLE: Record<string, UpdateFn> = {
    elements: (id, p) => api.elements.updateDefinition(id, p),
    structures: (id, p) => api.structures.updateDefinition(id, p),
    items: (id, p) => api.items.updateDefinition(id, p),
    techs: (id, p) => api.tech.updateDefinition(id, p),
    terrains: (id, p) => api.terrains.updateDefinition(id, p),
    // Upgrades are keyed by (itemId, upgradeId). The engine's upgradeId is the
    // *nested* `upgrade.id`, not the entry's own `id` (see UpgradeConfig).
    upgrades: (id, p) => {
        const nested = p.upgrade as { id?: string } | undefined;
        api.upgrades.updateDefinition(
            String(p.itemId ?? ""),
            String(nested?.id ?? id),
            p,
        );
    },
};

/**
 * Push one edited entry into the live game.
 *
 * Returns true when the engine actually accepted the update. Categories without
 * an `updateDefinition` are re-registered instead, after dropping their cache
 * entry so the next `applyConfig` pass will not skip them.
 */
export function updateEntry(cat: string, id: string, entry: Record<string, unknown>): boolean {
    const patch = UPDATABLE[cat];
    if (!patch) {
        // No in-place update: forget the id so a later apply re-registers it.
        registered[cat]?.delete(id);
        return false;
    }
    try {
        // `id` is part of the definition; the engine keys on it, so drop it from
        // the partial to avoid an id/handle mismatch.
        const { id: _drop, ...partial } = entry;
        patch(id, partial);
        return true;
    } catch (e) {
        console.warn(`${LOG} updateDefinition failed for ${cat} ${id}`, e);
        registered[cat]?.delete(id);
        return false;
    }
}

/**
 * Put every registered structure in front of the player.
 *
 * **Unconditional, and that is the point.** The build menu iterates
 * `player.buildings` and reads each definition from the vanilla registry *or* the
 * mod registry (bundel.js 7493921), so the only thing between a registered
 * structure and the menu is membership of that list.
 *
 * The field that looks like it should control this, `alwaysUnlocked`, cannot: the
 * engine reads it in exactly one place, and that place iterates a `const` object
 * literal holding the *vanilla* structures (bundel.js 5251.js, `Ue`) which has
 * zero assignment sites, so a mod id never enters it. The flag is inert for any
 * mod — which is why the panel no longer offers it. A control that silently does
 * nothing is worse than no control.
 *
 * A tech is the *other* route in, and a better one: the engine grants a node's
 * `unlocks.structures` on purchase, pushing each id into `player.buildings`
 * (bundel.js 77135.js, `fe`). A structure that names one is therefore left
 * alone here and waits to be researched — see `src/ui/tech-link.ts` for why the
 * link lives on the structure.
 *
 * `hideFromBuildMenu` is left alone. Unlocking and hiding are independent, and
 * unlocked-but-hidden is exactly how a mod offers a buildable type that only its
 * own UI can select with `building.selectStructure` (md-big-brother does this).
 *
 * Idempotent — the engine's `add` is `includes(t) || push(t)` — so this is safe
 * to call on every apply.
 */
export function unlockStructures(cfg: ModConfig): number {
    let n = 0;
    for (const st of cfg.structures ?? []) {
        if (!st?.id) continue;
        // A dangling link must not gate anything, or the structure would be
        // unreachable and the player would never know why. See `unlockTechOf`.
        if (!isAlwaysUnlocked(st.id, cfg)) {
            // Withdraw any unlock this mod handed out earlier. A structure gated
            // after being force-unlocked would otherwise stay in the menu until
            // the game was reloaded, and the change would look ignored.
            api.player.buildings.removeById(st.id);
            continue;
        }
        if (api.player.buildings.unlockByType(st.id)) n++;
    }
    // Warn once, and only when there was something to unlock. A silent no-op here
    // is the whole failure this function exists to prevent, so it must not be one
    // itself — the usual cause is the mod loading on a worker, where `player`
    // does not exist.
    const ungated = (cfg.structures ?? []).filter((s) => s?.id && isAlwaysUnlocked(s.id, cfg));
    if (n === 0 && ungated.length > 0) {
        console.warn(
            `${LOG} structures could not be unlocked — ` +
                `api.player.buildings.unlockByType is unavailable on this thread, ` +
                `so the build menu will be empty`,
        );
    }
    return n;
}

export function applyConfig(cfg?: ModConfig): void {
    const config = cfg ?? loadConfig();
    let nEl = 0, nSt = 0, nIt = 0, nRe = 0, nPr = 0, nCt = 0, nIx = 0, nMod = 0;
    let nTe = 0,
        nTech = 0,
        nUC = 0,
        nUp = 0,
        nPj = 0,
        nEn = 0,
        nEx = 0,
        nSb = 0,
        nSg = 0,
        nTr = 0,
        nSp = 0,
        nIn = 0;

    // Sprites first so items/structures can reference them
    for (const sp of config.sprites ?? []) {
        if (!sp?.id || registered.sprites?.has(sp.id)) continue;
        void registerSprite(sp);
        registered.sprites = registered.sprites || new Set();
        registered.sprites.add(sp.id);
        nSp++;
    }

    for (const el of config.elements) {
        if (!el?.id || registered.elements.has(el.id)) continue;
        const res = api.elements.register(el);
        if (res !== undefined) {
            registered.elements.add(el.id);
            nEl++;
        }
    }
    for (const st of config.structures) {
        if (!st?.id || registered.structures.has(st.id)) continue;
        api.structures.register(resolveDraw(st));
        registered.structures.add(st.id);
        nSt++;
    }
    unlockStructures(config);
    for (const it of config.items) {
        if (!it?.id || registered.items.has(it.id)) continue;
        api.items.register(it);
        registered.items.add(it.id);
        nIt++;
    }
    for (const r of config.recipes) {
        if (!r?.id || registered.recipes.has(r.id)) continue;
        registerRecipe(r);
        registered.recipes.add(r.id);
        nRe++;
    }
    for (const p of config.processing) {
        if (!p?.id || registered.processing.has(p.id)) continue;
        // process() cannot live in JSON — compile the process first.
        const entry = p as Record<string, unknown>;
        if (typeof entry.process !== "function") {
            // A process, not a key: an ordered list of actions, each with its own
            // options. This is the call that finally delivers them — the engine
            // passes only `(structure, context)`, so `processorConvert`'s required
            // `to` used to arrive as `undefined` and the action could never fire.
            const { fn, skipped } = compileProcess(actionRefsOf(entry), "processing");
            if (skipped.length) {
                console.warn(`${LOG} processing ${p.id}: unknown action ${skipped.join(", ")}`);
            }
            entry.process = fn;
        }
        registerProcessing(p);
        registered.processing.add(p.id);
        nPr++;
    }
    for (const c of config.contacts ?? []) {
        if (!c?.id || registered.contacts.has(c.id)) continue;
        registerContact(c);
        registered.contacts.add(c.id);
        nCt++;
    }
    for (const ix of config.interactions ?? []) {
        if (!ix?.id || registered.interactions.has(ix.id)) continue;
        registerInteraction(ix);
        registered.interactions.add(ix.id);
        nIx++;
    }

    nMod = applyAllModifiers(config.modifiers ?? []);
    for (const m of config.modifiers ?? []) {
        if (m?.id) registered.modifiers.add(m.id);
    }

    for (const t of config.terrains ?? []) {
        if (!t?.id || (registered as any).terrains?.has(t.id)) continue;
        registerTerrain(t);
        (registered as any).terrains = (registered as any).terrains || new Set();
        (registered as any).terrains.add(t.id);
        nTe++;
    }
    for (const t of config.techs ?? []) {
        if (!t?.id || (registered as any).techs?.has(t.id)) continue;
        // The engine reads `unlocks.structures` off the *tech*, while a structure
        // names an unlock *node*, so the tech is handed the union. Without this a
        // structure whose node builds or borrows this tech would never be granted,
        // and the node would silently do nothing — the same class of bug as
        // `alwaysUnlocked`, in the opposite direction.
        const ids = techUnlockStructureIds(t.id, config);
        registerTech(ids.length ? { ...t, unlocks: { ...(t.unlocks ?? {}), structures: ids } } : t);
        (registered as any).techs = (registered as any).techs || new Set();
        (registered as any).techs.add(t.id);
        nTech++;
    }
    // A "tech"-kind node *builds* a real engine tech, which is what makes a node
    // and an in-game research step the same thing to edit. Registered after the
    // hand-written techs so a node's union already includes everything, and
    // skipped when it borrows one so the borrowed definition is never overwritten.
    for (const n of config.unlockNodes ?? []) {
        if (!n?.id || n.kind !== "tech" || n.techId) continue;
        if ((registered as any).techs?.has(n.id)) continue;
        const tech = engineTechOf(n, config);
        if (!tech) continue;
        registerTech(tech);
        (registered as any).techs = (registered as any).techs || new Set();
        (registered as any).techs.add(n.id);
        nTech++;
    }
    for (const u of config.upgradeCategories ?? []) {
        if (!u?.id || (registered as any).upgradeCategories?.has(u.id)) continue;
        registerUpgradeCategory(u);
        (registered as any).upgradeCategories = (registered as any).upgradeCategories || new Set();
        (registered as any).upgradeCategories.add(u.id);
        nUC++;
    }
    for (const u of config.upgrades ?? []) {
        if (!u?.id || (registered as any).upgrades?.has(u.id)) continue;
        registerUpgrade(u);
        (registered as any).upgrades = (registered as any).upgrades || new Set();
        (registered as any).upgrades.add(u.id);
        nUp++;
    }
    for (const p of config.projectiles ?? []) {
        if (!p?.id || (registered as any).projectiles?.has(p.id)) continue;
        // The one slot where the process' *return* reaches the engine: these actions
        // are `getOptions` factories, and `mergeProcessValue` combines what they
        // return. `mysandkit` synthesises a `getOptions` only if we left it unset.
        const entry = p as Record<string, unknown>;
        if (typeof entry.getOptions !== "function") {
            entry.getOptions = compileProcess(actionRefsOf(entry), "projectile").fn as never;
        }
        registerProjectile(p);
        (registered as any).projectiles = (registered as any).projectiles || new Set();
        (registered as any).projectiles.add(p.id);
        nPj++;
    }
    for (const e of config.energyTypes ?? []) {
        if (!e?.id || (registered as any).energyTypes?.has(e.id)) continue;
        registerEnergyType(e);
        (registered as any).energyTypes = (registered as any).energyTypes || new Set();
        (registered as any).energyTypes.add(e.id);
        nEn++;
    }
    for (const e of config.excavationProfiles ?? []) {
        if (!e?.id || (registered as any).excavationProfiles?.has(e.id)) continue;
        registerExcavationProfile(e);
        (registered as any).excavationProfiles = (registered as any).excavationProfiles ||
            new Set();
        (registered as any).excavationProfiles.add(e.id);
        nEx++;
    }
    for (const b of config.structureBehaviors ?? []) {
        if (!b?.id || (registered as any).structureBehaviors?.has(b.id)) continue;
        registerStructureBehavior(b);
        (registered as any).structureBehaviors = (registered as any).structureBehaviors ||
            new Set();
        (registered as any).structureBehaviors.add(b.id);
        nSb++;
    }
    for (const sg of config.signals ?? []) {
        if (!sg?.id || (registered as any).signals?.has(sg.id)) continue;
        // `actionRefsOf` migrates a pre-split `handlerKey` to a one-action process,
        // so an existing config registers exactly as it did before the split.
        registerSignal(
            sg,
            compileProcess(actionRefsOf(sg as Record<string, unknown>), "signal").fn as never,
        );
        (registered as any).signals = (registered as any).signals || new Set();
        (registered as any).signals.add(sg.id);
        nSg++;
    }
    for (const tr of config.triggers ?? []) {
        if (!tr?.id || (registered as any).triggers?.has(tr.id)) continue;
        // The engine calls a trigger's callback with **no arguments** — `extra` goes
        // in the registration, not the call — so the process is what finally hands
        // the options to the action.
        registerTrigger(
            tr,
            compileProcess(actionRefsOf(tr as Record<string, unknown>), "trigger").fn as never,
        );
        (registered as any).triggers = (registered as any).triggers || new Set();
        (registered as any).triggers.add(tr.id);
        nTr++;
    }

    // Input bindings: `handlers` is a function pair, so the stored keys are
    // resolved to functions here rather than in the config.
    for (const b of config.inputBindings ?? []) {
        if (!b?.id || (registered as any).inputBindings?.has(b.id)) continue;
        const entry = { ...b } as Record<string, unknown>;
        for (const slot of ["onDownKey", "onUpKey"] as const) {
            const key = b[slot];
            if (!key) continue;
            // Input bindings still store a bare key rather than a list — they are a
            // function *pair* on one entry, not one process, and there is no place
            // to put a list. A one-action process is the whole of it.
            const { fn, skipped } = compileProcess(actionRefsOf({ handlerKey: key }), "behavior");
            if (typeof fn === "function" && !skipped.length) entry[slot] = fn as never;
            else console.warn(`${LOG} input binding ${b.id}: unknown ${slot} "${key}"`);
        }
        registerInputBinding(entry as never);
        (registered as any).inputBindings = (registered as any).inputBindings || new Set();
        (registered as any).inputBindings.add(b.id);
        nIn++;
    }

    console.log(
        `${LOG} applied: el${nEl} st${nSt} it${nIt} re${nRe} pr${nPr} ct${nCt} ix${nIx} mod${nMod} te${nTe} tech${nTech} uc${nUC} up${nUp} pj${nPj} en${nEn} ex${nEx} sb${nSb} sg${nSg} tr${nTr} sp${nSp} in${nIn}`,
    );
}

export function reapplyFromStorage(): void {
    applyConfig(loadConfig());
}
