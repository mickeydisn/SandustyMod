/**
 * Structure registration, drawing, and unlocking.
 *
 * A structure needs three things before it is really in the game, and they used
 * to be scattered through `apply.ts`:
 *
 * 1. **Registration** — worker-scoped, like elements (see `registry.ts`), so it
 *    has to happen inside the boot window or it never reaches the simulation.
 * 2. **A draw function** — the config stores a *key* like `"outline"`, and a
 *    string is not drawable. It has to become a real function at registration
 *    time, or the structure registers and then silently never draws.
 * 3. **Unlocking** — registered is not the same as reachable. A structure is
 *    only in the build menu if it is in `player.buildings`, a separate push.
 *
 * Keeping them together is the point: (3) is easy to forget, and a structure
 * that is registered but not unlocked is a control that does nothing — the exact
 * failure `alwaysUnlocked` already turned out to be.
 */
import { LOG, type ModConfig, type StructureConfig } from "../../constants.ts";
import { loadConfig } from "../../config/store.ts";
import { api } from "../../packages/mysandkit.ts";
import { isAlwaysUnlocked } from "../../ui/tech-link.ts";
import { mayRegister, registered } from "../registry.ts";

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
    /** Footprint height in cells, from the registered `shape`. */
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
 *
 * Exported for `draw.test.ts`, which checks the key→function mapping without
 * standing up a structure.
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

/**
 * Register every structure in `cfg`, then put them in front of the player.
 *
 * Safe to call repeatedly: ids already in the shared guard are skipped, so a
 * boot pass and a later panel "Apply" cannot register the same structure twice.
 */
export function registerStructures(cfg?: ModConfig): number {
    const config = cfg ?? loadConfig();
    let n = 0;
    for (const st of config.structures ?? []) {
        if (!st?.id) continue;
        if (registered.structures.has(st.id)) continue;
        if (!mayRegister("structures", st.id)) continue;
        api.structures.register(resolveDraw(st));
        registered.structures.add(st.id);
        n++;
    }
    // Unlocking is separate from registering, and runs on every pass rather than
    // only the one that registered: `player.buildings` is a plain list the engine
    // owns, so a structure can be removed from it by a tech or a save without the
    // registration changing at all. Skipping it here would leave a structure
    // registered, drawn and permanently unreachable.
    unlockStructures(config);
    return n;
}

/**
 * Put every registered structure in front of the player.
 *
 * **Unconditional, and that is the point.** The build menu iterates
 * `player.buildings` and reads each definition from the vanilla registry *or* the
 * mod registry (bundel.js 7493921), so the only thing between a registered
 * structure and the menu is membership of that list.
 *
 * The field that looks like it should control this, `alwaysUnlocked`, cannot:
 * the engine reads it in exactly one place, and that place iterates a `const` object
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
        // `unlockById`, not `unlockByType` — the latter is @deprecated in both
        // type sets. The wrapper returns whether the engine call happened, which
        // is what the post-check below needs; a plain void call would make that
        // warning unreachable.
        if (api.player.buildings.unlockById(st.id)) n++;
    }
    // Warn once, and only when there was something to unlock. A silent no-op here
    // is the whole failure this function exists to prevent, so it must not be one
    // itself — the usual cause is the mod loading on a worker, where `player`
    // does not exist.
    const ungated = (cfg.structures ?? []).filter((s) => s?.id && isAlwaysUnlocked(s.id, cfg));
    if (n === 0 && ungated.length > 0) {
        console.warn(
            `${LOG} structures could not be unlocked — ` +
                `api.player.buildings.unlockById is unavailable on this thread, ` +
                `so the build menu will be empty`,
        );
    }
    return n;
}
