
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



import { elementActions } from "./element/index.ts";



import { motionActions } from "./motion/index.ts";



import { structureActions } from "./structure/index.ts";


import { terrainActions } from "./terrain/index.ts";







import { logicActions } from "./logic/index.ts";


interface Folder {
    signature: ActionSignature;
    defs: Record<string, ActionDef & { kind?: "intercept" | "modify" }>;
}


const FOLDERS: readonly Folder[] = [
    { signature: "payload", defs: senseActions },
    
    
    
    { signature: "processing", defs: processingSenseActions },
    { signature: "payload", defs: decideActions },
    { signature: "payload", defs: actActions },
    { signature: "processing", defs: processingActActions },
    
    
    { signature: "processing", defs: elementActions },
    
    
    { signature: "processing", defs: motionActions },
    
    
    
    { signature: "processing", defs: structureActions },
    
    
    
    
    
    { signature: "processing", defs: terrainActions },
    { signature: "payload", defs: rememberActions },
    
    
    
    
    { signature: "payload", defs: bufferActions },
    { signature: "processing", defs: processingRememberActions },
    { signature: "payload", defs: feelActions },
    { signature: "payload", defs: connectActions },
    { signature: "modifier", defs: connectModifierActions },
    
    
    
    
    
    
    { signature: "payload", defs: logicActions },
] as const;


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
