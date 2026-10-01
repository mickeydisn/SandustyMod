
import { assertEquals } from "jsr:@std/assert";
import { hasPlacementLabel, placementConfigPayload, placementConfigProblem } from "./placement.ts";
import type { PlacementConfigConfig } from "../constants.ts";


const GOOD: PlacementConfigConfig = {
    id: "furnace-tiers",
    structureId: "md-my-hown-mod:furnace",
    fields: [{ type: "integer", id: "tier", label: "Tier", min: 1, max: 3 }],
};



Deno.test("a structureId and a non-empty fields list are both required", () => {
    
    assertEquals(placementConfigProblem(GOOD), null);
    assertEquals(
        placementConfigProblem({ ...GOOD, structureId: "" }),
        "Placement config requires a structureId and fields.",
    );
    
    
    
    assertEquals(
        placementConfigProblem({ ...GOOD, fields: [] }),
        "Placement config requires a structureId and fields.",
    );
    assertEquals(
        placementConfigProblem({ ...GOOD, fields: undefined as never }),
        "Placement config requires a structureId and fields.",
    );
    assertEquals(placementConfigProblem(null), "no placement config");
});



Deno.test("a field needs an id, a label, and an id of its own", () => {
    
    assertEquals(
        placementConfigProblem({
            ...GOOD,
            fields: [{ type: "integer", label: "Tier" } as never],
        }),
        'Invalid or duplicate placement field "undefined".',
    );
    assertEquals(
        placementConfigProblem({
            ...GOOD,
            fields: [{ type: "integer", id: "tier" } as never],
        }),
        'Invalid or duplicate placement field "tier".',
    );
    
    
    assertEquals(
        placementConfigProblem({
            ...GOOD,
            fields: [GOOD.fields[0]!, GOOD.fields[0]!],
        }),
        'Invalid or duplicate placement field "tier".',
    );
});

Deno.test("a labelKey is a label, and a blank label is not", () => {
    
    
    
    assertEquals(hasPlacementLabel({ label: "Tier" }), true);
    assertEquals(hasPlacementLabel({ labelKey: "mods|tier" }), true);
    assertEquals(hasPlacementLabel({ label: "Tier", labelKey: "x" }), true);
    assertEquals(hasPlacementLabel({ label: "   " }), false);
    assertEquals(hasPlacementLabel({ labelKey: "  " }), false);
    assertEquals(hasPlacementLabel({}), false);
    assertEquals(hasPlacementLabel(null), false);
    assertEquals(hasPlacementLabel("Tier"), false);
    
    
    assertEquals(
        placementConfigProblem({
            ...GOOD,
            fields: [{ type: "integer", id: "tier", labelKey: "mods|tier" }],
        }),
        null,
    );
});



Deno.test("a choice needs options, and each option needs a label", () => {
    
    assertEquals(
        placementConfigProblem({
            ...GOOD,
            fields: [{ type: "choice", id: "mode", label: "Mode" }],
        }),
        'Placement choice "mode" requires at least one option.',
    );
    
    assertEquals(
        placementConfigProblem({
            ...GOOD,
            fields: [
                { type: "choice", id: "mode", label: "Mode", options: [{ value: "a" }] },
            ],
        }),
        'Placement choice "mode" has an option without a label.',
    );
    assertEquals(
        placementConfigProblem({
            ...GOOD,
            fields: [
                {
                    type: "choice",
                    id: "mode",
                    label: "Mode",
                    options: [{ value: "a", label: "A" }, { value: "b", labelKey: "k" }],
                },
            ],
        }),
        null,
    );
    
    assertEquals(placementConfigProblem(GOOD), null);
});



Deno.test("a type outside integer/choice is refused before the engine can crash on it", () => {
    
    
    
    
    assertEquals(
        placementConfigProblem({
            ...GOOD,
            fields: [{ type: "slider", id: "tier", label: "Tier" } as never],
        }),
        'Placement field "tier" has type "slider" — expected integer or choice.',
    );
    assertEquals(
        placementConfigProblem({
            ...GOOD,
            fields: [{ id: "tier", label: "Tier" } as never],
        }),
        'Placement field "tier" has type "undefined" — expected integer or choice.',
    );
});



Deno.test("only structureId and fields reach the engine", () => {
    
    
    
    const payload = placementConfigPayload(GOOD);
    assertEquals(Object.keys(payload).sort(), ["fields", "structureId"]);
    assertEquals(payload.structureId, "md-my-hown-mod:furnace");
    assertEquals(payload.fields, GOOD.fields);
});
