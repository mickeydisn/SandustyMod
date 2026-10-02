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




import type { HandlerActionClass } from "../action-facts.ts";
import type { ContentKind, HandlerParam } from "../types.ts";

export type { ContentKind, HandlerParam };


export const ALL_SLOTS = [
    "signal",
    "trigger",
    "processing",
    "upgrade",
    "modifier",
    "itemAction",
] as const satisfies readonly HandlerSlot[];

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

