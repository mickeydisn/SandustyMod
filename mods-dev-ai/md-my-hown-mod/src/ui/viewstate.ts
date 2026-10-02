import { type HandlersTabState, initialHandlersState } from "./panel/handlers.ts";
import type { OwnerKey } from "./panel/list.ts";

export type ViewMode = "list" | "form";

export interface VolatileViewState {
    mode: ViewMode;
    form: Record<string, string>;
    editingId: string | null;
    confirmId: string | null;
    jsonText: string;
    jsonError: string | null;
    libQuery: Record<string, string>;
    handlerTab: HandlersTabState;

    listQuery: string;

    listOwner: OwnerKey | "all";

    listHidden: boolean;

    openRow: string | null;
}

export const VOLATILE_KEYS = [
    "mode",
    "form",
    "editingId",
    "confirmId",
    "jsonText",
    "jsonError",
    "libQuery",
    "handlerTab",
    "listQuery",
    "listOwner",
    "listHidden",
    "openRow",
] as const satisfies readonly (keyof VolatileViewState)[];

export const LIST_DEFAULTS: Pick<
    VolatileViewState,
    "listQuery" | "listOwner" | "listHidden"
> = {
    listQuery: "",
    listOwner: "own",
    listHidden: false,
};

export function emptyViewState(): VolatileViewState {
    return {
        mode: "list",
        form: {},
        editingId: null,
        confirmId: null,
        jsonText: "",
        jsonError: null,
        libQuery: {},
        handlerTab: initialHandlersState(),
        ...LIST_DEFAULTS,
        openRow: null,
    };
}
