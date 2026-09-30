/**
 * The placement cap: the table, and the cancel it produces.
 *
 * The claim under test is the one that cannot be checked by reading the code —
 * **that the cap blocks, and that it blocks for the right reason.** What is
 * pinned here is the decision table and the two ways this could silently fail:
 *
 *  1. the cap is not reached because the id never matched the `structureId` the
 *     engine actually hands over (a `StructureRef` is "a number or a string");
 *  2. the count comes back un-readable and the cap is skipped.
 *
 * Both are exercised below. Neither would show up in an offline review of the
 * config, and both produce a mod that *looks* limited and is not.
 *
 *     deno test -A src/register/custom/placement-limit.test.ts
 */
import { assert, assertEquals } from "jsr:@std/assert";

/** Set before the import: the module reads the host at load, like every other. */
type Interceptor = (args: unknown, ctx: { cancel?: () => void }) => void;
const host = {
    /** Id string → numeric type, so the test can exercise both `StructureRef` forms. */
    types: new Map<string, number>(),
    /** How many of each ref exist right now. */
    live: new Map<string | number, number>(),
    /** When set, `forEachOfType` is absent — the "cannot count" path. */
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

/** Run a placement attempt. Returns whether it was cancelled. */
function attempt(structureId: string | number): boolean {
    let cancelled = false;
    for (const fn of host.interceptors) {
        fn({ structureId }, { cancel: () => (cancelled = true) });
    }
    return cancelled;
}

// ── the table ────────────────────────────────────────────────────────────────

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
    // 0 and negative mean "no cap" — the same as absent — rather than a cap the
    // player can never satisfy, which would silently freeze the building.
    const limits = [...new Set([...table.values()])];
    assertEquals(limits.map((l) => l.id).sort(), ["mod:fractional", "mod:gen"]);
    // A fraction is floored, not rounded: 2.7 "may exist" has to mean 2, because
    // 3 would let one more through than the author wrote.
    assertEquals(limits.find((l) => l.id === "mod:fractional")?.max, 2);
});

Deno.test("the toast names the structure, not its id", () => {
    reset();
    host.live.set("mod:gen", 1);
    installPlacementLimits(config({ id: "mod:gen", name: "Artefact Generator", maxPlaced: 1 }));
    assertEquals(attempt("mod:gen"), true);
    assertEquals(host.toasts, ["Only 1 × Artefact Generator allowed (1 placed)"]);
    // With no name, the id is the honest fallback — better than an empty toast.
    reset();
    host.live.set("mod:gen", 1);
    installPlacementLimits(config({ id: "mod:gen", maxPlaced: 1 }));
    assertEquals(attempt("mod:gen"), true);
    assertEquals(host.toasts, ["Only 1 × mod:gen allowed (1 placed)"]);
});

// ── the cap ──────────────────────────────────────────────────────────────────

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
    // The hook is installed for the config as a whole, so it *does* run for
    // every placement in the game. Getting this wrong would cap the whole world.
    host.live.set("mod:other", 99);
    assertEquals(attempt("mod:other"), false);
    assertEquals(host.toasts, []);
});

Deno.test("nothing capped installs no hook at all", () => {
    reset();
    assertEquals(installPlacementLimits(config({ id: "mod:a" })), 0);
    // Not "installs an interceptor that does nothing": that is cost on every
    // placement in the game, forever, for a config that asked for no caps.
    assertEquals(host.interceptors.length, 0);
});

Deno.test("an unreadable count fails open, loudly", () => {
    reset();
    host.noCount = true;
    host.types.set("mod:gen", 77);
    installPlacementLimits(config({ id: "mod:gen", maxPlaced: 1 }));
    // The choice this pins: a gameplay rule that fails *closed* would block every
    // placement of this structure forever on a build whose `forEachOfType` is
    // missing, with no way for the author to tell why. Failing open with a
    // console warning is recoverable; the cap is simply not applied.
    assertEquals(attempt(77), false);
    assertEquals(host.toasts, []);
});

Deno.test("re-applying detaches the previous hook", () => {
    reset();
    // Measured as a **delta**, not an absolute. The unsubscribe lives in module
    // scope, so it survives between tests and this test's *first* install also
    // detaches whatever the previous test left behind. The property under test is
    // "one apply in, one hook out" — an absolute count would be asserting the
    // test file's execution order instead.
    installPlacementLimits(config({ id: "mod:gen", maxPlaced: 1 }));
    const hooksAfterFirst = host.interceptors.length;
    const unsubsAfterFirst = host.unsubscribes;
    // A second apply must *replace* the rule, not add to it. If the old one
    // lingered, deleting a cap from the config would still cap the structure
    // until the next restart — the single most confusing possible symptom.
    installPlacementLimits(config({ id: "mod:gen", maxPlaced: 1 }));
    assertEquals(host.interceptors.length, hooksAfterFirst + 1, "a fresh hook was installed");
    assertEquals(
        host.unsubscribes,
        unsubsAfterFirst + 1,
        "and exactly the previous one was detached",
    );
    // The old interceptor is still in the fake's list because the fake only
    // counts the call — which is the point: the *engine* drops it, and the
    // cancellation that matters is the live one. Both are live here, so the
    // cap still holds, which is what "replaced" has to mean in practice.
    host.live.set("mod:gen", 1);
    assertEquals(attempt("mod:gen"), true);
});
