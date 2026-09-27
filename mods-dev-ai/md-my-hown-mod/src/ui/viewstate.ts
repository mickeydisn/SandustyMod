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
    /** The list screen's text filter. */
    listQuery: string;
    /**
     * The list screen's per-mod filter — the only source filter it has.
     *
     * `"own"` by default, not `"all"`. This screen is a config editor: what the
     * user is looking at, on nearly every visit, is the thing they came to edit.
     * Opening it to three hundred other mods' structures and a scrollbar is not
     * a neutral default, it is the opposite one. "All" is still one click away,
     * and still what `✕ clear` goes to — this only changes where a list *starts*.
     *
     * Typed `OwnerKey | "all"` rather than `string` so the default can be a real
     * value and the setter can still accept a different one.
     */
    listOwner: OwnerKey | "all";
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

/**
 * The list screen's *starting* filters, as values rather than as two literals.
 *
 * The list does not open unfiltered: it opens on the objects the user can edit,
 * with hidden ones out. Both of those were written twice — once in the
 * `useState` initializer in `panel.ts` and once in `emptyViewState` here — and
 * two literals of one default is a silent split. Nothing fails when they drift;
 * the panel just opens on one view and a category change lands on another, which
 * the user experiences as "the filter randomly resets itself".
 *
 * So they are read from here instead. The test asserts these values and that
 * both call sites use them, which is a real check — a source-text match on
 * `useState(...)` was not, and broke on reformatting.
 *
 * Not a volatile key: this is what a clean screen *is*, not something to clear.
 *
 * `listQuery` is widened to `string` on purpose: `as const` would narrow it to
 * the literal `""`, and then `useState` infers `string` state whose setter will
 * not accept a `""` — which is the opposite of what a default is for.
 */
export const LIST_DEFAULTS: Pick<
    VolatileViewState,
    "listQuery" | "listOwner" | "listHidden"
> = {
    listQuery: "",
    listOwner: "own",
    listHidden: false,
};

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
        ...LIST_DEFAULTS,
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
