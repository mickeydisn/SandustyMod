
import { assertEquals } from "https:
import { logicActions } from "../actions/logic/index.ts";

interface FakeWorld {
    read: (x: number, y: number) => string | null;
    written: { x: number; y: number; type: string }[];
    setHp: (x: number, y: number, n: number) => void;
    
    flush(): void;
}

function fakeWorld(cells: Record<string, string>): FakeWorld {
    const read = (x: number, y: number) => cells[`${x},${y}`] ?? null;
    const written: { x: number; y: number; type: string }[] = [];
    const hp = new Map<string, number>();
    
    let pending: { writer: unknown; run?: (w: { elements: unknown }) => void }[] = [];
    (globalThis as { sandkit?: unknown }).sandkit = {
        api: {
            elements: { getResolvedTypeAtCell: read },
            grid: {
                isCellEmptyAtCell: (x: number, y: number) => read(x, y) === null,
                mutate: (fn: (w: { elements: unknown }) => void) => {
                    const writer = {
                        elements: {
                            createAtCell: (x: number, y: number, t: string) => {
                                written.push({ x, y, type: t });
                                cells[`${x},${y}`] = t;
                            },
                        },
                    };
                    pending.push({ writer });
                    pending[pending.length - 1].run = fn;
                },
            },
            terrains: {
                getDataAtCell: (x: number, y: number) =>
                    hp.has(`${x},${y}`) ? { hitPoints: hp.get(`${x},${y}`) } : null,
            },
        },
    };
    
    
    
    const out: FakeWorld = {
        read,
        setHp(x: number, y: number, n: number) {
            hp.set(`${x},${y}`, n);
        },
        flush() {
            const open = pending;
            pending = [];
            for (const b of open) b.run?.(b.writer as { elements: unknown });
        },
        get written() {
            out.flush();
            return written;
        },
    };
    return out;
}


function withWorld(
    cells: Record<string, string>,
    body: (w: FakeWorld) => void,
): void {
    const previous = (globalThis as { sandkit?: unknown }).sandkit;
    const w = fakeWorld(cells);
    try {
        body(w);
    } finally {
        if (previous === undefined) delete (globalThis as { sandkit?: unknown }).sandkit;
        else (globalThis as { sandkit?: unknown }).sandkit = previous;
    }
}


const isEmptyOf = (w: FakeWorld) => (x: number, y: number) => w.read(x, y) === null;


function run(fn: unknown, structure: unknown, options: unknown, context: unknown = null) {
    return (fn as (a: unknown, b: unknown, c: unknown) => unknown)(
        structure,
        context,
        options,
    );
}

const at = (x: number, y: number) => ({ x, y });

Deno.test("logicCount counts the cells holding a type across the range", () => {
    withWorld({ "0,0": "water", "1,0": "water", "0,1": "sand", "1,1": "sand" }, () => {
        
        assertEquals(run(logicActions.logicAny.fn, at(0, 0), { size: 2, element: "water" }), true);
        assertEquals(run(logicActions.logicCount.fn, at(0, 0), { size: 2, element: "water" }), 2);
        assertEquals(run(logicActions.logicAll.fn, at(0, 0), { size: 2, element: "sand" }), false);
    });
});

Deno.test("the walks anchor on the structure, not on the cursor", () => {
    
    
    
    withWorld({ "50,60": "water", "50,61": "water", "51,60": "water" }, () => {
        assertEquals(run(logicActions.logicCount.fn, at(50, 60), { size: 2, element: "water" }), 3);
        assertEquals(run(logicActions.logicCount.fn, at(0, 0), { size: 2, element: "water" }), 0);
    });
});

Deno.test("a walk with no element to look for refuses rather than matching everything", () => {
    
    
    withWorld({ "0,0": "water" }, () => {
        assertEquals(run(logicActions.logicCount.fn, at(0, 0), { size: 1 }), 0);
        assertEquals(run(logicActions.logicAny.fn, at(0, 0), { size: 1 }), false);
        assertEquals(run(logicActions.logicAll.fn, at(0, 0), { size: 1 }), false);
    });
});

Deno.test("logicSum totals hit points and counts an empty cell as zero", () => {
    withWorld({ "0,0": "water" }, (w) => {
        w.setHp(0, 0, 40);
        w.setHp(1, 0, 60);
        
        assertEquals(run(logicActions.logicSum.fn, at(0, 0), { size: 2 }), 100);
    });
});

Deno.test("logicForEach writes at every cell of the range", () => {
    withWorld({ "0,0": "air", "1,0": "air", "0,1": "air", "1,1": "air" }, (w) => {
        
        const n = run(
            logicActions.logicForEach.fn,
            at(0, 0),
            { size: 2, to: "stone" },
            { getResolvedTypeAtCell: w.read, isCellEmptyAtCell: isEmptyOf(w) },
        );
        assertEquals(n, 4);
        assertEquals(
            w.written.map((c) => `${c.x},${c.y}`).sort(),
            ["0,0", "0,1", "1,0", "1,1"],
        );
        assertEquals(w.written.every((c) => c.type === "stone"), true);
    });
});

Deno.test("the `when` guard is applied per cell, not once for the range", () => {
    
    
    withWorld({ "0,0": "water", "1,0": "sand", "0,1": "sand", "1,1": "sand" }, (w) => {
        const n = run(
            logicActions.logicForEach.fn,
            at(0, 0),
            { size: 2, to: "stone", when: "water" },
            { getResolvedTypeAtCell: w.read, isCellEmptyAtCell: isEmptyOf(w) },
        );
        assertEquals(n, 1, "only the water cell should change");
        assertEquals(w.written, [{ x: 0, y: 0, type: "stone" }]);
    });
});

Deno.test("logicForEach with no type to write changes nothing", () => {
    withWorld({ "0,0": "air" }, (w) => {
        const n = run(
            logicActions.logicForEach.fn,
            at(0, 0),
            { size: 2 },
            { getResolvedTypeAtCell: w.read, isCellEmptyAtCell: isEmptyOf(w) },
        );
        assertEquals(n, 0);
        assertEquals(w.written, []);
    });
});

Deno.test("a walk with no engine to ask answers rather than throwing", () => {
    
    
    const previous = (globalThis as { sandkit?: unknown }).sandkit;
    delete (globalThis as { sandkit?: unknown }).sandkit;
    try {
        assertEquals(run(logicActions.logicAny.fn, at(0, 0), { size: 3, element: "water" }), false);
        assertEquals(run(logicActions.logicCount.fn, at(0, 0), { size: 3, element: "water" }), 0);
        assertEquals(run(logicActions.logicAll.fn, at(0, 0), { size: 3, element: "water" }), false);
        assertEquals(run(logicActions.logicSum.fn, at(0, 0), { size: 3 }), 0);
        assertEquals(run(logicActions.logicForEach.fn, at(0, 0), { size: 3, to: "stone" }), 0);
    } finally {
        if (previous !== undefined) (globalThis as { sandkit?: unknown }).sandkit = previous;
    }
});
