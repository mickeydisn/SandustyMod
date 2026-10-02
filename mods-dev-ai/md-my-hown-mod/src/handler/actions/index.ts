
import {
    ACTION_ROLES,
    type ActionDef,
    type ActionRole,
    type ActionSignature,
    type HandlerActionFn,
    type ModifierAction,
    type StoredAction,
} from "../core/types.ts";

// --- engine/: actions that do not reach the host -----------------------------
import { processingSenseActions, senseActions } from "./engine/sense.ts";
import { engineDecideActions } from "./engine/decide.ts";
import { processingRememberActions, rememberActions } from "./engine/remember.ts";
import { engineConnectActions, connectModifierActions } from "./engine/connect.ts";
import { engineFeelActions } from "./engine/feel.ts";

// --- api/: actions that drive the host through `api.*` -----------------------
import { decideActions } from "./api/decide.ts";
import { feelActions } from "./api/feel.ts";
import { connectActions } from "./api/connect.ts";
import { actActions, processingActActions } from "./act/index.ts";
import { elementActions } from "./api/element.ts";
import { motionActions } from "./api/motion.ts";
import { structureActions } from "./api/structure.ts";
import { terrainActions } from "./api/terrain.ts";

// --- custom/ and the one folder that is neither ------------------------------
import { bufferActions } from "./custom/buffer.ts";
import { logicActions } from "./logic.ts";
interface Folder {
    signature: ActionSignature;
    defs: Record<string, ActionDef & { kind?: "intercept" | "modify" }>;
}

/**
 * The action key union, derived from the folder list below.
 *
 * `FOLDERS` used to be annotated `readonly Folder[]`, which widened every `defs` to
 * `Record<string, ActionDef>` and erased the literal keys. The `satisfies` clause
 * keeps the same check without the widening, so `keyof` still resolves to the 94 real
 * action names — which is what lets `ACTION_FACTS` be exhaustive at compile time.
 */
type DefKeys<T> = T extends { defs: infer D } ? keyof D & string : never;

const FOLDERS = [
    // engine/ - actions that never touch the host
    { signature: "payload", defs: senseActions },
    { signature: "processing", defs: processingSenseActions },
    { signature: "payload", defs: engineDecideActions },
    { signature: "payload", defs: rememberActions },
    { signature: "processing", defs: processingRememberActions },
    { signature: "payload", defs: engineConnectActions },
    { signature: "modifier", defs: connectModifierActions },
    { signature: "payload", defs: engineFeelActions },

    // api/ - actions that drive the host through api.*
    { signature: "payload", defs: decideActions },
    { signature: "payload", defs: feelActions },
    { signature: "payload", defs: connectActions },
    { signature: "payload", defs: actActions },
    { signature: "processing", defs: processingActActions },
    { signature: "processing", defs: elementActions },
    { signature: "processing", defs: motionActions },
    { signature: "processing", defs: structureActions },
    { signature: "processing", defs: terrainActions },

    // custom/ and logic/ - shared state, and the range-walkers
    { signature: "payload", defs: bufferActions },
    { signature: "payload", defs: logicActions },
] as const satisfies readonly Folder[];

/** Every action key the package actually defines. Compile-time source of truth. */
export type ActionKey = DefKeys<(typeof FOLDERS)[number]>;


export const ALL_ACTIONS: Record<string, StoredAction> = (() => {
    const out: Record<string, StoredAction> = {};
    for (const folder of FOLDERS) {
        for (const [key, def] of Object.entries(folder.defs)) {
            
            
            
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


export function actionKeys(): string[] {
    return Object.keys(ALL_ACTIONS).sort();
}


export function actionKeysOfRole(role: ActionRole): string[] {
    return Object.entries(ALL_ACTIONS)
        .filter(([, a]) => a.role === role)
        .map(([k]) => k)
        .sort();
}


export function actionOf(key: string | undefined): StoredAction | undefined {
    if (!key) return undefined;
    return ALL_ACTIONS[key];
}









export const ANY_ACTIONS: Record<string, HandlerActionFn> = Object.fromEntries(
    Object.entries(ALL_ACTIONS)
        .filter(([, a]) => a.signature === "payload")
        .map(([k, a]) => [k, a.fn]),
);


export const PROCESSING_ACTIONS: Record<string, HandlerActionFn> = Object.fromEntries(
    Object.entries(ALL_ACTIONS)
        .filter(([, a]) => a.signature === "processing")
        .map(([k, a]) => [k, a.fn]),
);


export const MODIFIER_ACTIONS: Record<string, ModifierAction> = Object.fromEntries(
    Object.entries(ALL_ACTIONS)
        .filter(([, a]) => a.signature === "modifier")
        .map(([k, a]) => [k, { kind: a.kind!, fn: a.fn }]),
);


export const ACTION_DOCS: Record<string, string> = Object.fromEntries(
    Object.entries(ALL_ACTIONS).map(([k, a]) => [k, a.doc]),
);


export const ACTIONS_BY_ROLE: Record<ActionRole, string[]> = Object.fromEntries(
    ACTION_ROLES.map((r) => [r, actionKeysOfRole(r)]),
) as Record<ActionRole, string[]>;




export function resolveAction(key: string | undefined): HandlerActionFn | undefined {
    return actionOf(key)?.fn;
}


export function resolveModifier(key: string | undefined): ModifierAction | undefined {
    const a = actionOf(key);
    if (a?.signature !== "modifier") return undefined;
    return { kind: a.kind!, fn: a.fn };
}

export { FOLDERS };
