import { LOG, type ModifierConfig } from "../../constants.ts";
import { api } from "../../packages/mysandkit.ts";
import { resolveModifier } from "../actions/index.ts";

type Unsub = () => void;

const active: Map<string, Unsub> = new Map();

function wrapUnsub(ret: unknown): Unsub {
    if (typeof ret === "function") return ret as Unsub;
    return () => {};
}

export function applyModifier(entry: ModifierConfig): boolean {
    if (entry.enabled === false) {
        console.log(`${LOG} modifier ${entry.id}: disabled, skip`);
        return false;
    }
    if (!entry.hookId) {
        console.warn(`${LOG} modifier ${entry.id}: missing hookId`);
        return false;
    }
    if (!entry.handlerKey) {
        console.warn(
            `${LOG} modifier ${entry.id}: no handlerKey — stored only. Add an action ` +
                `under src/handler/actions/connect/ and set handlerKey.`,
        );
        return false;
    }

    const handler = resolveModifier(entry.handlerKey);
    if (!handler) {
        console.warn(
            `${LOG} modifier ${entry.id}: unknown handlerKey "${entry.handlerKey}". ` +
                `Known: the modifier actions in src/handler/actions/connect/index.ts`,
        );
        return false;
    }

    const kind = entry.kind ?? handler.kind;
    if (kind !== handler.kind) {
        console.warn(
            `${LOG} modifier ${entry.id}: config kind="${kind}" but action "${entry.handlerKey}" is kind="${handler.kind}" — using the action's kind`,
        );
    }
    const useKind = handler.kind;

    detachModifier(entry.id);

    if (!api.hooks.hasHooks()) {
        console.warn(`${LOG} modifier ${entry.id}: sandkit.api.hooks unavailable`);
        return false;
    }

    const opts = entry.options ?? {};

    try {
        if (useKind === "intercept") {
            const unsub = wrapUnsub(
                api.hooks.intercept(
                    entry.hookId,
                    (handler as { fn: Function }).fn as never,
                    opts,
                ),
            );
            if (!unsub) {
                console.warn(`${LOG} hooks.intercept missing`);
                return false;
            }
            active.set(entry.id, unsub);
            console.log(
                `${LOG} modifier ${entry.id}: intercept → ${entry.hookId} (${entry.handlerKey})`,
            );
            return true;
        }

        if (useKind === "modify") {
            const unsub = wrapUnsub(
                api.hooks.modify(
                    entry.hookId,
                    (handler as { fn: Function }).fn as never,
                    opts,
                ),
            );
            if (!unsub) {
                console.warn(`${LOG} hooks.modify missing`);
                return false;
            }
            active.set(entry.id, unsub);
            console.log(
                `${LOG} modifier ${entry.id}: modify → ${entry.hookId} (${entry.handlerKey})`,
            );
            return true;
        }
    } catch (e) {
        console.error(`${LOG} modifier ${entry.id} attach failed`, e);
        return false;
    }

    return false;
}

export function detachModifier(id: string): void {
    const unsub = active.get(id);
    if (!unsub) return;
    try {
        unsub();
    } catch (e) {
        console.warn(`${LOG} modifier ${id} unsub failed`, e);
    }
    active.delete(id);
}

export function applyAllModifiers(entries: ModifierConfig[]): number {
    let n = 0;
    for (const e of entries ?? []) {
        if (!e?.id) continue;
        if (applyModifier(e)) n++;
    }
    return n;
}

export function detachAllModifiers(): void {
    for (const id of [...active.keys()]) {
        detachModifier(id);
    }
}

export function activeModifierIds(): string[] {
    return [...active.keys()];
}
