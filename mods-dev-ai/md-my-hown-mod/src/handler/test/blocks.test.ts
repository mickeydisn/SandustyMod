
import { assert, assertEquals } from "https:
import {
    BLOCK_KEY,
    compileProcess,
    flattenRefs,
    type HandlerActionRef,
    isBlock,
    MAX_BLOCK_DEPTH,
    type ProcessFailure,
} from "../core/process.ts";
import { formatActionRefs, parseActionRefs } from "../../ui/definition/actions-field.ts";


function block(
    test: string,
    then: HandlerActionRef[],
    otherwise?: HandlerActionRef[],
): HandlerActionRef {
    return otherwise
        ? { key: BLOCK_KEY, options: { var: test }, then, else: otherwise }
        : { key: BLOCK_KEY, options: { var: test }, then };
}


function toastsOf(refs: HandlerActionRef[]): string[] {
    const seen: string[] = [];
    const g = globalThis as { sandkit?: unknown };
    const prev = g.sandkit;
    g.sandkit = {
        api: {
            ui: { toast: (text: unknown) => seen.push(String(text ?? "")) },
            elements: { getResolvedTypeAtCell: () => "water" },
            grid: { isCellEmptyAtCell: () => false },
        },
    };
    try {
        compileProcess(refs, "processing").fn({ x: 0, y: 0 }, null);
    } finally {
        if (prev === undefined) delete g.sandkit;
        else g.sandkit = prev;
    }
    return seen;
}


const says = (text: string): HandlerActionRef => ({
    key: "toast",
    options: { text },
});

Deno.test("a true condition runs `then` and never `else`", () => {
    
    const ran = toastsOf([
        { key: "logicCount", as: "flag", options: { element: "water", size: 3 } },
        block(
            "flag",
            [says("then")],
            [says("else")],
        ),
    ]);
    assertEquals(ran, ["then"]);
});

Deno.test("a falsy condition runs `else` and never `then`", () => {
    
    
    
    const ran = toastsOf([
        { key: "countEmpty", as: "flag", options: { size: 1 } },
        block(
            "flag",
            [says("then")],
            [says("else")],
        ),
    ]);
    assertEquals(ran, ["else"]);
});

Deno.test("a variable that was never bound takes `else` rather than throwing", () => {
    
    
    
    const ran = toastsOf([
        block(
            "neverBound",
            [says("then")],
            [says("else")],
        ),
    ]);
    assertEquals(ran, ["else"]);
});

Deno.test("a block with only a `then` runs nothing when false", () => {
    assertEquals(
        toastsOf([
            { key: "countEmpty", as: "flag", options: { size: 1 } },
            block("flag", [says("then")]),
        ]),
        [],
    );
});

Deno.test("blocks nest, and the branch is decided at every level", () => {
    
    
    const ran = toastsOf([
        { key: "logicCount", as: "outer", options: { element: "water", size: 3 } },
        block("outer", [
            { key: "countEmpty", as: "inner", options: { size: 1 } },
            block(
                "inner",
                [says("inner-then")],
                [says("inner-else")],
            ),
        ]),
    ]);
    assertEquals(ran, ["inner-else"]);
});

Deno.test("both arms are compiled, so an action in `else` is not reported missing", () => {
    
    
    const compiled = compileProcess(
        [block("x", [{ key: "processorNoop" }], [{ key: "processorLog" }])],
        "processing",
    );
    assertEquals(compiled.skipped, []);
});

Deno.test("nesting past the cap is reported rather than overflowing the stack", () => {
    
    let inner: HandlerActionRef[] = [{ key: "processorNoop" }];
    for (let i = 0; i < MAX_BLOCK_DEPTH + 4; i++) inner = [block("v", inner)];
    const failures: ProcessFailure[] = [];
    compileProcess(inner, "processing", (f) => failures.push(f));
    assert(
        failures.some((f) => String(f.error).includes(String(MAX_BLOCK_DEPTH))),
        "the cap must be reported, not silently truncating",
    );
});

Deno.test("a block with no `var` is refused, not guessed", () => {
    
    
    const failures: ProcessFailure[] = [];
    compileProcess(
        [{ key: BLOCK_KEY, then: [{ key: "processorNoop" }] }],
        "processing",
        (f) => failures.push(f),
    );
    assertEquals(failures.length, 1);
    assert(String(failures[0].error).includes("options.var"));
});

Deno.test("branches on a plain action are reported and dropped", () => {
    const failures: ProcessFailure[] = [];
    compileProcess(
        [{ key: "processorNoop", then: [{ key: "processorLog" }] }],
        "processing",
        (f) => failures.push(f),
    );
    assertEquals(failures.length, 1);
    assert(String(failures[0].error).includes("if block"));
});

Deno.test("a process with a block counts as using the context", () => {
    
    assertEquals(
        compileProcess(
            [{ key: "noop", as: "a" }, block("a", [{ key: "processorNoop" }])],
            "processing",
        ).usesContext,
        true,
    );
    assertEquals(
        compileProcess([{ key: "processorNoop" }, { key: "processorLog" }], "processing")
            .usesContext,
        false,
    );
});

Deno.test("flattenRefs reaches every branch, so the panel counts them all", () => {
    const refs = [
        { key: "a" } as HandlerActionRef,
        block("x", [{ key: "b" }], [block("y", [{ key: "c" }])]),
    ];
    assertEquals(flattenRefs(refs).map((r) => r.key), ["a", "if", "b", "if", "c"]);
    
    assertEquals(flattenRefs(refs).filter((r) => isBlock(r)).length, 2);
});

Deno.test("a block survives the panel round trip, both arms intact", () => {
    const refs = [
        { key: "isElementAtCell", as: "wet", options: { element: "water" } },
        block("wet", [{ key: "removeElement" }], [
            says("dry"),
        ]),
    ];
    
    
    assertEquals(parseActionRefs(formatActionRefs(refs)), refs);
});

Deno.test("an empty arm round-trips as absent, not as an empty list", () => {
    
    
    const parsed = parseActionRefs(formatActionRefs([block("x", [{ key: "a" }])]));
    assertEquals(parsed[0].else, undefined);
});
