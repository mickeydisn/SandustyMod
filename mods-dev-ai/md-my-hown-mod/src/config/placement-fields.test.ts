
import { assertEquals } from "jsr:@std/assert";

import { decideActions } from "../handler/actions/decide/index.ts";

const CONFIG_PATH = new URL(
    "../../md-random-artefact/config/random-artefact.json",
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
    "../../../md-random-artefact/config/random-artefact.json",
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




const fields = config.placementConfigs![0]!.fields;


function pinnedFor(pref: string): string | null {
    const hits = [
        ["2", "gold"],
        ["3", "copper"],
        ["4", "sand"],
    ].filter(([v]) => compare(null, null, { left: pref, op: "eq", right: v as string }) === 1);
    return hits.length === 1 ? hits[0]![1]! : null;
}



Deno.test("Number('') is 0, so an unguarded threshold spawns every tick", () => {
    
    
    
    assertEquals(Number(""), 0);
    
    assertEquals(
        compare(null, null, { left: "0", op: "gte", right: String(Number("")) }),
        1,
        "progress >= 0 is unconditionally true",
    );
});



Deno.test("the target guard is false when absent and true for every storable value", () => {
    
    
    assertEquals(compare(null, null, { left: "", op: "gt", right: "0" }), 0, "absent");
    assertEquals(compare(null, null, { left: "0", op: "gt", right: "0" }), 0, "stored zero");
    for (const v of ["5", "50", "200"]) {
        assertEquals(compare(null, null, { left: v, op: "gt", right: "0" }), 1, v);
    }
    
    assertEquals(compare(null, null, { left: "49", op: "gte", right: "50" }), 0);
    assertEquals(compare(null, null, { left: "50", op: "gte", right: "50" }), 1);
    assertEquals(compare(null, null, { left: "199", op: "gte", right: "200" }), 0);
    assertEquals(compare(null, null, { left: "200", op: "gte", right: "200" }), 1);
});



Deno.test("the tick reads both fields, and the guard is wired around the target", () => {
    const keys = tick.steps.filter((s) => s.key === "structureData").map((s) => s.options?.key);
    assertEquals(keys, ["matPref", "chargeTarget"]);

    
    
    
    
    const guard = tick.steps.find((s) => s.key === "if" && s.options?.var === "hasTarget")!;
    assertEquals(guard.then?.[0]?.as, "full");
    assertEquals(guard.else?.[0]?.as, "full");
    assertEquals(guard.then?.[0]?.options?.right, "{{target}}");
    assertEquals(guard.else?.[0]?.options?.right, "50");

    
    const spawn = tick.steps.find((s) => s.key === "if" && s.options?.var === "full")!;
    assertEquals(spawn.then?.some((s) => s.key === "buildStructure"), true);
});

Deno.test("the progress slot can actually reach the highest target", () => {
    
    
    
    
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
    
    assertEquals(config.placementConfigs![0]!.structureId, gen.id);
    
    assertEquals(typeof config.placementConfigs![0]!.id, "string");
});



Deno.test("compare is numeric only, which is why the material values are 1..4", () => {
    
    
    
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
    
    
    
    assertEquals(pinnedFor("1"), null);
    assertEquals(pinnedFor(""), null);
});
