// import { SandkitReact } from "./react.ts";
import { SandkitSprite, SandkitStructure, StructureLike } from "./structure.ts";
import type { SandkitReact } from "./react.ts";

export type TElementType = number;

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
        isTypeAtCell(x: number, y: number, t: TElementType): boolean;
        getTypeAtCell(x: number, y: number): TElementType | null;
        getDefinitionByType?(
            t: TElementType,
        ): { density?: number; matterType?: number } | null;
        getNameByType?(t: TElementType): string | null;
        register(def: Record<string, unknown>): { elementType: TElementType };
        replaceAtCell(x: number, y: number, t: TElementType): void;
        getResolvedTypeAtCell(x: number, y: number): number;

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
                handler: (s: StructureLike, payload: { combined?: boolean }) => void,
            ) => void;
        };
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
            fn: (payload: unknown) => void,
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
