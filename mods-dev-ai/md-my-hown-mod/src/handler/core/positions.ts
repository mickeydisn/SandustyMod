

import type { Position, Range } from "./position.ts";


export type CellTest = (cell: Position) => boolean;


export type CellValue = (cell: Position) => number;


export type CellVisit = (cell: Position) => void;


export interface Positions {
    
    readonly cells: readonly Position[];
    
    readonly requested: number;
    
    readonly clamped: boolean;
    
    forEach(visit: CellVisit): number;
    
    any(test: CellTest): boolean;
    
    all(test: CellTest): boolean;
    
    count(test: CellTest): number;
    
    sum(value: CellValue): number;
}


function safely(test: CellTest): CellTest {
    return (cell) => {
        try {
            return test(cell) === true;
        } catch {
            return false;
        }
    };
}


function safelyNumber(value: CellValue): CellValue {
    return (cell) => {
        try {
            const n = Number(value(cell));
            return Number.isFinite(n) ? n : 0;
        } catch {
            return 0;
        }
    };
}


export function positionsOver(range: Range, clamped = false): Positions {
    const cells = range;
    return {
        cells,
        requested: cells.length,
        clamped,
        forEach(visit) {
            for (const cell of cells) {
                try {
                    visit(cell);
                } catch {
                    
                    
                    
                }
            }
            return cells.length;
        },
        any(test) {
            const safe = safely(test);
            for (const cell of cells) if (safe(cell)) return true;
            return false;
        },
        all(test) {
            const safe = safely(test);
            for (const cell of cells) if (!safe(cell)) return false;
            return true;
        },
        count(test) {
            const safe = safely(test);
            let n = 0;
            for (const cell of cells) if (safe(cell)) n++;
            return n;
        },
        sum(value) {
            const safe = safelyNumber(value);
            let total = 0;
            for (const cell of cells) total += safe(cell);
            return total;
        },
    };
}


export function singleCell(at: Position): Positions {
    return positionsOver([at]);
}
