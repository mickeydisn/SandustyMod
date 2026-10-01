
import { assert, assertEquals } from "jsr:@std/assert";


type Interceptor = (args: unknown, ctx: { cancel?: () => void }) => void;
const host = {
    
    types: new Map<string, number>(),
    
    live: new Map<string | number, number>(),
    
    noCount: false,
    interceptors: [] as Interceptor[],
    unsubscribes: 0,
    toasts: [] as string[],
};
(globalThis as Record<string, unknown>).sandkit = {
    api: {
        structures: {
            getTypeById: (id: string) => host.types.get(id) ?? id,
            forEachOfType: host.noCount ? undefined : (ref: string | number, cb: () => void) => {
                const n = host.live.get(ref) ?? 0;
                for (let i = 0; i < n; i++) cb();
            },
        },
        hooks: {
            intercept: (id: string, fn: Interceptor) => {
                assertEquals(id, "building:place");
                host.interceptors.push(fn);
                return () => {
                    host.unsubscribes++;
                };
            },
        },
        ui: { toast: (m: string) => host.toasts.push(m) },
    },
};

const { buildLimitTable, installPlacementLimits } = await import("./placement-limit.ts");
const { DEFAULT_CONFIG } = await import("../../constants.ts");

function reset(): void {
    host.types.clear();
    host.live.clear();
    host.interceptors.length = 0;
    host.toasts.length = 0;
    host.noCount = false;
    host.unsubscribes = 0;
}

function config(
    ...structures: { id: string; name?: string; maxPlaced?: number }[]
) {
    return { ...DEFAULT_CONFIG, structures } as never;
}


function attempt(structureId: string | number): boolean {
    let cancelled = false;
    for (const fn of host.interceptors) {
        fn({ structureId }, { cancel: () => (cancelled = true) });
    }
    return cancelled;
}



Deno.test("only structures with a real positive cap are in the table", () => {
    reset();
    const table = buildLimitTable(
        config(
            { id: "mod:gen", maxPlaced: 1 },
            { id: "mod:none" },
            { id: "mod:zero", maxPlaced: 0 },
            { id: "mod:negative", maxPlaced: -3 },
            { id: "mod:fractional", maxPlaced: 2.7 },
            { id: "mod:nan", maxPlaced: Number.NaN },
        ),
    );
    
    
    const limits = [...new Set([...table.values()])];
    assertEquals(limits.map((l) => l.id).sort(), ["mod:fractional", "mod:gen"]);
    
    
    assertEquals(limits.find((l) => l.id === "mod:fractional")?.max, 2);
});

Deno.test("the toast names the structure, not its id", () => {
    reset();
    host.live.set("mod:gen", 1);
    installPlacementLimits(config({ id: "mod:gen", name: "Artefact Generator", maxPlaced: 1 }));
    assertEquals(attempt("mod:gen"), true);
    assertEquals(host.toasts, ["Only 1 × Artefact Generator allowed (1 placed)"]);
    
    reset();
    host.live.set("mod:gen", 1);
    installPlacementLimits(config({ id: "mod:gen", maxPlaced: 1 }));
    assertEquals(attempt("mod:gen"), true);
    assertEquals(host.toasts, ["Only 1 × mod:gen allowed (1 placed)"]);
});



Deno.test("the cap allows up to the limit and cancels the one after", () => {
    reset();
    host.types.set("mod:gen", 77);
    host.live.set(77, 0);
    installPlacementLimits(config({ id: "mod:gen", name: "G", maxPlaced: 1 }));
    assertEquals(attempt(77), false, "nothing placed yet");
    host.live.set(77, 1);
    assertEquals(attempt(77), true, "one already exists");
    host.live.set(77, 2);
    assertEquals(attempt(77), true, "over the limit is still refused");
});

Deno.test("an uncapped structure is never touched", () => {
    reset();
    installPlacementLimits(config({ id: "mod:other" }, { id: "mod:gen", maxPlaced: 1 }));
    
    
    host.live.set("mod:other", 99);
    assertEquals(attempt("mod:other"), false);
    assertEquals(host.toasts, []);
});

Deno.test("nothing capped installs no hook at all", () => {
    reset();
    assertEquals(installPlacementLimits(config({ id: "mod:a" })), 0);
    
    
    assertEquals(host.interceptors.length, 0);
});

Deno.test("an unreadable count fails open, loudly", () => {
    reset();
    host.noCount = true;
    host.types.set("mod:gen", 77);
    installPlacementLimits(config({ id: "mod:gen", maxPlaced: 1 }));
    
    
    
    
    assertEquals(attempt(77), false);
    assertEquals(host.toasts, []);
});

Deno.test("re-applying detaches the previous hook", () => {
    reset();
    
    
    
    
    
    installPlacementLimits(config({ id: "mod:gen", maxPlaced: 1 }));
    const hooksAfterFirst = host.interceptors.length;
    const unsubsAfterFirst = host.unsubscribes;
    
    
    
    installPlacementLimits(config({ id: "mod:gen", maxPlaced: 1 }));
    assertEquals(host.interceptors.length, hooksAfterFirst + 1, "a fresh hook was installed");
    assertEquals(
        host.unsubscribes,
        unsubsAfterFirst + 1,
        "and exactly the previous one was detached",
    );
    
    
    
    
    host.live.set("mod:gen", 1);
    assertEquals(attempt("mod:gen"), true);
});
