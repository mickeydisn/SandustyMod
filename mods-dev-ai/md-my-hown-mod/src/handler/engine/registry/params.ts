import type { ContentKind, HandlerParam } from "../types.ts";



export const p = (
    key: string,
    label: string,
    kind: HandlerParam["kind"] = "text",
    extra: Partial<HandlerParam> = {},
): HandlerParam => ({ key, label, kind, ...extra });

export const elementRef = (hint: string): HandlerParam =>
    p("element", "Element", "select", { required: true, content: "element", hint });

export const structureRef = (hint: string): HandlerParam =>
    p("structure", "Structure", "select", { required: true, content: "structure", hint });

export const terrainRef = (hint: string): HandlerParam =>
    p("terrain", "Terrain", "select", { required: true, content: "terrain", hint });

export const REGION_PARAMS: HandlerParam[] = [
    p("dx", "Offset X", "number", { def: "0", int: true, hint: "from my own cell" }),
    p("dy", "Offset Y", "number", { def: "0", int: true }),
    p(
        "size",
        "Region size",
        "number",
        {
            def: "1",
            int: true,
            min: 0,
            max: 64,
            hint: "1 = just the offset cell. 3 = the 3×3 around it. 0 means the " +
                "same as 1.",
        },
    ),
    p("footprint", "My whole footprint", "bool", {
        def: "false",
        hint: "work over every occupied cell of my shape matrix, ignoring the " +
            "offsets above",
    }),
];

export const MATRIX_PARAMS: HandlerParam[] = [
    p("mx", "Matrix X", "number", {
        int: true,
        hint: "one cell of my shape matrix, by column. Cannot be combined with a " +
            "region field.",
    }),
    p("my", "Matrix Y", "number", { int: true, hint: "one cell of my shape matrix, by row." }),
];

export const RANGE_PARAMS: HandlerParam[] = REGION_PARAMS;

export const MOTION_REGION_PARAMS: HandlerParam[] = REGION_PARAMS;

export const VELOCITY_PARAMS: HandlerParam[] = [
    p("vx", "Velocity X", "number", { def: "0" }),
    p("vy", "Velocity Y", "number", { def: "0", hint: "negative is up" }),
];

export const CREATE_PARAMS: HandlerParam[] = [
    p("durationTicks", "Lifetime", "number", {
        def: "0",
        min: 0,
        int: true,
        hint: "ticks before it expires. 0 = permanent.",
    }),
    p("density", "Density", "number", {
        def: "0",
        min: 0,
        hint: "overrides the element's density. 0 = its own.",
    }),
    p("freeFalling", "Free-falling", "bool", {
        def: "false",
        hint: "spawn already falling rather than resting",
    }),
    p("vx", "Velocity X", "number", { def: "0", hint: "spawn as a particle, already moving" }),
    p("vy", "Velocity Y", "number", { def: "0", hint: "negative is up" }),
];

export const STRUCTURE_REF_PARAMS: HandlerParam[] = [
    structureRef("the structure, or a handle from Structure type"),
];

export const DATA_PARAMS: HandlerParam[] = [
    p("key", "Key", "text", { required: true, hint: "the data-bag key" }),
    p("value", "Value", "text", { hint: "written as text" }),
    p("numberValue", "Number value", "number", {
        def: "",
        hint: "written as a number. Leave blank to use Value.",
    }),
    p("propagateToWorkers", "Send to workers", "bool", {
        def: "false",
        hint: "instance data lives on Main; set this if a worker must see it now",
    }),
];

export const REMOVAL_PARAMS: HandlerParam[] = [
    p("removeCells", "Remove cells too", "bool", {
        def: "false",
        hint: "also remove the terrain under it",
    }),
    p("skipVisuals", "Skip visuals", "bool", { def: "false", hint: "no teardown effect" }),
];

export const TERRAIN_REF_PARAMS: HandlerParam[] = [
    terrainRef("the terrain, or a handle from Terrain type"),
];

export const TERRAIN_SHAPE_PARAMS: HandlerParam[] = [
    ...TERRAIN_REF_PARAMS,
    p("skipShadow", "Skip shadow", "bool", {
        def: "false",
        hint: "no shadow update around the changed cell",
    }),
];
