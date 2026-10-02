import { defineActions } from "../../engine/types.ts";
import type { CellMutation, ProcessingContext } from "../api/processors.ts";
import { p } from "../../engine/registry/params.ts";

function commitOrWarn(
    context: unknown,
    mutations: CellMutation[],
    label: string,
): boolean {
    const ctx = context as ProcessingContext | null;
    if (!ctx?.commit) {
        console.warn(
            `[md-my-hown-mod:act] ${label}: this call site hands over no cell ` +
                "context, so nothing was written",
        );
        return false;
    }
    try {
        const ok = ctx.commit(mutations);
        if (ok === false) {
            console.warn(
                `[md-my-hown-mod:act] ${label}: the engine refused the write — ` +
                    "the cell was probably occupied or changed mid-tick",
            );
        }
        return ok !== false;
    } catch (e) {
        console.warn(`[md-my-hown-mod:act] ${label} failed`, e);
        return false;
    }
}

function at(
    structure: { x?: number; y?: number } | null,
    dx: number,
    dy: number,
): { cellX: number; cellY: number } {
    return { cellX: (structure?.x ?? 0) + dx, cellY: (structure?.y ?? 0) + dy };
}

export const processorActions = defineActions({
    processorLog: {
        role: "act",
        needs: [],
        doc: "Logs the structure and cell context on every run. Use to confirm wiring.",
        type: "processor",
        slots: ["processing"],
        scope: "structure",
        params: [],
        fn: (structure, context) => {
            console.log("[md-my-hown-mod:process]", structure, context);
        },
    },

    processorNoop: {
        role: "act",
        needs: [],
        doc: "Does nothing. Keeps the interval alive without side effects.",
        type: "global",
        slots: ["processing"],
        scope: "structure",
        params: [],
        fn: () => {},
    },

    processorLift: {
        role: "act",
        needs: ["pos", "commit"],
        doc: "Copies the cell above the structure down to the cell below.",
        type: "processor",
        slots: ["processing"],
        scope: "cell",
        params: [
            p("x", "Cell x", "number", { min: 0, int: true }),
            p("y", "Cell y", "number", { min: 0, int: true }),
        ],
        fn: (structure, context) => {
            try {
                const s = structure as { x?: number; y?: number } | null;
                const ctx = context as ProcessingContext | null;
                if (!s || !ctx?.getResolvedTypeAtCell) return;
                const src = at(s, 0, -1);
                const dst = at(s, 0, 1);
                const elementType = ctx.getResolvedTypeAtCell(src.cellX, src.cellY);
                if (elementType === undefined || elementType === null) return;
                commitOrWarn(context, [
                    { kind: "remove", ...src, expectedElementType: elementType },
                    { kind: "create", ...dst, elementType },
                ], "lift");
            } catch (e) {
                console.warn("[md-my-hown-mod:act] lift failed", e);
            }
        },
    },

    processorConvert: {
        role: "act",
        needs: ["pos", "commit"],
        doc: "Replaces the cell above with one fixed element. Set `to` in options.",
        type: "processor",
        slots: ["processing"],
        scope: "cell",
        params: [
            p("to", "Output element", "text", {
                required: true,
                hint: "element id committed into the cell",
            }),
            p("chance", "Chance", "number", { def: "1", min: 0, max: 1 }),
        ],
        fn: (structure, context, options) => {
            try {
                const s = structure as { x?: number; y?: number } | null;
                const ctx = context as ProcessingContext | null;
                const target = (options as { to?: unknown } | null)?.to;
                if (!s || !ctx?.getResolvedTypeAtCell) return;
                const src = at(s, 0, -1);
                const current = ctx.getResolvedTypeAtCell(src.cellX, src.cellY);
                if (current === undefined || current === null) return;
                if (target === undefined || target === null) {
                    console.log("[md-my-hown-mod:process] convert sees", current);
                    return;
                }

                commitOrWarn(context, [{ kind: "create", ...src, elementType: target }], "convert");
            } catch (e) {
                console.warn("[md-my-hown-mod:act] convert failed", e);
            }
        },
    },
});
