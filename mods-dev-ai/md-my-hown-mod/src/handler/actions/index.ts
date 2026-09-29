/**
 * The action catalogue: every atomic action, assembled from the role folders.
 *
 * ## What this module is for
 *
 * It is the one place that knows about all six roles, and it does three things:
 *
 *   1. imports each role folder, so adding a folder here is the only edit needed
 *      to make a new group of actions reachable;
 *   2. flattens them into one `key → StoredAction` table, stamping the signature
 *      each folder's actions share;
 *   3. rebuilds the **view** the old three registries gave you, so the rest of
 *      the mod does not have to change shape to accommodate a better layout.
 *
 * ## Why both a flat table and the three legacy views
 *
 * The old layout was `ANY_HANDLERS` / `PROCESS_HANDLERS` / `CODE_HANDLERS`, split
 * by engine argument list. That distinction is real — the engine hands different
 * things to different call sites — so it is kept, but it is now a *view* computed
 * from one table rather than three hand-maintained objects that could disagree.
 *
 * What that buys:
 *
 *   - a key's role, doc and signature now live in one object, so the panel can
 *     group by role without a second lookup table that can drift;
 *   - a duplicate key across two folders is impossible to miss, because the
 *     flatten step is where it would be overwritten (and `actions.test.ts` fails
 *     on it);
 *   - the order the panel shows comes from `ACTION_ROLES`, not object key order.
 *
 * @module
 */
import {
    ACTION_ROLES,
    type ActionDef,
    type ActionRole,
    type ActionSignature,
    type HandlerActionFn,
    type ModifierAction,
    type StoredAction,
} from "../core/types.ts";

import { processingSenseActions, senseActions } from "./sense/index.ts";
import { decideActions } from "./decide/index.ts";
import { actActions, processingActActions } from "./act/index.ts";
import { bufferActions } from "./buffer/index.ts";
import { processingRememberActions, rememberActions } from "./remember/index.ts";
import { feelActions } from "./feel/index.ts";
import { connectActions, connectModifierActions } from "./connect/index.ts";

// The element family: one folder, both roles. `sense` and `act` are declared per
// action; the **signature** is shared, and the file is the family.
import { elementActions } from "./element/index.ts";
// The motion family: velocity, duration, teleport and particles. Same region
// resolver as the element family, deliberately imported *from* it rather than
// re-declared — "the cell above me" must mean one thing across both.
import { motionActions } from "./motion/index.ts";
// The structure family: the buildings themselves. Shares the element family's region
// resolver and `targets` for the same reason motion does — "the cell above me" is one
// meaning across all three, not three that happen to agree.
import { structureActions } from "./structure/index.ts";
// The terrain family: the solid world under the elements. The only one of the four with
// an `api.grid.mutate` writer of its own, so half of it is atomic — see the module header.
import { terrainActions } from "./terrain/index.ts";

// The logic family: the five walks of a range of cells. Registered **last**, and
// that order is not cosmetic — a walk's body is resolved by key through the very
// catalogue this loop is assembling, so `logicAny` must not be able to see itself
// while the table is still being built. Its `resolveAction` call happens at run
// time, long after this loop has finished, so the ordering only has to keep the
// *table* complete by the time anything runs.
import { logicActions } from "./logic/index.ts";

/** One role folder's export, with the signature its actions share. */
interface Folder {
    signature: ActionSignature;
    defs: Record<string, ActionDef & { kind?: "intercept" | "modify" }>;
}

/**
 * The folders, in the order a process reads them.
 *
 * Order matters twice: it is the panel's section order, and it is the order a
 * reader meets them in. It is *not* the order actions execute — that is decided
 * by the author's own process, which is the whole point.
 */
const FOLDERS: readonly Folder[] = [
    { signature: "payload", defs: senseActions },
    // A second sense table, same role, different argument list. See the note on
    // `processingSenseActions` — a cell probe needs the engine context, and this is
    // how a `sense` action gets it without being mis-filed as an `act`.
    { signature: "processing", defs: processingSenseActions },
    { signature: "payload", defs: decideActions },
    { signature: "payload", defs: actActions },
    { signature: "processing", defs: processingActActions },
    // After `act/` so the element actions appear below the originals in the picker —
    // new machinery reads better below the thing it generalises.
    { signature: "processing", defs: elementActions },
    // After the element family, for the same reason: the motion actions are the
    // ones you reach for once "what is there" is answered.
    { signature: "processing", defs: motionActions },
    // Last of the three cell families, and for the same ordering reason: structure
    // actions ask about and drive *buildings*, which is the outermost layer — a program
    // places a machine before it fills it, and the picker should read in that order.
    { signature: "processing", defs: structureActions },
    // After the element family and for the sharpest reason of the four: terrain shares the
    // element family's write path, so putting it last would make the picker suggest a
    // non-atomic family as a sibling of an atomic one with no hint which is which. The
    // action's own doc string says "One atomic batch" or "Per-cell" — that is the cue, and
    // it is the only one that matters when choosing between these.
    { signature: "processing", defs: terrainActions },
    { signature: "payload", defs: rememberActions },
    // The buffer reads and writes with the payload signature, and is filed under
    // "remember" like `structureWriteData` is: both are state that outlives the
    // tick. The one real difference is that a slot is shared, which is exactly
    // what the module note is about.
    { signature: "payload", defs: bufferActions },
    { signature: "processing", defs: processingRememberActions },
    { signature: "payload", defs: feelActions },
    { signature: "payload", defs: connectActions },
    { signature: "modifier", defs: connectModifierActions },
    // The five range walks, last of all. The order is load-bearing in one direction
    // only: a walk resolves its body by key through the catalogue this loop is
    // building, and it does so at **run** time, so the table just has to be complete
    // before any process runs. Registering them last keeps them at the bottom of the
    // picker, which is right — they are a generalisation of the cell families above,
    // not a first thing an author reaches for.
    { signature: "payload", defs: logicActions },
] as const;

/** `key → StoredAction`, flattened from every folder. */
export const ALL_ACTIONS: Record<string, StoredAction> = (() => {
    const out: Record<string, StoredAction> = {};
    for (const folder of FOLDERS) {
        for (const [key, def] of Object.entries(folder.defs)) {
            // A later folder silently overwriting an earlier one would be the
            // one failure this layout could introduce, so it is loud here rather
            // than left for `actions.test.ts` to notice after the fact.
            if (out[key]) {
                throw new Error(
                    `handler: duplicate action key "${key}" — declared in two role folders`,
                );
            }
            out[key] = { ...def, key, signature: folder.signature } as StoredAction;
        }
    }
    return out;
})();

/** Every action key, sorted, for pickers and tests. */
export function actionKeys(): string[] {
    return Object.keys(ALL_ACTIONS).sort();
}

/** The keys in one role, sorted. */
export function actionKeysOfRole(role: ActionRole): string[] {
    return Object.entries(ALL_ACTIONS)
        .filter(([, a]) => a.role === role)
        .map(([k]) => k)
        .sort();
}

/** One action, or undefined. The single lookup everything else goes through. */
export function actionOf(key: string | undefined): StoredAction | undefined {
    if (!key) return undefined;
    return ALL_ACTIONS[key];
}

// ── The legacy views, rebuilt ────────────────────────────────────────────────
//
// The three old registries, computed from the one table above. They keep their
// old names so registration and the published global do not have to change shape
// during a layout change — but they can no longer disagree with each other, which
// is what three hand-maintained objects allowed.

/** Replaces `ANY_HANDLERS`: actions with the general `(payload, extra)` signature. */
export const ANY_ACTIONS: Record<string, HandlerActionFn> = Object.fromEntries(
    Object.entries(ALL_ACTIONS)
        .filter(([, a]) => a.signature === "payload")
        .map(([k, a]) => [k, a.fn]),
);

/** Replaces `PROCESS_HANDLERS`: `process(structure, context)` only. */
export const PROCESSING_ACTIONS: Record<string, HandlerActionFn> = Object.fromEntries(
    Object.entries(ALL_ACTIONS)
        .filter(([, a]) => a.signature === "processing")
        .map(([k, a]) => [k, a.fn]),
);

/** Replaces `CODE_HANDLERS`: still `{ kind, fn }` objects, for the modifier slot. */
export const MODIFIER_ACTIONS: Record<string, ModifierAction> = Object.fromEntries(
    Object.entries(ALL_ACTIONS)
        .filter(([, a]) => a.signature === "modifier")
        .map(([k, a]) => [k, { kind: a.kind!, fn: a.fn }]),
);

/** `key → doc`, merged. The panel builds `key — description` labels from this. */
export const ACTION_DOCS: Record<string, string> = Object.fromEntries(
    Object.entries(ALL_ACTIONS).map(([k, a]) => [k, a.doc]),
);

/** Every action grouped by role, in `ACTION_ROLES` order. */
export const ACTIONS_BY_ROLE: Record<ActionRole, string[]> = Object.fromEntries(
    ACTION_ROLES.map((r) => [r, actionKeysOfRole(r)]),
) as Record<ActionRole, string[]>;

// ── Resolution ───────────────────────────────────────────────────────────────

/**
 * Look up one action by key.
 *
 * One lookup order, and the `modifier` shape is unwrapped explicitly — which the
 * old `resolveAnyHandler` did not do, so it never found the three modifier
 * actions at all.
 */
export function resolveAction(key: string | undefined): HandlerActionFn | undefined {
    return actionOf(key)?.fn;
}

/** Look up a modifier action, with its `kind`. */
export function resolveModifier(key: string | undefined): ModifierAction | undefined {
    const a = actionOf(key);
    if (a?.signature !== "modifier") return undefined;
    return { kind: a.kind!, fn: a.fn };
}

export { FOLDERS };
