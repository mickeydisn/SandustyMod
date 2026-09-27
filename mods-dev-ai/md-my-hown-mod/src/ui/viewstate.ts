/**
 * The panel's *volatile* view state — everything that belongs to the screen you
 * are looking at right now, as opposed to the configuration itself.
 *
 * This exists so the reset is one audited list instead of a scatter of setter
 * calls across `goGroup` and `goCategory`. The original bug was exactly that:
 * each navigation function cleared the four fields it happened to know about,
 * so the raw-JSON buffer, the open handler and its parameter values, and every
 * library-picker search string all survived a category change. The next screen
 * inherited the last one's scratch state, which is what made a panel switch look
 * like it only half-worked.
 *
 * `src/ui/viewstate.test.ts` checks that every key here is actually reset in
 * `panel.ts`, so adding a new piece of view state without adding it here — or
 * here without wiring it — is a failing test rather than a bug report.
 */
import { type HandlersTabState, initialHandlersState } from "./panel/handlers.ts";

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
    /** The list screen's text filter. */
    listQuery: string;
    /** The list screen's per-mod filter — the only source filter it has. */
    listOwner: string;
    /**
     * The list screen's "show objects kept out of normal use" tick: an element
     * marked `hidden`, a structure marked `hideFromBuildMenu`.
     *
     * Reset with the rest of the list state because it describes *this* screen's
     * filters. Carried into Items or Terrains it would be a box that can only
     * ever reveal nothing — those categories have no such flag.
     */
    listHidden: boolean;
    /** The list row whose detail is open. */
    openRow: string | null;
}

/**
 * The keys that must be cleared on every screen change, in one place.
 *
 * Order is the order `resetView` applies them, so a diff reads as a checklist.
 */
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

/** A clean screen. Used as the single source for every reset. */
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
        listQuery: "",
        listOwner: "all",
        listHidden: false,
        openRow: null,
    };
}

/**
 * Reset only the fields that a screen change should clear, leaving anything
 * else in the state object alone.
 *
 * Screen state is stored as separate `useState` hooks in `panel.ts` rather than
 * one object, so this is applied setter by setter. Keeping the shape here means
 * the *decision* of what to clear lives in one testable place even though the
 * application is spread across hooks.
 */
export function resetPatch(keep: Partial<VolatileViewState> = {}): VolatileViewState {
    return { ...emptyViewState(), ...keep };
}
