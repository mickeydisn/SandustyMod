/**
 * excavated-all — the Total Excavator tool item.
 *
 * Registers the item, adds it to the player's inventory, and wires up firing
 * through every path the reference tool (`hiden-word-2/tools/materializer.ts`)
 * uses, since custom tools don't reliably get an `item:used` event:
 *   1) `item:used` event (when the engine does fire it)
 *   2) `hooks.intercept("item:use", …)` (fires during use, more reliable)
 *   3) pointerdown + hold, while the tool is the active item
 *   4) a dedicated keybind (default X) + hold
 *
 * Also paints a dashed circle at the cursor showing the current brush size.
 */
import { api, toast } from "./api.ts";
import {
    EXCAVATE_ENERGY,
    FIRE_BINDING_ID,
    FIRE_COOLDOWN_MS,
    FIRE_KEY,
    HOLD_INTERVAL_MS,
    ICON_PATH,
    ICON_SPRITE_ID,
    ITEM_ID,
    KEY,
    LOG,
    MOD_ID,
} from "./ids.ts";
import { excavateAt } from "./engine.ts";
import { toolState } from "./state.ts";
import type { Cell } from "./types.ts";

export function isExcavatorSelected(): boolean {
    try {
        if (typeof api.items.isActiveById === "function") {
            return api.items.isActiveById(ITEM_ID) === true;
        }
    } catch { /* fall through */ }
    try {
        return api.items.getActive?.()?.id === ITEM_ID;
    } catch {
        return false;
    }
}

function readMouseCell(): Cell | null {
    try {
        const c = api.input.getMousePositionAtCell?.() ?? api.input.getMouseCellPosition?.();
        if (c && typeof c.x === "number" && typeof c.y === "number") return { x: c.x, y: c.y };
    } catch { /* */ }
    return null;
}

function tryEnergy(): boolean {
    if (EXCAVATE_ENERGY <= 0) return true;
    try {
        const result = api.energy?.consume?.(EXCAVATE_ENERGY);
        if (result === false) return false;
        if (result && typeof result === "object" && (result as { ok: boolean }).ok === false) return false;
    } catch { /* allow */ }
    return true;
}

/** Fire the brush at an explicit cell, or the cursor cell when omitted. */
export function fire(payload?: Record<string, unknown>, opts?: { quiet?: boolean }): void {
    let cx = payload?.cellX ?? payload?.x;
    let cy = payload?.cellY ?? payload?.y;
    if (typeof cx !== "number" || typeof cy !== "number") {
        const m = readMouseCell();
        if (m) {
            cx = m.x;
            cy = m.y;
        }
    }
    if (typeof cx !== "number" || typeof cy !== "number") {
        if (!opts?.quiet) toast("No cursor cell");
        return;
    }
    if (!tryEnergy()) {
        if (!opts?.quiet) toast("Not enough energy");
        return;
    }

    const stats = excavateAt(cx as number, cy as number, toolState.radius, toolState.filters);
    toolState.lastStats = stats;

    if (!opts?.quiet) {
        const parts: string[] = [];
        if (stats.terrain) parts.push(`${stats.terrain} terrain`);
        if (stats.element) parts.push(`${stats.element} element`);
        if (stats.structure) parts.push(`${stats.structure} structure`);
        if (parts.length === 0) {
            const skipped = stats.skippedAuth + stats.skippedFixed;
            if (stats.structureNoTerrain > 0) {
                toast(
                    `Nothing removed — ${stats.structureNoTerrain} cell(s) have a structure but no terrain ` +
                        `(enable Structure to clear those buildings)`,
                );
            } else if (stats.skippedStructureTerrain > 0) {
                toast(
                    `Nothing removed — ${stats.skippedStructureTerrain} cell(s) are a machine's own terrain ` +
                        `(conveyor/shaker/sliding block — enable Structure to clear those)`,
                );
            } else {
                toast(skipped > 0 ? `Nothing removed (${skipped} protected)` : "Nothing to remove here");
            }
        } else {
            let msg = `Erased ${parts.join(", ")}`;
            const extra: string[] = [];
            if (stats.structureNoTerrain > 0) extra.push(`${stats.structureNoTerrain} under structures`);
            if (stats.skippedStructureTerrain > 0) extra.push(`${stats.skippedStructureTerrain} machine terrain`);
            if (extra.length > 0) msg += ` (${extra.join(", ")} — enable Structure to clear those)`;
            toast(msg);
        }
    }
}

/** Dashed circle at the cursor showing the current brush radius. */
export function paintBrushOverlay(): void {
    if (!isExcavatorSelected()) return;
    try {
        const cell = readMouseCell();
        if (!cell) return;
        const cellSize = api.rendering.getGridMetrics?.()?.cellSize;
        if (!cellSize) return;
        const r = toolState.radius;
        const center = api.rendering.getDrawPositionAtWorld?.(
            (cell.x + 0.5) * cellSize,
            (cell.y + 0.5) * cellSize,
        );
        const edge = api.rendering.getDrawPositionAtWorld?.(
            (cell.x + 0.5 + r) * cellSize,
            (cell.y + 0.5) * cellSize,
        );
        if (!center || !edge) return;
        const radiusPx = Math.abs(edge.x - center.x);

        api.rendering.withOverlayContext?.((ctx) => {
            if (!ctx) return;
            ctx.save();
            ctx.strokeStyle = "rgba(192, 132, 255, 0.9)";
            ctx.lineWidth = 2;
            ctx.setLineDash?.([6, 4]);
            ctx.beginPath();
            ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = "rgba(255, 107, 107, 0.08)";
            ctx.fill();
            ctx.restore();
        });
    } catch { /* quiet */ }
}

export async function registerTool(): Promise<void> {
    try {
        api.i18n?.register?.("en", {
            [KEY.itemName]: "Total Excavator",
            [KEY.itemDesc]:
                "Erases terrain (even bedrock), elements, and structures in a radius. " +
                "Can also ignore build/tool authorization zones. Hold to keep clearing.",
            [KEY.bindingName]: "Total Excavator — fire",
        });
    } catch (err) {
        console.warn(`${LOG} i18n register failed`, err);
    }

    try {
        await api.sprites.loadFromMod(ICON_SPRITE_ID, ICON_PATH);
    } catch (err) {
        console.warn(`${LOG} icon load failed`, err);
    }

    try {
        api.items.register({
            id: ITEM_ID,
            nameKey: KEY.itemName,
            descriptionKey: KEY.itemDesc,
            name: "Total Excavator",
            sprite: { id: ICON_SPRITE_ID },
            itemType: "tool",
            cooldown: { durationMs: 150 },
        });
    } catch (err) {
        console.warn(`${LOG} item register failed`, err);
    }

    try {
        if (typeof api.player.inventory.hasById === "function") {
            if (!api.player.inventory.hasById(ITEM_ID)) api.player.inventory.addById?.(ITEM_ID);
        } else {
            api.player.inventory.addById?.(ITEM_ID);
        }
    } catch (err) {
        console.warn(`${LOG} inventory add failed`, err);
    }

    // --- Activation plumbing (mirrors the materializer reference tool) ---
    let lastFireAt = -Infinity;
    const tryFire = (source: string, payload?: Record<string, unknown>) => {
        const now = performance.now?.() ?? Date.now();
        if (now - lastFireAt < FIRE_COOLDOWN_MS) return;
        lastFireAt = now;
        fire(payload, { quiet: source === "hold" });
    };

    try {
        api.events.on("item:used", (...args: unknown[]) => {
            const payload = (args.length >= 2 ? args[1] : args[0]) as Record<string, unknown> | undefined;
            if (!payload || typeof payload !== "object") return;
            const id = (payload as { itemId?: unknown; id?: unknown }).itemId ?? (payload as { id?: unknown }).id;
            if (id !== ITEM_ID) return;
            tryFire("item:used", payload);
        });
    } catch (err) {
        console.warn(`${LOG} item:used bind failed`, err);
    }

    try {
        const hooks = (api as unknown as { hooks?: { intercept?: (...a: unknown[]) => void } }).hooks;
        if (typeof hooks?.intercept === "function") {
            hooks.intercept(
                "item:use",
                (args: { itemId?: string }) => {
                    if (args?.itemId !== ITEM_ID) return;
                    tryFire("item:use", args as unknown as Record<string, unknown>);
                },
                { itemIds: [ITEM_ID], priority: 0 },
            );
        }
    } catch (err) {
        console.warn(`${LOG} item:use hook failed`, err);
    }

    const HOLD_MS = HOLD_INTERVAL_MS;
    let holdTimer: ReturnType<typeof setInterval> | null = null;
    const stopHold = () => {
        if (holdTimer != null) {
            clearInterval(holdTimer);
            holdTimer = null;
        }
    };
    const startHold = (source: string) => {
        tryFire(source);
        stopHold();
        holdTimer = setInterval(() => {
            if (!isExcavatorSelected()) {
                stopHold();
                return;
            }
            tryFire("hold");
        }, HOLD_MS);
    };

    try {
        const onPointer = (ev: PointerEvent) => {
            if (ev.button !== 0) return;
            if (!isExcavatorSelected()) return;
            const t = ev.target as HTMLElement | null;
            if (t?.closest?.(`.${MOD_ID}-bar, button, input, textarea, select`)) return;
            startHold("pointerdown");
        };
        globalThis.addEventListener("pointerdown", onPointer, true);
        globalThis.addEventListener("pointerup", stopHold, true);
        globalThis.addEventListener("pointercancel", stopHold, true);
        globalThis.addEventListener("blur", stopHold);
    } catch (err) {
        console.warn(`${LOG} pointerdown bind failed`, err);
    }

    try {
        api.input.registerBinding?.(FIRE_BINDING_ID, [FIRE_KEY], { nameKey: KEY.bindingName });
    } catch { /* optional */ }

    try {
        globalThis.addEventListener(
            "keydown",
            (ev: KeyboardEvent) => {
                if (ev.code !== FIRE_KEY) return;
                if (ev.repeat) return;
                if (!isExcavatorSelected()) return;
                const t = ev.target as HTMLElement | null;
                if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
                startHold("keydown");
            },
            true,
        );
        globalThis.addEventListener(
            "keyup",
            (ev: KeyboardEvent) => {
                if (ev.code === FIRE_KEY) stopHold();
            },
            true,
        );
    } catch (err) {
        console.warn(`${LOG} keydown bind failed`, err);
    }

    console.log(`${LOG} Total Excavator registered (${ITEM_ID})`);
}
