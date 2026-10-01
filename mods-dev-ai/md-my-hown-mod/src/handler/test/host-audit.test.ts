/**
 * The live `api` and the boot audit.
 *
 * ## Why a static import works here
 *
 * `src/host.ts` exports `api` as a `Proxy` that forwards each property read to
 * whatever the host is *at that moment*. So a test installs its fake **after**
 * importing, which is the same order every other suite in this folder uses — no
 * dynamic-import dance, and a test that swaps the host mid-run sees the change.
 *
 * ## What is worth testing
 *
 * 1. **A property read reaches the current host.** That is the proxy's whole job,
 *    and it is what keeps the action suites' install-after-import pattern working.
 * 2. **The injected scope wins over `globalThis`.** The game evaluates a mod as
 *    `new Function("__sandkit", …)`, so `sandkit` is a function *parameter* and
 *    `globalThis.sandkit` is `undefined`. A global-only read made every action in
 *    every role folder silently no-op, and no mocked-api test could catch it.
 * 3. **The audit distinguishes "no host" from "some namespaces missing"**, because
 *    those need different fixes.
 * 4. **`ACTION_NAMESPACES` cannot drift** from the real `api?.<namespace>` sites.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { api, hasNamespace, host } from "../../host.ts";
import { ACTION_NAMESPACES, auditHost } from "../core/host-audit.ts";

/** Install a stub host (or none) for the duration of `fn`, then restore. */
function withHost<T>(value: unknown, fn: () => T): T {
    const g = globalThis as unknown as { sandkit?: unknown };
    const before = g.sandkit;
    if (value === undefined) delete g.sandkit;
    else g.sandkit = { api: value };
    try {
        return fn();
    } finally {
        if (before === undefined) delete g.sandkit;
        else g.sandkit = before;
    }
}

const STUB = {
    grid: { mutate: () => true },
    elements: { getResolvedTypeAtCell: () => 1 },
};

Deno.test("a property read reaches the host installed right now", () => {
    // The point of the proxy: late-bound, so this test needs no dynamic import and
    // a mid-run host swap is visible.
    withHost(STUB, () => {
        assertEquals(api.grid, STUB.grid);
        assertEquals(api.grid?.mutate, STUB.grid.mutate);
    });
    withHost({ grid: { mutate: () => false } }, () => {
        assertEquals(api.grid?.mutate(), false, "the second host is the one read");
    });
});

Deno.test("an absent namespace reads as undefined, never a throw", () => {
    // The contract this mod has always had, named by the action suites: "an
    // absent api.elements is a warning and a false, never a throw". A throw would
    // abort a processor tick mid-write.
    withHost({ grid: {} }, () => {
        assertEquals(api.grid, {}, "present namespace");
        assertEquals(api.ui, undefined, "absent cosmetic namespace");
        assertEquals(api.signals, undefined, "absent gameplay namespace");
        assertEquals(api.conveyors, undefined, "a namespace that never existed");
        assertEquals(api.grid.deep, undefined, "a missing member of a present namespace");
    });
});

Deno.test("with no host at all every read is undefined and nothing throws", () => {
    withHost(undefined, () => {
        assertEquals(api.grid, undefined);
        assertEquals(api.anything, undefined);
        assertEquals(host, undefined);
        assertEquals(hasNamespace("grid"), false);
    });
});

Deno.test("hasNamespace agrees with what a read returns", () => {
    withHost({ grid: { mutate: () => 1 }, elements: {} }, () => {
        assertEquals(hasNamespace("grid"), true);
        assertEquals(hasNamespace("elements"), true);
        assertEquals(hasNamespace("grid", "mutate"), true);
        assertEquals(hasNamespace("grid", "nope"), false);
        assertEquals(hasNamespace("conveyors"), false);
    });
});

Deno.test("auditHost separates 'no host' from 'some namespaces missing'", () => {
    withHost({ grid: {}, elements: {} }, () => {
        const partial = auditHost(["grid", "elements", "conveyors"]);
        assertEquals(partial.hostFound, true);
        assertEquals([...partial.present].sort(), ["elements", "grid"]);
        assertEquals(partial.missing, ["conveyors"]);
    });
    withHost(undefined, () => {
        const none = auditHost(["grid"]);
        assertEquals(none.hostFound, false);
        assertEquals(none.missing, ["grid"]);
    });
});
Deno.test("ACTION_NAMESPACES lists every namespace the actions actually reach", async () => {
    // Read the sources rather than trusting the list above. A new call reaching a
    // new namespace must fail here, which is the only thing stopping the boot
    // audit from quietly under-reporting.
    //
    // Scanned over the whole `handler/` tree, not just `actions/`: a family's
    // helpers live in `core/` too and are part of what runs in a tick —
    // `cell-region.ts` is where `api.input` is reached. Skipping `test/`, whose
    // fakes are not runtime dependencies.
    //
    // Comments are stripped first: a doc example reading `api?.grid.mutate` is
    // prose about a namespace, not a call site, and counting it would let the list
    // claim coverage that nothing exercises.
    //
    // Recursive, because the actions are one folder per role: a flat read would
    // find no `.ts` files, `names` would be empty, and this would pass
    // vacuously — the one failure mode a drift check must never have.
    const names = new Set<string>();
    const scan = async (dir: URL): Promise<void> => {
        for await (const entry of Deno.readDir(dir)) {
            if (entry.isDirectory) {
                if (entry.name === "test") continue;
                await scan(new URL(`${entry.name}/`, dir));
            } else if (entry.name.endsWith(".ts")) {
                const src = (await Deno.readTextFile(new URL(entry.name, dir)))
                    .replace(/\/\*[\s\S]*?\*\//g, "")
                    .replace(/\/\/.*$/gm, "");
                // `api?.<namespace>` — the first hop off the api. A deeper read
                // like `api?.player?.inventory` still starts here, so the first
                // segment is the namespace.
                for (const m of src.matchAll(/\bapi\?\.([A-Za-z][A-Za-z0-9]*)/g)) {
                    names.add(m[1]);
                }
            }
        }
    };
    await scan(new URL("../", import.meta.url));

    assert(names.size > 0, "the scan found no api?. call sites — has the API changed?");
    assertEquals(
        [...ACTION_NAMESPACES].sort(),
        [...names].sort(),
        "ACTION_NAMESPACES has drifted from the handler call sites",
    );
});
