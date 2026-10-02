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

    slots: HandlerSlot[];

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

export const HANDLER_SCOPE_LABELS: Record<HandlerScope, string> = {
    global: "Global",
    structure: "Structure",
    cell: "Cell",
    tech: "Tech node",
    item: "Item",
};
