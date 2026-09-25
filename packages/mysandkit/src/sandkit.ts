// import { SandkitReact } from "./react.ts";
import { SandkitSprite, SandkitStructure, StructureLike } from "@sandmd/shared";
import type { SandkitReact } from "./react.ts";

export type TElementType = number;

/**
 * Element reference accepted by the engine: a numeric element type or a
 * string element id.
 * Mirrors shared.api.elements.ElementRef in the official SandustryTypes
 * (ElementType | ElementId) — ids are resolved by the engine, so both forms
 * are legal on the is/create/replace AtCell methods.
 */
export type ElementRef = TElementType | string;

/** Optional spawn overrides for createAtCell / replaceAtCell. */
export interface ElementCreateOptions {
    /** Initial element data bag. */
    data?: Record<string, unknown>;
    /** Override element density. */
    density?: number;
    /** Set both max and remaining duration, in simulation ticks. */
    durationTicks?: number;
    /** Override the initial velocity. */
    velocity?: Record<string, number>;
}

/** Optional flags for removeAtCell. */
export interface ElementRemovalOptions {
    /** Skip collector accounting when removing the element. */
    skipCollectorCheck?: boolean;
}

/** Element writers available on {@link GridMutationWriter.elements}. */
export interface GridMutationWriterElements {
    createAtCell(
        x: number,
        y: number,
        t: ElementRef,
        options?: ElementCreateOptions,
    ): void;
    replaceAtCell(
        x: number,
        y: number,
        t: ElementRef,
        options?: ElementCreateOptions,
    ): void;
    removeAtCell(x: number, y: number, options?: ElementRemovalOptions): void;
}

/** Terrain writers available on {@link GridMutationWriter.terrains}. */
export interface GridMutationWriterTerrains {
    createAtCell(x: number, y: number, t: ElementRef): void;
    replaceAtCell(x: number, y: number, t: ElementRef): void;
    removeAtCell(x: number, y: number): void;
}

/**
 * Deferred element and terrain mutations handed to the
 * {@link SandkitApi.grid.mutate} callback. Main-entry writes are deferred:
 * reads inside the callback still see the pre-mutation grid.
 */
export interface GridMutationWriter {
    /** Element cell mutations. */
    elements: GridMutationWriterElements;
    /** Terrain cell mutations. */
    terrains: GridMutationWriterTerrains;
}

export type ApiEnum = {
    MatterType?: Record<string, number>;
    Tech?: Record<string, number>;
    ActionType: { Building: unknown };
};

declare global {
    var sandkit: {
        api: SandkitApi;
        enums: ApiEnum;
        react: SandkitReact;
        /** Live game store (read-only access from mods). */
        state?: {
            store?: Record<string, any>;
        };
    };
    var sandkit2: {
        api: SandkitApiWorker;
        enums: ApiEnum;
    };
}

//---
export interface TypedArrayLike {
    [index: number]: number;
    length: number;
}

// ---

export interface SandkitApi {
    elements: {
        getTypeFromId(id: string): TElementType | null | undefined;
        /** Official alias of {@link getTypeFromId}; resolves an element id. */
        getTypeById(id: string): TElementType | null | undefined;
        /** Accepts a numeric element type or an element id string. */
        isTypeAtCell(x: number, y: number, t: ElementRef): boolean;
        getTypeAtCell(x: number, y: number): TElementType | null;
        getDefinitionByType?(
            t: TElementType,
        ): { density?: number; matterType?: number } | null;
        getNameByType?(t: TElementType): string | null;
        register(def: Record<string, unknown>): { elementType: TElementType };
        /** Main-entry write: deferred, reads still see the old grid. */
        createAtCell(
            x: number,
            y: number,
            t: ElementRef,
            options?: ElementCreateOptions,
        ): void;
        /** Main-entry write: deferred, reads still see the old grid. */
        replaceAtCell(
            x: number,
            y: number,
            t: ElementRef,
            options?: ElementCreateOptions,
        ): void;
        removeAtCell(x: number, y: number, options?: ElementRemovalOptions): void;
        getResolvedTypeAtCell(x: number, y: number): number;
        // Worker-thread simulation only (not reliable on the main thread).
        swapCells(x: number, y: number, nx: number, ny: number): boolean;
        moveBetweenCells(x: number, y: number, nx: number, ny: number): boolean;

        setPhysicsAtCell(x: number, y: number, skip: number): boolean; // 1 to skip , 0 to normal
        addParticleVelocityAtCell(
            x: number,
            y: number,
            v: Record<string, number>,
        ): void;
        getVelocityAtCell(x: number, y: number): Record<string, number>;
        setVelocityAtCell(x: number, y: number, v: Record<string, number>): void;

        getDataFieldAtCell(x: number, y: number, field: number): number | null;
        setDataFieldAtCell(
            x: number,
            y: number,
            field: number,
            value: number,
        ): void;
        setDurationAtCell?(
            x: number,
            y: number,
            n: number,
            opts?: { updateMax?: boolean },
        ): void;
    };
    discoveries: { addElementByType(t: TElementType): void };
    structures: SandkitStructure;
    sprites: SandkitSprite;
    building: {
        selectStructure: (type: string) => void;
    };
    signals?: {
        interactables?: {
            register: (type: string, handler: (s: StructureLike) => void) => void;
        };
        targets?: {
            register: (
                type: string,
                handler: (
                    s: StructureLike,
                    payload: { combined: boolean; inputCount: number; onCount: number },
                ) => void,
            ) => void;
        };
        registerSenderType: (type: string, handler: (s: StructureLike) => boolean) => void;
        /**
         * Push a sender cell's current output: sets every outgoing link's `.on`
         * and marks each receiver dirty so the next propagation pass re-applies
         * it (bundle `setAll`, 63921-63936). This is how vanilla signal devices
         * emit a value change — call it whenever the sender's output changes.
         */
        setAll?: (cell: { x: number; y: number }, on: boolean) => void;
        /** Force a single sender cell's outgoing wire state (bundle `setOutputAtCell`). */
        setOutputAtCell?: (x: number, y: number, on: boolean) => void;
        sources?: {
            set?: (structure: StructureLike, on: boolean) => void;
        };
        links?: {
            poll?: (structure: StructureLike) => void;
            get?: (structure: StructureLike) => { input?: boolean; output?: boolean } | undefined;
        };
    };

    triggers: {
        register: (
            triggerId: string,
            definition: { intervalMs: number; tick?: () => void; callback?: () => void },
        ) => (() => void) | void;
    };
    schedule: {
        nextTick: (fn: () => void) => void;
    };

    rendering: {
        getDrawPositionAtCell(cellX: number, cellY: number): {
            x: number;
            y: number;
        };
        getGridMetrics(): { cellSize: number; snapGridCellSize: number };
    };

    settings: {
        get(name: string): unknown;
        onChange(fn: () => void): void;
    };
    shared: {
        buffers: {
            ensure(
                name: string,
                opts: { type: string; length: number },
            ): Uint16Array | Int32Array | Uint8Array;
            get: (key: string) => TypedArrayLike | undefined;
        };
    };
    storage: {
        ensure: (modId: string) => unknown;
        get: (modId: string, key: string) => unknown;
        set: (modId: string, key: string, value: unknown) => void;
        remove: (modId: string, key: string) => void;
        local: {
            ensure: () => unknown;
            get: (key: string) => unknown;
            set: (key: string, value: unknown) => void;
            remove: (key: string) => void;
        };
    };
    player: {
        buildings: { unlockByType: (type: string) => void };
    };
    action: {
        getSelected: () => { type?: unknown; id?: string } | undefined;
    };

    reactions: {
        registerContact(opts: {
            inputA: TElementType;
            inputB: TElementType;
            outputA: TElementType | null;
            outputB: TElementType | null;
        }): void;
    };
    i18n: { register(lang: string, map: Record<string, string>): void };
    events: {
        on(
            name: string,
            fn: (payload: Record<string, unknown>) => void,
            opts?: { guard?: { elementType: TElementType } },
        ): () => void;
    };
    hooks: {
        intercept(
            name: string,
            fn: (e: unknown, payload: unknown) => boolean | void,
            opts?: { guard?: { elementType: TElementType } },
        ): void;
    };
    tech: {
        registerNode(
            id: string,
            def: { nameKey: string; descriptionKey: string; cost: number },
            opts: { parentId: number },
        ): void;
    };
    ui: {
        toast(msg: string, opts?: Record<string, unknown>): void;
        overlays: {
            register: (slot: string, id: string, render: () => unknown) => void;
        };
        prompt: (
            options: { title?: string; message?: string; defaultValue?: string },
            callback: (value: string | null) => void,
        ) => void;

        navigation: {
            useFocusable: (options: {
                id: string;
                scope: string;
                onActivate: () => void;
                scrollIntoView?: boolean;
            }) => { ref: unknown; focused: boolean };
            controllerFocusClass: (focused: boolean) => string;
        };
    };
    grid: {
        /**
         * Run a deferred mutation batch. Main-entry grid writes are deferred,
         * so any read+write pair must go through this callback; reads inside
         * it still observe the pre-mutation grid.
         */
        mutate(callback: (writer: GridMutationWriter) => void): void;
        isCellEmptyAtCell?(x: number, y: number): boolean;
        isTerrainAtCell(cellX: number, cellY: number): boolean;
        reportActivityAtCell(cellX: number, cellY: number): void;
        excavateAtCell(
            cellX: number,
            cellY: number,
            outVelocity: Record<string, number>,
            damage: number,
            opts?: Record<string, unknown>,
        ): void;
    };
}

type TEvent = "element:moved" | "terrain:updated" | "worker:update:post";

export interface SandkitApiWorker {
    test: number;
    /*
  elements: {
    getTypeFromId(id: string): TElementType | null | undefined;
    getDefinitionByType?(
      t: TElementType,
    ): { density?: number; matterType?: number } | null;

    isTypeAtCell(x: number, y: number, t: TElementType): boolean;
    getTypeAtCell(x: number, y: number): TElementType | null;
    getResolvedTypeAtCell(x: number, y: number): number;

    replaceAtCell(x: number, y: number, t: TElementType): void;

    setPhysicsAtCell(x: number, y: number, skip: number): boolean; // 1 to skip , 0 to normal
    addParticleVelocityAtCell(
      x: number,
      y: number,
      v: Record<string, number>,
    ): void;
    getVelocityAtCell(x: number, y: number): Record<string, number>;
    setVelocityAtCell(x: number, y: number, v: Record<string, number>): void;

    getDataFieldAtCell(x: number, y: number, field: number): number | null;
    setDataFieldAtCell(
      x: number,
      y: number,
      field: number,
      value: number,
    ): void;
    setDurationAtCell?(
      x: number,
      y: number,
      n: number,
      opts?: { updateMax?: boolean },
    ): void;

    // WORKER ONLY
    swapCells(x: number, y: number, nx: number, ny: number): boolean;
    moveBetweenCells(x: number, y: number, nx: number, ny: number): boolean;
  };
  shared: {
    buffers: {
      create(name: string, opts: { type: string; length: number }): Uint16Array;
      require(
        name: string,
        opts: { type: string; length: number },
      ): Uint16Array;
    };
  };
  events: {
    on(
      name: string,
      fn: (payload: unknown) => void,
      opts?: { guard?: { elementType: TElementType } },
    ): void;
    emit(
      eventId: string,
      payload: unknown,
      opts?: { guard?: { elementType: TElementType; terrainType: TElementType } },
    ): void;
  };
  hooks: {
    intercept(
      name: string,
      fn: (e: unknown, payload: unknown) => boolean | void,
      opts?: { guard?: { elementType: TElementType } },
    ): void;
  };
  ui: {
    toast(msg: string, opts?: Record<string, unknown>): void;
  };
  grid: {
    isCellEmptyAtCell?(x: number, y: number): boolean;
    isTerrainAtCell(cellX: number, cellY: number): boolean;
    reportActivityAtCell(cellX: number, cellY: number): void;
    excavateAtCell(
      cellX: number,
      cellY: number,
      outVelocity: Record<string, number>,
      damage: number,
      opts?: Record<string, unknown>,
    ): void;
  };
  */
}
