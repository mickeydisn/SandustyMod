import { applyModifier } from "../../handler/index.ts";
import { registered, type RegisterContext } from "../registry.ts";

/**
 * Modifiers install their own hooks, so this only records which ids are live.
 * `applyAllModifiers` stays the batch entry point for teardown paths.
 */
export function registerModifiers({ config }: RegisterContext): number {
    let n = 0;
    for (const m of config.modifiers ?? []) {
        if (!m?.id || registered.modifiers.has(m.id)) continue;
        if (applyModifier(m)) n++;
        registered.modifiers.add(m.id);
    }
    return n;
}