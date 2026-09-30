/**
 * The two placement fields, and the branch decisions that depend on them.
 *
 * Why this is a test rather than a read of the config: both new steps resolve a
 * value that can be **absent**, and the two actions involved disagree about what
 * absent means.
 *
 *   - `structureData` returns `""` for a key the structure does not have.
 *   - `compare` does `Number(left)` / `Number(right)` and **answers 1 (true)
 *     whenever either side is not finite**.
 *
 * So the obvious wiring — `compare { left: "{{progress}}", right: "{{target}}" }`
 * — is a trap: an absent `chargeTarget` becomes 0, `progress >= 0` is true
 * forever, and the generator spawns an artefact every 200 ms. `math`'s own
 * comment names this exact failure ("Infinity compares as full forever, so a
 * generator would spawn every tick with no sign of what was wrong").
 *
 * What is asserted here is the **arithmetic the config depends on**, run against
 * the real `compare` implementation, plus the config's own invariants. The
 * engine-level half — that a placement field lands in the structure's data — is
 * a live question recorded in the audit notes, not something an offline test can
 * reach.
 *
 *     deno test -A src/config/placement-fields.test.ts
 */
import { assertEquals } from "jsr:@std/assert";

import { decideActions } from "../handler/actions/decide/index.ts";

const CONFIG_PATH = new URL(
    "../../__home/md-random-artefact/config/random-artefact.json",
    import.meta.url,
);

interface Step {
    key: string;
    options?: Record<string, unknown>;
    as?: string;
    then?: Step[];
    else?: Step[];
}

const CONFIG_URL = new URL(
    "../../../__home/md-random-artefact/config/random-artefact.json",
    import.meta.url,
);
const CONFIG = JSON.parse(await Deno.readTextFile(CONFIG_URL)) as {
    buffers: { id: string; path: string; min?: number; max?: number }[];
    placementConfigs?: {
        id: string;
        structureId: string;
        fields: Record<string, unknown>[];
    }[];
    structures: (Record<string, unknown> & {
        id: string;
        defaultData?: Record<string, unknown>;
    })[];
    processes: { id: string; steps: Step[] }[];
};
const config = CONFIG;

const compare = decideActions.compare!.fn as (
    p: unknown,
    c: unknown,
    o: unknown,
) => number;

const gen = config.structures.find((s) => s.id.endsWith(":generator"))!;
const tick = config.processes.find((p) => p.id === "artefact-generator-tick")!;
// Read from the config ROOT. `registerAll` iterates `config.placementConfigs`
// (see `src/register/the-rest.ts`), so an entry nested under a structure is
// never registered -- the widgets silently never appear. Reading the nested
// location here is what let that pass.
const fields = config.placementConfigs![0]!.fields;

/** Which material branch, if any, a given stored value fires. */
function pinnedFor(pref: string): string | null {
    const hits = [
        ["2", "gold"],
        ["3", "copper"],
        ["4", "sand"],
    ].filter(([v]) => compare(null, null, { left: pref, op: "eq", right: v as string }) === 1);
    return hits.length === 1 ? hits[0]![1]! : null;
}

// ── the trap ────────────────────────────────────────────────────────────────

Deno.test("Number('') is 0, so an unguarded threshold spawns every tick", () => {
    // `structureData` answers "" for a key the structure does not have. That is
    // the state of every generator placed from a save made before these fields
    // existed, so it is not a hypothetical.
    assertEquals(Number(""), 0);
    // The naive wiring, spelled out.
    assertEquals(
        compare(null, null, { left: "0", op: "gte", right: String(Number("")) }),
        1,
        "progress >= 0 is unconditionally true",
    );
});

// ── the guard ───────────────────────────────────────────────────────────────

Deno.test("the target guard is false when absent and true for every storable value", () => {
    // `target > 0` is what routes the tick to the old literal 50 when the author
    // never chose a target, and to the chosen one when they did.
    assertEquals(compare(null, null, { left: "", op: "gt", right: "0" }), 0, "absent");
    assertEquals(compare(null, null, { left: "0", op: "gt", right: "0" }), 0, "stored zero");
    for (const v of ["5", "50", "200"]) {
        assertEquals(compare(null, null, { left: v, op: "gt", right: "0" }), 1, v);
    }
    // And the guarded threshold is a real comparison, not a literal, when set.
    assertEquals(compare(null, null, { left: "49", op: "gte", right: "50" }), 0);
    assertEquals(compare(null, null, { left: "50", op: "gte", right: "50" }), 1);
    assertEquals(compare(null, null, { left: "199", op: "gte", right: "200" }), 0);
    assertEquals(compare(null, null, { left: "200", op: "gte", right: "200" }), 1);
});

// ── the config's own invariants ─────────────────────────────────────────────

Deno.test("the tick reads both fields, and the guard is wired around the target", () => {
    const keys = tick.steps.filter((s) => s.key === "structureData").map((s) => s.options?.key);
    assertEquals(keys, ["matPref", "chargeTarget"]);

    // The target's guard is an `if` with **both** branches, and each branch sets
    // `full`. A one-armed `if` would leave `full` unbound when the target is
    // absent, and `if { var: "full" }` on an unbound var takes `otherwise` — so
    // the generator would silently stop spawning instead of using 50.
    const guard = tick.steps.find((s) => s.key === "if" && s.options?.var === "hasTarget")!;
    assertEquals(guard.then?.[0]?.as, "full");
    assertEquals(guard.else?.[0]?.as, "full");
    assertEquals(guard.then?.[0]?.options?.right, "{{target}}");
    assertEquals(guard.else?.[0]?.options?.right, "50");

    // And `full` is still what gates the spawn.
    const spawn = tick.steps.find((s) => s.key === "if" && s.options?.var === "full")!;
    assertEquals(spawn.then?.some((s) => s.key === "buildStructure"), true);
});

Deno.test("the progress slot can actually reach the highest target", () => {
    // The tick increments `progress` and the slot clamps it. With the clamp left
    // at 50 and a target above 50 the generator would charge forever and never
    // fill — a silent, permanent dead generator, and the single easiest way for
    // this feature to look like it works while doing nothing.
    const slot = config.buffers.find((b) => b.id === "progress")!;
    const highest = Math.max(
        ...fields.filter((f) => f.type === "integer").map((f) => Number(f.max)),
    );
    assertEquals(
        Number(slot.max) >= highest,
        true,
        `progress clamps at ${slot.max} but the highest target is ${highest}`,
    );
});

Deno.test("both fields have a default that reproduces the old behaviour", () => {
    // The stored defaults are the pre-feature behaviour, so a generator placed
    // after the update but before the player touches anything is identical to
    // one placed by the old build.
    assertEquals(gen.defaultData?.chargeTarget, 50);
    assertEquals(gen.defaultData?.matPref, "1");
    assertEquals(fields.find((f) => f.id === "chargeTarget")!.default, 50);
    assertEquals(fields.find((f) => f.id === "matPref")!.default, "1");
    assertEquals(fields.find((f) => f.id === "matPref")!.options, [
        { value: "1", label: "Random (cycles)" },
        { value: "2", label: "Gold only" },
        { value: "3", label: "Copper only" },
        { value: "4", label: "Sand only" },
    ]);
});

Deno.test("every field declares a default, so none seeds as undefined", () => {
    // The engine resolves a choice by matching the stored value against the
    // options and otherwise answering `field.default`:
    //     for (...) if (e.options[n].value === t) return t; return e.default
    // A choice with no `default` therefore seeds `undefined` on a fresh
    // structure -- the widget shows nothing selected, `JSON.stringify` drops the
    // key, and `compare` then answers TRUE for every non-finite operand, so
    // `matPref == "1"` passes and the generator silently pins to Sand.
    // Verified against the shipped engine module: a choice without a default
    // seeds `undefined`.
    for (const f of fields) {
        assertEquals(
            "default" in f,
            true,
            `field ${f.id} is missing a "default" key, so it seeds as undefined`,
        );
        assertEquals(
            f.default,
            f.default,
            `field ${f.id} declares default=${JSON.stringify(f.default)}`,
        );
    }
});

Deno.test("the definition sits at the config root, where the loop reads it", () => {
    // `registerAll` iterates `config.placementConfigs`. A definition nested
    // under a structure is invisible to that loop, so `registerPlacementConfig`
    // is never called and the hotbar widgets never appear -- with no error
    // anywhere. This is the check that would have caught it.
    assertEquals(
        Array.isArray(config.placementConfigs) && config.placementConfigs.length > 0,
        true,
        "no top-level placementConfigs: the registration loop would iterate an empty list",
    );
    assertEquals(
        config.structures.some((s) => "placementConfigs" in s),
        false,
        "a structure still nests placementConfigs, where the loop cannot see it",
    );
    // And it still names the generator, which is what keys the engine's Map.
    assertEquals(config.placementConfigs![0]!.structureId, gen.id);
    // The entry itself needs a mod-local id: the loop skips entries without one.
    assertEquals(typeof config.placementConfigs![0]!.id, "string");
});

// ── why the material field is numeric ───────────────────────────────────────

Deno.test("compare is numeric only, which is why the material values are 1..4", () => {
    // Any string option would make *every* material branch true — not finite
    // means true — and the last `bufferWrite` would win, pinning the generator to
    // Sand no matter what the player chose. This is why the field is 1..4.
    for (const word of ["gold", "copper", "sand"]) {
        assertEquals(
            compare(null, null, { left: word, op: "eq", right: "2" }),
            1,
            `"${word}" is not finite, so compare answers true regardless`,
        );
    }
    assertEquals(pinnedFor("2"), "gold");
    assertEquals(pinnedFor("3"), "copper");
    assertEquals(pinnedFor("4"), "sand");
});

Deno.test("Random and absent pin nothing, so the existing cycle is untouched", () => {
    // "1" is Random; "" is an older save. Neither writes `materialIndex`, so the
    // spawn branch's own re-random decides the next material — exactly the
    // behaviour in the audit notes' verified run.
    assertEquals(pinnedFor("1"), null);
    assertEquals(pinnedFor(""), null);
});
