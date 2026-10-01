/**
 * Input & motion tracking — keyboard presses and distance walked.
 *
 * Neither has a first-class KPI event, so both are read here:
 *
 * - **Keys** come from a capture-phase `keydown` listener on the window. There
 *   is no sandkit event for raw keys, and `api.input` only exposes *bindings*
 *   (`registerBinding`, `triggerBinding`, …), not a keystroke stream.
 * - **Distance** comes from `player:moved`, which the engine emits on the main
 *   thread after collision and only when the position actually changed:
 *   `if (x !== prevX || y !== prevY) emit(e, "player:moved", {state, dt})`.
 *
 * Two guards matter for accuracy:
 *
 * 1. `keydown` is ignored while a text field has focus. This mod's own card
 *    editor renders `<input>` elements, so without this every character typed
 *    into a card title would be logged as a game key press.
 * 2. `event.repeat` is ignored, so holding a movement key counts once rather
 *    than once per OS auto-repeat tick.
 *
 * Distance is accumulated from consecutive positions and scaled down by
 * `DISTANCE_DIVISOR` (pixels ÷ 16), which is a quarter of the raw cell count —
 * `cellSize` is 4 px, so pixels ÷ 4 would be whole cells. The value is a
 * derived figure, so it is shown without a unit. Teleports are excluded: they
 * emit `player:moved` with `dt: 0` and would otherwise add a huge phantom jump.
 */
import { api, safe } from "@sandmd/ui";
import { bumpKpi } from "./buffer.ts";
import { LOG } from "./constants.ts";

const unsubs: (() => void)[] = [];

/** A single step larger than this is a teleport / zone change, not walking. */
const MAX_STEP_PX = 64;

/**
 * Distance scale: raw pixels ÷ (cellSize × 4) — a quarter of the cell count.
 *
 * `cellSize` is 4 px, so dividing by it alone yields whole cells; the extra ×4
 * is the requested extra quarter. Result is shown without a unit because it no
 * longer corresponds to a grid step.
 */
const DISTANCE_DIVISOR = 4;

/** Modifier names that appear as `Left`/`Right` suffixed or prefixed variants. */
const MODIFIER_CODES = ["Shift", "Control", "Alt", "Meta"] as const;

let lastX: number | null = null;
let lastY: number | null = null;
let cellSize = 4;

/** Read the engine's pixel-per-cell scale; 4 is the value in a real save. */
function resolveCellSize(): number {
    const n = safe(() => {
        const m = api.rendering?.getGridMetrics?.() as { cellSize?: number } | undefined;
        return m?.cellSize;
    }, 4);
    return typeof n === "number" && n > 0 ? n : 4;
}

/**
 * Turn a `KeyboardEvent.code` into something readable: "KeyW" → "W",
 * "Digit3" → "3", "ShiftLeft" → "Shift", "Space" → "Space".
 */
export function keyLabel(code: string): string {
    if (!code) return "unknown";
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit[0-9]$/.test(code)) return code.slice(5);
    if (/^Numpad[0-9]$/.test(code)) return "Num " + code.slice(6);
    if (/^Arrow/.test(code)) return code.slice(5);
    // Modifier variants come in both word orders: "LeftShift" and "ShiftLeft"
    // are the same key to a player, so collapse them to "Shift" / "Alt" / …
    for (const m of MODIFIER_CODES) {
        if (
            code === `${m}Left` || code === `${m}Right` || code === `Left${m}` ||
            code === `Right${m}`
        ) {
            return m;
        }
    }
    return code;
}

/** True when the event target is a text field, so typing is not a game key. */
function isTypingTarget(target: EventTarget | null): boolean {
    const el = target as { tagName?: string; isContentEditable?: boolean } | null;
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = (el.tagName ?? "").toUpperCase();
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function onKeyDown(ev: KeyboardEvent): void {
    if (ev.repeat) return;
    if (isTypingTarget(ev.target)) return;
    bumpKpi("keys_pressed", keyLabel(ev.code || ev.key || ""));
}

function onPlayerMoved(): void {
    const pos = safe(
        () => api.player?.getPositionAtWorld?.() as { x?: number; y?: number } | undefined,
        undefined,
    );
    const x = pos?.x;
    const y = pos?.y;
    if (typeof x !== "number" || typeof y !== "number") return;

    if (lastX === null || lastY === null) {
        // First sample only establishes the baseline — no distance yet.
        lastX = x;
        lastY = y;
        return;
    }

    const step = Math.hypot(x - lastX, y - lastY);
    lastX = x;
    lastY = y;
    if (step <= 0) return;
    if (step > MAX_STEP_PX) return; // teleport — not walking
    bumpKpi("distance_walked", null, step / cellSize / DISTANCE_DIVISOR);
}

// —— Collisions ——

/** Movement below this (px) in a sub-step counts as "not moving". */
const BLOCKED_EPSILON_PX = 0.25;

let prevX: number | null = null;
let prevY: number | null = null;
/** Whether the previous sub-step actually moved. */
let wasMoving = false;
/** Whether the previous sub-step was blocked (edge detection). */
let wasBlocked = false;

/**
 * Count *distinct* collisions, not collision sub-steps.
 *
 * The `player:collision:prepare` **modifier hook** fires on every physics
 * sub-step — measured at roughly 135/second — so counting it raw would be
 * meaningless noise. (There is no `player:collision` *event*; the event-shaped
 * id in the typings never fires. The hook is the only working signal.)
 *
 * The hook payload (`phaseThroughTerrain`, `phaseThroughStructures`,
 * `maxStepCells`) has no "did I hit something" flag, so blocked-ness is
 * derived from the position delta: a sub-step where the player wanted to move
 * but didn't actually move is blocked.
 *
 * `wasMoving` guards the count — standing still on the ground also produces a
 * zero delta, and that is not a collision. Requiring the *previous* sub-step
 * to have moved means we count "ran into something" once per contact, instead
 * of once per sub-step of contact.
 */
function onCollisionPrepare(): void {
    const pos = safe(
        () => api.player?.getPositionAtWorld?.() as { x?: number; y?: number } | undefined,
        undefined,
    );
    const x = pos?.x;
    const y = pos?.y;
    if (typeof x !== "number" || typeof y !== "number") {
        prevX = null;
        prevY = null;
        wasBlocked = false;
        return;
    }

    if (prevX !== null && prevY !== null) {
        const moved = Math.hypot(x - prevX, y - prevY);
        const blocked = moved < BLOCKED_EPSILON_PX;
        if (blocked && !wasBlocked && wasMoving) {
            bumpKpi("collisions");
        }
        wasMoving = !blocked;
        wasBlocked = blocked;
    }
    prevX = x;
    prevY = y;
}

export function bindActivity(): void {
    cellSize = resolveCellSize();
    lastX = null;
    lastY = null;
    prevX = null;
    prevY = null;
    wasMoving = false;
    wasBlocked = false;

    try {
        globalThis.addEventListener?.("keydown", onKeyDown as EventListener, true);
    } catch (err) {
        console.warn(`${LOG} keydown bind failed`, err);
    }

    const u = safe(() => api.events?.on?.("player:moved", onPlayerMoved));
    if (typeof u === "function") unsubs.push(u as () => void);

    // Collisions come from the modifier hook, not an event — the
    // event-shaped `player:collision:prepare` id never fires.
    const collHook = safe(() =>
        api.hooks?.modify?.("player:collision:prepare", onCollisionPrepare)
    );
    const collOk = typeof collHook === "function";
    if (collOk) unsubs.push(collHook as () => void);

    console.log(
        `${LOG} activity tracking bound (keys + distance + collisions, ` +
            `cellSize=${cellSize}, collisionHook=${collOk ? "on" : "off"})`,
    );
}

export function unbindActivity(): void {
    try {
        globalThis.removeEventListener?.("keydown", onKeyDown as EventListener, true);
    } catch { /* */ }
    for (const u of unsubs) {
        try {
            u?.();
        } catch { /* */ }
    }
    unsubs.length = 0;
    lastX = null;
    lastY = null;
    prevX = null;
    prevY = null;
    wasMoving = false;
    wasBlocked = false;
}
