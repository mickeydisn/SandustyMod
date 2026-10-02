import {
    ACTION_ROLES,
    type ActionDef,
    type ActionRole,
    type ActionSignature,
    type HandlerActionFn,
    type ModifierAction,
    type StoredAction,
} from "../engine/types.ts";

import { processingSenseActions, senseActions } from "./engine/sense.ts";
import { engineDecideActions } from "./engine/decide.ts";
import { processingRememberActions, rememberActions } from "./engine/remember.ts";
import { connectModifierActions, engineConnectActions } from "./engine/connect.ts";
import { engineFeelActions } from "./engine/feel.ts";
import { processorActions } from "./engine/processors.ts";

import { gridActions } from "./api/grid.ts";
import { projectilesActions } from "./api/projectiles.ts";
import { structureActions } from "./api/structures.ts";
import { elementsActions, motionActions } from "./api/elements.ts";
import { terrainActions } from "./api/terrains.ts";
import { energyActions } from "./api/energy.ts";
import { signalsActions } from "./api/signals.ts";
import { techActions } from "./api/tech.ts";
import { playerActions } from "./api/player.ts";
import { upgradesActions } from "./api/upgrades.ts";
import { effectsActions } from "./api/effects.ts";
import { uiActions } from "./api/ui.ts";
import { randomActions } from "./api/random.ts";

import { bufferActions } from "./custom/buffer.ts";
import { logicActions } from "./logic.ts";
interface Folder {
    signature: ActionSignature;
    defs: Record<string, ActionDef & { kind?: "intercept" | "modify" }>;
}

type DefKeys<T> = T extends { defs: infer D } ? keyof D & string : never;

const FOLDERS = [
    { signature: "payload", defs: senseActions },
    { signature: "processing", defs: processingSenseActions },
    { signature: "payload", defs: engineDecideActions },
    { signature: "payload", defs: rememberActions },
    { signature: "processing", defs: processingRememberActions },
    { signature: "payload", defs: engineConnectActions },
    { signature: "modifier", defs: connectModifierActions },
    { signature: "payload", defs: engineFeelActions },
    { signature: "processing", defs: processorActions },

    { signature: "payload", defs: randomActions },
    { signature: "payload", defs: uiActions },
    { signature: "payload", defs: effectsActions },
    { signature: "payload", defs: signalsActions },
    { signature: "payload", defs: energyActions },
    { signature: "payload", defs: techActions },
    { signature: "payload", defs: playerActions },
    { signature: "payload", defs: upgradesActions },
    { signature: "payload", defs: gridActions },
    { signature: "payload", defs: projectilesActions },
    { signature: "processing", defs: elementsActions },
    { signature: "processing", defs: motionActions },
    { signature: "processing", defs: structureActions },
    { signature: "processing", defs: terrainActions },

    { signature: "payload", defs: bufferActions },
    { signature: "payload", defs: logicActions },
] as const satisfies readonly Folder[];

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
