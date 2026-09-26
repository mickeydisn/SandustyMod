import { assert, assertEquals } from "jsr:@std/assert";
import { build, controlFor, type Field, parseInterface, refineControls } from "./parameter-map.ts";

const SCHEMA = new URL("../src/ui/schema.ts", import.meta.url).pathname;

// ── parseInterface ───────────────────────────────────────────────────────────

// A .d.ts interface separates members with `;` / newlines, not commas. The
// shared parseObjectType splits on commas and returns ONE field for a whole
// interface body; this is the regression that caught it.
const BODY = [
    "/** Unique mod-scoped terrain id. */",
    "id: string;",
    "/** Default terrain hit points. */",
    "hp?: number;",
    "output?: {",
    "  elementType: string;",
    "  chance: number;",
    "};",
    "[key: string]: unknown;",
].join("\n");

Deno.test("parseInterface reads every member, not one", () => {
    assertEquals(parseInterface(BODY).map((f) => f.name), [
        "id",
        "hp",
        "output",
    ]);
});

Deno.test("parseInterface keeps optionality and the jsdoc meaning", () => {
    const f = parseInterface(BODY)[1];
    assertEquals(f.optional, true);
    assertEquals(f.doc, "Default terrain hit points.");
});

Deno.test("parseInterface skips the index signature", () => {
    assert(!parseInterface(BODY).some((f) => f.name.includes("key")));
});

Deno.test("parseInterface treats a newline inside a member as formatting", () => {
    const fields = parseInterface("tooltip: {\n  type: string;\n  extra: number;\n};");
    assertEquals(fields.length, 1);
    assertEquals(fields[0].type, "{ type: string; extra: number; }");
});

// `()` arrow types contain `<`/`>`. Counting those as brackets unbalances depth
// and swallows every following member.
const ARROWS = "getOptions: () => Record<string, unknown>;\n" +
    "getModData?: () => Record<string, unknown>;\nname: string;";

Deno.test("parseInterface does not let arrow types unbalance depth", () => {
    assertEquals(parseInterface(ARROWS).map((f) => f.name), [
        "getOptions",
        "getModData",
        "name",
    ]);
});

Deno.test("parseInterface keeps the member after an arrow type", () => {
    assertEquals(parseInterface(ARROWS)[2].name, "name");
});

// ── controlFor ───────────────────────────────────────────────────────────────

const CONTROL_CASES: [string, string][] = [
    ["boolean", "toggle"],
    ["number", "number"],
    ["string", "text"],
    ["readonly string[]", "ref-list"],
    ["number[]", "ref-list"],
    ["StructureTooltipHover", "picker"],
    ["Record<string, string | number>", "nested"],
    ["[number, number, number]", "matrix"],
    ["0xFF00AA", "color"],
    ["() => void", "callback"],
    ["", "unknown"],
];

for (const [type, want] of CONTROL_CASES) {
    Deno.test(`controlFor(${type || "empty"}) is ${want}`, () => {
        assertEquals(controlFor(type), want);
    });
}

// ── refineControls ───────────────────────────────────────────────────────────

Deno.test("refineControls marks an all-function interface as a callback", () => {
    const defs = new Map<string, Field[]>([
        ["InputBindingHandlers", [
            { name: "down", type: "() => void", optional: true, doc: "" },
            { name: "up", type: "() => void", optional: true, doc: "" },
        ]],
    ]);
    const params = [{
        name: "handlers",
        type: "InputBindingHandlers",
        optional: false,
        doc: "",
        control: "picker" as const,
    }];
    refineControls(params, defs);
    assertEquals(params[0].control, "callback");
});

Deno.test("refineControls leaves a data-shaped reference a picker", () => {
    const defs = new Map<string, Field[]>([
        ["StructureVariant", [
            { name: "id", type: "StructureRef", optional: false, doc: "" },
            { name: "angles", type: "number[]", optional: false, doc: "" },
        ]],
    ]);
    const params = [{
        name: "variants",
        type: "StructureVariant",
        optional: true,
        doc: "",
        control: "picker" as const,
    }];
    refineControls(params, defs);
    assertEquals(params[0].control, "picker");
});

// ── the real map ─────────────────────────────────────────────────────────────

const reports = await build();

Deno.test("every mapped definition was found in the typings", () => {
    assert(reports.length > 0);
});

Deno.test("no parameter is reported exposed without being declared", () => {
    for (const r of reports) {
        const declared = new Set(r.params.map((p) => p.name));
        const stray = r.exposed.filter((e) => !declared.has(e));
        assertEquals(stray, [], `${r.definition}: ${stray.join(", ")}`);
    }
});

// The Phase 2 "shapes with no engine counterpart" do have counterparts.
Deno.test("structures exposes descriptionParams, linkedClearance, descriptionKey", () => {
    const s = reports.find((r) => r.definition === "SandkitStructureDefinition");
    assert(s, "SandkitStructureDefinition missing");
    for (const f of ["descriptionParams", "linkedClearance", "descriptionKey"]) {
        assert(s.params.some((p) => p.name === f), `${f} not declared`);
        assert(s.exposed.includes(f), `${f} not exposed`);
    }
});

Deno.test("input binding handlers are a callback, never a literal", () => {
    const i = reports.find((r) => r.definition === "InputBindingDefinition");
    assert(i, "InputBindingDefinition missing");
    assertEquals(i.params.find((p) => p.name === "handlers")?.control, "callback");
    assert(!i.exposed.includes("handlers"));
    for (const f of ["displayName", "displayNameKey", "category"]) {
        assert(i.params.some((p) => p.name === f), `${f} not declared`);
    }
});

Deno.test("the input binding form produces every non-callback parameter", async () => {
    const { structuredKeys } = await import("./ui-completeness.ts");
    const keys = structuredKeys(Deno.readTextFileSync(SCHEMA)).get("inputs") ??
        new Set<string>();
    for (
        const k of [
            "displayName",
            "displayNameKey",
            "category",
            "defaultKeys",
            "onDownKey",
            "onUpKey",
        ]
    ) {
        assert(keys.has(k), `form does not produce ${k}`);
    }
});
