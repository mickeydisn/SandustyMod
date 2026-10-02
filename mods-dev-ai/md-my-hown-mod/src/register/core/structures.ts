import { LOG, type ModConfig, type StructureConfig } from "../../constants.ts";
import { configStore } from "../../config/store.ts";
import { api } from "../../packages/mysandkit.ts";
import { isAlwaysUnlocked } from "../../ui/tech-link.ts";
import { makeDrawnSprite } from "./drawn-sprite.ts";
import { registerEach } from "../registry.ts";

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

export interface DrawContext {
    wCells: number;

    hCells: number;
}

function safeCanvas(ctx: NonNullable<DrawCtx["ctx"]>): void {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    try {
        ctx.filter = "none";
    } catch {}
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowColor = "rgba(0,0,0,0)";
}

function gridMetrics(): { cellSize: number } {
    return { cellSize: api.rendering.getGridMetrics()?.cellSize ?? 4 };
}

function drawPosAt(x: number, y: number): { x: number; y: number } {
    return api.rendering.getDrawPositionAtCell(x, y) ?? { x: x * 4, y: y * 4 };
}

const hidden = () => true;

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
        } catch {}

        return false;
    };
}

function resolveDraw(st: StructureConfig): StructureConfig {
    const { drawKey } = st;

    const base = withSelectionGuard(withoutModOnlyKeys(st));
    if (!drawKey || drawKey === "default") return base;

    const shape = Array.isArray(st.shape) ? st.shape : [];
    const ctx: DrawContext = {
        wCells: Math.max(1, shape[0]?.length || 1),
        hCells: Math.max(1, shape.length || 1),
    };
    if (drawKey === "hidden") return { ...base, draw: hidden };
    if (drawKey === "outline") return { ...base, draw: makeOutline(ctx) };
    if (drawKey === "drawnSprite") {
        const imageName = st.render?.imageName;
        return {
            ...base,
            draw: makeDrawnSprite(
                typeof imageName === "string" ? imageName : undefined,
                ctx.wCells,
                ctx.hCells,
            ),
        };
    }
    return base;
}

function withoutModOnlyKeys(st: StructureConfig): StructureConfig {
    const { drawKey: _draw, maxPlaced: _cap, unlockNode: _node, ...rest } = st;
    return rest;
}

function withSelectionGuard(st: StructureConfig): StructureConfig {
    if (st.disallowPick !== true) return st;
    const { disallowPick: _ours, ...rest } = st;
    return { ...rest, disallowSelection: true } as StructureConfig;
}

export function registerStructures(cfg?: ModConfig): number {
    const config = cfg ?? configStore.load();
    const n = registerEach(
        config.structures,
        "structures",
        (st) => api.structures.register(resolveDraw(st)),
    )[1];
    unlockStructures(config);
    return n;
}

export function unlockStructures(cfg: ModConfig): number {
    let n = 0;
    for (const st of cfg.structures ?? []) {
        if (!st?.id) continue;

        if (st.hideFromBuildMenu) {
            api.player.buildings.removeById(st.id);
            continue;
        }

        if (!isAlwaysUnlocked(st.id, cfg)) {
            api.player.buildings.removeById(st.id);
            continue;
        }

        if (api.player.buildings.unlockById(st.id)) n++;
    }

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
