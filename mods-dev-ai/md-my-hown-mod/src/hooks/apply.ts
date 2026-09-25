/**
 * Attach / detach hooks.intercept and hooks.modify from ModifierConfig entries.
 * Returns unsubscribe functions so teardown can clean up.
 */
import { LOG, type ModifierConfig } from "../constants.ts";
import { resolveHandler } from "./handlers.ts";

type Unsub = () => void;

const active: Map<string, Unsub> = new Map();

function getHooksApi(): {
    intercept?: (id: string, fn: Function, opts?: unknown) => unknown;
    modify?: (id: string, fn: Function, opts?: unknown) => unknown;
} | null {
    try {
        return (globalThis as any).sandkit?.api?.hooks ?? null;
    } catch {
        return null;
    }
}

function wrapUnsub(ret: unknown): Unsub {
    if (typeof ret === "function") return ret as Unsub;
    return () => {};
}

/**
 * Apply one modifier entry. Returns true if a live hook was attached.
 */
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
            `${LOG} modifier ${entry.id}: no handlerKey — stored only. Add a handler in src/hooks/handlers.ts and set handlerKey.`,
        );
        return false;
    }

    const handler = resolveHandler(entry.handlerKey);
    if (!handler) {
        console.warn(
            `${LOG} modifier ${entry.id}: unknown handlerKey "${entry.handlerKey}". Known: see listHandlerKeys()`,
        );
        return false;
    }

    // Kind mismatch guard
    const kind = entry.kind ?? handler.kind;
    if (kind !== handler.kind) {
        console.warn(
            `${LOG} modifier ${entry.id}: config kind="${kind}" but handler "${entry.handlerKey}" is kind="${handler.kind}" — using handler kind`,
        );
    }
    const useKind = handler.kind;

    // Detach previous for same id
    detachModifier(entry.id);

    const hooks = getHooksApi();
    if (!hooks) {
        console.warn(`${LOG} modifier ${entry.id}: sandkit.api.hooks unavailable`);
        return false;
    }

    const opts = entry.options ?? {};

    try {
        if (useKind === "intercept") {
            if (typeof hooks.intercept !== "function") {
                console.warn(`${LOG} hooks.intercept missing`);
                return false;
            }
            const unsub = wrapUnsub(
                hooks.intercept(entry.hookId, (handler as { fn: Function }).fn, opts),
            );
            active.set(entry.id, unsub);
            console.log(`${LOG} modifier ${entry.id}: intercept → ${entry.hookId} (${entry.handlerKey})`);
            return true;
        }

        if (useKind === "modify") {
            if (typeof hooks.modify !== "function") {
                console.warn(`${LOG} hooks.modify missing`);
                return false;
            }
            const unsub = wrapUnsub(
                hooks.modify(entry.hookId, (handler as { fn: Function }).fn, opts),
            );
            active.set(entry.id, unsub);
            console.log(`${LOG} modifier ${entry.id}: modify → ${entry.hookId} (${entry.handlerKey})`);
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
