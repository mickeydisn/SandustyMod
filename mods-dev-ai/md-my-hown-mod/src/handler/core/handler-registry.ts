

import { actionFacts, type HandlerActionClass } from "./action-facts.ts";



import type { Opt } from "../../catalog.ts";

import { actionRefsOf, flattenRefs, isBlock, setOptionKeysLookup } from "./process.ts";
import { slotsFor } from "./scope.ts";
import { BLOCK_KEY } from "./types.ts";



import { projectileOptionOf } from "../projectile-option/index.ts";
import { excavationOptionOf } from "../excavation-option/index.ts";

export type HandlerType =
    | "global"
    | "cell"
    | "message"
    | "tech"
    | "processor"
    | "modifier"
    
    | "block";


export type HandlerSlot =
    | "signal"
    | "trigger"
    | "processing"
    | "upgrade"
    | "modifier"
    | "itemAction";


export type HandlerScope = "global" | "structure" | "cell" | "tech" | "item";

export interface HandlerParam {
    key: string;
    label: string;
    kind: "text" | "number" | "bool" | "select";
    required?: boolean;
    def?: string;
    hint?: string;
    min?: number;
    max?: number;
    int?: boolean;
    
    options?: Opt[];
    
    content?: ContentKind;
}

export interface HandlerMeta {
    key: string;
    
    type: HandlerType;
    
    api?: string;
    
    cls: HandlerActionClass;
    
    slots: HandlerSlot[];
    
    declaredSlots?: HandlerSlot[];
    
    scope: HandlerScope;
    
    itemTypes?: string[];
    
    params: HandlerParam[];
}

export const HANDLER_TYPE_LABELS: Record<HandlerType, string> = {
    global: "Global",
    cell: "Cell",
    message: "Message",
    tech: "Tech",
    processor: "Processor",
    modifier: "Modifier",
    block: "Block",
};

export const HANDLER_TYPE_BLURBS: Record<HandlerType, string> = {
    global: "Engine-agnostic utilities — safe anywhere.",
    cell: "Read or write the cell grid (digging, energy, scanning).",
    message: "React to an engine event: a click, a tick, an item use.",
    tech: "Run when research completes or an item is upgraded.",
    processor: "One step of a structure's process() run.",
    modifier: "Intercept or rewrite an engine hook.",
    block: "Decide which steps run. Holds two branches, not a call.",
};

export const HANDLER_SCOPE_LABELS: Record<HandlerScope, string> = {
    global: "Global",
    structure: "Structure",
    cell: "Cell",
    tech: "Tech node",
    item: "Item",
};



const p = (
    key: string,
    label: string,
    kind: HandlerParam["kind"] = "text",
    extra: Partial<HandlerParam> = {},
): HandlerParam => ({ key, label, kind, ...extra });

const ALL_SLOTS = [
    "signal",
    "trigger",
    "processing",
    "upgrade",
    "modifier",
    "itemAction",
] as const satisfies readonly HandlerSlot[];







const REGION_PARAMS: HandlerParam[] = [
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


const MATRIX_PARAMS: HandlerParam[] = [
    p("mx", "Matrix X", "number", {
        int: true,
        hint: "one cell of my shape matrix, by column. Cannot be combined with a " +
            "region field.",
    }),
    p("my", "Matrix Y", "number", { int: true, hint: "one cell of my shape matrix, by row." }),
];


const RANGE_PARAMS: HandlerParam[] = REGION_PARAMS;


const MOTION_REGION_PARAMS: HandlerParam[] = REGION_PARAMS;


const VELOCITY_PARAMS: HandlerParam[] = [
    p("vx", "Velocity X", "number", { def: "0" }),
    p("vy", "Velocity Y", "number", { def: "0", hint: "negative is up" }),
];


const MOTION_ENTRIES: Omit<HandlerMeta, "cls">[] = [
    {
        key: "getVelocity",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
            ...MOTION_REGION_PARAMS,
        ],
    },
    {
        key: "findFreeCell",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        
        
        
        
        
        params: [
            p("size", "Search size", "number", {
                def: "0",
                min: 1,
                hint: "cells to search from me. 0 = my own footprint size.",
            }),
        ],
    },
    {
        key: "setVelocity",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [...VELOCITY_PARAMS, ...MOTION_REGION_PARAMS],
    },
    {
        key: "addVelocity",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
            ...VELOCITY_PARAMS,
            p("maxSpeed", "Max speed", "number", {
                def: "0",
                min: 0,
                hint: "cells/second. 0 = no clamp.",
            }),
            ...MOTION_REGION_PARAMS,
        ],
    },
    {
        key: "setDuration",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
            p("ticks", "Ticks", "number", { def: "60", min: 0, int: true }),
            p("rearm", "Rearm", "bool", {
                def: "false",
                hint: "also raise the maximum, so it fires again next cycle",
            }),
            ...MOTION_REGION_PARAMS,
        ],
    },
    {
        key: "teleportElement",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
            p("tx", "Move X", "number", { def: "0", int: true }),
            p("ty", "Move Y", "number", { def: "1", int: true, hint: "1 = one cell down" }),
            ...MOTION_REGION_PARAMS,
        ],
    },
    {
        key: "toParticle",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [...VELOCITY_PARAMS, ...MOTION_REGION_PARAMS],
    },
];



const CREATE_PARAMS: HandlerParam[] = [
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


export type ContentKind = "element" | "structure" | "terrain";


const elementRef = (hint: string): HandlerParam =>
    p("element", "Element", "select", { required: true, content: "element", hint });

const structureRef = (hint: string): HandlerParam =>
    p("structure", "Structure", "select", { required: true, content: "structure", hint });

const terrainRef = (hint: string): HandlerParam =>
    p("terrain", "Terrain", "select", { required: true, content: "terrain", hint });

const ELEMENT_ENTRIES: Omit<HandlerMeta, "cls">[] = [
    {
        key: "readElement",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        
        
        
        
        
        
        
        params: [...REGION_PARAMS, ...MATRIX_PARAMS],
    },
    {
        key: "countElements",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
            elementRef("the element to count"),
            ...REGION_PARAMS,
        ],
    },
    {
        
        
        key: "countEmpty",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [...REGION_PARAMS],
    },
    {
        key: "replaceElement",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
            elementRef("the element to write"),
            ...CREATE_PARAMS,
            ...REGION_PARAMS,
        ],
    },
    {
        
        
        
        key: "removeElement",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
            elementRef("only cells holding this are emptied"),
            ...REGION_PARAMS,
        ],
    },
    {
        key: "createElement",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
            elementRef("the element to place"),
            ...CREATE_PARAMS,
            ...REGION_PARAMS,
        ],
    },
    {
        key: "emptyCells",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [...REGION_PARAMS],
    },
    {
        
        
        
        key: "transformElement",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
            p("from", "From element", "text", {
                hint: "only cells holding this are changed. Leave blank for any.",
            }),
            p("to", "To element", "text", { required: true, hint: "what they become" }),
            
            
            
            
            
            ...CREATE_PARAMS,
            ...REGION_PARAMS,
        ],
    },
];


const STRUCTURE_REF_PARAMS: HandlerParam[] = [
    structureRef("the structure, or a handle from Structure type"),
];

const DATA_PARAMS: HandlerParam[] = [
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

const REMOVAL_PARAMS: HandlerParam[] = [
    p("removeCells", "Remove cells too", "bool", {
        def: "false",
        hint: "also remove the terrain under it",
    }),
    p("skipVisuals", "Skip visuals", "bool", { def: "false", hint: "no teardown effect" }),
];

const STRUCTURE_ENTRIES: Omit<HandlerMeta, "cls">[] = [
    {
        key: "structureType",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [...REGION_PARAMS],
    },
    {
        key: "hasStructure",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [...REGION_PARAMS],
    },
    {
        key: "isStructureType",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [...STRUCTURE_REF_PARAMS, ...REGION_PARAMS],
    },
    {
        key: "isMyType",
        type: "cell",
        slots: ["processing"],
        scope: "structure",
        
        
        params: [...STRUCTURE_REF_PARAMS],
    },
    {
        key: "isBlockedByPlayer",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [...REGION_PARAMS],
    },
    {
        key: "isLauncher",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [...REGION_PARAMS],
    },
    {
        key: "isStructureEnabled",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [...REGION_PARAMS],
    },
    {
        key: "countStructures",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [...REGION_PARAMS],
    },
    {
        key: "structureData",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
            p("key", "Key", "text", { required: true, hint: "the data-bag key" }),
            ...REGION_PARAMS,
        ],
    },
    {
        key: "mapSpritesheetValue",
        type: "cell",
        slots: ["processing"],
        scope: "global",
        params: [
            p("value2", "Value", "number", { def: "0", hint: "the value to map" }),
            p("thresholds", "Thresholds", "text", {
                def: "",
                hint: "comma-separated, ascending. e.g. 25,50,75",
            }),
        ],
    },
    {
        key: "buildStructure",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [...STRUCTURE_REF_PARAMS, ...REGION_PARAMS],
    },
    {
        key: "removeStructure",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [...REMOVAL_PARAMS, ...REGION_PARAMS],
    },
    {
        key: "removeStructures",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
            ...REMOVAL_PARAMS,
            p("preserveUnselectable", "Only unselectable", "bool", {
                def: "false",
                hint: "skip structures a player can currently select",
            }),
            ...REGION_PARAMS,
        ],
    },
    {
        key: "setStructureEnabled",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
            p("enabled", "Enabled", "bool", { def: "true", hint: "the state to switch to" }),
            ...REGION_PARAMS,
        ],
    },
    {
        key: "setSpritesheetIndex",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
            p("index", "Frame", "number", {
                def: "0",
                int: true,
                min: 0,
                hint: "the frame to show",
            }),
            ...REGION_PARAMS,
        ],
    },
    {
        key: "setSpritesheetByValue",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
            p("value2", "Value", "number", { def: "0", hint: "the value to map" }),
            p("thresholds", "Thresholds", "text", {
                def: "",
                hint: "comma-separated, ascending. e.g. 25,50,75",
            }),
            ...REGION_PARAMS,
        ],
    },
    {
        key: "setStructureData",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [...DATA_PARAMS, ...REGION_PARAMS],
    },
    {
        key: "pushStructure",
        type: "cell",
        slots: ["processing"],
        scope: "structure",
        params: [
            p("propagateToWorkers", "Send to workers", "bool", {
                def: "false",
                hint: "instance data lives on Main; set this if a worker must see it now",
            }),
        ],
    },
];


const TERRAIN_REF_PARAMS: HandlerParam[] = [
    terrainRef("the terrain, or a handle from Terrain type"),
];

const TERRAIN_SHAPE_PARAMS: HandlerParam[] = [
    ...TERRAIN_REF_PARAMS,
    p("skipShadow", "Skip shadow", "bool", {
        def: "false",
        hint: "no shadow update around the changed cell",
    }),
];

const TERRAIN_ENTRIES: Omit<HandlerMeta, "cls">[] = [
    {
        key: "terrainType",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [...REGION_PARAMS],
    },
    {
        key: "hasTerrain",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [...REGION_PARAMS],
    },
    {
        key: "isTerrainType",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [...TERRAIN_REF_PARAMS, ...REGION_PARAMS],
    },
    {
        key: "terrainHitPoints",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [...REGION_PARAMS],
    },
    {
        key: "terrainTypeHandle",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [...REGION_PARAMS],
    },
    {
        key: "countTerrain",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [...REGION_PARAMS],
    },
    {
        key: "createTerrain",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [...TERRAIN_SHAPE_PARAMS, ...REGION_PARAMS],
    },
    {
        key: "replaceTerrain",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [...TERRAIN_SHAPE_PARAMS, ...REGION_PARAMS],
    },
    {
        key: "removeTerrain",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
            p("skipShadow", "Skip shadow", "bool", {
                def: "false",
                hint: "no shadow update around the changed cell",
            }),
            ...REGION_PARAMS,
        ],
    },
    {
        key: "damageTerrain",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
            p("damage", "Damage", "number", { def: "1", min: 1, hint: "hit points to remove" }),
            ...REGION_PARAMS,
        ],
    },
    {
        key: "setTerrainHitPoints",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
            p("hitPoints", "Hit points", "number", {
                def: "0",
                int: true,
                min: 0,
                hint: "the health to set. 0 destroys the terrain.",
            }),
            ...REGION_PARAMS,
        ],
    },
];


const LOGIC_ENTRIES: Omit<HandlerMeta, "cls">[] = [
    {
        key: "logicAny",
        type: "cell",
        slots: ["signal", "processing", "itemAction", "modifier"],
        scope: "cell",
        params: [elementRef("the element to look for in the range"), ...RANGE_PARAMS],
    },
    {
        key: "logicAll",
        type: "cell",
        slots: ["signal", "processing", "itemAction", "modifier"],
        scope: "cell",
        params: [elementRef("every cell in the range must hold this"), ...RANGE_PARAMS],
    },
    {
        key: "logicCount",
        type: "cell",
        slots: ["signal", "processing", "itemAction", "modifier"],
        scope: "cell",
        params: [elementRef("the element to count"), ...RANGE_PARAMS],
    },
    {
        
        
        
        key: "logicSum",
        type: "cell",
        slots: ["signal", "processing", "itemAction", "modifier"],
        scope: "cell",
        params: [...RANGE_PARAMS],
    },
    {
        key: "logicForEach",
        type: "cell",
        
        
        
        
        
        
        
        
        slots: ["processing"],
        scope: "cell",
        params: [
            p("to", "Write element", "select", {
                required: true,
                content: "element",
                hint: "written at every cell in the range",
            }),
            p("when", "…but only cells holding", "select", {
                content: "element",
                hint: "leave blank to write every cell, whatever is there",
            }),
            
            
            ...RANGE_PARAMS,
        ],
    },
];

const DECLARED_META: Omit<HandlerMeta, "cls">[] = [
    
    { key: "noop", type: "global", slots: [...ALL_SLOTS], scope: "global", params: [] },
    {
        key: "itemDefault",
        type: "global",
        slots: ["itemAction"],
        scope: "item",
        itemTypes: ["Mod"],
        params: [p("power", "Power", "number", { def: "5", min: 0 })],
    },
    { key: "processorNoop", type: "global", slots: ["processing"], scope: "structure", params: [] },

    {
        key: "energyDefault",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [p("capacity", "Capacity", "number", { def: "1000", min: 0, int: true })],
    },
    {
        key: "energyBank",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [p("capacity", "Capacity", "number", { def: "100000", min: 0, int: true })],
    },
    {
        key: "energyWire",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [p("capacity", "Capacity", "number", { def: "200", min: 0, int: true })],
    },
    {
        key: "energyConductor",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [p("capacity", "Capacity", "number", { def: "0", min: 0, int: true })],
    },
    {
        key: "energyNetwork",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
            p("energyType", "Energy type", "text", {
                required: true,
                hint: "network name to join",
            }),
        ],
    },
    
    
    
    
    
    
    
    
    
    
    {
        key: "triggerScan",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [p("radius", "Radius", "number", { def: "3", min: 0, int: true })],
    },
    
    {
        
        
        
        
        key: "randomInt",
        type: "processor",
        slots: [...ALL_SLOTS],
        scope: "global",
        params: [
            p("min", "Lowest", "number", {
                required: true,
                def: "0",
                int: true,
                hint: "inclusive",
            }),
            p("max", "Highest", "number", {
                required: true,
                def: "0",
                int: true,
                hint: "inclusive. A max below min answers the min.",
            }),
        ],
    },
    {
        
        
        
        
        
        
        
        
        
        
        
        key: "compare",
        type: "processor",
        slots: [...ALL_SLOTS],
        scope: "global",
        params: [
            p("left", "Left", "text", {
                required: true,
                hint: "a number, or {{aVariable}} from an earlier step",
            }),
            p("op", "Test", "select", {
                required: true,
                def: "gte",
                options: [
                    { value: "eq", label: "is" },
                    { value: "ne", label: "is not" },
                    { value: "gt", label: "is more than" },
                    { value: "gte", label: "is at least" },
                    { value: "lt", label: "is less than" },
                    { value: "lte", label: "is at most" },
                ],
            }),
            p("right", "Right", "number", { required: true, def: "0" }),
        ],
    },
    {
        
        
        
        
        
        
        
        key: "math",
        type: "processor",
        slots: [...ALL_SLOTS],
        scope: "global",
        params: [
            p("left", "Left", "text", {
                required: true,
                hint: "a number, or {{aVariable}} from an earlier step",
            }),
            p("op", "Operation", "select", {
                required: true,
                def: "add",
                options: [
                    { value: "add", label: "plus" },
                    { value: "sub", label: "minus" },
                    { value: "mul", label: "times" },
                    { value: "div", label: "divided by" },
                ],
            }),
            p("right", "Right", "number", { required: true, def: "1" }),
        ],
    },
    { key: "signalLog", type: "message", slots: ["signal"], scope: "structure", params: [] },
    {
        
        
        
        key: "signalOutput",
        type: "message",
        slots: ["signal", "processing"],
        scope: "structure",
        params: [p("value", "Output", "bool", { def: "false" })],
    },
    { key: "structureInspect", type: "message", slots: ["signal"], scope: "structure", params: [] },
    {
        
        
        
        
        key: "isElementAtCell",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
            elementRef("the element to test for"),
            p("dx", "Offset X", "number", { def: "0", int: true }),
            p("dy", "Offset Y", "number", { def: "0", int: true }),
        ],
    },
    {
        key: "structureReadData",
        type: "message",
        slots: ["signal"],
        scope: "structure",
        params: [
            p("field", "Data field", "text", {
                required: true,
                hint: "key on the structure's data object",
            }),
        ],
    },
    {
        key: "structureWriteData",
        type: "message",
        slots: ["signal"],
        scope: "structure",
        params: [
            p("field", "Data field", "text", { required: true }),
            p("value", "Value", "text", { required: true }),
        ],
    },
    
    
    
    
    
    
    
    
    {
        
        
        
        
        
        key: "readDataField",
        type: "message",
        slots: [...ALL_SLOTS],
        scope: "cell",
        params: [
            p("slot", "Data slot", "select", {
                required: true,
                def: "1",
                options: [1, 2, 3, 4].map((n) => ({ value: String(n), label: `Field ${n}` })),
                hint:
                    "1–4, from the element's Data fields list. The engine stores only these four.",
            }),
        ],
    },
    {
        key: "writeDataField",
        type: "message",
        slots: [...ALL_SLOTS],
        scope: "cell",
        params: [
            p("slot", "Data slot", "select", {
                required: true,
                def: "1",
                options: [1, 2, 3, 4].map((n) => ({ value: String(n), label: `Field ${n}` })),
                hint: "1–4, from the element's Data fields list",
            }),
            p("slotValue", "Value", "text", {
                required: true,
                hint: "a number, or {{aVariable}} from an earlier step. Rounded to a whole number.",
            }),
        ],
    },
    {
        key: "bufferRead",
        type: "message",
        slots: [...ALL_SLOTS],
        scope: "global",
        params: [
            p("path", "Buffer path", "text", {
                required: true,
                hint: "a path declared in Content → Buffer",
            }),
        ],
    },
    {
        key: "bufferWrite",
        type: "message",
        slots: [...ALL_SLOTS],
        scope: "global",
        params: [
            p("path", "Buffer path", "text", {
                required: true,
                hint: "a path declared in Content → Buffer",
            }),
            
            
            
            
            p("value", "Value", "text", {
                hint: "a literal, or {{aVariable}} from an earlier step",
            }),
        ],
    },
    {
        key: "bufferIncrement",
        type: "message",
        slots: [...ALL_SLOTS],
        scope: "global",
        params: [
            p("path", "Buffer path", "text", {
                required: true,
                hint:
                    "a **number** path from Content → Buffer — a bool or string slot is not a counter",
            }),
            
            
            
            
            p("delta", "Amount", "number", { required: true, def: "1", int: true }),
        ],
    },
    
    
    
    
    
    
    { key: "triggerLog", type: "message", slots: ["trigger"], scope: "global", params: [] },
    
    
    
    
    
    { key: "triggerTick", type: "message", slots: ["signal"], scope: "structure", params: [] },
    
    
    
    {
        key: "toast",
        type: "message",
        slots: ["signal", "trigger", "processing", "itemAction", "upgrade", "modifier"],
        scope: "global",
        params: [p("text", "Text", "text", { def: "Hello", required: true })],
    },
    {
        key: "particles",
        type: "message",
        slots: ["signal", "processing", "modifier"],
        scope: "cell",
        params: [
            p("name", "Effect", "text", { required: true, hint: "effect name" }),
            p("count", "Count", "number", { def: "1", min: 0, max: 999 }),
        ],
    },
    {
        key: "itemExcavate",
        type: "message",
        
        
        
        
        
        
        
        
        
        slots: ["signal", "processing", "modifier", "itemAction"],
        scope: "cell",
        itemTypes: ["Tool"],
        params: [
            p("profileId", "Excavation profile", "text", {
                hint: "falls back to the item's excavationProfileId",
            }),
            p("power", "Power", "number", { def: "10", min: 0 }),
        ],
    },
    {
        key: "itemShoot",
        type: "message",
        
        
        slots: ["signal", "processing", "modifier", "itemAction"],
        scope: "global",
        itemTypes: ["Weapon"],
        params: [
            p("projectileId", "Projectile", "text", {
                hint: "falls back to the item's projectileId",
            }),
            p("power", "Power", "number", { def: "5", min: 0 }),
            p("speed", "Speed", "number", { def: "20", min: 0 }),
        ],
    },

    
    {
        key: "processorLog",
        type: "processor",
        slots: ["processing"],
        scope: "structure",
        params: [],
    },
    {
        key: "processorLift",
        type: "processor",
        slots: ["processing"],
        scope: "cell",
        params: [
            p("x", "Cell x", "number", { min: 0, int: true }),
            p("y", "Cell y", "number", { min: 0, int: true }),
        ],
    },
    {
        key: "processorConvert",
        type: "processor",
        slots: ["processing"],
        scope: "cell",
        params: [
            p("to", "Output element", "text", {
                required: true,
                hint: "element id committed into the cell",
            }),
            p("chance", "Chance", "number", { def: "1", min: 0, max: 1 }),
        ],
    },
    {
        key: "processorCount",
        type: "processor",
        slots: ["processing"],
        scope: "structure",
        params: [],
    },
    
    
    
    
    
    {
        key: "energyGenerateWhileHeld",
        type: "processor",
        slots: ["processing"],
        scope: "cell",
        params: [
            p("energyType", "Energy type", "text", { required: true }),
            p("amountPerRun", "Amount per run", "number", { def: "1", min: 0 }),
        ],
    },
    
    
    
    {
        key: "energyConsumePerRun",
        type: "processor",
        
        
        
        
        slots: ["processing", "signal", "modifier"],
        scope: "cell",
        params: [
            p("energyType", "Energy type", "text", { required: true }),
            p("amountPerRun", "Amount per run", "number", { def: "1", min: 0 }),
        ],
    },
    
    
    
    
    
    
    
    
    

    
    {
        key: "techAppendUnlock",
        type: "tech",
        slots: ["upgrade"],
        scope: "tech",
        params: [p("techId", "Tech node", "text", { required: true })],
    },
    {
        key: "techSetUpgradeLevel",
        type: "tech",
        slots: ["upgrade"],
        scope: "item",
        params: [
            p("itemId", "Item", "text", { required: true }),
            p("level", "Level", "number", { def: "1", min: 0, int: true }),
        ],
    },
    {
        key: "techGrantItem",
        type: "tech",
        slots: ["upgrade"],
        scope: "item",
        params: [
            p("itemId", "Item", "text", { required: true }),
            p("count", "Count", "number", { def: "1", min: 0, int: true }),
        ],
    },
    {
        key: "upgradeCountLevel",
        type: "tech",
        slots: ["upgrade"],
        scope: "item",
        params: [p("field", "Data field", "text", { def: "mdLevel" })],
    },
    { key: "upgradeLog", type: "tech", slots: ["upgrade"], scope: "item", params: [] },
    {
        key: "upgradeScale",
        type: "tech",
        slots: ["upgrade"],
        scope: "item",
        params: [
            p("field", "Numeric field", "text", { required: true }),
            p("factor", "Factor", "number", { def: "1.1", min: 0 }),
        ],
    },
    {
        key: "upgradeAdd",
        type: "tech",
        slots: ["upgrade"],
        scope: "item",
        params: [
            p("field", "Numeric field", "text", { required: true }),
            p("amount", "Amount", "number", { def: "1" }),
        ],
    },

    
    { key: "logArgs", type: "modifier", slots: ["modifier"], scope: "global", params: [] },
    { key: "identity", type: "modifier", slots: ["modifier"], scope: "global", params: [] },
    {
        key: "logBuildingPayload",
        type: "modifier",
        slots: ["modifier"],
        scope: "global",
        params: [],
    },
    
    ...ELEMENT_ENTRIES,
    
    
    
    
    
    
    ...MOTION_ENTRIES,
    
    
    
    
    
    
    ...STRUCTURE_ENTRIES,
    
    
    
    
    
    ...TERRAIN_ENTRIES,
    
    
    
    
    ...LOGIC_ENTRIES,
];


const TYPE_SLOTS: Partial<Record<HandlerType, HandlerSlot[]>> = {
    tech: ["upgrade"],
};


export function slotsForEntry(
    m: { key: string; type: HandlerType },
): HandlerSlot[] {
    const needed = slotsFor(m.key) as HandlerSlot[];
    const narrowed = TYPE_SLOTS[m.type];
    if (!narrowed) return needed;
    return needed.filter((s) => narrowed.includes(s));
}


export const HANDLER_META: HandlerMeta[] = DECLARED_META.map((m) => {
    const derived = slotsForEntry(m);
    const facts = actionFacts(m.key);
    return {
        ...m,
        // `api` is absent for engine-free actions; the record states that as "",
        // so translate rather than leaking an empty string into the panel.
        api: facts?.api || undefined,
        cls: facts?.cls ?? "pure",
        slots: derived.length ? derived : m.slots,
        declaredSlots: m.slots,
    };
});


export const BLOCK_META: HandlerMeta = {
    key: BLOCK_KEY,
    type: "block",
    cls: "pure",
    
    
    
    
    slots: ["signal", "trigger", "processing", "itemAction", "upgrade", "modifier"],
    scope: "cell",
    params: [
        {
            key: "var",
            label: "When variable is true",
            kind: "text",
            required: true,
            hint:
                "The name a step bound with As. Both branches are compiled; the one that runs is chosen at run time.",
        },
    ],
};

const META_BY_KEY: Record<string, HandlerMeta> = Object.fromEntries(
    HANDLER_META.map((m) => [m.key, m]),
);

export function handlerMeta(key: string | undefined): HandlerMeta | undefined {
    return key ? META_BY_KEY[key] : undefined;
}




setOptionKeysLookup((key) => {
    const meta = handlerMeta(key);
    if (!meta) return undefined;
    const names = new Set<string>();
    for (const p of meta.params ?? []) names.add(p.key);
    
    
    names.add("key");
    names.add("as");
    return names;
});

export function handlersForSlot(slot: HandlerSlot): HandlerMeta[] {
    return HANDLER_META.filter((m) => m.slots.includes(slot));
}


export function isOnlyAtSlot(meta: HandlerMeta, slot: HandlerSlot): boolean {
    return meta.slots.length === 1 && meta.slots[0] === slot;
}


export function handlersOnlyAtSlot(slot: HandlerSlot): HandlerMeta[] {
    return HANDLER_META.filter((m) => isOnlyAtSlot(m, slot));
}

export function handlersOfType(type: HandlerType): HandlerMeta[] {
    return HANDLER_META.filter((m) => m.type === type);
}

export function allHandlerTypes(): HandlerType[] {
    const seen: HandlerType[] = [];
    for (const m of HANDLER_META) if (!seen.includes(m.type)) seen.push(m.type);
    return seen;
}

export function isHandlerKey(key: string | undefined): boolean {
    return !!key && key in META_BY_KEY;
}


export function itemActionHandlersFor(itemType: string | undefined): HandlerMeta[] {
    const t = itemType ?? "";
    
    
    
    if (t.toLowerCase() === "consumable") return [];
    return handlersForSlot("itemAction").filter((m) => !m.itemTypes || m.itemTypes.includes(t));
}

export const HANDLER_SLOT_LABELS: Record<HandlerSlot, string> = {
    signal: "Signals (structure click)",
    trigger: "Triggers (timed)",
    processing: "Processing (process step)",
    upgrade: "Upgrades / research",
    modifier: "Hook modifiers",
    itemAction: "Items (handleAction)",
};

export const HANDLER_SCOPES = Object.keys(HANDLER_SCOPE_LABELS) as HandlerScope[];




export function validateHandlerParams(
    meta: HandlerMeta,
    values: Record<string, string>,
): string[] {
    const errs: string[] = [];
    for (const spec of meta.params) {
        const raw = (values[spec.key] ?? "").trim();
        if (spec.required && raw === "") {
            errs.push(`${spec.label} is required`);
            continue;
        }
        if (raw === "") continue;
        if (spec.kind === "number") {
            const n = Number(raw);
            if (!Number.isFinite(n)) {
                errs.push(`${spec.label} must be a number`);
                continue;
            }
            if (spec.int && !Number.isInteger(n)) errs.push(`${spec.label} must be a whole number`);
            if (spec.min !== undefined && n < spec.min) {
                errs.push(`${spec.label} must be ≥ ${spec.min}`);
            }
            if (spec.max !== undefined && n > spec.max) {
                errs.push(`${spec.label} must be ≤ ${spec.max}`);
            }
        }
        if (spec.kind === "select") {
            if (spec.content) {
                
                
                
                
                
                
                
                
                
                
            } else if (spec.options) {
                if (!spec.options.some((o) => o.value === raw)) {
                    errs.push(
                        `${spec.label} must be one of: ${
                            spec.options.map((o) => o.value).join(", ")
                        }`,
                    );
                }
            }
        }
    }
    return errs;
}



export function handlerTypesForKeys(keys: string[]): HandlerType[] {
    const byKey = new Map(HANDLER_META.map((m) => [m.key, m.type]));
    const seen = new Set<HandlerType>();
    for (const k of keys) {
        const t = byKey.get(k);
        if (t) seen.add(t);
    }
    return [...seen];
}

export function buildHandlerOptions(
    meta: HandlerMeta,
    values: Record<string, string>,
): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const spec of meta.params) {
        const raw = (values[spec.key] ?? "").trim();
        if (raw === "") continue;
        if (spec.kind === "number") {
            const n = Number(raw);
            if (Number.isFinite(n)) out[spec.key] = spec.int ? Math.trunc(n) : n;
        } else if (spec.kind === "bool") {
            out[spec.key] = raw === "true";
        } else {
            out[spec.key] = raw;
        }
    }
    return out;
}




export const TAB_TO_CALL_SITE: Record<string, HandlerSlot> = {
    signals: "signal",
    triggers: "trigger",
    processing: "processing",
    items: "itemAction",
    upgrades: "upgrade",
    modifiers: "modifier",
    
    
    
    
};


const SLOT_LOCATION: Record<HandlerSlot, string> = {
    signal: "signals",
    trigger: "triggers",
    processing: "processing",
    upgrade: "upgrades",
    modifier: "modifiers",
    itemAction: "items",
};


const SLOTS_BY_CATEGORY: Record<string, HandlerSlot> = Object.fromEntries(
    Object.entries(SLOT_LOCATION).map(([slot, key]) => [key, slot as HandlerSlot]),
) as Record<string, HandlerSlot>;

export { SLOTS_BY_CATEGORY };


export interface HandlerUsage {
    category: string;
    id: string;
    slot: HandlerSlot;
    
    key?: string;
}


export function scanHandlerUsage(cfg: Record<string, unknown>): HandlerUsage[] {
    const out: HandlerUsage[] = [];
    for (const [slot, cfgKey] of Object.entries(SLOT_LOCATION) as [HandlerSlot, string][]) {
        const list = cfg[cfgKey];
        if (!Array.isArray(list)) continue;
        for (const e of list as Record<string, unknown>[]) {
            
            
            
            
            
            
            const refs = flattenRefs(actionRefsOf(e as Record<string, unknown>));
            for (const key of refs.map((r) => r.key)) {
                
                
                if (isBlock({ key })) continue;
                out.push({ category: cfgKey, id: String(e.id ?? "?"), slot, key });
            }
        }
    }
    return out;
}


export function scanProjectileOptionUsage(
    cfg: Record<string, unknown>,
): { category: string; id: string; key?: string; problem?: string }[] {
    const list = cfg.projectiles;
    if (!Array.isArray(list)) return [];
    return (list as Record<string, unknown>[]).map((e) => {
        const { ref, problem } = projectileOptionOf(e);
        return {
            category: "projectiles",
            id: String(e?.id ?? "?"),
            key: ref?.key,
            problem,
        };
    });
}


export function scanExcavationOptionUsage(
    cfg: Record<string, unknown>,
): { category: string; id: string; key?: string; problem?: string }[] {
    const list = cfg.excavationProfiles;
    if (!Array.isArray(list)) return [];
    return (list as Record<string, unknown>[]).map((e) => {
        const { ref, problem } = excavationOptionOf(e);
        return {
            category: "excavationProfiles",
            id: String(e?.id ?? "?"),
            key: ref?.key,
            problem,
        };
    });
}

function findKeyForUsage(cfg: Record<string, unknown>, u: HandlerUsage): string {
    const cfgKey = SLOT_LOCATION[u.slot];
    const list = (cfg[cfgKey] ?? []) as Record<string, unknown>[];
    const e = list.find((x) => String(x?.id) === u.id);
    if (!e) return "";
    
    
    
    return u.key ?? actionRefsOf(e)[0]?.key ?? "";
}


export function unreachableHandlers(
    cfg: Record<string, unknown>,
): { key: string; usage: HandlerUsage; reason: string }[] {
    const bad: { key: string; usage: HandlerUsage; reason: string }[] = [];
    for (const u of scanHandlerUsage(cfg)) {
        const meta = handlerMeta(findKeyForUsage(cfg, u));
        if (!meta) continue;
        if (!meta.slots.includes(u.slot)) {
            bad.push({
                key: meta.key,
                usage: u,
                reason: `a ${meta.type} handler cannot serve the ${u.slot} slot`,
            });
        }
    }
    return bad;
}


export function usageIndex(cfg: Record<string, unknown>): Record<string, HandlerUsage[]> {
    const idx: Record<string, HandlerUsage[]> = {};
    for (const u of scanHandlerUsage(cfg)) {
        const key = findKeyForUsage(cfg, u);
        if (!key) continue;
        (idx[key] ??= []).push(u);
    }
    return idx;
}
