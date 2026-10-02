export interface ProcessingContext {
    getResolvedTypeAtCell?: (x: number, y: number) => unknown;
    isCellEmptyAtCell?: (x: number, y: number) => boolean;

    commit?: (mutations: CellMutation[]) => boolean | void;
}

export interface CellMutation {
    kind: "create" | "remove" | "structure";
    cellX: number;
    cellY: number;
    elementType?: unknown;

    expectedElementType?: unknown;
}
