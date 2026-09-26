/**
 * extract-object-graph.test.ts — guards the Phase 2 object graph.
 *
 * The interesting failures here are all about *which* name space a reference
 * lives in. Getting `ItemId` wrong turns a string id into a number and the
 * engine silently drops the link, so the classifier is pinned hard.
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
    buildGraph,
    classifyIdSpace,
    classifyIdSpaceAll,
    referencedTypes,
} from "./extract-object-graph.ts";
import type { Namespace } from "./extract-public-api.ts";

const role = (
    name: string,
    rhs: string,
): string => classifyIdSpace(name, rhs).role;

Deno.test("classifyIdSpace separates handles, ids and refs", () => {
    // the three canonical shapes, taken verbatim from shared/api/elements.d.ts
    assertEquals(
        role("ElementType", `ElementTypeEnum | TaggedNumber<"elementType">`),
        "handle",
    );
    assertEquals(role("ElementId", "LooseString<never>"), "id");
    assertEquals(role("ElementRef", "ElementType | ElementId"), "other");

    assertEquals(
        role("StructureType", `StructureTypeEnum | TaggedNumber<"structureType">`),
        "handle",
    );
    assertEquals(
        role("TerrainType", `CellTypeEnum | TaggedNumber<"terrainType">`),
        "handle",
    );
    assertEquals(role("PickupType", "PickupTypeEnum"), "handle");
    assertEquals(role("EventId", "LooseString<keyof EventPayloadMap>"), "id");
});

Deno.test("a union admitting both a number and a string is a ref, not a handle", () => {
    // regression: `ItemId = ItemIdEnum | LooseString<never>` was read as a handle
    // because it contains an enum, which makes a picker emit a number where the
    // engine accepts either.
    assertEquals(role("ItemId", "ItemIdEnum | LooseString<never>"), "ref");
    assertEquals(
        role("TechGridId", `TechEnum | LooseString<never> | TaggedNumber<"tech">`),
        "ref",
    );
});

Deno.test("chains are resolved to a fixpoint", () => {
    const out = classifyIdSpaceAll([
        { name: "ElementType", target: `ElementTypeEnum | TaggedNumber<"e">`, doc: "" },
        { name: "ElementId", target: "LooseString<never>", doc: "" },
        // deliberately listed before the types it is built from
        { name: "ElementRef", target: "ElementType | ElementId", doc: "" },
    ]);
    const byName = Object.fromEntries(out.map((s) => [s.name, s.role]));
    assertEquals(byName.ElementRef, "ref");
    assertEquals(byName.ElementType, "handle");
    assertEquals(byName.ElementId, "id");
});

Deno.test("a vague redeclaration does not shadow a precise one", () => {
    // regression: `sandkit/api/signals.d.ts` declares `StructureType = unknown`
    // while the shared typings give the real definition. Taking the first
    // declaration loses `StructureRef`, which then looks like a plain string id.
    const out = classifyIdSpaceAll([
        { name: "StructureType", target: "unknown", doc: "" },
        {
            name: "StructureType",
            target: `StructureTypeEnum | TaggedNumber<"structureType">`,
            doc: "",
        },
        { name: "StructureId", target: "LooseString<never>", doc: "" },
        { name: "StructureRef", target: "StructureType | StructureId", doc: "" },
    ]);
    const byName = Object.fromEntries(out.map((s) => [s.name, s.role]));
    assertEquals(byName.StructureType, "handle");
    assertEquals(byName.StructureRef, "ref");
});

Deno.test("referencedTypes ignores primitives and utilities", () => {
    assertEquals(referencedTypes("string"), []);
    assertEquals(referencedTypes("Record<string, number>"), []);
    assertEquals(referencedTypes("ElementType"), ["ElementType"]);
    assertEquals(
        referencedTypes("ElementRef[] | StructureId"),
        ["ElementRef", "StructureId"],
    );
});

Deno.test("buildGraph records edges and marks the id space", () => {
    const ns: Namespace[] = [{
        name: "elements",
        doc: "",
        thread: null,
        members: [],
        types: [
            {
                namespace: "elements",
                name: "ElementDefinition",
                doc: "",
                file: "t.d.ts",
                line: 1,
                openEnded: false,
                fields: [
                    { name: "id", text: "string", optional: false, doc: "" },
                    { name: "matterType", text: "MatterType", optional: false, doc: "" },
                    { name: "alias", text: "ElementRef", optional: true, doc: "" },
                    { name: "missing", text: "SomethingElse", optional: false, doc: "" },
                ],
            },
            {
                namespace: "elements",
                name: "MatterType",
                doc: "",
                file: "t.d.ts",
                line: 9,
                openEnded: false,
                fields: [],
            },
        ],
        aliases: [
            { name: "ElementType", target: `ElementTypeEnum | TaggedNumber<"e">`, doc: "" },
            { name: "ElementId", target: "LooseString<never>", doc: "" },
            { name: "ElementRef", target: "ElementType | ElementId", doc: "" },
        ],
    }];
    const g = buildGraph(ns);

    // a resolvable named type produces a type edge
    const edge = g.edges.find((e) => e.field === "matterType");
    assertEquals(edge?.from, "ElementDefinition");
    assertEquals(edge?.to, "MatterType");
    assertEquals(edge?.role, "other");

    // a name in the id space produces an edge carrying its role
    const ref = g.edges.find((e) => e.field === "alias");
    assertEquals(ref?.to, "ElementRef");
    assertEquals(ref?.optional, true);

    // primitives and unresolvable names produce no edge at all
    assertEquals(g.edges.some((e) => e.field === "id"), false);
    assertEquals(g.edges.some((e) => e.field === "missing"), false);

    assertEquals(
        g.idSpace.map((s) => s.name).sort(),
        ["ElementId", "ElementRef", "ElementType"],
    );
});
