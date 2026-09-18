/**
 * Big Brother — local typing for the runtime API surface.
 *
 * The bundled `@sandmd/sandkit` ambient declares the common API; the extra
 * methods this mod calls (overlay rendering, live map capture, trigger
 * scheduling, structure hooks) are typed here and applied with a single cast
 * (`api.ts`), the same pattern the md-admin mods use.
 */
import type { StructureLike } from "@sandmd/shared";

// --- structures -----------------------------------------------------------

/** Data fields a camera/screen structure carries. */
export interface StructureData {
    channel?: number;
    corner?: number;
    cornerName?: string;
}

/** A structure instance as the runtime hands it to `draw` / interact callbacks. */
export interface CamStructure extends StructureLike {
    data: StructureData & Record<string, unknown>;
}

// --- settings -------------------------------------------------------------

export interface SettingsValues {
    isEnabled?: boolean;
    channels?: number;
    zoneTiles?: number;
    [key: string]: unknown;
}

// --- live world map -------------------------------------------------------

/** `sandkit.state.shared.mapData` — packed RGBA per 4×4 cell. */
export interface MapData {
    width: number;
    data: ArrayLike<number>;
}

// --- draw callbacks -------------------------------------------------------

/** The third `draw` argument the runtime passes while placing. */
export interface DrawingContext {
    ctx?: CanvasRenderingContext2D;
    placing?: boolean;
    tilemap?: unknown;
}

// --- event / hook payloads ------------------------------------------------

export interface PlacedEvent {
    structureId?: string;
    structure?: CamStructure;
}

export interface PlacePayload {
    structureId?: string;
    structureType?: string;
    id?: string;
}

export interface HookContext {
    cancel?: () => void;
}

// --- extended API ---------------------------------------------------------

export interface ViewfinderApi {
    settings: {
        get(name: string): unknown;
        getAll(): SettingsValues;
        onChange(fn: (values: SettingsValues) => void): void;
    };
    sprites: {
        loadFromMod(spriteId: string, relativePath: string): Promise<void>;
    };
    structures: {
        register(definition: Record<string, unknown>): void;
        forEachOfType(type: string, cb: (structure: CamStructure) => void): void;
        updateData(
            structure: CamStructure,
            partial: Record<string, unknown>,
            options?: { propagateToWorkers?: boolean },
        ): void;
        setSpritesheetIndex(structure: CamStructure, index: number): void;
        setSpritesheetIndexAtCell?(x: number, y: number, index: number): void;
        getTypeById?(id: string): string | number | null | undefined;
        hasBuiltAtCell?(x: number, y: number): boolean;
    };
    rendering: {
        withOverlayContext(fn: (ctx: CanvasRenderingContext2D | null) => void): void;
        getDrawPositionAtWorld?(x: number, y: number): { x: number; y: number };
        getDrawPositionAtCell?(x: number, y: number): { x: number; y: number };
    };
    elements: {
        getTypeAtCell(x: number, y: number): number | null | undefined;
    };
    terrains: {
        isAtCell?(x: number, y: number): boolean;
    };
    player: {
        buildings: {
            unlockById(id: string): void;
            add?(id: string): void;
        };
    };
    i18n: {
        register(lang: string, map: Record<string, string>): void;
        t?(key: string, params?: Record<string, unknown>): string;
    };
    ui: {
        /** Accepts either a string or the `{ key, params }` form. */
        toast(message: unknown): void;
    };
    events: {
        on(name: string, fn: (payload: unknown) => void): unknown;
    };
    hooks: {
        intercept(
            name: string,
            fn: (payload: unknown, ctx: HookContext) => void,
            options?: Record<string, unknown>,
        ): void;
    };
    signals: {
        interactables: {
            register(type: string, handler: (structure: CamStructure) => void): void;
        };
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
}
