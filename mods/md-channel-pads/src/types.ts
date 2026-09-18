/**
 * Channel Pads — local typing for the runtime API surface.
 *
 * The bundled `@sandmd/sandkit` ambient declares the common API; the extra
 * methods this mod calls (player movement, temporary lights, trigger
 * scheduling, legacy config) are typed here and applied with a single cast
 * (`api.ts`), the same pattern the other `md-*` mods use.
 */
import type { StructureLike } from "@sandmd/shared";
import type { ChannelColor } from "./constants.ts";

// --- structures -----------------------------------------------------------

/** Data fields a pad structure carries. */
export interface StructureData {
    channel?: number;
    mates?: number;
}

/** A structure instance as the runtime hands it to callbacks. */
export interface PadStructure extends StructureLike {
    data: StructureData & Record<string, unknown>;
}

// --- event / hook payloads ------------------------------------------------

export interface HookContext {
    cancel?: () => void;
}

export interface PlacePayload {
    structureId?: string;
    structureType?: string;
    id?: string;
}

export interface PlacedEvent {
    structureId?: string;
    structure?: PadStructure;
}

export interface RemovedEvent {
    structureId?: string;
    structure?: PadStructure;
}

// --- misc API shapes ------------------------------------------------------

export interface LegacyConfig {
    cellSize?: number;
}

export interface TemporaryLightOptions {
    durationMs?: number;
    durationTicks?: number;
    brightness?: number;
    size?: number;
    color?: ChannelColor;
    [key: string]: unknown;
}

// --- extended API ---------------------------------------------------------

export interface ChannelPadsApi {
    config?: {
        getLegacy?(): LegacyConfig | undefined;
    };
    time?: {
        getElapsedMs?(): number;
        getTimeMs?(): number;
    };
    ui: {
        /** Accepts either a string or the `{ key, params }` form. */
        toast(message: unknown): void;
    };
    i18n: {
        register(lang: string, map: Record<string, string>): void;
        t?(key: string, params?: Record<string, unknown>): string;
    };
    structures: {
        register(definition: Record<string, unknown>): void;
        forEachOfType(type: string, cb: (structure: PadStructure) => void): void;
        isType?(structure: PadStructure, type: string): boolean;
        getTypeById?(id: string): string | number | null | undefined;
        updateData(
            structure: PadStructure,
            partial: Record<string, unknown>,
            options?: { propagateToWorkers?: boolean },
        ): void;
        setSpritesheetIndex(structure: PadStructure, index: number): void;
        setSpritesheetIndexAtCell?(x: number, y: number, index: number): void;
    };
    lights?: {
        temporary?: {
            createAtWorld?(
                worldX: number,
                worldY: number,
                options?: TemporaryLightOptions,
            ): unknown;
        };
    };
    player: {
        isCollidingWithCell(x: number, y: number): boolean;
        isWithinRadiusOfCell?(x: number, y: number, radius: number): boolean;
        isPositionClearAtWorld?(x: number, y: number): boolean;
        setPositionAtWorld?(x: number, y: number): void;
        setPosition?(x: number, y: number): void;
        setVelocity?(velocityX: number, velocityY: number): void;
        buildings: {
            unlockById(id: string): void;
            add?(id: string): void;
        };
    };
    hooks: {
        intercept(
            name: string,
            fn: (payload: unknown, ctx: HookContext) => void,
            options?: Record<string, unknown>,
        ): void;
    };
    events: {
        on(name: string, fn: (payload: unknown) => void): unknown;
    };
    triggers: {
        register(
            triggerId: string,
            definition: {
                interval?: number;
                intervalMs?: number;
                callback?: () => void;
                tick?: () => void;
            },
        ): void;
    };
    sprites: {
        loadFromMod(spriteId: string, relativePath: string): Promise<void>;
    };
}
