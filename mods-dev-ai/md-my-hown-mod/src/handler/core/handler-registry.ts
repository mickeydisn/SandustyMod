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
// Type-only, so this costs no runtime edge. `Opt` is a plain shape, but importing the
// type from `catalog.ts` keeps one definition of "a thing you can pick" rather than the
// two the `{value,label}[]` this replaced had already drifted into.
import type { Opt } from "../../catalog.ts";
// `process.ts` imports only `handlers.ts`, so this is not a cycle.
import { actionRefsOf, flattenRefs, isBlock, setOptionKeysLookup } from "./process.ts";
import { slotsFor } from "./scope.ts";
import { BLOCK_KEY } from "./types.ts";
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
    | "modifier"
    /**
     * A decision block, not an action.
     *
     * `if` is the only entry with this type, and it is here because the Handlers tab
     * lists things a process can *contain* — and a block that appears only in a
     * dropdown somewhere is a block most authors will never find. It has no class, no
     * `api` and no scope-table entry, because the compiler reads it rather than
     * calling it, so it is not in `HANDLER_META` and is never counted as an action.
     */
    | "block";

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
    /**
     * `select` only. A **fixed** list — an enum, a handler key, a machine type.
     *
     * A plain array, deliberately and only. Anything that names real content declares
     * `content` instead (below), because content is a different thing: a literal array
     * cannot name the game's fifty elements or another mod's, and this module may not
     * import the catalogue that could.
     */
    options?: Opt[];
    /**
     * `select` only. Pick a **content object** rather than a fixed option.
     *
     * The panel renders the shared content selector for this, which is how a `terrain`
     * or `element` parameter became a picker instead of a text box. `options` is ignored
     * when this is set.
     *
     * ## Why a `ContentKind` and not the catalogue's own `list*` function
     *
     * The obvious spelling — `options: listTerrains` — is a **cycle**, and the codebase
     * says so where the cycle would form: `catalog.ts` imports this module as a value
     * ("no imports of its own, so this cannot cycle"). Worse than the cycle, `catalog.ts`
     * reaches `api.ts`, which reads the global `sandkit` **at module load** — so naming
     * the function here would make this module, imported by the compiler, the scope
     * tables and every test, fail to load anywhere the host is absent.
     *
     * So the dependency is declared as **data**: "this select wants terrain", with the
     * panel owning the catalogue → lister mapping. It also survives serialisation, which a
     * function reference would not, and it reads as intent in the param table.
     */
    content?: ContentKind;
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
    /**
     * The call sites this action may run at — **derived** from its measured needs
     * (`slotsFor`), which is what every picker and the schema validator read.
     *
     * It used to be hand-written, and 71 of 84 entries disagreed with their own needs.
     * That is not a cosmetic drift: the "add an action" list is built from this field,
     * so a structure click offered 15 actions and an item use 9, where the same model
     * said both could run 77.
     */
    slots: HandlerSlot[];
    /**
     * The slots the registry table *declares*, kept so a test can measure how far off
     * the table was. Not read by the panel — `slots` is the used value.
     */
    declaredSlots?: HandlerSlot[];
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

/**
 * The declared catalogue, with the two derived axes filled in.
 *
 * `api` and `cls` are computed from `ACTION_CLASSES` / `ACTION_APIS` rather than written
 * out per entry, because 84 hand-maintained copies of a measured fact is 84 chances to be
 * wrong — and the measurement already has a test that checks it against behaviour.
 *
 * The raw list stays separate so the entries above read as a plain table; only this
 * export carries the derived fields, and it is the one everything imports.
 */

// The region options every element action shares. One array, spread into each entry,
// because an option that exists for `replaceElement` but not for `countElements` is
// either a mistake or an accident of copy-paste — and the panel would then show a
// field the action ignores, which is the worst outcome a form can have.
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

/**
 * The **matrix** axis, kept out of `REGION_PARAMS` on purpose.
 *
 * `mx`/`my` name one cell of the structure's shape matrix — an *index*, not a
 * location — and every other region field names a *set* of cells. They were one flat
 * list, so a form could offer both and the panel had no way to say the two are
 * mutually exclusive; the resolver picked one silently and the author saw no error.
 *
 * `addressFor` now refuses a form that sets both, and this is the other half: a
 * single-cell action that genuinely wants a matrix cell asks for these two by name,
 * so offering them means something. A **range walk** never gets them at all —
 * `walkFor` refuses a matrix cell, so a field the action would reject is a field the
 * panel should not render.
 */
const MATRIX_PARAMS: HandlerParam[] = [
    p("mx", "Matrix X", "number", {
        int: true,
        hint: "one cell of my shape matrix, by column. Cannot be combined with a " +
            "region field.",
    }),
    p("my", "Matrix Y", "number", { int: true, hint: "one cell of my shape matrix, by row." }),
];

/**
 * The range fields, and nothing else.
 *
 * Used by the five walks, so the panel can never offer a `Matrix X` to an action that
 * would reject it. The distinction is only worth making because a field the action
 * ignores — or refuses — is worse than an absent one: the author fills it in, and the
 * action does something other than what they asked.
 */
const RANGE_PARAMS: HandlerParam[] = REGION_PARAMS;

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
        // `size` here is a **search square**, not a region: this action asks the engine
        // for a free cell and answers with an index, so it never reaches the region
        // resolver and deliberately does not take `MOTION_REGION_PARAMS`. A cell-shaped
        // action that answers a question rather than touching a cell has no offset,
        // footprint or matrix axis to expose.
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

/**
 * What kind of content a parameter points at.
 *
 * The panel maps each of these to the catalogue's own lister (`CONTENT_LISTERS` in
 * `ui/panel.ts`). Kept short and closed on purpose: a new kind should mean a new *kind of
 * object the engine registers*, not a new list function, and a closed union means
 * forgetting to add the mapping is a type error rather than a field that silently renders
 * as a text box.
 */
export type ContentKind = "element" | "structure" | "terrain";

/**
 * The content-reference parameters, as **pickers**.
 *
 * ## Why these are not text boxes
 *
 * Every one of these names a registered content object, and every one was a `text` field
 * until the shared selector was made reachable from a handler parameter (`param-controls.ts`,
 * via `PanelContext.selector`). A text box for this is wrong in three separate ways, and
 * the picker fixes all three at once:
 *
 * 1. **Typos are silent.** `dirt` vs `dirtt` saves fine, validates fine, and fails at
 *    runtime in a processor tick — far from the field that caused it.
 * 2. **The author cannot see what exists.** The game's fifty-odd built-in elements are
 *    not guessable, and neither are another mod's.
 * 3. **Hidden objects are invisible.** The engine's `hidden` flag marks an element the
 *    author deliberately kept out of the normal list; a text box cannot show that one
 *    exists at all, which is the opposite of what "hidden" should mean.
 *
 * The picker answers all three: a swatch, a search box, an owner filter that defaults to
 * this mod, and a toggle that reveals what is hidden with a count of what it revealed.
 *
 * And because it reads the catalogue **when the panel opens**, the list is whatever other
 * mods registered this session — never a snapshot frozen at import time, which is the
 * whole reason `content` names a kind rather than holding a captured array.
 */
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
        // The one element action that addresses a **single** cell, so it is the one
        // that gets `MATRIX_PARAMS` as well: "the element at matrix 2,3" is a real
        // question about a machine's own layout, and it is answered in cells.
        //
        // The two lists together are the whole vocabulary — a position, a delta, a
        // square, a footprint, or a matrix cell — and `addressFor` refuses a form that
        // names two of them at once, so no combination here is a silent winner.
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
            elementRef("the element to write"),
            ...CREATE_PARAMS,
            ...REGION_PARAMS,
        ],
    },
    {
        // "Take this element out of here" — the family could create, replace,
        // transform and empty, but not remove one *type* from a region. A machine
        // that consumes what it is given has no other way to say so.
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

/**
 * The five range walks.
 *
 * `type: "cell"` and `scope: "cell"` are shared with the four cell families, and
 * that is accurate: a walk *is* a cell action applied to a range. `scope.ts`
 * records the real dependency, and it is the one place in this registry where the
 * five do not agree with each other — the four readers need only `["pos", "read"]`
 * while `logicForEach` needs `["pos", "commit"]`, because it writes through the
 * element family's `writeCells` and inherits that batch path's context dependency.
 *
 * The registry records what the panel must render. `scope.ts` records what the
 * action actually needs, and the two are allowed to disagree — the test that
 * matters is `scope.test.ts`'s, which measures the code rather than this table.
 *
 * ## Why the slots are not `ALL_SLOTS`
 *
 * A walk needs a position to anchor its range, and three call sites deliver none:
 * `trigger` (the engine calls back with literally nothing — see `registerTrigger`),
 * `upgrade` (an item instance) and `behavior` (a key code). Listing them would
 * offer a walk that resolves its range against a cursor fallback and writes to a
 * cell the author never chose. `scope.test.ts` fails on exactly that, which is the
 * point of deriving slots from measured needs in the first place.
 */
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
        // No `element` param, and the omission is deliberate: a total needs a number
        // and a cell does not have one. It sums terrain hit points, so the only
        // inputs are the range. A field here would be an option the action ignores.
        key: "logicSum",
        type: "cell",
        slots: ["signal", "processing", "itemAction", "modifier"],
        scope: "cell",
        params: [...RANGE_PARAMS],
    },
    {
        key: "logicForEach",
        type: "cell",
        // `processing` only, and the reason is the whole point of the `commit` need:
        // this writes through `api.grid.mutate`'s callback, which reads the batch's
        // staged writes through the processing context. `itemAction` is the slot a
        // reader can reach and a writer cannot — an item use hands over the engine
        // state and **no** `StructureProcessingContext`, so offering a batch write
        // there would promise a change that cannot happen. That asymmetry is
        // intended: a tool can *ask* about the cells under the cursor and cannot
        // atomically rewrite them through the processor's batch.
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
            // `RANGE_PARAMS`, never `MATRIX_PARAMS`: a walk refuses a matrix cell, so
            // rendering that field would offer the author an input this action rejects.
            ...RANGE_PARAMS,
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
    {
        // The decide family's pick action. See the action's own doc for why it
        // reads `api.random` rather than calling `Math.random()`: the engine's
        // generator is deterministic and shared, so a save-and-reload reproduces
        // the same picks and the mod does not fork the world's randomness.
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
        // The decide family's only threshold action, and the reason every rule of
        // the form "once it reaches N" was previously inexpressible.
        //
        // The `if` block branches on the **truthiness** of a context variable,
        // which is enough for a flag and not enough for a number — and a charge
        // meter reaching 50 is a number. Without something to turn that number
        // into a truth value, a config could fill a buffer and never know it.
        //
        // It declares **every** slot because `scope` is `[]`: it reads its own
        // options and nothing else, so it is safe anywhere the engine will call a
        // process, including `trigger` (which passes no payload at all).
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
        // The arithmetic companion to `compare`, and declared in **every** slot for
        // the same reason: it reads its own options and nothing else.
        //
        // It is here because without it a value could be read but never transformed,
        // so every *rate* in a config had to be a literal. The case that forced it:
        // a generator that charges at `round(cells / mult)` across three materials.
        // All three charged identically and `mult` was decoration on the tooltip.
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
        // The live half of a `senderType` signal. `registerSenderType` only seeds a
        // wire when it is drawn; this is what keeps a sensor's output current, and
        // it is the call the source mod used for its material links.
        key: "signalOutput",
        type: "message",
        slots: ["signal", "processing"],
        scope: "structure",
        params: [p("value", "Output", "bool", { def: "false" })],
    },
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
    // ── The buffer family ─────────────────────────────────────────────────────
    //
    // Declared here so the panel can build a real option form for each one, the
    // same way it does for every other action — which is the whole reason this
    // table exists. `path` is the only field all three share, and it is the field
    // that matters: a wrong path is the one mistake these can make that the author
    // cannot see at run time, so the hint points at the Buffer tab rather than
    // describing the syntax again.
    {
        // The element data slots. `slot` is a **number**, 1–4, and that is the
        // whole reason the element's `Data fields` list asks for one in a column:
        // the engine stores `field1..4` and nothing else, so a name typed there
        // would have nothing to resolve against. `slotValue` rather than `value`
        // so the two read as a pair — the destination and what goes in it.
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
            // Not `required`, and deliberately: an author who writes `{"value":"{{x}}"}`
            // against a variable that never got bound should have the write
            // dropped, not be told the step is malformed. A missing value is
            // `undefined`, which is a legitimate thing to store in a slot.
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
            // Required, unlike `bufferWrite`'s value. An increment with an implied
            // step of 1 is the kind of default that reads fine and means something
            // other than what was meant, and the action itself refuses a missing
            // delta — so the form says the same thing the code does.
            p("delta", "Amount", "number", { required: true, def: "1", int: true }),
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
        // `itemAction` is offered again, and this is the entry that proves why `pos` was
        // corrected for it. The row used to say `pos: false` on the grounds that
        // "`handleAction` delivers no position" — true of the *argument*, which is the
        // engine state, and false of the *call site*, because
        // `api.input.getMouseCellPosition()` is ambient (`input.d.ts:37`).
        //
        // So an action named for items could not run on an item, and the dig presets
        // built on it were `itemAction` actions that "returned a value nothing reads"
        // (see `excavation-option/`). Both problems had the same single cause.
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
        // Same reason as `itemExcavate`, and the same fix: a Weapon has a cursor and the
        // engine will tell us where it is, so this runs from the hotbar.
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

    // ── processor ────────────────────────────────────────────────────────────
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
    // The logic family, after all four cell families: a walk is one of those cell
    // actions applied to a range, so it is a generalisation of them rather than a
    // sibling. Last also because it is the only family that can *loop*, and an
    // author reaching for a loop has usually already decided what the cells do.
    ...LOGIC_ENTRIES,
];

/**
 * Slots a `type` restricts to, on top of what the action *needs*.
 *
 * Needs alone are not the whole story, and the one place they are not is a matter of
 * **subject**, not capability. A `tech` action reaches `api.tech.conservatory` and
 * reads no payload at all, so its measured needs are `[]` — which would offer it in
 * every slot, including "structure click". Clicking a structure should not unlock a
 * tech, however capable the tech action happens to be.
 *
 * So `tech` keeps the `upgrade` slot, and it is written as **one rule** rather than
 * seven hand-written values. Every other type is left entirely to the scope model:
 * a `cell`, `message`, `processor`, `modifier` or `global` action is offered wherever
 * the call site delivers what it needs.
 */
const TYPE_SLOTS: Partial<Record<HandlerType, HandlerSlot[]>> = {
    tech: ["upgrade"],
};

/**
 * The call sites one entry is offered at: what it needs, narrowed by its subject.
 *
 * Exported so the scope test can assert the two halves agree, rather than only that
 * the result does.
 */
export function slotsForEntry(
    m: { key: string; type: HandlerType },
): HandlerSlot[] {
    const needed = slotsFor(m.key) as HandlerSlot[];
    const narrowed = TYPE_SLOTS[m.type];
    if (!narrowed) return needed;
    return needed.filter((s) => narrowed.includes(s));
}

/**
 * The declared catalogue, with every **derived** axis filled in.
 *
 * `api`, `cls` and `slots` are all computed rather than written out per entry, and
 * `slots` is the one that was missing until now: the registry carried a hand-written
 * column that `scope.ts` was written to *replace*, and 84 copies of a measured fact is
 * 84 chances to be wrong.
 *
 * ## What that hand-written column was costing
 *
 * Measured, 71 of 84 entries disagreed with their own needs, and **50** were pinned to
 * `processing` alone. The panel builds its "add an action" list from this column, so
 * the visible effect was that a structure click offered **15** actions and an item use
 * offered **9** — while the same scope model said both could run **77**. The actions
 * were fine; the picker was hiding them.
 *
 * The declared `slots` stays in `DECLARED_META`: it reads well in the table, and
 * `declaredSlots` keeps a copy so a test can say *how far off* the table was.
 *
 * The fallback is deliberate and tested: an entry whose derived slots come back empty
 * would otherwise vanish from every picker with no error at all, so it keeps what it
 * declared. `scope.test.ts` asserts that no declared entry ever takes that path.
 */
export const HANDLER_META: HandlerMeta[] = DECLARED_META.map((m) => {
    const derived = slotsForEntry(m);
    return {
        ...m,
        api: ACTION_APIS[m.key],
        // An action with no measurement is `pure` by default rather than a hole: it
        // reaches for nothing, which is the weakest claim and the safe default. The
        // inventory test in action-class.test.ts is what catches a real omission.
        cls: ACTION_CLASSES[m.key] ?? "pure",
        slots: derived.length ? derived : m.slots,
        declaredSlots: m.slots,
    };
});

/**
 * The `if` block, as a reference entry.
 *
 * Deliberately **not** in `HANDLER_META`. That array is the action catalogue: the
 * usage scan counts it, the scope tests iterate it, the "84 actions" figure is it. A
 * block is not an action, and folding it in would make every one of those numbers lie
 * by one — most visibly the count of actions available in a slot.
 *
 * It is separate because the Handlers tab is a *reference*, and a reference that omits
 * something you can put in a process is not a reference. `slots` is every slot: a
 * conditional needs nothing from the call site, so it runs anywhere.
 */
export const BLOCK_META: HandlerMeta = {
    key: BLOCK_KEY,
    type: "block",
    cls: "pure",
    // Every `HandlerSlot` — the six config places a process can be stored. A
    // conditional needs nothing from the call site, so it runs in all of them.
    // (`slotsFor` also answers `behavior`, which is not a slot a config array maps
    // to; it is deliberately absent here.)
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

// The compiler cannot import this module — it already imports `./process.ts`, and
// the reverse edge would be a cycle. So the params are handed over instead, and
// the compiler asks for them through `optionKeysFor`. See the note there.
setOptionKeysLookup((key) => {
    const meta = handlerMeta(key);
    if (!meta) return undefined;
    const names = new Set<string>();
    for (const p of meta.params ?? []) names.add(p.key);
    // A stored step holds these two beside `options`, so a caller walking a whole
    // step must be able to say "unknown option" without also flagging them.
    names.add("key");
    names.add("as");
    return names;
});

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
        if (spec.kind === "select") {
            if (spec.content) {
                // Content membership is **not** checked here, and deliberately. The list
                // is whatever every mod registered this session; this module cannot see
                // it, and a check against a stale or partial list would reject a value
                // that is perfectly valid. The picker is the check — it can only produce
                // a value from the list, and it shows orphans rather than hiding them.
                //
                // What *is* enforced is emptiness, but the `required` check above already
                // covers it: an empty string is `raw === ""`, and that branch runs first
                // and `continue`s. So there is nothing left to say here, and saying
                // something would double-report.
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
            // second path that could count the same slot twice. `flattenRefs`
            // then walks **into** any `if` block, because a step the panel cannot
            // count is a step the panel cannot offer to fix — an action used only
            // inside a branch would look unused and the author would have no way
            // to learn otherwise.
            const refs = flattenRefs(actionRefsOf(e as Record<string, unknown>));
            for (const key of refs.map((r) => r.key)) {
                // A block is not an action, so it is a compiler node with no registry
                // entry. Counting it would report a dangling reference.
                if (isBlock({ key })) continue;
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
