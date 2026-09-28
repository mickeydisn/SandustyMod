/**
 * Typed handler registry.
 *
 * Every callable this mod exposes to JSON config gets ONE entry here saying
 * what kind of thing it is, which config slots may select it, how it is scoped
 * and which parameters it reads. The UI's handler tab, the per-slot pickers and
 * the validator all read this file, so a handler can never be offered in a slot
 * it cannot actually serve.
 *
 * This replaces the old hand-maintained key arrays (SIGNAL_HANDLERS,
 * TRIGGER_HANDLERS, PROJECTILE_HANDLERS, UPGRADE_HANDLERS) which silently
 * drifted out of sync with the real registries.
 */

import { ACTION_APIS, ACTION_CLASSES, type HandlerActionClass } from "./action-class.ts";
// `process.ts` imports only `handlers.ts`, so this is not a cycle.
import { actionRefsOf } from "./process.ts";
// The projectile options. A value import, not a type one: the usage scanner below
// reads stored entries through `projectileOptionOf`, and `projectile-option/` does
// not import this file, so there is still no cycle.
import { projectileOptionOf } from "../projectile-option/index.ts";
import { excavationOptionOf } from "../excavation-option/index.ts";
/** What a handler fundamentally does. Drives grouping in the handler tab. */
export type HandlerType =
    | "global"
    | "cell"
    | "message"
    | "tech"
    | "processor"
    | "modifier";

/**
 * A config slot that can select a handler.
 *
 * There is **no `projectile` slot**, and its absence is the point of the
 * projectile-option split. A projectile is not a process and runs no action: the
 * engine calls `getOptions()` with no arguments and reads the returned config. The
 * seven presets are `ProjectileOptionFn`s in `./projectile-option/`, chosen from a
 * different control. Adding the slot back would reintroduce exactly the confusion
 * this type exists to prevent.
 */
export type HandlerSlot =
    | "signal"
    | "trigger"
    | "processing"
    | "upgrade"
    | "modifier"
    | "itemAction";

/** How widely a handler applies. */
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
    /** `select` only. */
    options?: { value: string; label: string }[];
}

export interface HandlerMeta {
    key: string;
    /**
     * @deprecated Blends both axes and matches neither — `cell` spans three call
     * sites, `tech` is an API name on a call site. Kept only so the Handlers tab
     * keeps working until Phase 6 regroups on `api` and `cls`. See PLAN.md.
     */
    type: HandlerType;
    /**
     * The `api.*` namespace this action calls — **derived**, so it cannot drift
     * from what the code does. Undefined for the 38 actions that call no API.
     */
    api?: string;
    /**
     * What the action depends on — **derived** from the same probe. `api` is the
     * rule; the other three record how far short of it the action falls.
     */
    cls: HandlerActionClass;
    /** Slots allowed to select this handler. */
    slots: HandlerSlot[];
    /** Default scope; a handler may be rebound per use. */
    scope: HandlerScope;
    /**
     * `itemAction` slot only: which `ItemType`s may use this handler.
     *
     * `ItemType` is Weapon|Tool|Consumable|Mod, but the `ActionType` that
     * `handleAction` receives is Weapon|Building|Tool|Mod — there is no
     * Consumable, so no handler can ever serve one. Anything left undefined here
     * is offered for every type.
     */
    itemTypes?: string[];
    /** Parameters read from the entry's `options` bag. */
    params: HandlerParam[];
}

export const HANDLER_TYPE_LABELS: Record<HandlerType, string> = {
    global: "Global",
    cell: "Cell",
    message: "Message",
    tech: "Tech",
    processor: "Processor",
    modifier: "Modifier",
};

export const HANDLER_TYPE_BLURBS: Record<HandlerType, string> = {
    global: "Engine-agnostic utilities — safe anywhere.",
    cell: "Read or write the cell grid (digging, energy, scanning).",
    message: "React to an engine event: a click, a tick, an item use.",
    tech: "Run when research completes or an item is upgraded.",
    processor: "One step of a structure's process() run.",
    modifier: "Intercept or rewrite an engine hook.",
};

export const HANDLER_SCOPE_LABELS: Record<HandlerScope, string> = {
    global: "Global",
    structure: "Structure",
    cell: "Cell",
    tech: "Tech node",
    item: "Item",
};

// ── Convenience builders ─────────────────────────────────────────────────────

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

/** The registry. One row per callable reachable from JSON config. */
/**
 * The declared catalogue, with the two derived axes filled in.
 *
 * `api` and `cls` are computed from `ACTION_CLASSES` / `ACTION_APIS` rather than
 * written out per entry, because 46 hand-maintained copies of a measured fact is
 * 46 chances to be wrong — and the measurement already has a test that checks it
 * against behaviour.
 *
 * The raw list stays separate so the entries above read as a plain table; only
 * this export carries the derived fields, and it is the one everything imports.
 */

// The region options every element action shares. One array, spread into each
// entry, because an option that exists for `replaceElement` but not for
// `countElements` is either a mistake or an accident of copy-paste — and the
// panel would then show a field the action ignores, which is the worst outcome
// a form can have.
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
    p("mx", "Matrix X", "number", {
        int: true,
        hint: "one cell of the matrix, by column. Overrides the offsets.",
    }),
    p("my", "Matrix Y", "number", { int: true, hint: "one cell of the matrix, by row." }),
];

/**
 * The region options the motion family shares with the element family.
 *
 * The **same array**, not a copy: `regionFor` is one function, so a cell means the same
 * thing in both families, and the panel must not be able to drift from it either. A
 * second array that happened to be equal today would be a second thing to keep equal.
 */
const MOTION_REGION_PARAMS: HandlerParam[] = REGION_PARAMS;

/** Velocity, as the panel's two components. Not integers — velocity is not cells. */
const VELOCITY_PARAMS: HandlerParam[] = [
    p("vx", "Velocity X", "number", { def: "0" }),
    p("vy", "Velocity Y", "number", { def: "0", hint: "negative is up" }),
];

/**
 * The seven motion actions.
 *
 * Written out rather than generated, for the same reason the element entries are: two
 * of them need options no sibling has — `setDuration` wants ticks and a rearm flag,
 * `teleportElement` wants a destination rather than a region — and a generated list
 * would hide exactly that difference.
 *
 * The hints are the important part. `setVelocity` and `addVelocity` say **particles
 * only**, because that is the misreading this family invites: setting a velocity on a
 * falling grain of sand does nothing at all, and the author would have no way to tell
 * that from a typo in the coordinates.
 */
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
        // `size` is here twice on purpose and only one wins: the region resolver reads
        // it when no footprint is set, and `findFreeCell` reads it as the search square.
        // One name, one meaning per action, and the hint says which.
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

/**
 * The seven atomic element actions, one registry entry each.
 *
 * Every entry is `type: "cell"`, `slots: ["processing"]`, `scope: "cell"` — the same
 * shape as `isElementAtCell`, and for the same reasons: `processing` is the only slot
 * that delivers a `StructureProcessingContext`, and therefore the only one where
 * "ask a cell what it holds, then change it" can be asked at all.
 *
 * The seven entries are written out rather than generated in a loop, so the file still
 * reads as a catalogue. A `for` over a name list would be shorter and would hide the
 * two that need *different* params — `transformElement` has a second element id, and
 * `countEmpty` has none — which is exactly the detail a generated list hides.
 */
/**
 * The `ElementCreateOptions` the panel exposes, for the three element actions that write.
 *
 * Shared by `createAtCell` and `replaceAtCell` on the writer, which take the **same**
 * options bag — the engine types both as `ElementCreateOptions` (`grid.d.ts:166,178`).
 * One array, so the two actions cannot drift into offering different capabilities.
 *
 * `durationTicks` is the reason this array exists. It sets **both** max and remaining
 * duration *at creation*, so the element is never briefly untimed — which the motion
 * family's `setDuration` cannot promise, because that is a separate per-cell write
 * applied at the flush. A timed spawn is atomic; a set-then-time is not.
 */
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

const ELEMENT_ENTRIES: Omit<HandlerMeta, "cls">[] = [
    {
        key: "readElement",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [...REGION_PARAMS],
    },
    {
        key: "countElements",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
            p("element", "Element", "text", {
                required: true,
                hint: "the element id to count",
            }),
            ...REGION_PARAMS,
        ],
    },
    {
        // No `element` param: it counts the *absence* of one, and an id here would be
        // an option the action ignores — a field that looks meaningful and is not.
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
            p("element", "Element", "text", {
                required: true,
                hint: "the element id to write",
            }),
            ...CREATE_PARAMS,
            ...REGION_PARAMS,
        ],
    },
    {
        key: "createElement",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
            p("element", "Element", "text", { required: true, hint: "the element id to place" }),
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
        // The only one with a **second** element id. `from` is deliberately not
        // `required` — blank means "whatever is there", which is what makes this a
        // normaliser as well as a mapping.
        key: "transformElement",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
            p("from", "From element", "text", {
                hint: "only cells holding this are changed. Leave blank for any.",
            }),
            p("to", "To element", "text", { required: true, hint: "what they become" }),
            // `transformElement` also writes, so it takes the same create options. A
            // transformation that can retime the result is a materially different
            // machine from one that cannot: "dirt becomes timed sand" is a process step
            // a furnace wants, and there is no way to express it by chaining two actions
            // without opening a window where the cell holds untimed sand.
            ...CREATE_PARAMS,
            ...REGION_PARAMS,
        ],
    },
];

/**
 * The structure family, after the motion entries for the same ordering reason: a program
 * places a machine before it fills it.
 *
 * `type: "cell"` throughout — including the two instance actions (`isMyType`,
 * `pushStructure`), because both are reached from a processor tick and both are wired from
 * the panel. The distinction between "about a cell" and "about me" is carried by the
 * **absence** of region params: an instance action takes no `dx`/`dy`/`size`, so the panel
 * cannot offer a region for it and the engine call is unambiguous.
 */
const STRUCTURE_REF_PARAMS: HandlerParam[] = [
    p("structure", "Structure", "text", {
        required: true,
        hint: "the structure id, or a handle from Structure type",
    }),
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
        // No region params: this asks about **my** instance, so there is nothing for an
        // offset or a size to mean. Offering them would be offering a lie.
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

/**
 * The terrain family, after the structure entries and for the sharpest reason of the four:
 * terrain shares the element family's write path, so `type: "cell"` and `scope: "cell"` put
 * it beside the other three while the **writer** is what actually separates it. A panel
 * author choosing between these needs to know which writes are one batch; that lives in the
 * action's doc string ("One atomic batch" / "Per-cell") and the module header's table,
 * because the registry's `params` have nowhere to record it.
 */
const TERRAIN_REF_PARAMS: HandlerParam[] = [
    p("terrain", "Terrain", "text", {
        required: true,
        hint: "the terrain id, or a handle from Terrain type",
    }),
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

const DECLARED_META: Omit<HandlerMeta, "cls">[] = [
    // ── global ───────────────────────────────────────────────────────────────
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
    // `triggerScan` was `slots: ["trigger"]`, and that was wrong. It reads
    // `payload.x`/`payload.y` to find a position, but the engine calls a trigger's
    // callback with **no arguments at all** — `registerTrigger` puts `extra` in the
    // *registration*, not the call. On this slot it could only ever return early,
    // so it was the one trigger action that provably did nothing while looking
    // correctly configured. `tools/analyze-scopes.ts` is what turned that from a
    // hunch into a measurement.
    //
    // It still works on `processing`, which does deliver a position, and the scan
    // it does there is a real one.
    {
        key: "triggerScan",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [p("radius", "Radius", "number", { def: "3", min: 0, int: true })],
    },
    // ── message ──────────────────────────────────────────────────────────────
    { key: "signalLog", type: "message", slots: ["signal"], scope: "structure", params: [] },
    { key: "structureInspect", type: "message", slots: ["signal"], scope: "structure", params: [] },
    {
        // The context's first producer. `processing` is the only slot that delivers
        // a `StructureProcessingContext`, and therefore the only one where "ask a
        // cell what it holds" can be asked at all. The `as` name is not a declared
        // param — it is on the *step*, not the action, and applies to every action.
        key: "isElementAtCell",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
            p("element", "Element", "text", {
                required: true,
                hint: "the element id to test for",
            }),
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
    // `triggerScan` reads `payload.x`/`payload.y` to find a position — but the
    // engine calls a trigger's callback with **no arguments at all**
    // (`registerTrigger` puts `extra` in the registration, not the call). So on
    // this slot it could only ever return early: the one action in the trigger
    // family that provably did nothing, while looking correctly configured.
    // `triggerLog` and `triggerTick` are the ones that actually work there.
    { key: "triggerLog", type: "message", slots: ["trigger"], scope: "global", params: [] },
    // `triggerTick` counts into `payload.data`, so it needs an instance bag — and
    // the `trigger` call site delivers **no payload at all** (see the note above).
    // Offering it there was a wrong answer the old `ACTION_SCOPE` row hid by
    // declaring it needed nothing. It is offered in `signal`, which does hand
    // over a structure.
    { key: "triggerTick", type: "message", slots: ["signal"], scope: "structure", params: [] },
    // The two `feel/` actions. `toast` needs nothing from the payload, so it is
    // offered everywhere the engine will call a process — including `trigger`,
    // which delivers no payload at all. `particles` needs a position.
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
        // `itemAction` is **not** offered: `handleAction(state, action)` delivers
        // `pos: false`, and this action reads `x` / `y` to know where to dig. It was
        // slotted there anyway, which `canRunAt` now refuses — an action offered
        // where the engine hands it nothing it reads quietly does nothing, which is
        // the failure this whole table exists to prevent.
        slots: ["signal", "processing", "modifier"],
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
        // Same reason as `itemExcavate`: `handleAction` delivers no position, and
        // this action needs one to spawn the projectile from.
        slots: ["signal", "processing", "modifier"],
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

    // ── processor ────────────────────────────────────────────────────────────
    {
        key: "processorLog",
        type: "processor",
        slots: ["processing"],
        scope: "structure",
        params: [],
    },
    {
        key: "processorScan",
        type: "processor",
        slots: ["processing"],
        scope: "structure",
        params: [p("radius", "Radius", "number", { def: "1", min: 0, int: true })],
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
    // `processing` only — not `trigger`. It reads `structure.x`/`structure.y` to
    // locate the energy network, and a trigger hands its callback no arguments at
    // all — so on that slot it returned before touching the API. The `trigger`
    // entry was the same silent-nothing bug `triggerScan` had, in a different
    // family.
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
    // `trigger` is legal here and there: `energyConsumePerRun` needs no position,
    // so it does something on both. That is the scope rule doing its job rather
    // than a blanket guess about the family.
    {
        key: "energyConsumePerRun",
        type: "processor",
        // `trigger` is **not** offered: `registerTrigger` calls its callback with no
        // arguments at all, so `payload.x` / `payload.y` are unavailable and there is
        // no network cell to draw from. The action would have returned early every
        // time while looking correctly configured.
        slots: ["processing", "signal", "modifier"],
        scope: "cell",
        params: [
            p("energyType", "Energy type", "text", { required: true }),
            p("amountPerRun", "Amount per run", "number", { def: "1", min: 0 }),
        ],
    },
    // ── projectile ───────────────────────────────────────────────────────────
    // **No rows.** The seven projectile presets are not actions. They are
    // `ProjectileOptionFn`s in `./projectile-option/registry.ts`, browsed by the
    // Handlers tab's ProjectileOption panel and compiled by `compileProjectile`.
    //
    // They resolved to nothing once typed correctly, a projectile could hold a
    // *list* of them, and there was nowhere to put a parameter. The `projectile`
    // HandlerSlot is gone for the same reason — no action can run on that call
    // site.

    // ── tech ─────────────────────────────────────────────────────────────────
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

    // ── modifier ────────────────────────────────────────────────────────────
    { key: "logArgs", type: "modifier", slots: ["modifier"], scope: "global", params: [] },
    { key: "identity", type: "modifier", slots: ["modifier"], scope: "global", params: [] },
    {
        key: "logBuildingPayload",
        type: "modifier",
        slots: ["modifier"],
        scope: "global",
        params: [],
    },
    // The element family, after the message entries they extend.
    ...ELEMENT_ENTRIES,
    // The motion family, after the element entries for the same reason: these are
    // reached for once "what is there" has been answered. `type: "cell"` and
    // `scope: "cell"` are shared with the element family, but the *dependency* is not —
    // these reach `api.elements.*` rather than the processing context, and the measured
    // class and scope in `action-class.ts` / `scope.ts` say so. The registry records what
    // the panel needs to know; those two tables record what the action actually does.
    ...MOTION_ENTRIES,
    // The structure family, after the motion entries for the same ordering reason: a
    // program places a machine before it fills it. `type: "cell"` and `scope: "cell"` are
    // shared with both other families, but the *dependency* is neither: these reach
    // `api.structures.*` and never the processing context, which the measured class and
    // scope in `action-class.ts` / `scope.ts` say so. The registry records what the panel
    // needs; those two tables record what the action actually does.
    ...STRUCTURE_ENTRIES,
    // The terrain family, last of the four: it sits closest to the element family because
    // it shares its write path. `type: "cell"` and `scope: "cell"` are common to all four,
    // but the *dependency* is three-way — element reads the context, terrain and structure
    // do not, and terrain alone batches. The measured class and scope in `action-class.ts`
    // / `scope.ts` say so; the registry records only what the panel needs to render.
    ...TERRAIN_ENTRIES,
];

export const HANDLER_META: HandlerMeta[] = DECLARED_META.map((m) => ({
    ...m,
    api: ACTION_APIS[m.key],
    // An action with no measurement is `pure` by default rather than a hole: it
    // reaches for nothing, which is the weakest claim and the safe default. The
    // inventory test in action-class.test.ts is what catches a real omission.
    cls: ACTION_CLASSES[m.key] ?? "pure",
}));

const META_BY_KEY: Record<string, HandlerMeta> = Object.fromEntries(
    HANDLER_META.map((m) => [m.key, m]),
);

export function handlerMeta(key: string | undefined): HandlerMeta | undefined {
    return key ? META_BY_KEY[key] : undefined;
}

export function handlersForSlot(slot: HandlerSlot): HandlerMeta[] {
    return HANDLER_META.filter((m) => m.slots.includes(slot));
}

/** True when an action's only call site is this one. Derived from `slots`, so it cannot drift. */
export function isOnlyAtSlot(meta: HandlerMeta, slot: HandlerSlot): boolean {
    return meta.slots.length === 1 && meta.slots[0] === slot;
}

/** The actions exclusive to one call site — the "Upgrade actions" tab's contents. */
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

/** `itemAction` handlers legal for one `ItemType`. A `Consumable` yields none. */
export function itemActionHandlersFor(itemType: string | undefined): HandlerMeta[] {
    const t = itemType ?? "";
    // Consumable is rejected outright rather than filtered: there is no
    // ActionType for it, so *no* handler can ever be dispatched — including
    // `noop`, which is otherwise offered everywhere.
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

// ── Validation ───────────────────────────────────────────────────────────────

/**
 * Check a parameter bag against a handler's declared params.
 * Returns human-readable problems; empty means valid.
 */
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
        if (spec.kind === "select" && spec.options && !spec.options.some((o) => o.value === raw)) {
            errs.push(
                `${spec.label} must be one of: ${spec.options.map((o) => o.value).join(", ")}`,
            );
        }
    }
    return errs;
}

/** Turn a validated form bag into a typed `options` object (numbers → numbers). */
/** Handler types a set of keys covers, so a short dropdown says why it is short. */
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

// ── Reachability (9.5) ───────────────────────────────────────────────────────

/**
 * Tab → the call site its processes run on.
 *
 * Exported so the validator and the widget agree about what a slot is, rather than
 * each keeping its own nine-line copy. The one thing this table must not do is
 * drift from `HANDLER_META.slots`, so a test checks the two against each other.
 */
export const TAB_TO_CALL_SITE: Record<string, HandlerSlot> = {
    signals: "signal",
    triggers: "trigger",
    processing: "processing",
    items: "itemAction",
    upgrades: "upgrade",
    modifiers: "modifier",
    // `projectiles` is deliberately **absent**: it is not a HandlerSlot, because a
    // projectile holds an option, not a process. `scanHandlerUsage` walks it
    // separately so the Handlers tab can still show which projectiles use which
    // option without pretending the two are the same kind of reference.
};

/**
 * slot → the config array that holds it.
 *
 * Only the array. This used to be a `[array, field]` pair naming the key that
 * held the handler key, but nothing read the second half: the scan goes through
 * `actionRefsOf`, which is the single reader of a process, precisely so there
 * could not be a second path counting the same slot twice. A field name sitting
 * here invited exactly that.
 */
const SLOT_LOCATION: Record<HandlerSlot, string> = {
    signal: "signals",
    trigger: "triggers",
    processing: "processing",
    upgrade: "upgrades",
    modifier: "modifiers",
    itemAction: "items",
};

/**
 * The same table inverted: which slot a stored config key belongs to.
 *
 * **Computed** from `SLOT_LOCATION` rather than written out beside it. A hand-kept
 * second table is the drift this file already had once — the excavation presets were
 * in one and not the other — and the failure is a scan that silently stops finding
 * usages, which looks exactly like "nothing uses this any more".
 *
 * Needed because a scan walks the *config* (`Object.entries`) while the register path
 * starts from a *slot*. Neither direction is derivable from the other without this.
 */
const SLOTS_BY_CATEGORY: Record<string, HandlerSlot> = Object.fromEntries(
    Object.entries(SLOT_LOCATION).map(([slot, key]) => [key, slot as HandlerSlot]),
) as Record<string, HandlerSlot>;

export { SLOTS_BY_CATEGORY };

/** Where a stored `handlerKey` was found. */
export interface HandlerUsage {
    category: string;
    id: string;
    slot: HandlerSlot;
    /**
     * The action this usage is about. A process may hold several, so one entry
     * in the config can produce several usages — one per action — and each is
     * checked on its own.
     */
    key?: string;
}

/** Every handler reference in the config, tagged with its slot. One usage per action. */
export function scanHandlerUsage(cfg: Record<string, unknown>): HandlerUsage[] {
    const out: HandlerUsage[] = [];
    for (const [slot, cfgKey] of Object.entries(SLOT_LOCATION) as [HandlerSlot, string][]) {
        const list = cfg[cfgKey];
        if (!Array.isArray(list)) continue;
        for (const e of list as Record<string, unknown>[]) {
            // `actionRefsOf` is the one reader of a process, so there is no
            // second path that could count the same slot twice.
            for (const key of actionRefsOf(e as Record<string, unknown>).map((r) => r.key)) {
                out.push({ category: cfgKey, id: String(e.id ?? "?"), slot, key });
            }
        }
    }
    return out;
}

/** Every stored projectile and the option it names. A projectile has no handler slot, so it is scanned apart. */
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

/**
 * Which excavation profiles use which option, and which ones are broken.
 *
 * The excavation twin of `scanProjectileOptionUsage`, reading
 * `excavationProfiles` rather than `projectiles`. It exists so the options tab can
 * say "used ×2" and flag a profile naming a preset that no longer exists — the same
 * two facts the projectile screen shows, for the same reason: an option nobody
 * names is dead code, and one that is named but missing is a profile quietly
 * falling back to a default power.
 */
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
    // Prefer the stored key on the usage itself: with a multi-action process the
    // same entry can appear several times, once per action, and re-deriving the
    // key from the entry would report the first action for all of them.
    return u.key ?? actionRefsOf(e)[0]?.key ?? "";
}

/** Keys used in a slot that the handler cannot legally serve. */
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

/** Reverse index: handler key → the config entries that reference it. */
export function usageIndex(cfg: Record<string, unknown>): Record<string, HandlerUsage[]> {
    const idx: Record<string, HandlerUsage[]> = {};
    for (const u of scanHandlerUsage(cfg)) {
        const key = findKeyForUsage(cfg, u);
        if (!key) continue;
        (idx[key] ??= []).push(u);
    }
    return idx;
}
