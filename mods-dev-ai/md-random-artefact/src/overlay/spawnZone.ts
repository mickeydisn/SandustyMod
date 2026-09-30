/**
 * When the mouse is over an Artefact Generator, draw the spawn zone
 * (SPAWN_MAX_DISTANCE around the generator center) as a soft overlay.
 */
import "@sandmd/sandkit";
import {
    GENERATOR_CENTER_OFFSET,
    GENERATOR_ID,
    GENERATOR_SIZE,
    LOG,
    SPAWN_MAX_DISTANCE,
} from "../constants.ts";

interface StructurePos {
    x: number;
    y: number;
    type?: string | number;
    id?: string;
}

let unsub: (() => void) | null = null;

function isGenerator(s: StructurePos | null | undefined): boolean {
    if (!s) return false;
    const id = String(s.type ?? s.id ?? "");
    return id === GENERATOR_ID || id.includes("generator");
}

function findGeneratorUnderMouse(): StructurePos | null {
    const api = sandkit.api;
    try {
        const cell = api.input?.getMousePositionAtCell?.();
        if (!cell) return null;
        for (let dy = -GENERATOR_SIZE; dy <= 0; dy++) {
            for (let dx = -GENERATOR_SIZE; dx <= 0; dx++) {
                const s = api.structures.getAtCell?.(cell.x + dx, cell.y + dy) as
                    | StructurePos
                    | undefined;
                if (isGenerator(s)) {
                    if (
                        cell.x >= s!.x &&
                        cell.x < s!.x + GENERATOR_SIZE &&
                        cell.y >= s!.y &&
                        cell.y < s!.y + GENERATOR_SIZE
                    ) {
                        return s!;
                    }
                }
            }
        }
    } catch { /* best-effort */ }
    return null;
}

function drawZone(gen: StructurePos): void {
    const api = sandkit.api;
    try {
        const metrics = api.rendering?.getGridMetrics?.() ?? {};
        const cellSize = Number(metrics.cellSize ?? metrics.tileSize ?? 16) || 16;

        const cx = gen.x + GENERATOR_CENTER_OFFSET;
        const cy = gen.y + GENERATOR_CENTER_OFFSET;
        const r = SPAWN_MAX_DISTANCE;

        api.rendering?.withOverlayContext?.((ctx: {
            fillStyle?: string;
            strokeStyle?: string;
            globalAlpha?: number;
            lineWidth?: number;
            fillRect?: (x: number, y: number, w: number, h: number) => void;
            strokeRect?: (x: number, y: number, w: number, h: number) => void;
            beginPath?: () => void;
            arc?: (x: number, y: number, r: number, a0: number, a1: number) => void;
            stroke?: () => void;
        }) => {
            if (typeof ctx.fillRect === "function") {
                ctx.globalAlpha = 0.12;
                ctx.fillStyle = "rgba(180, 80, 255, 1)";
                const x0 = (cx - r) * cellSize;
                const y0 = (cy - r) * cellSize;
                const side = (r * 2 + 1) * cellSize;
                ctx.fillRect(x0, y0, side, side);

                ctx.globalAlpha = 0.55;
                ctx.strokeStyle = "rgba(200, 120, 255, 1)";
                ctx.lineWidth = 2;
                if (typeof ctx.strokeRect === "function") {
                    ctx.strokeRect(x0, y0, side, side);
                }

                ctx.globalAlpha = 0.7;
                ctx.fillStyle = "rgba(255, 220, 80, 1)";
                ctx.fillRect(cx * cellSize + 2, cy * cellSize + 2, cellSize - 4, cellSize - 4);
            } else if (typeof ctx.beginPath === "function" && typeof ctx.arc === "function") {
                ctx.globalAlpha = 0.35;
                ctx.strokeStyle = "rgba(200, 120, 255, 1)";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(
                    cx * cellSize + cellSize / 2,
                    cy * cellSize + cellSize / 2,
                    r * cellSize,
                    0,
                    Math.PI * 2,
                );
                ctx.stroke?.();
            }
        });
    } catch { /* optional */ }
}

export function registerSpawnZoneOverlay(): void {
    if (unsub) return;
    const api = sandkit.api;
    try {
        unsub = api.events.on("frame:render", () => {
            const gen = findGeneratorUnderMouse();
            if (gen) drawZone(gen);
        });
        console.log(`${LOG} spawn-zone overlay registered`);
    } catch (err) {
        console.warn(`${LOG} spawn-zone overlay failed`, err);
    }
}

export function unregisterSpawnZoneOverlay(): void {
    try {
        unsub?.();
    } catch { /* best-effort */ }
    unsub = null;
}
