/**
 * Cartoon spiral aura drawn around a placed artefact.
 *
 * The animation is driven by a counter that lives ONLY in this module's
 * `Map` — it is deliberately never written into `structure.data`, so it is not
 * persisted and never reaches a save file. It increments by
 * `ARTEFACT_SPIRAL_STEP` each time the render hook runs, and that running
 * total is the "time" input for the spiral geometry.
 *
 * The draw hook is `(state, structure, render) => boolean` and is registered
 * separately from the definition so the stored definition stays serializable
 * (the engine pulls `draw` out of the object and registers it by id).
 * Returning `false` lets the engine still draw the normal sprite — we only add
 * the aura on top.
 */
import "@sandmd/sandkit";
import {
    ARTEFACT_EMIT_SPEED,
    ARTEFACT_SPIRAL_ALPHA,
    ARTEFACT_SPIRAL_ARMS,
    ARTEFACT_SPIRAL_COLOR_EMPTY,
    ARTEFACT_SPIRAL_COLOR_FULL,
    ARTEFACT_SPIRAL_INK,
    ARTEFACT_SPIRAL_INNER_PX,
    ARTEFACT_SPIRAL_MARGIN_PX,
    ARTEFACT_SPIRAL_MAX_PX,
    ARTEFACT_SPIRAL_SPIN,
    ARTEFACT_SPIRAL_STEP,
    ARTEFACT_SPIRAL_TURN_DEG,
    LOG,
} from "../constants.ts";
import { createElementAt } from "./elements.ts";

/** Render-frame counters keyed by "x,y". Runtime only — never persisted. */
const counters = new Map<string, number>();

function key(x: number, y: number): string {
    return `${x},${y}`;
}

/** Current counter for a cell without advancing it (debug/introspection). */
export function peekSpiralCounter(x: number, y: number): number {
    return counters.get(key(x, y)) ?? 0;
}

/** Drop a cell's counter — call when the artefact goes away. */
export function forgetSpiralCounter(x: number, y: number): void {
    counters.delete(key(x, y));
}

/**
 * Advance and return the counter for this frame. Always +STEP, never wraps.
 *
 * This is the "time" input shared by the drawing and the element-emission
 * angles, which is what makes the two read as a single motion.
 */
function advance(x: number, y: number): number {
    const k = key(x, y);
    const next = (counters.get(k) ?? 0) + ARTEFACT_SPIRAL_STEP;
    counters.set(k, next);
    return next;
}

/** Snap a runtime counter back to 0 once the structure is gone. */
export function pruneSpiralCounters(alive: Set<string>): void {
    for (const k of counters.keys()) {
        if (!alive.has(k)) counters.delete(k);
    }
}

/**
 * Launch direction for the n-th element emitted this tick.
 *
 * Uses the same counter as the spiral so the puff sweeps in step with the
 * drawing — the two read as one motion rather than two unrelated effects.
 */
export function emitAngleFor(counter: number, index: number): number {
    const arms = Math.max(1, ARTEFACT_SPIRAL_ARMS);
    const base = counter * ARTEFACT_SPIRAL_SPIN * ARTEFACT_SPIRAL_TURN_DEG *
        (Math.PI / 180);
    return base + (index * Math.PI * 2) / arms;
}

/**
 * Same angle as {@link emitAngleFor}, resolved to a velocity vector.
 *
 * Returned rather than having the caller do the trig, so the magnitude can
 * never drift out of sync with `ARTEFACT_EMIT_SPEED`.
 */
export function emitVelocityFor(
    counter: number,
    index: number,
    speed = ARTEFACT_EMIT_SPEED,
): { x: number; y: number } {
    const a = emitAngleFor(counter, index);
    return { x: Math.cos(a) * speed, y: Math.sin(a) * speed };
}

/**
 * Give a freshly created element a small outward push along the spiral angle.
 *
 * UNITS: `velocity` is a Vector2 in **cells per second**, not cells per tick —
 * see `ARTEFACT_EMIT_SPEED`. Getting this backwards makes the nudge ~60x too
 * weak and it looks like nothing happens.
 *
 * MEASURED BEHAVIOUR: on a plain Powder (sand) this call stores the velocity
 * (`getVelocityAtCell` reads it straight back) but does **not** displace the
 * cell horizontally — the sand just falls. Only elements spawned through
 * `createAtCell(..., { particle: { velocity } })` actually fly, because that
 * spawns them as particles. So this helper is best-effort garnish; the visible
 * motion comes from the particle spawn option.
 *
 * Failures are swallowed: the element is still created, it just does not get
 * the flourish.
 */
export function nudgeElementVelocity(
    x: number,
    y: number,
    angle: number,
    speed = ARTEFACT_EMIT_SPEED,
): void {
    const api = sandkit.api;
    const bag = api.elements as unknown as Record<string, unknown>;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    for (const name of ["setVelocityAtCell", "setVelocityAtCellWhenIdle"]) {
        const fn = bag?.[name];
        if (typeof fn !== "function") continue;
        try {
            (fn as (a: number, b: number, c?: unknown) => void).call(
                api.elements,
                x,
                y,
                { x: vx, y: vy },
            );
            return;
        } catch { /* try the next spelling */ }
    }
}

/**
 * Create one emitted element AND give it its launch velocity.
 *
 * This is the only spawn form that actually moves the material. Measured
 * against sand at 14 cells/s:
 *
 *   - `createAtCell(x, y, type)` then `setVelocityAtCell(...)`
 *       → `getVelocityAtCell` reads the value back, but the cell never
 *         travels horizontally. A plain Powder ignores it.
 *   - `createAtCell(x, y, type, { particle: { velocity } })`
 *       → spawns the cell AS a particle, and it genuinely flies outward.
 *
 * So the particle option is the primary path and the create + setVelocity pair
 * is only the fallback for engines that reject the options argument.
 *
 * Returns true when the particle spawn (the one that moves) was used.
 */
export function spawnEmittedElement(
    x: number,
    y: number,
    elmType: number,
    counter: number,
    index: number,
): boolean {
    const api = sandkit.api;
    const bag = api.elements as unknown as Record<string, unknown>;
    const velocity = emitVelocityFor(counter, index);

    for (
        const name of [
            "createAtCellWhenIdle",
            "createAtCell",
        ]
    ) {
        const fn = bag?.[name];
        if (typeof fn !== "function") continue;
        try {
            (fn as (a: number, b: number, c: number, d?: unknown) => void).call(
                api.elements,
                x,
                y,
                elmType,
                { particle: { velocity } },
            );
            return true;
        } catch { /* try the next spelling / fall back */ }
    }

    // Fallback: plain create, then nudge. Velocity is stored but a Powder will
    // most likely not move — still better than emitting a motionless cell.
    createElementAt(x, y, elmType);
    nudgeElementVelocity(x, y, emitAngleFor(counter, index));
    return false;
}

/**
 * Colour for the current remaining-count, ramped green → red.
 *
 * `ratio` is `remaining / max`: 1 = plenty left (green), 0 = about to vanish
 * (red). Returns `rgb(...)` so the caller can reuse it for the ink pass.
 */
export function spiralColorForRatio(ratio: number): string {
    const t = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 1));
    const [fr, fg, fb] = ARTEFACT_SPIRAL_COLOR_FULL;
    const [er, eg, eb] = ARTEFACT_SPIRAL_COLOR_EMPTY;
    const r = Math.round(er + (fr - er) * t);
    const g = Math.round(eg + (fg - eg) * t);
    const b = Math.round(eb + (fb - eb) * t);
    return `rgb(${r},${g},${b})`;
}

/**
 * Build the `draw` hook for the artefact definition.
 *
 * Real engine signature, read off the shipped bundle's render path:
 *   `M[String(type)](session, structure, {tilemap, ctx, useTilemap, placing, opts})`
 * Returning `false` lets the engine continue with its normal sprite draw, so
 * the aura is purely additive.
 */
export function createArtefactSpiralDraw(): (
    session: unknown,
    structure: { x: number; y: number; data?: Record<string, unknown> },
    render?: { ctx?: CanvasRenderingContext2D; placing?: boolean },
) => boolean {
    return function drawSpiral(
        _session: unknown,
        structure: { x: number; y: number; data?: Record<string, unknown> },
        render?: { ctx?: CanvasRenderingContext2D; placing?: boolean },
    ): boolean {
        const ctx = render?.ctx;
        if (!ctx || typeof structure?.x !== "number") return false;

        try {
            const t = advance(structure.x, structure.y);
            const origin = sandkit.api.rendering?.getDrawPositionAtCell?.(
                structure.x,
                structure.y,
            );
            if (!origin) return false;

            // Sprite box the artefact renders into, clamped to the 32×32 ceiling.
            const sprite = 16;
            const box = Math.min(
                ARTEFACT_SPIRAL_MAX_PX,
                sprite + ARTEFACT_SPIRAL_MARGIN_PX * 2,
            );
            const cx = Number(origin.x) + sprite / 2;
            const cy = Number(origin.y) + sprite / 2;
            const rMax = box / 2;

            // Colour ramps green → red as the artefact runs out.
            const data = structure.data ?? {};
            const remaining = Number(data.remaining ?? 0);
            const max = Number(data.max ?? data.total ?? 0);
            const ratio = max > 0 ? remaining / max : 1;
            const color = spiralColorForRatio(ratio);

            // "Time" is the raw counter; the angle advances by a fixed step per
            // tick so the rotation speed is independent of frame rate spikes.
            // ARTEFACT_SPIRAL_SPIN also flips the emission angles, keeping the
            // aura and the emitted puff turning the same way.
            const baseAngle = (t * ARTEFACT_SPIRAL_SPIN * ARTEFACT_SPIRAL_TURN_DEG) *
                (Math.PI / 180);
            const arms = Math.max(1, ARTEFACT_SPIRAL_ARMS);

            ctx.save();
            ctx.globalAlpha = ARTEFACT_SPIRAL_ALPHA;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            for (let arm = 0; arm < arms; arm++) {
                const armAngle = baseAngle + (arm * Math.PI * 2) / arms;

                // Archimedean-ish spiral: r grows with the turn.
                const steps = 10;
                const points: { x: number; y: number }[] = [];
                for (let i = 0; i <= steps; i++) {
                    const u = i / steps;
                    const angle = armAngle + u * Math.PI * 1.6;
                    const radius = ARTEFACT_SPIRAL_INNER_PX + u * (rMax - ARTEFACT_SPIRAL_INNER_PX);
                    points.push({
                        x: cx + Math.cos(angle) * radius,
                        y: cy + Math.sin(angle) * radius,
                    });
                }

                // Toon look: a thick ink stroke under a thinner flat-colour one.
                ctx.beginPath();
                ctx.moveTo(points[0]!.x, points[0]!.y);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i]!.x, points[i]!.y);
                }
                ctx.strokeStyle = ARTEFACT_SPIRAL_INK;
                ctx.lineWidth = 4;
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(points[0]!.x, points[0]!.y);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i]!.x, points[i]!.y);
                }
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            ctx.restore();
            return false;
        } catch (err) {
            console.warn(`${LOG} artefact spiral draw failed`, err);
            return false;
        }
    };
}