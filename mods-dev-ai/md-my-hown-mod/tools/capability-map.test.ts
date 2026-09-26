/**
 * capability-map.test.ts — guards the Phase 4 reachability analysis.
 *
 * The taxonomy decides what the interface is allowed to claim it can do, so a
 * misclassification is not a cosmetic error: it would put a runtime-only call
 * behind a form and promise a mod author something that cannot work.
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { apiAliases, classify, modNamespaces, modRegisters } from "./capability-map.ts";

Deno.test("registration is reachable from a config", () => {
    for (
        const n of [
            "register",
            "registerType",
            "registerCategory",
            "registerNode",
            "registerBinding",
            "addProcessor",
        ]
    ) {
        assertEquals(classify(n, "method").role, "registerable", n);
    }
});

Deno.test("updateDefinition is registerable but other updates are not", () => {
    // regression: matching the `update` prefix counted `resources.updateEnergy`
    // and `ui.update` as config-reachable; they only change live state.
    assertEquals(classify("updateDefinition", "method").role, "registerable");
    assertEquals(classify("updateEnergy", "method").role, "runtime");
    assertEquals(classify("update", "method").role, "runtime");
});

Deno.test("live-state mutation is runtime, not exposable", () => {
    for (
        const n of [
            "setSpritesheetIndex",
            "removeAt",
            "beginBatchWrite",
            "pressBinding",
            "unregister",
            "triggerBinding",
        ]
    ) {
        assertEquals(classify(n, "method").role, "runtime", n);
    }
});

Deno.test("reads over stored state are queryable", () => {
    for (
        const n of [
            "getAtCell",
            "isType",
            "hasBuiltAtCell",
            "selectWeightedOutput",
            "forEachOfType",
            "getUrl",
        ]
    ) {
        assertEquals(classify(n, "method").role, "queryable", n);
    }
});

Deno.test("constants and enums are internal", () => {
    assertEquals(classify("KeyCode", "value").role, "internal");
    assertEquals(classify("Direction", "enum").role, "internal");
});

Deno.test("classification never reports a required reason as empty", () => {
    for (
        const n of ["register", "getAtCell", "setSpritesheetIndex", "KeyCode"]
    ) {
        assertEquals(classify(n, "method").why.length > 10, true, n);
    }
});

// ------------------------------------------------------- mod coverage

Deno.test("modRegisters reads the wrapper exports", () => {
    const src = [
        "export function registerSignal(a: unknown): void {}",
        "export function registerTerrain(): void {}",
        "export function helper(): void {}",
    ].join("\n");
    assertEquals([...modRegisters(src)], ["registerSignal", "registerTerrain"]);
});

Deno.test("apiAliases finds a namespace bound to a local name", () => {
    const src = "const sig = g()?.api?.signals;\nconst t = g()?.api?.terrains;";
    const al = apiAliases(src);
    assertEquals(al.get("sig"), "signals");
    assertEquals(al.get("t"), "terrains");
});

Deno.test("modNamespaces follows a chained access", () => {
    const got = modNamespaces("g()?.api?.structures?.processing?.register?.(a);");
    assertEquals(got.has("structures"), true);
    assertEquals(got.has("structures.processing"), true);
    assertEquals(got.has("structures.processing.register"), true);
});

Deno.test("modNamespaces resolves an alias to its real namespace", () => {
    // regression: the first chain segment was consumed by the match but never
    // appended, so `sig.targets?.register` resolved to `signals.register` and
    // `signals.targets` looked uncovered when the mod really did drive it.
    const src = [
        "const sig = g()?.api?.signals;",
        "if (!sig) return;",
        "sig.targets?.register?.(def.target, handler);",
    ].join("\n");
    const got = modNamespaces(src);
    assertEquals(got.has("signals.targets"), true);
    assertEquals(got.has("signals.targets.register"), true);
});

Deno.test("modNamespaces ignores the api object and reserved members", () => {
    const got = modNamespaces("g()?.api?.raw?.fn(1); g()?.api?.enums.KEY;");
    assertEquals(got.has("raw"), false);
    assertEquals(got.has("enums"), false);
    assertEquals(got.has("api"), false);
});
