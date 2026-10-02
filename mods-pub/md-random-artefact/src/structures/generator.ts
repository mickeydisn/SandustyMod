/**
 * Artefact Generator (creator) — max 1 placed.
 *
 * - Each cycle picks ONE material from EAT_MATERIALS and only eats that type.
 * - progress += Math.round(cells / mult) // inverse weight
 * - Tooltip: remaining / material / status
 * - Signal target: when powered, auto-spawns artefacts when charged
 * - Sprite: idle | charged | signal-on
 * - Category: Artefact
 */
import "@sandmd/sandkit";
import type { JsonMapBuffer } from "@sandmd/buffer";
import {
    ARTEFACT_ID,
    type ArtefactProgress,
    CATEGORY_KEY,
    EAT_MATERIALS,
    GENERATOR_CENTER_OFFSET,
    GENERATOR_EAT_COUNT,
    GENERATOR_ID,
    GENERATOR_INTERVAL_MS,
    GENERATOR_SIZE,
    LOG,
    materialByIndex,
    MAX_ARTEFACTS,
    MAX_CREATORS,
    MAX_PROGRESS,
} from "../constants.ts";
import { cellHasElement, removeElementAt, resolveElementType } from "../utils/elements.ts";
import { unlockInBuildMenu } from "../utils/buildMenu.ts";
import { spawnRandomArtefact } from "../utils/spawn.ts";

interface StructurePos {
    x: number;
    y: number;
    data?: Record<string, unknown>;
    type?: string | number;
}

/** Single horizontal sheet: frame 0 idle, 1 active, 2 signal (16×16 each). */
export interface GeneratorSprites {
    sheet: string;
}

function makeZeroShape(size: number): number[][] {
    return Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
}

function* interiorCellsBottomFirst(
    sx: number,
    sy: number,
    size: number,
): Generator<{ x: number; y: number }> {
    for (let dy = size - 1; dy >= 0; dy--) {
        for (let dx = 0; dx < size; dx++) {
            yield { x: sx + dx, y: sy + dy };
        }
    }
}

function pickMaterialIndex(): number {
    return Math.floor(Math.random() * EAT_MATERIALS.length);
}

function statusLabel(progress: number, active: number, signalOn: boolean): string {
    if (signalOn && (active === 1 || progress >= MAX_PROGRESS)) {
        return "SIGNAL — auto spawning";
    }
    if (active === 1 || progress >= MAX_PROGRESS) return "READY — click or signal";
    return "charging";
}

export function registerGenerator(
    map: JsonMapBuffer<ArtefactProgress>,
    spriteIds: GeneratorSprites,
): void {
    const api = sandkit.api;

    // Resolve element types once
    const resolved = EAT_MATERIALS.map((m) => ({
        ...m,
        type: resolveElementType(m.id),
    }));

    const renderSize = { width: 16, height: 16 };
    const firstMat = EAT_MATERIALS[0]!;

    api.structures.register({
        id: GENERATOR_ID,
        name: "Artefact Generator",
        description:
            "Only one may be placed. Each cycle eats one material (Gold×1 / Copper×0.5 / Sand×5). When charged, click or power with a signal to summon an artefact (max 5 alive).",
        categoryKey: CATEGORY_KEY,
        order: 10,
        alwaysUnlocked: true,
        hideFromBuildMenu: false,
        shape: makeZeroShape(GENERATOR_SIZE),
        useRawShape: true,
        copyData: true,
        buildModes: [{ type: "single" }],
        defaultData: {
            progress: 0,
            max: MAX_PROGRESS,
            remaining: MAX_PROGRESS,
            material: firstMat.label,
            mult: firstMat.mult,
            status: "charging",
            charged: 0,
            signalOn: 0,
            nbArtefact: 0,
        },
        // 16×16 frames in a row (sheet 48×16). Footprint is shape 4×4 of 0.
        render: {
            imageName: spriteIds.sheet,
            size: { width: 16, height: 16 },
            offset: { x: 0, y: 0 },
            ui: { outline: true, imageName: spriteIds.sheet },
        },
        spritesheet: {
            frameSize: { width: 16, height: 16 },
            frames: 3,
        },
        tooltipHover: {
            type: "custom",
            dataFieldMessage: {
                message:
                    "Need {remaining} more ({progress}/{max}) · eating {material} ×{mult} · artefacts {nbArtefact}/{maxArtefacts} · {status}",
                fields: [
                    { param: "remaining", field: "remaining", fallback: MAX_PROGRESS, round: true },
                    { param: "progress", field: "progress", fallback: 0, round: true },
                    { param: "max", field: "max", fallback: MAX_PROGRESS, round: true },
                    { param: "material", field: "material", fallback: firstMat.label },
                    { param: "mult", field: "mult", fallback: firstMat.mult },
                    { param: "nbArtefact", field: "nbArtefact", fallback: 0, round: true },
                    {
                        param: "maxArtefacts",
                        field: "maxArtefacts",
                        fallback: MAX_ARTEFACTS,
                        round: true,
                    },
                    { param: "status", field: "status", fallback: "charging" },
                ],
            },
        },
    });
    // Put it in the build menu.
    //
    // The build window does NOT use `alwaysUnlocked` — that flag is only read
    // while walking the vanilla table (bundel 3268), so a mod id never benefits
    // from it. The window reads `store.player.buildings` directly (bundel
    // 151647), so membership in that array is the only thing that lists a mod
    // structure.
    //
    // The real members of `api.player.buildings` are `unlockById`,
    // `unlockByType` and `removeById` — there is **no `add`**. An earlier
    // version of this comment claimed the opposite and called
    // `add?.(GENERATOR_ID)`; the optional call silently did nothing, so the
    // generator registered fine but never appeared in the menu. `add` is kept
    // below purely as a fallback for builds that only expose it.
    if (!unlockInBuildMenu(GENERATOR_ID)) {
        console.warn(`${LOG} generator not unlocked — build menu will hide it`);
    }

    // ── Enforce max 1 creator — LIVE structures only (ignore buffer / save counts) ──
    const countLiveGenerators = (): number => {
        let count = 0;
        try {
            api.structures.forEachOfType?.(GENERATOR_ID, () => {
                count++;
            });
        } catch { /* best-effort */ }
        // Fallback: match by string id on each structure
        if (count === 0) {
            try {
                api.structures.forEach?.((s: StructurePos) => {
                    const id = String(s.type ?? (s as { id?: string }).id ?? "");
                    if (id === GENERATOR_ID) count++;
                });
            } catch { /* optional */ }
        }
        return count;
    };

    // Engine may keep a stale "already placed" count from the save.
    // Force a very high maxCount so the engine never blocks; we enforce live-only below.
    const forceOpenLimit = (args: {
        structureId?: string;
        structureType?: string | number;
        maxCount?: number | null;
    }) => {
        const id = String(args.structureId ?? args.structureType ?? "");
        if (
            id === GENERATOR_ID ||
            id.endsWith(":generator") ||
            (id.includes("md-random-artefact") && id.includes("generator"))
        ) {
            const before = args.maxCount;
            args.maxCount = 999_999;
            console.log(
                `${LOG} placementLimit force-open id=${id} maxCount ${String(before)} → 999999`,
            );
        }
    };
    try {
        api.hooks.modify("building:placementLimit:prepare", forceOpenLimit);
    } catch (err) {
        console.warn(`${LOG} placementLimit:prepare failed`, err);
    }
    // Deprecated alias some builds still fire
    try {
        api.hooks.modify("building:placementLimit", forceOpenLimit);
    } catch { /* optional */ }

    try {
        api.hooks.intercept(
            "building:place",
            (args: { structureId?: string }, context: { cancel?: () => void }) => {
                const id = String(args.structureId ?? "");
                if (id !== GENERATOR_ID) return;
                const count = countLiveGenerators();
                // Keep buffer in sync for tooltips only
                try {
                    map.setPath("nbCreatorPlace", Math.min(count, MAX_CREATORS));
                    map.commit();
                } catch { /* optional */ }
                if (count >= MAX_CREATORS) {
                    context.cancel?.();
                    try {
                        sandkit.api.ui.toast?.("Only one Artefact Generator allowed", {});
                    } catch { /* optional */ }
                    console.log(`${LOG} place cancelled — live generators=${count}`);
                } else {
                    console.log(`${LOG} place allowed — live generators=${count}`);
                }
            },
        );
    } catch (err) {
        console.warn(`${LOG} building:place intercept failed`, err);
    }

    try {
        api.structures.registerPlacementConfig?.({
            structureId: GENERATOR_ID,
            maxCount: 999_999,
        });
    } catch { /* optional */ }

    // Signal target — payload.combined means powered
    const signalPowered = new Map<string, boolean>();
    try {
        api.signals.targets.register(
            GENERATOR_ID,
            (structure: StructurePos, payload: { combined?: boolean }) => {
                const key = `${structure.x},${structure.y}`;
                signalPowered.set(key, !!payload?.combined);
            },
        );
    } catch (err) {
        console.warn(`${LOG} signals.targets.register failed`, err);
    }

    const structureType = api.structures.getTypeFromId?.(GENERATOR_ID) ??
        api.structures.getTypeById?.(GENERATOR_ID) ??
        GENERATOR_ID;

    const countCreators = (): number => {
        let n = 0;
        try {
            api.structures.forEachOfType?.(GENERATOR_ID, () => {
                n++;
            });
        } catch { /* best-effort */ }
        return n;
    };

    const countArtefacts = (): number => {
        let n = 0;
        try {
            api.structures.forEachOfType?.(ARTEFACT_ID, () => {
                n++;
            });
        } catch { /* best-effort */ }
        return n;
    };

    const syncStructureData = (
        structure: StructurePos,
        progress: number,
        active: number,
        matLabel: string,
        mult: number,
        signalOn: boolean,
    ) => {
        const remaining = Math.max(0, MAX_PROGRESS - progress);
        const nbArtefact = Number(map.getPath("nbArtefactPlace") ?? 0);
        const status = statusLabel(progress, active, signalOn);
        try {
            api.structures.updateData?.(
                structure,
                {
                    ...(structure.data ?? {}),
                    progress,
                    max: MAX_PROGRESS,
                    remaining,
                    material: matLabel,
                    mult,
                    status,
                    charged: active,
                    signalOn: signalOn ? 1 : 0,
                    nbArtefact,
                    maxArtefacts: MAX_ARTEFACTS,
                },
                { propagateToWorkers: true },
            );
        } catch { /* best-effort */ }
    };

    const applySprite = (
        structure: StructurePos,
        active: number,
        signalOn: boolean,
    ) => {
        // Frame index on the horizontal sheet: 0 idle · 1 active · 2 signal
        let idx = 0;
        if (signalOn && active === 1) idx = 2;
        else if (active === 1) idx = 1;
        try {
            api.structures.setSpritesheetIndexByValueAtCell?.(
                structure.x,
                structure.y,
                idx,
                [0, 1, 2],
            );
        } catch { /* optional */ }
    };

    const trySpawn = (structure: StructurePos, opts?: { focusCamera?: boolean }): boolean => {
        const live = Number(map.getPath("nbArtefactPlace") ?? 0);
        if (live >= MAX_ARTEFACTS) {
            console.log(`${LOG} spawn deferred — ${live}/${MAX_ARTEFACTS} artefacts alive`);
            safeToast(`Too many artefacts (${live}/${MAX_ARTEFACTS}) — will retry`);
            return false;
        }

        const result = spawnRandomArtefact({
            originX: structure.x,
            originY: structure.y,
            focusCamera: opts?.focusCamera === true,
        });
        if (!result) {
            safeToast("Could not find a free place for an artefact nearby.");
            return false;
        }

        const nextCount = live + 1;
        map.setPath("nbArtefactPlace", nextCount);
        map.setPath("progress", 0);
        map.setPath("active", 0);
        // New material cycle after spawn
        map.setPath("materialIndex", pickMaterialIndex());
        map.commit();

        applySprite(structure, 0, false);
        const mat = materialByIndex(Number(map.getPath("materialIndex") ?? 0));
        syncStructureData(structure, 0, 0, mat.label, mat.mult, false);

        safeToast(
            `Artefact @(${result.x},${result.y}) — ${result.elementType} ×${result.remaining} (${nextCount}/${MAX_ARTEFACTS})`,
        );
        console.log(
            `${LOG} artefact spawned @${result.x},${result.y} type=${result.elementType} n=${result.remaining}`,
        );
        return true;
    };

    // Per-structure: remember material for current charge cycle (until charged/reset)
    const cycleMaterial = new Map<string, number>();

    const processFn = (structure: StructurePos) => {
        try {
            const key = `${structure.x},${structure.y}`;
            const signalOn = signalPowered.get(key) === true;

            // Track creator count
            const creators = countCreators();
            // Always sync buffer to LIVE count (fixes stale limit after load)
            if (Number(map.getPath("nbCreatorPlace") ?? 0) !== creators) {
                map.setPath("nbCreatorPlace", Math.min(creators, MAX_CREATORS));
                map.commit();
                console.log(`${LOG} nbCreatorPlace synced to live count=${creators}`);
            }

            let progress = Number(map.getPath("progress") ?? 0);
            let active = Number(map.getPath("active") ?? 0);

            // Ensure a material is selected for this cycle
            if (!cycleMaterial.has(key)) {
                let idx = Number(map.getPath("materialIndex") ?? -1);
                if (idx < 0 || idx >= EAT_MATERIALS.length) {
                    idx = pickMaterialIndex();
                    map.setPath("materialIndex", idx);
                    map.commit();
                }
                cycleMaterial.set(key, idx);
            }
            const matIdx = cycleMaterial.get(key)!;
            const mat = materialByIndex(matIdx);
            const matResolved = resolved.find((r) => r.id === mat.id);

            // Already full → active
            if (progress >= MAX_PROGRESS) {
                if (active !== 1) {
                    map.setPath("active", 1);
                    map.commit();
                    active = 1;
                }
                applySprite(structure, 1, signalOn);
                syncStructureData(structure, progress, 1, mat.label, mat.mult, signalOn);

                // Auto-spawn when signal is ON
                if (signalOn) {
                    trySpawn(structure, { focusCamera: false });
                    cycleMaterial.delete(key);
                }
                return;
            }

            // Eat around the structure center (origin + GENERATOR_CENTER_OFFSET)
            let cells = 0;
            if (matResolved?.type != null) {
                const cx = structure.x + GENERATOR_CENTER_OFFSET;
                const cy = structure.y + GENERATOR_CENTER_OFFSET;
                const spots: { x: number; y: number }[] = [{ x: cx, y: cy }];
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        spots.push({ x: cx + dx, y: cy + dy });
                    }
                }
                for (const cell of spots) {
                    if (cells >= GENERATOR_EAT_COUNT) break;
                    if (
                        cell.x < structure.x || cell.x >= structure.x + GENERATOR_SIZE ||
                        cell.y < structure.y || cell.y >= structure.y + GENERATOR_SIZE
                    ) continue;
                    if (!cellHasElement(cell.x, cell.y, matResolved.type, mat.id)) continue;
                    removeElementAt(cell.x, cell.y);
                    cells++;
                }
            }

            if (cells > 0) {
                // Inverse weight: copper ×0.5 → ×2; sand ×5 → /5
                const gained = Math.max(0, Math.round(cells / mat.mult));
                progress = Math.min(MAX_PROGRESS, progress + gained);
                map.setPath("progress", progress);
                if (progress >= MAX_PROGRESS) {
                    map.setPath("active", 1);
                    active = 1;
                }
                map.commit();
            }

            applySprite(structure, active, signalOn);
            syncStructureData(structure, progress, active, mat.label, mat.mult, signalOn);

            // Signal auto-spawn if we just became ready
            if (signalOn && active === 1) {
                trySpawn(structure, { focusCamera: false });
                cycleMaterial.delete(key);
            }
        } catch (err) {
            console.error(`${LOG} generator tick failed`, err);
        }
    };

    try {
        if (typeof api.structures.addProcessor === "function") {
            api.structures.addProcessor(structureType, {
                intervalMs: GENERATOR_INTERVAL_MS,
                process: processFn,
            });
        } else {
            api.structures.processing?.register?.(`${GENERATOR_ID}:process`, {
                structureType: GENERATOR_ID,
                intervalMs: GENERATOR_INTERVAL_MS,
                process: processFn,
            });
        }
    } catch (err) {
        console.error(`${LOG} generator processor failed`, err);
    }

    // Click when active → spawn
    try {
        api.signals.interactables.register(GENERATOR_ID, (structure: StructurePos) => {
            const active = Number(map.getPath("active") ?? 0);
            const progress = Number(map.getPath("progress") ?? 0);
            if (active !== 1 && progress < MAX_PROGRESS) {
                const remaining = MAX_PROGRESS - progress;
                const mat = materialByIndex(Number(map.getPath("materialIndex") ?? 0));
                safeToast(
                    `Need ${remaining} more · eating ${mat.label} ×${mat.mult}`,
                );
                return;
            }
            const key = `${structure.x},${structure.y}`;
            trySpawn(structure, { focusCamera: true });
            cycleMaterial.delete(key);
        });
    } catch (err) {
        console.error(`${LOG} generator interactable failed`, err);
    }

    console.log(`${LOG} generator registered ${GENERATOR_ID}`);
}

function safeToast(msg: string): void {
    try {
        sandkit.api.ui.toast?.(msg, {});
    } catch {
        console.log(`${LOG} toast: ${msg}`);
    }
}
